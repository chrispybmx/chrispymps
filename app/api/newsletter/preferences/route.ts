import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { newsletterBody,newsletterUser } from '@/lib/newsletter-http';
import { newsletterPreferencesEnabled,newsletterStatus,chooseNewsletter } from '@/lib/newsletter-preferences';
import { NEWSLETTER_CONSENT_VERSION } from '@/lib/newsletter-consent';
import { supabaseAdmin } from '@/lib/supabase';
import { puoRicevereMarketing } from '@/lib/rider-profile';
import { checkRateLimit } from '@/lib/rate-limit';
const headers={'Cache-Control':'no-store'};
const Schema=z.object({enabled:z.boolean(),consentVersion:z.literal(NEWSLETTER_CONSENT_VERSION).optional(),over16:z.boolean().optional()}).strict();
export async function GET(req:NextRequest){
  const user=await newsletterUser(req);
  if(!user)return NextResponse.json({ok:false},{status:401,headers});
  if(!newsletterPreferencesEnabled())return NextResponse.json({ok:false,error:'Preferenze newsletter temporaneamente non disponibili.'},{status:503,headers});
  try{return NextResponse.json({ok:true,...await newsletterStatus(user.email!)},{headers});}
  catch{return NextResponse.json({ok:false,error:'Non riesco a verificare lo stato su MailerLite. Riprova.'},{status:503,headers});}
}
export async function POST(req:NextRequest){
  const user=await newsletterUser(req);
  if(!user)return NextResponse.json({ok:false},{status:401,headers});
  if(!newsletterPreferencesEnabled())return NextResponse.json({ok:false,error:'Preferenze newsletter temporaneamente non disponibili.'},{status:503,headers});
  if(!(await checkRateLimit(`newsletter-choice:${user.id}`,10,60000)).allowed)return NextResponse.json({ok:false,error:'Attendi un minuto e riprova.'},{status:429,headers});
  const parsed=Schema.safeParse(await newsletterBody(req).catch(()=>null));
  if(!parsed.success || (parsed.data.enabled && (parsed.data.over16!==true || parsed.data.consentVersion!==NEWSLETTER_CONSENT_VERSION)))return NextResponse.json({ok:false,error:'Conferma il testo del consenso e di avere almeno 16 anni.'},{status:422,headers});
  if(parsed.data.enabled){
    const {data,error}=await supabaseAdmin().from('rider_details').select('birth_date').eq('user_id',user.id).maybeSingle();
    if(error)return NextResponse.json({ok:false,error:'Verifica del profilo non disponibile.'},{status:503,headers});
    if(data?.birth_date && !puoRicevereMarketing(data.birth_date))return NextResponse.json({ok:false,error:'La newsletter è riservata a chi ha almeno 16 anni.'},{status:422,headers});
  }
  try {
    const synced=await chooseNewsletter(user.email!,parsed.data.enabled,'profile');
    return NextResponse.json({ok:true,pending:!synced,enabled:parsed.data.enabled,message:synced?(parsed.data.enabled?'Newsletter attivata.':'Newsletter disattivata.'):'Scelta salvata. MailerLite non ha ancora confermato la modifica; la sincronizzazione verrà ritentata.'},{status:synced?200:202,headers});
  }catch{return NextResponse.json({ok:false,error:'Non riesco a salvare la scelta. Riprova.'},{status:503,headers});}
}
