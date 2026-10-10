import {beforeEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mock=vi.hoisted(()=>({user:vi.fn(),select:vi.fn(),eq:vi.fn(),read:vi.fn(),upsert:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabaseAdmin:()=>({auth:{getUser:mock.user},from:()=>({select:mock.select,upsert:mock.upsert})})}));
import {GET,POST} from '@/app/api/rider/details/route';
const req=(body:unknown={},token='owner')=>new NextRequest('https://maps.chrispybmx.com/api/rider/details?user_id=someone-else',{method:'POST',headers:token?{authorization:`Bearer ${token}`}:{},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();mock.user.mockResolvedValue({data:{user:{id:'owner'}},error:null});mock.select.mockReturnValue({eq:mock.eq});mock.eq.mockReturnValue({maybeSingle:mock.read});mock.read.mockResolvedValue({data:{country_code:'IT',disciplines:['mtb']},error:null});mock.upsert.mockResolvedValue({error:null});});
describe('private rider preferences',()=>{
 it('requires authentication on reads and writes',async()=>{expect((await GET(req({},''))).status).toBe(401);expect((await POST(req({},''))).status).toBe(401);expect(mock.select).not.toHaveBeenCalled();});
 it('uses only the token identity, never a URL user id',async()=>{const r=await GET(req());expect(r.status).toBe(200);expect(mock.eq).toHaveBeenCalledWith('user_id','owner');expect(mock.select).toHaveBeenCalledWith('country_code,disciplines,region');expect(r.headers.get('cache-control')).toBe('no-store');});
 it('saves MTB and country without touching birth date, consent or public profile',async()=>{await POST(req({countryCode:'IT',disciplines:['bmx','mtb'],user_id:'someone-else'}));expect(mock.upsert).toHaveBeenCalledWith({user_id:'owner',country_code:'IT',disciplines:['bmx','mtb'],updated_at:expect.any(String)},{onConflict:'user_id'});});
 it.each([{birthDate:'2000-02-30'},{countryCode:'XX'},{countryCode:'it'}])('rejects invalid values %j',async patch=>{expect((await POST(req(patch))).status).toBe(422);expect(mock.upsert).not.toHaveBeenCalled();});
 it('allows removing optional preferences',async()=>{expect((await POST(req({countryCode:null,disciplines:[]}))).status).toBe(200);expect(mock.upsert.mock.calls[0][0]).toMatchObject({country_code:null,disciplines:null});});
 it('does not expose database failures',async()=>{mock.read.mockResolvedValue({error:{message:'secret'},data:null});const r=await GET(req());expect(r.status).toBe(503);expect(await r.text()).not.toContain('secret');});
});
