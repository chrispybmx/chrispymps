import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware centralizzato per:
 * 1. Rate limiting sul login admin (basato su IP)
 * 2. Rate limiting sull'endpoint flag (anti-spam)
 * 3. Header di sicurezza aggiuntivi sulle API
 */

// ── In-memory store per rate limiting (per Lambda instance) ──
// In produzione con molte istanze, usare Vercel KV / Upstash Redis
// Questo limita comunque gli attacchi rapidi sulla stessa istanza
interface RateLimitEntry { count: number; resetAt: number }
const rateLimitStore = new Map<string, RateLimitEntry>();

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

function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    // Prima richiesta o finestra scaduta
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

// Pulizia periodica del store (evita memory leak)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetAt) rateLimitStore.delete(key);
    }
  }, 60_000);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = getClientIp(req);

  // ── 1. Rate limit sul login admin: 10 tentativi / 15 minuti per IP ──
  if (pathname === '/api/admin/login' && req.method === 'POST') {
    const { allowed, remaining, resetAt } = checkRateLimit(
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
    const { allowed } = checkRateLimit(`flag:${ip}`, 5, 10 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: 'Troppe segnalazioni. Riprova più tardi.' },
        { status: 429 }
      );
    }
  }

  // ── 3. Rate limit sullo submit-spot: 3 spot / 10 minuti per IP ──
  if (pathname === '/api/submit-spot' && req.method === 'POST') {
    const { allowed } = checkRateLimit(`submit:${ip}`, 3, 10 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: 'Troppi invii. Riprova tra qualche minuto.' },
        { status: 429 }
      );
    }
  }

  // ── 4. Rate limit sui commenti: 10 commenti / 5 minuti per IP ──
  if (pathname.startsWith('/api/comments/') && req.method === 'POST') {
    const { allowed } = checkRateLimit(`comment:${ip}`, 10, 5 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: 'Troppi commenti. Riprova tra qualche minuto.' },
        { status: 429 }
      );
    }
  }

  // ── 5. Rate limit su resolve-gmaps: 20 richieste / 10 minuti per IP ──
  if (pathname === '/api/resolve-gmaps' && req.method === 'GET') {
    const { allowed } = checkRateLimit(`gmaps:${ip}`, 20, 10 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: 'Troppe richieste. Riprova tra qualche minuto.' },
        { status: 429 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/admin/login',
    '/api/flag',
    '/api/submit-spot',
    '/api/comments/:path*',
    '/api/resolve-gmaps',
  ],
};
