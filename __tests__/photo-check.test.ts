import { describe, it, expect } from 'vitest';
import { checkPhoto, photoCheckLabel } from '@/lib/photo-check';

const pin = { lat: 45.9551, lon: 12.5021 };

describe('checkPhoto', () => {
  it('foto scattata allo spot', () => {
    const c = checkPhoto({ lat: 45.9554, lon: 12.5023, takenAt: '2026-10-01T10:00:00Z', camera: 'Apple iPhone 15' }, pin);
    expect(c.has_gps).toBe(true);
    expect(c.distance_m).toBeGreaterThan(20);
    expect(c.distance_m).toBeLessThan(60);
    expect(c.has_camera).toBe(true);
    expect(photoCheckLabel(c).tone).toBe('ok');
  });

  it('foto scattata lontano', () => {
    const c = checkPhoto({ lat: 45.4064, lon: 11.8768, camera: 'Samsung SM-S911B' }, pin);
    expect(c.distance_m).toBeGreaterThan(70_000);
    expect(photoCheckLabel(c).tone).toBe('warn');
  });

  it('senza GPS ma con fotocamera', () => {
    const c = checkPhoto({ camera: 'Apple iPhone 13' }, pin);
    expect(c).toMatchObject({ has_gps: false, distance_m: null, has_camera: true });
    expect(photoCheckLabel(c).tone).toBe('neutral');
  });

  it('senza nessun dato: screenshot o foto da internet', () => {
    const c = checkPhoto({}, pin);
    expect(c).toMatchObject({ has_gps: false, has_camera: false, taken_at: null });
    expect(photoCheckLabel(c).tone).toBe('warn');
  });

  it('data invalida viene ignorata', () => {
    expect(checkPhoto({ takenAt: 'boh' }, pin).taken_at).toBeNull();
  });
});
