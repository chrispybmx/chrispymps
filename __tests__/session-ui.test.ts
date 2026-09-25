import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeSessionInvites, mergeSessionMessages, sessionDateISO, sessionStatus } from '../app/messaggi/helpers';
import type { SessionInvite, SessionMessage } from '@/lib/session-invites';

const message = (id: number, inviteId = 'open-thread'): SessionMessage => ({ id, invite_id: inviteId, sender_id: 'rider', body: `Messaggio ${id}`, client_id: String(id), created_at: '2026-09-26T10:00:00Z' });
const invite = (id: string, createdAt: string): SessionInvite => ({ id, sender_id: 'a', recipient_id: 'b', sender_username: 'alice', recipient_username: 'bob', sender_avatar: null, recipient_avatar: null, spot_id: 's', spot_name: 'Spot', spot_slug: 'spot', spot_city: null, starts_at: '2026-09-26T12:00:00Z', time_zone: 'Europe/Rome', note: '', status: 'pending', created_at: createdAt, updated_at: createdAt, unread: true });

describe('session invitation local dates', () => {
  const previousZone = process.env.TZ;
  beforeEach(() => { process.env.TZ = 'Europe/Rome'; });
  afterEach(() => { if (previousZone) process.env.TZ = previousZone; else delete process.env.TZ; });

  it('converts the rider’s local appointment to an absolute UTC instant', () => {
    expect(sessionDateISO('2026-09-26', '18:30', Date.parse('2026-09-25T00:00:00Z'))).toBe('2026-09-26T16:30:00.000Z');
  });
  it('does not silently move an appointment into the next month', () => {
    expect(() => sessionDateISO('2026-02-30', '12:00', Date.parse('2026-02-01T00:00:00Z'))).toThrow('Questo orario non esiste');
  });
  it('rejects an hour skipped by the daylight-saving transition', () => {
    expect(() => sessionDateISO('2026-03-29', '02:30', Date.parse('2026-03-01T00:00:00Z'))).toThrow('Questo orario non esiste');
  });
  it('rejects elapsed dates and appointments more than 90 days away', () => {
    expect(() => sessionDateISO('2026-09-24', '12:00', Date.parse('2026-09-25T00:00:00Z'))).toThrow('futuro');
    expect(() => sessionDateISO('2027-09-25', '12:00', Date.parse('2026-09-25T00:00:00Z'))).toThrow('90 giorni');
  });
});

describe('private thread state', () => {
  it('discards late responses belonging to another thread', () => {
    expect(mergeSessionMessages([message(1)], [message(2, 'other-thread'), message(3)], 'open-thread').map(row => row.id)).toEqual([1, 3]);
  });
  it('merges overlapping send and poll responses without duplicates, ordered chronologically', () => {
    expect(mergeSessionMessages([message(5), message(6)], [message(3), message(5)], 'open-thread').map(row => row.id)).toEqual([3, 5, 6]);
  });
  it('refreshes inbox status without discarding previously paginated invitations', () => {
    const old = invite('old', '2026-09-20T10:00:00Z');
    const latest = invite('latest', '2026-09-25T10:00:00Z');
    expect(mergeSessionInvites([old, latest], [{ ...latest, status: 'accepted', unread: false }])).toEqual([{ ...latest, status: 'accepted', unread: false }, old]);
  });
  it('expires a pending invitation locally without closing an accepted chat', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-27T10:00:00Z'));
    const row = invite('id', '2026-09-25T10:00:00Z');
    expect(sessionStatus(row)).toBe('expired');
    expect(sessionStatus({ ...row, status: 'accepted' })).toBe('accepted');
    vi.useRealTimers();
  });
});
