import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase';
import { APP_CONFIG } from '@/lib/constants';

export function sessionEmailEnabled() {
  return process.env.SESSION_INVITES_ENABLED === 'true' &&
    process.env.SESSION_INVITES_EMAIL_ENABLED === 'true' && !!process.env.RESEND_API_KEY;
}

/** Durable outbox worker. Never called in the invitation request path. */
export async function deliverSessionInviteEmail({ id }: { id: string; recipientId?: string }): Promise<'sent'|'skipped'|'retry'|'disabled'> {
  if (!sessionEmailEnabled()) return 'disabled';
  const sb = supabaseAdmin();
  const now = new Date();
  const lease = new Date(now.getTime() + 120_000).toISOString();
  const { data: job, error: claimError } = await sb.from('cm_session_email_outbox')
    .update({ locked_until: lease })
    .eq('invite_id', id).is('sent_at', null).lte('next_attempt_at', now.toISOString()).lt('attempts', 8)
    .or('locked_until.is.null,locked_until.lt.' + now.toISOString())
    .select('invite_id,recipient_id,attempts').maybeSingle();
  if (claimError) throw new Error('Impossibile acquisire il lavoro email.');
  if (!job) return 'skipped';

  try {
    const [{data:pref,error:prefError},{data:invite,error:inviteError}] = await Promise.all([
      sb.from('cm_session_preferences').select('email_enabled').eq('user_id',job.recipient_id).maybeSingle(),
      sb.from('cm_session_invites').select('status,starts_at,recipient_id').eq('id',id).maybeSingle(),
    ]);
    if (prefError || inviteError) throw new Error('Email eligibility unavailable');
    if (!pref?.email_enabled || !invite || invite.recipient_id !== job.recipient_id ||
        invite.status !== 'pending' || new Date(invite.starts_at).getTime() <= Date.now()) {
      const { error: removeError } = await sb.from('cm_session_email_outbox').delete().eq('invite_id',id).eq('locked_until',lease);
      if (removeError) throw new Error('Email cancellation unavailable');
      return 'skipped';
    }
    const {data, error} = await sb.auth.admin.getUserById(job.recipient_id);
    if (error || !data.user?.email) throw new Error('Recipient unavailable');
    const site = new URL(process.env.SESSION_INVITES_SITE_URL || APP_CONFIG.url);
    if (site.protocol !== 'https:' || site.username || site.password) throw new Error('Invalid session email origin');
    const inbox = site.origin + '/messaggi';
    const link = inbox + '?invite=' + encodeURIComponent(id);
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: 'Chrispy Maps <noreply@chrispybmx.com>',
      to: data.user.email,
      subject: 'Hai un invito a una session su Chrispy Maps',
      text: 'Un rider ti ha invitato a girare insieme. Apri Chrispy Maps per vedere la proposta e decidere se accettare.\n\n' +
        link + '\n\nRicevi questa email perché hai attivato gli avvisi per gli inviti. Puoi disattivarli nelle preferenze della pagina Messaggi: ' + inbox,
    }, { idempotencyKey: 'session-invite/' + id });
    if (result.error) throw new Error('Email provider unavailable');
    const {error:doneError} = await sb.from('cm_session_email_outbox')
      .update({sent_at:new Date().toISOString(),locked_until:null,last_error:null,attempts:job.attempts+1})
      .eq('invite_id',id).eq('locked_until',lease);
    if (doneError) throw new Error('Email acknowledgement unavailable');
    return 'sent';
  } catch {
    // Do not persist provider responses, addresses or conversation content in errors.
    const { error: retryError } = await sb.from('cm_session_email_outbox').update({
      attempts:job.attempts+1,locked_until:null,last_error:'Invio non completato, riprova pianificata.',
      next_attempt_at:new Date(Date.now()+Math.min(3_600_000,60_000*2**job.attempts)).toISOString(),
    }).eq('invite_id',id).eq('locked_until',lease);
    if (retryError) throw new Error('Impossibile pianificare il nuovo tentativo email.');
    return 'retry';
  }
}
