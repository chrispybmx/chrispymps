import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { TIPI_SPOT_SELEZIONABILI } from '@/lib/constants';

const mock = vi.hoisted(() => ({
  getUser: vi.fn(), profile: vi.fn(), insertSpot: vi.fn(), spot: vi.fn(),
  insertPhotos: vi.fn(), deleteSpot: vi.fn(), upload: vi.fn(), remove: vi.fn(),
  notify: vi.fn(), optimize: vi.fn(),
}));
const STORAGE = 'https://test.supabase.co/storage/v1/object/public/spot-photos/';

vi.mock('@/lib/email', () => ({ sendAdminNotification: mock.notify }));
vi.mock('@/lib/image', () => ({ optimizeImage: mock.optimize }));
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: () => ({
    auth: { getUser: mock.getUser },
    from: (table: string) => {
      if (table === 'profiles') return { select: () => ({ eq: () => ({ single: mock.profile }) }) };
      if (table === 'spots') return { insert: mock.insertSpot, delete: () => ({ eq: mock.deleteSpot }) };
      if (table === 'spot_photos') return { insert: mock.insertPhotos };
      throw new Error(`Unexpected table: ${table}`);
    },
    storage: { from: () => ({
      upload: mock.upload, remove: mock.remove,
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://test.supabase.co/storage/v1/object/public/spot-photos/${path}` } }),
    }) },
  }),
}));

let POST: typeof import('@/app/api/submit-spot/route').POST;
let uploadImage: typeof import('@/app/api/upload-image/route').POST;
beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  ({ POST } = await import('@/app/api/submit-spot/route'));
  ({ POST: uploadImage } = await import('@/app/api/upload-image/route'));
});
afterAll(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mock.getUser.mockResolvedValue({ data: { user: { id: 'rider-id', email: 'rider@example.com' } }, error: null });
  mock.profile.mockResolvedValue({ data: { username: 'rider' } });
  mock.insertSpot.mockReturnValue({ select: () => ({ single: mock.spot }) });
  mock.spot.mockResolvedValue({ data: { id: 'spot-id', slug: 'test-spot' }, error: null });
  mock.insertPhotos.mockResolvedValue({ error: null });
  mock.deleteSpot.mockResolvedValue({ error: null });
  mock.upload.mockResolvedValue({ error: null });
  mock.remove.mockResolvedValue({ error: null });
  mock.notify.mockResolvedValue(undefined);
  mock.optimize.mockResolvedValue({ buffer: Buffer.from('optimized'), ext: 'jpg', contentType: 'image/jpeg' });
});

const data = (patch = {}) => ({
  name: 'Test spot', type: 'street', lat: 45.4, lon: 11,
  city: 'Verona', photo_urls: [`${STORAGE}uploads/test.jpg`], access_token: 'test-token', ...patch,
});
const request = (body = data()) => new NextRequest('http://localhost/api/submit-spot', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])], { type: 'image/jpeg' });

