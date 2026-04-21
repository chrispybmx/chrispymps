/**
 * ChrispyMPS — Genera QR sticker per spot fisici
 *
 * Uso: npx tsx scripts/generate-qr.ts [--city=verona] [--all]
 *
 * Output: /tmp/qr-stickers/ — HTML stampabile + PNG per ogni spot
 *
 * Richiede: npm install qrcode @types/qrcode
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const args  = process.argv.slice(2);
const city  = args.find((a) => a.startsWith('--city='))?.split('=')[1];
const all   = args.includes('--all');

if (!city && !all) {
  console.error('Usa: npx tsx scripts/generate-qr.ts --city=verona  oppure  --all');
  process.exit(1);
}

const BASE_URL  = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://chrispybmx.com';
const OUT_DIR   = path.join(process.cwd(), 'tmp', 'qr-stickers');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  let query = supabase.from('spots').select('id, slug, name, city, type').eq('status', 'approved');
  if (city) query = query.eq('city', city);

  const { data: spots, error } = await query.order('city').order('name');
  if (error) { console.error('DB error:', error.message); process.exit(1); }
  if (!spots?.length) { console.log('Nessuno spot trovato.'); return; }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Prova a importare qrcode
  let QRCode: typeof import('qrcode') | null = null;
  try {
    QRCode = await import('qrcode');
  } catch {
    console.warn('⚠ Libreria "qrcode" non installata. Installa con: npm install qrcode');
    console.warn('  Genero solo il file HTML con URL placeholder.\n');
  }

  // Genera sticker HTML stampabile (pagina A4 con griglia 3x3)
  const stickersHtml: string[] = [];

  for (const spot of spots) {
    const url = `${BASE_URL}/map/spot/${spot.slug}`;
    let qrDataUrl = '';

    if (QRCode) {
      try {
        qrDataUrl = await QRCode.toDataURL(url, {
          width: 300,
          margin: 1,
          color: { dark: '#0a0a0a', light: '#f3ead8' },
        });
        // Salva PNG singolo
        const pngPath = path.join(OUT_DIR, `${spot.slug}.png`);
        await QRCode.toFile(pngPath, url, { width: 400, margin: 1 });
      } catch (err) {
        console.warn(`⚠ QR error per ${spot.name}:`, err);
      }
    }

    stickersHtml.push(`
      <div class="sticker">
        <div class="logo">🏴 CHRISPYMPS</div>
        ${qrDataUrl
          ? `<img src="${qrDataUrl}" alt="QR ${spot.name}" width="150" height="150">`
          : `<div class="qr-placeholder">${url}</div>`
        }
        <div class="spot-name">${spot.name}</div>
        ${spot.city ? `<div class="spot-city">${spot.city.toUpperCase()}</div>` : ''}
        <div class="url">${BASE_URL}/map</div>
      </div>
    `);

    console.log(`✅ ${spot.name} (${spot.city ?? '—'})`);
  }

  // Pagina HTML stampabile
  const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>QR Stickers ChrispyMPS</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; background: #fff; }
  @page { size: A4; margin: 10mm; }
  .page { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; padding: 8mm; }
  .sticker {
    border: 2px solid #0a0a0a;
    border-radius: 4px;
    padding: 8px;
    text-align: center;
    aspect-ratio: 1;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 4px;
    background: #f3ead8;
  }
  .logo { font-size: 11px; font-weight: bold; color: #ff6a00; letter-spacing: 0.1em; }
  .spot-name { font-size: 13px; font-weight: bold; color: #0a0a0a; }
  .spot-city { font-size: 10px; color: #888; letter-spacing: 0.08em; }
  .url { font-size: 8px; color: #888; }
  .qr-placeholder { font-size: 8px; color: #888; word-break: break-all; max-width: 100%; }
  img { border-radius: 2px; }
</style>
</head>
<body>
<div class="page">
  ${stickersHtml.join('')}
</div>
</body>
</html>`;

  const htmlPath = path.join(OUT_DIR, `stickers-${city ?? 'all'}.html`);
  fs.writeFileSync(htmlPath, html, 'utf-8');

  console.log(`\n📁 Output: ${OUT_DIR}`);
  console.log(`📄 HTML stampabile: ${htmlPath}`);
  console.log(`\nApri il file HTML in Chrome → Stampa → Salva come PDF o stampa direttamente.`);
}

main().catch((err) => {
  console.error('❌ Errore:', err);
  process.exit(1);
});
