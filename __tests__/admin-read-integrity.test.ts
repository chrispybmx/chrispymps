import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const m = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), events: vi.fn(), profiles: vi.fn(), users: vi.fn(), log: vi.fn() }));
vi.mock('@/lib/auth', () => ({ isAdminAuthenticated: m.auth }));
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: () => ({ from: m.from, auth: { admin: { listUsers: m.users } } }) }));
import { GET as events } from '@/app/api/admin/events/route';
import { GET as riders } from '@/app/api/admin/export/riders/route';
const request = (tipo = 'completo') => new NextRequest(`http://localhost/api/admin/export/riders?tipo=${tipo}`);
const profile = (id: string) => ({ user_id: id, birth_date: null, region: 'Lazio', disciplines: ['bmx'], riding_since_year: null, setup_brand: null, newsletter_opt_in: false, created_at: '2026-01-01' });
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockReturnValue(true);
  m.events.mockResolvedValue({ data: [], error: null });
  m.profiles.mockResolvedValue({ data: [profile('one')], error: null });
  m.users.mockResolvedValue({ data: { users: [{ id: 'one', email: 'one@example.com' }] }, error: null });
  m.log.mockResolvedValue({ error: null });
  m.from.mockImplementation((table: string) => {
    if (table === 'events') return { select: () => ({ order: m.events }) };
    if (table === 'admin_export_log') return { insert: m.log };
    const q: any = { order: () => q, range: (start: number, end: number) => m.profiles(start, end), then: (resolve: any, reject: any) => m.profiles().then(resolve, reject) };
    return { select: () => q };
  });
});
describe('admin events read integrity', () => {
  it('rejects unauthenticated reads', async () => { m.auth.mockReturnValue(false); expect((await events()).status).toBe(401); expect(m.from).not.toHaveBeenCalled(); });
  it('retains compatible fallback when join is unavailable', async () => { m.events.mockResolvedValueOnce({ error: { message: 'missing FK' } }).mockResolvedValueOnce({ data: [{ id: 'event' }], error: null }); expect(await (await events()).json()).toEqual({ ok: true, data: [{ id: 'event' }] }); });
  it('fails when both join and fallback fail', async () => { m.events.mockResolvedValue({ error: { message: 'private DB failure' } }); const r = await events(); expect(r.status).toBe(500); expect(await r.json()).toMatchObject({ ok: false }); });
  it('fails when database throws', async () => { m.events.mockRejectedValue(new Error('private')); const r = await events(); expect(r.status).toBe(500); expect(await r.text()).not.toContain('private'); });
  it('allows genuinely empty results', async () => { expect(await (await events()).json()).toEqual({ ok: true, data: [] }); });
});
describe('rider export completeness', () => {
  it('rejects unauthenticated export', async () => { m.auth.mockReturnValue(false); expect((await riders(request())).status).toBe(401); expect(m.from).not.toHaveBeenCalled(); });
  it('fails instead of exporting missing emails on auth error', async () => { m.users.mockResolvedValue({ data: { users: [] }, error: { message: 'private' } }); const r = await riders(request()); expect(r.status).toBe(500); expect(r.headers.get('content-type')).toContain('application/json'); expect(m.log).not.toHaveBeenCalled(); });
  it('includes emails from auth pages beyond 1000', async () => { m.profiles.mockResolvedValue({ data: [profile('last')], error: null }); m.users.mockResolvedValueOnce({ data: { users: Array.from({ length: 1000 }, (_, i) => ({ id: String(i), email: `${i}@example.com` })) }, error: null }).mockResolvedValueOnce({ data: { users: [{ id: 'last', email: 'last@example.com' }] }, error: null }); const r = await riders(request()); expect(await r.text()).toContain('last@example.com'); expect(m.users).toHaveBeenNthCalledWith(2, { page: 2, perPage: 1000 }); });
  it('fails atomically on a later auth page', async () => { m.users.mockResolvedValueOnce({ data: { users: Array.from({ length: 1000 }, (_, i) => ({ id: String(i) })) }, error: null }).mockResolvedValueOnce({ data: null, error: { message: 'private' } }); expect((await riders(request())).status).toBe(500); expect(m.log).not.toHaveBeenCalled(); });
  it('aggregates all profile pages beyond 1000 without accessing auth', async () => { m.profiles.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, i) => profile(String(i))), error: null }).mockResolvedValueOnce({ data: [profile('last')], error: null }); const r = await riders(request('aggregato')); expect(await r.text()).toContain(',1001'); expect(m.profiles).toHaveBeenNthCalledWith(2, 1000, 1999); expect(m.users).not.toHaveBeenCalled(); });
  it('fails atomically on a later profile page', async () => { m.profiles.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, i) => profile(String(i))), error: null }).mockResolvedValueOnce({ data: null, error: { message: 'private' } }); expect((await riders(request())).status).toBe(500); expect(m.log).not.toHaveBeenCalled(); });
  it('preserves CSV escaping and private download headers', async () => { m.users.mockResolvedValue({ data: { users: [{ id: 'one', email: '=formula' }] }, error: null }); const r = await riders(request()); expect(r.status).toBe(200); expect(await r.text()).toContain("'=formula"); expect(r.headers.get('cache-control')).toContain('no-store'); });
});
