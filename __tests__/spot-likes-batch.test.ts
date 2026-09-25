import {beforeEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mock=vi.hoisted(()=>({getUser:vi.fn(),from:vi.fn(),responses:[] as unknown[],queries:[] as any[]}));
vi.mock('@/lib/supabase',()=>({supabaseAdmin:()=>({auth:{getUser:mock.getUser},from:mock.from})}));
import {GET,POST} from '@/app/api/spot-likes/route';
const id='11111111-1111-4111-8111-111111111111';
const second='22222222-2222-4222-8222-222222222222';
function req(query:string,token?:string){return new NextRequest('http://localhost/api/spot-likes?'+query,{headers:token?{Authorization:'Bearer '+token}:{}})}
beforeEach(()=>{
 vi.clearAllMocks();mock.responses=[];mock.queries=[];
 mock.getUser.mockResolvedValue({data:{user:{id:'actor'}},error:null});
 mock.from.mockImplementation((table:string)=>{const result=mock.responses.shift();const q:any={table,then:(resolve:any)=>Promise.resolve(result).then(resolve)};for(const name of ['select','eq','in','single','maybeSingle','insert','delete'])q[name]=vi.fn(()=>q);mock.queries.push(q);return q;});
});
describe('likes batch and persistence failures',()=>{
 it('loads approved spot likes in one authentication check and preserves order independent results',async()=>{
  mock.responses=[{data:[{id,likes_count:3},{id:second,likes_count:7}],error:null},{data:[{spot_id:second}],error:null}];
  const result=await GET(req('spot_ids='+id+','+second,'token'));
  expect(await result.json()).toEqual({ok:true,data:[{spot_id:id,count:3,hasLiked:false},{spot_id:second,count:7,hasLiked:true}]});
  expect(mock.getUser).toHaveBeenCalledTimes(1);
  expect(mock.queries[0].eq).toHaveBeenCalledWith('status','approved');
  expect(mock.queries[1].eq).toHaveBeenCalledWith('user_id','actor');
  expect(result.headers.get('cache-control')).toContain('no-store');
 });
 it('keeps the old single spot response',async()=>{
  mock.responses=[{data:[{id,likes_count:2}],error:null}];
  expect(await (await GET(req('spot_id='+id))).json()).toEqual({ok:true,count:2,hasLiked:false});
  expect(mock.getUser).not.toHaveBeenCalled();
 });
 it('does not invent zero likes on a database error',async()=>{
  mock.responses=[{data:null,error:{message:'private schema details'}}];
  const result=await GET(req('spot_ids='+id));expect(result.status).toBe(503);expect(await result.text()).not.toContain('private schema');
 });
 it('does not pretend an expired user has never liked any spot',async()=>{
  mock.responses=[{data:[{id,likes_count:2}],error:null}];mock.getUser.mockResolvedValue({data:{user:null},error:{message:'expired'}});
  expect((await GET(req('spot_ids='+id,'expired'))).status).toBe(401);
 });
 it('rejects over-limit or malformed batches before queries',async()=>{
  const ids=Array.from({length:25},(_,n)=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`);
  for(const query of ['spot_ids='+ids.join(','),'spot_ids=','spot_ids=secret'])expect((await GET(req(query))).status).toBe(400);
  expect(mock.from).not.toHaveBeenCalled();
 });
 it('never returns success when the like write fails',async()=>{
  mock.responses=[{data:{id},error:null},{data:null,error:null},{data:null,error:{message:'insert failed'}}];
  const result=await POST(new NextRequest('http://localhost/api/spot-likes',{method:'POST',headers:{Authorization:'Bearer token','Content-Type':'application/json'},body:JSON.stringify({spot_id:id})}));
  expect(result.status).toBe(503);expect(await result.json()).toMatchObject({ok:false});
 });
});
