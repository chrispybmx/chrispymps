import { describe, expect, it, vi } from 'vitest';
import { createPresenceSession } from '@/lib/jamroma-presence-client';

type Call = { url: string; method: string; auth?: string };

function fakeFetch(postReply: () => Promise<Response>, deleteOk = true) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, method, auth: headers.Authorization });
    if (method === 'POST') return postReply();
    return new Response(JSON.stringify({ ok: deleteOk }), { status: deleteOk ? 200 : 503 });
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

const anonReply = (id: string) => async () => new Response(JSON.stringify({ ok: true, presenceId: id }), { status: 200 });

describe('Jam Roma presence session', () => {
  it('stop deletes the anonymous rows this browser created', async () => {
    const f = fakeFetch(anonReply('11111111-1111-4111-8111-111111111111'));
    const s = createPresenceSession({ fetch: f.fetch, getToken: () => null, getDisplayName: () => 'Rider' });
    s.start();
    await s.send({ lat: 41.9, lon: 12.5 });
    expect(await s.stop()).toBe(true);
    expect(f.calls.filter(c => c.method === 'DELETE').map(c => c.url)).toEqual(['/api/events/jamroma/presence?id=11111111-1111-4111-8111-111111111111']);
  });

  it('ignores a GPS position that arrives after stop', async () => {
    const f = fakeFetch(anonReply('a'));
    const s = createPresenceSession({ fetch: f.fetch, getToken: () => null, getDisplayName: () => 'Rider' });
    s.start();
    await s.stop();
    await s.send({ lat: 41.9, lon: 12.5 });
    expect(f.calls.some(c => c.method === 'POST')).toBe(false);
  });

  it('deletes a row whose POST finished after stop', async () => {
    let release!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    const f = fakeFetch(async () => { await gate; return anonReply('22222222-2222-4222-8222-222222222222')(); });
    const s = createPresenceSession({ fetch: f.fetch, getToken: () => null, getDisplayName: () => 'Rider' });
    s.start();
    const pending = s.send({ lat: 41.9, lon: 12.5 });
    await s.stop();
    release();
    await pending;
    expect(f.calls.filter(c => c.method === 'DELETE').map(c => c.url)).toContain('/api/events/jamroma/presence?id=22222222-2222-4222-8222-222222222222');
  });

  it('reports a failed delete and keeps the id for a retry', async () => {
    const f = fakeFetch(anonReply('33333333-3333-4333-8333-333333333333'), false);
    const s = createPresenceSession({ fetch: f.fetch, getToken: () => null, getDisplayName: () => 'Rider' });
    s.start();
    await s.send({ lat: 41.9, lon: 12.5 });
    expect(await s.stop()).toBe(false);
    expect(await s.stop()).toBe(false);
    expect(f.calls.filter(c => c.method === 'DELETE')).toHaveLength(2);
  });

  it('uses the token available at stop time, not the one at start', async () => {
    let token: string | null = null;
    const f = fakeFetch(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const s = createPresenceSession({ fetch: f.fetch, getToken: () => token, getDisplayName: () => 'Rider' });
    s.start();
    token = 'late-login';
    await s.send({ lat: 41.9, lon: 12.5 });
    await s.stop();
    const del = f.calls.find(c => c.method === 'DELETE');
    expect(del?.auth).toBe('Bearer late-login');
  });
});
