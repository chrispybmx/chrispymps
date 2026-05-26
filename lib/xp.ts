/**
 * XP Engine — Server-only
 * Awards XP, updates user_stats, checks badges.
 * All writes use supabaseAdmin (service role).
 */

import { supabaseAdmin } from './supabase';

/* ── XP Values (from spec) ── */
export const XP = {
  SPOT_APPROVED:           10,
  SPOT_FIRST_IN_CITY:      15, // bonus
  SPOT_FIRST_IN_PROVINCE:  25, // bonus (future)
  PHOTO_FIRST_ON_SPOT:      8,
  PHOTO_APPROVED:           4,
  PHOTO_COVER:              8, // bonus
  PHOTO_UPDATE_OLD:         6,
  STATUS_CONFIRMATION:      5,
  STATUS_OWNER_BONUS:       5, // spot owner gets XP when someone confirms
  LOCATION_CORRECTION:      8,
  INFO_IMPROVEMENT:         5,
  CORRECT_REPORT:           5,
} as const;

/* ── 7 Level thresholds (Fibonacci ×10 scaling, descending order for lookup) ── */
export const LEVELS: { threshold: number; name: string; key: string; image: string }[] = [
  { threshold: 6100, name: 'Chrispy Scout',  key: 'chrispy-scout',  image: '/badges/level-7-chrispy-scout.png' },
  { threshold: 2330, name: 'City Legend',     key: 'city-legend',     image: '/badges/level-6-city-legend.png' },
  { threshold: 890,  name: 'Verified Rider',  key: 'verified-rider',  image: '/badges/level-5-verified-rider.png' },
  { threshold: 340,  name: 'Local Scout',     key: 'local-scout',     image: '/badges/level-4-local-scout.png' },
  { threshold: 130,  name: 'Spot Hunter',     key: 'spot-hunter',     image: '/badges/level-3-spot-hunter.png' },
  { threshold: 50,   name: 'Local Rider',     key: 'local-rider',     image: '/badges/level-2-local-rider.png' },
  { threshold: 0,    name: 'Rookie',          key: 'rookie',          image: '/badges/level-1-rookie.png' },
];

function calculateLevel(xp: number): string {
  for (const level of LEVELS) {
    if (xp >= level.threshold) return level.name;
  }
  return 'Rookie';
}

export function getLevelInfo(xp: number) {
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].threshold) {
      const current = LEVELS[i];
      const next = i > 0 ? LEVELS[i - 1] : null;
      const prevThreshold = current.threshold;
      const nextThreshold = next?.threshold ?? current.threshold;
      const progress = next
        ? Math.min(100, ((xp - prevThreshold) / (nextThreshold - prevThreshold)) * 100)
        : 100;
      return { current, next, progress };
    }
  }
  return { current: LEVELS[LEVELS.length - 1], next: LEVELS[LEVELS.length - 2], progress: 0 };
}

/* ── Trust score changes ── */
const TRUST = {
  APPROVED_CONTRIBUTION:  1,
  SPOT_CONFIRMED_BY_OTHER: 2,
  CORRECT_REPORT:         2,
  TEN_APPROVED_STREAK:    5,
  REJECTED_SPOT:         -3,
  SPAM_PHOTO:            -2,
  FALSE_REPORT:          -5,
  ABUSE:                -15,
} as const;

/* ══════════════════════════════════════════
   CORE: Award XP
══════════════════════════════════════════ */

interface AwardXPParams {
  userId: string;
  spotId?: string;
  contributionId?: string;
  eventType: string;
  xpAmount: number;
  reason: string;
  metadata?: Record<string, unknown>;
}

interface AwardXPResult {
  leveledUp: boolean;
  newLevel?: string;
  xpAwarded: number;
  totalXp: number;
}

/**
 * Award XP to a user. Creates point_event + updates user_stats.
 * Idempotent: checks for duplicate events before inserting.
 * Returns level-up info so callers can react (toast, animation, etc.).
 */
