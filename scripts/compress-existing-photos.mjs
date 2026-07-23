// One-shot: comprime le foto già in storage (resize 1600 + JPEG q85), in-place.
// Sovrascrive lo stesso path (upsert) -> gli URL in spot_photos NON cambiano.
// Salta le foto già leggere e non sovrascrive se la compressione non migliora.
// Uso: SUPABASE_URL=.. SERVICE_KEY=.. node scripts/compress-existing-photos.mjs [LIMIT] [--apply]
import sharp from 'sharp';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SERVICE_KEY;
const LIMIT = process.argv[2] && !process.argv[2].startsWith('--') ? parseInt(process.argv[2]) : 100000;
const APPLY = process.argv.includes('--apply');
const BUCKET = 'spot-photos';
const SKIP_UNDER = 400 * 1024; // foto già <400KB: già ottimizzate, skip

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const kb = (n) => `${(n / 1024).toFixed(0)}KB`;

async function listPhotos() {
  const res = await fetch(`${URL}/rest/v1/spot_photos?select=id,url&order=created_at.asc`, { headers: H });
  return res.json();
}

function pathFromUrl(url) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

async function run() {
  const photos = await listPhotos();
  console.log(`${photos.length} foto totali. Modalità: ${APPLY ? 'APPLY (sovrascrive)' : 'DRY-RUN'}. Limite: ${LIMIT}`);
  let done = 0, skipped = 0, failed = 0, origTot = 0, newTot = 0;

  for (const p of photos.slice(0, LIMIT)) {
    const path = pathFromUrl(p.url);
    if (!path) { console.log(`skip (url non storage): ${p.url}`); skipped++; continue; }
    try {
      const orig = Buffer.from(await (await fetch(p.url)).arrayBuffer());
      if (orig.length < SKIP_UNDER) { skipped++; continue; }

      const optimized = await sharp(orig).rotate()
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true }).toBuffer();

      if (optimized.length >= orig.length) { skipped++; continue; }
      origTot += orig.length; newTot += optimized.length;

      if (APPLY) {
        const up = await fetch(`${URL}/storage/v1/object/${BUCKET}/${path}`, {
          method: 'PUT',
          headers: { ...H, 'Content-Type': 'image/jpeg', 'x-upsert': 'true', 'cache-control': '3600' },
          body: optimized,
        });
        if (!up.ok) { console.log(`FAIL upload ${path}: ${up.status} ${await up.text()}`); failed++; continue; }
      }
      done++;
      console.log(`${APPLY ? '✓' : 'would'} ${path}: ${kb(orig.length)} -> ${kb(optimized.length)}`);
    } catch (e) {
      console.log(`FAIL ${path}: ${e.message}`); failed++;
    }
  }
  console.log(`\n--- ${done} compresse, ${skipped} saltate, ${failed} errori`);
  if (origTot > 0) console.log(`--- totale toccato: ${kb(origTot)} -> ${kb(newTot)} (${((1 - newTot / origTot) * 100).toFixed(0)}% risparmio)`);
}
run();
