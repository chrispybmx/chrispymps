import type { SpotCondition } from '@/lib/types';

export interface StatusVote {
  id: string;
  user_id: string | null;
  condition: SpotCondition;
  created_at: string;
}

const VALID_CONDITIONS = new Set<SpotCondition>(['alive', 'bustato', 'demolito']);
export const CONSENSUS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Rows arrive newest-first from PostgreSQL, including its timestamp precision.
 * A rider's latest observation replaces their previous opinion, even when it
 * disagrees. Anonymous/removed accounts never count as independent riders. */
export function latestStatusVotes(rows: StatusVote[], now = new Date()): StatusVote[] {
  const latest = new Map<string, StatusVote>();
  for (const row of rows) {
    const timestamp = Date.parse(row.created_at);
    if (!row.user_id || !VALID_CONDITIONS.has(row.condition) || !Number.isFinite(timestamp) ||
        timestamp > now.getTime() || timestamp < now.getTime() - CONSENSUS_WINDOW_MS) continue;
    const previous = latest.get(row.user_id);
    if (!previous || timestamp > Date.parse(previous.created_at)) latest.set(row.user_id, row);
  }
  return [...latest.values()];
}

export function countStatusAgreement(rows: StatusVote[], condition: SpotCondition, now = new Date()): number {
  return latestStatusVotes(rows, now).filter(row => row.condition === condition).length;
}
