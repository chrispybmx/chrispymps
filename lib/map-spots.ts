import type { SpotMapPin } from './types';

export async function loadMapSpots(signal: AbortSignal): Promise<SpotMapPin[]> {
  const response = await fetch('/api/spots/index', { signal });
  if (!response.ok) throw new Error('Could not load spots');
  const body = await response.json();
  if (!body.ok || !Array.isArray(body.data)) throw new Error('Invalid spots response');
  return body.data;
}

export async function loadMapSpotPhotos(ids: string[], signal: AbortSignal, full = false): Promise<SpotMapPin[]> {
  if (!ids.length) return [];
  const params = new URLSearchParams({ids: [...new Set(ids)].sort().join(',')});
  if (!full) params.set('view','cover');
  const response = await fetch('/api/spots?' + params, {signal});
  if (!response.ok) throw new Error('Could not load spot photos');
  const body = await response.json();
  if (!body.ok || !Array.isArray(body.data)) throw new Error('Invalid spot photos response');
  return body.data;
}
