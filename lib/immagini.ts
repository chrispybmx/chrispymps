/**
 * Miniature delle foto degli spot.
 *
 * Il problema, misurato il 26/08/2026: le copertine sono JPEG da 1200x1600 e
 * pesano in media 274 KB. Nella griglia della mappa vengono mostrate alte
 * 130 pixel. Caricare una foto da 400 KB per disegnarla in 130 pixel significa
 * buttare via il 98% dei pixel scaricati.
 *
 * Con venti spot visibili nel pannello sono 5,9 MB per una schermata. Su rete
 * mobile e' la differenza fra una mappa che si apre e una che si aspetta.
 *
 * Supabase Storage sa ridimensionare da solo, e serve WebP quando il browser
 * lo accetta. Stessa griglia, misurata: 5,9 MB → 1,0 MB. L'82% in meno — e
 * sono gli stessi byte che consumano la quota del progetto.
 *
 *   originale (1200x1600)   396 KB
 *   width=400 quality=70    107 KB
 *   width=400 in WebP        83 KB
 *
 * Il ridimensionamento NON si applica dove la foto si guarda davvero: la
 * scheda spot e il lightbox restano a piena risoluzione. Una miniatura al
 * posto di una foto vera sarebbe un peggioramento, non un'ottimizzazione.
 */

/** Il pezzo di indirizzo che distingue un file del nostro storage. */
const PUBBLICO = '/storage/v1/object/public/';
const TRASFORMA = '/storage/v1/render/image/public/';

/**
 * Restituisce l'indirizzo della foto ridimensionata a `larghezza` pixel.
 *
 * Se l'indirizzo non e' una foto del nostro storage — un'immagine ospitata
 * altrove, una stringa vuota, qualcosa che non riconosciamo — torna indietro
 * INVARIATO. Una miniatura non deve mai poter rompere una card: nel dubbio si
 * mostra la foto originale, che pesa di piu' ma si vede.
 *
 * @param larghezza in pixel CSS. Vale la pena chiederne il doppio di quanto
 *        si mostra, per gli schermi ad alta densita'.
 */
export function miniatura(url: string | undefined | null, larghezza: number): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  if (!url.includes(PUBBLICO)) return url;

  return `${url.replace(PUBBLICO, TRASFORMA)}?width=${larghezza}&quality=70`;
}
