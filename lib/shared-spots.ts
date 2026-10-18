import { UUID_RE } from './validation';
export const SHARED_SPOTS_MAX = 24;
export function sharedSpotIds(value: string | null): string[] {
  if (!value || value.length > 900) return [];
  const ids = [...new Set(value.split(','))];
  return ids.length <= SHARED_SPOTS_MAX && ids.every(id => UUID_RE.test(id)) ? ids : [];
}
export function sharedSpotsPath(ids: string[]): string {
  const valid = sharedSpotIds([...new Set(ids)].join(','));
  if (!valid.length) throw new Error('Seleziona da 1 a 24 spot.');
  return `/da-girare?spots=${valid.join(',')}`;
}
