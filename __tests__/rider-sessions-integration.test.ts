import { afterAll,beforeAll,beforeEach,expect,it,vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
const bridge=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabaseAdmin:()=>({auth:{getUser:bridge.getUser},rpc:bridge.rpc})}));
import { GET,POST } from '@/app/api/rider-sessions/route';
import { GET as getStats, POST as setStats } from '@/app/api/rider-stats/route';
const db=new PGlite();
const a=randomUUID(),b=randomUUID(),spot=randomUUID(),otherSpot=randomUUID();
const identities:Record<string,string>={a,b};
function req(who='a',body?:unknown,query='') {return new NextRequest(`http://localhost/api/rider-sessions${query}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${who}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}
async function command(command:unknown,who='a',requestId=randomUUID()) {return POST(req(who,{command,requestId}));}
async function snapshot(who='a') {return (await (await GET(req(who))).json()).data;}
async function start(visibility='private',who='a') {const r=await command({action:'start',spotId:spot,visibility},who);expect(r.status).toBe(200);return (await r.json()).data.sessions[0];}
async function presence(who='b') {return (await (await GET(req(who,undefined,`?spotId=${spot}`))).json()).data;}
async function expire(id:string) {await db.query("update cm_rider_sessions set started_at=now()-interval '3 hours',deadline_at=now()-interval '1 hour' where id=$1",[id]);}
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);
 create type spot_status as enum ('pending','approved','rejected');
 create table spots(id uuid primary key,name text,slug text,status spot_status);
 create table sessions(id uuid);
 create table cm_session_blocks(blocker_id uuid,blocked_id uuid);
 create function cm_session_is_blocked(a uuid,b uuid) returns boolean language sql as $$select exists(select 1 from cm_session_blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a))$$;
 grant select on cm_session_blocks to service_role;`);
 await db.query('insert into auth.users values($1),($2)',[a,b]);
 await db.query("insert into spots values($1,'Spot test','spot-test','approved'),($2,'Altro spot','altro','approved')",[spot,otherSpot]);
 await db.exec('alter table spots add column submitted_by_user_id uuid');
 await db.exec(await readFile(new URL('../supabase/migrations/20261002_rider_sessions.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261002190000_rider_profile_stats.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261003120000_rider_live_map.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261010150000_rider_public_stats_daily.sql',import.meta.url),'utf8'));
 bridge.getUser.mockImplementation(async(token:string)=>({data:{user:identities[token]?{id:identities[token]}:null},error:null}));
 bridge.rpc.mockImplementation(async(name:string,args:Record<string,unknown>)=>{
  if(!/^cm_rider_[a-z_]+$/.test(name)) throw new Error('Invalid function');
  try {const result=await db.query<{data:unknown}>(`select ${name}(${Object.keys(args).map((k,i)=>`${k}=>$${i+1}`).join(',')}) as data`,Object.values(args));return {data:result.rows[0].data,error:null};}
  catch(e) {return {data:null,error:e};}
 });
},30000);
beforeEach(async()=>{vi.stubEnv('RIDER_SESSIONS_ENABLED','true');await db.exec('reset role;truncate cm_rider_sessions,cm_rider_commands,cm_rider_pilot,cm_session_blocks,cm_rider_stats_preferences cascade;update cm_rider_settings set sharing_enabled=false;');});
afterAll(async()=>{await db.close();vi.unstubAllEnvs();});
it('live map aggregates only authorized active opt-in presence without rider history',async()=>{
 const feed=async(who='b')=>(await (await GET(req(who,undefined,'?live=1'))).json()).data;
 expect(await feed()).toMatchObject({available:false,spots:[]});
 expect((await GET(req('unknown',undefined,'?live=1'))).status).toBe(401);
 await db.exec('update cm_rider_settings set sharing_enabled=true');
 await db.query("insert into cm_rider_pilot(user_id,authorization_note) values($1,'Fixture'),($2,'Fixture')",[a,b]);
 const one=await start('community');
 await start('private','b');
 let live=await feed();expect(live.available).toBe(true);expect(live.spots).toHaveLength(1);
 expect(live.spots[0]).toMatchObject({spotId:spot,count:1});
 expect(Object.keys(live.spots[0]).sort()).toEqual(['count','freshAt','spotId','validUntil']);
 expect(JSON.stringify(live)).not.toContain(a);expect(JSON.stringify(live)).not.toContain(one.id);
 await db.query('insert into cm_session_blocks values($1,$2)',[a,b]);expect((await feed()).spots).toEqual([]);
 await db.exec('truncate cm_session_blocks');
 await db.query("update spots set status='pending' where id=$1",[spot]);expect((await feed()).spots).toEqual([]);
 await db.query("update spots set status='approved' where id=$1",[spot]);
 await db.query('delete from cm_rider_pilot where user_id=$1',[a]);expect((await feed()).spots).toEqual([]);
 await db.query("insert into cm_rider_pilot(user_id,authorization_note) values($1,'Fixture')",[a]);
 await expire(one.id);expect((await feed()).spots).toEqual([]); // No snapshot or app timer has run.
 await snapshot();const next=await start('community');expect((await feed()).spots).toHaveLength(1);
 await command({action:'hide',id:next.id});expect((await feed()).spots).toEqual([]);
 await db.exec('set role authenticated');
 await expect(db.query('select cm_rider_live_map($1)',[a])).rejects.toThrow(/permission denied/);
 await db.exec('reset role;set role anon');
 await expect(db.query('select cm_rider_live_map($1)',[a])).rejects.toThrow(/permission denied/);
 await db.exec('reset role');
});
it('live map counts multiple riders and immediately excludes stopped or expired presence',async()=>{
 await db.exec('update cm_rider_settings set sharing_enabled=true');
 await db.query("insert into cm_rider_pilot(user_id,authorization_note) values($1,'Fixture'),($2,'Fixture')",[a,b]);
 const one=await start('community'),two=await start('community','b');
 const feed=async()=>(await (await GET(req('a',undefined,'?live=1&actor=forged'))).json()).data;
 expect((await feed()).spots[0].count).toBe(2);
 await command({action:'stop',id:two.id},'b');expect((await feed()).spots[0].count).toBe(1);
 await db.query("update cm_rider_presences set expires_at=now()-interval '1 second' where session_id=$1",[one.id]);
 expect((await feed()).spots).toEqual([]);
 await db.exec('update cm_rider_settings set sharing_enabled=false');
 expect(await feed()).toMatchObject({available:false,spots:[]});
 vi.stubEnv('RIDER_SESSIONS_ENABLED','false');expect((await GET(req('a',undefined,'?live=1'))).status).toBe(503);
});
it('starts once across retries, tabs, refresh and stops without duplicate hours',async()=>{
 const body={command:{action:'start',spotId:spot,visibility:'private'},requestId:randomUUID()};
 const one=await POST(req('a',body));expect(one.status).toBe(200);
 const s=(await one.json()).data.sessions[0];
 expect((await (await POST(req('a',body))).json()).data.sessions[0].id).toBe(s.id);
 await start();expect((await snapshot()).sessions).toHaveLength(1);
 expect((await command({action:'start',spotId:otherSpot})).status).toBe(409);
 expect((await command({action:'stop',id:s.id})).status).toBe(200);
 const finished=await snapshot();expect(finished.confirmedCount).toBe(1);
 await command({action:'stop',id:s.id});expect((await snapshot()).confirmedSeconds).toBe(finished.confirmedSeconds);
 await POST(req('a',body));expect((await snapshot()).sessions).toHaveLength(1);
});
it('bounds duration with app closed and excludes unconfirmed hours until explicit confirmation',async()=>{
 const s=await start();await expire(s.id);
 // No app callback runs between deadline and this read.
 let state=await snapshot();expect(state.sessions[0].status).toBe('needs_confirmation');
 expect(state.confirmedSeconds).toBe(0);expect(state.confirmedCount).toBe(0);
 expect((await command({action:'renew',id:s.id})).status).toBe(409);
 expect((await command({action:'stop',id:s.id})).status).toBe(200);
 state=await snapshot();const pending=state.sessions[0];expect(pending.status).toBe('needs_confirmation');
 await command({action:'confirm',id:s.id,version:pending.version,endedAt:pending.endedAt});
 state=await snapshot();expect(state.confirmedSeconds).toBeCloseTo(7200,0);expect(state.confirmedCount).toBe(1);
 const confirmed=state.sessions[0];const shorter=new Date(Date.parse(confirmed.startedAt)+3600000).toISOString();
 expect((await command({action:'edit',id:s.id,version:confirmed.version,endedAt:shorter})).status).toBe(200);
 expect((await snapshot()).confirmedSeconds).toBe(3600);
 expect((await command({action:'edit',id:s.id,version:confirmed.version,endedAt:shorter})).status).toBe(409);
 await command({action:'delete',id:s.id});expect((await snapshot()).confirmedCount).toBe(0);expect((await snapshot()).confirmedSeconds).toBe(0);
});
it('keeps private history and mutation inaccessible to other identities and SQL clients',async()=>{
 const s=await start();expect((await snapshot('b')).sessions).toEqual([]);
 for(const action of ['stop','hide','delete','renew']) expect((await command({action,id:s.id},'b')).status).toBe(404);
 expect((await GET(req('unknown'))).status).toBe(401);
 await db.exec('set role authenticated');
 await expect(db.query('select * from cm_rider_sessions')).rejects.toThrow(/permission denied/);
 await expect(db.query('select cm_rider_snapshot($1)',[a])).rejects.toThrow(/permission denied/);
 await expect(db.query('select * from cm_rider_presences')).rejects.toThrow(/permission denied/);
 await db.exec('reset role');
});
it('enforces pilot flag, explicit visibility, expiry, revocation and blocks in presence queries',async()=>{
 expect((await command({action:'start',spotId:spot,visibility:'community'})).status).toBe(403);
 await db.exec('update cm_rider_settings set sharing_enabled=true');
 await db.query("insert into cm_rider_pilot(user_id,authorization_note) values($1,'Test account only'),($2,'Test account only')",[a,b]);
 const s=await start('community');expect((await presence()).count).toBe(1);
 await db.query('insert into cm_session_blocks values($1,$2)',[b,a]);expect((await presence()).count).toBe(0);
 await db.exec('truncate cm_session_blocks');
 await command({action:'renew',id:s.id});expect((await presence()).count).toBe(1);
 await db.exec('update cm_rider_settings set sharing_enabled=false');expect((await presence()).count).toBe(0);
 await db.exec('update cm_rider_settings set sharing_enabled=true');
 await expire(s.id);expect((await presence()).count).toBe(0); // BEFORE materializing expired status.
 await snapshot();expect((await snapshot()).confirmedCount).toBe(0);
 const next=await start('community');await command({action:'hide',id:next.id});expect((await presence()).count).toBe(0);
 await command({action:'renew',id:next.id});expect((await presence()).count).toBe(0);
 expect((await snapshot()).sessions.find((s:{id:string})=>s.id===next.id).status).toBe('active');
});
it('rejects tampered input and keeps retries after deletion from recreating records',async()=>{
 const requestId=randomUUID(),commandBody={action:'start',spotId:spot};
 const response=await command(commandBody,'a',requestId);const s=(await response.json()).data.sessions[0];
 expect((await command({action:'start',spotId:otherSpot},'a',requestId)).status).toBe(409);
 await command({action:'delete',id:s.id});await command(commandBody,'a',requestId);expect((await snapshot()).sessions).toEqual([]);
 expect((await command({action:'start',spotId:spot,actor:b})).status).toBe(422);
 vi.stubEnv('RIDER_SESSIONS_ENABLED','false');expect((await GET(req())).status).toBe(503);
});

