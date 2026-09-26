import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mock = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), responses: [] as any[], queries: [] as any[] }));
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: () => ({ auth: { getUser: mock.getUser }, from: mock.from }) }));
import { GET, POST } from '@/app/api/swipe/route';
const ok = (data: unknown = null) => ({ data, error: null });
const fail = { data: null, error: { code: 'XX000', message: 'write unavailable' } };
const spot = { id: 'spot', slug: 'spot', name: 'Spot', type: 'street', lat: 45, lon: 11, spot_photos: [{ url: 'approved.jpg', position: 1, moderation_status: 'approved' }] };
const get = (query = '') => GET(new NextRequest('http://localhost/api/swipe' + query, { headers: { Authorization: 'Bearer test' } }));
const post = (direction = 'like') => POST(new NextRequest('http://localhost/api/swipe', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify({ spotId: 'spot', direction }) }));
beforeEach(() => {
  vi.clearAllMocks(); mock.responses = []; mock.queries = [];
  mock.getUser.mockResolvedValue({ data: { user: { id: 'rider' } }, error: null });
  mock.from.mockImplementation((table: string) => {
    const value = mock.responses.shift() ?? ok();
    const q: any = { table, then: (resolve: any) => Promise.resolve(value).then(resolve) };
    for (const method of ['select', 'eq', 'insert', 'upsert']) q[method] = vi.fn(() => q);
    mock.queries.push(q); return q;
  });
});
describe('swipe deck', () => {
  it.each(['', '?lat=&lon=', '?lat=45', '?lat=91&lon=11', '?lat=45&lon=181', '?lat=x&lon=11'])('does not invent distance for missing or invalid coordinates: %s', async query => {
    mock.responses = [ok([]), ok([spot])];
    expect((await (await get(query)).json()).data[0].km).toBeNull();
  });
  it('uses valid coordinates, including zero', async () => {
    mock.responses = [ok([]), ok([{ ...spot, lat: 0, lon: 0 }])];
    expect((await (await get('?lat=0&lon=0')).json()).data[0].km).toBe(0);
  });
  it('never exposes pending or rejected photos, including photo-only cards', async () => {
    const pending = { url: 'pending.jpg', position: 0, moderation_status: 'pending' };
    mock.responses = [ok([]), ok([{ ...spot, spot_photos: [pending, ...spot.spot_photos, { ...pending, url: 'rejected.jpg', moderation_status: 'rejected' }] }, { ...spot, id: 'hidden', spot_photos: [pending] }])];
    const data = (await (await get()).json()).data;
    expect(data).toHaveLength(1); expect(data[0].foto).toEqual(['approved.jpg']);
    expect(mock.queries[1].eq).toHaveBeenCalledWith('status', 'approved');
  });
  it('reports a failed history read instead of showing an incorrect deck', async () => {
    mock.responses = [fail]; expect((await get()).status).toBe(503); expect(mock.queries).toHaveLength(1);
  });
});
describe('swipe persistence', () => {
  it.each([[fail, ok()], [ok(), fail]])('does not mark the card seen or claim success after a partial failure', async (like, favorite) => {
    mock.responses = [like, favorite];
    const result = await post(); expect(result.status).toBe(503); expect(await result.json()).toMatchObject({ ok: false });
    expect(mock.queries.map(q => q.table)).toEqual(['spot_likes', 'spot_favorites']);
  });
  it('allows an idempotent retry after a partial save', async () => {
    mock.responses = [{ data: null, error: { code: '23505' } }, ok(), ok()];
    expect((await post()).status).toBe(200);
    expect(mock.queries.map(q => q.table)).toEqual(['spot_likes', 'spot_favorites', 'spot_swipes']);
  });
  it('reports a failed final history write', async () => {
    mock.responses = [ok(), ok(), fail]; expect((await post()).status).toBe(500);
  });
  it('passes without creating likes or favorites', async () => {
    mock.responses = [ok()]; expect((await post('pass')).status).toBe(200);
    expect(mock.queries.map(q => q.table)).toEqual(['spot_swipes']);
  });
  it('rejects unauthenticated writes', async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await post()).status).toBe(401); expect(mock.from).not.toHaveBeenCalled();
  });
});
