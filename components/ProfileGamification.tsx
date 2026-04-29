'use client';

import { useState, useEffect } from 'react';

/* ── 7 Levels (must match lib/xp.ts) ── */
const LEVELS = [
  { threshold: 2500, name: 'Chrispy Scout',  image: '/badges/level-7-chrispy-scout.png' },
  { threshold: 1000, name: 'City Legend',     image: '/badges/level-6-city-legend.png' },
  { threshold: 500,  name: 'Verified Rider',  image: '/badges/level-5-verified-rider.png' },
  { threshold: 200,  name: 'Local Scout',     image: '/badges/level-4-local-scout.png' },
  { threshold: 75,   name: 'Spot Hunter',     image: '/badges/level-3-spot-hunter.png' },
  { threshold: 25,   name: 'Local Rider',     image: '/badges/level-2-local-rider.png' },
  { threshold: 0,    name: 'Rookie',          image: '/badges/level-1-rookie.png' },
];

function getLevelInfo(xp: number) {
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].threshold) {
      const current = LEVELS[i];
      const next = i > 0 ? LEVELS[i - 1] : null;
      const prevThreshold = current.threshold;
      const nextThreshold = next?.threshold ?? current.threshold;
      const progress = next
        ? Math.min(100, ((xp - prevThreshold) / (nextThreshold - prevThreshold)) * 100)
        : 100;
      return { current, next, nextThreshold, progress };
    }
  }
  return { current: LEVELS[LEVELS.length - 1], next: LEVELS[LEVELS.length - 2], nextThreshold: 25, progress: 0 };
}

interface Stats {
  lifetime_xp: number;
  current_level: string;
}

interface Props {
  username: string;
}

/**
 * Minimal gamification display for profile.
 * Shows only: badge image + level name + XP count.
 * Designed to sit in the top-right of the profile header.
 */
export default function ProfileGamification({ username }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/user-stats?username=${encodeURIComponent(username)}`)
      .then(r => r.json())
      .then(j => { if (j.ok) setStats(j.data.stats); })
      .finally(() => setLoading(false));
  }, [username]);

  if (loading || !stats) return null;

  const level = getLevelInfo(stats.lifetime_xp);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 2, minWidth: 56,
    }}>
      <img
        src={level.current.image}
        alt={level.current.name}
        title={`${level.current.name} — ${stats.lifetime_xp} XP`}
        style={{ width: 48, height: 48, objectFit: 'contain' }}
      />
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9,
        color: 'var(--orange)', textTransform: 'uppercase',
        letterSpacing: '0.04em', textAlign: 'center',
        lineHeight: 1.2,
      }}>
        {level.current.name}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9,
        color: 'var(--gray-500)',
      }}>
        {stats.lifetime_xp} XP
      </div>
    </div>
  );
}
