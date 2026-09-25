'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export const COOKIE_KEY = 'cmaps_cookie_notice';
/** Emesso quando l'informativa viene chiusa: sblocca la coda dei popup. */
export const COOKIE_DISMISSED_EVENT = 'cmaps:cookie-dismissed';

/** Pagine che hanno BottomNav fisso in basso */
const PAGES_WITH_NAV = ['/map', '/classifica', '/scopri', '/sessioni', '/cerca-spot', '/preferiti'];

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      if (!localStorage.getItem(COOKIE_KEY)) setVisible(true);
    } catch {}
  }, []);

  const dismiss = () => {
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
    <div className="cm-cookie" data-nav={hasNav} style={{
      position: 'fixed', left: 0, right: 0, zIndex: 9999,
      background: 'var(--gray-800)', borderTop: '1px solid var(--gray-600)',
      padding: '8px 12px 8px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <p style={{
        flex: 1, minWidth: 0, margin: 0,
        fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', lineHeight: 1.4,
      }}>
        Il sito usa solo cookie tecnici.{' '}
        <a href="/privacy#cookie" style={{ color: 'var(--orange)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Dettagli</a>
      </p>
      <button
        onClick={dismiss}
        style={{
          fontFamily: 'var(--font-mono)', fontSize: 14,
          background: 'transparent', color: 'var(--bone)',
          border: '1px solid var(--gray-600)', borderRadius: 3, padding: '0 14px', minHeight: 44,
          cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600, flexShrink: 0,
        }}
      >
        Ho capito
      </button>
    </div>
  );
}
