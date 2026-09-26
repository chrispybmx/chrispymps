import { NextRequest,NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { newsletterPreferencesEnabled,syncNewsletter } from '@/lib/newsletter-preferences';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(req:NextRequest){
 const key=process.env.CRON_SECRET; const expected=`Bearer ${key}`,actual=req.headers.get('authorization')??'';
 if(!key || Buffer.byteLength(actual)!==Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return new NextResponse(null,{status:401});
 try{
  const sb=supabaseAdmin();
  const purge=await sb.rpc('cm_newsletter_purge'); if(purge.error)throw purge.error;
  if(!newsletterPreferencesEnabled())return NextResponse.json({ok:true,enabled:false,purged:true});
  const {data,error}=await sb.from('cm_newsletter_preferences').select('email').eq('sync_pending',true).lt('attempts',8).lte('next_attempt_at',new Date().toISOString()).order('next_attempt_at').limit(3);
  if(error)throw error;
  const results=await Promise.all((data??[]).map(row=>syncNewsletter(row.email).catch(()=>false)));
  const failed=results.filter(done=>!done).length;
  const exhausted=await sb.from('cm_newsletter_preferences').select('email',{count:'exact',head:true}).eq('sync_pending',true).gte('attempts',8);
  if(exhausted.error)throw exhausted.error;
  const ok=!failed && !exhausted.count;
  return NextResponse.json({ok,processed:results.length,pending:failed,requiresReview:exhausted.count??0},{status:ok?200:503,headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({ok:false},{status:503});}
}
