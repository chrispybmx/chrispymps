import { NextRequest } from 'next/server';
import { privateJson,sessionBody } from '@/lib/session-invites-server';
import { riderRequest } from '@/lib/rider-sessions';
import { localSessionPreview,previewDatabase } from '@/lib/rider-preview-server';
import { PREVIEW_ACTOR,PREVIEW_TOKEN } from '@/lib/rider-preview';
import { z } from 'zod';
export const dynamic='force-dynamic';
async function handle(req:NextRequest,write:boolean) {
 if(!localSessionPreview(req.headers.get('host')))return privateJson({ok:false},404);
 if(req.headers.get('authorization')!==`Bearer ${PREVIEW_TOKEN}`)return privateJson({ok:false},401);
 try {
  const db=await previewDatabase();let result;
  if(write){
   const body=await sessionBody(req);
   if(body&&typeof body==='object'&&'demoDraft' in body) {
    const input=z.object({id:z.string().uuid(),name:z.string().trim().min(2).max(120),lat:z.number().min(-90).max(90),lon:z.number().min(-180).max(180)}).strict().parse(body.demoDraft);
    await db.query("insert into spots(id,name,slug,status,submitted_by_user_id,lat,lon) values($1,$2,$3,'pending',$4,$5,$6) on conflict(id) do nothing",[input.id,input.name,`bozza-${input.id}`,PREVIEW_ACTOR,input.lat,input.lon]);
    const saved=await db.query<{id:string;name:string;slug:string;lat:number;lon:number}>("select id,name,slug,lat,lon from spots where id=$1 and submitted_by_user_id=$2 and status='pending'",[input.id,PREVIEW_ACTOR]);
    if(!saved.rows[0])return privateJson({ok:false,error:'Bozza non disponibile.'},409);
    return privateJson({ok:true,spot:{...saved.rows[0],type:'street',condition:'alive'}});
   }else if(body&&typeof body==='object'&&'demoExpire' in body) {
    await db.query("update cm_rider_sessions set started_at=now()-interval '3 hours',deadline_at=now()-interval '1 hour' where user_id=$1 and status='active'",[PREVIEW_ACTOR]);
    result=await db.query('select cm_rider_snapshot($1) as data',[PREVIEW_ACTOR]);
   } else {
    const input=riderRequest.parse(body);
    result=await db.query('select cm_rider_command($1,$2,$3) as data',[PREVIEW_ACTOR,input.requestId,JSON.stringify(input.command)]);
   }
  }else if(req.nextUrl.searchParams.get('live')==='1'){
   result=await db.query('select cm_rider_live_map($1) as data',[PREVIEW_ACTOR]);
  }else if(req.nextUrl.searchParams.has('spotId')){
   result=await db.query('select cm_rider_presence($1,$2) as data',[PREVIEW_ACTOR,z.string().uuid().parse(req.nextUrl.searchParams.get('spotId'))]);
  }else result=await db.query('select cm_rider_snapshot($1) as data',[PREVIEW_ACTOR]);
  return privateJson({ok:true,data:(result.rows[0] as {data:unknown}).data});
 }catch{return privateJson({ok:false,error:'Operazione demo non valida. Aggiorna e controlla l’orario.'},422);}
}
export const GET=(req:NextRequest)=>handle(req,false);
export const POST=(req:NextRequest)=>handle(req,true);
