import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), single: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabasePublic: () => ({ from: mock.from }), supabaseAdmin: vi.fn() }));
import { GET } from '@/app/api/spots/[slug]/route';

beforeEach(() => {
  vi.clearAllMocks();
  const query = { select: mock.select, eq: mock.eq, single: mock.single };
  mock.from.mockReturnValue(query); mock.select.mockReturnValue(query); mock.eq.mockReturnValue(query);
});

describe('public spot detail security', () => {
  it('does not serialize internal columns or pending photos, even if returned by the database', async () => {
    mock.single.mockResolvedValue({ error: null, data: {
      id: 'spot', name: 'Park', reviewer_notes: 'PRIVATE', submitted_by: 'private-contributor', future_secret: 'PRIVATE',
      spot_photos: [
        { id: 'pending', url: 'hidden', position: 0, moderation_status: 'pending' },
        { id: 'rejected', url: 'hidden', position: 0, moderation_status: 'rejected' },
        { id: 'approved', url: 'visible', position: 2, moderation_status: 'approved', private_field: 'PRIVATE' },
        { id: 'legacy', url: 'old', position: 1, moderation_status: null },
      ],
    } });
    const res = await GET(new Request('https://maps.example/api/spots/park'), { params: Promise.resolve({ slug: 'park' }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.spot_photos.map((p: { id: string }) => p.id)).toEqual(['legacy', 'approved']);
    expect(JSON.stringify(body)).not.toMatch(/PRIVATE|hidden|reviewer_notes|submitted_by"|future_secret/);
    expect(mock.eq).toHaveBeenCalledWith('status', 'approved');
    expect(mock.select.mock.calls[0][0]).not.toContain('*');
  });

  it('does not disclose database errors for a missing or nonpublic spot', async () => {
    mock.single.mockResolvedValue({ data: null, error: { message: 'private database detail' } });
    const res = await GET(new Request('https://maps.example/api/spots/missing'), { params: Promise.resolve({ slug: 'missing' }) });
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('private database detail');
  });
});
