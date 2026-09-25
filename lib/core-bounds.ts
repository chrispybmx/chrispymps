/**
 * Riquadro che contiene il grosso degli spot, senza gli estremi.
 *
 * Inquadrare tutti gli spot faceva partire la mappa sull'Europa: bastano
 * pochi spot in Spagna o in Germania per allargare la vista finché l'Italia,
 * dove sta quasi tutta la community, diventa una striscia di cluster.
 * Qui si scarta una quota per lato su ciascun asse, così la prima vista
 * cade dove ci sono davvero gli spot. Nessuna zona scritta nel codice:
 * se la community cresce altrove, il riquadro la segue.
 */
export function coreBounds(
  points: { lat: number; lon: number }[],
  trim = 0.1,
): [[number, number], [number, number]] | null {
  if (points.length === 0) return null;
  const lats = points.map(p => p.lat).sort((a, b) => a - b);
  const lons = points.map(p => p.lon).sort((a, b) => a - b);
  // Con pochi spot ogni punto conta: nessun taglio.
  const cut = points.length < 10 ? 0 : Math.floor(points.length * trim);
  const last = points.length - 1 - cut;
  return [[lats[cut], lons[cut]], [lats[last], lons[last]]];
}
