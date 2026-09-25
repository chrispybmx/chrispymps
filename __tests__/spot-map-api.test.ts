import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mock = vi.hoisted(() => ({ server: vi.fn(), from: vi.fn(), responses: [] as unknown[], queries: [] as Record<string, any>[] }));
vi.mock('@/lib/supabase', () => ({ supabaseServer: mock.server }));
import { GET as mapIndex } from '@/app/api/spots/index/route';
import { GET as spots } from '@/app/api/spots/route';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const spot = (n = 1, extra: Record<string, unknown> = {}) => ({
  id: id(n), name: `Spot ${n}`, slug: `spot-${n}`, type: 'street', lat: 41.9, lon: 12.5, city: 'Roma',
  condition: 'alive', condition_updated_at: '2026-09-25T12:00:00Z', ostacoli: ['rail'], likes_count: 0, spot_photos: [], ...extra,
});
const response = (rows: unknown[]) => ({ data: rows, error: null });
const req = (params: Record<string, string | undefined> = {}) => new NextRequest('http://localhost/api/spots?' + new URLSearchParams(Object.entries(params).flatMap(([key, value]) => value === undefined ? [] : [[key, value]])));
const photos = [
  { url: 'https://example.test/pending.jpg', position: 0, source: 'rider', moderation_status: 'pending' },
  { url: 'https://example.test/rejected.jpg', position: 1, source: 'rider', moderation_status: 'rejected' },
  { url: 'https://example.test/rider.jpg', position: 4, source: 'rider', moderation_status: 'approved' },
  { url: 'https://example.test/legacy.jpg', position: 2, source: 'streetview', moderation_status: null },
  { url: 'https://example.test/second.jpg', position: 3, source: 'rider', moderation_status: 'approved' },
];

beforeEach(() => {
  vi.clearAllMocks(); mock.responses = []; mock.queries = [];
  mock.server.mockReturnValue({ from: mock.from });
  mock.from.mockImplementation((table: string) => {
    const query: Record<string, any> = { table };
    for (const method of ['select', 'eq', 'in', 'order', 'range', 'or', 'gte', 'lte', 'limit']) query[method] = vi.fn(() => query);
    query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      const next = mock.responses.shift() ?? response([]);
      return (next instanceof Error ? Promise.reject(next) : Promise.resolve(next)).then(resolve, reject);
    };
    mock.queries.push(query); return query;
  });
});

const endpoints = [
  { name: 'marker index', run: () => mapIndex() },
  { name: 'photo results', run: () => spots(req()) },
];

describe('public map route boundaries', () => {
  it.each(endpoints)('$name always scopes the database request to approved spots', async ({ run }) => {
    mock.responses = [response([spot()])]; const result = await run();
    expect(result.status).toBe(200); expect(await result.json()).toMatchObject({ ok: true, data: [{ id: id(1) }] });
    expect(mock.queries).toHaveLength(1); expect(mock.queries[0].eq).toHaveBeenCalledWith('status', 'approved');
    expect(result.headers.get('Cache-Control')).toContain('s-maxage=60');
  });
  it('loads a complete small marker index across the Supabase 1000-row boundary', async () => {
    const first = Array.from({ length: 1000 }, (_, n) => spot(n + 1));
    mock.responses = [response(first), response([spot(1001), spot(1002)])];
    const result = await mapIndex(); const body = await result.json();
    expect(body.data).toHaveLength(1002); expect(new Set(body.data.map((s: { id: string }) => s.id)).size).toBe(1002);
    expect(mock.queries[0].range).toHaveBeenCalledWith(0, 999); expect(mock.queries[1].range).toHaveBeenCalledWith(1000, 1999);
    for (const query of mock.queries) {
      expect(query.eq).toHaveBeenCalledWith('status', 'approved'); expect(query.order).toHaveBeenCalledWith('id');
      expect(query.select.mock.calls[0][0]).not.toMatch(/spot_photos|access_token|email/);
    }
  });
  it.each(endpoints)('$name returns a successful empty result without inventing pins', async ({ run }) => {
    mock.responses = [response([])]; expect(await (await run()).json()).toEqual({ ok: true, data: [] });
  });
});

