import { describe, it, expect } from 'vitest';
import { safeAuthNext } from '@/lib/auth-navigation';
describe('authentication return destination', () => {
  it('preserves a spot, its query and comment anchor', () => expect(safeAuthNext('/map/spot/roma?q=rail#commenti')).toBe('/map/spot/roma?q=rail#commenti'));
  it('preserves the contribution entry point', () => expect(safeAuthNext('/map?add=1')).toBe('/map?add=1'));
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/auth/callback', '/map\nLocation: evil', undefined])('rejects unsafe destinations %s', value => expect(safeAuthNext(value)).toBe('/map'));
});
