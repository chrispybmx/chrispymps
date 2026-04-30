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

/* ── 7 Level thresholds (descending order for lookup) ── */
export const LEVELS: { threshold: number; name: string; key: string; image: string }[] = [
  { threshold: 2500, name: 'Chrispy Scout',  key: 'chrispy-scout',  image: '/badges/level-7-chrispy-scout.png' },
  { threshold: 1000, name: 'City Legend',     key: 'city-legend',     image: '/badges/level-6-city-legend.png' },
  { threshold: 500,  name: 'Verified Rider',  key: 'verified-rider',  image: '/badges/level-5-verified-rider.png' },
  { threshold: 200,  name: 'Local Scout',     key: 'local-scout',     image: '/badges/level-4-local-scout.png' },
  { threshold: 75,   name: 'Spot Hunter',     key: 'spot-hunter',     image: '/badges/level-3-spot-hunter.png' },
  { threshold: 25,   name: 'Local Rider',     key: 'local-rider',     image: '/badges/level-2-local-rider.png' },
  { threshold: 0,    name: 'Rookie',          key: 'rookie',          image: '/badges/level-1-rookie.png' },
];

export function calculateLevel(xp: number): string {
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

/**
 * Award XP to a user. Creates point_event + updates user_stats.
 * Idempotent: checks for duplicate events before inserting.
 */
export async function awardXP({
  userId, spotId, contributionId, eventType, xpAmount, reason, metadata,
}: AwardXPParams): Promise<boolean> {
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

  // 2. Update user_stats (upsert)
  await updateUserStats(userId);

  // 3. Check badges
  await checkAndAwardBadges(userId);

  return true;
}

/* ══════════════════════════════════════════
   Update user_stats from point_events
══════════════════════════════════════════ */

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
    approved_spots_count: spotsCount ?? 0,
    approved_photos_count: photosCount ?? 0,
    status_confirmations_count: statusCount ?? 0,
    last_active_contribution_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
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
