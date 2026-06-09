import { NextRequest, NextResponse } from 'next/server';
import { subscribeToNewsletter } from '@/lib/mailerlite';
import { z } from 'zod';

const Schema = z.object({
  email:    z.string().email().max(254),
  username: z.string().max(50).optional(),
  source:   z.enum(['newsletter', 'signup', 'submit-spot']).optional(),
});

// Origini autorizzate a chiamare l'endpoint cross-origin (landing statica su chrispybmx.com).
// Same-origin (maps.chrispybmx.com) non passa da CORS, quindi non serve elencarlo.
const ALLOWED_ORIGINS = new Set([
  'https://chrispybmx.com',
  'https://www.chrispybmx.com',
]);

function corsHeaders(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
  }
  return {};
}

/** Preflight CORS per i client cross-origin (es. chrispybmx.com/newsletter). */
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

/**
 * POST /api/newsletter/subscribe
 * Iscrive un utente a MailerLite. Il body accetta `source` per routare al gruppo corretto:
 *   - 'newsletter'  → group Newsletter BMX Settimanale (form embed su /news/[slug] e landing)
 *   - 'signup'      → group Account Chrispy Maps (registrazione sito)
 *   - 'submit-spot' → group ChrispyMPS — Spot Submission
 * Default (source mancante) usa MAILERLITE_GROUP_ID dell'env.
 *
 * Risposta sempre 200 per non bloccare il flusso UX. Include `error` se MailerLite fallisce.
 */
export async function POST(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'));
  const body = await req.json().catch(() => ({}));
  const result = Schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { ok: false, error: 'Email non valida' },
      { status: 422, headers: cors },
    );
  }

  const { email, username, source } = result.data;
  const { ok, error, subscriberId } = await subscribeToNewsletter(
    email,
    username ?? email.split('@')[0],
    { source },
  );

  return NextResponse.json({ ok, error, subscriberId }, { headers: cors });
}
