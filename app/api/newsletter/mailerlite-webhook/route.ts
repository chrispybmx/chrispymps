import { NextRequest,NextResponse } from 'next/server';
import { createHmac,timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { newsletterPreferencesEnabled } from '@/lib/newsletter-preferences';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 const secret=process.env.MAILERLITE_WEBHOOK_SECRET;
 if(!secret || !newsletterPreferencesEnabled())return new NextResponse(null,{status:503});
 const reader=req.body?.getReader(); if(!reader)return new NextResponse(null,{status:400});
 let size=0;const chunks:Uint8Array[]=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();return new NextResponse(null,{status:413});}chunks.push(value);}
 const raw=Buffer.concat(chunks);const signature=req.headers.get('signature')??'';
 if(!/^[a-f0-9]{64}$/i.test(signature) || !timingSafeEqual(createHmac('sha256',secret).update(raw).digest(),Buffer.from(signature,'hex')))return new NextResponse(null,{status:401});
 let body;try{body=JSON.parse(raw.toString());}catch{return new NextResponse(null,{status:400});}
 if(!body || typeof body!=='object')return new NextResponse(null,{status:400});
 // Register this webhook as non-batchable, subscriber.unsubscribed only.
 if(body.event!=='subscriber.unsubscribed')return new NextResponse(null,{status:204});
 const parsed=z.object({email:z.string().trim().email().max(254),unsubscribed_at:z.string().nullable().optional(),updated_at:z.string()}).safeParse(body);
 if(!parsed.success)return new NextResponse(null,{status:400});
 const stamp=parsed.data.unsubscribed_at||parsed.data.updated_at;
 const utc=/Z$|[+-]\d\d:\d\d$/.test(stamp)?stamp:stamp.replace(' ','T')+'Z';
 const at=new Date(utc);
 if(!Number.isFinite(at.getTime()) || at.getTime()>Date.now()+300000)return new NextResponse(null,{status:400});
 const {error}=await supabaseAdmin().rpc('cm_newsletter_provider_withdraw',{p_email:parsed.data.email.toLowerCase(),p_at:at.toISOString()});
 return new NextResponse(null,{status:error?503:204});
}
