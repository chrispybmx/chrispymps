import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { UUID_RE } from '@/lib/validation';

/** Both shapes preserve the existing single-spot client contract. */
export async function GET(req: NextRequest) {
  const batch = req.nextUrl.searchParams.get('spot_ids');
  const ids = [...new Set((batch ?? req.nextUrl.searchParams.get('spot_id') ?? '').split(','))];
  const headers = {'Cache-Control': 'private, no-store'};
  if (!ids.length || ids.length > 24 || ids.some(id => !UUID_RE.test(id)))
    return NextResponse.json({ok:false,error:'Invalid spot IDs'},{status:400,headers});
  const sb = supabaseAdmin();
  const {data: spots,error} = await sb.from('spots').select('id,likes_count').in('id',ids).eq('status','approved');
  if (error) return NextResponse.json({ok:false,error:'Could not load likes'},{status:503,headers});
  const liked = new Set<string>();
  const auth = req.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    const {data:{user},error:authError} = await sb.auth.getUser(auth.slice(7));
    if (authError || !user) return NextResponse.json({ok:false,error:'Session expired'},{status:401,headers});
    const {data:likes,error:likeError} = await sb.from('spot_likes').select('spot_id').in('spot_id',ids).eq('user_id',user.id);
    if (likeError) return NextResponse.json({ok:false,error:'Could not load likes'},{status:503,headers});
    for (const like of likes ?? []) liked.add(like.spot_id);
  }
  const data = (spots ?? []).map(spot => ({spot_id:spot.id,count:spot.likes_count ?? 0,hasLiked:liked.has(spot.id)}));
  if (batch !== null) return NextResponse.json({ok:true,data},{headers});
  if (!data[0]) return NextResponse.json({ok:false,error:'Spot unavailable'},{status:404,headers});
  return NextResponse.json({ok:true,count:data[0].count,hasLiked:data[0].hasLiked},{headers});
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

  const {data: approved, error: spotError} = await sb.from('spots').select('id').eq('id',spot_id).eq('status','approved').maybeSingle();
  if (spotError) return NextResponse.json({ok:false,error:'Could not load spot'},{status:503});
  if (!approved) return NextResponse.json({ok:false,error:'Spot unavailable'},{status:404});

  // Check if already liked
  const { data: existing, error: existingError } = await sb
    .from('spot_likes')
    .select('id')
    .eq('spot_id', spot_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingError) return NextResponse.json({ok:false,error:'Could not load like'},{status:503});
  if (existing) {
    const {error} = await sb.from('spot_likes').delete().eq('id', existing.id);
    if (error) return NextResponse.json({ok:false,error:'Could not save like'},{status:503});
  } else {
    const {error} = await sb.from('spot_likes').insert({ spot_id, user_id: user.id });
    if (error) return NextResponse.json({ok:false,error:'Could not save like'},{status:503});
  }

  // Get updated count
  const { data: spot, error: countError } = await sb.from('spots').select('likes_count').eq('id', spot_id).single();

  if (countError) return NextResponse.json({ok:false,error:'Could not load updated count'},{status:503});
  return NextResponse.json({ ok: true, hasLiked: !existing, count: spot?.likes_count ?? 0 });
}
