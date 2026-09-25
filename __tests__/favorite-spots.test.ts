import { describe, it, expect, vi } from 'vitest';
import { loadFavoriteSpots } from '@/lib/favorite-spots';
const id = (index: number) => `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`;
describe('saved page spot details', () => {
  it('loads every requested spot across the API limit and preserves saved order', async () => {
    const ids = Array.from({ length: 105 }, (_, index) => id(index));
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async input => {
      const query = new URL(String(input), 'https://example.test').searchParams.get('ids')!;
      return new Response(JSON.stringify({ ok: true, data: query.split(',').reverse().map(value => ({ id: value, name: value })) }));
    });
    const result = await loadFavoriteSpots(ids, undefined, fetcher);
    expect(result.map(spot => spot.id)).toEqual(ids);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('does not present a failed request as an empty saved list', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 500 }));
    await expect(loadFavoriteSpots([id(1)], undefined, fetcher)).rejects.toThrow('favorites-load');
  });
  it('forwards cancellation so the page can discard stale account/list requests', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true, data: [] })));
    await loadFavoriteSpots([id(1)], controller.signal, fetcher);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ signal: controller.signal, cache: 'no-store' });
  });
});
