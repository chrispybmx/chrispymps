import { NextRequest, NextResponse } from 'next/server';
import { registrationDetails } from '@/lib/registration';
import { sessionBody, SessionApiError } from '@/lib/session-invites-server';

export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:NextRequest) {
 try {
  const parsed=registrationDetails().safeParse(await sessionBody(req));
  if(!parsed.success)return reply({ok:false,error:parsed.error.issues[0].message},422);
  // The Auth hook enforces the same policy for direct SDK calls. This preflight
  // prevents the normal form promising confirmation while autoconfirm is enabled.
  const response=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,{
   headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!},cache:'no-store',signal:AbortSignal.timeout(5000),
  });
  const settings=await response.json();
  if(!response.ok||settings.mailer_autoconfirm!==false||settings.external?.email!==true)
   return reply({ok:false,error:'Registrazione temporaneamente non disponibile. Riprova piu tardi.'},503);
  return reply({ok:true});
 }catch(error){
  if(error instanceof SessionApiError)return reply({ok:false,error:'Dati non validi.'},error.code==='TOO_LARGE'?413:400);
  return reply({ok:false,error:'Impossibile verificare la registrazione. Riprova.'},503);
 }
}
