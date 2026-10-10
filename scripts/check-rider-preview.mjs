import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const origin=process.env.PREVIEW_ORIGIN||'http://127.0.0.1:3200';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw new Error('Local preview only');
const spot='22222222-2222-4222-8222-222222222222';
const headers={Authorization:'Bearer local-rider-session-preview','Content-Type':'application/json'};
async function call(body,query=''){
 const r=await fetch(`${origin}/api/rider-sessions-preview${query}`,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{})});
 const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));assert.equal(j.ok,true);assert.match(r.headers.get('cache-control'),/no-store/);return j.data;
}
const command=(command,requestId=randomUUID())=>call({command,requestId});
for(const s of (await call()).sessions)await command({action:'delete',id:s.id});
const input={action:'start',spotId:spot,visibility:'community'},key=randomUUID();
let state=await command(input,key);let s=state.sessions[0];
assert.equal(state.sessions.length,1);assert.equal(s.status,'active');
assert.equal((await command(input,key)).sessions[0].id,s.id);
assert.equal((await command(input)).sessions.length,1);
assert.equal((await call()).sessions[0].id,s.id);
assert.equal((await call(undefined,`?spotId=${spot}`)).count,1);
console.log('PASS HTTP start, repeated request, double tap, reopen, authorized presence');
await command({action:'hide',id:s.id});assert.equal((await call(undefined,`?spotId=${spot}`)).count,0);
state=await command({action:'stop',id:s.id});assert.equal(state.confirmedCount,1);
console.log('PASS HTTP hide presence, stop, confirmed history');
await command({action:'delete',id:s.id});state=await command(input);s=state.sessions[0];
await call({demoExpire:true});state=await call();s=state.sessions[0];
assert.equal(s.status,'needs_confirmation');assert.equal(state.confirmedCount,0);assert.equal(state.confirmedSeconds,0);
assert.equal((await call(undefined,`?spotId=${spot}`)).count,0);
console.log('PASS HTTP closed-app expiry, frozen duration, unconfirmed excluded');
state=await command({action:'confirm',id:s.id,version:s.version,endedAt:s.endedAt});assert.equal(state.confirmedSeconds,7200);s=state.sessions[0];
state=await command({action:'edit',id:s.id,version:s.version,endedAt:new Date(Date.parse(s.startedAt)+3600000).toISOString()});assert.equal(state.confirmedSeconds,3600);
state=await command({action:'delete',id:s.id});assert.equal(state.confirmedCount,0);assert.equal(state.confirmedSeconds,0);
console.log('PASS HTTP confirmation, correction, deletion and totals');
assert.equal((await fetch(`${origin}/api/rider-sessions-preview`)).status,401);
assert.equal((await fetch(`${origin}/api/rider-sessions`)).status,503);
console.log('PASS HTTP unauthenticated preview blocked; real API disabled');

const profile=await fetch(`${origin}/u/rider_demo`);
assert.equal(profile.status,200);assert.match(await profile.text(),/Il tuo profilo/);
const detail=await fetch(`${origin}/map/spot/jungle-merano-17fe5a`,{redirect:'manual'});
assert.equal(detail.status,307);assert.equal(detail.headers.get('location'),'/?spot=jungle-merano-17fe5a');
console.log('PASS HTTP demo profile and spot detail redirect to map');
const draft={demoDraft:{id:randomUUID(),name:'Bozza test locale',lat:45.4,lon:10.9}};
for(let i=0;i<2;i++){
 const response=await fetch(`${origin}/api/rider-sessions-preview`,{method:'POST',headers,body:JSON.stringify(draft)});
 assert.equal(response.status,200);assert.equal((await response.json()).spot.id,draft.demoDraft.id);
}
state=await command({action:'start',spotId:draft.demoDraft.id,visibility:'private'});
s=state.sessions[0];assert.equal(s.spotStatus,'pending');assert.equal(s.visibility,'private');
assert.equal((await call(undefined,`?spotId=${draft.demoDraft.id}`)).count,0);
assert.ok(!(await (await fetch(`${origin}/api/spots/index`)).text()).includes(draft.demoDraft.id));
await command({action:'stop',id:s.id});state=await command({action:'mood',id:s.id,mood:'happy'});
assert.equal(state.sessions[0].mood,'happy');await command({action:'delete',id:s.id});
console.log('PASS HTTP quick local draft, retry, private timer, mood and no public exposure');
