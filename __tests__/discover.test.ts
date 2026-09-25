import { describe, expect, it } from 'vitest';
import { countryKey, discoverCountries, discoverCover, discoverSearchParams, EMPTY_DISCOVER_FILTERS, filterDiscoverSpots, parseDiscoverFilters, type DiscoverSpot } from '../app/scopri/discover';

const spots: DiscoverSpot[] = [
  { id: 'b', slug: 'roma', name: 'Piazza Roma', type: 'plaza', lat: 41.9, lon: 12.5, city: 'Roma', country: 'Italia', country_code: 'IT', region: 'Lazio', condition: 'alive', approved_at: '2026-09-20T12:00:00Z', submitted_by_username: 'alex', ostacoli: ['rail'], difficulty: 'intermediate' },
  { id: 'a', slug: 'paris', name: 'École ledge', type: 'ledge', lat: 48.85, lon: 2.35, city: 'Paris', country: 'France', country_code: 'fr', condition: 'bustato', approved_at: '2026-09-23T12:00:00Z', submitted_by_username: 'CHRIS', difficulty: 'pro' },
  { id: 'c', slug: 'older', name: 'Older park', type: 'park', lat: 41.9, lon: 12.5, city: 'Roma', condition: 'alive', approved_at: '2026-09-18T12:00:00Z' },
];
const filter = (values: Partial<typeof EMPTY_DISCOVER_FILTERS>) => filterDiscoverSpots(spots, { ...EMPTY_DISCOVER_FILTERS, ...values });

describe('Discover search and ordering', () => {
  it('keeps newest first reproducible across renders without mutating the source', () => {
    expect(filter({}).map(spot => spot.id)).toEqual(['a', 'b', 'c']);
    expect(filter({}).map(spot => spot.id)).toEqual(['a', 'b', 'c']);
    expect(spots.map(spot => spot.id)).toEqual(['b', 'a', 'c']);
  });
  it('supports accent-insensitive place search and @username contributions', () => {
    expect(filter({ query: 'ecole' }).map(spot => spot.id)).toEqual(['a']);
    expect(filter({ query: '@chris' }).map(spot => spot.id)).toEqual(['a']);
    expect(filter({ query: 'roma' }).map(spot => spot.id)).toEqual(['b', 'c']);
  });
  it('combines explicit conditions, difficulty, country and obstacle including legacy categories', () => {
    expect(filter({ country: 'code:FR', obstacle: 'ledge', difficulty: 'pro', condition: 'bustato' }).map(spot => spot.id)).toEqual(['a']);
    expect(filter({ type: 'plaza', obstacle: 'rail', condition: 'alive' }).map(spot => spot.id)).toEqual(['b']);
    expect(filter({ type: 'park', difficulty: 'pro' })).toEqual([]);
  });
  it('orders alphabetically with deterministic tie breaking', () => {
    const sameName = [{ ...spots[0], id: 'z', name: 'AAA' }, { ...spots[0], id: 'x', name: 'AAA' }];
    expect(filterDiscoverSpots(sameName, { ...EMPTY_DISCOVER_FILTERS, sort: 'name' }).map(spot => spot.id)).toEqual(['x', 'z']);
  });
  it('does not invent a country for old records and keeps their Italian region filter working', () => {
    expect(countryKey(spots[2])).toBe('');
    expect(discoverCountries(spots, 'en')).toEqual([{ value: 'code:FR', label: 'France' }, { value: 'code:IT', label: 'Italy' }]);
    expect(filter({ region: 'Lazio' }).map(spot => spot.id)).toEqual(['b', 'c']);
  });
  it('does not include known foreign records in a region solely because bounds overlap', () => {
    expect(filterDiscoverSpots([{ ...spots[1], lat: 41.9, lon: 12.5 }], { ...EMPTY_DISCOVER_FILTERS, region: 'Lazio' })).toEqual([]);
  });
});

describe('Discover links and public covers', () => {
  it('round-trips shareable filters and removes unused parameters', () => {
    const value = { ...EMPTY_DISCOVER_FILTERS, query: '@chris', country: 'code:FR', obstacle: 'ledge' as const, sort: 'name' as const };
    expect(parseDiscoverFilters(new URLSearchParams(discoverSearchParams(value)))).toEqual(value);
    expect(discoverSearchParams(EMPTY_DISCOVER_FILTERS)).toBe('');
  });
  it('rejects unknown and prototype keys supplied through the URL', () => {
    expect(parseDiscoverFilters(new URLSearchParams('type=constructor&obstacle=__proto__&difficulty=elite&condition=perfect&region=Atlantis&sort=random'))).toEqual(EMPTY_DISCOVER_FILTERS);
  });
  it('never uses pending, rejected, or unselected moderation records as the cover', () => {
    expect(discoverCover([
      { url: '/pending.jpg', position: 0, moderation_status: 'pending' },
      { url: '/rejected.jpg', position: 1, moderation_status: 'rejected' },
      { url: '/unknown.jpg', position: 2 },
      { url: '/approved.jpg', position: 4, moderation_status: 'approved', source: 'rider' },
      { url: '/legacy.jpg', position: 3, moderation_status: null, source: 'streetview' },
    ])).toEqual({ url: '/legacy.jpg', position: 3, moderation_status: null, source: 'streetview' });
  });
  it('returns no image when all available photos are private or missing', () => {
    expect(discoverCover([{ url: '/pending.jpg', position: 0, moderation_status: 'pending' }])).toBeUndefined();
    expect(discoverCover(null)).toBeUndefined();
  });
});
