import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase';
import { subscribeToNewsletter } from './newsletter';
import { registrationDetails, validBirthDate } from './registration';
import { chooseNewsletter, requestNewsletterConfirmation } from './newsletter-preferences';
import { puoRicevereMarketing } from './rider-profile';
/** Runs only for a verified identity. Optional delivery never authorizes access. */
export async function completeAccount(user: User): Promise<{ profileReady: boolean; pending: boolean }> {
  if(!user.email_confirmed_at)return {profileReady:false,pending:true};
  const sb = supabaseAdmin();
  const { data: profile, error: readError } = await sb.from('profiles').select('username').eq('id', user.id).maybeSingle();
  if (readError) throw new Error('profile_read');
  const metadata = user.user_metadata ?? {};
  const username = typeof metadata.username === 'string' && /^[a-zA-Z0-9_-]{3,30}$/.test(metadata.username) ? metadata.username : null;
  if (!profile?.username) {
    if (!username) return { profileReady: false, pending: false };
    const { error } = await sb.from('profiles').upsert({ id: user.id, username }, { onConflict: 'id', ignoreDuplicates: true });
    if (error) return { profileReady: false, pending: false };
  }
  if (!metadata.onboarding_pending || !user.email_confirmed_at) return { profileReady: true, pending: false };
  let pending = false;
  const initial = metadata.initial_rider_details;
  if (initial && typeof initial === 'object') {
    const details=metadata.registration_version===2?registrationDetails().safeParse(initial):null;
    if(details&&!details.success)return {profileReady:true,pending:true};
    const birth = validBirthDate(initial.birthDate) ? initial.birthDate : null;
    const { error } = await sb.from('rider_details').upsert({ user_id: user.id, birth_date: birth, region: typeof initial.region === 'string' ? initial.region.slice(0, 60) : null,
      ...(details?.success?{country_code:details.data.countryCode,disciplines:details.data.disciplines.length?details.data.disciplines:null}:{})
    }, { onConflict: 'user_id', ignoreDuplicates: true });
    if (error) pending = true;
  }
  /* Newsletter spuntata alla registrazione: la conferma dell'email
     dell'account prova gia' che l'indirizzo e' suo, quindi vale come double
     opt-in e non serve una seconda email di conferma. L'eta' si ricontrolla
     qui perche' il flag arriva da user_metadata, scritto dal client.
     Con l'autoconferma di Supabase attiva nessuna email e' partita
     (confirmation_sent_at vuoto): la conferma non prova niente, quindi si
     manda la conferma della newsletter come per chi si iscrive senza account. */
  const newsletterRequested = metadata.newsletter_requested === true;
  let newsletterDone = false;
  if (newsletterRequested && user.email) {
    const birth = initial && typeof initial === 'object' && typeof initial.birthDate === 'string' ? initial.birthDate : null;
    const eligible = birth ? puoRicevereMarketing(birth) : metadata.newsletter_over16 === true;
    if (!eligible) newsletterDone = true;
    else {
      try {
        if (user.confirmation_sent_at) await chooseNewsletter(user.email, true, 'signup');
        else await requestNewsletterConfirmation(user.email);
        newsletterDone = true;
      } catch { pending = true; }
    }
  }
  // The operational welcome group is separate from marketing consent.
  if (user.email && !metadata.welcome_synced) {
    const result = await subscribeToNewsletter(user.email, profile?.username ?? username ?? '', { source: 'submit-spot' });
    if (!result.ok) pending = true;
    else metadata.welcome_synced = true;
  }
  const { error } = await sb.auth.admin.updateUserById(user.id, { user_metadata: {
    ...metadata, onboarding_pending: pending,
    ...(newsletterDone ? { newsletter_requested: null, newsletter_over16: null } : {}),
    ...(!pending ? { initial_rider_details: null } : {}),
  } });
  return { profileReady: true, pending: pending || !!error };
}
