import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase';

/** Auth's confirmed_at can come from historical autoconfirm, not an email click. */
export function hasEmailProof(user:User):boolean {
 const proof=user.app_metadata?.cm_email_proof;
 return !!user.email_confirmed_at && !!user.email && proof?.method==='email_link'
  && proof.email===user.email.trim().toLowerCase()
  && typeof proof.verified_at==='string' && Number.isFinite(Date.parse(proof.verified_at));
}

/** Call only after successful verifyOtp, never from client-supplied claims. */
export async function recordEmailProof(user:User):Promise<void> {
 if(!user.email||!user.email_confirmed_at)throw new Error('EMAIL_NOT_VERIFIED');
 const {error}=await supabaseAdmin().auth.admin.updateUserById(user.id,{
  app_metadata:{cm_email_proof:{email:user.email.trim().toLowerCase(),method:'email_link',verified_at:new Date().toISOString()}},
 });
 if(error)throw new Error('EMAIL_PROOF_UNAVAILABLE');
}
