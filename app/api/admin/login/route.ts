import { NextRequest, NextResponse } from 'next/server';
import { loginAdmin, adminSessionCookieHeader } from '@/lib/auth';

/* ── Rate limiter in-memory ──────────────────────────────────────────
   5 tentativi per IP ogni 15 minuti. Dopodichè blocco di 30 minuti.
   Per un sito personale è più che sufficiente contro brute-force automatici.
   (Resetta al restart della serverless function — accettabile per questo use case)
──────────────────────────────────────────────────────────────────── */
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

  let password = '';
  if (isFormPost) {
    const formData = await req.formData();
    password = (formData.get('password') as string) ?? '';
  } else {
    const json = await req.json().catch(() => ({ password: '' }));
    password = json.password ?? '';
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
