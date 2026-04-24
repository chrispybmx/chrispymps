import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { subscribeToNewsletter } from '@/lib/mailerlite';

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

/**
 * POST /api/admin/migrate-mailerlite
 * Iscrive a MailerLite tutti gli utenti già registrati che non sono ancora nella lista.
 * Protetto dal cookie di sessione admin (stesso meccanismo degli altri endpoint admin).
 */
export async function POST(req: NextRequest) {
  // Auth admin via cookie (stesso sistema degli altri endpoint admin)
  const sessionCookie = req.cookies.get('admin_session')?.value;
  if (!sessionCookie || sessionCookie !== process.env.ADMIN_SESSION_TOKEN) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  if (!SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_KEY mancante' }, { status: 500 });
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Legge tutti gli utenti da auth.users (paginato a 1000 per volta)
  let page = 1;
  let allUsers: { email: string; username: string }[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error('[migrate-mailerlite] listUsers error:', error);
      break;
    }
    if (!data.users.length) break;

    for (const u of data.users) {
      if (!u.email) continue;
      const username: string =
        (u.user_metadata?.username as string | undefined) ?? u.email.split('@')[0];
      allUsers.push({ email: u.email, username });
    }

    if (data.users.length < 1000) break;
    page++;
  }

  // Iscrive in batch (sequenziale per non martellare le API MailerLite)
  let ok = 0;
  let failed = 0;
  for (const { email, username } of allUsers) {
    const success = await subscribeToNewsletter(email, username);
    if (success) ok++; else failed++;
    // Piccola pausa per rispettare i rate limit MailerLite
    await new Promise(r => setTimeout(r, 80));
  }

  return NextResponse.json({
    ok: true,
    total: allUsers.length,
    subscribed: ok,
    failed,
  });
}
