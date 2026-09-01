/**
 * Brevo — iscrizione newsletter (API v3)
 *
 * Rimpiazza MailerLite. Stessa interfaccia di lib/mailerlite.ts, cosi i chiamanti
 * non cambiano: l'unica differenza e da quale modulo importano.
 *
 * Env vars necessarie:
 *   BREVO_API_KEY            — Brevo > SMTP & API > API Keys
 *   BREVO_LIST_NEWSLETTER    — id lista "Newsletter BMX Settimanale"
 *   BREVO_LIST_SIGNUP        — id lista "Account Chrispy Maps"
 *   BREVO_LIST_SUBMIT_SPOT   — id lista "ChrispyMPS - Spot Submission"
 *   BREVO_DOI_TEMPLATE_ID    — (opzionale) id template double opt-in
 *
 * Consenso: se BREVO_DOI_TEMPLATE_ID e' valorizzato usa il double opt-in
 * (l'iscritto conferma via email prima di entrare in lista). Senza template
 * configurato ricade sul single opt-in, che replica il comportamento MailerLite
 * attuale. Vedi GDPR-04.1 in SECURITY_PRIVACY_AUDIT.md.
 */

import type { SubscribeResult, SubscribeOpts, SubscribeSource } from './newsletter';

const BREVO_API = 'https://api.brevo.com/v3';

/** Le liste Brevo hanno id numerici assegnati alla creazione: vivono in env, non hardcoded. */
function listIdFor(source: SubscribeSource | undefined): string | undefined {
  if (!source) return undefined;
  const bySource: Record<SubscribeSource, string | undefined> = {
    'newsletter':  process.env.BREVO_LIST_NEWSLETTER,
    'signup':      process.env.BREVO_LIST_SIGNUP,
    'submit-spot': process.env.BREVO_LIST_SUBMIT_SPOT,
  };
  return bySource[source];
}

/** Estrae il messaggio d'errore SENZA loggare il body: contiene l'email. Vedi SEC-12.1. */
async function errorMessage(res: Response): Promise<string> {
  const json = await res.json().catch(() => ({} as Record<string, unknown>));
  return (json as { message?: string })?.message || `HTTP ${res.status}`;
}

export async function subscribeToNewsletter(
  email: string,
  name: string,
  opts: SubscribeOpts = {},
): Promise<SubscribeResult> {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    console.warn('[Brevo] BREVO_API_KEY mancante — skip');
    return { ok: false, error: 'Newsletter non configurata' };
  }

  const listId = opts.listId ?? listIdFor(opts.source) ?? process.env.BREVO_LIST_NEWSLETTER;
  const listIds = listId ? [Number(listId)] : undefined;

  if (listId && Number.isNaN(Number(listId))) {
    console.error('[Brevo] list id non numerico:', listId);
    return { ok: false, error: 'Lista newsletter non configurata' };
  }

  const attributes: Record<string, string> = { NOME: name };
  if (opts.instagram) attributes.INSTAGRAM = opts.instagram;

  const headers = {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
    'api-key':      apiKey,
  };

  const doiTemplateId = process.env.BREVO_DOI_TEMPLATE_ID;

  try {
    // ---- Percorso double opt-in: il contatto entra in lista solo dopo conferma ----
    if (doiTemplateId && listIds) {
      const res = await fetch(`${BREVO_API}/contacts/doubleOptinConfirmation`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email,
          attributes,
          includeListIds: listIds,
          templateId: Number(doiTemplateId),
          redirectionUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://chrispybmx.com'}/newsletter-grazie`,
        }),
      });

      if (!res.ok) {
        const message = await errorMessage(res);
        console.error('[Brevo] doi failed:', res.status);
        return { ok: false, error: `Brevo: ${message}` };
      }

      // La risposta DOI e' vuota: nessun id da restituire finche' non conferma.
      return { ok: true, pendingConfirmation: true };
    }

    // ---- Percorso single opt-in ----
    // updateEnabled:true e' obbligatorio: senza, un contatto gia' esistente
    // (re-iscrizione) risponde 4xx invece di aggiornare.
    const res = await fetch(`${BREVO_API}/contacts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        attributes,
        updateEnabled: true,
        ...(listIds ? { listIds } : {}),
      }),
    });

    if (!res.ok) {
      const message = await errorMessage(res);
      console.error('[Brevo] subscribe failed:', res.status);
      return { ok: false, error: `Brevo: ${message}` };
    }

    // 201 = creato, body { id }. 204 = aggiornato, nessun body.
    const json = await res.json().catch(() => ({} as Record<string, unknown>));
    const id = (json as { id?: number })?.id;

    return { ok: true, subscriberId: id !== undefined ? String(id) : undefined };
  } catch (err) {
    console.error('[Brevo] network error:', err);
    return { ok: false, error: 'Errore rete Brevo' };
  }
}
