import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabasePublic } from '@/lib/supabase';
import { hasEmailProof } from '@/lib/email-verification';
import { checkRateLimit } from '@/lib/rate-limit';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function handle(req:NextRequest,send:boolean) {
 try {
  const token=req.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if(!token)return reply({ok:false},401);
  const {data:{user},error}=await supabaseAdmin().auth.getUser(token);
  if(error||!user?.email)return reply({ok:false},401);
  const verified=hasEmailProof(user);
  const enabled=process.env.EMAIL_VERIFICATION_ENABLED==='true';
  if(!send||verified)return reply({ok:true,verified,enabled});
  if(!enabled)return reply({ok:false,error:'Verifica email in preparazione.'},503);
  const limit=await checkRateLimit(`verify-email:${user.id}`,1,60000);
  if(!limit.allowed)return reply({ok:false,error:'Attendi un minuto prima di richiedere un altro link.'},429);
  const origin=new URL(process.env.NEXT_PUBLIC_SITE_URL||'https://maps.chrispybmx.com');
  const redirect=new URL('/auth/callback?flow=email&next=%2Fmap',origin);
  // Use only the verified token's address. A request cannot send to another user
  // or create an account, nor set verification from the browser.
  const result=await supabasePublic().auth.signInWithOtp({email:user.email,options:{shouldCreateUser:false,emailRedirectTo:redirect.toString()}});
  if(result.error)return reply({ok:false,error:'Invio non riuscito. Riprova piu tardi.'},503);
  return reply({ok:true,sent:true,verified:false});
 }catch{return reply({ok:false,error:'Verifica non disponibile. Riprova.'},503);}
}
export const GET=(req:NextRequest)=>handle(req,false);
export const POST=(req:NextRequest)=>handle(req,true);
