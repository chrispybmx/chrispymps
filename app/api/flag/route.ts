import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';

const Schema = z.object({
  spot_id:        z.string().uuid(),
  reason:         z.string().min(3).max(200),
  details:        z.string().max(500).optional(),
  reporter_email: z.string().email().max(254).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const result = Schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ ok: false, error: 'Dati non validi' }, { status: 422 });
  }

  const supabase = supabaseAdmin();

  // Verifica che lo spot esista (evita insert orphan su spot_id inesistente)
  const { data: spotExists } = await supabase
    .from('spots')
    .select('id')
    .eq('id', result.data.spot_id)
    .single();

  if (!spotExists) {
    // Risposta generica per non rivelare info sullo spot
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const { error } = await supabase.from('flags').insert({
    spot_id:        result.data.spot_id,
    reason:         result.data.reason,
    details:        result.data.details ?? null,
    reporter_email: result.data.reporter_email ?? null,
  });

  if (error) {
    console.error('[flag] DB error:', error.message);
    return NextResponse.json({ ok: false, error: 'Errore interno. Riprova.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
