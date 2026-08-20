import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    /* Supabase e Google mandano ANCHE error_description / error_code con il
       motivo letterale ("Unable to exchange external code", "Database error
       saving new user", ...). Leggere solo `error` lascia il codice generico
       `server_error`, che dice che è rotto ma non dice dove. */
    const description = searchParams.get('error_description');
    const errorCode   = searchParams.get('error_code');
    console.error('[auth/callback] provider error:', { error, errorCode, description });

    const params = new URLSearchParams({ auth_error: error });
    if (description) params.set('auth_error_detail', description);
    if (errorCode)   params.set('auth_error_code', errorCode);
    return NextResponse.redirect(`${origin}/map?${params.toString()}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/map?auth_error=no_code`);
  }

  const cookieStore = cookies();

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

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.session) {
    /* Logghiamo il messaggio esatto: è l'unico modo per sapere se salta lo
       scambio PKCE, il cookie o la rete. Vedi lib/auth-errors.ts. */
    console.error('[auth/callback] exchangeCodeForSession error:', exchangeError?.message, exchangeError);
    return NextResponse.redirect(`${origin}/map?auth_error=oauth_failed`);
  }

  const userId = data.session.user.id;

  // Controlla se il profilo esiste già
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.username) {
    // Utente esistente — vai alla mappa
    return NextResponse.redirect(`${origin}/map`);
  }

  // Nuovo utente Google — deve scegliere username
  return NextResponse.redirect(`${origin}/auth/setup-username`);
}
