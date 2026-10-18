import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const ROW_ID = '44444444-4444-4444-8444-444444444444';
const mock = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], deletes: [] as Record<string, unknown>[], getUser: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: () => ({
    auth: { getUser: mock.getUser },
    from: () => {
      const filters: Record<string, unknown> = {};
      let isDelete = false;
      const chain: Record<string, unknown> = {
        select: () => chain,
        delete: () => { isDelete = true; return chain; },
        eq: (k: string, v: unknown) => { filters[k] = v; return chain; },
        is: (k: string, v: unknown) => { filters[k] = v; return chain; },
        gte: () => chain,
        then: (resolve: (v: unknown) => unknown) => {
          if (isDelete) { mock.deletes.push({ ...filters }); return Promise.resolve({ error: null }).then(resolve); }
          return Promise.resolve({ data: mock.rows, error: null }).then(resolve);
        },
      };
      return chain;
    },
  }),
}));

import { GET, DELETE } from '@/app/api/events/jamroma/presence/route';

beforeEach(() => {
  mock.rows = [{ id: ROW_ID, display_name: 'Anon', lat: 41.9, lon: 12.5, last_seen_at: '2026-10-16T10:00:00Z' }];
  mock.deletes = [];
  mock.getUser.mockReset();
});

describe('Jam Roma presence route', () => {
  it('public GET does not expose the row id needed to delete it', async () => {
    const body = await (await GET()).json();
    expect(body.riders).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain(ROW_ID);
  });

  it('the key shown by GET cannot be used to delete the row', async () => {
    const shown = (await (await GET()).json()).riders[0].id as string;
    const res = await DELETE(new NextRequest(`http://localhost/api/events/jamroma/presence?id=${shown}`, { method: 'DELETE' }));
    expect(res.status).toBe(400);
    expect(mock.deletes).toEqual([]);
  });

  it('anonymous delete only touches anonymous rows with the private id', async () => {
    const res = await DELETE(new NextRequest(`http://localhost/api/events/jamroma/presence?id=${ROW_ID}`, { method: 'DELETE' }));
    expect(res.status).toBe(200);
    expect(mock.deletes[0]).toMatchObject({ id: ROW_ID, user_id: null });
  });

  it('logged-in delete removes only the caller row', async () => {
    mock.getUser.mockResolvedValue({ data: { user: { id: 'rider-1' } } });
    const res = await DELETE(new NextRequest('http://localhost/api/events/jamroma/presence', { method: 'DELETE', headers: { authorization: 'Bearer t' } }));
    expect(res.status).toBe(200);
    expect(mock.deletes[0]).toMatchObject({ user_id: 'rider-1' });
  });

  it('rejects an invalid token instead of falling back to anonymous delete', async () => {
    mock.getUser.mockResolvedValue({ data: { user: null } });
    const res = await DELETE(new NextRequest(`http://localhost/api/events/jamroma/presence?id=${ROW_ID}`, { method: 'DELETE', headers: { authorization: 'Bearer bad' } }));
    expect(res.status).toBe(401);
    expect(mock.deletes).toEqual([]);
  });
});