it('uses server timestamps and rejects invented sources, invalid ends and future edits',async()=>{
 expect((await command({action:'start',spotId:spot,source:'crok_sensor'})).status).toBe(422);
 expect((await command({action:'start',spotId:spot,startedAt:'2000-01-01T00:00:00Z'})).status).toBe(422);
 const s=await start();expect(s.source).toBe('manual');
 expect(Date.parse(s.deadlineAt)-Date.parse(s.startedAt)).toBe(7200000);
 await command({action:'stop',id:s.id});const saved=(await snapshot()).sessions[0];
 expect((await command({action:'edit',id:s.id,version:saved.version,endedAt:'2000-01-01T00:00:00Z'})).status).toBe(422);
 expect((await command({action:'edit',id:s.id,version:saved.version,endedAt:new Date(Date.now()+86400000).toISOString()})).status).toBe(422);
 expect((await snapshot()).sessions[0].endedAt).toBe(saved.endedAt);
});

it('serializes concurrent start requests and enforces the database unique constraint',async()=>{
 const responses=await Promise.all(Array.from({length:8},()=>command({action:'start',spotId:spot})));
 expect(responses.every(r=>r.status===200)).toBe(true);expect((await snapshot()).sessions).toHaveLength(1);
 await expect(db.query("insert into cm_rider_sessions(user_id,spot_id,deadline_at) values($1,$2,now()+interval '2 hours')",[a,spot])).rejects.toThrow(/duplicate key/);
});

