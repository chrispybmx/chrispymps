import type { SpotMapPin } from './types';

export function computeGridClusters(spots: SpotMapPin[], zoom: number) {
  /* Dimensione cella in gradi geografici — ottimizzata per distribuzione mondiale */
  const cellDeg =
    zoom < 4  ? 5    :   // vista mondo: ~550 km per cella
    zoom < 5  ? 2.5  :   // ~280 km
    zoom < 6  ? 1.2  :   // ~130 km — continente (Europa intera)
    zoom < 7  ? 0.6  :   // ~65 km  — paese (Italia = ~18 cluster)
    zoom < 8  ? 0.3  :   // ~33 km  — regione
    zoom < 9  ? 0.15 :   // ~17 km  — area metropolitana
    zoom < 10 ? 0.07 :   // ~8 km   — città grande
    zoom < 11 ? 0.03 :   // ~3 km   — quartiere
                0.01;    // ~1 km   — pin quasi individuali

  const cellMap = new Map<string, SpotMapPin[]>();
  for (const s of spots) {
    const key = `${Math.floor(s.lat / cellDeg)}_${Math.floor(s.lon / cellDeg)}`;
    if (!cellMap.has(key)) cellMap.set(key, []);
    cellMap.get(key)!.push(s);
  }

  const groups = Array.from(cellMap.values()).map((pins) => {
    /* Usa la città del primo spot come label (se disponibile) */
    const city = pins.find(p => p.city)?.city ?? null;
    return {
      key:   `${pins[0].lat.toFixed(4)}_${pins[0].lon.toFixed(4)}`,
      city,
      lat:   pins.reduce((s, p) => s + p.lat, 0) / pins.length,
      lon:   pins.reduce((s, p) => s + p.lon, 0) / pins.length,
      count: pins.length,
      spots: pins,
    };
  });
  const project = (lat: number, lon: number) => {
    const scale = 256 * Math.pow(2, zoom);
    const sin = Math.sin(Math.max(-85, Math.min(85, lat)) * Math.PI / 180);
    return { x: (lon + 180) / 360 * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
  };
  // A cell border must not leave two unreadable, overlapping cluster buttons.
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i], b = groups[j];
        const pa = project(a.lat, a.lon), pb = project(b.lat, b.lon);
        if (Math.hypot(pa.x - pb.x, pa.y - pb.y) >= 48) continue;
        const count = a.count + b.count;
        a.lat = (a.lat * a.count + b.lat * b.count) / count;
        a.lon = (a.lon * a.count + b.lon * b.count) / count;
        a.spots = [...a.spots, ...b.spots];
        a.count = count;
        a.city = a.city === b.city ? a.city : null;
        groups.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }
  return groups;

}
