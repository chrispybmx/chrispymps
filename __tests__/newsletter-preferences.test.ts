import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {newsletterMembership,setNewsletterMembership} from '@/lib/mailerlite-preferences';
import {GROUP_BY_SOURCE} from '@/lib/mailerlite';
const active={id:'123',status:'active',groups:[{id:GROUP_BY_SOURCE.newsletter},{id:'other-group'}]};
let calls:{url:string;init:RequestInit}[]=[];
function responses(...items:{status:number;data?:unknown}[]){vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{calls.push({url:String(url),init});const next=items.shift();if(!next)throw new Error('Unexpected request');return {ok:next.status>=200&&next.status<300,status:next.status,json:async()=>({data:next.data})};}));}
beforeEach(()=>{calls=[];vi.stubEnv('MAILERLITE_API_KEY','test-only');vi.stubEnv('NEWSLETTER_PROVIDER','mailerlite');});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('MailerLite newsletter scope',()=>{
 it('reads actual membership rather than trusting a local boolean',async()=>{responses({status:200,data:active});expect(await newsletterMembership('test@example.com')).toEqual({active:true,suppressed:false});});
 it('removes only the newsletter group and checks the result',async()=>{
  responses({status:200,data:active},{status:204},{status:200,data:{...active,groups:[{id:'other-group'}]}});
  await setNewsletterMembership('test@example.com',false);
  expect(calls[1].url).toBe(`https://connect.mailerlite.com/api/subscribers/123/groups/${GROUP_BY_SOURCE.newsletter}`);expect(calls[1].init.method).toBe('DELETE');expect(calls).toHaveLength(3);
 });
 it('does not declare withdrawal complete if provider still reports membership',async()=>{
  responses({status:200,data:active},{status:204},{status:200,data:active});await expect(setNewsletterMembership('test@example.com',false)).rejects.toThrow('provider_unavailable');
 });
 it.each(['unsubscribed','bounced','junk','unconfirmed'])('never silently reactivates %s',async status=>{
  responses({status:200,data:{...active,status}});await expect(setNewsletterMembership('test@example.com',true)).rejects.toThrow('provider_suppressed');expect(calls).toHaveLength(1);
 });
 it('creates a confirmed subscriber without adding service or unrelated groups',async()=>{
  responses({status:404},{status:201},{status:200,data:active});await setNewsletterMembership('test@example.com',true);
  expect(JSON.parse(String(calls[1].init.body))).toEqual({email:'test@example.com',groups:[GROUP_BY_SOURCE.newsletter]});
 });
 it('does not mutate an already-correct membership',async()=>{responses({status:200,data:active});await setNewsletterMembership('test@example.com',true);expect(calls).toHaveLength(1);});
 it('treats provider outage as unknown, not unsubscribed',async()=>{responses({status:500});await expect(newsletterMembership('test@example.com')).rejects.toThrow();});
 it('does not copy consent into an unreviewed secondary provider',async()=>{vi.stubEnv('NEWSLETTER_PROVIDER','both');responses();await expect(newsletterMembership('test@example.com')).rejects.toThrow();expect(calls).toHaveLength(0);});
});
