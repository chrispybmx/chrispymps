import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mock = vi.hoisted(() => ({
  admin: vi.fn(), from: vi.fn(), getUserById: vi.fn(), send: vi.fn(), resend: vi.fn(),
  queries: [] as { table: string; calls: { method: string; args: unknown[] }[] }[],
  responses: {} as Record<string, unknown[]>,
}));
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: mock.admin }));
vi.mock('resend', () => ({ Resend: mock.resend }));
vi.mock('@/lib/constants', () => ({ APP_CONFIG: { url: 'https://example.test' } }));
import { deliverSessionInviteEmail, sessionEmailEnabled } from '@/lib/session-invite-email';
import { POST as worker } from '@/app/api/internal/session-invite-email/route';

const INVITE='11111111-1111-4111-8111-111111111111';
const RECIPIENT='22222222-2222-4222-8222-222222222222';
const NOW=new Date('2026-09-25T12:00:00.000Z');
const OUTBOX='cm_session_email_outbox';
const job=(attempts=0)=>({data:{invite_id:INVITE,recipient_id:RECIPIENT,attempts},error:null});
const eligible=(patch:Record<string,unknown>={})=>({data:{status:'pending',starts_at:'2026-09-26T12:00:00Z',recipient_id:RECIPIENT,...patch},error:null});
const run=()=>deliverSessionInviteEmail({id:INVITE});
const outboxQueries=()=>mock.queries.filter(q=>q.table===OUTBOX);
const updates=()=>outboxQueries().flatMap(q=>q.calls.filter(c=>c.method==='update').map(c=>c.args[0] as Record<string,unknown>));
const req=(authorization:string|null='Bearer worker-test-secret')=>new NextRequest('http://localhost/api/internal/session-invite-email',{
 method:'POST',headers:authorization===null?{}:{authorization},
});

beforeEach(()=>{
 vi.clearAllMocks();vi.useFakeTimers();vi.setSystemTime(NOW);
 vi.stubEnv('SESSION_INVITES_ENABLED','true');vi.stubEnv('SESSION_INVITES_EMAIL_ENABLED','true');vi.stubEnv('RESEND_API_KEY','test-only-not-a-real-key');vi.stubEnv('SESSION_INVITES_CRON_SECRET','worker-test-secret');
 mock.queries=[];
 mock.responses={
  [OUTBOX]:[job(),{error:null}],
  cm_session_preferences:[{data:{email_enabled:true},error:null}],
  cm_session_invites:[eligible()],
 };
 mock.from.mockImplementation((table:string)=>{
  const query={table,calls:[] as {method:string;args:unknown[]}[]};mock.queries.push(query);
  const builder:Record<string,unknown>={};
  for(const method of ['select','update','delete','eq','is','lte','lt','or','order','limit','maybeSingle']) builder[method]=(...args:unknown[])=>{query.calls.push({method,args});return builder;};
  builder.then=(resolve:(value:unknown)=>unknown,reject:(error:unknown)=>unknown)=>Promise.resolve(mock.responses[table]?.shift()??{data:null,error:null}).then(resolve,reject);
  return builder;
 });
 mock.admin.mockReturnValue({from:mock.from,auth:{admin:{getUserById:mock.getUserById}}});
 mock.getUserById.mockResolvedValue({data:{user:{email:'synthetic-rider@example.test'}},error:null});
 mock.send.mockResolvedValue({data:{id:'synthetic-provider-id'},error:null});
 mock.resend.mockImplementation(function(){return {emails:{send:mock.send}};});
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});

describe('session email worker eligibility and privacy',()=>{
 it.each(['SESSION_INVITES_ENABLED','SESSION_INVITES_EMAIL_ENABLED','RESEND_API_KEY'])('is disabled when %s is absent',async name=>{
  vi.stubEnv(name,undefined);expect(sessionEmailEnabled()).toBe(false);expect(await run()).toBe('disabled');expect(mock.admin).not.toHaveBeenCalled();expect(mock.send).not.toHaveBeenCalled();
 });
 it('does not send if another worker owns the claim or the job is unavailable',async()=>{
  mock.responses[OUTBOX]=[{data:null,error:null}];expect(await run()).toBe('skipped');expect(mock.send).not.toHaveBeenCalled();expect(mock.getUserById).not.toHaveBeenCalled();
  const calls=outboxQueries()[0].calls;
  expect(calls).toContainEqual({method:'is',args:['sent_at',null]});expect(calls).toContainEqual({method:'lt',args:['attempts',8]});expect(calls).toContainEqual({method:'lte',args:['next_attempt_at',NOW.toISOString()]});
  expect(calls).toContainEqual({method:'or',args:['locked_until.is.null,locked_until.lt.'+NOW.toISOString()]});expect(updates()[0]).toEqual({locked_until:'2026-09-25T12:02:00.000Z'});
 });
 it('fails before provider access when claiming fails',async()=>{
  mock.responses[OUTBOX]=[{data:null,error:{message:'synthetic DB error'}}];await expect(run()).rejects.toThrow('Impossibile acquisire');expect(mock.send).not.toHaveBeenCalled();
 });
 it.each([false,null])('skips an opted-out or missing preference %s and removes the job',async preference=>{
  mock.responses.cm_session_preferences=[{data:preference===null?null:{email_enabled:preference},error:null}];expect(await run()).toBe('skipped');expect(mock.send).not.toHaveBeenCalled();expect(mock.getUserById).not.toHaveBeenCalled();
  expect(outboxQueries()[1].calls).toContainEqual({method:'delete',args:[]});expect(outboxQueries()[1].calls).toContainEqual({method:'eq',args:['locked_until','2026-09-25T12:02:00.000Z']});
 });
 it.each(['accepted','declined','cancelled','blocked'])('does not email a %s invitation',async status=>{
  mock.responses.cm_session_invites=[eligible({status})];expect(await run()).toBe('skipped');expect(mock.send).not.toHaveBeenCalled();
 });
 it.each([{starts_at:NOW.toISOString()},{recipient_id:'different-recipient'},null])('skips expired, mismatched or deleted invitations %j',async patch=>{
  mock.responses.cm_session_invites=[patch===null?{data:null,error:null}:eligible(patch)];expect(await run()).toBe('skipped');expect(mock.send).not.toHaveBeenCalled();
 });
 it('retries an eligibility lookup failure without looking up recipient email',async()=>{
  mock.responses.cm_session_preferences=[{data:null,error:{message:'private DB detail'}}];expect(await run()).toBe('retry');expect(mock.getUserById).not.toHaveBeenCalled();expect(mock.send).not.toHaveBeenCalled();expect(updates().at(-1)?.last_error).not.toContain('private DB detail');
 });
});

