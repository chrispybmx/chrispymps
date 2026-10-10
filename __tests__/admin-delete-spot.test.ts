import { beforeEach,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),photos:vi.fn(),remove:vi.fn(),deleteSpot:vi.fn()}));
vi.mock('@/lib/auth',()=>({isAdminAuthenticated:mocks.auth}));
vi.mock('@/lib/supabase',()=>({supabaseAdmin:()=>({
 from:(table:string)=>table==='spot_photos'?{select:()=>({eq:mocks.photos})}:{delete:()=>({eq:mocks.deleteSpot})},
 storage:{from:()=>({remove:mocks.remove})},
})}));
import { POST } from '@/app/api/admin/delete-spot/route';
const request=()=>new Request('http://localhost/api/admin/delete-spot',{method:'POST',body:JSON.stringify({spot_id:'22222222-2222-4222-8222-222222222222'})});
beforeEach(()=>{
 vi.clearAllMocks();mocks.auth.mockReturnValue(true);
 mocks.photos.mockResolvedValue({data:[{url:'https://example.com/storage/v1/object/public/spot-photos/test.jpg'}],error:null});
 mocks.deleteSpot.mockResolvedValue({error:null});mocks.remove.mockResolvedValue({error:null});
});
it('never removes files when the database rejects deletion',async()=>{
 mocks.deleteSpot.mockResolvedValue({error:{message:'constraint'}});
 expect((await POST(request())).status).toBe(500);expect(mocks.remove).not.toHaveBeenCalled();
});
it('deletes the database row before removing files',async()=>{
 expect((await POST(request())).status).toBe(200);
 expect(mocks.deleteSpot.mock.invocationCallOrder[0]).toBeLessThan(mocks.remove.mock.invocationCallOrder[0]);
 expect(mocks.remove).toHaveBeenCalledWith(['test.jpg']);
});
it('reports incomplete storage cleanup without claiming the spot still exists',async()=>{
 mocks.remove.mockResolvedValue({error:{message:'storage unavailable'}});
 expect(await (await POST(request())).json()).toMatchObject({ok:true,cleanupPending:true});
});
it('does not delete anything when photos cannot be read or admin is unauthorized',async()=>{
 mocks.photos.mockResolvedValue({error:{message:'read failed'}});
 expect((await POST(request())).status).toBe(500);expect(mocks.deleteSpot).not.toHaveBeenCalled();
 mocks.auth.mockReturnValue(false);
 expect((await POST(request())).status).toBe(401);expect(mocks.remove).not.toHaveBeenCalled();
});
