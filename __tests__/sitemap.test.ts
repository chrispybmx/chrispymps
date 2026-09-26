import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ from: vi.fn(), queries: [] as any[], responses: [] as any[] }));
vi.mock('@/lib/supabase', () => ({ supabaseServer: () => ({ from: mock.from }) }));
import sitemap from '@/app/sitemap';
beforeEach(() => {
  mock.queries = []; mock.responses = []; vi.clearAllMocks();
  mock.from.mockImplementation((table: string) => {
    const result = mock.responses.shift();
    const q: any = { table, then: (resolve: any) => Promise.resolve(result).then(resolve) };
    for (const method of ['select', 'eq', 'order', 'range']) q[method] = vi.fn(() => q);
    mock.queries.push(q); return q;
  });
});
const ok = (data: unknown[]) => ({ data, error: null });
describe('sitemap completeness and accuracy', () => {
  it('includes spots beyond the database 1000 row limit', async () => {
    mock.responses = [ok(Array.from({ length: 1000 }, (_, i) => ({ slug: `spot-${i}`, city: 'Egna', updated_at: '2026-01-01' }))), ok([{ slug: 'spot-1000', city: 'Châtel', updated_at: '2026-02-03' }]), ok([])];
    const result = await sitemap();
    expect(result.filter(item => item.url.includes('/map/spot/'))).toHaveLength(1001);
    expect(mock.queries[1].range).toHaveBeenCalledWith(1000, 1999);
    expect(result).toContainEqual({ url: 'https://maps.chrispybmx.com/map/chatel', lastModified: '2026-02-03T00:00:00.000Z' });
    expect(mock.queries[0].eq).toHaveBeenCalledWith('status', 'approved');
    expect(mock.queries[2].eq).toHaveBeenCalledWith('status', 'published');
  });
  it('does not fabricate update dates, empty cities or personal pages', async () => {
    mock.responses = [ok([{ slug: 'rail', city: 'Egna', updated_at: 'invalid' }]), ok([{ slug: 'story', published_at: '2026-03-04' }])];
    const result = await sitemap();
    expect(result.find(item => item.url.endsWith('/map/spot/rail'))).not.toHaveProperty('lastModified');
    expect(result.find(item => item.url === 'https://maps.chrispybmx.com')).not.toHaveProperty('lastModified');
    expect(result.some(item => /\/(sessioni|messaggi|preferiti|admin|auth|map\/milano)(\/|$)/.test(item.url))).toBe(false);
    expect(result.find(item => item.url.endsWith('/news/story'))?.lastModified).toBe('2026-03-04T00:00:00.000Z');
  });
  it('fails explicitly instead of publishing a sitemap missing database content', async () => {
    mock.responses = [{ data: null, error: { message: 'unavailable' } }];
    await expect(sitemap()).rejects.toThrow('spot query failed');
  });
  it('deduplicates city variants and uses their latest real date', async () => {
    mock.responses = [ok([{ slug: 'one', city: 'Châtel', updated_at: '2026-03-01' }, { slug: 'two', city: 'Chatel', updated_at: '2026-01-01' }]), ok([])];
    const cities = (await sitemap()).filter(item => item.url.endsWith('/map/chatel'));
    expect(cities).toEqual([{ url: 'https://maps.chrispybmx.com/map/chatel', lastModified: '2026-03-01T00:00:00.000Z' }]);
  });
});
