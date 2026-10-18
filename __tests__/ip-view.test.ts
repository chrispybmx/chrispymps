import { describe, it, expect } from 'vitest';
import { ipViewFromHeaders, IP_VIEW_ZOOM } from '@/lib/ip-view';

const headers = (h: Record<string, string>) => (k: string) => h[k] ?? null;

describe('ipViewFromHeaders', () => {
  it('apre sulla zona del visitatore italiano', () => {
    expect(ipViewFromHeaders(headers({
      'x-vercel-ip-country': 'IT',
      'x-vercel-ip-latitude': '45.9551',
      'x-vercel-ip-longitude': '12.5021',
    }))).toEqual({ lat: 45.9551, lon: 12.5021, zoom: IP_VIEW_ZOOM });
  });

  it('fuori Italia lascia decidere agli spot', () => {
    expect(ipViewFromHeaders(headers({
      'x-vercel-ip-country': 'DE',
      'x-vercel-ip-latitude': '52.52',
      'x-vercel-ip-longitude': '13.40',
    }))).toBeNull();
  });

  it('senza header (sviluppo locale) non fa niente', () => {
    expect(ipViewFromHeaders(headers({}))).toBeNull();
  });

  it('scarta coordinate rotte', () => {
    expect(ipViewFromHeaders(headers({
      'x-vercel-ip-country': 'IT',
      'x-vercel-ip-latitude': 'abc',
      'x-vercel-ip-longitude': '12.5',
    }))).toBeNull();
    expect(ipViewFromHeaders(headers({
      'x-vercel-ip-country': 'IT',
      'x-vercel-ip-latitude': '120',
      'x-vercel-ip-longitude': '12.5',
    }))).toBeNull();
  });
});
