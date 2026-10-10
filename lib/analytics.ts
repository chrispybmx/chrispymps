import type { BeforeSendEvent } from '@vercel/analytics/next';

/** Pagine con token negli indirizzi o riservate: non vengono mai conteggiate. */
const ESCLUSE = ['/auth', '/admin', '/newsletter/conferma', '/sessioni', '/anteprima-sessioni', '/u/', '/messaggi', '/preferiti'];

/** Parametri di campagna dei nostri link: dicono quale post porta visite. */
const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

/**
 * Filtro delle statistiche di visita (Vercel Web Analytics).
 * Toglie frammento e parametri, che possono contenere token di accesso o di
 * conferma; tiene solo i cinque UTM standard, e solo con valori brevi.
 */
export function pulisciEventoAnalytics(event: BeforeSendEvent): BeforeSendEvent | null {
  let url: URL;
  try { url = new URL(event.url); } catch { return null; }
  if (ESCLUSE.some(prefisso => url.pathname.startsWith(prefisso))) return null;
  if (url.searchParams.has('session') || event.type !== 'pageview') return null;
  const campagna = new URLSearchParams();
  for (const chiave of UTM) {
    const valore = url.searchParams.get(chiave);
    if (valore && valore.length <= 100) campagna.set(chiave, valore);
  }
  url.search = campagna.toString();
  url.hash = '';
  return { ...event, url: url.toString() };
}
