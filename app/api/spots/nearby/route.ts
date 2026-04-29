import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/spots/nearby?lat=X&lon=X&radius=150
 * Returns approved spots within radius (meters) of given coordinates.
 * Used during spot creation for duplicate detection.
 */
export async function GET(req: NextRequest) {
  const latStr = req.nextUrl.searchParams.get('lat');
  const lonStr = req.nextUrl.searchParams.get('lon');
  const radiusStr = req.nextUrl.searchParams.get('radius') ?? '150';

  if (!latStr || !lonStr) {
    return NextResponse.json({ ok: false, error: 'lat e lon richiesti' }, { status: 400 });
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);
  const radiusM = Math.min(500, Math.max(50, parseInt(radiusStr, 10) || 150));

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ ok: false, error: 'Coordinate non valide' }, { status: 400 });
  }

  // Convert radius to approximate degree delta for bounding box pre-filter
  // 1 degree latitude ≈ 111km, 1 degree longitude ≈ 111km * cos(lat)
  const latDelta = radiusM / 111000;
  const lonDelta = radiusM / (111000 * Math.cos(lat * Math.PI / 180));

  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from('spots')
    .select('id, slug, name, type, city, condition, lat, lon, spot_photos(url, position)')
    .eq('status', 'approved')
    .gte('lat', lat - latDelta)
    .lte('lat', lat + latDelta)
    .gte('lon', lon - lonDelta)
    .lte('lon', lon + lonDelta);

  if (error) {
    return NextResponse.json({ ok: false, error: 'Errore query' }, { status: 500 });
  }

  // Calculate actual distance and filter by radius (Haversine)
  const R = 6371000; // Earth radius in meters
  const toRad = (x: number) => x * Math.PI / 180;

  const nearby = (data ?? [])
    .map(spot => {
      const dLat = toRad(spot.lat - lat);
      const dLon = toRad(spot.lon - lon);
      const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(lat)) * Math.cos(toRad(spot.lat)) * Math.sin(dLon / 2) ** 2;
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { ...spot, distance: Math.round(distance) };
    })
    .filter(s => s.distance <= radiusM)
    .sort((a, b) => a.distance - b.distance);

  return NextResponse.json({
    ok: true,
    data: nearby,
    count: nearby.length,
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}
