'use client';

import { Analytics } from '@vercel/analytics/next';
import { pulisciEventoAnalytics } from '@/lib/analytics';

/** Statistiche delle visite senza cookie; il filtro esclude token e pagine riservate. */
export default function Statistiche() {
  return <Analytics beforeSend={pulisciEventoAnalytics} />;
}
