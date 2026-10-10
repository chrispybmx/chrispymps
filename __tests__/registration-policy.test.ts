import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { registrationDetails, registrationAge, validBirthDate, COUNTRY_CODES } from '@/lib/registration';

const now = new Date('2026-10-10T23:30:00Z');
const details = { birthDate: '2000-02-29', countryCode: 'IT', disciplines: ['bmx', 'mtb'] };
describe('registration validation', () => {
  it.each(['2025-02-29','2000-02-30','2026-10-11','1920-01-01','12/01/2000','2000-1-01',''])('rejects invalid date %s', value => expect(validBirthDate(value,now)).toBe(false));
  it('uses the UTC birthday boundary', () => { expect(registrationAge('2012-10-10',now)).toBe(14); expect(registrationAge('2012-10-11',now)).toBe(13); });
  it('accepts multiple sports and removes duplicates', () => expect(registrationDetails(now).parse({...details,disciplines:['bmx','bmx','mtb']}).disciplines).toEqual(['bmx','mtb']));
  it('does not require sports or region', () => expect(registrationDetails(now).parse({birthDate:'2000-01-01',countryCode:'US'})).toMatchObject({disciplines:[],region:''}));
  it.each([{birthDate:'2013-01-01'},{countryCode:'XX'},{countryCode:''},{disciplines:['tracking']},{marketing:true}])('rejects invalid input %j', patch => expect(registrationDetails(now).safeParse({...details,...patch}).success).toBe(false));
});

const db = new PGlite();
const event = (patch: Record<string,unknown> = {}, provider = 'email') => ({user:{app_metadata:{provider},user_metadata:{initial_rider_details:{...details,...patch}}}});
async function hook(value: unknown) {
  const result = await db.query<{result:{error?:{http_code:number}}}>('select public.cm_before_user_created($1::jsonb) as result',[JSON.stringify(value)]);
  return result.rows[0].result;
}
beforeAll(async () => {
  await db.exec("create role anon; create role authenticated; create role supabase_auth_admin; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
  await db.exec(readFileSync('supabase/migrations/20260821_rider_profile_fields.sql','utf8'));
  await db.exec('grant select,insert,update on rider_details to anon,authenticated; grant select on rider_stats_aggregate to anon,authenticated;');
  await db.exec(readFileSync('supabase/migrations/20261010120000_registration_policy.sql','utf8'));
},30000);
afterAll(() => db.close());
describe('Before User Created SQL hook', () => {
  it('accepts eligible declarations without creating or storing an account', async () => { expect(await hook(event())).toEqual({}); expect((await db.query('select * from rider_details')).rows).toHaveLength(0); });
  it.each([{birthDate:'2020-01-01'},{birthDate:'2000-02-30'},{birthDate:null},{countryCode:'XX'},{countryCode:null},{disciplines:['gps']},{disciplines:'bmx'},{disciplines:[null]}])('rejects bypass payload %j', async patch => expect((await hook(event(patch))).error?.http_code).toBe(422));
  it('rejects missing metadata and OAuth creation without the signup flow', async () => { expect((await hook({user:{app_metadata:{provider:'email'}}})).error?.http_code).toBe(422); expect((await hook(event({},'google'))).error?.http_code).toBe(403); });
  it('matches every country in the client validator', async () => { for(const countryCode of COUNTRY_CODES) expect(await hook(event({countryCode}))).toEqual({}); });
  it('allows Auth but not public clients to execute the hook', async () => {
    const {rows}=await db.query<{auth:boolean;anon:boolean;member:boolean}>("select has_function_privilege('supabase_auth_admin','public.cm_before_user_created(jsonb)','EXECUTE') as auth, has_function_privilege('anon','public.cm_before_user_created(jsonb)','EXECUTE') as anon, has_function_privilege('authenticated','public.cm_before_user_created(jsonb)','EXECUTE') as member");
    expect(rows[0]).toEqual({auth:true,anon:false,member:false});
  });
  it('allows MTB and keeps legacy rows valid', async () => { await db.exec("insert into auth.users values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'); insert into rider_details(user_id,disciplines,country_code) values('00000000-0000-4000-8000-000000000001',array['mtb','bmx'],'IT'),('00000000-0000-4000-8000-000000000002',null,null)"); });
  it('preserves owner-only reads and rejects cross-user writes at database level', async () => {
    await db.exec("set role authenticated; set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001'");
    try {
      const {rows}=await db.query<{user_id:string}>('select user_id from rider_details');
      expect(rows.map(row=>row.user_id)).toEqual(['00000000-0000-4000-8000-000000000001']);
      expect((await db.query("update rider_details set country_code='US' where user_id='00000000-0000-4000-8000-000000000002' returning user_id")).rows).toHaveLength(0);
      await expect(db.query('select * from rider_stats_aggregate')).rejects.toThrow(/permission denied/);
    } finally { await db.exec('reset role; reset request.jwt.claim.sub'); }
  });
  it('hides rows and the legacy aggregate report from anonymous visitors', async () => {
    await db.exec('set role anon');
    try { expect((await db.query('select * from rider_details')).rows).toHaveLength(0); await expect(db.query('select * from rider_stats_aggregate')).rejects.toThrow(/permission denied/); }
    finally { await db.exec('reset role'); }
  });
});
