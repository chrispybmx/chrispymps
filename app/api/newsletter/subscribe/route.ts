import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { newsletterBody, allowedNewsletterOrigin, newsletterOrigins, newsletterUser } from '@/lib/newsletter-http';
import { newsletterPreferencesEnabled, requestNewsletterConfirmation } from '@/lib/newsletter-preferences';
import { NEWSLETTER_CONSENT_VERSION } from '@/lib/newsletter-consent';
import { subscribeToNewsletter } from '@/lib/newsletter';
const Schema = z.object({ email:z.string().trim().email().max(254), username:z.string().max(50).optional(), source:z.literal('newsletter'), consent:z.literal(true), over16:z.literal(true), consentVersion:z.literal(NEWSLETTER_CONSENT_VERSION) }).strict();
function headers(req: NextRequest): Record<string,string> {
  const origin=req.headers.get('origin');
  return { 'Cache-Control':'no-store', ...(origin && newsletterOrigins.has(origin) ? { 'Access-Control-Allow-Origin':origin, Vary:'Origin' } : {}) };
}
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null,{status:204,headers:{...headers(req),'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'}});
}
export async function POST(req: NextRequest) {
  const h=headers(req);
  if(!allowedNewsletterOrigin(req)) return NextResponse.json({ok:false},{status:403,headers:h});
  let body; try {body=await newsletterBody(req);}catch{return NextResponse.json({ok:false,error:'Richiesta non valida.'},{status:400,headers:h});}
  // Existing welcome callers are bound to the authenticated account, never a supplied email.
  if(body?.source==='submit-spot' || body?.source==='signup') {
    const user=await newsletterUser(req);
    if(!user) return NextResponse.json({ok:false,error:'Accedi con un account confermato.'},{status:401,headers:h});
    const result=await subscribeToNewsletter(user.email!,String(user.user_metadata?.username??'').slice(0,50),{source:'submit-spot'});
    return NextResponse.json({ok:result.ok},{status:result.ok?200:503,headers:h});
  }
  const parsed=Schema.safeParse(body);
  if(!parsed.success) return NextResponse.json({ok:false,error:'Conferma il consenso alla newsletter e di avere almeno 16 anni.'},{status:422,headers:h});
  if(!newsletterPreferencesEnabled()) return NextResponse.json({ok:false,error:'Iscrizioni temporaneamente non disponibili. Riprova più tardi.'},{status:503,headers:h});
  try {
    await requestNewsletterConfirmation(parsed.data.email);
    return NextResponse.json({ok:true,pendingConfirmation:true,message:'Controlla la tua email e conferma l’iscrizione entro 24 ore.'},{status:202,headers:h});
  } catch {return NextResponse.json({ok:false,error:'Non riesco a inviare la conferma. Riprova più tardi.'},{status:503,headers:h});}
}
