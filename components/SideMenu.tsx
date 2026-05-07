'use client';

import { useEffect, useState } from 'react';
import { LINKS, APP_CONFIG } from '@/lib/constants';
import { useUser } from '@/hooks/useUser';
import { signOut } from '@/lib/auth-client';

interface SideMenuProps {
  open:        boolean;
  onClose:     () => void;
  onOpenAuth?: () => void;
}

const MENU_ITEMS = [
  { href: '/map',      label: 'Mappa',    emoji: '🗺️' },
  { href: '/events',   label: 'Eventi',   emoji: '📅' },
  { href: '/news',       label: 'News',       emoji: '📰' },
  { href: '/cerca-spot', label: 'Cerca Spot', emoji: '📍' },
  { href: '/sessioni',  label: 'Sessioni',   emoji: '🔴' },
  { divider: true },
  { href: LINKS.youtube,   label: 'Tutorial',    emoji: '▶️', external: true },
  { href: '/map/support',  label: 'Supporta',    emoji: '☕' },
  { href: '/map/about',    label: 'Chi siamo',   emoji: '🏴' },
];

export default function SideMenu({ open, onClose, onOpenAuth }: SideMenuProps) {
  const user = useUser();
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 59, backdropFilter: 'blur(2px)' }}
          aria-hidden="true"
        />
      )}

      <nav
        role="dialog"
        aria-modal="true"
        aria-label="Menu principale"
        style={{
          position: 'fixed',
          top: 0, left: 0, bottom: 0,
          width: 280,
          background: 'var(--gray-800)',
          borderRight: '1px solid var(--gray-700)',
          zIndex: 60,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          display: 'flex', flexDirection: 'column',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-700)' }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--orange)' }}>{APP_CONFIG.siteName}</div>
          </div>

          {/* User section */}
          {user === undefined ? (
            <div style={{ height: 40 }} />
          ) : user ? (
            /* Loggato */
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <a href={`/u/${user.username}`} onClick={onClose} style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 18, color: '#000', textDecoration: 'none', flexShrink: 0 }}>
                {user.username[0].toUpperCase()}
              </a>
              <div style={{ flex: 1, minWidth: 0 }}>
                <a href={`/u/${user.username}`} onClick={onClose} style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  @{user.username}
                </a>
                <button onClick={() => { signOut(); onClose(); }} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                  Esci →
                </button>
              </div>
            </div>
          ) : (
            /* Non loggato */
            <button
              onClick={() => { onOpenAuth?.(); onClose(); }}
              style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 14, background: 'rgba(255,106,0,0.1)', border: '1px solid rgba(255,106,0,0.3)', borderRadius: 6, color: 'var(--orange)', padding: '10px 14px', cursor: 'pointer', textAlign: 'left' }}
            >
              🔑 Accedi / Registrati
            </button>
          )}
        </div>

        {/* Voci */}
        <ul style={{ listStyle: 'none', flex: 1, padding: '8px 0', margin: 0 }}>
          {MENU_ITEMS.map((item, idx) => {
            if ('divider' in item) {
              return <li key={idx}><div style={{ height: 1, background: 'var(--gray-700)', margin: '8px 20px' }} /></li>;
            }
            return (
              <li key={item.href}>
                <a
                  href={item.href}
                  target={'external' in item && item.external ? '_blank' : undefined}
                  rel={'external' in item && item.external ? 'noopener noreferrer' : undefined}
                  onClick={'external' in item && item.external ? undefined : onClose}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 20px', color: 'var(--bone)', textDecoration: 'none',
                    fontFamily: 'var(--font-mono)', fontSize: 18, letterSpacing: '0.03em',
                    transition: 'background 0.1s, color 0.1s',
                    borderLeft: '3px solid transparent',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--gray-700)';
                    (e.currentTarget as HTMLElement).style.borderLeftColor = 'var(--orange)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--orange)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = '';
                    (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--bone)';
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: 20, minWidth: 28 }}>{item.emoji}</span>
                  <span>{item.label}</span>
                  {'external' in item && item.external && (
                    <span style={{ marginLeft: 'auto', color: 'var(--gray-400)', fontSize: 13 }}>↗</span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>

        {/* Spot Radar toggle */}
        <SpotRadarToggle />

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--gray-700)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', lineHeight: 1.6 }}>
          <div>Chrispy Maps v1.0 — BETA</div>
          <div>Community BMX Italia</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
            <a href="/privacy" style={{ color: 'var(--orange)', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="/map/about" style={{ color: 'var(--gray-500)', textDecoration: 'none' }}>Contatti</a>
          </div>
        </div>
      </nav>
    </>
  );
}

/* ── Spot Radar Toggle ── */
const RADAR_KEY = 'cmaps_radar_enabled';

function SpotRadarToggle() {
  const [enabled, setEnabled] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    try { setEnabled(localStorage.getItem(RADAR_KEY) === '1'); } catch {}
  }, []);

  const toggle = async () => {
    if (enabled) {
      // Turn off
      try { localStorage.setItem(RADAR_KEY, '0'); } catch {}
      setEnabled(false);
      return;
    }

    // Turn on — check geolocation permission
    if (!('geolocation' in navigator)) {
      setDenied(true);
      return;
    }

    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 30 * 60 * 1000,
        });
      });
      try { localStorage.setItem(RADAR_KEY, '1'); } catch {}
      setEnabled(true);
      setDenied(false);
    } catch {
      setDenied(true);
    }
  };

  const hasGeo = typeof window !== 'undefined' && 'geolocation' in navigator;
  if (!hasGeo) return null;

  return (
    <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gray-700)' }}>
      <button
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          width: '100%', background: 'none', border: 'none',
          padding: 0, cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 20, minWidth: 28 }}>📡</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)' }}>
            Spot Radar
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)', marginTop: 2 }}>
            Avvisami quando ci sono spot vicini
          </div>
        </div>
        <div style={{
          width: 38, height: 20, borderRadius: 10,
          background: enabled ? 'var(--orange)' : 'var(--gray-600)',
          position: 'relative', transition: 'background 0.2s',
          flexShrink: 0,
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: '50%',
            background: '#fff',
            position: 'absolute', top: 2,
            left: enabled ? 20 : 2,
            transition: 'left 0.2s',
          }} />
        </div>
      </button>
      {denied && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#ff4444', marginTop: 6 }}>
          Abilita la posizione nel browser per usare Spot Radar.
        </div>
      )}
    </div>
  );
}
