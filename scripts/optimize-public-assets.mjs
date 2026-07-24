// One-shot: ricomprime in-place i JPEG statici in public/ (resize 1600 + q82).
// Mantiene nome/estensione -> nessun riferimento da aggiornare. Serviti da Vercel,
// non toccano la quota Supabase: pura velocità di caricamento pagine.
// Uso: node scripts/optimize-public-assets.mjs [--apply]
import sharp from 'sharp';
import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, extname } from 'path';

const ROOT = 'public';
const MIN = 200 * 1024; // solo file > 200KB
const APPLY = process.argv.includes('--apply');
const kb = (n) => `${(n / 1024).toFixed(0)}KB`;

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(ROOT).filter((f) => /\.jpe?g$/i.test(f) && statSync(f).size > MIN);
console.log(`${files.length} JPEG > 200KB. Modalità: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
let done = 0, skip = 0, origTot = 0, newTot = 0;

for (const f of files) {
  const orig = readFileSync(f);
  const optimized = await sharp(orig).rotate()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  if (optimized.length >= orig.length) { skip++; continue; }
  origTot += orig.length; newTot += optimized.length;
  if (APPLY) writeFileSync(f, optimized);
  done++;
  console.log(`${APPLY ? '✓' : 'would'} ${f}: ${kb(orig.length)} -> ${kb(optimized.length)}`);
}
console.log(`\n--- ${done} ottimizzati, ${skip} saltati`);
if (origTot > 0) console.log(`--- ${kb(origTot)} -> ${kb(newTot)} (${((1 - newTot / origTot) * 100).toFixed(0)}% risparmio)`);
