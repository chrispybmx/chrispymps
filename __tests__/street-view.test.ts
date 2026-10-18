import { describe, expect, it } from 'vitest';
import { streetViewUrl } from '@/lib/street-view';

describe('streetViewUrl', () => {
  it('opens Google Street View at the spot coordinates', () => {
    expect(streetViewUrl(45.4384, 10.9916)).toBe('https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=45.438400,10.991600');
  });
  it('keeps the sign of southern and western coordinates', () => {
    expect(streetViewUrl(-33.8688, -151.2093)).toContain('viewpoint=-33.868800,-151.209300');
  });
});
