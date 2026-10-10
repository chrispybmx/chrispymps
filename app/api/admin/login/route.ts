import { NextRequest, NextResponse } from 'next/server';
import { loginAdmin, adminSessionCookieHeader } from '@/lib/auth';
import { isCrossOriginBrowserRequest } from '@/lib/request-origin';

// Local defence only: serverless instances do not share counters.
// A persistent edge/database limiter is still required for distributed attempts.
const MAX_ATTEMPTS = 5;
const WINDOW_MS    = 15 * 60 * 1000; // 15 minuti
const BLOCK_MS     = 30 * 60 * 1000; // 30 minuti di blocco dopo troppi tentativi

interface IpEntry { count: number; blockedUntil: number; windowStart: number }
const ipStore = new Map<string, IpEntry>();

function getIp(req: NextRequest): string {
  // Priorità: x-real-ip (impostato da Vercel, non spoofabile) → ultimo x-forwarded-for → fallback
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',');
    const last = parts[parts.length - 1]?.trim();
    if (last) return last;
  }
  return 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec?: number } {
  const now  = Date.now();
  const prev = ipStore.get(ip);

  // IP bloccato
  if (prev?.blockedUntil && now < prev.blockedUntil) {
    return { allowed: false, retryAfterSec: Math.ceil((prev.blockedUntil - now) / 1000) };
  }

  // Nuova finestra o IP nuovo
  if (!prev || now - prev.windowStart > WINDOW_MS) {
    ipStore.set(ip, { count: 1, blockedUntil: 0, windowStart: now });
    return { allowed: true };
  }

  // Nella finestra corrente: incrementa
  prev.count++;
  if (prev.count > MAX_ATTEMPTS) {
    prev.blockedUntil = now + BLOCK_MS;
    return { allowed: false, retryAfterSec: Math.ceil(BLOCK_MS / 1000) };
  }

  return { allowed: true };
}

function clearAttempts(ip: string) { ipStore.delete(ip); }

/* ── Route handler ─────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  if (isCrossOriginBrowserRequest(req)) {
    return NextResponse.json({ ok: false, error: 'Origine non consentita' }, { status: 403 });
  }
  const ip = getIp(req);
  const { allowed, retryAfterSec } = checkRateLimit(ip);

  const contentType = req.headers.get('content-type') ?? '';
  const isFormPost = contentType.includes('application/x-www-form-urlencoded');
  const baseUrl = req.nextUrl.origin;

  if (!allowed) {
    const minutes = Math.ceil((retryAfterSec ?? BLOCK_MS / 1000) / 60);
    if (isFormPost) {
      return NextResponse.redirect(`${baseUrl}/admin/login?error=rate`, { status: 303 });
    }
    return NextResponse.json(
      { ok: false, error: `Troppi tentativi. Riprova tra ${minutes} minuti.` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec ?? 1800) } }
    );
  }

  // Bound actual streamed bytes, not only a client-supplied Content-Length.
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    if (Number(req.headers.get('content-length')) > 4096) throw new Error('large');
    if (reader) for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new Error('large'); }
      chunks.push(value);
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'Richiesta non valida' }, { status: 413 });
  } finally { reader?.releaseLock(); }
  const raw = Buffer.concat(chunks).toString('utf8');
  let password: unknown;
  try { password = isFormPost ? new URLSearchParams(raw).get('password') : JSON.parse(raw)?.password; }
  catch { password = null; }
  if (typeof password !== 'string' || password.length > 1024) {
    return NextResponse.json({ ok: false, error: 'Richiesta non valida' }, { status: 400 });
  }

  if (!password) {
    if (isFormPost) {
      return NextResponse.redirect(`${baseUrl}/admin/login?error=missing`, { status: 303 });
    }
    return NextResponse.json({ ok: false, error: 'Password mancante' }, { status: 400 });
  }

  const { success, token } = loginAdmin(password);
  if (!success || !token) {
    if (isFormPost) {
      return NextResponse.redirect(`${baseUrl}/admin/login?error=wrong`, { status: 303 });
    }
    return NextResponse.json({ ok: false, error: 'Password errata' }, { status: 401 });
  }

  clearAttempts(ip);

  if (isFormPost) {
    const res = NextResponse.redirect(`${baseUrl}/admin`, { status: 303 });
    res.headers.set('Set-Cookie', adminSessionCookieHeader(token));
    return res;
  }

  const res = NextResponse.json({ ok: true });
  res.headers.set('Set-Cookie', adminSessionCookieHeader(token));
  return res;
}
