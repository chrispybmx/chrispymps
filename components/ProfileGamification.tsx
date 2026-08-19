'use client';

import { useState, useEffect } from 'react';
import { getLevelInfo } from '@/lib/levels';

interface Stats {
  lifetime_xp: number;
  current_level: string;
  current_streak_weeks?: number;
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
  const isMaxLevel = !level.next;
  const streak = stats.current_streak_weeks ?? 0;

  // Streak color: >=12w orange, >=4w yellow, else gray
  const streakColor = streak >= 12 ? 'var(--orange)' : streak >= 4 ? '#f5c542' : 'var(--gray-500)';

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

      {/* Progress bar to next level */}
      <div style={{
        width: '100%', height: 3, borderRadius: 2,
        background: 'var(--gray-700)', marginTop: 3,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 2,
          width: `${level.progress}%`,
          background: 'var(--orange)',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Progress text */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 8,
        color: 'var(--gray-500)', textAlign: 'center',
        marginTop: 1, lineHeight: 1.3,
      }}>
        {isMaxLevel
          ? 'MAX'
          : `${stats.lifetime_xp}/${level.nextThreshold} → ${level.next!.name}`
        }
      </div>

      {/* Streak display */}
      {streak > 0 && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          color: streakColor, marginTop: 2,
          textAlign: 'center',
        }}>
          🔥 {streak}w streak
        </div>
      )}
    </div>
  );
}
