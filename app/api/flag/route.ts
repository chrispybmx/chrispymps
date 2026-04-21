import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';

const Schema = z.object({
  spot_id:        z.string().uuid(),
  reason:         z.string().min(3).max(200),
  details:        z.string().max(500).optional(),
  reporter_email: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const result = Schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ ok: false, error: 'Dati non validi' }, { status: 422 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from('flags').insert({
    spot_id:        result.data.spot_id,
    reason:         result.data.reason,
    details:        result.data.details ?? null,
    reporter_email: result.data.reporter_email ?? null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