describe('spot submission: no external services or real emails', () => {
  it.each(TIPI_SPOT_SELEZIONABILI.map(([type]) => type))('saves photos and notifies the admin for %s', async type => {
    const response = await POST(request(data({ type, ostacoli: ['rail'], country_code: 'it' })));
    expect(response.status).toBe(201);
    expect(mock.insertSpot).toHaveBeenCalledWith(expect.objectContaining({ type, status: 'pending', ostacoli: ['rail'], country_code: 'IT' }));
    expect(mock.insertPhotos).toHaveBeenCalledWith([expect.objectContaining({ spot_id: 'spot-id', url: `${STORAGE}uploads/test.jpg` })]);
    expect(mock.notify).toHaveBeenCalledOnce();
    expect(mock.insertPhotos.mock.invocationCallOrder[0]).toBeLessThan(mock.notify.mock.invocationCallOrder[0]);
  });

  it('waits for notification before completing the successful request', async () => {
    let complete!: () => void;
    mock.notify.mockImplementation(() => new Promise<void>(resolve => { complete = resolve; }));
    let settled = false;
    const response = POST(request()).then(result => { settled = true; return result; });
    await vi.waitFor(() => expect(mock.notify).toHaveBeenCalledOnce());
    expect(settled).toBe(false);
    complete();
    expect((await response).status).toBe(201);
  });

  it('keeps a saved spot when email delivery fails', async () => {
    mock.notify.mockRejectedValue(new Error('Resend unavailable'));
    expect((await POST(request())).status).toBe(201);
    expect(mock.deleteSpot).not.toHaveBeenCalled();
    expect(mock.remove).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('[submit-spot] admin notification:', expect.any(Error));
  });

  it('rolls back the spot and uploaded files when photo records fail', async () => {
    mock.insertPhotos.mockResolvedValue({ error: { message: 'database unavailable' } });
    expect((await POST(request())).status).toBe(500);
    expect(mock.remove).toHaveBeenCalledWith(['uploads/test.jpg']);
    expect(mock.deleteSpot).toHaveBeenCalledWith('id', 'spot-id');
    expect(mock.notify).not.toHaveBeenCalled();
  });

  it('rejects an invalid session before creating anything', async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });
    expect((await POST(request())).status).toBe(401);
    expect(mock.insertSpot).not.toHaveBeenCalled();
    expect(mock.notify).not.toHaveBeenCalled();
  });

  it.each([{ photo_urls: [] }, { type: 'inventata' }, { photo_urls: ['https://example.com/photo.jpg'] }])('rejects invalid input before storage writes: %j', async patch => {
    expect((await POST(request(data(patch)))).status).toBe(422);
    expect(mock.insertSpot).not.toHaveBeenCalled();
  });

  it('keeps the legacy multipart upload working', async () => {
    const form = new FormData();
    form.set('data', JSON.stringify(data({ photo_urls: undefined })));
    form.set('photo_0', jpeg(), 'photo.jpg');
    const response = await POST(new NextRequest('http://localhost/api/submit-spot', { method: 'POST', body: form }));
    expect(response.status).toBe(201);
    expect(mock.optimize).toHaveBeenCalledOnce();
    expect(mock.upload).toHaveBeenCalledWith('spot-id/0.jpg', Buffer.from('optimized'), { contentType: 'image/jpeg', upsert: true });
    expect(mock.insertPhotos).toHaveBeenCalledWith([expect.objectContaining({ url: `${STORAGE}spot-id/0.jpg` })]);
    expect(mock.notify).toHaveBeenCalledOnce();
  });

  it('does not leave an empty spot when every legacy upload fails', async () => {
    mock.upload.mockResolvedValue({ error: { message: 'storage unavailable' } });
    const form = new FormData();
    form.set('data', JSON.stringify(data({ photo_urls: undefined })));
    form.set('photo_0', jpeg(), 'photo.jpg');
    expect((await POST(new NextRequest('http://localhost/api/submit-spot', { method: 'POST', body: form }))).status).toBe(500);
    expect(mock.deleteSpot).toHaveBeenCalledWith('id', 'spot-id');
    expect(mock.notify).not.toHaveBeenCalled();
  });

  it('pre-upload produces a URL accepted by the spot submission endpoint', async () => {
    const form = new FormData();
    form.set('access_token', 'test-token');
    form.set('file', jpeg(), 'photo.jpg');
    const uploaded = await uploadImage(new NextRequest('http://localhost/api/upload-image', { method: 'POST', body: form }));
    expect(uploaded.status).toBe(200);
    const body = await uploaded.json();
    expect(body.url).toMatch(/^https:\/\/test\.supabase\.co\/storage\/v1\/object\/public\/spot-photos\/uploads\//);
    expect((await POST(request(data({ photo_urls: [body.url] })))).status).toBe(201);
    expect(mock.notify).toHaveBeenCalledOnce();
  });
});
