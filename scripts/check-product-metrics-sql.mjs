// Ephemeral PostgreSQL verification. No connection to Supabase, no production writes.
// Pass the installed @electric-sql/pglite entry point as argv[2] if outside this repo.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.argv[2] || '@electric-sql/pglite');
const db = new PGlite();
let passed = 0;
const check = (condition, description) => { assert.ok(condition, description); passed++; console.log(`OK ${description}`); };
const denied = async sql => { try { await db.exec(sql); return false; } catch { return true; } };
try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  await db.exec(await readFile(new URL('../supabase/migrations/20260926_product_metrics.sql', import.meta.url), 'utf8'));
  check(true, 'Migration applies to an empty PostgreSQL database');
  const columns = (await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='cm_product_metrics_daily' ORDER BY ordinal_position")).rows.map(row => row.column_name);
  assert.deepEqual(columns, ['day', 'event', 'source', 'total']); check(true, 'Only daily aggregate columns; no visitor or raw event data');
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    check(await denied('SELECT * FROM public.cm_product_metrics_daily'), `${role} cannot read aggregate data`);
    check(await denied("SELECT public.cm_increment_product_metric('search_used','map')"), `${role} cannot call ingestion RPC`);
    check(await denied('SELECT public.cm_purge_product_metrics()'), `${role} cannot call purge RPC`);
    await db.exec('RESET ROLE');
  }
  await db.exec('SET ROLE service_role');
  await db.exec("SELECT public.cm_increment_product_metric('search_used','map'); SELECT public.cm_increment_product_metric('search_used','map');");
  const rows = (await db.query('SELECT * FROM public.cm_product_metrics_daily')).rows;
  check(rows.length === 1 && Number(rows[0].total) === 2, 'Repeated actions increment a single row atomically');
  check(await denied("SELECT public.cm_increment_product_metric('search_used','private-email')"), 'SQL rejects unapproved dimensions');
  check(await denied("SELECT public.cm_increment_product_metric('private-event','map')"), 'SQL rejects unapproved events');
  await db.exec("INSERT INTO public.cm_product_metrics_daily VALUES ((now() AT TIME ZONE 'UTC')::date - 90,'spot_view','detail',1), ((now() AT TIME ZONE 'UTC')::date - 89,'spot_view','detail',1)");
  await db.exec('SELECT public.cm_purge_product_metrics()');
  const retained = (await db.query("SELECT count(*) AS count FROM public.cm_product_metrics_daily WHERE event='spot_view'")).rows;
  check(Number(retained[0].count) === 1, 'Purge preserves day 89 and removes day 90');
  const rls = (await db.query("SELECT relrowsecurity FROM pg_class WHERE relname='cm_product_metrics_daily'")).rows;
  check(rls[0].relrowsecurity, 'RLS is enabled');
  console.log(`${passed} SQL checks passed. No remote database was used.`);
} finally { await db.close(); }
