import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mock = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn(), remove: vi.fn(), insert: vi.fn(), spot: vi.fn(), rows: vi.fn(), existing: vi.fn(), filters: [] as [string, unknown][] }));
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: () => ({ from: mock.from, auth: { getUser: mock.getUser } }) }));
import { POST as session } from '@/app/api/sessions/route';
import { POST as flag } from '@/app/api/flag/route';
import { DELETE as cancel, GET as attendees, POST as rsvp } from '@/app/api/events/jamroma/rsvp/route';
const SPOT = '22222222-2222-4222-8222-222222222222';
const failure = { message: 'private SQL failure', code: '08006' };
const request = (body: unknown = {}, method = 'POST') => new NextRequest('http://localhost/api/test', { method, headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' }, ...(method === 'DELETE' ? {} : { body: JSON.stringify(body) }) });
const sessionRequest = (action: string) => request({ action, access_token: 'token', spot_id: SPOT, lat: 41, lon: 12 });
beforeEach(() => {
  vi.clearAllMocks(); mock.filters.length = 0;
  mock.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  mock.remove.mockResolvedValue({ error: null }); mock.insert.mockResolvedValue({ error: null });
  mock.spot.mockResolvedValue({ data: { id: SPOT, name: 'Park', lat: 41, lon: 12 }, error: null });
  mock.rows.mockResolvedValue({ data: [], error: null }); mock.existing.mockResolvedValue({ data: null, error: null });
  mock.from.mockImplementation((table: string) => {
    let deleting = false;
    const chain = {
      select: () => chain,
      eq: (field: string, value: unknown) => { mock.filters.push([field, value]); return chain; },
      is: () => chain,
      order: () => mock.rows(),
      single: () => table === 'spots' ? mock.spot() : Promise.resolve({ data: { username: 'Rider' }, error: null }),
      maybeSingle: () => table === 'spots' ? mock.spot() : table === 'profiles' ? Promise.resolve({ data: { username: 'Rider' }, error: null }) : mock.existing(),
      delete: () => { deleting = true; return chain; },
      insert: mock.insert, upsert: mock.insert,
      then: (resolve: (value: unknown) => unknown) => (deleting ? mock.remove() : mock.rows()).then(resolve),
    };
    return chain;
  });
});
async function expectFailure(response: Response) {
  expect(response.status).toBe(500);
  expect(await response.json()).toMatchObject({ ok: false });
}
describe('session mutation failures', () => {
  it.each(['leave', 'join'])('does not acknowledge %s when deleting the previous session fails', async action => {
    mock.remove.mockResolvedValue({ error: failure });
    await expectFailure(await session(sessionRequest(action)));
    expect(mock.insert).not.toHaveBeenCalled();
    expect(mock.filters).toContainEqual(['user_id', 'user-1']);
  });
  it.each(['leave', 'join'])('preserves successful %s', async action => {
    const response = await session(sessionRequest(action));
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ ok: true });
    expect(mock.insert).toHaveBeenCalledTimes(action === 'join' ? 1 : 0);
  });
});
describe('flag existence check', () => {
  it('rejects a failed lookup instead of silently accepting an unrecorded flag', async () => {
    mock.spot.mockResolvedValue({ data: null, error: failure });
    await expectFailure(await flag(request({ spot_id: SPOT, reason: 'broken' })));
    expect(mock.insert).not.toHaveBeenCalled();
  });
  it('preserves generic acceptance when the spot genuinely does not exist', async () => {
    mock.spot.mockResolvedValue({ data: null, error: null });
    const response = await flag(request({ spot_id: SPOT, reason: 'broken' }));
    expect(response.status).toBe(201); expect(await response.json()).toEqual({ ok: true }); expect(mock.insert).not.toHaveBeenCalled();
  });
  it('inserts a flag for an existing spot', async () => {
    expect((await flag(request({ spot_id: SPOT, reason: 'broken' }))).status).toBe(201);
    expect(mock.insert).toHaveBeenCalledOnce();
  });
});
describe('RSVP database failures and migration compatibility', () => {
  it('does not confirm cancellation when delete fails', async () => {
    mock.remove.mockResolvedValue({ error: failure });
    await expectFailure(await cancel(request({}, 'DELETE')));
  });
  it('preserves successful cancellation scoped to authenticated user and event', async () => {
    expect(await (await cancel(request({}, 'DELETE'))).json()).toEqual({ ok: true });
    expect(mock.filters).toContainEqual(['user_id', 'user-1']);
    expect(mock.filters.some(([field]) => field === 'event_slug')).toBe(true);
  });
  it.each(['42P01', 'PGRST205'])('keeps empty-list fallback for missing table (%s)', async code => {
    mock.rows.mockResolvedValue({ data: null, error: { code, message: 'missing table' } });
    expect(await (await attendees()).json()).toEqual({ ok: true, count: 0, rsvps: [] });
  });
  it('does not show a database outage as an empty successful attendance list', async () => {
    mock.rows.mockResolvedValue({ data: null, error: failure });
    await expectFailure(await attendees());
  });
  it('does not create another anonymous RSVP when the deduplication lookup fails', async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mock.existing.mockResolvedValue({ data: null, error: failure });
    await expectFailure(await rsvp(request({ display_name: 'Rider' })));
    expect(mock.insert).not.toHaveBeenCalled();
  });
  it('preserves anonymous RSVP creation after a successful empty lookup', async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await (await rsvp(request({ display_name: 'Rider' }))).json()).toEqual({ ok: true });
    expect(mock.insert).toHaveBeenCalledOnce();
  });
});
