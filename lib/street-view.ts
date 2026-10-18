/* Link a Street View di Google Maps: si apre nell'app o nel browser, senza
   chiave API. Se in quel punto non c'e' una panoramica Google mostra la
   piu' vicina. */
export function streetViewUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lon.toFixed(6)}`;
}
