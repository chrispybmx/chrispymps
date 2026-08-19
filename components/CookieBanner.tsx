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

  const hasNav = PAGES_WITH_NAV.some(p => pathname?.startsWith(p)) || pathname === '/';
  const bottomPad = hasNav ? 'calc(68px + env(safe-area-inset-bottom))' : 'calc(14px + env(safe-area-inset-bottom))';

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: 'var(--gray-800)', borderTop: '1px solid var(--gray-600)',
      padding: '14px 20px', paddingBottom: bottomPad,
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      animation: 'slideUp 0.3s ease-out',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
    }}>
      <p style={{
        flex: 1, minWidth: 200, margin: 0,
        fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', lineHeight: 1.6,
      }}>
        Questo sito usa solo cookie tecnici necessari al funzionamento.{' '}
        <a href="/privacy#cookie" style={{ color: 'var(--orange)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Dettagli</a>
      </p>
      <button
        onClick={dismiss}
        style={{
          fontFamily: 'var(--font-mono)', fontSize: 14,
          background: 'var(--orange)', color: '#000',
          border: 'none', borderRadius: 6, padding: '10px 22px',
          cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 700,
          letterSpacing: '0.02em',
        }}
      >
        HO CAPITO
      </button>
    </div>
  );
}
