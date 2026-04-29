import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/spot-likes?spot_id=X — count + hasLiked */
export async function GET(req: NextRequest) {
  const spotId = req.nextUrl.searchParams.get('spot_id');
  if (!spotId || !UUID_RE.test(spotId))
    return NextResponse.json({ ok: false, error: 'spot_id required' }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: spot } = await sb.from('spots').select('likes_count').eq('id', spotId).single();

  let hasLiked = false;
  const auth = req.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    const { data: { user } } = await sb.auth.getUser(auth.slice(7));
    if (user) {
      const { data: like } = await sb.from('spot_likes').select('id').eq('spot_id', spotId).eq('user_id', user.id).maybeSingle();
      hasLiked = !!like;
    }
  }

  return NextResponse.json({ ok: true, count: spot?.likes_count ?? 0, hasLiked });
}

/** POST /api/spot-likes { spot_id } — toggle like */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  const token = auth?.replace('Bearer ', '').trim() ?? '';
  if (!token) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 });

  let body: { spot_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 }); }

  const { spot_id } = body;
  if (!spot_id || !UUID_RE.test(spot_id))
    return NextResponse.json({ ok: false, error: 'spot_id non valido' }, { status: 400 });

  const sb = supabaseAdmin();

  // Verify user
  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user)
    return NextResponse.json({ ok: false, error: 'Token non valido' }, { status: 401 });

  // Check if already liked
  const { data: existing } = await sb
    .from('spot_likes')
    .select('id')
    .eq('spot_id', spot_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await sb.from('spot_likes').delete().eq('id', existing.id);
  } else {
    await sb.from('spot_likes').insert({ spot_id, user_id: user.id });
  }

  // Get updated count
  const { data: spot } = await sb.from('spots').select('likes_count').eq('id', spot_id).single();

  return NextResponse.json({ ok: true, hasLiked: !existing, count: spot?.likes_count ?? 0 });
}
