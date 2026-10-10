// Disposable PostgreSQL only. Never reads env credentials or connects to Supabase.
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.argv[2] || '@electric-sql/pglite');
const db = new PGlite();
let passed = 0;
const check = (condition, label) => { assert.ok(condition, label); passed++; console.log(`OK ${label}`); };
const query = (sql, args = []) => db.query(sql, args);
const value = async (sql, args = []) => (await query(sql, args)).rows[0]?.value;
const rejects = async (sql, args, reason) => {
  try { await query(sql, args); return false; }
  catch (error) { return !reason || error.message.includes(reason); }
};
const a=randomUUID(), b=randomUUID(), outsider=randomUUID(), spot=randomUUID(), hidden=randomUUID();
const starts=new Date(Date.now()+86400000).toISOString();
const createSql='select cm_session_create_invite($1,$2,$3,$4,$5,$6,$7) as value';
const args=(actor=a,recipient='rider_b',place=spot,client=randomUUID())=>[actor,recipient,place,starts,'Europe/Rome','Giriamo?',client];
const action=(actor,id,type)=>query('select cm_session_action($1,$2,$3)',[actor,id,type]);
const send=(actor,id,body,client=randomUUID())=>value('select cm_session_send_message($1,$2,$3,$4) as value',[actor,id,body,client]);
const count=(table)=>value(`select count(*)::int as value from ${table}`);
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),username text,avatar_url text);
    CREATE TYPE public.spot_status AS ENUM ('pending','approved','rejected','deleted');
    CREATE TABLE public.spots(id uuid PRIMARY KEY,name text,slug text,city text,status public.spot_status);
  `);
  await query('insert into auth.users values ($1),($2),($3)',[a,b,outsider]);
  await query("insert into profiles(id,username) values ($1,'rider_a'),($2,'rider_b'),($3,'outsider')",[a,b,outsider]);
  await query("insert into spots values ($1,'Test spot','test-spot','Test city','approved'),($2,'Hidden spot','hidden-spot','Test city','pending')",[spot,hidden]);
  await db.exec(await readFile(new URL('../supabase/migrations/20260925_private_session_invites.sql',import.meta.url),'utf8'));
  check(true,'Session migration applies on isolated prerequisite schema');
  const firstArgs=args();
  for(const role of ['anon','authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    check(await rejects(createSql,firstArgs,'permission denied'),`${role} cannot impersonate an actor through RPC`);
    check(await rejects('select * from cm_session_email_outbox',[],'permission denied'),`${role} cannot read email jobs`);
    check(await rejects('select * from cm_session_reports',[],'permission denied'),`${role} cannot read report evidence`);
    check(await rejects("insert into cm_session_preferences values ($1,true)",[a],'permission denied'),`${role} cannot bypass server preference writes`);
    await db.exec('RESET ROLE');
  }
  await db.exec('SET ROLE service_role');
  const first=await value(createSql,firstArgs);
  check(first.created===true,'Invitation created');
  check(await count('cm_session_email_outbox')===0,'No notification email without recipient opt-in');
  const duplicate=await value(createSql,firstArgs);
  check(!duplicate.created&&duplicate.id===first.id,'Retry returns the original invitation');
  check(await rejects(createSql,[...firstArgs.slice(0,5),'Changed note',firstArgs[6]],'IDEMPOTENCY_CONFLICT'),'Idempotency key cannot change invitation content');
  check(await rejects(createSql,args(),'INVITE_EXISTS'),'Duplicate pending invitation rejected');
  check(await rejects(createSql,args(a,'rider_a'),'SELF_INVITE'),'Self-invitation rejected');
  check(await rejects(createSql,args(a,'rider_b',hidden),'SPOT_UNAVAILABLE'),'Unapproved spot rejected');
  check(await rejects('select cm_session_send_message($1,$2,$3,$4)',[a,first.id,'Too early',randomUUID()],'NOT_ACCEPTED'),'Chat closed before acceptance');
  check(await rejects('select cm_session_thread($1,$2)',[outsider,first.id],'NOT_FOUND'),'Other rider cannot open private thread');
  check(await rejects('select cm_session_action($1,$2,$3)',[a,first.id,'accept'],'FORBIDDEN'),'Sender cannot accept their own invitation');
  await action(b,first.id,'accept'); await action(b,first.id,'accept');
  check(await value('select status as value from cm_session_invites where id=$1',[first.id])==='accepted','Recipient acceptance is idempotent');
  const messageKey=randomUUID(); const message=await send(a,first.id,'Ci vediamo allo spot',messageKey);
  const retry=await send(a,first.id,'Ci vediamo allo spot',messageKey);
  check(message.id===retry.id&&await count('cm_session_messages')===1,'Message retry never duplicates the message');
  check(await rejects('select cm_session_send_message($1,$2,$3,$4)',[a,first.id,'Different text',messageKey],'IDEMPOTENCY_CONFLICT'),'Message retry cannot replace its content');
  const thread=await value('select cm_session_thread($1,$2) as value',[b,first.id]);
  check(thread.messages.length===1&&thread.invite.unread,'Recipient sees accepted chat and unread status');
  await query('select cm_session_action($1,$2,$3,null,$4)',[b,first.id,'read','2000-01-01T00:00:00Z']);
  check(await value('select recipient_unread as value from cm_session_invites where id=$1',[first.id]),'Stale read acknowledgement preserves unread messages');
  const updated=await value('select updated_at::text as value from cm_session_invites where id=$1',[first.id]);
  await query('select cm_session_action($1,$2,$3,null,$4)',[b,first.id,'read',updated]);
  check(!await value('select recipient_unread as value from cm_session_invites where id=$1',[first.id]),'Current read acknowledgement clears the badge');
  await db.exec('RESET ROLE; SET ROLE authenticated');
  await query("select set_config('request.jwt.claim.sub',$1,false)",[outsider]);
  check(await count('cm_session_invites')===0&&await count('cm_session_messages')===0,'RLS hides invitation and messages from unrelated rider');
  await query("select set_config('request.jwt.claim.sub',$1,false)",[b]);
  check(await count('cm_session_invites')===1&&await count('cm_session_messages')===1,'RLS permits recipient to read accepted conversation');
  await db.exec('RESET ROLE; SET ROLE service_role');
  await query('select cm_session_action($1,$2,$3,$4)',[b,first.id,'report','Test report']);
  check(await count('cm_session_reports')===1,'Report evidence is stored for moderation');
  await action(b,first.id,'block');
  check(await rejects('select cm_session_send_message($1,$2,$3,$4)',[a,first.id,'After block',randomUUID()],'BLOCKED'),'Blocking stops new messages');
  check(await rejects(createSql,args(),'BLOCKED'),'Blocking prevents new invitations');
  await query('select cm_session_unblock_user($1,$2)',[b,a]);
  check(await value('select status as value from cm_session_invites where id=$1',[first.id])==='blocked','Unblocking never reopens the old chat');
  await query('select cm_session_set_preference($1,true)',[b]);
  const second=await value(createSql,args());
  check(await count('cm_session_email_outbox')===1,'Explicit email opt-in creates a durable job');
  const claim="update cm_session_email_outbox set locked_until=now()+interval '2 minutes' where invite_id=$1 and (locked_until is null or locked_until<now()) returning invite_id";
  check((await query(claim,[second.id])).rows.length===1,'Worker acquires available lease');
  check((await query(claim,[second.id])).rows.length===0,'Another worker cannot acquire an active lease');
  await query('select cm_session_set_preference($1,false)',[b]);
  check(await count('cm_session_email_outbox')===0,'Opt-out removes queued emails');
  await action(a,second.id,'cancel');
  await query('select cm_session_set_preference($1,true)',[b]);
  const third=await value(createSql,args());
  await action(b,third.id,'decline');
  check(await count('cm_session_email_outbox')===0,'Declining removes the pending notification');
  const expired=await value(createSql,args());
  await query("update cm_session_invites set starts_at=now()-interval '1 minute' where id=$1",[expired.id]);
  check(await rejects('select cm_session_action($1,$2,$3)',[b,expired.id,'accept'],'EXPIRED'),'Expired invitations cannot be accepted');
  for(let n=0;n<5;n++){const item=await value(createSql,args(outsider));await action(outsider,item.id,'cancel');}
  check(await rejects(createSql,args(outsider),'RATE_LIMIT'),'Hourly invitation cap survives cancellation');
  const rls=(await query("select relrowsecurity from pg_class where relname like 'cm_session_%' and relkind='r'")).rows;
  check(rls.length===6&&rls.every(row=>row.relrowsecurity),'All six private tables enforce RLS');
  console.log(`${passed} session SQL checks passed; no remote database or email used.`);
} finally { await db.close(); }
