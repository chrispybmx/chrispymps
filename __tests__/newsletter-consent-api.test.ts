import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {createHmac} from 'node:crypto';
const m=vi.hoisted(()=>({user:vi.fn(),request:vi.fn(),choose:vi.fn(),status:vi.fn(),confirm:vi.fn(),welcome:vi.fn(),rpc:vi.fn(),from:vi.fn(),limit:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabaseAdmin:()=>({auth:{getUser:m.user},rpc:m.rpc,from:m.from})}));
vi.mock('@/lib/newsletter-preferences',()=>({newsletterPreferencesEnabled:()=>process.env.NEWSLETTER_CONSENT_ENABLED==='true',requestNewsletterConfirmation:m.request,chooseNewsletter:m.choose,newsletterStatus:m.status,confirmNewsletter:m.confirm}));
vi.mock('@/lib/newsletter',()=>({subscribeToNewsletter:m.welcome}));
vi.mock('@/lib/rate-limit',()=>({checkRateLimit:m.limit}));
import {POST as subscribe} from '@/app/api/newsletter/subscribe/route';
import {GET as preferences,POST as choose} from '@/app/api/newsletter/preferences/route';
import {POST as confirm} from '@/app/api/newsletter/confirm/route';
import {POST as webhook} from '@/app/api/newsletter/mailerlite-webhook/route';
import {POST as profile} from '@/app/api/rider/details/route';
import {NEWSLETTER_CONSENT_VERSION} from '@/lib/newsletter-consent';
const form={email:'rider@example.com',source:'newsletter',consent:true,over16:true,consentVersion:NEWSLETTER_CONSENT_VERSION};
function req(body:unknown,extra:Record<string,string>={}){return new NextRequest('https://maps.chrispybmx.com/api/newsletter/subscribe',{method:'POST',headers:{origin:'https://maps.chrispybmx.com','content-type':'application/json',...extra},body:JSON.stringify(body)});}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('NEWSLETTER_CONSENT_ENABLED','true');m.user.mockResolvedValue({data:{user:{id:'user',email:'owner@example.com',email_confirmed_at:'2026-01-01',user_metadata:{username:'rider'}}},error:null});m.request.mockResolvedValue(undefined);m.welcome.mockResolvedValue({ok:true});m.choose.mockResolvedValue(true);m.limit.mockResolvedValue({allowed:true});m.rpc.mockResolvedValue({error:null});const q:any={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:null,error:null}),upsert:vi.fn().mockResolvedValue({error:null})};m.from.mockReturnValue(q);});
afterEach(()=>vi.unstubAllEnvs());
describe('public newsletter form',()=>{
 it('requests confirmation instead of enrolling immediately',async()=>{const r=await subscribe(req(form));expect(r.status).toBe(202);expect(m.request).toHaveBeenCalledWith('rider@example.com');expect(m.welcome).not.toHaveBeenCalled();expect(m.choose).not.toHaveBeenCalled();});
 it.each([{consent:false},{over16:false},{consentVersion:'old'},{consent:undefined},{alsoNewsletter:true}])('rejects missing or outdated proof %j',async changes=>{expect((await subscribe(req({...form,...changes}))).status).toBe(422);expect(m.request).not.toHaveBeenCalled();});
 it('accepts the browser target Host when Next uses an internal URL',async()=>{expect((await subscribe(new NextRequest('http://localhost:3100/api/newsletter/subscribe',{method:'POST',headers:{origin:'http://127.0.0.1:3100',host:'127.0.0.1:3100'},body:JSON.stringify(form)}))).status).toBe(202);});
 it('blocks foreign origins before any processing',async()=>{expect((await subscribe(req(form,{origin:'https://evil.example'}))).status).toBe(403);expect(m.request).not.toHaveBeenCalled();});
 it('keeps landing-origin support without permitting arbitrary origins',async()=>{const r=await subscribe(req(form,{origin:'https://chrispybmx.com'}));expect(r.headers.get('access-control-allow-origin')).toBe('https://chrispybmx.com');});
 it('does not collect anything before deployment enablement',async()=>{vi.stubEnv('NEWSLETTER_CONSENT_ENABLED','false');expect((await subscribe(req(form))).status).toBe(503);expect(m.request).not.toHaveBeenCalled();});
 it('rejects large bodies',async()=>{expect((await subscribe(req({...form,extra:'x'.repeat(2200)}))).status).toBe(400);});
 it('does not claim success if confirmation delivery failed',async()=>{m.request.mockRejectedValue(new Error('private provider details'));const r=await subscribe(req(form));expect(r.status).toBe(503);expect(await r.text()).not.toContain('private');});
 it('requires authentication for the welcome group',async()=>{expect((await subscribe(req({source:'submit-spot',email:'victim@example.com'}))).status).toBe(401);expect(m.welcome).not.toHaveBeenCalled();});
 it('uses only the verified account email for welcome',async()=>{expect((await subscribe(req({source:'submit-spot',email:'victim@example.com',alsoNewsletter:true},{authorization:'Bearer token'}))).status).toBe(200);expect(m.welcome).toHaveBeenCalledWith('owner@example.com','rider',{source:'submit-spot'});expect(m.request).not.toHaveBeenCalled();});
 it('does not send welcome to unconfirmed accounts',async()=>{m.user.mockResolvedValue({data:{user:{email:'owner@example.com'}},error:null});expect((await subscribe(req({source:'signup'},{authorization:'Bearer token'}))).status).toBe(401);});
});
describe('account newsletter preferences',()=>{
 it('requires authentication to view settings',async()=>{expect((await preferences(req({}))).status).toBe(401);expect(m.status).not.toHaveBeenCalled();});
 it('requires current affirmative consent for activation',async()=>{expect((await choose(req({enabled:true},{authorization:'Bearer token'}))).status).toBe(422);expect(m.choose).not.toHaveBeenCalled();});
 it('withdraws without forcing another consent checkbox',async()=>{const r=await choose(req({enabled:false},{authorization:'Bearer token'}));expect(r.status).toBe(200);expect(m.choose).toHaveBeenCalledWith('owner@example.com',false,'profile');});
 it('reports pending rather than success when provider sync fails',async()=>{m.choose.mockResolvedValue(false);const r=await choose(req({enabled:false},{authorization:'Bearer token'}));expect(r.status).toBe(202);expect((await r.json()).pending).toBe(true);});
 it('does not accept a forged email override',async()=>{expect((await choose(req({enabled:false,email:'victim@example.com'},{authorization:'Bearer token'}))).status).toBe(422);expect(m.choose).not.toHaveBeenCalled();});
 it('does not hide a failed proof write',async()=>{m.choose.mockRejectedValue(new Error());expect((await choose(req({enabled:false},{authorization:'Bearer token'}))).status).toBe(503);});
 it('rejects under-age accounts even with a checked attestation',async()=>{const q:any={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{birth_date:'2020-01-01'},error:null})};m.from.mockReturnValue(q);expect((await choose(req({enabled:true,over16:true,consentVersion:NEWSLETTER_CONSENT_VERSION},{authorization:'Bearer token'}))).status).toBe(422);expect(m.choose).not.toHaveBeenCalled();});
});
describe('confirmation and provider callbacks',()=>{
 it('rejects malformed confirmation tokens without DB calls',async()=>{expect((await confirm(req({token:'short'}))).status).toBe(400);expect(m.confirm).not.toHaveBeenCalled();});
 it('reports an expired or used token explicitly',async()=>{m.confirm.mockResolvedValue(null);expect((await confirm(req({token:'a'.repeat(64)}))).status).toBe(410);});
 it('reports a provider-suppressed address without claiming reactivation',async()=>{m.confirm.mockResolvedValue({synced:false,blocked:true});const r=await confirm(req({token:'a'.repeat(64)}));expect((await r.json()).message).toContain('Non è stato riattivato');});
 it('rejects unsigned provider withdrawals',async()=>{vi.stubEnv('MAILERLITE_WEBHOOK_SECRET','secret');expect((await webhook(req({event:'subscriber.unsubscribed'}))).status).toBe(401);expect(m.rpc).not.toHaveBeenCalled();});
 it('authenticates raw-body signatures and preserves event time',async()=>{
  vi.stubEnv('MAILERLITE_WEBHOOK_SECRET','secret');const body={event:'subscriber.unsubscribed',email:'Rider@Example.com',updated_at:'2026-01-01 12:00:00'};const signature=createHmac('sha256','secret').update(JSON.stringify(body)).digest('hex');
  expect((await webhook(req(body,{signature}))).status).toBe(204);expect(m.rpc).toHaveBeenCalledWith('cm_newsletter_provider_withdraw',{p_email:'rider@example.com',p_at:'2026-01-01T12:00:00.000Z'});
 });
});
describe('rider profile regressions',()=>{
 it('personalization never resets omitted birth date or newsletter consent',async()=>{const r=await profile(req({disciplines:['bmx'],ridingSinceYear:2020},{authorization:'Bearer token'}));expect(r.status).toBe(200);const payload=m.from.mock.results[0].value.upsert.mock.calls[0][0];expect(payload).not.toHaveProperty('newsletter_opt_in');expect(payload).not.toHaveProperty('newsletter_opt_in_at');expect(payload).not.toHaveProperty('birth_date');expect(m.choose).not.toHaveBeenCalled();expect(m.welcome).not.toHaveBeenCalled();});
 it('legacy newsletter fields cannot bypass the dedicated consent API',async()=>{const r=await profile(req({newsletter:true},{authorization:'Bearer token'}));expect((await r.json()).newsletterAttiva).toBe(false);expect(m.welcome).not.toHaveBeenCalled();expect(m.choose).not.toHaveBeenCalled();});
});
