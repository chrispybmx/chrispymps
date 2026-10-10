import { afterAll,beforeAll,expect,it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db=new PGlite();
beforeAll(async()=>{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 await db.exec(await readFile(new URL('../supabase/migrations/20261002170000_geocoding_slot.sql',import.meta.url),'utf8'));
},30000);
afterAll(async()=>{await db.close();});
it('admits one shared request until the server deadline and grants only the server role',async()=>{
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  await expect(db.query('select cm_claim_geocoding_slot()')).rejects.toThrow(/permission denied/);
  await expect(db.query('select * from cm_geocoding_slot')).rejects.toThrow(/permission denied/);
  await db.exec('reset role');
 }
 await db.exec('set role service_role');
 const claim=async()=>(await db.query<{claimed:boolean}>('select cm_claim_geocoding_slot() as claimed')).rows[0].claimed;
 expect(await claim()).toBe(true);expect(await claim()).toBe(false);
 await db.exec("reset role;update cm_geocoding_slot set available_at=clock_timestamp()-interval '1 second';set role service_role;");
 const results=await Promise.all(Array.from({length:8},claim));
 expect(results.filter(Boolean)).toHaveLength(1);
});
