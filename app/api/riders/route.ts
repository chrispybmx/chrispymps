import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase';

/* GET /api/riders?spot_id=xxx  — count + has current user ridden */
export async function GET(req: NextRequest) {
  const spotId = req.nextUrl.searchParams.get('spot_id');
  if (!spotId) return NextResponse.json({ ok: false, error: 'spot_id required' }, { status: 400 });

  const sb = supabaseAdmin();

  const { count } = await sb
    .from('spot_riders')
    .select('*', { count: 'exact', head: true })
    .eq('spot_id', spotId);

  let hasRidden = false;
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseServer().auth.getUser(token);
    if (user) {
      const { data } = await sb
        .from('spot_riders')
        .select('id')
        .eq('spot_id', spotId)
        .eq('user_id', user.id)
        .maybeSingle();
      hasRidden = !!data;
    }
  }

  return NextResponse.json({ ok: true, count: count ?? 0, hasRidden });
}

/* POST /api/riders  — toggle "ho girato qui" */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 });

  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabaseServer().auth.getUser(token);
  if (!user) return NextResponse.json({ ok: false, error: 'Sessione scaduta' }, { status: 401 });

  const { spot_id } = await req.json().catch(() => ({}));
  if (!spot_id) return NextResponse.json({ ok: false, error: 'spot_id required' }, { status: 400 });

  const sb = supabaseAdmin();

  const { data: existing } = await sb
    .from('spot_riders')
    .select('id')
    .eq('spot_id', spot_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await sb.from('spot_riders').delete().eq('id', existing.id);
  } else {
    await sb.from('spot_riders').insert({ spot_id, user_id: user.id });
  }

  const { count } = await sb
    .from('spot_riders')
    .select('*', { count: 'exact', head: true })
    .eq('spot_id', spot_id);

  return NextResponse.json({ ok: true, hasRidden: !existing, count: count ?? 0 });
}
