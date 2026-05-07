import { describe, it, expect } from 'vitest';
import {
  TIPI_SPOT,
  CONDIZIONI,
  DIFFICOLTA,
  PALETTE,
  APP_CONFIG,
  DEBOUNCE_SEARCH_MS,
  DEBOUNCE_USERNAME_MS,
  GPS_TIMEOUT_MS,
  APPROVE_TOKEN_EXPIRES_HOURS,
} from '@/lib/constants';

describe('TIPI_SPOT', () => {
  it('contiene tutti i tipi attesi', () => {
    const tipi = Object.keys(TIPI_SPOT);
    expect(tipi).toContain('street');
    expect(tipi).toContain('park');
    expect(tipi).toContain('diy');
    expect(tipi).toContain('bowl');
    expect(tipi).toContain('pumptrack');
    expect(tipi).toHaveLength(10);
  });

  it('ogni tipo ha label, emoji e color', () => {
    for (const [, info] of Object.entries(TIPI_SPOT)) {
      expect(info.label).toBeTruthy();
      expect(info.emoji).toBeTruthy();
      expect(info.color).toMatch(/^#[0-9a-fA-F]{3,6}$/);
    }
  });
});

describe('CONDIZIONI', () => {
  it('ha alive, bustato, demolito', () => {
    expect(Object.keys(CONDIZIONI)).toEqual(['alive', 'bustato', 'demolito']);
  });
});

describe('DIFFICOLTA', () => {
  it('ha beginner, intermediate, pro in ordine', () => {
    expect(DIFFICOLTA.map(d => d.value)).toEqual(['beginner', 'intermediate', 'pro']);
  });
});

describe('PALETTE', () => {
  it('orange è #ff6a00', () => {
    expect(PALETTE.orange).toBe('#ff6a00');
  });
});

describe('APP_CONFIG', () => {
  it('url è il dominio di produzione', () => {
    expect(APP_CONFIG.url).toBe('https://maps.chrispybmx.com');
  });

  it('mapCenter è Italia (circa)', () => {
    const [lat, lon] = APP_CONFIG.mapCenter;
    expect(lat).toBeCloseTo(42.5, 0);
    expect(lon).toBeCloseTo(12.5, 0);
  });
});

describe('Timing constants', () => {
  it('DEBOUNCE_SEARCH_MS è 380', () => {
    expect(DEBOUNCE_SEARCH_MS).toBe(380);
  });

  it('DEBOUNCE_USERNAME_MS è 600', () => {
    expect(DEBOUNCE_USERNAME_MS).toBe(600);
  });

  it('GPS_TIMEOUT_MS è 10000', () => {
    expect(GPS_TIMEOUT_MS).toBe(10_000);
  });

  it('APPROVE_TOKEN_EXPIRES_HOURS è 72', () => {
    expect(APPROVE_TOKEN_EXPIRES_HOURS).toBe(72);
  });
});
