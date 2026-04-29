'use client';

import { useEffect, useRef } from 'react';

/**
 * Overlay VHS scanlines + noise — fixed, pointer-events:none.
 * Montato in RootLayout, appare su tutte le pagine.
 * Pausa l'animazione quando il tab è nascosto per risparmiare batteria.
 */
export default function VhsOverlay() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onVisibility = () => {
      if (document.hidden) {
        el.classList.add('paused');
      } else {
        el.classList.remove('paused');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return <div ref={ref} className="vhs-overlay" aria-hidden="true" />;
}