describe('photo moderation and selection', () => {
  it('filters pending/rejected photos and sorts approved/legacy photos for full detail', async () => {
    mock.responses = [response([spot(1, { spot_photos: photos })])];
    const result = await spots(req({ ids: id(1) })); const item = (await result.json()).data[0];
    expect(item.cover_url).toBe('https://example.test/legacy.jpg'); expect(item.cover_source).toBe('streetview');
    expect(item.photo_urls).toEqual(['https://example.test/legacy.jpg', 'https://example.test/second.jpg', 'https://example.test/rider.jpg']);
    expect(item.photo_sources).toEqual(['streetview', 'rider', 'rider']);
    expect(JSON.stringify(item)).not.toMatch(/pending\.jpg|rejected\.jpg/); expect(mock.queries[0].limit).not.toHaveBeenCalled();
  });
  it('keeps cover mode to one public photo even if the joined result contains unmoderated photos', async () => {
    mock.responses = [response([spot(1, { spot_photos: photos })])];
    const result = await spots(req({ ids: id(1), view: 'cover' })); const item = (await result.json()).data[0];
    expect(item.photo_urls).toEqual(['https://example.test/legacy.jpg']); expect(item.photo_sources).toEqual(['streetview']);
    expect(mock.queries[0].limit).toHaveBeenCalledWith(1, { referencedTable: 'spot_photos' });
    expect(mock.queries[0].or).toHaveBeenCalledWith('moderation_status.eq.approved,moderation_status.is.null', { referencedTable: 'spot_photos' });
    expect(mock.queries[0].order).toHaveBeenCalledWith('position', { referencedTable: 'spot_photos', ascending: true });
  });
  it.each([{}, { view: 'cover' }])('does not use a pending photo as fallback when there is no public photo (%j)', async params => {
    mock.responses = [response([spot(1, { spot_photos: photos.slice(0, 2) })])];
    const item = (await (await spots(req(params))).json()).data[0];
    expect(item.photo_urls).toEqual([]); expect(item.photo_sources).toEqual([]); expect(item).not.toHaveProperty('cover_url'); expect(item).not.toHaveProperty('cover_source');
  });
});

describe('bounded worldwide viewport pagination', () => {
  it('returns at most 200 pins, uses the extra record only to calculate the next offset, then terminates', async () => {
    mock.responses = [response(Array.from({ length: 201 }, (_, n) => spot(n + 1))), response([spot(201), spot(202)])];
    const first = await spots(req({ bbox: '10,40,15,44' })); const page = await first.json();
    expect(page.data).toHaveLength(200); expect(page).toMatchObject({ hasMore: true, nextOffset: 200 });
    expect(mock.queries[0].range).toHaveBeenCalledWith(0, 200);
    const second = await spots(req({ bbox: '10,40,15,44', offset: String(page.nextOffset) })); const end = await second.json();
    expect(end.data.map((s: { id: string }) => s.id)).toEqual([id(201), id(202)]); expect(end).toMatchObject({ hasMore: false, nextOffset: null });
    expect(mock.queries[1].range).toHaveBeenCalledWith(200, 400);
    expect(new Set([...page.data, ...end.data].map((s: { id: string }) => s.id)).size).toBe(202);
  });
  it('has no continuation when a viewport contains exactly 200 spots', async () => {
    mock.responses = [response(Array.from({ length: 200 }, (_, n) => spot(n + 1)))];
    expect(await (await spots(req({ bbox: '-180,-90,180,90' }))).json()).toMatchObject({ hasMore: false, nextOffset: null });
  });
  it('applies latitude and longitude limits to ordinary bounding boxes', async () => {
    await spots(req({ bbox: '10,40,15,44' })); const query = mock.queries[0];
    expect(query.gte).toHaveBeenCalledWith('lat', 40); expect(query.lte).toHaveBeenCalledWith('lat', 44);
    expect(query.gte).toHaveBeenCalledWith('lon', 10); expect(query.lte).toHaveBeenCalledWith('lon', 15);
    expect(query.order).toHaveBeenCalledWith('approved_at', { ascending: false }); expect(query.order).toHaveBeenCalledWith('id');
  });
  it('queries both sides of the antimeridian rather than requiring an impossible longitude range', async () => {
    mock.responses = [response([spot(1, { lon: 179 }), spot(2, { lon: -179 })])];
    const result = await spots(req({ bbox: '170,-30,-170,30' })); expect((await result.json()).data).toHaveLength(2);
    const query = mock.queries[0]; expect(query.or).toHaveBeenCalledWith('lon.gte.170,lon.lte.-170');
    expect(query.gte).not.toHaveBeenCalledWith('lon', expect.anything()); expect(query.lte).not.toHaveBeenCalledWith('lon', expect.anything());
    expect(query.gte).toHaveBeenCalledWith('lat', -30); expect(query.lte).toHaveBeenCalledWith('lat', 30);
  });
});

