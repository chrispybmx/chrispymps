/**
 * MailerLite — iscrizione newsletter
 * Usa la nuova API Connect (Bearer token).
 * Fallback silenzioso lato chiamante: non blocca mai il submit dello spot.
 *
 * Env vars necessarie:
 *   MAILERLITE_API_KEY  — chiave da Account > Integrations > API
 *   MAILERLITE_GROUP_ID — (opzionale) gruppo di default se non passato in opts.groupId
 *
 * status: 'active' = single opt-in. Subscriber attivo subito.
 * Consenso GDPR coperto da: testo form esplicito + privacy policy + unsubscribe in ogni mail.
 */

const ML_API = 'https://connect.mailerlite.com/api';

export interface SubscribeResult {
  ok: boolean;
  error?: string;
  subscriberId?: string;
}

export type SubscribeSource = 'newsletter' | 'signup' | 'submit-spot';

export const GROUP_BY_SOURCE: Record<SubscribeSource, string> = {
  'newsletter':  '186569732865918849', // Newsletter BMX Settimanale
  'signup':      '188059390435132622', // Account Chrispy Maps
  'submit-spot': '185532080718873760', // ChrispyMPS — Spot Submission
};

export interface SubscribeOpts {
  instagram?: string;
  groupId?:   string;
  source?:    SubscribeSource;
}

export async function subscribeToNewsletter(
  email: string,
  name: string,
  opts: SubscribeOpts = {},
): Promise<SubscribeResult> {
  const apiKey = process.env.MAILERLITE_API_KEY;

  if (!apiKey) {
    console.warn('[MailerLite] MAILERLITE_API_KEY mancante — skip');
    return { ok: false, error: 'Newsletter non configurata' };
  }

  const groupId =
    opts.groupId ??
    (opts.source ? GROUP_BY_SOURCE[opts.source] : undefined) ??
    process.env.MAILERLITE_GROUP_ID;

  try {
    const body: Record<string, unknown> = {
      email,
      fields: {
        name,
        last_name: '',
        ...(opts.instagram ? { instagram: opts.instagram } : {}),
      },
      status: 'active', // single opt-in: subscriber attivo subito
      ...(groupId ? { groups: [groupId] } : {}),
    };

    const res = await fetch(`${ML_API}/subscribers`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => ({} as Record<string, unknown>));

    if (!res.ok) {
      const message = (json as { message?: string })?.message || `HTTP ${res.status}`;
      console.error('[MailerLite] subscribe failed:', res.status, json);
      return { ok: false, error: `MailerLite: ${message}` };
    }

    const subscriberId = (json as { data?: { id?: string } })?.data?.id;
    return { ok: true, subscriberId };
  } catch (err) {
    console.error('[MailerLite] network error:', err);
    return { ok: false, error: 'Errore rete MailerLite' };
  }
}
