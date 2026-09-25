import type { SpotMapPin } from './types';

export async function loadMapSpots(signal: AbortSignal): Promise<SpotMapPin[]> {
  const response = await fetch('/api/spots', { signal });
  if (!response.ok) throw new Error('Could not load spots');
  const body = await response.json();
  if (!body.ok || !Array.isArray(body.data)) throw new Error('Invalid spots response');
  return body.data;
}
