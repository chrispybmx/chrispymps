import { NextRequest,NextResponse } from 'next/server';
import { allowedNewsletterOrigin,newsletterBody } from '@/lib/newsletter-http';
import { confirmNewsletter,newsletterPreferencesEnabled } from '@/lib/newsletter-preferences';
export async function POST(req:NextRequest){
 const headers={'Cache-Control':'no-store'};
 if(!allowedNewsletterOrigin(req))return NextResponse.json({ok:false},{status:403,headers});
 if(!newsletterPreferencesEnabled())return NextResponse.json({ok:false,error:'Conferma temporaneamente non disponibile.'},{status:503,headers});
 const body=await newsletterBody(req).catch(()=>null);
 if(!body || typeof body.token!=='string' || !/^[a-f0-9]{64}$/.test(body.token))return NextResponse.json({ok:false,error:'Link non valido.'},{status:400,headers});
 try{
 const result=await confirmNewsletter(body.token);
 if(!result)return NextResponse.json({ok:false,error:'Il link è scaduto o è già stato utilizzato. Richiedi una nuova iscrizione se necessario.'},{status:410,headers});
 return NextResponse.json({ok:true,pending:!result.synced,message:result.blocked?'Consenso confermato, ma MailerLite mantiene questo indirizzo disiscritto o bloccato. Non è stato riattivato: scrivi a christian.ceresato@gmail.com per assistenza.':result.synced?'Iscrizione confermata.':'Consenso confermato. La sincronizzazione con MailerLite è in attesa; non devi confermare di nuovo.'},{headers});
 }catch{return NextResponse.json({ok:false,error:'Conferma non riuscita. Riprova più tardi.'},{status:503,headers});}
}
