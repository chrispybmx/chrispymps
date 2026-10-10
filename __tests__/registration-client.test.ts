import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
const mock=vi.hoisted(()=>({signup:vi.fn(),signout:vi.fn(),profile:vi.fn(),fetch:vi.fn()}));
vi.mock('@/lib/supabase-browser',()=>({supabaseBrowser:()=>({auth:{signUp:mock.signup,signOut:mock.signout},from:()=>({select:()=>({ilike:()=>({maybeSingle:mock.profile})})})})}));
vi.mock('@/lib/auth-navigation',()=>({authReturnUrl:()=> 'https://maps.chrispybmx.com/auth/callback?flow=email'}));
import {signUp} from '@/lib/auth-client';
const details={birthDate:'2000-01-01',countryCode:'IT',disciplines:['bmx','mtb']};
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('fetch',mock.fetch);mock.fetch.mockResolvedValue(Response.json({ok:true,profileReady:true,pending:false}));mock.signup.mockResolvedValue({data:{user:{id:'new'},session:null},error:null});mock.signout.mockResolvedValue({error:null});mock.profile.mockResolvedValue({data:null,error:null});});
afterEach(()=>vi.unstubAllGlobals());
describe('signup',()=>{
 it('rejects a declared age under 14 before any network call',async()=>{await expect(signUp('test@example.com','password','rider',{...details,birthDate:'2020-01-01'})).rejects.toThrow();expect(mock.fetch).not.toHaveBeenCalled();expect(mock.signup).not.toHaveBeenCalled();});
 it('does not require country, sports or birth date (Aggiungi spot uses the 14+ checkbox only)',async()=>{expect(await signUp('test@example.com','password','rider',{returnTo:'/map?add=1'})).toBe('confirm_email');expect(mock.signup).toHaveBeenCalledTimes(1);});
 it('enters immediately when the provider confirms automatically, so the spot can be added right away',async()=>{mock.signup.mockResolvedValue({data:{user:{id:'new'},session:{access_token:'test'}},error:null});expect(await signUp('test@example.com','password','rider',details)).toBe('ok');expect(mock.signout).not.toHaveBeenCalled();expect(mock.fetch).toHaveBeenCalledWith('/api/auth/complete',expect.objectContaining({method:'POST'}));});
 it('asks to check the email only when the provider requires confirmation',async()=>{expect(await signUp('test@example.com','password','rider',details)).toBe('confirm_email');expect(mock.signup).toHaveBeenCalledWith(expect.objectContaining({options:expect.objectContaining({data:expect.objectContaining({registration_version:2,initial_rider_details:{...details,region:''}})})}));expect(mock.fetch).not.toHaveBeenCalled();});
 it('never calls a provider-settings preflight',async()=>{await signUp('test@example.com','password','rider',details);expect(mock.fetch.mock.calls.map(call=>String(call[0]))).not.toContain('/api/auth/registration-check');});
 it('stops on username collision',async()=>{mock.profile.mockResolvedValue({data:{id:'existing'},error:null});await expect(signUp('test@example.com','password','rider',details)).rejects.toThrow('Username');expect(mock.signup).not.toHaveBeenCalled();});
});
