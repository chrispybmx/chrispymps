import { describe, expect, it } from 'vitest';
import { countStatusAgreement, latestStatusVotes, type StatusVote } from '@/lib/spot-status-consensus';

const NOW = new Date('2026-09-25T12:00:00Z');
const vote = (user: string | null, condition: StatusVote['condition'], days = 0, id = `${user}-${days}`): StatusVote => ({
  id, user_id: user, condition, created_at: new Date(NOW.getTime() - days * 86400000).toISOString(),
});
describe('distinct rider consensus', () => {
  it('cannot turn two reports by one rider on separate days into two riders', () => {
    expect(countStatusAgreement([vote('alice', 'bustato'), vote('alice', 'bustato', 2)], 'bustato', NOW)).toBe(1);
  });
  it('replaces an older matching vote with the rider’s latest different opinion', () => {
    const rows = [vote('alice', 'alive'), vote('bob', 'bustato', 1), vote('alice', 'bustato', 2)];
    expect(countStatusAgreement(rows, 'bustato', NOW)).toBe(1);
    expect(countStatusAgreement(rows, 'alive', NOW)).toBe(1);
  });
  it('counts two distinct authenticated riders independently', () => {
    expect(countStatusAgreement([vote('alice', 'demolito'), vote('bob', 'demolito', 1)], 'demolito', NOW)).toBe(2);
  });
  it('ignores removed/anonymous users, invalid dates, future rows and records outside 30 days', () => {
    const rows = [vote(null, 'bustato'), vote('', 'bustato'), vote('old', 'bustato', 31), vote('future', 'bustato', -1), { ...vote('invalid', 'bustato'), created_at: 'bad-date' }];
    expect(latestStatusVotes(rows, NOW)).toEqual([]);
  });
  it('includes the 30-day boundary and keeps the latest observation when rows are not ordered', () => {
    expect(countStatusAgreement([vote('alice', 'alive', 30), vote('bob', 'bustato', 4), vote('bob', 'alive', 1)], 'alive', NOW)).toBe(2);
  });
  it('preserves the database newest-first ordering when timestamps share JS millisecond precision', () => {
    const newer = { ...vote('alice', 'alive'), created_at: '2026-09-25T11:00:00.123999Z' };
    const older = { ...vote('alice', 'bustato'), created_at: '2026-09-25T11:00:00.123001Z' };
    expect(latestStatusVotes([newer, older], NOW)).toEqual([newer]);
  });
});
