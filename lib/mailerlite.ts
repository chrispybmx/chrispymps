/**
 * MailerLite — iscrizione newsletter
 * Usa la nuova API Connect (Bearer token).
 * Fallback silenzioso lato chiamante: non blocca mai il submit dello spot.
 *
 * Env vars necessarie:
 *   MAILERLITE_API_KEY  — chiave da Account > Integrations > API
 *   MAILERLITE_GROUP_ID — (opzionale) ID del gruppo a cui aggiungere l'iscritto
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

export async function subscribeToNewsletter(
  email: string,
  name: string,
  instagram?: string,
): Promise<SubscribeResult> {
  const apiKey  = process.env.MAILERLITE_API_KEY;
  const groupId = process.env.MAILERLITE_GROUP_ID;

  if (!apiKey) {
    console.warn('[MailerLite] MAILERLITE_API_KEY mancante — skip');
    return { ok: false, error: 'Newsletter non configurata' };
  }

  try {
    const body: Record<string, unknown> = {
      email,
      fields: {
        name,
        last_name: '',
        ...(instagram ? { instagram } : {}),
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

/** @deprecated usa subscribeToNewsletter */
export const subscribeToMappe = subscribeToNewsletter;
