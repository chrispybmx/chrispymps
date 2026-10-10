/** Real route handlers + real PostgreSQL functions; only identity and transport are substituted.
 * No .env files, production records, Supabase HTTP requests or emails are used.
 */
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';

const bridge = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: () => ({ auth: { getUser: bridge.getUser }, rpc: bridge.rpc }) }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: async () => ({ allowed: true }) }));

import { GET as inbox, POST as invite, PATCH as preference } from '@/app/api/session-invites/route';
import { GET as thread, POST as send, PATCH as action } from '@/app/api/session-invites/[id]/route';

const db = new PGlite();
const sender = randomUUID(), recipient = randomUUID(), outsider = randomUUID(), spot = randomUUID();
const identities: Record<string, string> = { sender, recipient, outsider };
const request = (who: string, method = 'GET', body?: unknown, query = '') => new NextRequest(`http://localhost/api/session-invites${query}`, {
  method, headers: { Authorization: `Bearer ${who}`, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const input = () => ({ recipient: 'rider_b', spotId: spot, startsAt: new Date(Date.now() + 86400000).toISOString(), timeZone: 'Europe/Rome', note: 'Giriamo domani?', clientId: randomUUID() });
const count = async (table: string) => (await db.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0].n;

beforeAll(async () => {
  vi.stubEnv('SESSION_INVITES_ENABLED', 'true');
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),username text,avatar_url text);
    CREATE TYPE public.spot_status AS ENUM ('pending','approved','rejected','deleted');
    CREATE TABLE public.spots(id uuid PRIMARY KEY,name text,slug text,city text,status public.spot_status);
  `);
  await db.query('insert into auth.users values ($1),($2),($3)', [sender, recipient, outsider]);
  await db.query("insert into profiles(id,username) values ($1,'rider_a'),($2,'rider_b'),($3,'outsider')", [sender, recipient, outsider]);
  await db.query("insert into spots values ($1,'Test spot','test-spot','Test city','approved')", [spot]);
  await db.exec(await readFile(new URL('../supabase/migrations/20260925_private_session_invites.sql', import.meta.url), 'utf8'));
  await db.exec('SET ROLE service_role');
  bridge.getUser.mockImplementation(async (token: string) => ({ data: { user: identities[token] ? { id: identities[token] } : null }, error: null }));
  // Named arguments are resolved by PostgreSQL, so signature drift fails this test.
  bridge.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (!/^cm_session_[a-z_]+$/.test(name) || Object.keys(args).some(key => !/^[a-z_]+$/.test(key))) throw new Error('Invalid test RPC identifier');
    const named = Object.keys(args).map((key, index) => `${key} => $${index + 1}`).join(',');
    try {
      const result = await db.query<{ data: unknown }>(`select public.${name}(${named}) as data`, Object.values(args));
      return { data: result.rows[0].data, error: null };
    } catch (error) {
      const pg = error as { message: string; code: string };
      return { data: null, error: { message: pg.message, code: pg.code } };
    }
  });
}, 30000);

beforeEach(async () => {
  vi.stubEnv('SESSION_INVITES_ENABLED', 'true');
  await db.exec('TRUNCATE cm_session_messages, cm_session_reports, cm_session_email_outbox, cm_session_invites, cm_session_preferences, cm_session_blocks');
});
afterAll(async () => { await db.close(); vi.unstubAllEnvs(); });

it('connects invitation, acceptance, private messages, read badges, reporting and blocking', async () => {
  const body = input();
  const created = await invite(request('sender', 'POST', body));
  expect(created.status).toBe(201);
  const { id } = await created.json();
  const context = { params: Promise.resolve({ id }) };
  expect(await count('cm_session_email_outbox')).toBe(0);
  const retry = await invite(request('sender', 'POST', body));
  expect(retry.status).toBe(200);
  expect(await retry.json()).toMatchObject({ id });

  const received = await inbox(request('recipient'));
  expect(received.status).toBe(200);
  expect(await received.json()).toMatchObject({ unreadCount: 1, emailEnabled: false, data: [{ id, status: 'pending', sender_username: 'rider_a', spot_name: 'Test spot' }] });
  expect(await (await inbox(request('outsider'))).json()).toMatchObject({ data: [], unreadCount: 0 });
  expect((await thread(request('outsider'), context)).status).toBe(404);
  expect((await action(request('sender', 'PATCH', { action: 'accept' }), context)).status).toBe(403);
  expect(await (await send(request('sender', 'POST', { body: 'Troppo presto', clientId: randomUUID() }), context)).json()).toMatchObject({ code: 'NOT_ACCEPTED' });
  expect((await action(request('recipient', 'PATCH', { action: 'accept' }), context)).status).toBe(200);

  const message = { body: 'Alle 16 allo spot', clientId: randomUUID() };
  const sent = await send(request('sender', 'POST', message), context);
  expect(sent.status).toBe(200);
  expect(await (await send(request('sender', 'POST', message), context)).json()).toEqual(await sent.json());
  expect(await count('cm_session_messages')).toBe(1);
  const opened = await thread(request('recipient'), context);
  expect(opened.headers.get('Cache-Control')).toContain('no-store');
  const conversation = (await opened.json()).data;
  expect(conversation.messages).toMatchObject([{ body: message.body, sender_id: sender }]);
  expect(conversation.invite).toMatchObject({ status: 'accepted', unread: true });
  expect((await action(request('recipient', 'PATCH', { action: 'read', readThrough: conversation.invite.updated_at }), context)).status).toBe(200);
  expect(await (await inbox(request('recipient'))).json()).toMatchObject({ unreadCount: 0 });

  expect((await action(request('recipient', 'PATCH', { action: 'report', reason: 'Segnalazione di collaudo' }), context)).status).toBe(200);
  expect(await count('cm_session_reports')).toBe(1);
  expect((await action(request('recipient', 'PATCH', { action: 'block' }), context)).status).toBe(200);
  expect(await (await send(request('sender', 'POST', { body: 'Dopo blocco', clientId: randomUUID() }), context)).json()).toMatchObject({ code: 'BLOCKED' });
  expect(await (await invite(request('sender', 'POST', input()))).json()).toMatchObject({ code: 'BLOCKED' });
  expect((await preference(request('recipient', 'PATCH', { unblockUserId: sender }))).status).toBe(200);
  expect((await (await thread(request('recipient'), context)).json()).data.invite.status).toBe('blocked');
});

it('connects email opt-in, durable queue, opt-out and cancellation without sending email', async () => {
  expect((await preference(request('recipient', 'PATCH', { emailEnabled: true }))).status).toBe(200);
  const created = await invite(request('sender', 'POST', input()));
  expect(created.status).toBe(201);
  const { id } = await created.json();
  expect(await count('cm_session_email_outbox')).toBe(1);
  expect(await (await inbox(request('recipient'))).json()).toMatchObject({ emailEnabled: true });
  expect((await preference(request('recipient', 'PATCH', { emailEnabled: false }))).status).toBe(200);
  expect(await count('cm_session_email_outbox')).toBe(0);
  expect((await action(request('sender', 'PATCH', { action: 'cancel' }), { params: Promise.resolve({ id }) })).status).toBe(200);
});

it('rejects unknown identities and keeps the server kill switch effective', async () => {
  expect((await inbox(request('unknown'))).status).toBe(401);
  const calls = bridge.rpc.mock.calls.length;
  vi.stubEnv('SESSION_INVITES_ENABLED', 'false');
  expect((await inbox(request('recipient'))).status).toBe(503);
  expect(bridge.rpc.mock.calls.length).toBe(calls);
});

it('paginates the real inbox without losing invitations with identical timestamps', async () => {
  await db.query(`insert into cm_session_invites(sender_id,recipient_id,spot_id,starts_at,time_zone,client_id,updated_at)
    select $1,$2,$3,now()+interval '1 day','Europe/Rome',gen_random_uuid(),'2026-09-26T10:00:00.123456Z'
    from generate_series(1,45)`, [sender, recipient, spot]);
  const first = await (await inbox(request('recipient'))).json();
  expect(first.data).toHaveLength(40);
  expect(first.hasMore).toBe(true);
  expect(first.nextBefore).toContain('.123456Z|');
  const second = await (await inbox(request('recipient', 'GET', undefined, `?before=${encodeURIComponent(first.nextBefore)}`))).json();
  expect(second.data).toHaveLength(5);
  expect(second.hasMore).toBe(false);
  expect(new Set([...first.data, ...second.data].map(item => item.id)).size).toBe(45);
});

it('loads older messages and incremental updates without gaps or duplicates', async () => {
  const created = await invite(request('sender', 'POST', input()));
  expect(created.status).toBe(201);
  const { id } = await created.json();
  const context = { params: Promise.resolve({ id }) };
  expect((await action(request('recipient', 'PATCH', { action: 'accept' }), context)).status).toBe(200);
  await db.query(`insert into cm_session_messages(invite_id,sender_id,body,client_id)
    select $1,$2,'Messaggio '||n,gen_random_uuid() from generate_series(1,85) n`, [id, sender]);
  const latest = (await (await thread(request('recipient'), context)).json()).data;
  expect(latest.messages).toHaveLength(40);
  expect(latest.hasMore).toBe(true);
  const older = (await (await thread(request('recipient', 'GET', undefined, `?before=${latest.messages[0].id}`), context)).json()).data;
  expect(older.messages).toHaveLength(40);
  const oldest = (await (await thread(request('recipient', 'GET', undefined, `?before=${older.messages[0].id}`), context)).json()).data;
  expect(oldest.messages).toHaveLength(5);
  expect(oldest.hasMore).toBe(false);
  const history = [...oldest.messages, ...older.messages, ...latest.messages];
  expect(new Set(history.map(item => item.id)).size).toBe(85);
  expect(history.map(item => item.body)).toEqual(Array.from({ length: 85 }, (_, index) => `Messaggio ${index + 1}`));
  const updates = (await (await thread(request('recipient', 'GET', undefined, `?after=${oldest.messages[4].id}`), context)).json()).data;
  expect(updates.messages).toEqual(older.messages);
  expect(updates.hasMore).toBe(true);
});
