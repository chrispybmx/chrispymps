import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase';
import { APP_CONFIG } from '@/lib/constants';
import { NEWSLETTER_CONSENT_TEXT, NEWSLETTER_CONSENT_VERSION, NEWSLETTER_WITHDRAWAL_TEXT } from './newsletter-consent';
import { newsletterMembership, setNewsletterMembership } from './mailerlite-preferences';

export const newsletterPreferencesEnabled = () => process.env.NEWSLETTER_CONSENT_ENABLED === 'true';
export const normalizeNewsletterEmail = (email: string) => email.trim().toLowerCase();
export const confirmationHash = (token: string) => createHash('sha256').update(token).digest('hex');

/** A failed schema/proof write must never be followed by an email/provider write. */
export async function chooseNewsletter(email: string, enabled: boolean, source: 'profile'|'signup'|'provider'|'account_delete') {
  email = normalizeNewsletterEmail(email);
  const { error } = await supabaseAdmin().rpc('cm_newsletter_choose', {
    p_email: email, p_enabled: enabled, p_version: NEWSLETTER_CONSENT_VERSION,
    p_text: enabled ? NEWSLETTER_CONSENT_TEXT : NEWSLETTER_WITHDRAWAL_TEXT, p_source: source,
  });
  if (error) throw new Error('Preferenza non salvata. Riprova.');
  return syncNewsletter(email);
}

/** Serial lease + revision acknowledgement: late replies cannot erase newer choices. */
export async function syncNewsletter(email: string): Promise<boolean> {
  const sb = supabaseAdmin();
  for (let pass=0; pass<2; pass++) {
    const lease = randomUUID();
    const { data, error } = await sb.rpc('cm_newsletter_claim', { p_email: email, p_lease: lease });
    if (error) throw new Error('Sincronizzazione non disponibile.');
    const job = data?.[0];
    if (!job) {
      const result = await sb.from('cm_newsletter_preferences').select('sync_pending').eq('email', email).maybeSingle();
      if (result.error) throw new Error('Stato non disponibile.');
      return result.data?.sync_pending === false;
    }
    let failure: 'provider_unavailable'|'provider_suppressed'|null = null;
    try { await setNewsletterMembership(email, job.enabled); }
    catch (error) { failure = error instanceof Error && error.message === 'provider_suppressed' ? 'provider_suppressed' : 'provider_unavailable'; }
    const done = await sb.rpc('cm_newsletter_finish', { p_email: email, p_revision: job.revision, p_lease: lease, p_error: failure });
    if (done.error || failure) return false;
  }
  const result = await sb.from('cm_newsletter_preferences').select('sync_pending').eq('email', email).maybeSingle();
  return !result.error && result.data?.sync_pending === false;
}

export async function newsletterStatus(email: string) {
  email = normalizeNewsletterEmail(email);
  const result = await supabaseAdmin().from('cm_newsletter_preferences').select('enabled,sync_pending,last_error').eq('email', email).maybeSingle();
  if (result.error) throw new Error('Preferenze non disponibili.');
  // Provider status wins over an old local flag, including unsubscribe links in email.
  const provider = await newsletterMembership(email);
  return { enabled: provider.active, requested: result.data?.enabled ?? provider.active,
    pending: result.data?.sync_pending ?? false, suppressed: provider.suppressed };
}

export async function requestNewsletterConfirmation(email: string) {
  email = normalizeNewsletterEmail(email);
  const token = randomBytes(32).toString('hex');
  const hash = confirmationHash(token);
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc('cm_newsletter_request', { p_email: email, p_hash: hash, p_version: NEWSLETTER_CONSENT_VERSION, p_text: NEWSLETTER_CONSENT_TEXT });
  if (error) throw new Error('Iscrizione non disponibile. Riprova.');
  if (!data) return; // Generic response, per-address cooldown without enumeration.
  const base = new URL(process.env.NEWSLETTER_SITE_URL || APP_CONFIG.url);
  if (base.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(base.hostname)) throw new Error('Indirizzo del sito non configurato.');
  const link = `${base.origin}/newsletter/conferma#${token}`;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: 'Chrispy Maps <noreply@chrispybmx.com>', to: email,
      subject: 'Conferma la newsletter di Chrispy Maps',
      text: `Hai richiesto la newsletter BMX di Chrispy Maps. Conferma entro 24 ore aprendo questo link e premendo Conferma:\n${link}\n\nSe non l’hai richiesto, ignora questa email: non sarai iscritto.\nInformativa: ${base.origin}/privacy#newsletter`,
    });
    if (result.error) throw new Error('email_failed');
  } catch {
    // Permit a fresh request after delivery failure; do not erase a newer token.
    await sb.from('cm_newsletter_confirmations').delete().eq('email', email).eq('token_hash', hash);
    throw new Error('Non riesco a inviare la conferma. Riprova.');
  }
}

export async function confirmNewsletter(token: string) {
  const { data: email, error } = await supabaseAdmin().rpc('cm_newsletter_confirm', { p_hash: confirmationHash(token) });
  if (error) throw new Error('Conferma non disponibile. Riprova.');
  if (!email) return null;
  const synced = await syncNewsletter(email);
  const state = await supabaseAdmin().from('cm_newsletter_preferences').select('last_error').eq('email',email).maybeSingle();
  return { synced, blocked: state.data?.last_error === 'provider_suppressed' };
}
