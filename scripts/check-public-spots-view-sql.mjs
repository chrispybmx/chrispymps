// Synthetic database only. Never reads credentials or contacts production.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.argv[2] || '@electric-sql/pglite');
const db = new PGlite();
let passed = 0;
const check = (value, message) => { assert.ok(value, message); passed++; console.log(`OK ${message}`); };
const denied = async sql => {
  try { await db.exec(sql); return false; } catch (error) { return error.code === '42501'; }
};
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.spots (id int PRIMARY KEY, name text, status text);
    INSERT INTO public.spots VALUES (1,'Approved','approved'),(2,'Pending','pending');
    ALTER TABLE public.spots ENABLE ROW LEVEL SECURITY;
    CREATE POLICY approved ON public.spots FOR SELECT TO anon, authenticated USING (status='approved');
    GRANT SELECT ON public.spots TO anon, authenticated, service_role;
    CREATE VIEW public.public_spots_geojson AS SELECT id,name FROM public.spots WHERE status='approved';
    GRANT ALL ON public.public_spots_geojson TO PUBLIC, anon, authenticated, service_role;
  `);
  const migration = await readFile(new URL('../supabase/migrations/20260926153000_public_spots_read_only.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await db.exec(migration);
  check(true, 'Migration can be reapplied safely');
  for (const role of ['anon','authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    assert.deepEqual((await db.query('SELECT * FROM public.public_spots_geojson')).rows, [{id:1,name:'Approved'}]);
    check(true, `${role} reads approved spots only`);
    for (const sql of [
      "INSERT INTO public.public_spots_geojson VALUES (3,'Injected')",
      "UPDATE public.public_spots_geojson SET name='Changed' WHERE id=1",
      'DELETE FROM public.public_spots_geojson WHERE id=1',
    ]) check(await denied(sql), `${role} is denied ${sql.split(' ')[0]} through the view`);
    await db.exec('RESET ROLE');
  }
  await db.exec("ALTER POLICY approved ON public.spots USING (false); SET ROLE anon;");
  check((await db.query('SELECT * FROM public.public_spots_geojson')).rows.length === 0, 'View respects underlying RLS instead of owner privileges');
  await db.exec('RESET ROLE; SET ROLE service_role');
  check((await db.query('SELECT * FROM public.public_spots_geojson')).rows.length === 1, 'Service role keeps existing read access');
  await db.exec('RESET ROLE');
  assert.deepEqual((await db.query('SELECT * FROM public.spots ORDER BY id')).rows,
    [{id:1,name:'Approved',status:'approved'},{id:2,name:'Pending',status:'pending'}]);
  check(true, 'Data and pending spots are preserved');
  console.log(`${passed} SQL checks passed. No remote database was used.`);
} finally { await db.close(); }
