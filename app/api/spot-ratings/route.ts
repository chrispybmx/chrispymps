import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function supabaseUser(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

/** GET /api/spot-ratings?spot_id=X — avg rating + user's rating */
export async function GET(req: NextRequest) {
  const spotId = req.nextUrl.searchParams.get('spot_id');
  if (!spotId || !UUID_RE.test(spotId))
    return NextResponse.json({ ok: false, error: 'spot_id required' }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: spot } = await sb.from('spots').select('avg_rating, ratings_count').eq('id', spotId).single();

  let myRating = 0;
  const auth = req.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    const { data: { user } } = await sb.auth.getUser(auth.slice(7));
    if (user) {
      const { data: r } = await sb.from('spot_ratings').select('rating').eq('spot_id', spotId).eq('user_id', user.id).maybeSingle();
      myRating = r?.rating ?? 0;
    }
  }

  return NextResponse.json({
    ok: true,
    avg: spot?.avg_rating ?? 0,
    count: spot?.ratings_count ?? 0,
    myRating,
  });
}

/** POST /api/spot-ratings { spot_id, rating } — set rating 1-5 or 0 to remove */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  const token = auth?.replace('Bearer ', '').trim() ?? '';
  if (!token) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 });

  let body: { spot_id?: string; rating?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 }); }

  const { spot_id, rating } = body;
  if (!spot_id || !UUID_RE.test(spot_id)) return NextResponse.json({ ok: false, error: 'spot_id non valido' }, { status: 400 });
  if (rating === undefined || rating < 0 || rating > 5) return NextResponse.json({ ok: false, error: 'rating 0-5' }, { status: 400 });

  const sb = supabaseUser(token);

  if (rating === 0) {
    // Remove rating
    await sb.from('spot_ratings').delete().eq('spot_id', spot_id);
  } else {
    // Upsert rating
    await sb.from('spot_ratings').upsert({ spot_id, rating }, { onConflict: 'spot_id,user_id' });
  }

  // Get updated avg
  const admin = supabaseAdmin();
  const { data: spot } = await admin.from('spots').select('avg_rating, ratings_count').eq('id', spot_id).single();

  return NextResponse.json({
    ok: true,
    avg: spot?.avg_rating ?? 0,
    count: spot?.ratings_count ?? 0,
    myRating: rating,
  });
}
