import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { UUID_RE } from '@/lib/validation';

// Errore generico: il dettaglio Supabase non deve arrivare al client.
const databaseError = () => NextResponse.json({ ok: false, error: 'Errore database' }, { status: 500 });

/** GET /api/spot-ratings?spot_id=X */
export async function GET(req: NextRequest) {
  const spotId = req.nextUrl.searchParams.get('spot_id');
  if (!spotId || !UUID_RE.test(spotId))
    return NextResponse.json({ ok: false, error: 'spot_id required' }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: spot, error } = await sb.from('spots').select('avg_rating, ratings_count').eq('id', spotId).eq('status', 'approved').maybeSingle();
  if (error) return databaseError();
  if (!spot) return NextResponse.json({ ok: false, error: 'Spot non trovato' }, { status: 404 });

  let myRating = 0;
  const auth = req.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    const { data: { user } } = await sb.auth.getUser(auth.slice(7));
    if (user) {
      const { data: r, error: ratingError } = await sb.from('spot_ratings').select('rating').eq('spot_id', spotId).eq('user_id', user.id).maybeSingle();
      if (ratingError) return databaseError();
      myRating = r?.rating ?? 0;
    }
  }

  return NextResponse.json({ ok: true, avg: spot?.avg_rating ?? 0, count: spot?.ratings_count ?? 0, myRating });
}

/** POST /api/spot-ratings { spot_id, rating } — 1-5 or 0 to remove */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  const token = auth?.replace('Bearer ', '').trim() ?? '';
  if (!token) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 });

  let body: { spot_id?: string; rating?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 }); }

  const { spot_id, rating } = body;
  if (!spot_id || !UUID_RE.test(spot_id)) return NextResponse.json({ ok: false, error: 'spot_id non valido' }, { status: 400 });
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 0 || rating > 5) return NextResponse.json({ ok: false, error: 'rating 0-5' }, { status: 400 });

  const sb = supabaseAdmin();

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ ok: false, error: 'Token non valido' }, { status: 401 });

  const { data: target, error: spotErr } = await sb.from('spots').select('id').eq('id', spot_id).eq('status', 'approved').maybeSingle();
  if (spotErr) return databaseError();
  if (!target) return NextResponse.json({ ok: false, error: 'Spot non trovato' }, { status: 404 });

  let writeErr;
  if (rating === 0) {
    ({ error: writeErr } = await sb.from('spot_ratings').delete().eq('spot_id', spot_id).eq('user_id', user.id));
  } else {
    // Check if exists
    const { data: existing, error: readErr } = await sb.from('spot_ratings').select('id').eq('spot_id', spot_id).eq('user_id', user.id).maybeSingle();
    if (readErr) writeErr = readErr;
    else if (existing) {
      ({ error: writeErr } = await sb.from('spot_ratings').update({ rating }).eq('id', existing.id));
    } else {
      ({ error: writeErr } = await sb.from('spot_ratings').insert({ spot_id, user_id: user.id, rating }));
    }
  }
  if (writeErr) return databaseError();

  const { data: spot, error: finalErr } = await sb.from('spots').select('avg_rating, ratings_count').eq('id', spot_id).single();
  if (finalErr) return databaseError();

  return NextResponse.json({ ok: true, avg: spot?.avg_rating ?? 0, count: spot?.ratings_count ?? 0, myRating: rating });
}