it('enforces function grants for anonymous clients while allowing the verified server role',async()=>{
 await db.exec('set role anon');
 await expect(db.query('select cm_rider_presence($1,$2)',[a,spot])).rejects.toThrow(/permission denied/);
 await expect(db.query('select * from sessions')).rejects.toThrow(/permission denied/);
 await db.exec('reset role;set role service_role');
 const state=await snapshot();expect(state.sessions).toEqual([]);
 await start();expect((await snapshot()).sessions).toHaveLength(1);
 await db.exec('reset role');
});

it('keeps personal data out of cached responses and rejects forged owner selectors',async()=>{
 const s=await start();const response=await GET(req('b',undefined,`?userId=${a}`));
 expect(response.headers.get('cache-control')).toContain('no-store');
 expect((await response.json()).data.sessions).toEqual([]);
 expect((await command({action:'confirm',id:s.id,version:s.version,endedAt:s.startedAt},'b')).status).toBe(404);
});

it('saves optional private mood only after confirmation, without changing hours',async()=>{
 const s=await start();
 expect((await command({action:'mood',id:s.id,mood:'happy'})).status).toBe(409);
 await command({action:'stop',id:s.id});
 const seconds=(await snapshot()).confirmedSeconds;
 for(const mood of ['sad','neutral','happy',null]) {
  expect((await command({action:'mood',id:s.id,mood})).status).toBe(200);
  const state=await snapshot();expect(state.sessions[0].mood).toBe(mood);expect(state.confirmedSeconds).toBe(seconds);
 }
 expect((await command({action:'mood',id:s.id,mood:'happy'},'b')).status).toBe(404);
 expect((await command({action:'mood',id:s.id,mood:'other'})).status).toBe(422);
 expect((await snapshot('b')).sessions).toEqual([]);
 expect(await presence()).not.toHaveProperty('mood');
});

