import { describe, expect, it } from 'vitest';
import { computeGridClusters } from '@/lib/cluster-spots';
import type { SpotMapPin } from '@/lib/types';
const pin = (id: string, lat: number, lon: number) => ({ id, lat, lon, city: 'Roma' } as SpotMapPin);
describe('map cluster readability', () => {
  it('merges nearby spots across geographic cell borders without dropping or duplicating spots', () => {
    const spots = [pin('a', 42.59, 12.59), pin('b', 42.61, 12.61), pin('c', 20, 4)];
    const clusters = computeGridClusters(spots, 6);
    expect(clusters).toHaveLength(2);
    expect(clusters.map(c => c.count).sort()).toEqual([1, 2]);
    expect(clusters.flatMap(c => c.spots.map(s => s.id)).sort()).toEqual(['a','b','c']);
  });
  it('separates the same nearby spots as the rider zooms in', () => {
    const spots = [pin('a', 42.59, 12.59), pin('b', 42.61, 12.61)];
    expect(computeGridClusters(spots, 6)).toHaveLength(1);
    expect(computeGridClusters(spots, 11)).toHaveLength(2);
  });
  it('handles an empty map', () => expect(computeGridClusters([], 6)).toEqual([]));
});
