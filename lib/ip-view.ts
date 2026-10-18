import { mapViewSchema, type MapView } from './explore-state';

/* Vista di partenza dalla posizione approssimata dell'IP (header di Vercel).
   Serve solo a non aprire sull'Italia intera chi non ha ancora dato la
   posizione: l'IP può sbagliare di decine di km (stesso Mac: Sacile per un
   servizio, Padova per un altro), quindi zoom da provincia, mai distanze.
   Solo Italia: altrove gli spot sono pochi e l'auto-fit sugli spot è meglio
   di una mappa vuota. */
export const IP_VIEW_ZOOM = 9;

export function ipViewFromHeaders(get: (name: string) => string | null): MapView | null {
  if (get('x-vercel-ip-country') !== 'IT') return null;
  const lat = Number.parseFloat(get('x-vercel-ip-latitude') ?? '');
  const lon = Number.parseFloat(get('x-vercel-ip-longitude') ?? '');
  const parsed = mapViewSchema.safeParse({ lat, lon, zoom: IP_VIEW_ZOOM });
  return parsed.success ? parsed.data : null;
}
