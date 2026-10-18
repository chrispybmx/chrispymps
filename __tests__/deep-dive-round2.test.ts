import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/* Supabase finto: ogni query consuma il prossimo risultato in coda e annota
   tabella e azione, cosi' si vede cosa e' stato fatto e cosa no. */
const mock = vi.hoisted(() => ({
  results: [] as unknown[],
  ops: [] as string[],
  storageRemove: vi.fn(),
  storageUpload: vi.fn(),
  getUser: vi.fn(),
  xp: vi.fn(),
  rejected: vi.fn(),
}));

vi.mock('@/lib/supabase', () => {
  const client = {
    auth: { getUser: mock.getUser },
    storage: { from: () => ({
      remove: mock.storageRemove,
      upload: mock.storageUpload,
      getPublicUrl: (p: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/spot-photos/${p}` } }),
    }) },
    from: (table: string) => {
      let action = 'select';
      const finish = () => { mock.ops.push(`${table}:${action}`); return Promise.resolve(mock.results.shift() ?? { data: null, error: null }); };
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'gte', 'order', 'limit', 'in', 'is', 'ilike', 'or', 'range']) chain[m] = () => chain;
      chain.insert = () => { action = 'insert'; return chain; };
      chain.update = () => { action = 'update'; return chain; };
      chain.delete = () => { action = 'delete'; return chain; };
      chain.upsert = () => { action = 'upsert'; return chain; };
      chain.single = finish; chain.maybeSingle = finish;
      chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => finish().then(res, rej);
      return chain;
    },
  };
  return { supabaseAdmin: () => client, supabaseServer: () => client };
});
vi.mock('@/lib/auth', () => ({ isAdminAuthenticated: () => true }));
vi.mock('@/lib/xp', () => ({ onPhotoApproved: mock.xp, onContentRejected: mock.rejected }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/image', () => ({ optimizeImage: async () => ({ buffer: Buffer.from('x'), contentType: 'image/jpeg', ext: 'jpg' }) }));

import { GET as userStats } from '@/app/api/user-stats/route';
import { GET as numeri } from '@/app/api/admin/numeri/route';
import { POST as deletePhoto } from '@/app/api/admin/delete-photo/route';
import { POST as deleteSpot } from '@/app/api/admin/delete-spot/route';
import { POST as pendingPhotos } from '@/app/api/admin/pending-photos/route';
import { POST as swipe } from '@/app/api/swipe/route';
import { POST as profile } from '@/app/api/profile/route';
import { POST as spotPhotos } from '@/app/api/spot-photos/route';
import { POST as adminUpload } from '@/app/api/admin/upload-photo/route';

const ok = (data: unknown = null, extra: Record<string, unknown> = {}) => ({ data, error: null, ...extra });
const bad = { data: null, error: { message: 'db down' }, count: null };
const SPOT = '11111111-1111-4111-8111-111111111111';
const PHOTO = '22222222-2222-4222-8222-222222222222';
const json = (url: string, body: unknown, auth = true) => new NextRequest(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer t' } : {}) }, body: JSON.stringify(body),
});

beforeEach(() => {
  mock.results = []; mock.ops = [];
  mock.storageRemove.mockReset().mockResolvedValue({ error: null });
  mock.storageUpload.mockReset().mockResolvedValue({ error: null });
  mock.getUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  mock.xp.mockReset().mockResolvedValue(undefined);
  mock.rejected.mockReset().mockResolvedValue(undefined);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
});

describe('user-stats', () => {
  it('a database error is a 503 without public cache, not "zero XP"', async () => {
    mock.results = [ok({ id: 'u', username: 'rider' }), bad, ok([]), ok([])];
    const res = await userStats(new NextRequest('http://localhost/api/user-stats?username=rider'));
    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('admin numeri', () => {
  it('a failed query is reported instead of shown as zeros', async () => {
    mock.results = [ok([]), bad, ok([]), ok([])];
    const res = await numeri();
    expect(res.status).toBe(503);
  });
});

describe('admin delete-photo', () => {
  it('keeps the database row when the storage file cannot be removed', async () => {
    mock.results = [ok({ url: 'https://x.supabase.co/storage/v1/object/public/spot-photos/s/a.jpg', spots: { slug: 's' } })];
    mock.storageRemove.mockResolvedValue({ error: { message: 'storage down' } });
    const res = await deletePhoto(json('http://localhost/api/admin/delete-photo', { photo_id: PHOTO }));
    expect(res.status).toBe(502);
    expect(mock.ops).not.toContain('spot_photos:delete');
  });
  it('removes the file taken from the database, ignoring a url sent by the client', async () => {
    mock.results = [ok({ url: 'https://x.supabase.co/storage/v1/object/public/spot-photos/s/real.jpg', spots: { slug: 's' } }), ok()];
    await deletePhoto(json('http://localhost/api/admin/delete-photo', { photo_id: PHOTO, url: 'https://x.supabase.co/storage/v1/object/public/spot-photos/other/victim.jpg' }));
    expect(mock.storageRemove).toHaveBeenCalledWith(['s/real.jpg']);
  });
});

describe('admin delete-spot', () => {
  it('does not delete the spot when its photos cannot be removed from storage', async () => {
    mock.results = [ok({ slug: 's', city: 'Roma' }), ok([{ url: 'https://x.supabase.co/storage/v1/object/public/spot-photos/s/a.jpg' }])];
    mock.storageRemove.mockResolvedValue({ error: { message: 'storage down' } });
    const res = await deleteSpot(json('http://localhost/api/admin/delete-spot', { spot_id: SPOT }));
    expect(res.status).toBe(502);
    expect(mock.ops).not.toContain('spots:delete');
  });
  it('stops if the photo list cannot be read', async () => {
    mock.results = [ok({ slug: 's', city: 'Roma' }), bad];
    const res = await deleteSpot(json('http://localhost/api/admin/delete-spot', { spot_id: SPOT }));
    expect(res.status).toBe(500);
    expect(mock.ops).not.toContain('spots:delete');
  });
});

describe('admin pending-photos', () => {
  it('waits for XP and reports a failure instead of losing it', async () => {
    mock.results = [ok([{ id: PHOTO }]), ok({ contribution_id: null, uploaded_by: 'u', spot_id: SPOT })];
    mock.xp.mockRejectedValue(new Error('xp down'));
    const res = await pendingPhotos(json('http://localhost/api/admin/pending-photos', { photo_id: PHOTO, action: 'approve' }));
    const body = await res!.json();
    expect(mock.xp).toHaveBeenCalled();
    expect(body.warnings).toContain('XP non assegnati');
  });
});

describe('swipe', () => {
  it('rejects a spot id that is not a UUID before touching the database', async () => {
    const res = await swipe(json('http://localhost/api/swipe', { spotId: 'not-a-uuid', direction: 'like' }));
    expect(res.status).toBe(400);
    expect(mock.ops).toEqual([]);
  });
  it('refuses to like a spot that is not approved', async () => {
    mock.results = [ok(null)];
    const res = await swipe(json('http://localhost/api/swipe', { spotId: SPOT, direction: 'like' }));
    expect(res.status).toBe(404);
    expect(mock.ops).toEqual(['spots:select']);
  });
});

describe('profile avatar', () => {
  it('rejects an external avatar url', async () => {
    const res = await profile(json('http://localhost/api/profile', { avatar_url: 'https://tracker.example/pixel.gif' }));
    expect(res.status).toBe(422);
    expect(mock.ops).toEqual([]);
  });
  it('accepts an avatar this user uploaded through the site', async () => {
    mock.results = [ok()];
    const res = await profile(json('http://localhost/api/profile', { avatar_url: 'https://x.supabase.co/storage/v1/object/public/spot-photos/uploads/user-1_1700000000000_ab12cd34.jpg' }));
    expect(res.status).toBe(200);
  });
  it('rejects an avatar uploaded by someone else', async () => {
    const res = await profile(json('http://localhost/api/profile', { avatar_url: 'https://x.supabase.co/storage/v1/object/public/spot-photos/uploads/user-2_1700000000000.jpg' }));
    expect(res.status).toBe(422);
  });
});

describe('spot-photos limits', () => {
  it('counts the photos in the request, not only those already saved', async () => {
    const fd = new FormData();
    fd.append('spot_id', SPOT);
    fd.append('access_token', 't');
    for (let i = 0; i < 3; i++) fd.append(`photo_${i}`, new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], `p${i}.jpg`, { type: 'image/jpeg' }));
    // spot approvato, 2 foto gia' sullo spot: 2 + 3 > 3
    mock.results = [ok({ id: SPOT }), ok(null, { count: 2 })];
    const res = await spotPhotos(new NextRequest('http://localhost/api/spot-photos', { method: 'POST', headers: { Authorization: 'Bearer t' }, body: fd }));
    expect(res.status).toBe(429);
    expect(mock.ops).not.toContain('spot_photos:insert');
  });
});

describe('admin upload-photo', () => {
  it('does not report a photo as uploaded when its database row fails, and removes the file', async () => {
    const fd = new FormData();
    fd.append('spot_id', SPOT);
    fd.append('photo_0', new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])], 'a.jpg', { type: 'image/jpeg' }));
    mock.results = [ok([]), bad];
    const res = await adminUpload(new NextRequest('http://localhost/api/admin/upload-photo', { method: 'POST', body: fd }));
    expect(res.status).toBe(400);
    expect(mock.storageRemove).toHaveBeenCalled();
  });
});