export async function awardXP({
  userId, spotId, contributionId, eventType, xpAmount, reason, metadata,
}: AwardXPParams): Promise<AwardXPResult | false> {
  if (xpAmount === 0) return false;

  const sb = supabaseAdmin();

  // Prevent duplicate XP for same contribution
  if (contributionId) {
    const { count } = await sb
      .from('point_events')
      .select('id', { count: 'exact', head: true })
      .eq('contribution_id', contributionId)
      .eq('event_type', eventType);

    if ((count ?? 0) > 0) return false; // already awarded
  }

  // Capture old level before update
  const { data: oldStats } = await sb
    .from('user_stats')
    .select('current_level, lifetime_xp')
    .eq('user_id', userId)
    .maybeSingle();

  const oldLevel = oldStats?.current_level ?? 'Rookie';

  // 1. Insert point_event
  const { error: eventErr } = await sb.from('point_events').insert({
    user_id: userId,
    spot_id: spotId || null,
    contribution_id: contributionId || null,
    event_type: eventType,
    xp_amount: xpAmount,
    reason,
    metadata: metadata || {},
  });

  if (eventErr) {
    console.error('[XP] insert error:', eventErr);
    return false;
  }

  // 2. Update user_stats (upsert) — includes streak calculation
  await updateUserStats(userId);

  // 3. Check badges
  await checkAndAwardBadges(userId);

  // 4. Detect level-up
  const { data: newStats } = await sb
    .from('user_stats')
    .select('current_level, lifetime_xp')
    .eq('user_id', userId)
    .maybeSingle();

  const newLevel = newStats?.current_level ?? 'Rookie';
  const totalXp = newStats?.lifetime_xp ?? 0;

  return {
    leveledUp: newLevel !== oldLevel,
    newLevel: newLevel !== oldLevel ? newLevel : undefined,
    xpAwarded: xpAmount,
    totalXp,
  };
}

/* ══════════════════════════════════════════
   Update user_stats from point_events
══════════════════════════════════════════ */

/**
 * Get the ISO week number (Mon-Sun) for a given date.
 * Returns a string key "YYYY-WXX" for deduplication.
 */
function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number (Mon=1, Sun=7)
  const dayNum = d.getUTCDay() || 7; // Convert Sun=0 to 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Calculate streak: consecutive calendar weeks (Mon-Sun) with >= 1 point_event.
 * Current week is always included (grace period: week doesn't need to be complete).
 * Walks backwards from current week; streak breaks at first missing week.
 */
function calculateStreak(events: { created_at: string }[]): number {
  if (!events.length) return 0;

  // Collect unique week keys that have activity
  const activeWeeks = new Set<string>();
  for (const e of events) {
    activeWeeks.add(getISOWeekKey(new Date(e.created_at)));
  }

  // Walk backwards from current week
  const now = new Date();
  let streak = 0;
  let checkDate = new Date(now);

  while (true) {
    const weekKey = getISOWeekKey(checkDate);
    if (activeWeeks.has(weekKey)) {
      streak++;
      // Move back 7 days to previous week
      checkDate.setDate(checkDate.getDate() - 7);
    } else {
      // If we're on the very first check (current week) and it has no activity,
      // that's fine — the grace period means we don't break the streak yet.
      // Instead, check the previous week as the potential streak start.
      if (streak === 0) {
        // Current week has no activity — check if previous week starts a streak
        checkDate.setDate(checkDate.getDate() - 7);
        const prevWeekKey = getISOWeekKey(checkDate);
        if (activeWeeks.has(prevWeekKey)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 7);
          continue;
        }
      }
      break;
    }
  }

  return streak;
}

