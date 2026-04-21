import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminAuthenticated } from '@/lib/auth';

const Schema = z.object({
  spot_id:   z.string().uuid(),
  condition: z.enum(['alive', 'bustato', 'demolito']),
  note:      z.string().max(300).optional(),
  photo_url: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const result = Schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ ok: false, error: 'Dati non validi' }, { status: 422 });
  }

  const { spot_id, condition, note, photo_url } = result.data;
  const supabase = supabaseAdmin();

  // Aggiorna condizione spot
  const { error: updateErr } = await supabase
    .from('spots')
    .update({
      condition,
      condition_updated_at: new Date().toISOString(),
    })
    .eq('id', spot_id);

  if (updateErr) {
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
  }

  // Inserisci record di storico aggiornamento
  await supabase.from('spot_status_updates').insert({
    spot_id,
    condition,
    note:      note ?? null,
    photo_url: photo_url ?? null,
  });

  return NextResponse.json({ ok: true });
}
