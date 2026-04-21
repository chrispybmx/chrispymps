import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Server-side (nei server components e route handlers) — legge cookies */
export function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value; },
      set() {},
      remove() {},
    },
  });
}

/** Admin client (bypassa RLS) — USA SOLO in route handlers server */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY mancante');
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false },
  });
}
