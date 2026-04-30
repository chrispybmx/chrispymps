import { describe, it, expect } from 'vitest';
import { distanceKm, findNearby } from '@/lib/nearby-radar';

describe('distanceKm', () => {
  it('returns 0 for same point', () => {
    expect(distanceKm({ lat: 45, lon: 11 }, { lat: 45, lon: 11 })).toBe(0);
  });

  it('computes Roma → Milano ≈ 477 km', () => {
    const d = distanceKm(
      { lat: 41.9028, lon: 12.4964 },  // Roma
      { lat: 45.4642, lon: 9.1900 },   // Milano
    );
    expect(d).toBeGreaterThan(470);
    expect(d).toBeLessThan(485);
  });

  it('computes short distance ≈ 1.1 km', () => {
    // ~1 km apart (roughly 0.009 degrees lat)
    const d = distanceKm(
      { lat: 46.6700, lon: 11.1600 },
      { lat: 46.6800, lon: 11.1600 },
    );
    expect(d).toBeGreaterThan(1.0);
    expect(d).toBeLessThan(1.2);
  });
});

describe('findNearby', () => {
  const spots = [
    { lat: 46.670, lon: 11.160, name: 'Spot A' },  // ~0 km from user
    { lat: 46.680, lon: 11.160, name: 'Spot B' },  // ~1.1 km
    { lat: 46.710, lon: 11.160, name: 'Spot C' },  // ~4.4 km
    { lat: 46.750, lon: 11.160, name: 'Spot D' },  // ~8.9 km (outside 5km)
    { lat: 41.900, lon: 12.496, name: 'Spot E' },  // Roma — hundreds km away
  ];

  const user = { lat: 46.670, lon: 11.160 };

  it('finds spots within 5 km', () => {
    const result = findNearby(user, spots, 5);
    expect(result.count).toBe(3); // A, B, C
  });

  it('returns nearest distance', () => {
    const result = findNearby(user, spots, 5);
    expect(result.nearestKm).toBeLessThan(0.01); // same point
    expect(result.nearestName).toBe('Spot A');
  });

  it('excludes spots outside radius', () => {
    const result = findNearby(user, spots, 5);
    expect(result.count).toBe(3); // D and E excluded
  });

  it('returns null when no spots nearby', () => {
    const result = findNearby({ lat: 0, lon: 0 }, spots, 5);
    expect(result.count).toBe(0);
    expect(result.nearestKm).toBeNull();
    expect(result.nearestName).toBeNull();
  });

  it('works with empty spots array', () => {
    const result = findNearby(user, [], 5);
    expect(result.count).toBe(0);
    expect(result.nearestKm).toBeNull();
  });

  it('respects custom radius', () => {
    const result = findNearby(user, spots, 2);
    expect(result.count).toBe(2); // A and B only
  });
});
