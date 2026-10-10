import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const database=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabaseAdmin:()=>database}));
beforeEach(() => { vi.resetModules(); database.rpc.mockReset(); vi.stubEnv('GEOCODING_DATABASE_LIMITER_ENABLED','false'); vi.stubEnv('UPSTASH_REDIS_REST_URL', ''); vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', ''); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('global geocoding protection', () => {
  it('uses a database slot and cached results without another provider request',async()=>{
    vi.stubEnv('GEOCODING_DATABASE_LIMITER_ENABLED','true');
    database.rpc.mockResolvedValue({data:true,error:null});
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>[]});vi.stubGlobal('fetch',fetch);
    const {requestGeocoding}=await import('@/lib/geocoding-server');
    const params=new URLSearchParams({q:'Roma'});
    await requestGeocoding('search',params,false);await requestGeocoding('search',params,false);
    expect(database.rpc).toHaveBeenCalledExactlyOnceWith('cm_claim_geocoding_slot');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([{data:false,error:null,message:'busy'},{data:null,error:{message:'down'},message:'unavailable'},{data:null,error:null,message:'unavailable'}])('fails closed for database slot $message',async result=>{
    vi.stubEnv('GEOCODING_DATABASE_LIMITER_ENABLED','true');database.rpc.mockResolvedValue(result);
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    const {requestGeocoding}=await import('@/lib/geocoding-server');
    await expect(requestGeocoding('search',new URLSearchParams({q:'Roma'}),false)).rejects.toThrow(result.message);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('never calls the provider in production without a shared limiter', async () => { const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); const {requestGeocoding} = await import('@/lib/geocoding-server'); await expect(requestGeocoding('search', new URLSearchParams({q:'Roma'}), false)).rejects.toThrow('unavailable'); expect(fetch).not.toHaveBeenCalled(); });
  it('shares one local slot between search and reverse and reuses cached searches', async () => { const fetch = vi.fn().mockResolvedValue({ok:true,json:async()=>[{name:'Roma'}]}); vi.stubGlobal('fetch',fetch); const {requestGeocoding} = await import('@/lib/geocoding-server'); const params = new URLSearchParams({q:'Roma'}); await requestGeocoding('search',params,true); await requestGeocoding('search',params,true); expect(fetch).toHaveBeenCalledTimes(1); await expect(requestGeocoding('reverse',new URLSearchParams({lat:'41',lon:'12'}),true)).rejects.toThrow('busy'); });
  it('fails closed if Redis fails rather than exceeding provider limits', async () => { vi.stubEnv('UPSTASH_REDIS_REST_URL','https://redis.example');vi.stubEnv('UPSTASH_REDIS_REST_TOKEN','test'); const fetch = vi.fn().mockResolvedValue({ok:false,json:async()=>({error:'down'})});vi.stubGlobal('fetch',fetch);const {requestGeocoding}=await import('@/lib/geocoding-server');await expect(requestGeocoding('search',new URLSearchParams({q:'Roma'}),false)).rejects.toThrow('unavailable');expect(fetch).toHaveBeenCalledTimes(1); });
});
