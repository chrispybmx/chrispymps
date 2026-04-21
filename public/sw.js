// ChrispyMPS Service Worker
// Strategia: cache-first per assets statici, network-first per API, stale-while-revalidate per pagine città

const CACHE_VERSION = 'v1';
const STATIC_CACHE  = `chrispymps-static-${CACHE_VERSION}`;
const MAP_CACHE     = `chrispymps-map-${CACHE_VERSION}`;
const PAGE_CACHE    = `chrispymps-pages-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/map',
  '/offline',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=VT323&family=Barlow+Condensed:wght@400;600;700&display=swap',
];

// Tile OSM da cachare per offline (quando l'utente visita una zona)
const OSM_TILE_ORIGINS = [
  'https://a.tile.openstreetmap.org',
  'https://b.tile.openstreetmap.org',
  'https://c.tile.openstreetmap.org',
];

// ===== INSTALL =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Alcuni asset statici non cachati:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![STATIC_CACHE, MAP_CACHE, PAGE_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ===== FETCH =====
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Non intercettare richieste non-GET o verso Supabase API
  if (request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;

  // Tile OSM → cache-first con TTL 7 giorni
  if (OSM_TILE_ORIGINS.some((origin) => request.url.startsWith(origin))) {
    event.respondWith(cacheFirstWithTTL(request, MAP_CACHE, 7 * 24 * 60 * 60));
    return;
  }

  // API interne → network-only (dati sempre freschi)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => new Response('{"error":"offline"}', {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })));
    return;
  }

  // Pagine città → stale-while-revalidate
  if (url.pathname.startsWith('/map/') && !url.pathname.includes('.')) {
    event.respondWith(staleWhileRevalidate(request, PAGE_CACHE));
    return;
  }

  // Assets statici (js, css, fonts, images) → cache-first
  if (
    url.pathname.match(/\.(js|css|woff2?|png|jpg|webp|svg|ico)$/) ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Default → network con fallback cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || offlinePage()))
  );
});

// ===== PUSH NOTIFICATIONS (futuro) =====
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'ChrispyMPS', {
      body: data.body || 'Nuovo spot approvato vicino a te!',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      data: { url: data.url || '/map' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/map')
  );
});

// ===== HELPERS =====

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlinePage();
  }
}

async function cacheFirstWithTTL(request, cacheName, ttlSeconds) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    const fetchedAt = cached.headers.get('sw-fetched-at');
    if (fetchedAt) {
      const age = (Date.now() - parseInt(fetchedAt)) / 1000;
      if (age < ttlSeconds) return cached;
    } else {
      return cached; // cache senza timestamp → usa comunque
    }
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set('sw-fetched-at', Date.now().toString());
      const modified = new Response(await response.blob(), { status: response.status, headers });
      cache.put(request, modified);
      return modified;
    }
    return response;
  } catch {
    return cached || new Response('', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || fetchPromise || offlinePage();
}

function offlinePage() {
  return new Response(
    `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ChrispyMPS — Offline</title>
<style>
  body { background:#0a0a0a; color:#f3ead8; font-family:'VT323',monospace; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; text-align:center; }
  h1 { color:#ff6a00; font-size:3rem; margin-bottom:0.5rem; }
  p { font-size:1.2rem; opacity:0.7; }
  a { color:#ff6a00; }
</style>
</head>
<body>
  <div>
    <h1>📡 NO SIGNAL</h1>
    <p>Sei offline. Connettiti e riprova.</p>
    <p><a href="/map">↩ Torna alla mappa</a></p>
  </div>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