it('allows only the author to start a private session at a pending spot',async()=>{
 const pending=randomUUID();
 await db.query("insert into spots values($1,'Bozza','bozza','pending',$2)",[pending,a]);
 expect((await command({action:'start',spotId:pending,visibility:'private'},'b')).status).toBe(409);
 await db.exec('update cm_rider_settings set sharing_enabled=true');
 await db.query("insert into cm_rider_pilot(user_id,authorization_note) values($1,'Local test')",[a]);
 expect((await command({action:'start',spotId:pending,visibility:'community'})).status).toBe(409);
 expect((await command({action:'start',spotId:pending,visibility:'private'})).status).toBe(200);
 const state=await snapshot();
 expect(state.sessions[0].spotStatus).toBe('pending');
 expect(state.sessions[0].visibility).toBe('private');
 expect((await snapshot('b')).sessions).toEqual([]);
});

it('preserves confirmed hours when a spot is deleted',async()=>{
 const deleted=randomUUID();
 await db.query("insert into spots(id,name,slug,status) values($1,'Removed','removed','approved')",[deleted]);
 let state=(await (await command({action:'start',spotId:deleted})).json()).data;
 const s=state.sessions[0];
 await expire(s.id);state=await snapshot();
 await command({action:'confirm',id:s.id,version:state.sessions[0].version,endedAt:state.sessions[0].endedAt});
 await db.query('delete from spots where id=$1',[deleted]);
 state=await snapshot();
 expect(state.confirmedSeconds).toBeCloseTo(7200,0);
 expect(state.confirmedCount).toBe(1);
 expect(state.sessions[0]).toMatchObject({spotId:null,spotSlug:null,spotName:'Spot eliminato',spotStatus:'deleted',status:'confirmed'});
 expect((await snapshot('b')).sessions).toEqual([]);
});

