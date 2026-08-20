'use client';

import { useEffect, useState } from 'react';
import { AUTH_ERROR_PARAM, authErrorMessage } from '@/lib/auth-errors';

/**
 * Avviso di accesso social fallito.
 *
 * Non usa il toast di sistema: quello sparisce dopo 2,5 secondi, e un errore
 * che si dissolve mentre lo stai leggendo è poco meglio del silenzio — qui il
 * messaggio contiene anche cosa fare (riprovare, oppure entrare con email e
 * password). Resta finché non lo chiudi tu.
 *
 * Il parametro viene tolto dall'URL appena letto, così un refresh non lo
 * ripropone e il link condiviso non porta con sé l'errore.
 */
export default function AuthErrorBanner() {
  const [messaggio, setMessaggio] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url  = new URL(window.location.href);
    const code = url.searchParams.get(AUTH_ERROR_PARAM);
    const msg  = authErrorMessage(code);
    if (!msg) return;

    setMessaggio(msg);
    url.searchParams.delete(AUTH_ERROR_PARAM);
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }, []);

  if (!messaggio) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: 'calc(56px + env(safe-area-inset-top, 0px))',
        left: 12, right: 12,
        zIndex: 60,
        background: '#2a1210',
        border: '1px solid rgba(255,77,77,0.45)',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex', alignItems: 'flex-start', gap: 10,
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        animation: 'slideUp 0.25s ease-out',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1.3 }}>⚠️</span>
      <div style={{
        flex: 1, minWidth: 0,
        fontFamily: 'var(--font-mono)', fontSize: 12,
        color: 'var(--bone)', lineHeight: 1.6,
      }}>
        {messaggio}
      </div>
      <button
        onClick={() => setMessaggio(null)}
        aria-label="Chiudi avviso"
        style={{
          background: 'none', border: 'none', color: 'var(--gray-400)',
          fontSize: 16, lineHeight: 1, cursor: 'pointer', padding: '0 2px',
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}
