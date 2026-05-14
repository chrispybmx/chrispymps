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
 *
 * Risposta sempre 200 per non bloccare il flusso UX. Include `error` se MailerLite fallisce.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const result = Schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { ok: false, error: 'Email non valida' },
      { status: 422 },
    );
  }

  const { email, username } = result.data;
  const { ok, error, subscriberId } = await subscribeToNewsletter(
    email,
    username ?? email.split('@')[0],
  );

  return NextResponse.json({ ok, error, subscriberId });
}
