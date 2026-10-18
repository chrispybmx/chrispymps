import { NextRequest, NextResponse } from 'next/server';
import { requestGeocoding } from '@/lib/geocoding-server';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams;
  const mode = input.get('mode');
  const params = new URLSearchParams({ format: 'json' });
  if (mode === 'search') {
    const query = input.get('q')?.trim();
    if (!query || query.length < 2 || query.length > 200) return NextResponse.json({ error: 'Ricerca non valida.' }, { status: 400 });
    params.set('q', query); params.set('limit', String(Math.min(5, Math.max(1, Number(input.get('limit')) || 5))));
    const language = input.get('language') ?? 'it';
    if (/^[a-zA-Z-]{2,20}$/.test(language)) params.set('accept-language', language);
    if (input.get('featureType') === 'city') params.set('featuretype', 'city');
  } else if (mode === 'reverse') {
    const lat = Number(input.get('lat')), lon = Number(input.get('lon'));
    if (!input.has('lat') || !input.has('lon') || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return NextResponse.json({ error: 'Coordinate non valide.' }, { status: 400 });
    params.set('lat', lat.toFixed(5)); params.set('lon', lon.toFixed(5)); params.set('addressdetails', '1');
  } else return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 });
  try {
    const local = process.env.CHRISPY_LOCAL_PREVIEW === 'true' && ['localhost', '127.0.0.1', '[::1]'].includes(request.nextUrl.hostname);
    const data = await requestGeocoding(mode, params, local);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } });
  } catch (error) {
    const busy = error instanceof Error && error.message === 'busy';
    return NextResponse.json({ error: busy ? 'Ricerca occupata. Riprova tra un momento.' : 'Ricerca geografica non disponibile. Gli spot del catalogo restano consultabili.' }, { status: busy ? 429 : 503, headers: { 'Cache-Control': 'no-store', ...(busy ? { 'Retry-After': '2' } : {}) } });
  }
}
