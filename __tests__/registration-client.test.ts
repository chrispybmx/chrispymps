import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
const mock=vi.hoisted(()=>({signup:vi.fn(),signout:vi.fn(),profile:vi.fn(),fetch:vi.fn()}));
vi.mock('@/lib/supabase-browser',()=>({supabaseBrowser:()=>({auth:{signUp:mock.signup,signOut:mock.signout},from:()=>({select:()=>({ilike:()=>({maybeSingle:mock.profile})})})})}));
vi.mock('@/lib/auth-navigation',()=>({authReturnUrl:()=> 'https://maps.chrispybmx.com/auth/callback?flow=email'}));
import {signUp} from '@/lib/auth-client';
const details={birthDate:'2000-01-01',countryCode:'IT',disciplines:['bmx','mtb']};
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('fetch',mock.fetch);mock.fetch.mockResolvedValue(Response.json({ok:true}));mock.signup.mockResolvedValue({data:{user:{id:'new'},session:null},error:null});mock.signout.mockResolvedValue({error:null});mock.profile.mockResolvedValue({data:null,error:null});});
afterEach(()=>vi.unstubAllGlobals());
describe('signup confirmation flow',()=>{
 it('requires age and country before network calls',async()=>{await expect(signUp('test@example.com','password','rider',{...details,birthDate:'2020-01-01'})).rejects.toThrow();expect(mock.fetch).not.toHaveBeenCalled();expect(mock.signup).not.toHaveBeenCalled();});
 it('stops before signup when provider configuration is not ready',async()=>{mock.fetch.mockResolvedValue(Response.json({ok:false,error:'unavailable'},{status:503}));await expect(signUp('test@example.com','password','rider',details)).rejects.toThrow('unavailable');expect(mock.signup).not.toHaveBeenCalled();});
 it('uses the browser SDK and leaves the account pending email confirmation',async()=>{expect(await signUp('test@example.com','password','rider',details)).toBe('confirm_email');expect(mock.signup).toHaveBeenCalledWith(expect.objectContaining({options:expect.objectContaining({data:expect.objectContaining({registration_version:2,initial_rider_details:{...details,region:''}})})}));expect(mock.fetch).toHaveBeenCalledTimes(1);});
 it('signs out on unexpected automatic confirmation instead of authorizing access',async()=>{mock.signup.mockResolvedValue({data:{user:{id:'new'},session:{access_token:'test'}},error:null});await expect(signUp('test@example.com','password','rider',details)).rejects.toThrow('Conferma email');expect(mock.signout).toHaveBeenCalledTimes(1);expect(mock.fetch).toHaveBeenCalledTimes(1);});
 it('stops on username collision',async()=>{mock.profile.mockResolvedValue({data:{id:'existing'},error:null});await expect(signUp('test@example.com','password','rider',details)).rejects.toThrow('Username');expect(mock.signup).not.toHaveBeenCalled();});
});
