import { NextRequest, NextResponse } from 'next/server';
import { subscribeToNewsletter } from '@/lib/newsletter';
import { z } from 'zod';

const Schema = z.object({
  email:           z.string().email().max(254),
  username:        z.string().max(50).optional(),
  source:          z.enum(['newsletter', 'signup', 'submit-spot']).optional(),
  alsoNewsletter:  z.boolean().optional(),
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
 * Iscrive un utente a MailerLite.
 * Default: sempre 'submit-spot' (ChrispyMPS — Spot Submission).
 * Se alsoNewsletter=true: iscrive ANCHE a 'newsletter' (Newsletter BMX Settimanale).
 * Risposta sempre 200 per non bloccare il flusso UX.
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

  const { email, username, source, alsoNewsletter } = result.data;
  const name = username ?? email.split('@')[0];
  const mainSource = source ?? 'submit-spot';

  const { ok, error, subscriberId } = await subscribeToNewsletter(email, name, { source: mainSource });

  if (alsoNewsletter && ok) {
    await subscribeToNewsletter(email, name, { source: 'newsletter' });
  }

  return NextResponse.json({ ok, error, subscriberId }, { headers: cors });
}
