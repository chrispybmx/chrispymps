import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { completeAccount } from '@/lib/auth-onboarding';
import { checkRateLimit } from '@/lib/rate-limit';
export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return NextResponse.json({ ok: false }, { status: 401 });
  const { data: { user }, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !user?.email_confirmed_at) return NextResponse.json({ ok: false }, { status: 401 });
  const limit = await checkRateLimit(`auth-complete:${user.id}`, 6, 60000);
  if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429 });
  try { return NextResponse.json({ ok: true, ...await completeAccount(user) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ ok: false, error: 'Profilo non completato. Riprova.' }, { status: 503 }); }
}
