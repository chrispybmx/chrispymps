import { describe, it, expect } from 'vitest';
import { coreBounds } from '@/lib/core-bounds';

const italia = (n: number) => Array.from({ length: n }, (_, i) => ({
  lat: 38 + (i % 9),        // 38..46
  lon: 8 + (i % 8),         // 8..15
}));

describe('coreBounds', () => {
  it('nessuno spot → null', () => {
    expect(coreBounds([])).toBeNull();
  });

  it('pochi spot: li tiene tutti', () => {
    const pts = [{ lat: 45, lon: 9 }, { lat: 40, lon: -3 }, { lat: 48, lon: 11 }];
    expect(coreBounds(pts)).toEqual([[40, -3], [48, 11]]);
  });

  it('gli spot sparsi all\'estero non allargano la vista oltre l\'Italia', () => {
    const pts = [
      ...italia(100),
      ...Array.from({ length: 8 }, () => ({ lat: 39.5, lon: -0.4 })), // Valencia
      { lat: 48.1, lon: 11.6 },                                         // Monaco
    ];
    const b = coreBounds(pts)!;
    expect(b[0][1]).toBeGreaterThanOrEqual(8);   // ovest: niente Spagna
    expect(b[1][0]).toBeLessThanOrEqual(46);     // nord: niente Baviera
    expect(b[0][0]).toBeGreaterThanOrEqual(38);
    expect(b[1][1]).toBeLessThanOrEqual(15);
  });

  it('se la community si sposta, il riquadro la segue', () => {
    const spagna = Array.from({ length: 50 }, (_, i) => ({ lat: 39 + (i % 3), lon: -1 + (i % 2) }));
    const b = coreBounds([...spagna, ...italia(5)])!;
    expect(b[0][1]).toBeLessThan(0);
  });
});
