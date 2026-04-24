import { NextRequest, NextResponse } from 'next/server';
import { subscribeToNewsletter } from '@/lib/mailerlite';
import { z } from 'zod';

const Schema = z.object({
  email:    z.string().email().max(254),
  username: z.string().max(50).optional(),
});

/**
 * POST /api/newsletter/subscribe
 * Iscrive un utente a MailerLite al momento della registrazione.
 * Chiamato dal client dopo signUp — non richiede auth (email già verificata da Supabase).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const result = Schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ ok: false, error: 'Dati non validi' }, { status: 422 });
  }

  const { email, username } = result.data;
  const success = await subscribeToNewsletter(email, username ?? email.split('@')[0]);

  // Risposta sempre 200 — non vogliamo bloccare il flusso di registrazione
  return NextResponse.json({ ok: success });
}
