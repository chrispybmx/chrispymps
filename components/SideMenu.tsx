'use client';
import { SESSION_INVITES_PUBLIC } from '@/lib/session-invites';
import MapIcon from './MapIcon';
import { useLanguage } from './LanguageProvider';
import LanguageSwitch from './LanguageSwitch';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import { useRef } from 'react';

import { useEffect, useState } from 'react';
import { LINKS, APP_CONFIG } from '@/lib/constants';
import { useUser } from '@/hooks/useUser';
import { signOut } from '@/lib/auth-client';

interface SideMenuProps {
  open:        boolean;
  onClose:     () => void;
  onOpenAuth?: () => void;
}

/* Sfoglia e Preferiti stavano solo nella BottomNav, che sopra i 768px e'
   display:none — quindi da desktop erano irraggiungibili, e da mobile il
   cuore sulle card della mappa salvava in una cartella che dalla mappa non
   si poteva aprire. */
const MENU_ITEMS = [
  { href: '/map',      label: 'Mappa', labelEn: 'Map',    emoji: '🗺️' },
  { href: '/sfoglia',   label: 'Sfoglia', labelEn: 'Browse',   emoji: '🃏' },
  { href: '/preferiti', label: 'Preferiti', labelEn: 'Saved spots', emoji: '❤️' },
  ...(SESSION_INVITES_PUBLIC ? [{ href: '/messaggi', label: 'Messaggi', labelEn: 'Messages', emoji: '' }] : []),
  { href: '/events',   label: 'Eventi', labelEn: 'Events',   emoji: '📅' },
  { href: '/news',       label: 'News', labelEn: 'News',       emoji: '📰' },
  { href: '/classifica', label: 'Classifica', labelEn: 'Leaderboard', emoji: '🏆' },
  { href: '/cerca-spot', label: 'Cerca Spot', labelEn: 'Find spots', emoji: '📍' },
  { href: '/sessioni',  label: 'Sessioni', labelEn: 'Sessions',   emoji: '🔴', liveOnly: true },
  { divider: true },
  { href: LINKS.youtube,   label: 'Tutorial', labelEn: 'Tutorials',    emoji: '▶️', external: true },
  { href: '/map/support',  label: 'Supporta', labelEn: 'Support',    emoji: '☕' },
  { href: '/map/about',    label: 'Chi siamo', labelEn: 'About',   emoji: '🏴' },
];

