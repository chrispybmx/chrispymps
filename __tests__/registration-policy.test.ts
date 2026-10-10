import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { registrationDetails, registrationAge, validBirthDate } from '@/lib/registration';

const now = new Date('2026-10-10T23:30:00Z');
const details = { birthDate: '2000-02-29', countryCode: 'IT', disciplines: ['bmx', 'mtb'] };
describe('registration validation', () => {
  it.each(['2025-02-29','2000-02-30','2026-10-11','1920-01-01','12/01/2000','2000-1-01',''])('rejects invalid date %s', value => expect(validBirthDate(value,now)).toBe(false));
  it('uses the UTC birthday boundary', () => { expect(registrationAge('2012-10-10',now)).toBe(14); expect(registrationAge('2012-10-11',now)).toBe(13); });
  it('accepts multiple sports and removes duplicates', () => expect(registrationDetails(now).parse({...details,disciplines:['bmx','bmx','mtb']}).disciplines).toEqual(['bmx','mtb']));
  it('requires nothing: no birth date, country, sports or region', () => expect(registrationDetails(now).parse({})).toMatchObject({disciplines:[],region:''}));
  it('treats an empty country as not given', () => expect(registrationDetails(now).parse({countryCode:''}).countryCode).toBeUndefined());
  it.each([{birthDate:'2013-01-01'},{birthDate:'2000-02-30'},{countryCode:'XX'},{disciplines:['tracking']},{marketing:true}])('rejects invalid input %j', patch => expect(registrationDetails(now).safeParse({...details,...patch}).success).toBe(false));
});

const ROLES = "create role anon; create role authenticated; create role supabase_auth_admin; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;";
const PROFILE_FIELDS = readFileSync('supabase/migrations/20260821_rider_profile_fields.sql','utf8');
const MIGRATION = readFileSync('supabase/migrations/20261010120000_registration_policy.sql','utf8');

describe('registration migration, schema with the legacy aggregate view', () => {
  const db = new PGlite();
  beforeAll(async () => {
    await db.exec(ROLES);
    await db.exec(PROFILE_FIELDS);
    await db.exec('grant select,insert,update on rider_details to anon,authenticated; grant select on rider_stats_aggregate to anon,authenticated;');
    await db.exec(MIGRATION);
  },30000);
  afterAll(() => db.close());
  it('does not install a Before User Created hook (signup stays immediate, Google included)', async () => {
    expect((await db.query("select 1 from pg_proc where proname='cm_before_user_created'")).rows).toHaveLength(0);
  });
  it('allows MTB and keeps legacy rows valid', async () => { await db.exec("insert into auth.users values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'); insert into rider_details(user_id,disciplines,country_code) values('00000000-0000-4000-8000-000000000001',array['mtb','bmx'],'IT'),('00000000-0000-4000-8000-000000000002',null,null)"); });
  it('rejects an invalid country code at database level', async () => {
    await expect(db.exec("insert into auth.users values('00000000-0000-4000-8000-000000000003'); insert into rider_details(user_id,country_code) values('00000000-0000-4000-8000-000000000003','italia')")).rejects.toThrow(/country_code_check/);
  });
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
  it('can be applied twice without errors', async () => { await expect(db.exec(MIGRATION)).resolves.not.toThrow(); });
});

describe('registration migration, production schema without the aggregate view', () => {
  const db = new PGlite();
  beforeAll(async () => {
    await db.exec(ROLES);
    await db.exec(PROFILE_FIELDS);
    await db.exec('drop view rider_stats_aggregate;');
  },30000);
  afterAll(() => db.close());
  it('applies cleanly and adds the private country column', async () => {
    await db.exec(MIGRATION);
    const {rows}=await db.query("select 1 from information_schema.columns where table_name='rider_details' and column_name='country_code'");
    expect(rows).toHaveLength(1);
  });
});
