import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { UUID_RE } from '@/lib/validation';

/**
 * PATCH  /api/spots/[id]  — il proprietario modifica il proprio spot
 * DELETE /api/spots/[id]  — il proprietario cancella (soft-delete) il proprio spot
 *
 * Autorizzazione: access_token nel body -> auth.getUser -> deve combaciare con
 * spots.submitted_by_user_id. Nessun altro puo toccare lo spot (nemmeno un
 * utente loggato diverso). L'admin usa gli endpoint /api/admin/*.
 */

const EditSchema = z.object({
  name:        z.string().min(2).max(100).optional(),
  type:        z.enum(['street','park','diy','rail','ledge','trail','plaza','gap','bowl','pumptrack']).optional(),
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
    .select('id, submitted_by_user_id, status')
    .eq('id', spotId)
    .single();

  if (!spot) return { error: 'Spot non trovato.', status: 404 as const };
  if (!spot.submitted_by_user_id || spot.submitted_by_user_id !== user.id) {
    return { error: 'Non sei il proprietario di questo spot.', status: 403 as const };
  }
  return { supabase, user, spot };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const spotId = params.id;
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

  return NextResponse.json({ ok: true, slug: updated?.slug });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const spotId = params.id;
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

  // Soft-delete: sparisce da mappa/pagina (filtrano status='approved'), reversibile da admin
  const { error: delErr } = await auth.supabase
    .from('spots')
    .update({ status: 'deleted', updated_at: new Date().toISOString() })
    .eq('id', spotId);

  if (delErr) {
    console.error('[spots DELETE] soft-delete error:', delErr.message);
    return NextResponse.json({ ok: false, error: 'Errore durante l\'eliminazione. Riprova.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
