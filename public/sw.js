// Chrispy Maps Service Worker
//
// Strategie: cache-first per gli asset, stale-while-revalidate per pagine e
// dati della mappa, network-only per tutto il resto delle API.
//
// NB: /sw.js e' escluso dal matcher del middleware, quindi questo file NON
// riceve header CSP e le fetch qui dentro non sono ristrette. Il CSP della
// pagina governa solo la registrazione (worker-src), non il traffico interno.

const CACHE_VERSION = 'v3';
const STATIC_CACHE  = `chrispymaps-static-${CACHE_VERSION}`;
const MAP_CACHE     = `chrispymaps-map-${CACHE_VERSION}`;
const PAGE_CACHE    = `chrispymaps-pages-${CACHE_VERSION}`;
const DATA_CACHE    = `chrispymaps-data-${CACHE_VERSION}`;
const PHOTO_CACHE   = `chrispymaps-photos-${CACHE_VERSION}`;

const CACHES_ATTIVE = [STATIC_CACHE, MAP_CACHE, PAGE_CACHE, DATA_CACHE, PHOTO_CACHE];

/* Nessun font qui dentro: i font passano da next/font/google, che li scarica
   in fase di build e li serve da /_next/static/media. Il sito non contatta mai
   fonts.googleapis.com, quindi precaricarne il CSS teneva in cache un file che
   nessuno chiede mai. */
const STATIC_ASSETS = [
  '/',
  '/map',
  '/offline',
  '/manifest.json',
];

/* Tetti per cache. Senza, le tile crescono all'infinito: navigare una citta'
   a piu' zoom ne produce centinaia, e quando il browser sfonda la quota puo'
   buttare via TUTTO lo storage dell'origine — precache compreso. */
const MAX_TILE  = 600;   // ~15-25 KB l'una → nell'ordine dei 10 MB
const MAX_PHOTO = 60;

/* Le tile della mappa. Il tema chiaro (predefinito) usa OSM, quello scuro
   CARTO: prima c'era solo OSM, quindi chi mappava al buio non aveva cache. */
function isTile(url) {
  return url.hostname.endsWith('.tile.openstreetmap.org')
      || url.hostname.endsWith('.basemaps.cartocdn.com');
}

/* Solo le foto pubbliche degli spot. Il resto di Supabase — auth, query,
   realtime — non va mai toccato. */
function isSpotPhoto(url) {
  return url.hostname.endsWith('.supabase.co')
      && url.pathname.startsWith('/storage/v1/object/public/spot-photos/');
}

// ===== INSTALL =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch((err) => {
        /* addAll e' atomica: se un solo URL fallisce non viene salvato niente.
           Si logga e si prosegue, il sito funziona comunque online. */
        console.warn('[SW] precache fallito:', err);
      })
      .then(() => self.skipWaiting())
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !CACHES_ATTIVE.includes(k)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ===== FETCH =====
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.pathname.startsWith('/admin')) return;
  if (url.pathname.startsWith('/api/admin')) return;

  // Tile della mappa → cache-first con scadenza a 7 giorni
  if (isTile(url)) {
    event.respondWith(cacheFirstConTTL(request, MAP_CACHE, 7 * 24 * 60 * 60, MAX_TILE));
    return;
  }

  // Foto degli spot → cache-first, tetto basso
  if (isSpotPhoto(url)) {
    event.respondWith(cacheFirst(request, PHOTO_CACHE, MAX_PHOTO));
    return;
  }

  // Il resto di Supabase non si tocca (auth, query, realtime)
  if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')) return;

  /* Gli spot della mappa → stale-while-revalidate.
     Prima erano network-only come ogni API: aprire il sito senza rete dava una
     mappa che si disegnava, con le tile in cache, e zero spot sopra. Cioe' la
     modalita' offline esisteva ma non serviva a niente, che e' il contrario
     della funzione bandiera di app come park4night.
     Ora l'ultima lista buona resta salvata: offline vedi gli spot dell'ultima
     volta, e appena c'e' rete si aggiornano da soli. */
  if (url.origin === self.location.origin && url.pathname === '/api/spots') {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  // Ogni altra API → solo rete, con un errore leggibile se non c'e'
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response(
        JSON.stringify({ ok: false, error: 'offline' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ))
    );
    return;
  }

  // Pagine mappa e spot → stale-while-revalidate
  if (url.pathname.startsWith('/map') && !url.pathname.includes('.')) {
    event.respondWith(staleWhileRevalidate(request, PAGE_CACHE));
    return;
  }

  // Asset statici → cache-first
  if (url.pathname.match(/\.(js|css|woff2?|png|jpg|jpeg|webp|svg|ico)$/)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Default → rete, con la cache come rete di sicurezza
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => (await caches.match(request)) || paginaOffline())
  );
});

// ===== PUSH =====
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { return; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Chrispy Maps', {
      body:  data.body || 'Nuovo spot approvato vicino a te',
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      data:  { url: data.url || '/map' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/map'));
});

// ===== HELPER =====

