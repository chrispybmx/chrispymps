import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
const mock=vi.hoisted(()=>({getUser:vi.fn(),update:vi.fn(),otp:vi.fn(),limit:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabaseAdmin:()=>({auth:{getUser:mock.getUser,admin:{updateUserById:mock.update}}}),supabasePublic:()=>({auth:{signInWithOtp:mock.otp}})}));
vi.mock('@/lib/rate-limit',()=>({checkRateLimit:mock.limit}));
import { hasEmailProof,recordEmailProof } from '@/lib/email-verification';
import { GET,POST } from '@/app/api/auth/email-verification/route';
const user=()=>({id:'rider',email:'rider@example.com',email_confirmed_at:'2026-10-01',app_metadata:{},user_metadata:{}} as unknown as User);
const proof={email:'rider@example.com',method:'email_link',verified_at:'2026-10-10T12:00:00Z'};
const req=(token='valid')=>new NextRequest('https://maps.chrispybmx.com/api/auth/email-verification',{method:'POST',headers:token?{authorization:`Bearer ${token}`}:{},body:JSON.stringify({email:'other@example.com',verified:true})});
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('EMAIL_VERIFICATION_ENABLED','true');mock.getUser.mockResolvedValue({data:{user:user()},error:null});mock.update.mockResolvedValue({error:null});mock.otp.mockResolvedValue({error:null});mock.limit.mockResolvedValue({allowed:true});});
afterEach(()=>vi.unstubAllEnvs());
describe('email ownership proof',()=>{
  it('does not trust historical autoconfirm or user-controlled metadata',()=>{const u=user();expect(hasEmailProof(u)).toBe(false);u.user_metadata.cm_email_proof=proof;expect(hasEmailProof(u)).toBe(false);});
  it('requires trusted proof matching the current confirmed email',()=>{const u=user();u.app_metadata.cm_email_proof=proof;expect(hasEmailProof(u)).toBe(true);u.email='changed@example.com';expect(hasEmailProof(u)).toBe(false);u.email=proof.email;delete u.email_confirmed_at;expect(hasEmailProof(u)).toBe(false);});
  it('writes proof to admin metadata only',async()=>{await recordEmailProof(user());expect(mock.update).toHaveBeenCalledWith('rider',{app_metadata:{cm_email_proof:expect.objectContaining({email:proof.email,method:'email_link'})}});});
  it('fails closed on unconfirmed email or failed persistence',async()=>{const u=user();delete u.email_confirmed_at;await expect(recordEmailProof(u)).rejects.toThrow();expect(mock.update).not.toHaveBeenCalled();mock.update.mockResolvedValue({error:{message:'secret'}});await expect(recordEmailProof(user())).rejects.toThrow('EMAIL_PROOF_UNAVAILABLE');});
});
describe('email verification API',()=>{
  it('requires a valid bearer token',async()=>{expect((await POST(req(''))).status).toBe(401);mock.getUser.mockResolvedValue({data:{user:null},error:{}});expect((await POST(req())).status).toBe(401);expect(mock.otp).not.toHaveBeenCalled();});
  it('reads status without sending mail and disables caching',async()=>{const r=await GET(req());expect(await r.json()).toMatchObject({verified:false,enabled:true});expect(r.headers.get('cache-control')).toBe('no-store');expect(mock.otp).not.toHaveBeenCalled();});
  it('keeps delivery off unless explicitly configured',async()=>{vi.stubEnv('EMAIL_VERIFICATION_ENABLED','false');expect((await POST(req())).status).toBe(503);expect(mock.otp).not.toHaveBeenCalled();});
  it('sends only to the authenticated address and never creates users',async()=>{expect((await POST(req())).status).toBe(200);expect(mock.otp).toHaveBeenCalledWith({email:'rider@example.com',options:{shouldCreateUser:false,emailRedirectTo:expect.stringContaining('/auth/callback?flow=email')}});});
  it('does not resend for already verified accounts',async()=>{const u=user();u.app_metadata.cm_email_proof=proof;mock.getUser.mockResolvedValue({data:{user:u},error:null});expect(await (await POST(req())).json()).toMatchObject({verified:true});expect(mock.otp).not.toHaveBeenCalled();});
  it('honors rate limits',async()=>{mock.limit.mockResolvedValue({allowed:false});expect((await POST(req())).status).toBe(429);expect(mock.otp).not.toHaveBeenCalled();});
  it('does not expose provider errors or addresses',async()=>{mock.otp.mockResolvedValue({error:{message:'secret address other@example.com'}});const r=await POST(req());expect(r.status).toBe(503);expect(await r.text()).not.toContain('other@example.com');});
});
