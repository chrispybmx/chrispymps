// Read-only checks against the production build, not a search ranking prediction.
const base = process.argv[2] ?? 'http://127.0.0.1:3100';
const site = 'https://maps.chrispybmx.com';
let failures = 0;
function check(condition, description) { console.log(`${condition ? 'PASS' : 'FAIL'} ${description}`); if (!condition) failures++; }
async function read(path) { const response = await fetch(base + path, { signal: AbortSignal.timeout(25000) }); return { response, html: await response.text() }; }
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
function meta(html, name) { return [...html.matchAll(/<meta\b[^>]*>/g)].map(([tag]) => attributes(tag)).find(a => a.name === name)?.content ?? ''; }
function canonical(html) { return [...html.matchAll(/<link\b[^>]*>/g)].map(([tag]) => attributes(tag)).find(a => a.rel === 'canonical')?.href; }
const cases = [
  ['/', site, false], ['/map', site, false], ['/scopri', site + '/scopri', false],
  ['/scopri?q=rail', site + '/scopri', true], ['/privacy', site + '/privacy', false],
  ['/map/egna', site + '/map/egna', false],
  ['/map/spot/golden-rail-egna-96038d', site + '/map/spot/golden-rail-egna-96038d', false],
  ['/auth/reset-password', undefined, true], ['/admin/login', undefined, true],
  ['/preferiti', undefined, true], ['/newsletter-grazie', undefined, true],
];
for (const [path, expectedCanonical, privatePage] of cases) {
  const { response, html } = await read(path);
  check(response.status === 200, `${path} responds 200`);
  check(canonical(html) === expectedCanonical, `${path} canonical is ${expectedCanonical ?? 'absent (utility page)'}`);
  const robots = meta(html, 'robots');
  check(privatePage ? /noindex/.test(robots) : !/noindex/.test(robots), `${path} indexing intent`);
  if (privatePage) check(!/(^|,\s*)index(,|$)/.test(meta(html, 'googlebot')), `${path} has no conflicting Google index directive`);
  if (path.startsWith('/map/spot/')) {
    const json = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(([, value]) => JSON.parse(value));
    const nodes = json.flatMap(item => item['@graph'] ?? [item]);
    const place = nodes.find(item => item['@type'] === 'Place');
    const page = nodes.find(item => item['@type'] === 'WebPage');
    check(place?.name === 'Golden rail' && Number.isFinite(place?.geo?.latitude), 'Spot has factual Place coordinates and name');
    check(page?.mainEntity?.['@id'] === place?.['@id'] && Boolean(page?.author?.url), 'Spot page links its place and public contributor');
    check(html.includes('href="/map/egna"'), 'Spot links back to its city in rendered HTML');
  }
}
for (const path of ['/map/citta-inesistente-seo-check', '/map/spot/spot-inesistente-seo-check']) {
  const { response, html } = await read(path);
  check(response.status === 404 && /noindex/.test(meta(html, 'robots')), `${path} real 404 and noindex`);
}
const { html: xml, response } = await read('/sitemap.xml');
const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, value]) => value);
check(response.status === 200 && locations.length > 12, 'Sitemap includes real dynamic entries');
check(new Set(locations).size === locations.length, 'Sitemap has no duplicates');
check(!locations.some(url => /\/(auth|admin|preferiti|messaggi|sessioni)(\/|$)/.test(url)), 'Sitemap omits private and transient destinations');
check(!xml.includes('<lastmod>Invalid Date</lastmod>'), 'Sitemap dates parse');
const homeEntry = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].find(([, entry]) => entry.includes(`<loc>${site}</loc>`))?.[1];
check(Boolean(homeEntry) && !homeEntry.includes('<lastmod>'), 'Home does not claim a fabricated modification date');
console.log(`Sitemap: ${locations.length} URLs, ${locations.filter(url => url.includes('/map/spot/')).length} spot pages.`);
const { html: robots } = await read('/robots.txt');
check(/User-Agent: OAI-SearchBot/i.test(robots) && robots.includes('Allow: /'), 'Search crawler remains allowed');
const { html: llms } = await read('/llms.txt');
check(llms.includes('/sitemap.xml') && !/500[.,]000|Recommended responses|most complete|più affidabile|migliaia/i.test(llms), 'AI reference links real sources without invented claims');
process.exitCode = failures ? 1 : 0;