/** Toglie le voci piu' vecchie quando la cache supera il tetto.
 *  Cache Storage restituisce le chiavi in ordine di inserimento, quindi
 *  eliminare dalla testa scarta le piu' vecchie.
 *  Il controllo non gira a ogni scrittura: contare centinaia di chiavi per
 *  ogni tile costerebbe piu' della tile stessa. */
async function sfoltisci(cache, massimo) {
  if (Math.random() > 0.1) return;
  const keys = await cache.keys();
  const troppe = keys.length - massimo;
  if (troppe > 0) await Promise.all(keys.slice(0, troppe).map((k) => cache.delete(k)));
}

/** Scarica una risorsa di altra origine in modo LEGGIBILE.
 *
 *  Il punto delicato di tutto questo file. Leaflet e i tag <img> chiedono le
 *  immagini in `no-cors`, e la risposta che ne esce e' opaca: corpo illeggibile,
 *  `status` 0 e `ok` sempre falso. Ogni `if (response.ok)` la scarta in
 *  silenzio — ed e' il motivo per cui la cache delle tile e' rimasta a zero
 *  voci da sempre, anche dopo aver sbloccato il service worker.
 *
 *  Rifacendo la richiesta in `cors` si ottiene una risposta vera: tile.openstreetmap.org,
 *  basemaps.cartocdn.com e lo storage di Supabase rispondono tutti con
 *  `access-control-allow-origin: *` (verificato).
 *
 *  Se il giro CORS non riesce si lascia passare la richiesta originale senza
 *  salvarla: meglio una tile non messa in cache che una tile vuota. */
async function fetchLeggibile(request) {
  try {
    const r = await fetch(request.url, { mode: 'cors', credentials: 'omit' });
    if (r.ok && r.type !== 'opaque') return { risposta: r, salvabile: true };
  } catch { /* si ripiega sulla richiesta originale */ }
  return { risposta: await fetch(request), salvabile: false };
}

async function cacheFirst(request, cacheName, massimo) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const { risposta, salvabile } = await fetchLeggibile(request);
    if (salvabile) {
      await cache.put(request, risposta.clone());
      if (massimo) await sfoltisci(cache, massimo);
    }
    return risposta;
  } catch {
    return paginaOffline();
  }
}

async function cacheFirstConTTL(request, cacheName, ttlSecondi, massimo) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    const salvataA = cached.headers.get('sw-fetched-at');
    if (!salvataA) return cached;
    if ((Date.now() - Number(salvataA)) / 1000 < ttlSecondi) return cached;
  }
  try {
    const { risposta, salvabile } = await fetchLeggibile(request);
    /* Senza risposta leggibile non si tocca il corpo: leggere il blob di una
       risposta opaca restituisce zero byte, e rimetterla in circolo darebbe
       una tile vuota, cioe' un buco grigio al posto della mappa. */
    if (!salvabile) return risposta;

    const headers = new Headers(risposta.headers);
    headers.set('sw-fetched-at', String(Date.now()));
    const copia = new Response(await risposta.blob(), { status: risposta.status, headers });
    await cache.put(request, copia.clone());
    if (massimo) await sfoltisci(cache, massimo);
    return copia;
  } catch {
    /* Scaduta ma senza rete: una tile vecchia vale piu' di un buco grigio. */
    return cached || new Response('', { status: 503 });
  }
}

/** Serve subito la copia in cache e intanto aggiorna.
 *
 *  La versione precedente finiva con `cached || fetchPromise || paginaOffline()`:
 *  una Promise e' sempre vera, quindi paginaOffline() era irraggiungibile, e se
 *  la rete cadeva la funzione restituiva null. Un respondWith(null) non e' una
 *  risposta: il browser mostrava il proprio errore di rete al posto della
 *  pagina offline scritta apposta. */
async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const inArrivo = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    /* Aggiorna in sottofondo senza far aspettare nessuno. */
    inArrivo.catch(() => {});
    return cached;
  }

  const dallaRete = await inArrivo;
  if (dallaRete) return dallaRete;

  /* Ultima spiaggia prima della pagina offline: la copia messa da parte
     all'installazione vive in STATIC_CACHE, non in questa. Senza questo
     passaggio, aprire /map senza rete alla prima visita mostrerebbe la pagina
     offline pur avendo la mappa gia' salvata. */
  return (await caches.match(request)) || paginaOffline();
}

function paginaOffline() {
  return new Response(
    `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chrispy Maps — Offline</title>
<style>
  body { background:#0a0a0a; color:#f3ead8; font-family:monospace; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; text-align:center; padding:20px; }
  h1 { color:#ff6a00; font-size:2.5rem; margin-bottom:0.5rem; }
  p { font-size:1.05rem; opacity:0.75; line-height:1.6; }
  a { color:#ff6a00; }
</style>
</head>
<body>
  <div>
    <h1>NO SIGNAL</h1>
    <p>Sei offline.<br>Gli spot che hai gia' aperto restano disponibili.</p>
    <p><a href="/map">Torna alla mappa</a></p>
  </div>
</body>
</html>`,
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
