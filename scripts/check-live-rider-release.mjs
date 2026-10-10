// Explicit live release check. Creates only temporary fixtures and cleans them up.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
if(!process.argv.includes('--allow-production'))throw new Error('Explicit --allow-production required');
const origin=process.env.SESSION_CHECK_ORIGIN;
if(!origin||!/^https:\/\/chrispymps-[a-z0-9]+-chrispybmxs-projects\.vercel\.app$/.test(origin))throw new Error('Expected immutable release deployment');
const env=dotenv.parse(fs.readFileSync('.env.production.local'));
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,options);
const anon=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options);
const users=[],spots=[],files=[];
const run=randomUUID().slice(0,8),imagePath=`/private/tmp/crock-release-${run}.png`;
function checked(result,label){if(result.error)throw new Error(`${label}: ${result.error.code||'request failed'}`);return result.data;}
function request(path,{token,body,form}={}){
 const config=['silent','show-error','max-time = 30','write-out = "\\nHTTP_STATUS:%{http_code}"'];
 if(token)config.push(`header = ${JSON.stringify(`Authorization: Bearer ${token}`)}`);
 if(body){config.push('request = "POST"','header = "Content-Type: application/json"',`data = ${JSON.stringify(JSON.stringify(body))}`);}
 if(form)for(const value of form)config.push(`form = ${JSON.stringify(value)}`);
 const cli=process.env.VERCEL_CLI;
 const args=['curl',path,'--deployment',origin,'--scope','chrispybmxs-projects','--','--config','-'];
 const raw=execFileSync(cli||'npx',cli?args:['--yes','vercel@62.1.0',...args],{
  env:{...process.env,npm_config_cache:'/private/tmp/crock-npm-cache'},input:config.join('\n'),encoding:'utf8',timeout:60000,stdio:['pipe','pipe','pipe'],maxBuffer:8*1024*1024,
 });
 const marker=raw.lastIndexOf('\nHTTP_STATUS:');if(marker<0)throw new Error('Missing HTTP status');
 const status=Number(raw.slice(marker+13));let data;try{data=JSON.parse(raw.slice(0,marker));}catch{data=null;}
 console.log(`${status} ${path}`);return {status,data};
}
function command(token,command,requestId=randomUUID(),expected=200){
 const r=request('/api/rider-sessions',{token,body:{command,requestId}});assert.equal(r.status,expected,command.action);return r.data?.data;
}
function snapshot(token){const r=request('/api/rider-sessions',{token});assert.equal(r.status,200);return r.data.data;}
try{
 for(let i=0;i<2;i++){
  const password=randomUUID()+randomUUID();
  const email=`cm-release-${run}-${i}@example.invalid`;
  const data=checked(await admin.auth.admin.createUser({email,password,email_confirm:true}),'create fixture');
  users.push({id:data.user.id});
  checked(await admin.from('profiles').insert({id:data.user.id,username:`release_${run}_${i}`}),'create profile');
  const client=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options);
  const login=checked(await client.auth.signInWithPassword({email,password}),'password login');
  users[i].token=login.session.access_token;users[i].client=client;
 }
 console.log('PASS two real Auth logins (temporary accounts, no signup email)');
 const [a,b]=users;
 const publicSpot=checked(await admin.from('spots').select('id').eq('status','approved').limit(1),'approved spot')[0];
 assert.ok(publicSpot);
 const requestId=randomUUID(),start={action:'start',spotId:publicSpot.id,visibility:'private'};
 const first=command(a.token,start,requestId).sessions[0];
 assert.equal(command(a.token,start,requestId).sessions[0].id,first.id);
 assert.equal(command(a.token,start).sessions.length,1);
 assert.equal(snapshot(a.token).sessions[0].id,first.id);
 assert.equal(snapshot(b.token).sessions.length,0);
 command(b.token,{action:'delete',id:first.id},undefined,404);
 for(const client of [anon,b.client]){
  const read=await client.from('cm_rider_sessions').select('*').limit(1);
  assert.ok(read.error,'Direct table access must be denied');
 }
 command(a.token,{action:'hide',id:first.id});
 command(a.token,{action:'stop',id:first.id});
 let state=snapshot(a.token);assert.equal(state.confirmedCount,1);
 command(a.token,{action:'mood',id:first.id,mood:'happy'});
 let saved=snapshot(a.token).sessions[0];
 command(a.token,{action:'edit',id:first.id,version:saved.version,endedAt:saved.startedAt});
 assert.equal(snapshot(a.token).confirmedSeconds,0);
 command(a.token,{action:'delete',id:first.id});assert.equal(snapshot(a.token).confirmedCount,0);
 const expiring=command(a.token,start).sessions[0];
 const now=Date.now();
 checked(await admin.from('cm_rider_sessions').update({started_at:new Date(now-10800000).toISOString(),deadline_at:new Date(now-3600000).toISOString()}).eq('id',expiring.id).eq('user_id',a.id),'expire own fixture');
 state=snapshot(a.token);saved=state.sessions[0];
 assert.equal(saved.status,'needs_confirmation');assert.equal(state.confirmedSeconds,0);
 command(a.token,{action:'confirm',id:saved.id,version:saved.version,endedAt:saved.endedAt});
 assert.equal(snapshot(a.token).confirmedSeconds,7200);
 const publicStats=()=>request(`/api/rider-stats?target=${a.id}`);
 assert.equal(publicStats().data.data,null);
 assert.equal(request('/api/rider-stats',{token:a.token,body:{shared:true}}).status,200);
 const totals=publicStats();assert.equal(totals.status,200);
 assert.deepEqual(totals.data.data,{confirmedCount:1,confirmedSeconds:7200});
 assert.equal(request('/api/rider-stats',{token:a.token,body:{shared:false}}).status,200);
 assert.equal(publicStats().data.data,null);
 const live=request('/api/rider-sessions?live=1',{token:a.token});assert.equal(live.status,200);
 assert.equal(live.data.data.available,false);assert.deepEqual(live.data.data.spots,[]);
 for(const client of [anon,b.client]){
  assert.ok((await client.from('cm_rider_stats_preferences').select('*').limit(1)).error);
  assert.ok((await client.rpc('cm_rider_live_map',{actor:a.id})).error);
 }
 console.log('PASS public totals opt-in/revoke, no history payload, Live authorization and direct access denied');
 command(a.token,{action:'delete',id:saved.id});
 command(a.token,{action:'start',spotId:publicSpot.id,visibility:'community'},undefined,403);
 console.log('PASS retries, reopen, privacy, foreign-user denial, expiry, mood, correction and totals');
 const png=await sharp({create:{width:64,height:64,channels:3,background:'#888888'}}).png().toBuffer();
 fs.writeFileSync(imagePath,png,{mode:0o600});
 const upload=request('/api/upload-image',{form:[`access_token=${a.token}`,'purpose=general',`file=@${imagePath};type=image/png`]});
 assert.equal(upload.status,200);assert.ok(upload.data.url);
 const storagePath=new URL(upload.data.url).pathname.split('/object/public/spot-photos/')[1];assert.ok(storagePath);files.push(decodeURIComponent(storagePath));
 const downloaded=await fetch(upload.data.url);assert.equal(downloaded.status,200);
 const metadata=await sharp(Buffer.from(await downloaded.arrayBuffer())).metadata();assert.equal(metadata.exif,undefined);
 const submitted=request('/api/submit-spot',{body:{name:`TEST TECNICO RILASCIO ${run} - NON APPROVARE`,type:'street',lat:45,lon:11,city:'Test tecnico',country:'Italia',country_code:'IT',description:'Verifica tecnica temporanea; questo spot viene eliminato automaticamente.',photo_urls:[upload.data.url],access_token:a.token}});
 assert.equal(submitted.status,201);spots.push(submitted.data.data.id);
 const spot=checked(await admin.from('spots').select('status').eq('id',spots[0]).single(),'pending spot');assert.equal(spot.status,'pending');
 const photos=checked(await admin.from('spot_photos').select('id').eq('spot_id',spots[0]),'spot photo');assert.equal(photos.length,1);
 const pendingSession=command(a.token,{action:'start',spotId:spots[0],visibility:'private'}).sessions[0];
 command(b.token,{action:'start',spotId:spots[0],visibility:'private'},undefined,409);
 command(a.token,{action:'stop',id:pendingSession.id});
 console.log('PASS real photo upload, EXIF removal, spot submission and private session on own pending spot');
}finally{
 for(const id of spots)checked(await admin.from('spots').delete().eq('id',id),'cleanup spot');
 if(files.length)checked(await admin.storage.from('spot-photos').remove(files),'cleanup storage');
 for(const user of users)checked(await admin.auth.admin.deleteUser(user.id),'cleanup account');
 if(fs.existsSync(imagePath))fs.unlinkSync(imagePath);
 console.log(`CLEANUP: ${users.length} temporary accounts, ${spots.length} pending spots, ${files.length} uploaded images`);
}
