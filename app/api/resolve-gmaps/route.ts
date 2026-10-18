import { NextRequest, NextResponse } from 'next/server';
import { requestGeocoding } from '@/lib/geocoding-server';
import { resolve4 } from 'dns/promises';
import { isPrivateIp } from '@/lib/ssrf';

/**
 * GET /api/resolve-gmaps?url=https://maps.app.goo.gl/...
 * Risolve un link Google Maps (corto o lungo) e restituisce lat/lon.
 *
 * Strategia:
 * 1. Segui i redirect per ottenere l'URL finale
 * 2. Cerca @lat,lon nell'URL — se trovato, ritorna subito
 * 3. Se l'URL ha q=indirizzo, geocodifica via Nominatim (OSM, gratuito)
 */

// Host consentiti per ogni hop dei redirect (Google Maps)
const ALLOWED_HOSTS = [
  'maps.google.com', 'www.google.com', 'maps.google.it',
  'www.google.it', 'google.com', 'google.it',
  'maps.app.goo.gl', 'goo.gl',
  'consent.google.com',
];

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.includes(hostname) ||
    hostname.endsWith('.google.com') ||
    hostname.endsWith('.google.it') ||
    hostname.endsWith('.goo.gl');
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') ?? '';

  const isGoogleMaps =
    url.startsWith('https://maps.app.goo.gl/') ||
    url.startsWith('https://goo.gl/maps/') ||
    url.startsWith('https://maps.google.com/') ||
    url.startsWith('https://www.google.com/maps') ||
    url.startsWith('https://maps.google.it/');

  if (!isGoogleMaps) {
    return NextResponse.json({ ok: false, error: 'URL non valido' }, { status: 400 });
  }

  try {
    const MAX_REDIRECTS = 5;

    // 1. Segui i redirect manualmente (max 5 hop, con validazione DNS + hostname ad ogni hop)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    let currentUrl = url;
    let res: Response | undefined;

    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const parsed = new URL(currentUrl);

        // Schema: solo HTTPS
        if (parsed.protocol !== 'https:') {
          return NextResponse.json({ ok: false, error: 'URL non valido' }, { status: 400 });
        }

        // Hostname consentito ad ogni hop
        if (!isAllowedHost(parsed.hostname)) {
          return NextResponse.json({ ok: false, error: 'URL non valido' }, { status: 400 });
        }

        // Risolvi DNS e controlla che l'IP non sia privato
        let ips: string[];
        try {
          ips = await resolve4(parsed.hostname);
        } catch {
          return NextResponse.json({ ok: false, error: 'DNS resolution failed' }, { status: 400 });
        }
        for (const ip of ips) {
          if (isPrivateIp(ip)) {
            return NextResponse.json({ ok: false, error: 'URL non valido' }, { status: 400 });
          }
        }

        res = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChrispyMPS/1.0)' },
          signal: controller.signal,
        });

        // Se non è un redirect, abbiamo finito
        if (!res.status.toString().startsWith('3')) break;

        const location = res.headers.get('location');
        if (!location) break;

        // Risolvi URL relativi
        currentUrl = new URL(location, currentUrl).toString();

        if (hop === MAX_REDIRECTS) {
          return NextResponse.json({ ok: false, error: 'Troppi redirect' }, { status: 400 });
        }
      }
    } finally {
      clearTimeout(timeout);
    }

    if (!res) {
      return NextResponse.json({ ok: false, error: 'Impossibile risolvere il link' }, { status: 500 });
    }

    const finalUrl = currentUrl;

    // 2. Prova a estrarre @lat,lon dall'URL finale — se trovato, non serve leggere il body
    const coords = extractCoordsFromUrl(finalUrl);
    if (coords) {
      return NextResponse.json({ ok: true, lat: coords.lat, lon: coords.lon });
    }

    // 3. Estrai il parametro q= e geocodifica via Nominatim
    const place = extractPlaceQuery(finalUrl);
    if (!place) {
      return NextResponse.json({
        ok: false,
        error: 'Coordinate non trovate. Prova ad aprire il link, clicca sul posto e condividi le coordinate direttamente.',
      }, { status: 422 });
    }

    const local = process.env.CHRISPY_LOCAL_PREVIEW === 'true' && ['localhost', '127.0.0.1', '[::1]'].includes(req.nextUrl.hostname);
    const geocoded = await geocodeWithNominatim(place, local);
    if (!geocoded) {
      return NextResponse.json({
        ok: false,
        error: `Posto "${place.slice(0, 50)}" non trovato. Scrivi le coordinate direttamente (es. 45.123, 9.456).`,
      }, { status: 422 });
    }

    return NextResponse.json({ ok: true, lat: geocoded.lat, lon: geocoded.lon, resolvedFrom: 'geocoding' });

  } catch (err) {
    console.error('[resolve-gmaps]', err);
    return NextResponse.json({ ok: false, error: 'Impossibile risolvere il link' }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractCoordsFromUrl(url: string): { lat: number; lon: number } | null {
  // @lat,lon,zoom  (es. @45.123,9.456,17z)
  const m1 = url.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (m1) return { lat: parseFloat(m1[1]), lon: parseFloat(m1[2]) };

  // ?q=lat,lon  (solo numeri)
  const m2 = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m2) return { lat: parseFloat(m2[1]), lon: parseFloat(m2[2]) };

  // ?ll=lat,lon
  const m3 = url.match(/[?&]ll=(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (m3) return { lat: parseFloat(m3[1]), lon: parseFloat(m3[2]) };

  return null;
}

function extractPlaceQuery(url: string): string | null {
  try {
    const u = new URL(url);
    // ?q=Nome+del+posto
    const q = u.searchParams.get('q');
    // searchParams decodifica gia': un secondo decode lanciava URIError su '%'.
    if (q && q.trim().length > 2) return q.replace(/\+/g, ' ');
    // /place/Nome+posto/
    const placeMatch = url.match(/\/place\/([^/@]+)/);
    if (placeMatch) return decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ');
  } catch {}
  return null;
}

/* Passa dal limitatore condiviso di lib/geocoding-server: chiamare Nominatim
   direttamente, fino a 4 volte di fila, sfondava il limite di 1 richiesta al
   secondo che vale per tutto il sito. Su "busy" si aspetta lo slot e si riprova. */
async function geocodeWithNominatim(query: string, local: boolean): Promise<{ lat: number; lon: number } | null> {
  // Prova la query originale, poi versioni semplificate
  const attempts = [
    query,
    // Rimuovi codici provincia tipo "MB", "MI" e codici postali
    query.replace(/\b\d{5}\b/g, '').replace(/\b[A-Z]{2}\b/g, '').trim(),
    // Solo le ultime 2 parole (di solito Via + Città)
    query.split(',').slice(-2).join(',').trim(),
    // Solo l'ultima parola (città)
    query.split(',').pop()?.trim() ?? '',
  ].filter((a, i, all) => a.length >= 3 && all.indexOf(a) === i);

  for (const attempt of attempts) {
    const params = new URLSearchParams({ format: 'json', q: attempt, limit: '1', addressdetails: '0' });
    for (let tentativo = 0; tentativo < 3; tentativo++) {
      try {
        const data = await requestGeocoding('search', params, local) as { lat: string; lon: string }[];
        if (Array.isArray(data) && data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        break;
      } catch (err) {
        if (err instanceof Error && err.message === 'busy') { await new Promise(r => setTimeout(r, 1200)); continue; }
        return null; // servizio non disponibile: inutile insistere con le altre varianti
      }
    }
  }
  return null;
}
