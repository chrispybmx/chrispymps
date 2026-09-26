import { describe, expect, it } from 'vitest';
import { spotStructuredData, cityCollectionData, seoDate, PRIVATE_ROBOTS } from '@/lib/seo';
import { safeJsonLd } from '@/lib/json-ld';
import type { Spot } from '@/lib/types';
const spot = { slug: 'rail-egna', name: 'Rail', type: 'rail', lat: 46, lon: 11, city: 'Egna', approved_at: '2026-01-01', updated_at: '2026-02-03', submitted_by_username: 'rider' } as Spot;
describe('public spot structured data', () => {
  it('connects a page, its real location and its public author', () => {
    const [page, place] = spotStructuredData(spot)['@graph'];
    expect(page.mainEntity).toEqual({ '@id': place['@id'] });
    expect(page.author).toMatchObject({ name: '@rider', url: 'https://maps.chrispybmx.com/u/rider' });
    expect(page.dateModified).toBe('2026-02-03T00:00:00.000Z');
    expect(place.geo).toEqual({ '@type': 'GeoCoordinates', latitude: 46, longitude: 11 });
  });
  it('never invents country, image, ratings, opening hours or dates', () => {
    const result = JSON.parse(JSON.stringify(spotStructuredData({ ...spot, updated_at: '', approved_at: undefined })));
    expect(result['@graph'][0]).not.toHaveProperty('dateModified');
    expect(result['@graph'][0]).not.toHaveProperty('datePublished');
    expect(result['@graph'][1].address).not.toHaveProperty('addressCountry');
    for (const key of ['image', 'aggregateRating', 'openingHours']) expect(result['@graph'][1]).not.toHaveProperty(key);
  });
  it('omits impossible coordinates', () => {
    expect(spotStructuredData({ ...spot, lat: 91 })['@graph'][1]).not.toHaveProperty('geo');
  });
  it('escapes user supplied script markup safely', () => {
    expect(safeJsonLd(spotStructuredData({ ...spot, name: '</script><script>alert(1)</script>' }))).not.toContain('<');
  });
  it('uses an ItemList for city results with actual spot destinations', () => {
    const result = cityCollectionData('Egna', 'https://maps.chrispybmx.com/map/egna', [spot]);
    expect(result.mainEntity.numberOfItems).toBe(1);
    expect(result.mainEntity.itemListElement[0]).toMatchObject({ position: 1, name: 'Rail', url: 'https://maps.chrispybmx.com/map/spot/rail-egna' });
    expect(result).not.toHaveProperty('numberOfItems');
  });
  it.each([undefined, null, '', 'not-a-date'])('omits invalid lastmod %s', value => expect(seoDate(value)).toBeUndefined());
  it('applies noindex consistently for Google and other crawlers', () => {
    expect(PRIVATE_ROBOTS).toMatchObject({ index: false, googleBot: { index: false } });
  });
});
