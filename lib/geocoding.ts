/**
 * Wrapper condiviso per Nominatim (OpenStreetMap geocoding).
 * Usato da TopBar (forward), AddSpotModal (reverse), MapClient (city search).
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const HEADERS = { 'User-Agent': 'ChrispyMaps/1.0' };

export interface GeoPlace {
  name:         string;
  lat:          number;
  lon:          number;
  type:         string;
  displayExtra: string;
}

/** Forward geocoding: testo → luoghi */
export async function geocodeForward(
  query: string,
  options: { limit?: number; featureType?: string } = {},
): Promise<GeoPlace[]> {
  const { limit = 5, featureType } = options;
  const params = new URLSearchParams({
    q:               query,
    format:          'json',
    limit:           String(limit),
    countrycodes:    'it',
    'accept-language': 'it',
  });
  if (featureType) params.set('featuretype', featureType);

  const res  = await fetch(`${NOMINATIM_BASE}/search?${params}`, { headers: HEADERS });
  const data = await res.json() as Array<{ name: string; lat: string; lon: string; type: string; display_name: string }>;

  return data.map(r => ({
    name:         r.name || r.display_name.split(',')[0],
    lat:          parseFloat(r.lat),
    lon:          parseFloat(r.lon),
    type:         r.type,
    displayExtra: r.display_name.split(',').slice(1, 3).join(',').trim(),
  }));
}

/** Reverse geocoding: coordinate → nome città */
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const params = new URLSearchParams({
    lat:               String(lat),
    lon:               String(lon),
    format:            'json',
    addressdetails:    '1',
    'accept-language': 'it',
  });
  const res  = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, { headers: HEADERS });
  const data = await res.json();
  const city =
    data.address?.city ??
    data.address?.town ??
    data.address?.village ??
    data.address?.municipality ??
    null;
  return city ?? null;
}
