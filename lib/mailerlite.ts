/**
 * MailerLite — iscrizione newsletter
 * Usa la nuova API Connect (Bearer token).
 * Fallback silenzioso: non blocca mai il submit dello spot.
 *
 * Env vars necessarie:
 *   MAILERLITE_API_KEY  — chiave da Account > Integrations > API
 *   MAILERLITE_GROUP_ID — (opzionale) ID del gruppo a cui aggiungere l'iscritto
 */

const ML_API = 'https://connect.mailerlite.com/api';

export async function subscribeToNewsletter(
  email: string,
  name: string,
  instagram?: string,
): Promise<boolean> {
  const apiKey  = process.env.MAILERLITE_API_KEY;
  const groupId = process.env.MAILERLITE_GROUP_ID;

  if (!apiKey) {
    console.warn('[MailerLite] MAILERLITE_API_KEY mancante — skip');
    return false;
  }

  try {
    const body: Record<string, unknown> = {
      email,
      fields: {
        name,
        last_name: '',
        ...(instagram ? { instagram } : {}),
      },
      status: 'active',
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

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[MailerLite] subscribe error', res.status, txt);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[MailerLite] network error:', err);
    return false;
  }
}

/** @deprecated usa subscribeToNewsletter */
export const subscribeToMappe = subscribeToNewsletter;