it('freezes an active session and removes presence when its spot is deleted',async()=>{
 const deleted=randomUUID();
 await db.query("insert into spots(id,name,slug,status) values($1,'Removed','removed','approved')",[deleted]);
 await db.exec('update cm_rider_settings set sharing_enabled=true');
 await db.query("insert into cm_rider_pilot(user_id,authorization_note) values($1,'Local test')",[a]);
 const s=(await (await command({action:'start',spotId:deleted,visibility:'community'})).json()).data.sessions[0];
 await db.query('delete from spots where id=$1',[deleted]);
 let state=await snapshot();
 expect(state.sessions[0]).toMatchObject({spotId:null,status:'needs_confirmation',sharing:false});
 expect(Date.parse(state.sessions[0].endedAt)).toBeLessThanOrEqual(Date.now());
 expect(state.confirmedCount).toBe(0);
 expect((await db.query('select * from cm_rider_presences')).rows).toEqual([]);
 expect((await command({action:'renew',id:s.id})).status).toBe(409);
 const end=state.sessions[0].endedAt;
 await command({action:'confirm',id:s.id,version:state.sessions[0].version,endedAt:end});
 state=await snapshot();expect(state.confirmedCount).toBe(1);
 await start();expect((await snapshot()).sessions.filter((s:{status:string})=>s.status==='active')).toHaveLength(1);
});

it('allows pending-spot deletion before auth-account deletion and cascades private records',async()=>{
 const owner=randomUUID(),pending=randomUUID();
 await db.query('insert into auth.users values($1)',[owner]);
 await db.query("insert into spots values($1,'Pending','pending','pending',$2)",[pending,owner]);
 await db.query('select cm_rider_command($1,$2,$3)',[owner,randomUUID(),JSON.stringify({action:'start',spotId:pending})]);
 // Mirrors the real account handler: pending spots first, Auth user last.
 await db.query("delete from spots where submitted_by_user_id=$1 and status<>'approved'",[owner]);
 await db.query('delete from auth.users where id=$1',[owner]);
 expect((await db.query('select * from cm_rider_sessions where user_id=$1',[owner])).rows).toEqual([]);
 expect((await db.query('select * from cm_rider_commands where user_id=$1',[owner])).rows).toEqual([]);
});

function statsRequest(who?:string,body?:unknown,target?:string) {
 return new NextRequest(`http://localhost/api/rider-stats${target?`?target=${target}`:''}`,{
  method:body===undefined?'GET':'POST',headers:{...(who?{Authorization:`Bearer ${who}`}:{ }),'Content-Type':'application/json'},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
 });
}
async function publicStats(who?:string) {return (await (await getStats(statsRequest(who,undefined,a))).json()).data;}
async function backdate(id:string,days:number) {await db.query('update cm_rider_sessions set started_at=started_at-make_interval(days=>$2),deadline_at=deadline_at-make_interval(days=>$2),ended_at=ended_at-make_interval(days=>$2) where id=$1',[id,days]);}

