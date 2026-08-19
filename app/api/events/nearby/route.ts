import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { distanceKm } from '@/lib/nearby-radar';

/**
 * Prossimo evento vicino all'utente.
 *
 * `/api/events` restituisce tutto il calendario (118 righe al 19/08/2026, di cui
 * 36 future e quasi tutte campionati esteri): utile per la pagina eventi, inutile
 * come segnale sulla mappa. Qui rispondiamo a una domanda sola — «c'è qualcosa
 * vicino a me nelle prossime settimane?» — che è il contenuto a più alta carica
 * emotiva del database e oggi sta a tre tap dentro il menu.
 */

export const dynamic = 'force-dynamic';

const DEFAULT_RADIUS_KM = 150;
const MAX_RADIUS_KM     = 500;
/** Oltre questo orizzonte un evento non è più "in arrivo". */
const HORIZON_DAYS      = 60;

export interface NearbyEvent {
  id:       string;
  slug:     string | null;
  title:    string;
  city:     string | null;
  event_date: string;
  cover_url:  string | null;
  link_url:   string | null;
  km:         number;
  /** Giorni che mancano; 0 = oggi. */
  daysAway:   number;
}

function num(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = num(searchParams.get('lat'));
  const lon = num(searchParams.get('lon'));

  if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ ok: false, error: 'lat/lon non validi' }, { status: 400 });
  }

  const radiusKm = Math.min(num(searchParams.get('radius')) ?? DEFAULT_RADIUS_KM, MAX_RADIUS_KM);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today.getTime() + HORIZON_DAYS * 86_400_000);

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('events')
    .select('id, slug, title, city, event_date, cover_url, link_url, lat, lng')
    .eq('status', 'published')
    .gte('event_date', today.toISOString())
    .lte('event_date', horizon.toISOString())
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .order('event_date', { ascending: true });

  if (error) {
    console.error('[api/events/nearby]', error.message);
    return NextResponse.json({ ok: false, error: error.message, data: [] }, { status: 500 });
  }

  const rows = (data ?? []) as {
    id: string; slug: string | null; title: string; city: string | null;
    event_date: string; cover_url: string | null; link_url: string | null;
    lat: number; lng: number;
  }[];

  const nearby: NearbyEvent[] = rows
    .map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      city: e.city,
      event_date: e.event_date,
      cover_url: e.cover_url,
      link_url: e.link_url,
      km: distanceKm({ lat, lon }, { lat: e.lat, lon: e.lng }),
      daysAway: Math.max(0, Math.round((Date.parse(e.event_date) - today.getTime()) / 86_400_000)),
    }))
    .filter((e) => e.km <= radiusKm)
    .sort((a, b) => Date.parse(a.event_date) - Date.parse(b.event_date));

  return NextResponse.json({ ok: true, data: nearby }, {
    headers: { 'Cache-Control': 'private, max-age=600' },
  });
}