export default function SideMenu({ open, onClose, onOpenAuth }: SideMenuProps) {
  const { text } = useLanguage();
  const user = useUser();
  const menuRef = useRef<HTMLElement>(null);
  useDialogFocus(open, menuRef, onClose);

  /* ── Rider in sessione adesso ──
     Le sessioni scadono dopo 3 ore, quindi lo stato normale della sezione è
     "vuota": una voce di menu che porta sempre a una pagina vuota comunica che
     l'app non la usa nessuno. La mostriamo solo quando c'è davvero qualcuno
     fuori, e in quel caso il numero diventa il messaggio. */
  const [liveRiders, setLiveRiders] = useState<number | null>(null);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch('/api/sessions')
      .then(r => r.json())
      .then((j: { ok: boolean; data?: { riders: { username: string }[] }[] }) => {
        if (cancelled || !j.ok) return;
        const total = (j.data ?? []).reduce((n, g) => n + (g.riders?.length ?? 0), 0);
        setLiveRiders(total);
      })
      .catch(() => { if (!cancelled) setLiveRiders(0); });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!open) return null;
  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 59, backdropFilter: 'none' }}
          aria-hidden="true"
        />
      )}

      <nav ref={menuRef}
        role="dialog"
        aria-modal="true"
        aria-label={text('Menu principale', 'Main menu')}
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
          overflowY: 'auto', overscrollBehavior: 'contain',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <button className="cm-menu-close cm-icon-button" onClick={onClose} aria-label={text('Chiudi menu', 'Close menu')}><MapIcon name="close" /></button>
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
                <button onClick={() => { signOut(); onClose(); }} style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                  {text('Esci', 'Sign out')} →
                </button>
              </div>
            </div>
          ) : (
            /* Non loggato */
            <button
              onClick={() => { onOpenAuth?.(); onClose(); }}
              style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 14, background: 'rgba(255,106,0,0.1)', border: '1px solid rgba(255,106,0,0.3)', borderRadius: 6, color: 'var(--orange)', padding: '10px 14px', cursor: 'pointer', textAlign: 'left' }}
            >
              {text('Accedi / Registrati', 'Sign in / Register')}
            </button>
          )}
        </div>

        {/* Voci */}
        <ul style={{ listStyle: 'none', flex: 1, padding: '8px 0', margin: 0 }}>
          {MENU_ITEMS.map((item, idx) => {
            if ('divider' in item) {
              return <li key={idx}><div style={{ height: 1, background: 'var(--gray-700)', margin: '8px 20px' }} /></li>;
            }
            /* Voce viva solo quando c'è qualcosa da vedere. */
            if ('liveOnly' in item && item.liveOnly && !liveRiders) return null;
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

                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--gray-700)';

                    (e.currentTarget as HTMLElement).style.color = 'var(--orange)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = '';

                    (e.currentTarget as HTMLElement).style.color = 'var(--bone)';
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: 20, minWidth: 28 }}><MapIcon name={({ Messaggi: 'message', Mappa: 'layers', Sfoglia: 'photo', Preferiti: 'heart', Eventi: 'calendar', News: 'news', Classifica: 'trophy', Tutorial: 'play' } as Record<string,string>)[item.label] ?? 'pin'} /></span>
                  <span>{text(item.label, item.labelEn)}</span>
                  {'liveOnly' in item && item.liveOnly && !!liveRiders && (
                    <span style={{
                      marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 14,
                      color: '#000', background: '#ff3b30', borderRadius: 10,
                      padding: '2px 8px', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                    }}>
                      {liveRiders} {text('ORA', 'NOW')}
                    </span>
                  )}
                  {'external' in item && item.external && (
                    <span style={{ marginLeft: 'auto', color: 'var(--gray-400)', fontSize: 13 }}>↗</span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gray-700)' }}><div style={{ fontSize: 14, color: 'var(--gray-400)', marginBottom: 8 }}>{text('Lingua', 'Language')}</div><LanguageSwitch /></div>

        {/* Spot Radar toggle */}
        <SpotRadarToggle />

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--gray-700)', fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', lineHeight: 1.6 }}>
          <div>Chrispy Maps v1.0 — BETA</div>
          <div>{text('Community BMX, skate e scooter', 'BMX, skate and scooter community')}</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="/regole" style={{ color: 'var(--orange)', textDecoration: 'none' }}>{text('Regole', 'Community rules')}</a>
            <a href="/privacy" style={{ color: 'var(--orange)', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="/map/about" style={{ color: 'var(--gray-500)', textDecoration: 'none' }}>{text('Contatti', 'Contact')}</a>
          </div>
        </div>
      </nav>
    </>
  );
}

/* ── Spot Radar Toggle ── */
const RADAR_KEY = 'cmaps_radar_enabled';

function SpotRadarToggle() {
  const { text } = useLanguage();
  const [enabled, setEnabled] = useState(false);
  const [denied, setDenied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  const hasGeo = mounted && 'geolocation' in navigator;
  if (!hasGeo) return null;

  return (
    <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gray-700)' }}>
      <button
        onClick={toggle}
        aria-pressed={enabled}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          width: '100%', background: 'none', border: 'none',
          padding: 0, cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 20, minWidth: 28 }}><MapIcon name="pin" /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)' }}>
            Spot Radar
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-500)', marginTop: 2 }}>
            {text('Avvisami quando ci sono spot vicini', 'Let me know when spots are nearby')}
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
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#ff4444', marginTop: 6 }}>
          {text('Abilita la posizione nel browser per usare Spot Radar.', 'Enable location access in your browser to use Spot Radar.')}
        </div>
      )}
    </div>
  );
}
