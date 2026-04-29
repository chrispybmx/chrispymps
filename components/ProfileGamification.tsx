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

interface Badge {
  badge_key: string;
  awarded_at: string;
  badges?: { name: string; description: string; emoji: string; category: string } | null;
}

interface XPEvent {
  event_type: string;
  xp_amount: number;
  reason: string;
  created_at: string;
  spot_id?: string;
  spots?: { name: string; slug: string } | null;
}

interface Stats {
  lifetime_xp: number;
  monthly_xp: number;
  current_level: string;
  trust_score: number;
  approved_spots_count: number;
  approved_photos_count: number;
  status_confirmations_count: number;
  current_streak_weeks: number;
}

interface Props {
  username: string;
}

export default function ProfileGamification({ username }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [recentXP, setRecentXP] = useState<XPEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetch(`/api/user-stats?username=${encodeURIComponent(username)}`)
      .then(r => r.json())
      .then(j => {
        if (j.ok) {
          setStats(j.data.stats);
          setBadges(j.data.badges);
          setRecentXP(j.data.recentXP);
        }
      })
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-500)' }}>
        Caricamento stats...
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const level = getLevelInfo(stats.lifetime_xp);

  /* Trust label */
  const trustLabel = stats.trust_score >= 85 ? 'Trusted Mapper' :
    stats.trust_score >= 70 ? 'Trusted' :
    stats.trust_score >= 40 ? 'Attivo' : 'Nuovo';

  return (
    <div style={{ borderTop: '1px solid var(--gray-700)', paddingTop: 20, marginTop: 4 }}>

      {/* ── LEVEL + XP BAR ── */}
      <div style={{
        background: 'var(--gray-800)', border: '1px solid var(--gray-700)',
        borderRadius: 10, padding: '16px', marginBottom: 16,
      }}>
        {/* Level badge image + name + XP */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          {/* Badge image */}
          <img
            src={level.current.image}
            alt={level.current.name}
            style={{ width: 64, height: 64, objectFit: 'contain', flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 17, color: 'var(--orange)', fontWeight: 700 }}>
              {level.current.name}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
              {trustLabel} · Lv.{LEVELS.length - LEVELS.indexOf(level.current)}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, color: 'var(--bone)', lineHeight: 1 }}>
              {stats.lifetime_xp}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)', textTransform: 'uppercase' }}>
              XP
            </div>
          </div>
        </div>

        {/* Progress bar to next level */}
        {level.next && (
          <div>
            <div style={{
              height: 8, background: 'var(--gray-700)', borderRadius: 4,
              overflow: 'hidden', marginBottom: 6,
            }}>
              <div style={{
                height: '100%', width: `${level.progress}%`,
                background: 'linear-gradient(90deg, var(--orange), #ffce4d)',
                borderRadius: 4,
                transition: 'width 0.5s ease-out',
              }} />
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)',
            }}>
              <span>{stats.lifetime_xp} XP</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <img src={level.next.image} alt={level.next.name} style={{ width: 18, height: 18, objectFit: 'contain' }} />
                <span>{level.next.name} — {level.nextThreshold} XP</span>
              </div>
            </div>
          </div>
        )}

        {/* Monthly XP */}
        {stats.monthly_xp > 0 && (
          <div style={{
            marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--gray-700)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>
              XP questo mese
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--orange)' }}>
              +{stats.monthly_xp}
            </span>
          </div>
        )}
      </div>

      {/* ── BADGES ── */}
      {badges.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
          }}>
            🏅 Badge ({badges.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {badges.map(b => (
              <div key={b.badge_key} title={b.badges?.description ?? ''} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px',
                background: 'var(--gray-800)', border: '1px solid var(--gray-700)',
                borderRadius: 20,
              }}>
                <span style={{ fontSize: 16 }}>{b.badges?.emoji ?? '🏅'}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--bone)' }}>
                  {b.badges?.name ?? b.badge_key}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RECENT XP HISTORY ── */}
      {recentXP.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(h => !h)}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 0, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            📊 Attività recente {showHistory ? '▴' : '▾'}
          </button>

          {showHistory && (
            <div style={{
              background: 'var(--gray-800)', border: '1px solid var(--gray-700)',
              borderRadius: 8, overflow: 'hidden',
            }}>
              {recentXP.slice(0, 10).map((ev, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderBottom: i < recentXP.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--bone)' }}>
                      {ev.reason}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)', marginTop: 2 }}>
                      {ev.spots?.name ? `📍 ${ev.spots.name} · ` : ''}
                      {new Date(ev.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                    color: ev.xp_amount > 0 ? '#00c851' : '#ff4444',
                    flexShrink: 0, marginLeft: 12,
                  }}>
                    {ev.xp_amount > 0 ? '+' : ''}{ev.xp_amount} XP
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
