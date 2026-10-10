import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { privateJson, sessionBody } from '@/lib/session-invites-server';
import { riderRequest } from '@/lib/rider-sessions';
export const dynamic='force-dynamic';
const errors:Record<string,[number,string]>={
 TOO_LARGE:[413,'Richiesta troppo grande.'],
 UNAUTHORIZED:[401,'Accedi per gestire le tue sessioni.'], INVALID_INPUT:[422,'Controlla i dati e l’orario di fine.'],
 NOT_FOUND:[404,'Sessione non disponibile.'], ACTIVE_SESSION:[409,'Hai già una sessione attiva in un altro spot.'],
 SHARING_DISABLED:[403,'La presenza Community non è disponibile per questo account.'],
 SPOT_UNAVAILABLE:[409,'Questo spot non è disponibile.'], EXPIRED:[409,'La sessione è scaduta: conferma l’orario di fine.'],
 STALE_SESSION:[409,'La sessione è cambiata. Aggiorna prima di correggerla.'],
 INVALID_STATE:[409,'Termina la sessione prima di correggerla.'],
 IDEMPOTENCY_CONFLICT:[409,'Richiesta già usata con dati diversi. Aggiorna la pagina.'],
};
async function handle(req:NextRequest,write:boolean) {
 if(process.env.RIDER_SESSIONS_ENABLED!=='true') return privateJson({ok:false,error:'Sessioni non ancora disponibili.'},503);
 try {
  const token=req.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if(!token) throw new Error('UNAUTHORIZED');
  const admin=supabaseAdmin(); const auth=await admin.auth.getUser(token);
  if(auth.error||!auth.data.user) throw new Error('UNAUTHORIZED');
  const actor=auth.data.user.id;
  let name='cm_rider_snapshot',args:Record<string,unknown>={actor};
  if(write) {
   const input=riderRequest.parse(await sessionBody(req)); name='cm_rider_command';
   args={actor,request_id:input.requestId,command:input.command};
  } else if(req.nextUrl.searchParams.get('live')==='1') {
   name='cm_rider_live_map';
  } else if(req.nextUrl.searchParams.has('spotId')) {
   name='cm_rider_presence'; args={actor,chosen_spot:z.string().uuid().parse(req.nextUrl.searchParams.get('spotId'))};
  }
  const {data,error}=await admin.rpc(name,args);
  if(error) {
   if(['42P01','42883','PGRST202','PGRST205'].includes(error.code)) return privateJson({ok:false,error:'Migrazione Sessioni non disponibile.'},503);
   throw new Error(error.message);
  }
  return privateJson({ok:true,data});
 } catch(error) {
  const code=error instanceof z.ZodError?'INVALID_INPUT':error instanceof Error?error.message:'INTERNAL';
  const [status,message]=errors[code]??[500,'Impossibile aggiornare le sessioni. Riprova.'];
  return privateJson({ok:false,error:message},status);
 }
}
export const GET=(req:NextRequest)=>handle(req,false);
export const POST=(req:NextRequest)=>handle(req,true);
