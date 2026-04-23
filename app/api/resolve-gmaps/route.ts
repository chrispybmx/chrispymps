import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/resolve-gmaps?url=https://maps.app.goo.gl/...
 * Risolve un link corto di Google Maps e restituisce lat/lon.
 * Necessario perché dal browser non possiamo seguire i redirect cross-origin.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') ?? '';

  // Accetta solo URL Google Maps
  const isGoogleMaps =
    url.startsWith('https://maps.app.goo.gl/') ||
    url.startsWith('https://goo.gl/maps/') ||
    url.startsWith('https://maps.google.com/') ||
    url.startsWith('https://www.google.com/maps/');

  if (!isGoogleMaps) {
    return NextResponse.json({ ok: false, error: 'URL non valido' }, { status: 400 });
  }

  try {
    // Segui i redirect — Google Maps short link → URL lungo con coordinate
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChrispyMPS/1.0)' },
    });

    const finalUrl = res.url;

    // Estrai coordinate dall'URL finale
    const coords = extractCoordsFromUrl(finalUrl);
    if (!coords) {
      return NextResponse.json({ ok: false, error: 'Coordinate non trovate nel link' }, { status: 422 });
    }

    return NextResponse.json({ ok: true, lat: coords.lat, lon: coords.lon });
  } catch (err) {
    console.error('[resolve-gmaps]', err);
    return NextResponse.json({ ok: false, error: 'Impossibile risolvere il link' }, { status: 500 });
  }
}

function extractCoordsFromUrl(url: string): { lat: number; lon: number } | null {
  // Pattern @lat,lon,zoom
  const m1 = url.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (m1) return { lat: parseFloat(m1[1]), lon: parseFloat(m1[2]) };

  // Pattern ?q=lat,lon
  const m2 = url.match(/[?&]q=(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (m2) return { lat: parseFloat(m2[1]), lon: parseFloat(m2[2]) };

  // Pattern ?ll=lat,lon
  const m3 = url.match(/[?&]ll=(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (m3) return { lat: parseFloat(m3[1]), lon: parseFloat(m3[2]) };

  // Pattern /place/@lat,lon
  const m4 = url.match(/\/place\/[^/]*\/@(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (m4) return { lat: parseFloat(m4[1]), lon: parseFloat(m4[2]) };

  return null;
}