async function updateUserStats(userId: string) {
  const sb = supabaseAdmin();

  // Calculate totals from point_events
  const { data: events } = await sb
    .from('point_events')
    .select('xp_amount, created_at')
    .eq('user_id', userId);

  if (!events) return;

  const lifetimeXp = events.reduce((sum, e) => sum + e.xp_amount, 0);

  // Monthly XP (current month)
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthlyXp = events
    .filter(e => new Date(e.created_at) >= monthStart)
    .reduce((sum, e) => sum + e.xp_amount, 0);

  // Streak: consecutive weeks with activity
  const streakWeeks = calculateStreak(events);

  // Count contributions by type
  const { count: spotsCount } = await sb
    .from('spot_contributions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('contribution_type', 'new_spot')
    .eq('status', 'approved');

  const { count: photosCount } = await sb
    .from('spot_contributions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('contribution_type', 'photo')
    .eq('status', 'approved');

  const { count: statusCount } = await sb
    .from('spot_contributions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('contribution_type', 'status_confirmation')
    .eq('status', 'approved');

  const level = calculateLevel(lifetimeXp);

  // Upsert user_stats
  await sb.from('user_stats').upsert({
    user_id: userId,
    lifetime_xp: lifetimeXp,
    monthly_xp: monthlyXp,
    monthly_xp_reset_at: monthStart.toISOString(),
    current_level: level,
    current_streak_weeks: streakWeeks,
    approved_spots_count: spotsCount ?? 0,
    approved_photos_count: photosCount ?? 0,
    status_confirmations_count: statusCount ?? 0,
    last_active_contribution_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

/* ══════════════════════════════════════════
   Public read helpers
══════════════════════════════════════════ */

/**
 * Returns a lightweight XP summary for a user.
 * Reads from user_stats (no recalculation).
 */
export async function getXPSummary(userId: string): Promise<{ lifetime_xp: number; current_level: string }> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from('user_stats')
    .select('lifetime_xp, current_level')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    lifetime_xp: data?.lifetime_xp ?? 0,
    current_level: data?.current_level ?? 'Rookie',
  };
}

/* ══════════════════════════════════════════
   Update trust score
══════════════════════════════════════════ */

export async function adjustTrust(userId: string, delta: number, reason: string) {
  const sb = supabaseAdmin();

  const { data: stats } = await sb
    .from('user_stats')
    .select('trust_score')
    .eq('user_id', userId)
    .single();

  const current = stats?.trust_score ?? 50;
  const newScore = Math.min(100, Math.max(0, current + delta));

  await sb.from('user_stats').upsert({
    user_id: userId,
    trust_score: newScore,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

/* ══════════════════════════════════════════
   Badge checking
══════════════════════════════════════════ */

async function checkAndAwardBadges(userId: string) {
  const sb = supabaseAdmin();

  // Get user stats
  const { data: stats } = await sb
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!stats) return;

  // Get already earned badges
  const { data: earned } = await sb
    .from('user_badges')
    .select('badge_key')
    .eq('user_id', userId);

  const earnedKeys = new Set((earned ?? []).map(b => b.badge_key));

  // Check each badge
  const badgesToAward: string[] = [];

  // Cartografo badges
  if (stats.approved_spots_count >= 10 && !earnedKeys.has('cartografo_10'))
    badgesToAward.push('cartografo_10');
  if (stats.approved_spots_count >= 50 && !earnedKeys.has('cartografo_50'))
    badgesToAward.push('cartografo_50');
  if (stats.approved_spots_count >= 100 && !earnedKeys.has('cartografo_100'))
    badgesToAward.push('cartografo_100');

  // Documentarista
  if (stats.approved_photos_count >= 25 && !earnedKeys.has('documentarista'))
    badgesToAward.push('documentarista');

  // Photo Plug
  if (stats.approved_photos_count >= 100 && !earnedKeys.has('photo_plug'))
    badgesToAward.push('photo_plug');

  // Scout
  if (stats.status_confirmations_count >= 50 && !earnedKeys.has('scout'))
    badgesToAward.push('scout');

  // Spot Savior (10 status updates on old/damaged spots)
  if (stats.status_confirmations_count >= 10 && !earnedKeys.has('spot_savior'))
    badgesToAward.push('spot_savior');

  // Streak badges
  if (stats.current_streak_weeks >= 4 && !earnedKeys.has('streak_4'))
    badgesToAward.push('streak_4');
  if (stats.current_streak_weeks >= 12 && !earnedKeys.has('streak_12'))
    badgesToAward.push('streak_12');

  // Award badges
  for (const key of badgesToAward) {
    const { error } = await sb.from('user_badges').insert({
      user_id: userId,
      badge_key: key,
    });
    if (error) { /* ignore duplicate/unique constraint errors */ }
  }
}

/* ══════════════════════════════════════════
   Convenience functions for specific actions
══════════════════════════════════════════ */

/** Called when admin approves a new spot */
export async function onSpotApproved(userId: string, spotId: string, contributionId?: string, city?: string) {
  // Base XP
  await awardXP({
    userId, spotId, contributionId,
    eventType: 'spot_approved',
    xpAmount: XP.SPOT_APPROVED,
    reason: 'Spot approvato',
  });

  // First-in-city bonus
  if (city) {
    const sb = supabaseAdmin();
    const { count } = await sb
      .from('spots')
      .select('id', { count: 'exact', head: true })
      .eq('city', city)
      .eq('status', 'approved');

    if ((count ?? 0) <= 1) { // this is the first (or only) approved spot in this city
      await awardXP({
        userId, spotId,
        eventType: 'first_in_city',
        xpAmount: XP.SPOT_FIRST_IN_CITY,
        reason: `Primo spot in ${city}!`,
        metadata: { city },
      });
    }
  }

  // Trust boost
  await adjustTrust(userId, TRUST.APPROVED_CONTRIBUTION, 'spot_approved');
}

/** Called when admin approves a user photo */
export async function onPhotoApproved(userId: string, spotId: string, contributionId?: string) {
  const sb = supabaseAdmin();

  // Check if this is the first photo on the spot
  const { count } = await sb
    .from('spot_photos')
    .select('id', { count: 'exact', head: true })
    .eq('spot_id', spotId)
    .eq('moderation_status', 'approved');

  const isFirst = (count ?? 0) <= 1;
  const xp = isFirst ? XP.PHOTO_FIRST_ON_SPOT : XP.PHOTO_APPROVED;
  const reason = isFirst ? 'Prima foto sullo spot!' : 'Foto approvata';

  await awardXP({
    userId, spotId, contributionId,
    eventType: isFirst ? 'photo_first' : 'photo_approved',
    xpAmount: xp,
    reason,
  });

  await adjustTrust(userId, TRUST.APPROVED_CONTRIBUTION, 'photo_approved');
}

/** Called when user confirms spot status (auto-approved) */
export async function onStatusConfirmed(userId: string, spotId: string, contributionId?: string) {
  await awardXP({
    userId, spotId, contributionId,
    eventType: 'status_confirmation',
    xpAmount: XP.STATUS_CONFIRMATION,
    reason: 'Conferma stato spot',
  });

  // Bonus to spot owner
  const sb = supabaseAdmin();
  const { data: spot } = await sb
    .from('spots')
    .select('submitted_by_user_id')
    .eq('id', spotId)
    .single();

  if (spot?.submitted_by_user_id && spot.submitted_by_user_id !== userId) {
    // Check if owner already received bonus for this spot
    const { count } = await sb
      .from('point_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', spot.submitted_by_user_id)
      .eq('spot_id', spotId)
      .eq('event_type', 'status_owner_bonus');

    if ((count ?? 0) === 0) {
      await awardXP({
        userId: spot.submitted_by_user_id,
        spotId,
        eventType: 'status_owner_bonus',
        xpAmount: XP.STATUS_OWNER_BONUS,
        reason: 'Qualcuno ha confermato il tuo spot',
      });
    }
  }
}

/** Called when admin rejects content */
export async function onContentRejected(userId: string, type: 'spot' | 'photo') {
  const delta = type === 'spot' ? TRUST.REJECTED_SPOT : TRUST.SPAM_PHOTO;
  await adjustTrust(userId, delta, `${type}_rejected`);
}
