import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ authenticated: vi.fn(), from: vi.fn(), select: vi.fn(), order: vi.fn(), limit: vi.fn(), or: vi.fn(), result: { data: [] as unknown[], error: null as unknown } }));
vi.mock('@/lib/auth', () => ({ isAdminAuthenticated: mock.authenticated }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock('next/cache', () => ({ unstable_noStore: vi.fn() }));
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => React.createElement('a', { href }, children) }));
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: () => ({ from: mock.from }) }));

import SessionReportsPage from '@/app/admin/session-reports/page';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const TIME = '2026-09-25T12:01:02.123456Z';
const id = (n: number) => `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`;
const report = (n = 1) => ({
  id: id(n), reporter_id: ACTOR, reported_id: OTHER, reason: 'Messaggi offensivi', created_at: TIME,
  snapshot: { invite: {
    sender_id: ACTOR, recipient_id: OTHER, sender_username: 'sender-rider', recipient_username: 'other-rider',
    spot_name: 'Test park', spot_slug: 'test-park', spot_city: 'Roma',
    starts_at: '2026-09-30T16:00:00Z', time_zone: 'Europe/Rome', status: 'accepted', note: 'Ci vediamo alle 18?',
  }, messages: [{ id: 1, sender_id: OTHER, body: 'Messaggio allegato', created_at: TIME }] },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('SESSION_INVITES_ENABLED', 'true');
  mock.authenticated.mockReturnValue(true);
  mock.result = { data: [report()], error: null };
  const query = { select: mock.select, order: mock.order, limit: mock.limit, or: mock.or, then: (resolve: (value: unknown) => unknown) => Promise.resolve(mock.result).then(resolve) };
  mock.from.mockReturnValue(query);
  mock.select.mockReturnValue(query);
  mock.order.mockReturnValue(query);
  mock.limit.mockReturnValue(query);
  mock.or.mockReturnValue(query);
});
afterAll(() => vi.unstubAllEnvs());

describe('private session report admin review', () => {
  it('redirects non-admins before touching reports or the service client', async () => {
    mock.authenticated.mockReturnValue(false);
    await expect(SessionReportsPage({})).rejects.toThrow('REDIRECT:/admin/login');
    expect(mock.from).not.toHaveBeenCalled();
  });

  it('does not query the database when the feature is disabled', async () => {
    vi.stubEnv('SESSION_INVITES_ENABLED', 'false');
    const html = renderToStaticMarkup(await SessionReportsPage({}));
    expect(html).toContain('non sono ancora attive');
    expect(mock.from).not.toHaveBeenCalled();
  });

  it('reads report snapshots only and escapes rider-supplied text', async () => {
    const unsafe = report();
    unsafe.reason = '<script>exfiltrate()</script>';
    mock.result.data = [unsafe];
    const html = renderToStaticMarkup(await SessionReportsPage({}));
    expect(mock.from).toHaveBeenCalledExactlyOnceWith('cm_session_reports');
    expect(html).toContain('&lt;script&gt;exfiltrate()&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('Messaggio allegato');
    expect(html).toContain('sender-rider');
    expect(html).toContain('other-rider');
  });

  it('never interpolates unvalidated cursor text into PostgREST', async () => {
    const html = renderToStaticMarkup(await SessionReportsPage({ searchParams: { before: 'junk),or(id.neq.anything)' } }));
    expect(html).toContain('non è valido');
    expect(mock.from).not.toHaveBeenCalled();
    expect(mock.or).not.toHaveBeenCalled();
  });

  it('uses timestamp plus id to reach older reports with matching timestamps', async () => {
    await SessionReportsPage({ searchParams: { before: `${TIME}|${id(30)}` } });
    expect(mock.or).toHaveBeenCalledWith(`created_at.lt.${TIME},and(created_at.eq.${TIME},id.lt.${id(30)})`);
    expect(mock.order).toHaveBeenNthCalledWith(1, 'created_at', { ascending: false });
    expect(mock.order).toHaveBeenNthCalledWith(2, 'id', { ascending: false });
  });

  it('shows at most forty reports and links to the next page with the last displayed cursor', async () => {
    mock.result.data = Array.from({ length: 41 }, (_, i) => report(100 - i));
    const html = renderToStaticMarkup(await SessionReportsPage({}));
    expect((html.match(/<article/g) ?? []).length).toBe(40);
    expect(html).toContain(encodeURIComponent(`${TIME}|${id(61)}`));
    expect(html).toContain('Segnalazioni precedenti');
  });

  it('reports unavailable data without exposing database errors', async () => {
    mock.result.error = { message: 'relation cm_session_reports does not exist' };
    const html = renderToStaticMarkup(await SessionReportsPage({}));
    expect(html).toContain('Non è stato possibile caricare');
    expect(html).not.toContain('does not exist');
    expect(html).not.toContain('Nessuna segnalazione');
  });
});
