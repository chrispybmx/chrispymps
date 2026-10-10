'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { analyticsAllowed, ANALYTICS_CONSENT_EVENT } from '@/lib/analytics-consent';
import { pulisciEventoAnalytics } from '@/lib/analytics';
const Analytics = dynamic(() => import('@vercel/analytics/next').then(module => module.Analytics), { ssr: false });

/** Statistiche delle visite senza cookie; il filtro esclude token e pagine riservate. */
export default function Statistiche() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let previous = analyticsAllowed();
    setAllowed(previous);
    const changed = () => {
      const next = analyticsAllowed();
      if (previous && !next) { window.location.reload(); return; }
      previous = next;
      setAllowed(next);
    };
    window.addEventListener('storage', changed);
    window.addEventListener(ANALYTICS_CONSENT_EVENT, changed);
    const timer = window.setInterval(changed, 60000);
    return () => { window.removeEventListener('storage', changed); window.removeEventListener(ANALYTICS_CONSENT_EVENT, changed); window.clearInterval(timer); };
  }, []);
  // Attive salvo rifiuto; la variabile serve solo a spegnerle per tutti ('false').
  if (process.env.NEXT_PUBLIC_WEB_ANALYTICS_ENABLED === 'false' || !allowed) return null;
  return <Analytics beforeSend={event => analyticsAllowed() ? pulisciEventoAnalytics(event) : null} />;
}