it('keeps aggregate stats private by default even with Community presence',async()=>{
 const s=await start();await command({action:'stop',id:s.id});
 expect(await publicStats()).toBeNull();expect(await publicStats('b')).toBeNull();
 expect((await (await getStats(statsRequest('a'))).json()).data).toEqual({shared:false});
 await db.exec('update cm_rider_settings set sharing_enabled=true');
 await db.query("insert into cm_rider_pilot(user_id,authorization_note) values($1,'Test')",[a]);
 await start('community');expect(await publicStats()).toBeNull();
});

it('shares only confirmed aggregate totals, updates edits/deletes, and revokes independently',async()=>{
 const s=await start();await expire(s.id);await snapshot();
 const pending=(await snapshot()).sessions[0];
 await command({action:'confirm',id:s.id,version:pending.version,endedAt:pending.endedAt});
 await command({action:'mood',id:s.id,mood:'happy'});
 expect((await setStats(statsRequest('a',{shared:true}))).status).toBe(200);
 // Repeated preference writes are idempotent, with no duplicate consent rows.
 await setStats(statsRequest('a',{shared:true}));
 // A session ended today stays out of the public totals until the next day.
 expect(await publicStats()).toEqual({confirmedCount:0,confirmedSeconds:0});
 await backdate(s.id,2);
 const confirmed=(await snapshot()).sessions[0];
 expect(await publicStats()).toEqual({confirmedCount:1,confirmedSeconds:7200});
 expect(await publicStats('b')).toEqual(await publicStats());
 expect(Object.keys(await publicStats()).sort()).toEqual(['confirmedCount','confirmedSeconds']);
 expect((await snapshot('b')).sessions).toEqual([]);
 const current=(await snapshot()).sessions[0];
 await command({action:'edit',id:s.id,version:current.version,endedAt:new Date(Date.parse(confirmed.startedAt)+3600000).toISOString()});
 expect((await publicStats()).confirmedSeconds).toBe(3600);
 // Whole hours only: 89 minutes read as 1 hour.
 const edited=(await snapshot()).sessions[0];
 await command({action:'edit',id:s.id,version:edited.version,endedAt:new Date(Date.parse(confirmed.startedAt)+89*60000).toISOString()});
 expect(Date.parse((await snapshot()).sessions[0].endedAt)).toBe(Date.parse(confirmed.startedAt)+89*60000);
 expect((await publicStats()).confirmedSeconds).toBe(3600);
 const next=await start();expect((await publicStats()).confirmedCount).toBe(1);
 await expire(next.id);expect((await publicStats()).confirmedCount).toBe(1);
 await snapshot();expect((await publicStats()).confirmedCount).toBe(1);
 await command({action:'delete',id:s.id});expect(await publicStats()).toEqual({confirmedCount:0,confirmedSeconds:0});
 await setStats(statsRequest('a',{shared:false}));expect(await publicStats()).toBeNull();
 expect((await snapshot()).sessions).toHaveLength(1);
});

it('uses verified identity for preferences and blocks direct database calls',async()=>{
 expect((await setStats(statsRequest(undefined,{shared:true}))).status).toBe(401);
 expect((await setStats(statsRequest('bad',{shared:true}))).status).toBe(401);
 expect((await setStats(statsRequest('a',{shared:true,actor:b}))).status).toBe(422);
 expect((await setStats(statsRequest('a',{shared:'true'}))).status).toBe(422);
 expect((await getStats(statsRequest())).status).toBe(401);
 expect((await getStats(statsRequest('bad',undefined,a))).status).toBe(401);
 expect((await getStats(statsRequest(undefined,undefined,'not-a-uuid'))).status).toBe(422);
 await setStats(statsRequest('b',{shared:true},a));expect(await publicStats()).toBeNull();
 for(const role of ['anon','authenticated']) {
  await db.exec(`set role ${role}`);
  await expect(db.query('select * from cm_rider_stats_preferences')).rejects.toThrow(/permission denied/);
  await expect(db.query('select cm_rider_stats_preference($1,true)',[a])).rejects.toThrow(/permission denied/);
  await expect(db.query('select cm_rider_public_stats($1,null)',[a])).rejects.toThrow(/permission denied/);
  await db.exec('reset role');
 }
 await db.exec('set role service_role');
 expect((await setStats(statsRequest('a',{shared:true}))).status).toBe(200);
 expect(await publicStats()).toEqual({confirmedCount:0,confirmedSeconds:0});
 await db.exec('reset role');
});

