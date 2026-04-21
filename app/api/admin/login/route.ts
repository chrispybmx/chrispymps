import { NextRequest, NextResponse } from 'next/server';
import { loginAdmin, adminSessionCookieHeader } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: '' }));
  if (!password) {
    return NextResponse.json({ ok: false, error: 'Password mancante' }, { status: 400 });
  }

  const { success, token } = loginAdmin(password);
  if (!success || !token) {
    return NextResponse.json({ ok: false, error: 'Password errata' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.headers.set('Set-Cookie', adminSessionCookieHeader(token));
  return res;
}
