import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mock = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), rate: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: () => ({ auth: { getUser: mock.getUser }, rpc: mock.rpc }) }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mock.rate }));

import { GET as inbox, POST as invite, PATCH as preference } from '@/app/api/session-invites/route';
import { GET as thread, POST as send, PATCH as action } from '@/app/api/session-invites/[id]/route';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const INVITE = '22222222-2222-4222-8222-222222222222';
const SPOT = '33333333-3333-4333-8333-333333333333';
const CLIENT = '44444444-4444-4444-8444-444444444444';
const context = { params: { id: INVITE } };
const request = (method = 'GET', body?: unknown, query = '', authorization: string | null = 'Bearer verified-token') => new NextRequest(`http://localhost/api/session-invites${query}`, {
  method, headers: { 'Content-Type': 'application/json', ...(authorization === null ? {} : { Authorization: authorization }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const input = () => ({ recipient: 'other-rider', spotId: SPOT, startsAt: new Date(Date.now() + 86400000).toISOString(), timeZone: 'Europe/Rome', note: 'Giriamo?', clientId: CLIENT });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('SESSION_INVITES_ENABLED', 'true');
  mock.getUser.mockResolvedValue({ data: { user: { id: ACTOR } }, error: null });
  mock.rpc.mockResolvedValue({ data: { id: INVITE, recipientId: 'recipient', created: true }, error: null });
  mock.rate.mockResolvedValue({ allowed: true, remaining: 4, resetAt: Date.now() + 3600000 });
});
afterAll(() => vi.unstubAllEnvs());

describe('session invites API: private boundaries', () => {
  it('is unavailable by default and never queries authentication or private data', async () => {
    vi.stubEnv('SESSION_INVITES_ENABLED', 'false');
    const response = await inbox(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'FEATURE_UNAVAILABLE' });
    expect(mock.getUser).not.toHaveBeenCalled();
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it.each([null, 'Bearer ', 'Basic token', 'Bearer token extra'])('rejects malformed authorization %s without DB access', async token => {
    expect((await invite(request('POST', input(), '', token))).status).toBe(401);
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it('verifies the access token with auth.getUser before every private operation', async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'expired' } });
    expect((await send(request('POST', { body: 'Ciao', clientId: CLIENT }), context)).status).toBe(401);
    expect(mock.getUser).toHaveBeenCalledWith('verified-token');
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it('does not trust actor ids injected in the payload', async () => {
    expect((await invite(request('POST', { ...input(), actor: 'outsider' }))).status).toBe(422);
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it('returns private non-cacheable responses on success and failure', async () => {
    const success = await inbox(request());
    const failure = await inbox(request('GET', undefined, '', null));
    for (const response of [success, failure]) {
      expect(response.headers.get('Cache-Control')).toContain('no-store');
      expect(response.headers.get('Cache-Control')).toContain('private');
      expect(response.headers.get('Vary')).toBe('Authorization');
      expect(response.headers.get('X-Robots-Tag')).toContain('noindex');
    }
  });

  it('makes outsiders indistinguishable from missing conversations', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: 'NOT_FOUND', code: 'P0001' } });
    const response = await thread(request(), context);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, code: 'NOT_FOUND', error: 'Conversazione non disponibile.' });
    expect(mock.rpc).toHaveBeenCalledWith('cm_session_thread', { actor: ACTOR, invitation: INVITE, after_message: null, before_message: null });
  });

  it('does not expose missing SQL tables when migration is not installed', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: 'function public.cm_session_inbox does not exist', code: 'PGRST202' } });
    const response = await inbox(request());
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).toContain('FEATURE_UNAVAILABLE');
    expect(body).not.toContain('cm_session_inbox');
  });
});

