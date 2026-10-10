import type { BeforeSendEvent } from '@vercel/analytics/next';

/** Pagine con token negli indirizzi o riservate: non vengono mai conteggiate. */
const ESCLUSE = ['/auth', '/admin', '/newsletter/conferma', '/sessioni', '/anteprima-sessioni', '/u/', '/messaggi', '/preferiti'];

/**
 * Filtro delle statistiche di visita (Vercel Web Analytics).
 * Toglie parametri e frammento, che possono contenere token di accesso o di
 * conferma, inclusi gli utm_* che possono contenere valori personali arbitrari.
 */
export function pulisciEventoAnalytics(event: BeforeSendEvent): BeforeSendEvent | null {
  let url: URL;
  try { url = new URL(event.url); } catch { return null; }
  if (ESCLUSE.some(prefisso => url.pathname.startsWith(prefisso))) return null;
  if (url.searchParams.has('session') || event.type !== 'pageview') return null;
  url.search = '';
  url.hash = '';
  return { ...event, url: url.toString() };
}
