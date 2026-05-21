import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { UUID_RE } from '@/lib/validation';

/* GET /api/favorites — user's favorites */
export async function GET(req: NextRequest) {
  const auth  = req.headers.get('Authorization');
  const token = auth?.replace('Bearer ', '').trim() ?? '';

  const sb = supabaseAdmin();

  // Public view: fetch favorites for any user by user_id
  const viewUserId = req.nextUrl.searchParams.get('user_id');
  if (viewUserId && UUID_RE.test(viewUserId)) {
    const { data: favRows } = await sb
      .from('spot_favorites')
      .select('spot_id')
      .eq('user_id', viewUserId)
      .order('created_at', { ascending: false });

    if (!favRows || favRows.length === 0) return NextResponse.json({ ok: true, data: [], ids: [] });

    const ids = favRows.map((r: { spot_id: string }) => r.spot_id);
    const { data: spots } = await sb
      .from('spots')
      .select('id, slug, name, type, city, condition, spot_photos(url, position)')
      .in('id', ids)
      .eq('status', 'approved');

    return NextResponse.json({ ok: true, data: spots ?? [], ids });
  }

  if (token) {
    // Verify user — own favorites
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return NextResponse.json({ ok: true, data: [], ids: [] });

    const { data: favRows } = await sb
      .from('spot_favorites')
      .select('spot_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!favRows || favRows.length === 0) return NextResponse.json({ ok: true, data: [], ids: [] });

    const ids = favRows.map((r: { spot_id: string }) => r.spot_id);
    const { data: spots } = await sb
      .from('spots')
      .select('id, slug, name, type, city, condition, spot_photos(url, position)')
      .in('id', ids)
      .eq('status', 'approved');

    return NextResponse.json({ ok: true, data: spots ?? [], ids });
  }

  /* Anonymous fallback: spot info by IDs */
  const raw = req.nextUrl.searchParams.get('ids') ?? '';
  const ids = raw.split(',').map(s => s.trim()).filter(s => UUID_RE.test(s)).slice(0, 50);
  if (ids.length === 0) return NextResponse.json({ ok: true, data: [] });

  const { data } = await sb
    .from('spots')
    .select('id, slug, name, type, city, condition, spot_photos(url, position)')
    .in('id', ids)
    .eq('status', 'approved');

  return NextResponse.json({ ok: true, data: data ?? [] });
}

/* POST /api/favorites { spot_id } — toggle */
export async function POST(req: NextRequest) {
  const auth  = req.headers.get('Authorization');
  const token = auth?.replace('Bearer ', '').trim() ?? '';
  if (!token) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 });

  let body: { spot_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 }); }
  const { spot_id } = body;
  if (!spot_id || !UUID_RE.test(spot_id)) return NextResponse.json({ ok: false, error: 'spot_id non valido' }, { status: 400 });

  const sb = supabaseAdmin();

  // Verify user
  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ ok: false, error: 'Token non valido' }, { status: 401 });

  // Check if exists
  const { data: existing } = await sb
    .from('spot_favorites')
    .select('id')
    .eq('spot_id', spot_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await sb.from('spot_favorites').delete().eq('id', existing.id);
    return NextResponse.json({ ok: true, isFaved: false });
  } else {
    const { error } = await sb.from('spot_favorites').insert({ spot_id, user_id: user.id });
    if (error) return NextResponse.json({ ok: false, error: 'Errore inserimento' }, { status: 500 });
    return NextResponse.json({ ok: true, isFaved: true });
  }
}
