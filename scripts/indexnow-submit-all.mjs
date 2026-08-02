// Invia TUTTE le URL della sitemap a IndexNow (Bing, Copilot, Yandex, Seznam).
// Da lanciare una volta dopo il deploy, e ogni volta che si vuole forzare un
// ricontrollo massivo. Google non usa IndexNow: per Google servono backlink +
// Search Console.
//
// Uso: node scripts/indexnow-submit-all.mjs [--apply]
const KEY  = 'd2707434d81d4231f08b2a5813182e7a';
const SITE = 'https://maps.chrispybmx.com';
const APPLY = process.argv.includes('--apply');

const res = await fetch(`${SITE}/sitemap.xml`);
const xml = await res.text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
console.log(`${urls.length} URL trovate nella sitemap.`);

// La chiave deve essere raggiungibile, altrimenti IndexNow rifiuta tutto
const keyRes = await fetch(`${SITE}/${KEY}.txt`);
const keyBody = (await keyRes.text()).trim();
console.log(`Key file: HTTP ${keyRes.status} — contenuto combacia: ${keyBody === KEY}`);
if (keyRes.status !== 200 || keyBody !== KEY) {
  console.error('STOP: la chiave non è pubblicata correttamente. Deploya prima.');
  process.exit(1);
}

if (!APPLY) {
  console.log('DRY-RUN. Rilancia con --apply per inviare.');
  console.log('Prime 5:', urls.slice(0, 5));
  process.exit(0);
}

const submit = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: new URL(SITE).host,
    key: KEY,
    keyLocation: `${SITE}/${KEY}.txt`,
    urlList: urls,
  }),
});
console.log(`IndexNow: HTTP ${submit.status} ${submit.statusText}`);
console.log(await submit.text().catch(() => ''));
console.log(submit.status === 200 || submit.status === 202 ? '✅ inviate' : '❌ rifiutate');
