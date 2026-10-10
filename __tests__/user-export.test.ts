import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mock = vi.hoisted(() => ({user:vi.fn(), from:vi.fn(), select:vi.fn(), eq:vi.fn(), order:vi.fn(), range:vi.fn(), limit:vi.fn()}));
vi.mock('@/lib/supabase', () => ({supabaseAdmin:() => ({auth:{getUser:mock.user}, from:mock.from})}));
vi.mock('@/lib/rate-limit', () => ({checkRateLimit:mock.limit}));
import { GET } from '@/app/api/user/export/route';
const request = (auth='Bearer owner') => new NextRequest('https://maps.chrispybmx.com/api/user/export?user_id=victim&table=auth.users', {headers:auth?{authorization:auth}:{}});

beforeEach(() => {
  vi.clearAllMocks();
  mock.user.mockResolvedValue({data:{user:{id:'owner',email:'owner@example.test',created_at:'2026-01-01',app_metadata:{secret:'do-not-export'},user_metadata:{private:'do-not-export'}}},error:null});
  mock.limit.mockResolvedValue({allowed:true,resetAt:Date.now()+3600000});
  mock.from.mockReturnValue({select:mock.select});
  mock.select.mockReturnValue({eq:mock.eq});
  mock.eq.mockReturnValue({order:mock.order});
  mock.order.mockReturnValue({range:mock.range});
  mock.range.mockResolvedValue({data:[],error:null});
});

describe('scoped account export', () => {
  it.each(['','Basic owner','Bearer owner extra'])('rejects missing or malformed authorization: %s',async auth => {
    expect((await GET(request(auth))).status).toBe(401);
    expect(mock.from).not.toHaveBeenCalled();
  });
  it('rejects invalid tokens before database reads',async () => {
    mock.user.mockResolvedValue({data:{user:null},error:{message:'invalid'}});
    expect((await GET(request())).status).toBe(401);expect(mock.from).not.toHaveBeenCalled();
  });
  it('only reads allowlisted fields belonging to the verified user, never URL identity',async () => {
    const response=await GET(request()); const body=await response.json();
    expect(response.status).toBe(200);
    expect(mock.from.mock.calls.map(call=>call[0])).toEqual(['profiles','rider_details','cm_rider_sessions','cm_rider_stats_preferences','spot_favorites']);
    expect(mock.eq.mock.calls.every(call=>call[1]==='owner')).toBe(true);
    expect(mock.select.mock.calls.some(call=>call[0].includes('*'))).toBe(false);
    expect(body.account).toEqual({id:'owner',email:'owner@example.test',createdAt:'2026-01-01'});
    expect(JSON.stringify(body)).not.toContain('do-not-export');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Authorization');
    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(body.excluded).toContain('Messaggi e inviti');
  });
  it('paginates instead of silently truncating at a database row cap',async () => {
    mock.range.mockResolvedValueOnce({data:Array.from({length:500},(_,i)=>({id:i})),error:null})
      .mockResolvedValueOnce({data:[{id:500}],error:null});
    const body=await (await GET(request())).json();
    expect(body.profile).toHaveLength(501);
    expect(mock.range).toHaveBeenCalledWith(500,999);
  });
  it('represents expired sessions as stopped at their deadline without modifying the database',async () => {
    mock.range.mockResolvedValueOnce({data:[],error:null}).mockResolvedValueOnce({data:[],error:null})
      .mockResolvedValueOnce({data:[{id:'session',status:'active',ended_at:null,deadline_at:'2020-01-01T00:00:00Z'}],error:null});
    const body=await (await GET(request())).json();
    expect(body.sessions[0]).toMatchObject({status:'needs_confirmation',ended_at:'2020-01-01T00:00:00Z'});
  });
  it('rate limits by verified account and returns a retry delay',async () => {
    mock.limit.mockResolvedValue({allowed:false,resetAt:Date.now()+3600000});
    const response=await GET(request());expect(response.status).toBe(429);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(mock.from).not.toHaveBeenCalled();expect(mock.limit).toHaveBeenCalledWith('account-export:owner',3,3600000);
  });
  it('never returns a partial archive or database error details',async () => {
    mock.range.mockResolvedValueOnce({data:[{id:'partial'}],error:null}).mockResolvedValueOnce({data:null,error:{message:'secret sql'}});
    const response=await GET(request());expect(response.status).toBe(503);
    const body=await response.text();expect(body).not.toContain('partial');expect(body).not.toContain('secret sql');
  });
  it('bounds oversized archives and provides a manual request path',async () => {
    mock.range.mockResolvedValue({data:[{bio:'x'.repeat(8*1024*1024)}],error:null});
    const response=await GET(request());expect(response.status).toBe(413);
    expect(await response.text()).toContain('christian.ceresato@gmail.com');
  });
});
