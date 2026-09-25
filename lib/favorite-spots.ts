import type { SpotCondition, SpotType } from '@/lib/types';

export interface FavoriteSpot {
  id: string; slug: string; name: string; type: SpotType; city?: string | null;
  condition: SpotCondition; description?: string | null; submitted_by_username?: string | null;
  lat: number; lon: number;
  spot_photos: { id: string; url: string; position: number; credit_name?: string | null; source?: 'rider' | 'streetview' }[];
}

/** Public spot details only. Chunking preserves lists longer than the API's 50-id limit. */
export async function loadFavoriteSpots(ids: string[], signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<FavoriteSpot[]> {
  const result: FavoriteSpot[] = [];
  const unique = [...new Set(ids)];
  for (let index = 0; index < unique.length; index += 50) {
    const query = new URLSearchParams({ ids: unique.slice(index, index + 50).join(',') });
    const response = await fetcher(`/api/favorites?${query}`, { signal, cache: 'no-store' });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok || !Array.isArray(payload.data)) throw new Error('favorites-load');
    result.push(...payload.data);
  }
  const byId = new Map(result.map(spot => [spot.id, spot]));
  return unique.flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
}