describe('query validation before database work', () => {
  it('accepts 100 valid unique ids and deduplicates repeated ids', async () => {
    const ids = Array.from({ length: 100 }, (_, n) => id(n));
    mock.responses = [response([spot(1)])]; expect((await spots(req({ ids: [...ids, ids[0]].join(',') }))).status).toBe(200);
    expect(mock.queries[0].in).toHaveBeenCalledWith('id', ids);
  });
  it.each(['', 'not-a-uuid', id(1) + ',junk', Array.from({ length: 101 }, (_, n) => id(n)).join(',')])('rejects invalid or oversized id batches before requesting data', async ids => {
    const result = await spots(req({ ids })); expect(result.status).toBe(400); expect(await result.json()).toMatchObject({ ok: false }); expect(mock.server).not.toHaveBeenCalled();
  });
  it.each([
    { bbox: '1,2,3' }, { bbox: '0,,1,1' }, { bbox: '0,50,1,20' }, { bbox: '0,0,181,1' },
    { bbox: '0,0,1),id.eq.secret,1' }, { offset: '-1' }, { offset: '0.5' }, { offset: '100001' }, { view: 'private' },
  ])('rejects malformed spatial/page parameters %j before DB access', async params => {
    expect((await spots(req(params))).status).toBe(400); expect(mock.server).not.toHaveBeenCalled();
  });
});

describe('schema compatibility and generic failures', () => {
  for (const endpoint of endpoints) {
    it.each(['42703', 'PGRST204'])(`${endpoint.name} retries only a missing ostacoli column (%s)`, async code => {
      mock.responses = [{ data: null, error: { code, message: 'column spots.ostacoli does not exist' } }, response([spot(1)])];
      expect((await endpoint.run()).status).toBe(200); expect(mock.queries).toHaveLength(2);
      expect(mock.queries[0].select.mock.calls[0][0]).toContain('ostacoli'); expect(mock.queries[1].select.mock.calls[0][0]).not.toContain('ostacoli');
      for (const query of mock.queries) expect(query.eq).toHaveBeenCalledWith('status', 'approved');
    });
    it.each([
      { code: '42703', message: 'column spots.private_internal_column does not exist' },
      { code: 'PGRST204', message: 'source missing from schema cache' },
      { code: '08006', message: 'ostacoli query failed, private connection details' },
    ])(`${endpoint.name} does not conceal unrelated DB failure with a compatibility retry`, async error => {
      mock.responses = [{ data: null, error }]; const result = await endpoint.run();
      expect(result.status).toBeGreaterThanOrEqual(500); expect(mock.queries).toHaveLength(1);
      expect(await result.json()).toEqual({ ok: false, error: 'Non riesco a caricare gli spot.' });
    });
    it(`${endpoint.name} keeps a failed compatibility retry generic`, async () => {
      mock.responses = [{ data: null, error: { code: '42703', message: 'ostacoli does not exist' } }, { data: null, error: { code: '08006', message: 'private infrastructure detail' } }];
      const result = await endpoint.run(); expect(result.status).toBeGreaterThanOrEqual(500); expect(await result.text()).not.toContain('private infrastructure detail'); expect(mock.queries).toHaveLength(2);
    });
    it(`${endpoint.name} catches a rejected transport operation and returns a generic failure`, async () => {
      mock.responses = [new Error('private infrastructure detail')]; const result = await endpoint.run();
      expect(result.status).toBeGreaterThanOrEqual(500); expect(await result.json()).toEqual({ ok: false, error: 'Non riesco a caricare gli spot.' });
    });
  }
  it('keeps the index fallback across later pages rather than repeating failing schema requests', async () => {
    mock.responses = [{ data: null, error: { code: '42703', message: 'ostacoli does not exist' } }, response(Array.from({ length: 1000 }, (_, n) => spot(n))), response([spot(1000)])];
    const result = await mapIndex(); expect((await result.json()).data).toHaveLength(1001); expect(mock.queries).toHaveLength(3);
    expect(mock.queries[2].select.mock.calls[0][0]).not.toContain('ostacoli'); expect(mock.queries[2].range).toHaveBeenCalledWith(1000, 1999);
  });
});
