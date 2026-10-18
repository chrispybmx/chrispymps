import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mock = vi.hoisted(() => ({ from: vi.fn(), row: {} as Record<string, unknown>, single: false }));
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: () => ({ from: mock.from }), supabaseServer: () => ({ from: mock.from }), supabasePublic: () => ({ from: mock.from }) }));
vi.mock('@/lib/email', () => ({ sendEventSubmissionNotification: vi.fn() }));
import { POST as batch } from '@/app/api/spots/by-ids/route';
import { GET as nearby } from '@/app/api/spots/nearby/route';
import { GET as detail } from '@/app/api/spots/[slug]/route';
import { POST as submitEvent } from '@/app/api/submit-event/route';

beforeEach(() => {
  vi.clearAllMocks(); mock.single = false;
  mock.row = { id: '00000000-0000-4000-8000-000000000001', slug: 'test', lat: 41, lon: 12,
    reviewer_notes: 'internal-note', submitted_by: 'private-contributor', spot_photos: [
      { url: 'pending.jpg', position: 0, moderation_status: 'pending' },
      { url: 'rejected.jpg', position: 1, moderation_status: 'rejected' },
      { url: 'approved.jpg', position: 3, moderation_status: 'approved' },
      { url: 'legacy.jpg', position: 2, moderation_status: null },
    ] };
  mock.from.mockImplementation(() => {
    const q: Record<string, any> = {};
    for (const method of ['select', 'eq', 'in', 'gte', 'lte', 'or']) q[method] = vi.fn(() => q);
    q.single = () => { mock.single = true; return q; };
    q.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: mock.single ? mock.row : [mock.row], error: null }).then(resolve);
    return q;
  });
});
afterEach(() => vi.restoreAllMocks());

const routes = [
  { name: 'by-ids', run: () => batch(new NextRequest('http://localhost/api/spots/by-ids', { method: 'POST', body: JSON.stringify({ ids: [mock.row.id] }) })) },
  { name: 'nearby', run: () => nearby(new NextRequest('http://localhost/api/spots/nearby?lat=41&lon=12')) },
  { name: 'detail', run: () => detail(new Request('http://localhost/api/spots/test'), { params: Promise.resolve({ slug: 'test' }) }) },
];
describe('public photo boundaries', () => {
  it.each(routes)('$name returns only approved and legacy photos in position order', async ({ run }) => {
    const response = await run(); const body = await response.json();
    expect(response.status).toBe(200);
    const row = Array.isArray(body.data) ? body.data[0] : body.data;
    expect(row.spot_photos.map((p: { url: string }) => p.url)).toEqual(['legacy.jpg', 'approved.jpg']);
    expect(JSON.stringify(body)).not.toMatch(/pending.jpg|rejected.jpg/);
  });
  it('detail removes internal fields even when the database returns them', async () => {
    const body = await (await routes[2].run()).json();
    expect(body.data).not.toHaveProperty('reviewer_notes');
    expect(body.data).not.toHaveProperty('submitted_by');
  });
  it.each(routes)('$name keeps a spot with no publishable photos', async ({ run }) => {
    mock.row.spot_photos = [{ url: 'pending.jpg', position: 0, moderation_status: 'pending' }];
    const body = await (await run()).json();
    const row = Array.isArray(body.data) ? body.data[0] : body.data;
    expect(row.id).toBe(mock.row.id); expect(row.spot_photos).toEqual([]);
  });
});
it('event validation never logs credentials or submitted content', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const response = await submitEvent(new NextRequest('http://localhost/api/submit-event', { method: 'POST', body: JSON.stringify({ title: 'x', access_token: 'synthetic-secret-token', description: 'private-description' }) }));
  expect(response.status).toBe(400);
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/synthetic-secret-token|private-description/);
  expect(mock.from).not.toHaveBeenCalled();
});
