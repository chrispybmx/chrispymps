import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminAuthenticated } from '@/lib/auth';
import { submitToIndexNow } from '@/lib/indexnow';
import { APP_CONFIG, TIPI_SPOT_TUTTI, OSTACOLI_TUTTI } from '@/lib/constants';

const Schema = z.object({
  id:          z.string().uuid(),
  name:        z.string().min(2).max(100).optional(),
  /* Derivato da lib/constants, mai ricopiato: l'elenco scritto a mano qui
     ha respinto la categoria `transition` per cinque giorni. */
  type:        z.enum(TIPI_SPOT_TUTTI).optional(),
  ostacoli:    z.array(z.enum(OSTACOLI_TUTTI)).max(8).optional(),
  city:        z.string().max(60).optional(),
  description: z.string().max(500).optional().nullable(),
  surface:     z.string().max(50).optional().nullable(),
  wax_needed:  z.boolean().optional(),
  guardians:   z.string().max(200).optional().nullable(),
  difficulty:  z.string().optional().nullable(),
  youtube_url: z.string().url().optional().nullable(),
  lat:         z.number().min(-90).max(90).optional(),
  lon:         z.number().min(-180).max(180).optional(),
});

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const body   = await req.json().catch(() => ({}));
  const result = Schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ ok: false, error: 'Dati non validi' }, { status: 422 });
  }

  const { id, ...updates } = result.data;
  const supabase = supabaseAdmin();

  const { data: updated, error } = await supabase
    .from('spots').update(updates).eq('id', id)
    .select('slug, city').single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Il contenuto e' cambiato: invalida la cache (la pagina spot e' ISR
  // revalidate=300, senza questo la modifica non si vede per 5 minuti) e
  // segnala ai motori di ri-crawlare.
  if (updated?.slug) {
    const cityPath = updated.city ? `/map/${updated.city.toLowerCase().replace(/\s+/g, '-')}` : null;
    try {
      revalidatePath(`/map/spot/${updated.slug}`);
      revalidatePath('/');
      revalidatePath('/scopri');
      if (cityPath) revalidatePath(cityPath);
    } catch (e) {
      console.error('[edit-spot] revalidate:', e);
    }
    await submitToIndexNow([
      `${APP_CONFIG.url}/map/spot/${updated.slug}`,
      ...(cityPath ? [`${APP_CONFIG.url}${cityPath}`] : []),
    ]);
  }

  return NextResponse.json({ ok: true });
}
