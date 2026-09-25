import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadMapSpots } from '@/lib/map-spots';

afterEach(() => vi.unstubAllGlobals());

describe('map data loading', () => {
  it('distinguishes a successful empty response from an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: true, data: [] })));
    await expect(loadMapSpots(new AbortController().signal)).resolves.toEqual([]);
  });

  it.each([
    [500, { ok: false, error: 'database unavailable' }],
    [200, { ok: false }],
    [200, { ok: true, data: null }],
    [200, { ok: true }],
  ])('rejects HTTP %s with invalid results', async (status, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body, { status })));
    await expect(loadMapSpots(new AbortController().signal)).rejects.toThrow();
  });

  it('can retry after a network failure and returns the actual pins', async () => {
    const pins = [{ id: 'spot', name: 'Jungle', lat: 46, lon: 11 }];
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(Response.json({ ok: true, data: pins }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadMapSpots(new AbortController().signal)).rejects.toThrow('offline');
    await expect(loadMapSpots(new AbortController().signal)).resolves.toEqual(pins);
  });

  it('passes cancellation through to the pending network request', async () => {
    vi.stubGlobal('fetch', vi.fn((_url, { signal }: RequestInit) => new Promise((_resolve, reject) => {
      signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));
    const controller = new AbortController();
    const request = loadMapSpots(controller.signal);
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });
});
