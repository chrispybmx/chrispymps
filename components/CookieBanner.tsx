'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { hasAnalyticsChoice } from '@/lib/analytics-consent';

export const COOKIE_KEY = 'cmaps_cookie_notice';
/** Emesso quando l'informativa viene chiusa: sblocca la coda dei popup. */
export const COOKIE_DISMISSED_EVENT = 'cmaps:cookie-dismissed';

/** Pagine che hanno BottomNav fisso in basso */
const PAGES_WITH_NAV = ['/map', '/classifica', '/scopri', '/sessioni', '/cerca-spot', '/preferiti', '/u/', '/impostazioni/privacy'];

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try { setVisible(!localStorage.getItem(COOKIE_KEY) && !hasAnalyticsChoice()); }
    catch { setVisible(true); }
  }, []);

  const dismiss = () => {
    // Acknowledging this notice never changes optional analytics consent.
    setVisible(false);
    try { localStorage.setItem(COOKIE_KEY, '1'); } catch {}
    /* L'onboarding resta in attesa di questo evento: due livelli sovrapposti
       tagliavano i bottoni della card di benvenuto sotto i 400px. */
    try { window.dispatchEvent(new Event(COOKIE_DISMISSED_EVENT)); } catch {}
  };

  if (!visible) return null;

  /* Sulle pagine con la bottom nav il banner sta SOPRA la nav, non la copre:
     prima nascondeva "Aggiungi spot" proprio alla prima visita. */
  const hasNav = PAGES_WITH_NAV.some(p => pathname?.startsWith(p)) || pathname === '/';

  return (
    <div className="cm-cookie" role="region" aria-label="Informativa privacy" data-nav={hasNav} style={{
      position: 'fixed', left: 0, right: 0, zIndex: 9999,
      background: 'var(--gray-800)', borderTop: '1px solid var(--gray-600)',
      padding: '8px 12px 8px 16px',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
      maxHeight: '60dvh', overflowY: 'auto',
    }}>
      <p style={{
        flex: '1 1 260px', minWidth: 0, margin: 0,
        fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', lineHeight: 1.4,
      }}>
        Cookie tecnici per usare il sito. Le statistiche facoltative restano disattivate senza il tuo consenso.{' '}
        <a href="/impostazioni/privacy" style={{ color: 'var(--orange)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Privacy e preferenze</a>
      </p>
      <button
        type="button" onClick={dismiss}
        style={{
          fontFamily: 'var(--font-mono)', fontSize: 14,
          background: 'transparent', color: 'var(--bone)',
          border: '1px solid var(--gray-600)', borderRadius: 3, padding: '0 14px', minHeight: 44,
          cursor: 'pointer', fontWeight: 600, flexShrink: 0,
        }}
      >
        Ho capito
      </button>
    </div>
  );
}
