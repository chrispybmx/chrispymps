import type { BeforeSendEvent } from '@vercel/analytics/next';

/** Pagine con token negli indirizzi o riservate: non vengono mai conteggiate. */
const ESCLUSE = ['/auth/', '/admin', '/newsletter/conferma'];

/**
 * Filtro delle statistiche di visita (Vercel Web Analytics).
 * Toglie parametri e frammento, che possono contenere token di accesso o di
 * conferma; tiene soltanto gli utm_* per sapere quale post porta visite.
 */
export function pulisciEventoAnalytics(event: BeforeSendEvent): BeforeSendEvent | null {
  let url: URL;
  try { url = new URL(event.url); } catch { return null; }
  if (ESCLUSE.some(prefisso => url.pathname.startsWith(prefisso))) return null;
  const utm = new URLSearchParams();
  url.searchParams.forEach((valore, chiave) => { if (chiave.startsWith('utm_')) utm.set(chiave, valore); });
  url.search = utm.toString();
  url.hash = '';
  return { ...event, url: url.toString() };
}
