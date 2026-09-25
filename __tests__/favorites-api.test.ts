import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mock = vi.hoisted(() => ({ getUser: vi.fn(), favoriteRows: vi.fn(), spots: vi.fn(), existing: vi.fn(), spot: vi.fn(), remove: vi.fn(), insert: vi.fn(), from: vi.fn(), filters: [] as [string, unknown][] }));
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: () => ({ auth: { getUser: mock.getUser }, from: mock.from }) }));
import { GET, POST } from '@/app/api/favorites/route';

const USER = '11111111-1111-4111-8111-111111111111';
const SPOT = '22222222-2222-4222-8222-222222222222';
const HIDDEN = '33333333-3333-4333-8333-333333333333';
const request = (method = 'GET', body?: unknown, query = '', token: string | null = 'Bearer verified-token') => new NextRequest(`http://localhost/api/favorites${query}`, {
  method, headers: { 'Content-Type': 'application/json', ...(token === null ? {} : { Authorization: token }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
beforeEach(() => {
  vi.clearAllMocks(); mock.filters.length = 0;
  mock.getUser.mockResolvedValue({ data: { user: { id: USER } }, error: null });
  mock.favoriteRows.mockResolvedValue({ data: [{ spot_id: SPOT }], error: null });
  mock.spots.mockResolvedValue({ data: [{ id: SPOT, name: 'Test park', spot_photos: [] }], error: null });
  mock.existing.mockResolvedValue({ data: null, error: null });
  mock.spot.mockResolvedValue({ data: { id: SPOT }, error: null });
  mock.remove.mockResolvedValue({ error: null }); mock.insert.mockResolvedValue({ error: null });
  mock.from.mockImplementation((table: string) => {
    let action = 'select';
    const chain = {
      select: () => chain,
      eq: (field: string, value: unknown) => { mock.filters.push([field, value]); return chain; },
      in: (field: string, value: unknown) => { mock.filters.push([field, value]); return chain; },
      order: () => chain,
      range: mock.favoriteRows,
      maybeSingle: () => table === 'spots' ? mock.spot() : mock.existing(),
      delete: () => { action = 'delete'; return chain; },
      insert: mock.insert,
      then: (resolve: (value: unknown) => unknown) => (action === 'delete' ? mock.remove() : mock.spots()).then(resolve),
    };
    return chain;
  });
});

describe('favorites API auth, desired state and legacy compatibility', () => {
  it.each([null, 'Basic token', 'Bearer ', 'Bearer a b'])('rejects invalid authorization %s before mutations', async token => {
    expect((await POST(request('POST', { spot_id: SPOT, saved: true }, '', token))).status).toBe(401);
    expect(mock.insert).not.toHaveBeenCalled(); expect(mock.remove).not.toHaveBeenCalled();
  });
  it('returns an auth error rather than an empty successful list for an expired session', async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'expired' } });
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
    expect(mock.from).not.toHaveBeenCalled();
  });
  it('binds desired-state saves to the verified user and tolerates an already saved row', async () => {
    mock.insert.mockResolvedValue({ error: { code: '23505' } });
    const response = await POST(request('POST', { spot_id: SPOT, saved: true }));
    expect(await response.json()).toEqual({ ok: true, isFaved: true });
    expect(mock.insert).toHaveBeenCalledWith({ spot_id: SPOT, user_id: USER });
    expect(mock.filters).toContainEqual(['status', 'approved']);
    expect(mock.existing).not.toHaveBeenCalled();
  });
  it('keeps removals idempotent and usable for an unavailable spot', async () => {
    const response = await POST(request('POST', { spot_id: HIDDEN, saved: false }));
    expect(await response.json()).toEqual({ ok: true, isFaved: false });
    expect(mock.filters).toContainEqual(['user_id', USER]);
    expect(mock.filters).toContainEqual(['spot_id', HIDDEN]);
    expect(mock.spot).not.toHaveBeenCalled();
  });
  it('does not report a failed deletion as successful', async () => {
    mock.remove.mockResolvedValue({ error: { message: 'database down' } });
    const response = await POST(request('POST', { spot_id: SPOT, saved: false }));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('database down');
  });
  it('preserves the legacy toggle contract', async () => {
    mock.existing.mockResolvedValueOnce({ data: { id: 'favorite-id' }, error: null });
    expect(await (await POST(request('POST', { spot_id: SPOT }))).json()).toEqual({ ok: true, isFaved: false });
    expect(await (await POST(request('POST', { spot_id: SPOT }))).json()).toEqual({ ok: true, isFaved: true });
  });
  it.each([{ spot_id: SPOT, saved: 'false' }, { spot_id: SPOT, saved: true, user_id: HIDDEN }, { spot_id: 'bad-id' }])('rejects forged or ambiguous input %j', async body => {
    expect((await POST(request('POST', body))).status).toBe(400);
    expect(mock.insert).not.toHaveBeenCalled(); expect(mock.remove).not.toHaveBeenCalled();
  });
  it('rejects saving a spot that is not approved', async () => {
    mock.spot.mockResolvedValue({ data: null, error: null });
    expect((await POST(request('POST', { spot_id: HIDDEN, saved: true }))).status).toBe(404);
    expect(mock.insert).not.toHaveBeenCalled();
  });
  it('does not turn a failed favorites read into an empty successful list', async () => {
    mock.favoriteRows.mockResolvedValue({ data: null, error: { message: 'private SQL detail' } });
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('private SQL detail');
  });
  it('loads only ids for the shared store, without downloading photographs twice', async () => {
    const response = await GET(request('GET', undefined, '?ids_only=1'));
    expect(await response.json()).toEqual({ ok: true, ids: [SPOT] });
    expect(mock.spots).not.toHaveBeenCalled();
  });
  it('preserves public profile favorites but returns approved spot ids only', async () => {
    mock.favoriteRows.mockResolvedValue({ data: [{ spot_id: SPOT }, { spot_id: HIDDEN }], error: null });
    const response = await GET(request('GET', undefined, `?user_id=${USER}`, null));
    const body = await response.json();
    expect(body.ids).toEqual([SPOT]);
    expect(mock.getUser).not.toHaveBeenCalled();
    expect(mock.filters).toContainEqual(['status', 'approved']);
  });
  it('filters pending/rejected photos, preserves legacy approved photos, source and credits', async () => {
    mock.spots.mockResolvedValue({ data: [{ id: SPOT, spot_photos: [
      { id: 'pending', url: 'pending', position: 0, moderation_status: 'pending' },
      { id: 'rejected', url: 'rejected', position: 1, moderation_status: 'rejected' },
      { id: 'streetview', url: 'map-photo', position: 3, moderation_status: 'approved', source: 'streetview', credit_name: 'Google' },
      { id: 'rider', url: 'rider-photo', position: 2, moderation_status: null, source: 'rider' },
    ] }], error: null });
    const body = await (await GET(request('GET', undefined, `?ids=${SPOT}`, null))).json();
    expect(body.data[0].spot_photos.map((photo: { id: string }) => photo.id)).toEqual(['rider', 'streetview']);
    expect(body.data[0].spot_photos[1]).toMatchObject({ source: 'streetview', credit_name: 'Google' });
    expect(body.data[0].spot_photos[1]).not.toHaveProperty('moderation_status');
  });
  it('applies private no-store headers to successful and failed operations', async () => {
    for (const response of [await GET(request()), await POST(request('POST', {}, '', null))]) {
      expect(response.headers.get('Cache-Control')).toContain('private, no-store');
      expect(response.headers.get('Vary')).toBe('Authorization');
    }
  });
});