it('respects signed-in blocks without treating public totals as private, disables caching',async()=>{
 await setStats(statsRequest('a',{shared:true}));
 for(const pair of [[a,b],[b,a]]) {
  await db.query('insert into cm_session_blocks values($1,$2)',pair);
  expect(await publicStats('b')).toBeNull();
  expect(await publicStats()).toEqual({confirmedCount:0,confirmedSeconds:0});
  await db.exec('truncate cm_session_blocks');
 }
 const response=await getStats(statsRequest(undefined,undefined,a));
 expect(response.headers.get('cache-control')).toContain('no-store');
 vi.stubEnv('RIDER_SESSIONS_ENABLED','false');
 expect((await getStats(statsRequest(undefined,undefined,a))).status).toBe(503);
 expect((await setStats(statsRequest('a',{shared:true}))).status).toBe(503);
});

it('removes the sharing preference with account deletion',async()=>{
 const owner=randomUUID();await db.query('insert into auth.users values($1)',[owner]);
 await db.query('select cm_rider_stats_preference($1,true)',[owner]);
 await db.query('delete from auth.users where id=$1',[owner]);
 expect((await db.query('select * from cm_rider_stats_preferences where user_id=$1',[owner])).rows).toEqual([]);
 expect((await db.query<{data:unknown}>('select cm_rider_public_stats($1,null) as data',[owner])).rows[0].data).toBeNull();
});

