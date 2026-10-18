import { describe,it,expect,vi } from 'vitest';
import { checkReleaseReadiness } from '../scripts/release-readiness.mjs';
const env={NEXT_PUBLIC_SUPABASE_URL:'https://project.example.test',NEXT_PUBLIC_SUPABASE_ANON_KEY:'private-anon-value',SUPABASE_SERVICE_ROLE_KEY:'private-admin-value',MAILERLITE_API_KEY:'private-provider-value'};
describe('read-only release checks',()=>{
 it('does not contact providers by default and reports missing global limiter',async()=>{
  const fetcher=vi.fn();const checks=await checkReleaseReadiness(env,{fetcher});
  expect(fetcher).not.toHaveBeenCalled();expect(checks.find(c=>c.id==='UPSTASH_REDIS_REST_URL')?.status).toBe('blocked');
  expect(checks.find(c=>c.id==='remote-state')?.status).toBe('manual');
 });
 it('rejects UI/server flag mismatch',async()=>{
  const checks=await checkReleaseReadiness({...env,NEXT_PUBLIC_SESSION_INVITES_ENABLED:'true'});
  expect(checks.find(c=>c.id==='sessions')?.status).toBe('blocked');
 });
 it('never declares live delivery verified from credentials alone',async()=>{
  const checks=await checkReleaseReadiness({...env,RESEND_API_KEY:'private-resend-value'});
  expect(checks.find(c=>c.id==='smtp-delivery')?.status).toBe('manual');
  expect(JSON.stringify(checks)).not.toContain('private-');
 });
 it('reports autoconfirm, missing tables and missing RPC without mutating calls',async()=>{
  const fetcher=vi.fn(async(url,options)=>new Response(JSON.stringify(url.endsWith('/auth/v1/settings')?{mailer_autoconfirm:true}:url.endsWith('/rest/v1/')?{paths:{}}:{}),{status:options.method==='HEAD'?404:200}));
  const checks=await checkReleaseReadiness(env,{remote:true,allFeatures:true,fetcher});
  expect(checks.find(c=>c.id==='email-confirmation')?.status).toBe('blocked');
  expect(checks.find(c=>c.id==='cm_session_invites')?.status).toBe('blocked');
  expect(checks.find(c=>c.id==='cm_session_create_invite')?.status).toBe('blocked');
  expect(fetcher.mock.calls.every(([,options])=>['GET','HEAD'].includes(options.method)&&options.redirect==='error')).toBe(true);
  expect(JSON.stringify(checks)).not.toContain('private-');
 });
 it('redacts exceptions that contain credential values',async()=>{
  const checks=await checkReleaseReadiness(env,{remote:true,fetcher:async()=>{throw new Error(env.SUPABASE_SERVICE_ROLE_KEY);}});
  expect(checks.find(c=>c.id==='email-confirmation')?.status).toBe('blocked');
  expect(JSON.stringify(checks)).not.toContain(env.SUPABASE_SERVICE_ROLE_KEY);
 });
 it('refuses credential-bearing or unencrypted remote URLs',async()=>{
  const fetcher=vi.fn();const checks=await checkReleaseReadiness({...env,NEXT_PUBLIC_SUPABASE_URL:'http://user:password@example.test'},{remote:true,fetcher});
  expect(checks.find(c=>c.id==='remote-url')?.status).toBe('blocked');expect(fetcher).not.toHaveBeenCalled();
 });
});
