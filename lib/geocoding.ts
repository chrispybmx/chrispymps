/**
 * Wrapper condiviso per Nominatim (OpenStreetMap geocoding).
 * Usato da TopBar (forward), AddSpotModal (reverse), MapClient (city search).
 * World-wide: nessun filtro paese; la ricerca usa la lingua del browser,
 * il reverse usa i nomi locali dei luoghi (consistenza slug città nel DB).
 */

async function geoFetch(params: URLSearchParams, signal?: AbortSignal) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, 12000);
  try {
    const response = await fetch(`/api/geocoding?${params}`, { signal: controller.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Ricerca non disponibile.');
    return data;
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', cancel); }
}

/** Lingua dell'utente per i risultati di ricerca (client-side); 'en' su server. */
function userLanguage(): string {
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  return 'en';
}

export interface GeoPlace {
  name:         string;
  lat:          number;
  lon:          number;
  type:         string;
  displayExtra: string;
}

export interface ReverseGeo {
  city:        string | null;
  country:     string | null;
  countryCode: string | null; // ISO 3166-1 alpha-2 maiuscolo (IT, FR, US, ...)
}

/** Forward geocoding: testo → luoghi (mondo intero) */
export async function geocodeForward(
  query: string,
  options: { limit?: number; featureType?: string; signal?: AbortSignal } = {},
): Promise<GeoPlace[]> {
  const { limit = 5, featureType } = options;
  const params = new URLSearchParams({
    q:               query,
    format:          'json',
    limit:           String(limit),
    language: userLanguage(),
    mode: 'search',
  });
  if (featureType) params.set('featureType', featureType);

  const data = await geoFetch(params, options.signal) as Array<{ name: string; lat: string; lon: string; type: string; display_name: string }>;

  return data.map(r => {
    // Contesto: primo livello amministrativo + paese (ultima parte del display_name)
    const parts   = r.display_name.split(',').map(p => p.trim());
    const country = parts.length > 1 ? parts[parts.length - 1] : '';
    const extra   = [parts[1], country]
      .filter((p, i, arr) => p && arr.indexOf(p) === i && p !== parts[0])
      .join(', ');
    return {
      name:         r.name || parts[0],
      lat:          parseFloat(r.lat),
      lon:          parseFloat(r.lon),
      type:         r.type,
      displayExtra: extra,
    };
  });
}

/** Reverse geocoding: coordinate → città + paese.
 *  Nessun accept-language: Nominatim risponde col nome locale del luogo,
 *  così la stessa città produce sempre lo stesso valore nel DB
 *  (es. "Roma" e non "Rome"/"Rom" a seconda dell'utente). */
export async function reverseGeocode(lat: number, lon: number, signal?: AbortSignal): Promise<ReverseGeo> {
  const params = new URLSearchParams({
    lat:            String(lat),
    lon:            String(lon),
    format:         'json',
    addressdetails: '1', mode: 'reverse',
  });
  const data = await geoFetch(params, signal);
  const city =
    data.address?.city ??
    data.address?.town ??
    data.address?.village ??
    data.address?.municipality ??
    null;
  return {
    city:        city ?? null,
    country:     data.address?.country ?? null,
    countryCode: data.address?.country_code ? String(data.address.country_code).toUpperCase() : null,
  };
}
