import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/resolve-gmaps?url=https://maps.app.goo.gl/...
 * Risolve un link Google Maps (corto o lungo) e restituisce lat/lon.
 *
 * Strategia:
 * 1. Segui i redirect per ottenere l'URL finale
 * 2. Cerca @lat,lon nell'URL — se trovato, ritorna subito
 * 3. Se l'URL ha q=indirizzo, geocodifica via Nominatim (OSM, gratuito)
 */
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
    // 1. Segui i redirect
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChrispyMPS/1.0)' },
    });
    const finalUrl = res.url;

    // 2. Prova a estrarre @lat,lon dall'URL finale
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

    const geocoded = await geocodeWithNominatim(place);
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
    if (q && q.trim().length > 2) return decodeURIComponent(q).replace(/\+/g, ' ');
    // /place/Nome+posto/
    const placeMatch = url.match(/\/place\/([^/@]+)/);
    if (placeMatch) return decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ');
  } catch {}
  return null;
}

async function geocodeWithNominatim(query: string): Promise<{ lat: number; lon: number } | null> {
  // Prova la query originale, poi versioni semplificate
  const attempts = [
    query,
    // Rimuovi codici provincia tipo "MB", "MI" e codici postali
    query.replace(/\b\d{5}\b/g, '').replace(/\b[A-Z]{2}\b/g, '').trim(),
    // Solo le ultime 2 parole (di solito Via + Città)
    query.split(',').slice(-2).join(',').trim(),
    // Solo l'ultima parola (città)
    query.split(',').pop()?.trim() ?? '',
  ].filter(Boolean);

  for (const attempt of attempts) {
    if (attempt.length < 3) continue;
    try {
      const encoded = encodeURIComponent(attempt);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&addressdetails=0`,
        { headers: { 'User-Agent': 'ChrispyMPS/1.0 (contact: info@chrispybmx.com)' } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      }
    } catch {}
  }
  return null;
}
