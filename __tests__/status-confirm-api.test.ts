import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mock = vi.hoisted(() => ({
  from: vi.fn(), getUser: vi.fn(), xp: vi.fn(), summary: vi.fn(), revalidate: vi.fn(), language: vi.fn(),
  queries: [] as { table: string; calls: { method: string; args: unknown[] }[] }[], responses: {} as Record<string, unknown[]>,
}));
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: () => ({ from: mock.from, auth: { getUser: mock.getUser } }) }));
vi.mock('@/lib/xp', () => ({ onStatusConfirmed: mock.xp, getXPSummary: mock.summary }));
vi.mock('next/cache', () => ({ revalidatePath: mock.revalidate }));
vi.mock('@/lib/language-server', () => ({ getSiteLanguage: mock.language }));
import { POST } from '@/app/api/status-confirm/route';
const SPOT='11111111-1111-4111-8111-111111111111';
const RIDER='22222222-2222-4222-8222-222222222222';
const OTHER='33333333-3333-4333-8333-333333333333';
const NOW=new Date('2026-09-25T12:00:00Z');
const report=(user=RIDER,condition='bustato',days=0)=>({id:`${user}-${days}`,user_id:user,condition,created_at:new Date(NOW.getTime()-days*86400000).toISOString()});
const run=(condition='bustato')=>POST(new NextRequest('http://localhost/api/status-confirm',{method:'POST',body:JSON.stringify({spot_id:SPOT,condition,note:'  Cancello chiuso  ',access_token:'synthetic-token'})}));
const writes=(table: string, method: string)=>mock.queries.filter(q=>q.table===table&&q.calls.some(c=>c.method===method));
beforeEach(()=>{
 vi.resetAllMocks();vi.useFakeTimers();vi.setSystemTime(NOW);mock.language.mockReturnValue('it');mock.queries=[];
 mock.getUser.mockResolvedValue({data:{user:{id:RIDER}},error:null});
 mock.xp.mockResolvedValue(undefined);mock.summary.mockResolvedValueOnce({lifetime_xp:0,current_level:'Rookie'}).mockResolvedValueOnce({lifetime_xp:5,current_level:'Rookie'});
 mock.responses={
  spots:[{data:{id:SPOT,name:'Spot',slug:'spot-roma',condition:'alive'},error:null},{data:{id:SPOT},error:null}],
  spot_contributions:[{data:{id:'contribution'},error:null}],
  spot_status_updates:[{count:0,error:null},{count:0,error:null},{data:{id:'update'},error:null},{data:[report(),report(OTHER)],error:null}],
 };
 mock.from.mockImplementation((table:string)=>{
  const query={table,calls:[] as {method:string;args:unknown[]}[]};mock.queries.push(query);const builder:Record<string,unknown>={};
  for(const method of ['select','insert','delete','update','eq','gte','not','order','range','single','maybeSingle']) builder[method]=(...args:unknown[])=>{query.calls.push({method,args});return builder;};
  builder.then=(resolve:(value:unknown)=>unknown,reject:(error:unknown)=>unknown)=>Promise.resolve(mock.responses[table]?.shift()??{data:null,error:null}).then(resolve,reject);
  return builder;
 });
});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
describe('status confirmation saves only trustworthy results',()=>{
 it('requires a verified user before touching status records',async()=>{
  mock.getUser.mockResolvedValue({data:{user:null},error:{message:'expired'}});expect((await run()).status).toBe(401);expect(mock.from).not.toHaveBeenCalled();expect(mock.xp).not.toHaveBeenCalled();
 });
 it('counts distinct riders across their latest opinions and updates condition only with two',async()=>{
  const response=await run();expect(response.status).toBe(200);expect(await response.json()).toMatchObject({ok:true,message:expect.stringContaining('2 rider diversi')});
  const query=writes('spots','update')[0];expect(query.calls).toContainEqual({method:'eq',args:['condition','alive']});expect(mock.xp).toHaveBeenCalledWith(RIDER,SPOT,'contribution');expect(mock.revalidate).toHaveBeenCalledWith('/map/spot/spot-roma');
 });
 it('does not treat repeated reports by the same rider as independent agreement',async()=>{
  mock.responses.spot_status_updates[3]={data:[report(),report(RIDER,'bustato',2)],error:null};
  const response=await run();expect(await response.json()).toMatchObject({ok:true,message:expect.stringContaining('un altro rider')});expect(writes('spots','update')).toHaveLength(0);
 });
 it('withdraws an older matching opinion when the other rider now reports a different condition',async()=>{
  mock.responses.spot_status_updates[3]={data:[report(),report(OTHER,'alive',1),report(OTHER,'bustato',2)],error:null};await run();expect(writes('spots','update')).toHaveLength(0);
 });
 it('paginates beyond the first 200 reports before deciding agreement',async()=>{
  mock.responses.spot_status_updates[3]={data:Array.from({length:200},(_,i)=>({...report(),id:String(i)})),error:null};
  mock.responses.spot_status_updates.push({data:[report(OTHER)],error:null});expect((await run()).status).toBe(200);
  expect(mock.queries.flatMap(q=>q.calls)).toContainEqual({method:'range',args:[200,399]});expect(writes('spots','update')).toHaveLength(1);
 });
 it('saves a same-condition confirmation before awarding XP',async()=>{
  const response=await run('alive');expect(response.status).toBe(200);expect(writes('spots','update')).toHaveLength(1);expect(mock.xp).toHaveBeenCalled();
  expect(mock.queries.some(q=>q.calls.some(c=>c.method==='range'))).toBe(false);
 });
 it.each(['spot lookup','weekly count','null count','recent count','contribution insert','status insert','history read','spot update'])('fails closed on %s failure without XP or success claims',async step=>{
  vi.spyOn(console,'error').mockImplementation(()=>{});const error={message:'sensitive database detail'};
  if(step==='spot lookup')mock.responses.spots[0]={data:null,error};
  if(step==='weekly count')mock.responses.spot_status_updates[0]={count:null,error};
  if(step==='null count')mock.responses.spot_status_updates[0]={count:null,error:null};
  if(step==='recent count')mock.responses.spot_status_updates[1]={count:null,error};
  if(step==='contribution insert')mock.responses.spot_contributions[0]={data:null,error};
  if(step==='status insert')mock.responses.spot_status_updates[2]={data:null,error};
  if(step==='history read')mock.responses.spot_status_updates[3]={data:null,error};
  if(step==='spot update')mock.responses.spots[1]={data:null,error};
  const response=await run();expect(response.status).toBe(503);const body=await response.json();expect(body.ok).toBe(false);expect(JSON.stringify(body)).not.toContain('sensitive');expect(mock.xp).not.toHaveBeenCalled();
 });
 it('compensates this request’s status and contribution rows after a failed spot write',async()=>{
  mock.responses.spots[1]={data:null,error:{message:'failed'}};await run();
  expect(writes('spot_status_updates','delete')[0].calls).toContainEqual({method:'eq',args:['id','update']});expect(writes('spot_contributions','delete')[0].calls).toContainEqual({method:'eq',args:['id','contribution']});
 });
 it('returns a conflict if the spot changed while reporting instead of overwriting it',async()=>{
  mock.responses.spots[1]={data:null,error:null};expect((await run()).status).toBe(409);expect(mock.xp).not.toHaveBeenCalled();expect(writes('spot_status_updates','delete')).toHaveLength(1);
 });
 it('does not claim XP when the optional reward cannot be measured',async()=>{
  mock.summary.mockReset().mockResolvedValue({lifetime_xp:0,current_level:'Rookie'});const response=await run();expect(await response.json()).not.toHaveProperty('xp');
 });
 it('returns English status feedback when the selected locale is English',async()=>{
  mock.language.mockReturnValue('en');expect(await (await run()).json()).toMatchObject({message:expect.stringContaining('2 different riders')});
 });
});
