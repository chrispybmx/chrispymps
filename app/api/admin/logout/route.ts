import { NextResponse } from 'next/server';
import { clearAdminCookieHeader } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set('Set-Cookie', clearAdminCookieHeader());
  return res;
}
