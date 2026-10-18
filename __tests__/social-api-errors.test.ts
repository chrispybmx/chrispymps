import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mock = vi.hoisted(() => ({ results: [] as any[], operations: [] as string[], getUser: vi.fn() }));
vi.mock('@/lib/supabase', () => {
  const client = { auth: { getUser: mock.getUser }, from: (table: string) => {
    let action = 'select';
    const finish = () => { mock.operations.push(`${table}:${action}`); return Promise.resolve(mock.results.shift() ?? { data: null, error: null }); };
    const chain: any = {
      select: () => chain, eq: () => chain,
      insert: () => { action = 'insert'; return chain; },
      update: () => { action = 'update'; return chain; },
      delete: () => { action = 'delete'; return chain; },
      single: finish, maybeSingle: finish,
      then: (resolve: any, reject: any) => finish().then(resolve, reject),
    };
    return chain;
  } };
  return { supabaseAdmin: () => client, supabaseServer: () => client };
});
import { POST as commentPost } from '@/app/api/comment-likes/route';
import { GET as ratingGet, POST as ratingPost } from '@/app/api/spot-ratings/route';
import { GET as riderGet, POST as riderPost } from '@/app/api/riders/route';
const good = (data: unknown = null) => ({ data, error: null, count: 3 });
const bad = { data: null, error: { message: 'private database detail' }, count: null };
const comment = good({ id: 'comment', user_id: 'user', text: 'Hello' });
const spot = good({ avg_rating: 4, ratings_count: 3 });
const existing = good({ id: 'existing' });
// POST voto: prima si verifica che lo spot sia approvato.
const approved = good({ id: '22222222-2222-4222-8222-222222222222' });
const req = (method: string, token = true) => new NextRequest('http://localhost/api/test?spot_id=22222222-2222-4222-8222-222222222222', {
  method, headers: { ...(token ? { Authorization: 'Bearer valid' } : {}), 'Content-Type': 'application/json' },
  ...(method === 'POST' ? { body: JSON.stringify({ spot_id: '22222222-2222-4222-8222-222222222222', comment_id: 'comment', rating: 4 }) } : {}),
});
beforeEach(() => { mock.results = []; mock.operations = []; mock.getUser.mockResolvedValue({ data: { user: { id: 'user' } }, error: null }); });
describe('social API database failures', () => {
  const cases = [
    ['comment read', commentPost, [bad]],
    ['comment profile read', commentPost, [comment, bad]],
    ['comment existing read', commentPost, [comment, good(), bad]],
    ['comment insert', commentPost, [comment, good(), good(), bad]],
    ['comment delete', commentPost, [comment, good(), existing, bad]],
    ['comment count read', commentPost, [comment, good(), good(), good(), bad]],
    ['comment removed count read', commentPost, [comment, good(), existing, good(), bad]],
    ['rating aggregate read', ratingGet, [bad]],
    ['rating personal read', ratingGet, [spot, bad]],
    ['rating approved-spot read', ratingPost, [bad]],
    ['rating existing read', ratingPost, [approved, bad]],
    ['rating insert', ratingPost, [approved, good(), bad]],
    ['rating update', ratingPost, [approved, existing, bad]],
    ['rating resulting aggregate read', ratingPost, [approved, good(), good(), bad]],
    ['rider count read', riderGet, [bad]],
    ['rider personal read', riderGet, [good(), bad]],
    ['rider existing read', riderPost, [bad]],
    ['rider insert', riderPost, [good(), bad]],
    ['rider delete', riderPost, [existing, bad]],
    ['rider resulting count read', riderPost, [good(), good(), bad]],
  ] as const;
  it.each(cases)('rejects %s and stops subsequent operations', async (_, handler, results) => {
    mock.results = [...results];
    const response = await handler(req(handler === ratingGet || handler === riderGet ? 'GET' : 'POST'));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({ ok: false });
    expect(JSON.stringify(body)).not.toContain('private database detail');
    expect(mock.operations).toHaveLength(results.length);
  });
  it('rejects failed rating removal', async () => {
    mock.results = [approved, bad];
    const request = req('POST');
    const body = await request.json();
    const response = await ratingPost(new NextRequest(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify({ ...body, rating: 0 }) }));
    expect(response.status).toBe(500);
    expect(mock.operations).toEqual(['spots:select', 'spot_ratings:delete']);
  });
  it.each([
    [ratingGet, [spot, good({ rating: 5 })], { ok: true, avg: 4, count: 3, myRating: 5 }],
    [riderGet, [good(), existing], { ok: true, count: 3, hasRidden: true }],
  ])('preserves successful reads', async (handler, results, expected) => {
    mock.results = [...results];
    expect(await (await handler(req('GET'))).json()).toEqual(expected);
  });
  it('preserves a missing comment as 404', async () => {
    mock.results = [good()];
    expect((await commentPost(req('POST'))).status).toBe(404);
  });
  it.each([commentPost, ratingPost, riderPost])('preserves required authentication', async handler => {
    expect((await handler(req('POST', false))).status).toBe(401);
    expect(mock.operations).toEqual([]);
  });
  it.each([
    [commentPost, [comment, good(), good(), good(), good({ likes_count: 3 })], { ok: true, liked: true, likes_count: 3 }],
    [commentPost, [comment, good(), existing, good(), good({ likes_count: 3 })], { ok: true, liked: false, likes_count: 3 }],
    [ratingPost, [approved, good(), good(), spot], { ok: true, avg: 4, count: 3, myRating: 4 }],
    [riderPost, [good(), good(), good()], { ok: true, hasRidden: true, count: 3 }],
    [riderPost, [existing, good(), good()], { ok: true, hasRidden: false, count: 3 }],
  ])('preserves successful mutation response', async (handler, results, expected) => {
    mock.results = [...results];
    expect(await (await handler(req('POST'))).json()).toEqual(expected);
  });
  it('rejects a rating that is not an integer 0-5 before touching the database', async () => {
    for (const rating of ['abc', null, 2.5, 6]) {
      const response = await ratingPost(new NextRequest('http://localhost/api/test', { method: 'POST', headers: { Authorization: 'Bearer valid', 'Content-Type': 'application/json' }, body: JSON.stringify({ spot_id: '22222222-2222-4222-8222-222222222222', rating }) }));
      expect(response.status).toBe(400);
    }
    expect(mock.operations).toEqual([]);
  });
  it('refuses to rate a spot that is not approved', async () => {
    mock.results = [good(null)];
    const response = await ratingPost(req('POST'));
    expect(response.status).toBe(404);
    expect(mock.operations).toEqual(['spots:select']);
  });
});