describe('session email delivery, idempotency and acknowledgement',()=>{
 it('uses a stable provider key and acknowledges only the claimed lease after sending',async()=>{
  expect(await run()).toBe('sent');expect(mock.getUserById).toHaveBeenCalledWith(RECIPIENT);
  expect(mock.send).toHaveBeenCalledWith(expect.objectContaining({to:'synthetic-rider@example.test',subject:'Hai un invito a una session su Chrispy Maps'}),{idempotencyKey:'session-invite/'+INVITE});
  const payload=mock.send.mock.calls[0][0];expect(payload.text).toContain('https://example.test/messaggi?invite='+INVITE);expect(payload.text).toContain('disattivarli');expect(payload).not.toHaveProperty('html');
  expect(updates().at(-1)).toEqual({sent_at:NOW.toISOString(),locked_until:null,last_error:null,attempts:1});
  expect(outboxQueries().at(-1)?.calls).toContainEqual({method:'eq',args:['locked_until','2026-09-25T12:02:00.000Z']});
 });
 it('uses generic persisted errors and bounded exponential backoff on provider failure',async()=>{
  mock.responses[OUTBOX]=[job(7),{error:null}];mock.send.mockResolvedValue({data:null,error:{message:'synthetic-rider@example.test confidential provider detail'}});
  expect(await run()).toBe('retry');expect(updates().at(-1)).toEqual({attempts:8,locked_until:null,last_error:'Invio non completato, riprova pianificata.',next_attempt_at:'2026-09-25T13:00:00.000Z'});
  expect(updates().some(p=>'sent_at' in p)).toBe(false);
 });
 it('retries a missing recipient email without calling Resend',async()=>{
  mock.getUserById.mockResolvedValue({data:{user:null},error:null});expect(await run()).toBe('retry');expect(mock.send).not.toHaveBeenCalled();expect(updates().at(-1)?.next_attempt_at).toBe('2026-09-25T12:01:00.000Z');
 });
 it('retains the same provider idempotency key if successful delivery acknowledgement fails',async()=>{
  mock.responses[OUTBOX]=[job(),{error:{message:'ack unavailable'}},{error:null},job(1),{error:null}];
  mock.responses.cm_session_preferences.push({data:{email_enabled:true},error:null});mock.responses.cm_session_invites.push(eligible());
  expect(await run()).toBe('retry');expect(await run()).toBe('sent');expect(mock.send).toHaveBeenCalledTimes(2);
  expect(mock.send.mock.calls.map(call=>call[1])).toEqual([{idempotencyKey:'session-invite/'+INVITE},{idempotencyKey:'session-invite/'+INVITE}]);
  expect(updates().at(-1)?.attempts).toBe(2);
 });
});

describe('internal email route authorization',()=>{
 it.each([null,'Bearer wrong','Basic worker-test-secret','Bearer worker-test-secreu'])('rejects unauthorized worker token %s without DB or email access',async authorization=>{
  const response=await worker(req(authorization));expect(response.status).toBe(401);expect(response.headers.get('Cache-Control')).toBe('private, no-store');expect(response.headers.get('X-Robots-Tag')).toContain('noindex');expect(mock.admin).not.toHaveBeenCalled();expect(mock.send).not.toHaveBeenCalled();
 });
 it('rejects a same-character-length non-ASCII bearer safely without DB access',async()=>{
  const response=await worker(req('Bearer worker-test-secrét'));expect(response.status).toBe(401);expect(mock.admin).not.toHaveBeenCalled();
 });
 it('rejects every caller if the worker secret is unset',async()=>{
  vi.stubEnv('SESSION_INVITES_CRON_SECRET',undefined);expect((await worker(req())).status).toBe(401);expect(mock.admin).not.toHaveBeenCalled();
 });
 it('does not query the queue when the feature is disabled even with valid worker authorization',async()=>{
  vi.stubEnv('SESSION_INVITES_EMAIL_ENABLED',undefined);const response=await worker(req());expect(await response.json()).toEqual({ok:true,disabled:true});expect(mock.admin).not.toHaveBeenCalled();
 });
 it('returns a generic 503 if queue lookup fails',async()=>{
  mock.responses[OUTBOX]=[{data:null,error:{message:'internal database detail'}}];const response=await worker(req());expect(response.status).toBe(503);expect(await response.json()).toEqual({ok:false,error:'Coda non disponibile'});expect(mock.send).not.toHaveBeenCalled();
 });
 it('processes at most ten due jobs and exposes only aggregate outcomes',async()=>{
  mock.responses[OUTBOX]=[{data:[{invite_id:INVITE}],error:null},job(),{error:null}];const response=await worker(req());expect(await response.json()).toEqual({ok:true,processed:1,sent:1});expect(outboxQueries()[0].calls).toContainEqual({method:'limit',args:[10]});
 });
});
