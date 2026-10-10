import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const query = { select: vi.fn(), in: vi.fn(), eq: vi.fn() };
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: () => ({ from: () => query }) }));

import { POST } from '@/app/api/spots/by-ids/route';

const ID = '00000000-0000-4000-8000-000000000001';
const row = {
  id: ID, slug: 'park', name: 'Park', status: 'approved', reviewer_notes: 'nota interna', submitted_by: 'x@example.com',
  spot_photos: [
    { id: 'b', url: 'b.jpg', position: 2, credit_name: null, moderation_status: 'approved' },
    { id: 'a', url: 'a.jpg', position: 1, credit_name: 'Rider', moderation_status: null },
    { id: 'c', url: 'c.jpg', position: 0, credit_name: null, moderation_status: 'pending' },
  ],
};

describe('POST /api/spots/by-ids', () => {
  beforeEach(() => {
    query.select.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.eq.mockResolvedValue({ data: [row], error: null });
  });

  it('asks only for public columns and never returns moderation notes', async () => {
    const res = await POST(new NextRequest('http://localhost/api/spots/by-ids', { method: 'POST', body: JSON.stringify({ ids: [ID] }) }));
    const body = await res.json();
    expect(query.select.mock.calls[0][0]).not.toContain('*');
    expect(body.data[0]).not.toHaveProperty('reviewer_notes');
    expect(body.data[0]).not.toHaveProperty('submitted_by');
    expect(body.data[0].spot_photos.map((p: { id: string }) => p.id)).toEqual(['a', 'b']);
  });
});
