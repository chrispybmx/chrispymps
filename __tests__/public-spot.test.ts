import { describe, expect, it } from 'vitest';
import { toPublicSpot } from '@/lib/public-spot';

describe('toPublicSpot', () => {
  it('removes moderation notes and contributor id', () => {
    const row = {
      id: 'a', name: 'Spot', reviewer_notes: 'nota interna', submitted_by: 'contributor-uuid',
      submitted_by_user_id: 'user-uuid', submitted_by_username: 'rider',
    };

    const result = toPublicSpot(row);

    expect(result).not.toHaveProperty('reviewer_notes');
    expect(result).not.toHaveProperty('submitted_by');
  });

  it('keeps the fields the public spot page uses', () => {
    const row = { id: 'a', slug: 's', name: 'Spot', submitted_by_user_id: 'u', submitted_by_username: 'rider', spot_photos: [] };

    expect(toPublicSpot(row)).toEqual(row);
  });

  it('does not mutate the original row', () => {
    const row = { id: 'a', reviewer_notes: 'x' };

    toPublicSpot(row);

    expect(row.reviewer_notes).toBe('x');
  });
});
