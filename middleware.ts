import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * Middleware centralizzato per:
 * 1. CSP nonce-based (anti-XSS — niente unsafe-inline in script-src)
 * 2. Rate limiting sul login admin (basato su IP)
 * 3. Rate limiting sull'endpoint flag (anti-spam)
 * 4. Header di sicurezza aggiuntivi sulle API
 *
 * Il rate limiting è in lib/rate-limit.ts: usa Upstash Redis se configurato
 * (limite condiviso fra istanze), altrimenti fallback in-memory per-istanza.
 */

const isDev = process.env.NODE_ENV !== 'production';

// ── CSP nonce-based ──
// In produzione, script-src usa 'nonce-<random>' al posto di 'unsafe-inline'.
// Next.js App Router legge il nonce dall'header x-nonce e lo applica
// automaticamente ai suoi script inline (RSC payload, hydration, ecc.).
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // Nonce per script inline Next.js; 'self' per script esterni (register-sw.js ecc.);
    // unsafe-eval solo in dev (React Fast Refresh)
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ''}`,
    // Leaflet e Tailwind usano stili inline — unsafe-inline necessario per style-src
    "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
    // Font Google + locali
    "font-src 'self' fonts.gstatic.com",
    // Immagini: Supabase storage, tile mappa (CartoDB + OSM), eventi worldwide hotlink + dati inline
    "img-src 'self' data: blob: https: *.supabase.co *.supabase.in *.basemaps.cartocdn.com *.tile.openstreetmap.org unpkg.com",
    // Connessioni API: Supabase, Nominatim OSM
    "connect-src 'self' *.supabase.co *.supabase.in nominatim.openstreetmap.org wss://*.supabase.co tiles.stadiamaps.com",
    // Worker per Leaflet
    // Worker: 'self' serve al service worker (/sw.js). Con il solo blob: la
    // registrazione veniva bloccata dal CSP e la PWA non ha mai avuto cache
    // offline, cache delle tile, ne' la possibilita' di ricevere push.
    "worker-src 'self' blob:",
    // Frame: OSM per anteprima mappa + YouTube per video spot
    "frame-src https://*.openstreetmap.org https://www.youtube.com https://www.youtube-nocookie.com",
    // Object: nessuno
    "object-src 'none'",
    // Base URI limitata
    "base-uri 'self'",
    // Form solo verso se stesso
    "form-action 'self'",
  ].join('; ');
}

// ── Nonce generation (Edge Runtime — crypto disponibile) ──
function generateNonce(): string {
  // crypto.randomUUID() è disponibile nel Edge Runtime di Vercel/Next.js.
  // Genera un UUID v4 e lo usiamo come nonce (128 bit di entropia).
  return crypto.randomUUID();
}

function getClientIp(req: NextRequest): string {
  // Su Vercel, x-real-ip è impostato dall'infrastruttura e non può essere
  // falsificato dall'utente. x-forwarded-for invece può essere spoofato
  // (l'utente può aggiungere IP arbitrari come primo elemento della lista).
  // Priorità: x-real-ip → ultimo IP in x-forwarded-for (aggiunto dal proxy) → fallback
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // Prendiamo l'ULTIMO IP della catena — è quello aggiunto dal proxy più vicino
    // (Vercel CDN) e non può essere falsificato dall'utente finale
    const parts = forwarded.split(',');
    const last = parts[parts.length - 1]?.trim();
    if (last) return last;
  }

  return 'unknown';
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = getClientIp(req);

  // ── 0. CSP nonce-based per tutte le pagine ──
  // Genera un nonce crittografico per ogni richiesta di pagina.
  // Next.js usa il nonce dall'header x-nonce per i suoi script inline.
  const isPageRequest = !pathname.startsWith('/api/');
  if (isPageRequest) {
    const nonce = generateNonce();
    const csp = buildCsp(nonce);

    // Clona i request headers per aggiungere x-nonce (letto da Next.js durante il rendering)
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-nonce', nonce);

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set('Content-Security-Policy', csp);
    return response;
  }

  // ── 1. Rate limit sul login admin: 10 tentativi / 15 minuti per IP ──
  if (pathname === '/api/admin/login' && req.method === 'POST') {
    const { allowed, remaining, resetAt } = await checkRateLimit(
      `login:${ip}`,
      10,
      15 * 60 * 1000 // 15 minuti
    );

    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: 'Troppi tentativi. Riprova tra qualche minuto.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    const res = NextResponse.next();
    res.headers.set('X-RateLimit-Remaining', String(remaining));
    return res;
  }

  // ── 2. Rate limit sul flag: 5 segnalazioni / 10 minuti per IP ──
  if (pathname === '/api/flag' && req.method === 'POST') {
    const { allowed } = await checkRateLimit(`flag:${ip}`, 5, 10 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: 'Troppe segnalazioni. Riprova più tardi.' },
        { status: 429 }
      );
    }
  }

  // ── 3. Rate limit sullo submit-spot: 10 spot / 5 minuti per IP ──
  if (pathname === '/api/submit-spot' && req.method === 'POST') {
    const { allowed } = await checkRateLimit(`submit:${ip}`, 10, 5 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: 'Troppi invii. Riprova tra qualche minuto.' },
        { status: 429 }
      );
    }
  }

  // ── 4. Rate limit sui commenti: 10 commenti / 5 minuti per IP ──
  if (pathname.startsWith('/api/comments/') && req.method === 'POST') {
    const { allowed } = await checkRateLimit(`comment:${ip}`, 10, 5 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: 'Troppi commenti. Riprova tra qualche minuto.' },
        { status: 429 }
      );
    }
  }

  // ── 5. Rate limit su resolve-gmaps: 20 richieste / 10 minuti per IP ──
  if (pathname === '/api/resolve-gmaps' && req.method === 'GET') {
    const { allowed } = await checkRateLimit(`gmaps:${ip}`, 20, 10 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: 'Troppe richieste. Riprova tra qualche minuto.' },
        { status: 429 }
      );
    }
  }

  // ── 6. Rate limit su upload immagini: 10 / 10 minuti per IP ──
  if (pathname === '/api/upload-image' && req.method === 'POST') {
    const { allowed } = await checkRateLimit(`upload:${ip}`, 10, 10 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'Troppi upload. Riprova tra qualche minuto.' }, { status: 429 });
    }
  }

  // ── 7. Rate limit su photo upload spot: 5 / 10 minuti per IP ──
  if (pathname === '/api/spot-photos' && req.method === 'POST') {
    const { allowed } = await checkRateLimit(`spotphoto:${ip}`, 5, 10 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'Troppi upload foto. Riprova tra qualche minuto.' }, { status: 429 });
    }
  }

  // ── 8. Rate limit su submit event/news: 3 / 10 minuti per IP ──
  if ((pathname === '/api/submit-event' || pathname === '/api/submit-news') && req.method === 'POST') {
    const { allowed } = await checkRateLimit(`community:${ip}`, 3, 10 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'Troppi invii. Riprova tra qualche minuto.' }, { status: 429 });
    }
  }

  // ── 9. Rate limit su status confirm: 10 / 10 minuti per IP ──
  if (pathname === '/api/status-confirm' && req.method === 'POST') {
    const { allowed } = await checkRateLimit(`status:${ip}`, 10, 10 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'Troppe conferme. Riprova tra qualche minuto.' }, { status: 429 });
    }
  }

  // ── 10. Rate limit newsletter subscribe: 3 / 10 minuti per IP ──
  if (pathname === '/api/newsletter/subscribe' && req.method === 'POST') {
    const { allowed } = await checkRateLimit(`newsletter:${ip}`, 3, 10 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'Troppe richieste. Riprova tra qualche minuto.' }, { status: 429 });
    }
  }

  // ── 11. Rate limit event RSVP: 5 / 10 minuti per IP ──
  if (pathname === '/api/events/jamroma/rsvp' && req.method === 'POST') {
    const { allowed } = await checkRateLimit(`rsvp:${ip}`, 5, 10 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'Troppe richieste.' }, { status: 429 });
    }
  }

  // ── 12. Rate limit event presence: 30 / 5 minuti per IP (heartbeat ogni 30s) ──
  if (pathname === '/api/events/jamroma/presence' && req.method === 'POST') {
    const { allowed } = await checkRateLimit(`presence:${ip}`, 30, 5 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'Troppe richieste.' }, { status: 429 });
    }
  }

  // ── 13. Rate limit account deletion: 3 / 60 minuti per IP ──
  if (pathname === '/api/user/delete' && req.method === 'DELETE') {
    const { allowed } = await checkRateLimit(`userdel:${ip}`, 3, 60 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'Troppe richieste. Riprova tra qualche minuto.' }, { status: 429 });
    }
  }

  // ── 12. Admin routes: verifica cookie sessione admin presente (difesa in profondità) ──
  /* Eccezione per i link di moderazione via email: il token HMAC firmato E'
     l'autorizzazione, ed e' cosi' che si modera dal telefono senza fare il
     login.
     Vale per GET e POST. Prima era solo GET, perche' la GET stessa approvava —
     ed era il difetto: i link nelle email li seguono anche gli antivirus della
     posta. Ora la GET porta a una pagina di conferma e a decidere e' una POST,
     quindi l'eccezione deve coprire anche quella, altrimenti chi arriva
     dall'email senza sessione admin viene fermato proprio sul bottone.
     Qui si guarda solo la PRESENZA del token: a verificarne la firma e la
     scadenza e' la rotta, che e' il controllo vero. */
  if (pathname.startsWith('/api/admin/') && pathname !== '/api/admin/login') {
    const isEmailLink =
      (pathname === '/api/admin/approve' ||
       pathname === '/api/admin/reject' ||
       pathname === '/api/admin/events/moderate') &&
      (req.method === 'GET' || req.method === 'POST') &&
      req.nextUrl.searchParams.has('token');

    if (!isEmailLink) {
      const adminCookie = req.cookies.get('cmps_admin_session')?.value;
      if (!adminCookie) {
        return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Pagine: CSP nonce-based (esclude file statici e immagini ottimizzate)
    {
      source: '/((?!_next/static|_next/image|favicon\\.ico|icons/|manifest\\.json|sw\\.js|register-sw\\.js|robots\\.txt|sitemap|opengraph-image|llms\\.txt|offline).*)',
      // Il middleware non gira su prefetch (migliora performance)
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
    // API: rate limiting + admin auth
    '/api/admin/:path*',
    '/api/flag',
    '/api/submit-spot',
    '/api/comments/:path*',
    '/api/resolve-gmaps',
    '/api/upload-image',
    '/api/spot-photos',
    '/api/submit-event',
    '/api/submit-news',
    '/api/status-confirm',
    '/api/newsletter/subscribe',
    '/api/user/delete',
    '/api/events/jamroma/:path*',
  ],
};
