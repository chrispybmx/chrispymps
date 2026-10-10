import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PUBLIC_SPOT_COLUMNS } from '@/lib/public-spot';
it('blocks direct content writes while preserving API writes and public safe reads', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA storage; CREATE TABLE storage.objects(id text);
      CREATE TABLE public.spots (${PUBLIC_SPOT_COLUMNS.split(',').map(c => `${c} text`).join(',')}, reviewer_notes text, submitted_by text);
      CREATE TABLE contributors(id text); CREATE TABLE flags(id text);
      CREATE TABLE spot_photos(id text); CREATE TABLE spot_status_updates(id text);
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
      INSERT INTO spots(id,name,reviewer_notes) VALUES ('existing','Park','private');`);
    await db.exec(readFileSync('supabase/migrations/20261009_server_only_content_writes.sql', 'utf8'));
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      for (const table of ['contributors', 'flags', 'spots', 'spot_photos', 'spot_status_updates']) {
        await expect(db.exec(`INSERT INTO ${table}(id) VALUES ('blocked')`)).rejects.toThrow(/permission denied/);
        await expect(db.exec(`DELETE FROM ${table}`)).rejects.toThrow(/permission denied/);
      }
      await db.exec('RESET ROLE');
    }
    await db.exec('SET ROLE service_role');
    await db.exec("INSERT INTO spots(id,name) VALUES ('new','New park'); UPDATE spots SET name='Kept' WHERE id='existing'; DELETE FROM spots WHERE id='new'");
    await db.exec('RESET ROLE');
    await db.exec(readFileSync('supabase/migrations/20261010_public_spot_columns.sql', 'utf8'));
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      expect((await db.query('SELECT id,name FROM spots')).rows).toEqual([{ id: 'existing', name: 'Kept' }]);
      await expect(db.query('SELECT reviewer_notes FROM spots')).rejects.toThrow(/permission denied/);
      await expect(db.query('SELECT submitted_by FROM spots')).rejects.toThrow(/permission denied/);
      await db.exec('RESET ROLE');
    }
  } finally { await db.close(); }
}, 20000);