describe('invitation creation, preferences and pagination', () => {
  it('passes only verified identity and validated input to the atomic creation RPC', async () => {
    const body = input();
    const response = await invite(request('POST', body));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true, id: INVITE });
    expect(mock.rpc).toHaveBeenCalledWith('cm_session_create_invite', {
      actor: ACTOR, recipient: body.recipient, spot: SPOT, starts: body.startsAt,
      zone: 'Europe/Rome', invitation_note: 'Giriamo?', client: CLIENT, allow_new: true,
    });
    expect(mock.rate).toHaveBeenCalledWith(`session-invite:${ACTOR}`, 5, 3600000);
  });

  it('allows a committed idempotent retry even after the outer request limit', async () => {
    mock.rate.mockResolvedValue({ allowed: false });
    mock.rpc.mockResolvedValue({ data: { id: INVITE, created: false }, error: null });
    const response = await invite(request('POST', input()));
    expect(response.status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith('cm_session_create_invite', expect.objectContaining({ allow_new: false, client: CLIENT }));
  });

  it.each([
    { startsAt: '2020-01-01T10:00:00Z' }, { startsAt: 'not-a-date' },
    { startsAt: '2099-01-01T10:00:00Z' }, { timeZone: 'Moon/Sea' },
    { recipient: 'a%other' }, { spotId: 'not-an-id' }, { note: 'x'.repeat(501) },
  ])('rejects invalid invitation data %j', async patch => {
    expect((await invite(request('POST', { ...input(), ...patch }))).status).toBe(422);
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it.each(['SELF_INVITE', 'BLOCKED', 'INVITE_EXISTS', 'RATE_LIMIT'])('preserves authoritative DB guard %s', async code => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: code, code: 'P0001' } });
    const response = await invite(request('POST', input()));
    expect(response.status).toBe(code === 'SELF_INVITE' ? 422 : code === 'RATE_LIMIT' ? 429 : 409);
    expect(await response.json()).toMatchObject({ code });
  });

  it('passes the tie-breaking inbox cursor without dropping timestamp precision', async () => {
    const time = '2026-09-25T12:01:02.123456Z';
    await inbox(request('GET', undefined, `?before=${encodeURIComponent(`${time}|${INVITE}`)}`));
    expect(mock.rpc).toHaveBeenCalledWith('cm_session_inbox', { actor: ACTOR, before_time: time, before_id: INVITE });
  });

  it.each(['garbage', '2026-09-25T12:00:00Z|invalid', `2026-09-25T12:00:00Z|${INVITE}|extra`])('rejects malformed inbox cursor %s', async cursor => {
    expect((await inbox(request('GET', undefined, `?before=${encodeURIComponent(cursor)}`))).status).toBe(422);
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it('changes only the verified actor email preference', async () => {
    expect((await preference(request('PATCH', { emailEnabled: true }))).status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith('cm_session_set_preference', { actor: ACTOR, enabled: true });
  });

  it('removes only the verified actor’s block without requiring a surviving invitation', async () => {
    expect((await preference(request('PATCH', { unblockUserId: INVITE }))).status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith('cm_session_unblock_user', { actor: ACTOR, blocked_user: INVITE });
  });

  it('requires authentication to unblock and rejects mixed or forged preference changes', async () => {
    expect((await preference(request('PATCH', { unblockUserId: INVITE }, '', null))).status).toBe(401);
    expect((await preference(request('PATCH', { unblockUserId: INVITE, actor: 'outsider' }))).status).toBe(422);
    expect((await preference(request('PATCH', { unblockUserId: INVITE, emailEnabled: true }))).status).toBe(422);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
});

describe('private conversation operations', () => {
  it('never sends before acceptance and preserves the server guard', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: 'NOT_ACCEPTED', code: 'P0001' } });
    const response = await send(request('POST', { body: 'Prima della session', clientId: CLIENT }), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'NOT_ACCEPTED' });
    expect(mock.rpc).toHaveBeenCalledWith('cm_session_send_message', { actor: ACTOR, invitation: INVITE, message_body: 'Prima della session', client: CLIENT, allow_new: true });
  });

  it.each(['', '   ', 'x'.repeat(2001)])('rejects empty or overlong messages before DB writes', async body => {
    expect((await send(request('POST', { body, clientId: CLIENT }), context)).status).toBe(422);
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it('returns the message supplied by the atomic RPC without adding browser-controlled identity', async () => {
    const saved = { id: 17, invite_id: INVITE, sender_id: ACTOR, body: 'Alle 18?', client_id: CLIENT, created_at: '2026-09-25T12:00:00Z' };
    mock.rpc.mockResolvedValue({ data: saved, error: null });
    const response = await send(request('POST', { body: ' Alle 18? ', clientId: CLIENT }), context);
    expect(await response.json()).toEqual({ ok: true, data: saved });
  });

  it('uses incremental retrieval and does not mark a conversation read on GET', async () => {
    await thread(request('GET', undefined, '?after=40'), context);
    expect(mock.rpc).toHaveBeenCalledExactlyOnceWith('cm_session_thread', { actor: ACTOR, invitation: INVITE, after_message: 40, before_message: null });
  });

  it.each(['?after=2&before=4', '?after=-1', '?before=0', '?before=1.5', '?after=9007199254740992'])('rejects ambiguous/unsafe message cursor %s', async query => {
    expect((await thread(request('GET', undefined, query), context)).status).toBe(422);
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it('keeps response ownership checks inside the same transaction as the mutation', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: 'FORBIDDEN', code: 'P0001' } });
    expect((await action(request('PATCH', { action: 'accept' }), context)).status).toBe(403);
    expect(mock.rpc).toHaveBeenCalledWith('cm_session_action', { actor: ACTOR, invitation: INVITE, requested_action: 'accept', report_reason: null, read_through: null });
  });

  it('requires a concrete reason for reports', async () => {
    expect((await action(request('PATCH', { action: 'report', reason: ' ' }), context)).status).toBe(422);
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it.each(['block', 'unblock'])('binds %s to the verified participant', async requestedAction => {
    expect((await action(request('PATCH', { action: requestedAction }), context)).status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith('cm_session_action', { actor: ACTOR, invitation: INVITE, requested_action: requestedAction, report_reason: null, read_through: null });
  });

  it('requires a viewed snapshot timestamp to mark read and preserves its precision', async () => {
    expect((await action(request('PATCH', { action: 'read' }), context)).status).toBe(422);
    expect(mock.rpc).not.toHaveBeenCalled();
    const readThrough = '2026-09-25T12:01:02.123456Z';
    expect((await action(request('PATCH', { action: 'read', readThrough }), context)).status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith('cm_session_action', { actor: ACTOR, invitation: INVITE, requested_action: 'read', report_reason: null, read_through: readThrough });
  });

  it('rejects oversized requests before parsing or writing, even without a length header', async () => {
    const response = await send(request('POST', { body: 'x'.repeat(20_000), clientId: CLIENT }), context);
    expect(response.status).toBe(413);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
});
