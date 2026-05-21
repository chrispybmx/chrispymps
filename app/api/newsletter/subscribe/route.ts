import { NextRequest, NextResponse } from 'next/server';
import { subscribeToNewsletter } from '@/lib/mailerlite';
import { z } from 'zod';

const Schema = z.object({
  email:    z.string().email().max(254),
  username: z.string().max(50).optional(),
  source:   z.enum(['newsletter', 'signup', 'submit-spot']).optional(),
});

/**
 * POST /api/newsletter/subscribe
 * Iscrive un utente a MailerLite. Il body accetta `source` per routare al gruppo corretto:
 *   - 'newsletter'  → group Newsletter BMX Settimanale (form embed su /news/[slug])
 *   - 'signup'      → group Account Chrispy Maps (registrazione sito)
 *   - 'submit-spot' → group ChrispyMPS — Spot Submission
 * Default (source mancante) usa MAILERLITE_GROUP_ID dell'env.
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

  const { email, username, source } = result.data;
  const { ok, error, subscriberId } = await subscribeToNewsletter(
    email,
    username ?? email.split('@')[0],
    { source },
  );

  return NextResponse.json({ ok, error, subscriberId });
}
