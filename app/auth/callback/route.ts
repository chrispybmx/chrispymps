import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { safeAuthNext } from '@/lib/auth-navigation';
import { safeAuthErrorCode } from '@/lib/auth-errors';
import { completeAccount } from '@/lib/auth-onboarding';
import { supabaseAdmin } from '@/lib/supabase';
import { recordEmailProof } from '@/lib/email-verification';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;


/** Registra il fallimento su auth_failure_log. Non deve mai far cadere il flusso. */
async function logAuthFailure(params: {
  provider?: 'email' | 'google';
  errorCode: string | null;
  stage: 'provider_redirect' | 'code_exchange';
}) {
  try {
    await supabaseAdmin().from('auth_failure_log').insert({
      provider:     params.provider ?? 'google',
      error_code:   safeAuthErrorCode(params.errorCode),
      error_detail: null,
      stage:        params.stage,
      user_agent:   null,
    });
  } catch {
    console.error('[auth/callback] impossibile registrare il fallimento');
  }
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.has('token_hash')) {
    const destination = new URL('/auth/confirm', request.url);
    for (const key of ['token_hash', 'type', 'next', 'flow']) {
      const value = request.nextUrl.searchParams.get(key); if (value) destination.searchParams.set(key, value);
    }
    return NextResponse.redirect(destination);
  }
  return handleCallback(request, request.nextUrl.searchParams);
}
export async function POST(request: NextRequest) {
  const params = new URLSearchParams();
  try {
    const form = await request.formData();
    for (const key of ['token_hash', 'type', 'next', 'flow']) {
      const value = form.get(key); if (typeof value === 'string' && value.length <= 2048) params.set(key, value);
    }
  } catch { return NextResponse.redirect(new URL('/auth/problem', request.url), 303); }
  return handleCallback(request, params);
}
async function handleCallback(request: NextRequest, searchParams: URLSearchParams) {
  const { origin } = new URL(request.url);
  const redirect = (destination: string | URL) => NextResponse.redirect(destination, request.method === 'POST' ? 303 : 307);
  const code  = searchParams.get('code');
  const error = searchParams.get('error');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = safeAuthNext(searchParams.get('next'));
  const recovery = type === 'recovery' || searchParams.get('flow') === 'recovery';
  const emailFlow = !!tokenHash || recovery || searchParams.get('flow') === 'email';

  if (error) {
    // Do not persist free-form provider descriptions or forward them in URLs.
    const errorCode   = searchParams.get('error_code');
    console.error('[auth/callback] provider error:', safeAuthErrorCode(errorCode ?? error));
    await logAuthFailure({
      provider: emailFlow ? 'email' : 'google',
      errorCode:   errorCode ?? error,
      stage:       'provider_redirect',
    });

    const params = new URLSearchParams({ auth_error: safeAuthErrorCode(errorCode ?? error) });
    return redirect(emailFlow ? `${origin}/auth/problem` : `${origin}/map?${params.toString()}`);
  }

  if (!code && !tokenHash) return redirect(`${origin}/auth/problem`);
  if (tokenHash && !['email', 'signup', 'recovery', 'email_change'].includes(type ?? '')) return redirect(`${origin}/auth/problem`);

  const cookieStore = await cookies();

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set({ name, value: '', ...options });
      },
    },
  });

  const { data, error: exchangeError } = await (tokenHash ? supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as 'email' | 'signup' | 'recovery' | 'email_change' }) : supabase.auth.exchangeCodeForSession(code!));

  if (exchangeError || !data.session) {
    // Provider messages can contain identifiers or credentials: keep known codes only.
    console.error('[auth/callback] code exchange failed:', safeAuthErrorCode(exchangeError?.code));
    await logAuthFailure({
      provider: emailFlow ? 'email' : 'google',
      errorCode:   exchangeError?.code ?? 'exchange_failed',
      stage:       'code_exchange',
    });
    return redirect(`${origin}/auth/problem`);
  }

  if (recovery) return redirect(`${origin}/auth/reset-password`);
  try {
    if(tokenHash && ['email','signup','email_change'].includes(type??''))await recordEmailProof(data.session.user);
    const result = await completeAccount(data.session.user);
    if (!result.profileReady) return redirect(`${origin}/auth/setup-username?next=${encodeURIComponent(next)}`);
    const destination = new URL(next, origin);
    if (result.pending) destination.searchParams.set('account_pending', '1');
    return redirect(destination);
  } catch { return redirect(`${origin}/auth/problem?stage=profile`); }
}
