/**
 * Newsletter — facade sul provider email.
 *
 * Esiste per rendere la migrazione MailerLite -> Brevo reversibile senza deploy:
 * il provider si sceglie da env, non da codice. I chiamanti importano solo da qui.
 *
 *   NEWSLETTER_PROVIDER = 'mailerlite' | 'brevo' | 'both'
 *
 *   mailerlite  stato attuale (default finche' MAILERLITE_API_KEY e' presente)
 *   both        MailerLite resta la fonte di verita', Brevo riceve una copia di
 *               ogni nuovo iscritto. Serve a popolare Brevo durante le settimane
 *               di prova senza rischiare di perdere iscrizioni.
 *   brevo       cutover completato.
 *
 * Se la variabile non e' impostata il default e' il comportamento di oggi:
 * MailerLite se configurato, Brevo solo se MailerLite non c'e' piu'.
 */

export type SubscribeSource = 'newsletter' | 'signup' | 'submit-spot';

export interface SubscribeResult {
  ok: boolean;
  error?: string;
  subscriberId?: string;
  /** true = iscritto creato ma in attesa che confermi via email (double opt-in). */
  pendingConfirmation?: boolean;
}

export interface SubscribeOpts {
  instagram?: string;
  /** MailerLite */
  groupId?: string;
  /** Brevo */
  listId?: string;
  source?: SubscribeSource;
}

type Provider = 'mailerlite' | 'brevo' | 'both';

function activeProvider(): Provider {
  const configured = process.env.NEWSLETTER_PROVIDER;
  if (configured === 'brevo' || configured === 'both' || configured === 'mailerlite') {
    return configured;
  }
  // Default: non cambiare comportamento a nessuno che non l'abbia chiesto.
  return process.env.MAILERLITE_API_KEY ? 'mailerlite' : 'brevo';
}

export async function subscribeToNewsletter(
  email: string,
  name: string,
  opts: SubscribeOpts = {},
): Promise<SubscribeResult> {
  const provider = activeProvider();

  if (provider === 'brevo') {
    const { subscribeToNewsletter: brevo } = await import('./brevo');
    return brevo(email, name, opts);
  }

  const { subscribeToNewsletter: mailerlite } = await import('./mailerlite');

  if (provider === 'both') {
    // Copia in Brevo: non deve mai influenzare l'esito ne' bloccare la risposta.
    import('./brevo')
      .then(({ subscribeToNewsletter: brevo }) => brevo(email, name, opts))
      .then((r) => {
        if (!r.ok) console.warn('[newsletter] copia Brevo fallita:', r.error);
      })
      .catch((err) => console.warn('[newsletter] copia Brevo errore:', err));
  }

  return mailerlite(email, name, opts);
}
