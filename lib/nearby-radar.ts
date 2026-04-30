// Spot Radar — pure distance logic, no side effects

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function distanceKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export interface RadarResult {
  count: number;
  nearestKm: number | null;
  nearestName: string | null;
}

export function findNearby(
  user: { lat: number; lon: number },
  spots: { lat: number; lon: number; name: string }[],
  radiusKm = 5,
): RadarResult {
  let nearestKm = Infinity;
  let nearestName: string | null = null;
  let count = 0;

  for (const s of spots) {
    const d = distanceKm(user, s);
    if (d <= radiusKm) {
      count++;
      if (d < nearestKm) {
        nearestKm = d;
        nearestName = s.name;
      }
    }
  }

  return {
    count,
    nearestKm: count > 0 ? nearestKm : null,
    nearestName,
  };
}
