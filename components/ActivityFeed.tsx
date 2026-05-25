'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ActivityItem {
  type: 'new_spot' | 'new_photo' | 'session';
  username: string;
  spotName: string;
  spotSlug: string;
  spotType?: string;
  time: string;
}

const TYPE_EMOJI: Record<string, string> = {
  new_spot: '\ud83d\udccd',
  new_photo: '\ud83d\udcf8',
  session: '\ud83d\udfe2',
};

const TYPE_LABEL: Record<string, string> = {
  new_spot: 'nuovo spot',
  new_photo: 'nuova foto',
  session: 'in session',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ora';
  if (mins < 60) return `${mins}m fa`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ieri';
  if (days < 7) return `${days}g fa`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w fa`;
}

export default function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/activity-feed')
      .then(r => r.json())
      .then(j => {
        if (j.ok && j.data?.length > 0) setItems(j.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Loading skeleton
  if (loading) {
    return (
      <div style={{ padding: '12px 12px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <div style={{
            width: 60, height: 14, borderRadius: 3,
            background: 'var(--gray-800)', animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        </div>
        <div style={{
          display: 'flex', gap: 8,
          overflowX: 'hidden',
        }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: 160, height: 72, flexShrink: 0,
              borderRadius: 8, background: 'var(--gray-800)',
              animation: 'pulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.15}s`,
            }} />
          ))}
        </div>
        <style>{`@keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>
      </div>
    );
  }

  // No data — don't render anything
  if (!items || items.length === 0) return null;

  return (
    <div style={{ padding: '12px 12px 4px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 8,
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', letterSpacing: '0.06em' }}>
          {'\ud83d\udce1'} LIVE
        </span>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#00c851',
          boxShadow: '0 0 6px #00c851',
          display: 'inline-block',
          animation: 'livePulse 2s ease-in-out infinite',
        }} />
      </div>

      {/* Scrollable strip */}
      <div style={{
        display: 'flex', gap: 8,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 8,
        maskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
      } as React.CSSProperties}>
        {items.map((item, i) => (
          <Link
            key={`${item.type}-${item.spotSlug}-${item.username}-${i}`}
            href={`/map/spot/${item.spotSlug}`}
            style={{ textDecoration: 'none', flexShrink: 0 }}
          >
            <div style={{
              width: 160, padding: '10px 12px',
              background: 'var(--gray-800)',
              border: '1px solid var(--gray-700)',
              borderRadius: 8,
              display: 'flex', flexDirection: 'column', gap: 4,
              transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--orange)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--gray-700)')}
            >
              {/* Type + time */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 14 }}>{TYPE_EMOJI[item.type]}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  color: 'var(--gray-600)',
                }}>
                  {timeAgo(item.time)}
                </span>
              </div>

              {/* Username */}
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: 'var(--orange)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                @{item.username}
              </div>

              {/* Action + spot name */}
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'var(--bone)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                lineHeight: 1.3,
              }}>
                {TYPE_LABEL[item.type]}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'var(--gray-400)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {item.spotName}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
