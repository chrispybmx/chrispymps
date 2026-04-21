/**
 * Iscrizione alla newsletter MailerLite — gruppo "Mappe"
 * https://api.mailerlite.com/api/v2/groups/{group_id}/subscribers
 */

const MAILERLITE_API_URL = 'https://api.mailerlite.com/api/v2';

export async function subscribeToMappe(email: string, name: string): Promise<boolean> {
  const apiKey  = process.env.MAILERLITE_API_KEY;
  const groupId = process.env.MAILERLITE_GROUP_ID; // ID del gruppo "Mappe" in MailerLite

  if (!apiKey || !groupId) {
    console.warn('[MailerLite] API key o group ID mancanti — skip iscrizione');
    return false;
  }

  try {
    const res = await fetch(`${MAILERLITE_API_URL}/groups/${groupId}/subscribers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MailerLite-ApiKey': apiKey,
      },
      body: JSON.stringify({
        email,
        name,
        resubscribe: true, // se si è già iscritti, aggiorna senza errore
        fields: {
          source: 'ChrispyMPS',
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[MailerLite] Errore iscrizione:', res.status, err);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[MailerLite] Errore di rete:', err);
    return false;
  }
}
