import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { JAM_ROMA } from '@/lib/jamroma';

const SLUG = JAM_ROMA.slug;

/** Arrotonda coordinate a 5 decimali (~1m precisione) */
function round5(n: number): number {
  return Math.round(n * 100000) / 100000;
}

/** GET — rider online (last_seen_at < 2 min) */
export async function GET() {
  const sb = supabaseAdmin();
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from('event_live_presence')
    .select('id, display_name, lat, lon, last_seen_at')
    .eq('event_slug', SLUG)
    .eq('sharing_enabled', true)
    .gte('last_seen_at', fiveMinAgo);

  // Resiliente a tabella non ancora creata
  if (error) return NextResponse.json({ ok: true, count: 0, riders: [] });

  return NextResponse.json({
    ok: true,
    count: data?.length ?? 0,
    riders: data ?? [],
  });
}

/** POST — aggiorna posizione live */
export async function POST(req: NextRequest) {
  const sb = supabaseAdmin();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 });
  }

  const lat = Number(body.lat);
  const lon = Number(body.lon);
  const sharingEnabled = body.sharing_enabled === true;

  if (!sharingEnabled) {
    return NextResponse.json({ ok: false, error: 'Consenso posizione richiesto' }, { status: 400 });
  }
  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ ok: false, error: 'Coordinate non valide' }, { status: 400 });
  }

  let userId: string | null = null;
  let displayName = '';

  // Auth opzionale
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const { data: { user } } = await sb.auth.getUser(auth.slice(7));
    if (user) {
      userId = user.id;
      const { data: profile } = await sb
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      displayName = profile?.username ?? user.email?.split('@')[0] ?? 'Rider';
    }
  }

  if (!userId) {
    displayName = String(body.display_name ?? '').replace(/<[^>]*>/g, '').trim().slice(0, 40);
    if (!displayName || displayName.length < 2) {
      return NextResponse.json({ ok: false, error: 'Inserisci il tuo nome' }, { status: 400 });
    }
  }

  const row = {
    event_slug: SLUG,
    user_id: userId,
    display_name: displayName,
    lat: round5(lat),
    lon: round5(lon),
    last_seen_at: new Date().toISOString(),
    sharing_enabled: true,
  };

  if (userId) {
    // Upsert per utente loggato
    const { error } = await sb
      .from('event_live_presence')
      .upsert(row, { onConflict: 'event_slug,user_id' });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    // Anonimo: inserisci (scade naturalmente dopo 2 min senza aggiornamento)
    const { error } = await sb
      .from('event_live_presence')
      .insert(row);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
