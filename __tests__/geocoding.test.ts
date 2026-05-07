import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { geocodeForward, reverseGeocode } from '@/lib/geocoding';

/* ── Mock globale di fetch ── */
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
  mockFetch.mockReset();
});

describe('geocodeForward', () => {
  it('mappa risposta Nominatim in GeoPlace[]', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => [
        {
          name:         'Verona',
          lat:          '45.4384',
          lon:          '10.9916',
          type:         'city',
          display_name: 'Verona, Veneto, Italia',
        },
      ],
    });

    const results = await geocodeForward('Verona');

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Verona');
    expect(results[0].lat).toBeCloseTo(45.4384, 3);
    expect(results[0].lon).toBeCloseTo(10.9916, 3);
    expect(results[0].type).toBe('city');
    expect(results[0].displayExtra).toBe('Veneto, Italia');
  });

  it('passa limit e featureType nella URL', async () => {
    mockFetch.mockResolvedValueOnce({ json: async () => [] });

    await geocodeForward('Milano', { limit: 8, featureType: 'city,town' });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('limit=8');
    expect(calledUrl).toContain('featuretype=city%2Ctown');
  });

  it('URL default: limit=5, countrycodes=it', async () => {
    mockFetch.mockResolvedValueOnce({ json: async () => [] });

    await geocodeForward('Roma');

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('limit=5');
    expect(calledUrl).toContain('countrycodes=it');
  });

  it('restituisce [] se Nominatim risponde con array vuoto', async () => {
    mockFetch.mockResolvedValueOnce({ json: async () => [] });

    const results = await geocodeForward('xyznonexistent');
    expect(results).toEqual([]);
  });

  it('usa display_name come fallback se name è vuoto', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => [
        {
          name:         '',
          lat:          '41.9028',
          lon:          '12.4964',
          type:         'city',
          display_name: 'Roma, Lazio, Italia',
        },
      ],
    });

    const results = await geocodeForward('Roma');
    expect(results[0].name).toBe('Roma');
  });
});

describe('reverseGeocode', () => {
  it('ritorna nome città da address.city', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        address: { city: 'Verona', country: 'Italia' },
      }),
    });

    const city = await reverseGeocode(45.4384, 10.9916);
    expect(city).toBe('Verona');
  });

  it('fallback su town se city manca', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        address: { town: 'Bardolino' },
      }),
    });

    const city = await reverseGeocode(45.55, 10.88);
    expect(city).toBe('Bardolino');
  });

  it('fallback su village se city e town mancano', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        address: { village: 'Costermano' },
      }),
    });

    const city = await reverseGeocode(45.6, 10.7);
    expect(city).toBe('Costermano');
  });

  it('ritorna null se address è vuoto', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ address: {} }),
    });

    const city = await reverseGeocode(0, 0);
    expect(city).toBeNull();
  });

  it('include lat/lon nella URL', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ address: { city: 'Milano' } }),
    });

    await reverseGeocode(45.4654, 9.1859);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('lat=45.4654');
    expect(calledUrl).toContain('lon=9.1859');
  });
});
