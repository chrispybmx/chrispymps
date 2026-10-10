import type { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PREVIEW_ACTOR,PREVIEW_SPOT } from './rider-preview';
import { previewSpots } from './preview-spots';

export function localSessionPreview(host:string|null) {
 return process.env.NODE_ENV==='development'&&process.env.RIDER_SESSIONS_PREVIEW==='true'
  && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host||'');
}
const globalDB=globalThis as typeof globalThis & {crockSessionPreview?:Promise<PGlite>};
export function previewDatabase() {
 if(!globalDB.crockSessionPreview)globalDB.crockSessionPreview=(async()=>{
  // In-memory PostgreSQL, survives page reloads, resets only on server restart.
  // Loaded on demand: layout and public routes import this module in production too.
  const { PGlite }=await import('@electric-sql/pglite');
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create table auth.users(id uuid primary key);
   create table spots(id uuid primary key,name text,slug text,status text);create table sessions(id uuid);
   create table cm_session_blocks(blocker_id uuid,blocked_id uuid);
   create function cm_session_is_blocked(a uuid,b uuid) returns boolean language sql as $$select exists(select 1 from cm_session_blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a))$$;`);
  await db.query('insert into auth.users values($1)',[PREVIEW_ACTOR]);
  await db.query("insert into spots values($1,'Spot demo Barcellona','demo-barcellona','approved')",[PREVIEW_SPOT]);
  // Public spot identities only; all session records remain in this local database.
  try {
   for(const spot of await previewSpots(true))await db.query("insert into spots values($1,$2,$3,'approved') on conflict(id) do nothing",[spot.id,spot.name,spot.slug]);
  }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  await db.exec('alter table spots add column submitted_by_user_id uuid, add column lat double precision, add column lon double precision');
  await db.exec(await readFile(path.join(process.cwd(),'supabase/migrations/20261002_rider_sessions.sql'),'utf8'));
  await db.exec(await readFile(path.join(process.cwd(),'supabase/migrations/20261002190000_rider_profile_stats.sql'),'utf8'));
  await db.exec(await readFile(path.join(process.cwd(),'supabase/migrations/20261003120000_rider_live_map.sql'),'utf8'));
  // Authorization exists only for this explicitly synthetic local fixture.
  await db.query("insert into cm_rider_pilot(user_id,authorization_note) values($1,'Synthetic local preview fixture; not age verification')",[PREVIEW_ACTOR]);
  await db.exec('update cm_rider_settings set sharing_enabled=true');
  return db;
 })();
 return globalDB.crockSessionPreview;
}