it('preserves identity, expiry, idempotency and totals through 1000 seeded mixed operations',async()=>{
 let seed=20261003;
 const random=(limit:number)=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)%limit;};
 const sharing:Record<string,boolean>={a:false,b:false};
 const coverage:Record<string,number>={};
 const hit=(name:string)=>{coverage[name]=(coverage[name]||0)+1;};
 for(let step=0;step<1000;step++) {
  const who=random(13)<6?'a':'b',other=who==='a'?'b':'a';
  const state=await snapshot(who),active=state.sessions.find((s:{status:string})=>s.status==='active');
  const closed=state.sessions.filter((s:{status:string})=>s.status!=='active');
  const kind=random(12);
  if(kind<3||kind===10) {
   hit('startAndRetry');
   const chosen=random(11)<5?spot:otherSpot,key=randomUUID();
   const input={action:'start',spotId:chosen,visibility:'private'};
   const expected=active&&active.spotId!==chosen?409:200;
   const first=await command(input,who,key);expect(first.status).toBe(expected);
   const after=await snapshot(who);
   expect((await command(input,who,key)).status).toBe(expected);
   expect((await snapshot(who)).sessions).toEqual(after.sessions);
  } else if(kind===3&&active) {
   hit('stop');expect((await command({action:'stop',id:active.id},who)).status).toBe(200);
  } else if(kind===4&&active) {
   hit('closedAppExpiry');await expire(active.id);
   const fresh=await snapshot(who),expired=fresh.sessions.find((s:{id:string})=>s.id===active.id);
   expect(expired.status).toBe('needs_confirmation');expect(expired.endedAt).toBe(expired.deadlineAt);
   expect((await command({action:'renew',id:active.id},who)).status).toBe(409);
  } else if(kind===5&&closed.length) {
   hit('confirmOrEdit');const s=closed[random(closed.length)];
   const end=new Date(Date.parse(s.startedAt)+(Date.parse(s.endedAt)-Date.parse(s.startedAt))*random(101)/100).toISOString();
   expect((await command({action:s.status==='confirmed'?'edit':'confirm',id:s.id,version:s.version,endedAt:end},who)).status).toBe(200);
   expect((await command({action:'edit',id:s.id,version:s.version,endedAt:end},who)).status).toBe(409);
  } else if(kind===6&&state.sessions.length) {
   hit('delete');const selected=state.sessions[random(state.sessions.length)];
   expect((await command({action:'delete',id:selected.id},who)).status).toBe(200);
   expect((await command({action:'delete',id:selected.id},who)).status).toBe(404);
  } else if(kind===7) {
   hit('foreignMutationDenied');const foreign=await snapshot(other);
   expect((await command({action:'delete',id:foreign.sessions[0]?.id||randomUUID()},who)).status).toBe(404);
   expect((await snapshot(other)).sessions).toEqual(foreign.sessions);
  } else if(kind===9&&state.sessions.length) {
   hit('privateMood');const s=state.sessions[random(state.sessions.length)];
   expect((await command({action:'mood',id:s.id,mood:['sad','neutral','happy',null][random(4)]},who)).status).toBe(s.status==='confirmed'?200:409);
  } else if(kind===11) {
   hit('forgedPayloadDenied');
   expect((await command({action:'start',spotId:spot,actor:identities[other]},who)).status).toBe(422);
   expect((await snapshot(who)).sessions).toEqual(state.sessions);
  } else {
   hit('toggleStats');sharing[who]=!sharing[who];
   expect((await setStats(statsRequest(who,{shared:sharing[who]}))).status).toBe(200);
  }
  const ids=new Set<string>();
  // Public totals include only sessions ended before today's midnight in Rome, in whole hours.
  const cut=Number((await db.query<{cut:number}>("select extract(epoch from date_trunc('day',now() at time zone 'Europe/Rome') at time zone 'Europe/Rome')*1000 as cut")).rows[0].cut);
  for(const owner of ['a','b']) {
   const current=await snapshot(owner);
   expect(current.sessions.filter((s:{status:string})=>s.status==='active').length).toBeLessThanOrEqual(1);
   let count=0,seconds=0,publicCount=0,publicSeconds=0;
   for(const s of current.sessions) {
    expect(ids.has(s.id)).toBe(false);ids.add(s.id);
    expect(s.source).toBe('manual');
    if(s.status==='confirmed') {count++;seconds+=(Date.parse(s.endedAt)-Date.parse(s.startedAt))/1000;}
    if(s.status==='confirmed'&&Date.parse(s.endedAt)<cut) {publicCount++;publicSeconds+=(Date.parse(s.endedAt)-Date.parse(s.startedAt))/1000;}
   }
   expect(current.confirmedCount).toBe(count);
   // JSON timestamps contain microseconds; JS Date truncates them to milliseconds.
   expect(Math.abs(current.confirmedSeconds-seconds)).toBeLessThan(0.001*(count+1));
   const response=await getStats(statsRequest(owner==='a'?'b':'a',undefined,identities[owner]));
   expect(response.headers.get('cache-control')).toContain('no-store');
   const publicData=(await response.json()).data;
   if(!sharing[owner])expect(publicData).toBeNull();
   else expect(publicData).toEqual({confirmedCount:publicCount,confirmedSeconds:Math.floor((publicSeconds+0.001*(publicCount+1))/3600)*3600});
  }
 }
 for(const name of ['startAndRetry','stop','closedAppExpiry','confirmOrEdit','delete','foreignMutationDenied','privateMood','forgedPayloadDenied','toggleStats'])expect(coverage[name]||0,`Missing scenario ${name}`).toBeGreaterThan(0);
 console.log('PASS 1000 mixed local operations; seed=20261003; coverage='+JSON.stringify(coverage));
},60000);
