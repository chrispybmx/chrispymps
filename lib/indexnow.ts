import { APP_CONFIG } from './constants';

/**
 * IndexNow — notifica istantanea ai motori (Bing, Copilot, Yandex, Seznam) che
 * una URL è nuova o cambiata, invece di aspettare che passi il crawler.
 *
 * Serve perché maps.chrispybmx.com è un sottodominio senza backlink: i crawler
 * ci passano di rado, quindi le pagine nuove restano fuori dall'indice a lungo.
 * Google NON usa IndexNow (per Google servono i link + Search Console), ma
 * l'adozione è gratuita e copre Bing/Copilot.
 *
 * La chiave è pubblica per progetto: deve essere raggiungibile come file di
 * testo alla radice del sito (public/<key>.txt) e contenere esattamente la chiave.
 */

const INDEXNOW_KEY = 'd2707434d81d4231f08b2a5813182e7a';
const HOST = new URL(APP_CONFIG.url).host;

/**
 * Notifica una o più URL. Non lancia mai: l'indicizzazione è un effetto
 * collaterale, non deve far fallire l'operazione che l'ha scatenata.
 * Awaited dal chiamante (su serverless una promise non attesa non completa).
 */
export async function submitToIndexNow(urls: string[]): Promise<{ ok: boolean; status?: number }> {
  const list = urls.filter(Boolean).slice(0, 10_000); // limite protocollo
  if (list.length === 0) return { ok: false };

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: HOST,
        key: INDEXNOW_KEY,
        keyLocation: `${APP_CONFIG.url}/${INDEXNOW_KEY}.txt`,
        urlList: list,
      }),
    });
    // 200 = accettato, 202 = accettato in coda (chiave in verifica)
    if (!res.ok && res.status !== 202) {
      console.error('[indexnow] risposta', res.status, await res.text().catch(() => ''));
      return { ok: false, status: res.status };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    console.error('[indexnow] errore rete:', e);
    return { ok: false };
  }
}
