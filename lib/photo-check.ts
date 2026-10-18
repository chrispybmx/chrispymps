/* Verifica posizione foto, solo per la coda admin.
   Confronta il GPS della foto (se il telefono non l'ha tolto) con il pin dello
   spot. Non salva mai le coordinate della foto: solo distanza, data e se c'e'
   una fotocamera nei metadati. Un aiuto a moderare, mai un blocco all'invio. */

export interface PhotoMeta { lat?: number; lon?: number; takenAt?: string; camera?: string }

export interface PhotoCheck {
  has_gps:    boolean;
  distance_m: number | null;
  taken_at:   string | null;
  has_camera: boolean;
}

/** Entro questa distanza la foto conta come "scattata qui". */
export const PHOTO_NEAR_M = 300;

function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6_371_000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function checkPhoto(meta: PhotoMeta, pin: { lat: number; lon: number }): PhotoCheck {
  const hasGps = Number.isFinite(meta.lat) && Number.isFinite(meta.lon)
    && Math.abs(meta.lat!) <= 90 && Math.abs(meta.lon!) <= 180;
  const t = meta.takenAt ? new Date(meta.takenAt) : null;
  return {
    has_gps:    hasGps,
    distance_m: hasGps ? distanceM({ lat: meta.lat!, lon: meta.lon! }, pin) : null,
    taken_at:   t && !Number.isNaN(t.getTime()) ? t.toISOString() : null,
    has_camera: Boolean(meta.camera?.trim()),
  };
}

export function photoCheckLabel(c: PhotoCheck): { icon: string; text: string; tone: 'ok' | 'warn' | 'neutral' } {
  if (c.distance_m != null) {
    if (c.distance_m <= PHOTO_NEAR_M) return { icon: '📍', text: `Scattata qui (${c.distance_m} m)`, tone: 'ok' };
    const km = c.distance_m >= 1000 ? `${Math.round(c.distance_m / 1000)} km` : `${c.distance_m} m`;
    return { icon: '⚠️', text: `Scattata a ${km} dal pin`, tone: 'warn' };
  }
  if (!c.has_camera && !c.taken_at) return { icon: '🌐', text: 'Nessun dato fotocamera (screenshot o da internet?)', tone: 'warn' };
  return { icon: '📷', text: 'Posizione tolta dal telefono', tone: 'neutral' };
}
