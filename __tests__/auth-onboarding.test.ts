import {describe,it,expect,vi,beforeEach} from 'vitest';
import type {User} from '@supabase/supabase-js';
const mocks=vi.hoisted(()=>({from:vi.fn(),welcome:vi.fn(),update:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabaseAdmin:()=>({from:mocks.from,auth:{admin:{updateUserById:mocks.update}}})}));
vi.mock('@/lib/newsletter',()=>({subscribeToNewsletter:mocks.welcome}));
import {completeAccount} from '@/lib/auth-onboarding';
let writes: {table:string,data:unknown}[];
const user=()=>({id:'rider',email:'rider@example.com',email_confirmed_at:'2026-09-26',user_metadata:{username:'rider',onboarding_pending:true,initial_rider_details:{birthDate:'2000-01-01',region:'Veneto'}}}) as unknown as User;
beforeEach(()=>{vi.clearAllMocks();writes=[];mocks.welcome.mockResolvedValue({ok:true});mocks.update.mockResolvedValue({error:null});mocks.from.mockImplementation((table:string)=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{username:'rider'},error:null})})}),upsert:async(data:unknown)=>{writes.push({table,data});return {error:null};}}));});
describe('verified account completion',()=>{
 it('saves private rider details after email confirmation and only joins the service group',async()=>{const result=await completeAccount(user());expect(result).toEqual({profileReady:true,pending:false});expect(writes[0]).toMatchObject({table:'rider_details',data:{birth_date:'2000-01-01'}});expect(mocks.welcome).toHaveBeenCalledWith('rider@example.com','rider',{source:'submit-spot'});expect(mocks.update.mock.calls[0][1].user_metadata.initial_rider_details).toBeNull();});
 it('does not resend welcome for an already completed account',async()=>{const u=user();u.user_metadata.onboarding_pending=false;await completeAccount(u);expect(mocks.welcome).not.toHaveBeenCalled();expect(writes).toHaveLength(0);});
 it('retains pending setup when provider delivery is unavailable',async()=>{mocks.welcome.mockResolvedValue({ok:false});const result=await completeAccount(user());expect(result.pending).toBe(true);expect(mocks.update.mock.calls[0][1].user_metadata.onboarding_pending).toBe(true);});
 it('does not enroll an unconfirmed address in the welcome group',async()=>{const u=user();delete u.email_confirmed_at;await completeAccount(u);expect(mocks.welcome).not.toHaveBeenCalled();});
});
