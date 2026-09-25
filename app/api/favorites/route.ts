import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { UUID_RE } from '@/lib/validation';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Authorization', 'X-Robots-Tag': 'noindex, nofollow' };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const failure = (status = 500, code = 'UNAVAILABLE') => json({ ok: false, code, error: status === 401 ? 'Accedi di nuovo per continuare.' : status === 400 ? 'Richiesta non valida.' : status === 404 ? 'Spot non disponibile.' : 'Non è stato possibile aggiornare i preferiti. Riprova.' }, status);
const tokenFrom = (req: NextRequest) => req.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
type Admin = ReturnType<typeof supabaseAdmin>;
type Photo = { id: string; url: string; position: number; credit_name?: string | null; source?: string | null; moderation_status?: string | null };

async function publicSpots(admin: Admin, ids: string[]) {
  const collected: Record<string, unknown>[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    const { data, error } = await admin.from('spots')
      .select('id,slug,name,type,city,condition,description,submitted_by_username,lat,lon,spot_photos(id,url,position,credit_name,source,moderation_status)')
      .in('id', ids.slice(index, index + 100)).eq('status', 'approved');
    if (error) throw error;
    for (const spot of data ?? []) {
      collected.push({ ...spot, spot_photos: ((spot.spot_photos ?? []) as Photo[])
        .filter(photo => photo.moderation_status === 'approved' || photo.moderation_status == null)
        .sort((a, b) => a.position - b.position)
        .map(({ moderation_status: _status, ...photo }) => photo) });
    }
  }
  const order = new Map(ids.map((id, index) => [id, index]));
  return collected.sort((a, b) => (order.get(a.id as string) ?? 0) - (order.get(b.id as string) ?? 0));
}

/** Own favorites require verified auth; the existing public profile view remains available. */
export async function GET(req: NextRequest) {
  try {
    const viewUserId = req.nextUrl.searchParams.get('user_id');
    if (viewUserId !== null && !UUID_RE.test(viewUserId)) return failure(400, 'INVALID_INPUT');
    const admin = supabaseAdmin();
    let userId = viewUserId;
    if (!viewUserId && req.headers.has('authorization')) {
      const token = tokenFrom(req);
      if (!token) return failure(401, 'UNAUTHORIZED');
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user) return failure(401, 'UNAUTHORIZED');
      userId = data.user.id;
    }
    if (userId) {
      const ids: string[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await admin.from('spot_favorites').select('spot_id')
          .eq('user_id', userId).order('created_at', { ascending: false }).order('spot_id', { ascending: true }).range(offset, offset + 499);
        if (error) return failure();
        ids.push(...(data ?? []).map(row => row.spot_id));
        if (!data || data.length < 500) break;
      }
      if (!viewUserId && req.nextUrl.searchParams.get('ids_only') === '1') return json({ ok: true, ids });
      const spots = await publicSpots(admin, ids);
      // A public profile must not reveal identifiers of unapproved/unavailable spots.
      return json({ ok: true, data: spots, ids: viewUserId ? spots.map(spot => spot.id) : ids });
    }
    const raw = req.nextUrl.searchParams.get('ids') ?? '';
    const ids = [...new Set(raw.split(',').map(value => value.trim()).filter(value => UUID_RE.test(value)))].slice(0, 50);
    const spots = await publicSpots(admin, ids);
    return json({ ok: true, data: spots, ids: spots.map(spot => spot.id) });
  } catch { return failure(); }
}

/** Desired state is idempotent. The old {spot_id} toggle remains compatible. */
export async function POST(req: NextRequest) {
  try {
    const token = tokenFrom(req);
    if (!token) return failure(401, 'UNAUTHORIZED');
    const admin = supabaseAdmin();
    const { data, error: authError } = await admin.auth.getUser(token);
    if (authError || !data.user) return failure(401, 'UNAUTHORIZED');
    const raw = await req.text();
    if (raw.length > 1024) return failure(400, 'INVALID_INPUT');
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return failure(400, 'INVALID_INPUT'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return failure(400, 'INVALID_INPUT');
    const input = body as Record<string, unknown>;
    if (typeof input.spot_id !== 'string' || !UUID_RE.test(input.spot_id)
      || ('saved' in input && typeof input.saved !== 'boolean')
      || Object.keys(input).some(key => key !== 'spot_id' && key !== 'saved')) return failure(400, 'INVALID_INPUT');
    const spotId = input.spot_id;
    const userId = data.user.id;
    let desired = input.saved;
    if (desired === undefined) {
      const { data: existing, error } = await admin.from('spot_favorites').select('id').eq('spot_id', spotId).eq('user_id', userId).maybeSingle();
      if (error) return failure();
      desired = !existing;
    }
    if (!desired) {
      const { error } = await admin.from('spot_favorites').delete().eq('user_id', userId).eq('spot_id', spotId);
      if (error) return failure();
      return json({ ok: true, isFaved: false });
    }
    const { data: spot, error: spotError } = await admin.from('spots').select('id').eq('id', spotId).eq('status', 'approved').maybeSingle();
    if (spotError) return failure();
    if (!spot) return failure(404, 'SPOT_UNAVAILABLE');
    // The live unique constraint is not named in this repository; tolerate its
    // duplicate-row code rather than depending on a guessed constraint name.
    const { error } = await admin.from('spot_favorites').insert({ spot_id: spotId, user_id: userId });
    if (error && error.code !== '23505') return failure();
    return json({ ok: true, isFaved: true });
  } catch { return failure(); }
}
