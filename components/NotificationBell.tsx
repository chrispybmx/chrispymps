'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SESSION_INVITES_PUBLIC } from '@/lib/session-invites';
import MapIcon from './MapIcon';

interface Notification {
  id:         string;
  type:       'spot_approved' | 'spot_rejected' | 'comment_on_spot' | 'comment_reply' | 'comment_like';
  title:      string;
  body:       string;
  spot_slug:  string | null;
  read:       boolean;
  created_at: string;
}

const TYPE_EMOJI: Record<string, string> = {
  spot_approved:   '✅',
  spot_rejected:   '❌',
  comment_on_spot: '💬',
  comment_reply:   '↩️',
  comment_like:    '❤️',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'adesso';
  if (m < 60) return `${m}m fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h fa`;
  return `${Math.floor(h / 24)}g fa`;
}

export default function NotificationBell({ token }: { token: string }) {
  const [open,          setOpen]          = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread,        setUnread]        = useState(0);
  const [sessionUnread, setSessionUnread] = useState(0);
  const totalUnread = unread + sessionUnread;
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let running = false;
    let controller: AbortController | null = null;
    setNotifications([]); setUnread(0); setSessionUnread(0);
    const refresh = async () => {
      if (document.hidden || running) return;
      running = true;
      controller = new AbortController();
      const options = { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' as const, signal: controller.signal };
      await Promise.allSettled([
        fetch('/api/notifications', options).then(r => r.json()).then(j => {
          if (active && j.ok) { setNotifications(j.data); setUnread(j.unreadCount); }
        }),
        ...(SESSION_INVITES_PUBLIC ? [
          fetch('/api/session-invites', options).then(r => r.json()).then(j => {
            if (active && j.ok) setSessionUnread(typeof j.unreadCount === 'number' ? j.unreadCount : j.data.filter((item: {unread:boolean}) => item.unread).length);
          }),
        ] : []),
      ]);
      running = false;
    };
    void refresh();
    const timer = setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; controller?.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [token]);

  /* Chiudi toccando/cliccando fuori dal dropdown — mousedown + touchstart per mobile */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler as EventListener);
    document.addEventListener('touchstart', handler as EventListener, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler as EventListener);
      document.removeEventListener('touchstart', handler as EventListener);
    };
  }, [open]);

  const handleOpen = useCallback(async () => {
    const wasOpen = open;
    setOpen(o => !o);

    /* Segna tutto come letto quando apre e ci sono non lette */
    if (!wasOpen && unread > 0) {
      try {
        const response = await fetch('/api/notifications', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        setUnread(0);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      } catch { /* silenzioso */ }
    }
  }, [open, unread, token]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 600;

  return (
    <div ref={dropRef} style={{ position: 'relative' }}>
      {/* ── Pulsante campanella ── */}
      <button
        onClick={handleOpen}
        aria-label={`Notifiche${totalUnread > 0 ? ` (${totalUnread} non lette)` : ''}`}
        style={{
          fontFamily: 'var(--font-mono)', fontSize: 18,
          padding: '0',
          width: 44, height: 44,
          border: `1px solid ${totalUnread > 0 ? 'rgba(255,106,0,0.7)' : 'transparent'}`,
          borderRadius: 4,
          background: totalUnread > 0 ? 'rgba(255,106,0,0.12)' : 'transparent',
          color: 'var(--bone)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          transition: 'border-color 0.2s, background 0.2s',
        } as React.CSSProperties}
      >
        <MapIcon name="bell" />
        {totalUnread > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            background: 'var(--orange)', color: '#000',
            borderRadius: 10, minWidth: 16, height: 16,
            fontSize: 9, fontWeight: 700, lineHeight: '16px',
            textAlign: 'center', padding: '0 3px',
            fontFamily: 'var(--font-mono)',
          }}>
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {/* ── Dropdown notifiche ── */}
      {open && (
        <div style={{
          position: 'fixed',
          top: 'calc(var(--topbar-height) + 50px)',
          right: 8,
          width: Math.min(340, (typeof window !== 'undefined' ? window.innerWidth : 340) - 16),
          maxHeight: '72vh',
          background: '#111',
          border: '1px solid var(--gray-600)',
          borderRadius: 10,
          zIndex: 300,
          overflowY: 'auto',
          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
        }}>

          {/* Header */}
          <div style={{
            padding: '13px 16px',
            borderBottom: '1px solid var(--gray-700)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            position: 'sticky', top: 0, background: '#111', zIndex: 1,
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: 'var(--orange)', letterSpacing: '0.08em',
            }}>
              🔔 NOTIFICHE
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'none', border: 'none',
                color: 'var(--gray-400)', cursor: 'pointer', fontSize: 18,
                lineHeight: 1, padding: '0 2px',
              }}
            >✕</button>
          </div>

          {SESSION_INVITES_PUBLIC && <a href="/messaggi" onClick={() => setOpen(false)} style={{display:'flex',alignItems:'center',gap:10,padding:'16px',minHeight:48,color:'var(--bone)',borderBottom:'1px solid var(--gray-700)',textDecoration:'none'}}>
            <MapIcon name="message" size={20} /><span>Inviti e messaggi{sessionUnread > 0 ? ` · ${sessionUnread} da leggere` : ''}</span>
          </a>}
          {/* Lista */}
          {notifications.length === 0 ? (
            <div style={{
              padding: '32px 16px', textAlign: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 13,
              color: 'var(--gray-500)',
            }}>
              Nessuna notifica ancora
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                style={{
                  padding: '13px 16px',
                  borderBottom: '1px solid var(--gray-800)',
                  background: !n.read ? 'rgba(255,106,0,0.04)' : 'transparent',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  transition: 'background 0.2s',
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
                  {TYPE_EMOJI[n.type] ?? '🔔'}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 13,
                    color: 'var(--bone)', marginBottom: 3, lineHeight: 1.4,
                  }}>
                    {n.title}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: 'var(--gray-400)', marginBottom: 6, lineHeight: 1.5,
                  }}>
                    {n.body}
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10,
                      color: 'var(--gray-600)',
                    }}>
                      {timeAgo(n.created_at)}
                    </span>
                    {n.spot_slug && (
                      <a
                        href={`/map/spot/${n.spot_slug}`}
                        onClick={() => setOpen(false)}
                        style={{
                          fontFamily: 'var(--font-mono)', fontSize: 10,
                          color: 'var(--orange)', textDecoration: 'none',
                          letterSpacing: '0.04em',
                        }}
                      >
                        VEDI SPOT →
                      </a>
                    )}
                  </div>
                </div>

                {/* Dot non letta */}
                {!n.read && (
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'var(--orange)', flexShrink: 0, marginTop: 5,
                  }} />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
