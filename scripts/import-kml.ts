/**
 * ChrispyMPS — Import Google My Maps KML → Supabase
 *
 * Uso: npm run seed -- --file=./mymaps.kml [--dry-run]
 *
 * Come ottenere il KML da Google My Maps:
 * 1. Apri la tua mappa su Google My Maps
 * 2. Menu ⋮ → Esporta in KML/KMZ
 * 3. Seleziona "Esporta come KML" (non KMZ)
 * 4. Salva il file e passalo con --file=
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseStringPromise } from 'xml2js';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const args = process.argv.slice(2);
const filePath = args.find((a) => a.startsWith('--file='))?.split('=')[1];
const dryRun   = args.includes('--dry-run');

if (!filePath) {
  console.error('❌ Usa: npm run seed -- --file=./mymaps.kml [--dry-run]');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Mappa nomi comuni di tipo spot dal KML al tipo enum
function detectType(name: string, description: string): string {
  const text = (name + ' ' + description).toLowerCase();
  if (text.includes('park'))  return 'park';
  if (text.includes('bowl'))  return 'bowl';
  if (text.includes('trail')) return 'trail';
  if (text.includes('rail'))  return 'rail';
  if (text.includes('ledge')) return 'ledge';
  if (text.includes('gap'))   return 'gap';
  if (text.includes('plaza') || text.includes('piazza')) return 'plaza';
  if (text.includes('diy'))   return 'diy';
  return 'street'; // default
}

function detectCity(name: string, description: string, coords: string): string | undefined {
  const text = (name + ' ' + description).toLowerCase();
  const cities = ['verona','milano','roma','torino','bologna','firenze','napoli','venezia','padova'];
  for (const c of cities) {
    if (text.includes(c)) return c;
  }
  return undefined;
}

async function main() {
  const kmlContent = fs.readFileSync(path.resolve(filePath!), 'utf-8');
  const parsed = await parseStringPromise(kmlContent);

  const placemarks: unknown[] = [];
  function collectPlacemarks(obj: unknown) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.forEach(collectPlacemarks); return; }
    const o = obj as Record<string, unknown>;
    if ('Placemark' in o) (o['Placemark'] as unknown[]).forEach((p) => placemarks.push(p));
    Object.values(o).forEach(collectPlacemarks);
  }
  collectPlacemarks(parsed);

  console.log(`📍 Trovati ${placemarks.length} placemark nel KML\n`);

  let imported = 0, skipped = 0;

  for (const pm of placemarks) {
    const p = pm as Record<string, unknown[]>;
    const name = (p['name']?.[0] as string) ?? 'Spot senza nome';
    const description = (p['description']?.[0] as string) ?? '';
    const pointCoords = (p['Point']?.[0] as Record<string, unknown[]>)?.['coordinates']?.[0] as string | undefined;

    if (!pointCoords) {
      console.warn(`⚠ Skip (no coords): ${name}`);
      skipped++;
      continue;
    }

    // KML coords: lon,lat[,alt]
    const parts = pointCoords.trim().split(',');
    const lon   = parseFloat(parts[0]);
    const lat   = parseFloat(parts[1]);

    if (isNaN(lat) || isNaN(lon)) {
      console.warn(`⚠ Skip (coords non valide): ${name}`);
      skipped++;
      continue;
    }

    const type = detectType(name, description);
    const city = detectCity(name, description, pointCoords);

    const spotData = {
      name,
      type,
      lat,
      lon,
      city:        city ?? null,
      description: description.replace(/<[^>]*>/g, '').trim() || null,
      condition:   'alive',
      status:      'approved', // gli spot importati sono già verificati
    };

    console.log(`${dryRun ? '[DRY]' : '✅'} ${name} → ${type} @ ${lat.toFixed(4)},${lon.toFixed(4)}${city ? ` (${city})` : ''}`);

    if (!dryRun) {
      const { error } = await supabase.from('spots').insert(spotData);
      if (error) {
        console.error(`  ❌ DB error: ${error.message}`);
        skipped++;
        continue;
      }
    }
    imported++;
  }

  console.log(`\n📊 Risultato: ${imported} importati, ${skipped} saltati.`);
  if (dryRun) console.log('(Dry run — nessun dato scritto nel DB)');
}

main().catch((err) => {
  console.error('❌ Errore fatale:', err);
  process.exit(1);
});
