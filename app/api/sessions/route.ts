import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { distanceKm } from '@/lib/nearby-radar';

const SESSION_HOURS = 3;
const MAX_DISTANCE_KM = 1; // must be within 1 km of spot

/**
 * GET /api/sessions
 * Returns all active sessions grouped by spot.
 */
export async function GET() {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from('sessions')
    .select('id, username, spot_id, started_at, spots!inner(id, name, slug, city, lat, lon)')
    .gt('expires_at', new Date().toISOString())
    .order('started_at', { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Group by spot
  const bySpot: Record<string, {
    spot: { id: string; name: string; slug: string; city?: string };
    riders: { username: string }[];
  }> = {};

  for (const row of data ?? []) {
    const spot = row.spots as unknown as { id: string; name: string; slug: string; city?: string };
    if (!bySpot[spot.id]) {
      bySpot[spot.id] = { spot, riders: [] };
    }
    bySpot[spot.id].riders.push({ username: row.username });
  }

  // Sort by rider count desc
  const grouped = Object.values(bySpot).sort((a, b) => b.riders.length - a.riders.length);

  return NextResponse.json({ ok: true, data: grouped });
}

/**
 * POST /api/sessions
 * Join or leave a session.
 * Body: { action: 'join' | 'leave', spot_id: string, lat: number, lon: number, access_token: string }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { action, spot_id, access_token } = body;

  if (!access_token) {
    return NextResponse.json({ ok: false, error: 'Non autenticato.' }, { status: 401 });
  }

  const sb = supabaseAdmin();

  const { data: { user }, error: authErr } = await sb.auth.getUser(access_token);
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: 'Non autenticato.' }, { status: 401 });
  }

  const { data: profile } = await sb.from('profiles').select('username').eq('id', user.id).maybeSingle();
  const username = profile?.username ?? 'anonimo';

  if (action === 'leave') {
    await sb.from('sessions').delete().eq('user_id', user.id);
    return NextResponse.json({ ok: true, message: 'Sessione chiusa.' });
  }

  if (action === 'join') {
    if (!spot_id) {
      return NextResponse.json({ ok: false, error: 'Spot non specificato.' }, { status: 400 });
    }

    const lat = typeof body.lat === 'number' ? body.lat : null;
    const lon = typeof body.lon === 'number' ? body.lon : null;

    if (lat === null || lon === null) {
      return NextResponse.json({ ok: false, error: 'Posizione richiesta per verificare che sei allo spot.' }, { status: 400 });
    }

    // Get spot coordinates
    const { data: spot } = await sb.from('spots').select('id, lat, lon, name').eq('id', spot_id).eq('status', 'approved').single();
    if (!spot) {
      return NextResponse.json({ ok: false, error: 'Spot non trovato.' }, { status: 404 });
    }

    // Verify distance
    const dist = distanceKm({ lat, lon }, { lat: spot.lat, lon: spot.lon });
    if (dist > MAX_DISTANCE_KM) {
      return NextResponse.json({
        ok: false,
        error: `Sei troppo lontano dallo spot (${dist.toFixed(1)} km). Devi essere entro ${MAX_DISTANCE_KM} km.`,
      }, { status: 400 });
    }

    // Remove any existing session for this user
    await sb.from('sessions').delete().eq('user_id', user.id);

    // Create new session
    const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
    const { error } = await sb.from('sessions').insert({
      user_id: user.id,
      username,
      spot_id,
      expires_at: expiresAt,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: `In session a "${spot.name}"!` });
  }

  return NextResponse.json({ ok: false, error: 'Azione non valida.' }, { status: 400 });
}
