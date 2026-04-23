import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase';
import { z } from 'zod';

const Schema = z.object({
  bio:              z.string().max(200).optional().nullable(),
  instagram_handle: z.string().max(60).optional().nullable(),
});

/* POST /api/profile — update own profile */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 });

  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabaseServer().auth.getUser(token);
  if (!user) return NextResponse.json({ ok: false, error: 'Sessione scaduta' }, { status: 401 });

  const body  = await req.json().catch(() => ({}));
  const result = Schema.safeParse(body);
  if (!result.success) return NextResponse.json({ ok: false, error: 'Dati non validi' }, { status: 422 });

  const sb = supabaseAdmin();
  const { error } = await sb
    .from('profiles')
    .update(result.data)
    .eq('id', user.id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
