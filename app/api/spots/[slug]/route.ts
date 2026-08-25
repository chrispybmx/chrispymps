import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase';
import { UUID_RE } from '@/lib/validation';
import { TIPI_SPOT_TUTTI, OSTACOLI_TUTTI } from '@/lib/constants';

/**
 * Invalida le pagine che mostrano uno spot. Senza questo la pagina spot (ISR,
 * revalidate=300) e la home continuano a servire la versione vecchia per 5
 * minuti: l'utente salva una modifica, vede "aggiornato", ricarica e trova i
 * dati di prima — sembra rotto. Stesso problema dopo l'eliminazione.
 */
function revalidateSpot(slug?: string | null, city?: string | null) {
  try {
    if (slug) revalidatePath(`/map/spot/${slug}`);
    revalidatePath('/');
    revalidatePath('/scopri');
    if (city) revalidatePath(`/map/${city.toLowerCase().replace(/\s+/g, '-')}`);
  } catch (e) {
    console.error('[spots] revalidate:', e);
  }
}

/**
 * GET    /api/spots/[slug]  — dettaglio spot per slug (pubblico, solo approvati)
 * PATCH  /api/spots/[id]    — il proprietario modifica il proprio spot (param = UUID)
 * DELETE /api/spots/[id]    — il proprietario cancella (soft-delete) il proprio spot
 *
 * GET e PATCH/DELETE condividono lo stesso segmento dinamico [slug] (Next.js non
 * ammette due slug diversi allo stesso livello). Il GET lo interpreta come slug
 * testuale; PATCH/DELETE come UUID (il client manda spot.id). UUID_RE distingue.
 *
 * Autorizzazione scrittura: access_token nel body -> auth.getUser -> deve
 * combaciare con spots.submitted_by_user_id. Nessun altro puo toccare lo spot.
 */

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('spots')
    .select(`
      *,
      spot_photos (id, url, position, credit_name)
    `)
    .eq('slug', params.slug)
    .eq('status', 'approved')
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'Spot non trovato' }, { status: 404 });
  }

  // Ordina foto per posizione
  if (data.spot_photos) {
    data.spot_photos.sort((a: { position: number }, b: { position: number }) => a.position - b.position);
  }

  return NextResponse.json({ ok: true, data }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}

const EditSchema = z.object({
  name:        z.string().min(2).max(100).optional(),
  /* Derivato da lib/constants, mai ricopiato: l'elenco scritto a mano qui
     ha respinto la categoria `transition` per cinque giorni. */
  type:        z.enum(TIPI_SPOT_TUTTI).optional(),
  ostacoli:    z.array(z.enum(OSTACOLI_TUTTI)).max(8).optional(),
  description: z.string().max(500).nullable().optional(),
  guardians:   z.string().max(200).nullable().optional(),
  difficulty:  z.string().max(30).nullable().optional(),
  access_token: z.string().min(1).max(2048),
});

/** Carica lo spot e verifica che il token appartenga al proprietario. */
async function authorizeOwner(spotId: string, token: string) {
  const supabase = supabaseAdmin();

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return { error: 'Token non valido. Riaccedi.', status: 401 as const };

  const { data: spot } = await supabase
    .from('spots')
    .select('id, submitted_by_user_id, status, slug, city')
    .eq('id', spotId)
    .single();

  if (!spot) return { error: 'Spot non trovato.', status: 404 as const };
  if (!spot.submitted_by_user_id || spot.submitted_by_user_id !== user.id) {
    return { error: 'Non sei il proprietario di questo spot.', status: 403 as const };
  }
  return { supabase, user, spot };
}

export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
  const spotId = params.slug;
  if (!UUID_RE.test(spotId)) {
    return NextResponse.json({ ok: false, error: 'ID non valido' }, { status: 400 });
  }

  let parsed: z.infer<typeof EditSchema>;
  try {
    parsed = EditSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'Dati non validi. Controlla i campi.' }, { status: 422 });
  }

  const auth = await authorizeOwner(spotId, parsed.access_token);
  if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  // Cancellati non modificabili
  if (auth.spot.status === 'deleted') {
    return NextResponse.json({ ok: false, error: 'Questo spot è stato eliminato.' }, { status: 410 });
  }

  // Solo i campi forniti — undefined lasciati intatti; null azzera description/guardians/difficulty
  const patch: Record<string, unknown> = {};
  if (parsed.name        !== undefined) patch.name        = parsed.name.trim();
  if (parsed.type        !== undefined) patch.type        = parsed.type;
  if (parsed.description !== undefined) patch.description = parsed.description || null;
  if (parsed.guardians   !== undefined) patch.guardians  = parsed.guardians || null;
  if (parsed.difficulty  !== undefined) patch.difficulty = parsed.difficulty || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: 'Nessuna modifica.' }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  const { data: updated, error: updErr } = await auth.supabase
    .from('spots')
    .update(patch)
    .eq('id', spotId)
    .select('slug')
    .single();

  if (updErr) {
    console.error('[spots PATCH] update error:', updErr.message);
    return NextResponse.json({ ok: false, error: 'Errore durante il salvataggio. Riprova.' }, { status: 500 });
  }

  revalidateSpot(updated?.slug ?? auth.spot.slug, auth.spot.city);
  return NextResponse.json({ ok: true, slug: updated?.slug });
}

export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  const spotId = params.slug;
  if (!UUID_RE.test(spotId)) {
    return NextResponse.json({ ok: false, error: 'ID non valido' }, { status: 400 });
  }

  let token = '';
  try {
    const body = await req.json();
    token = typeof body?.access_token === 'string' ? body.access_token : '';
  } catch {
    return NextResponse.json({ ok: false, error: 'Request non valida' }, { status: 400 });
  }
  if (!token) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 });

  const auth = await authorizeOwner(spotId, token);
  if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  if (auth.spot.status === 'deleted') {
    return NextResponse.json({ ok: true }); // gia cancellato, idempotente
  }

  // Soft-delete: sparisce da mappa/pagina (filtrano status='approved').
  // Ripristinabile solo via SQL (l'admin elenca solo i 'pending') — vedi
  // supabase/migrations/20260722_spot_status_deleted.sql
  const { error: delErr } = await auth.supabase
    .from('spots')
    .update({ status: 'deleted', updated_at: new Date().toISOString() })
    .eq('id', spotId);

  if (delErr) {
    console.error('[spots DELETE] soft-delete error:', delErr.message);
    return NextResponse.json({ ok: false, error: 'Errore durante l\'eliminazione. Riprova.' }, { status: 500 });
  }

  revalidateSpot(auth.spot.slug, auth.spot.city);
  return NextResponse.json({ ok: true });
}
