// Read-only production smoke check: a 200 response is not enough if CSP blocks hydration.
const base = process.argv[2] ?? 'http://127.0.0.1:3100';
const routes = ['/', '/map', '/scopri', '/sfoglia', '/preferiti', '/sessioni', '/messaggi', '/events', '/news', '/classifica', '/privacy', '/regole', '/auth/reset-password', '/auth/setup-username', '/newsletter', '/newsletter-grazie', '/newsletter/conferma', '/cerca-spot', '/skate-maps', '/map/about', '/map/support', '/admin/login', '/admin/conferma'];
let failures = 0;
for (const route of routes) {
  try {
    const response = await fetch(base + route, { signal: AbortSignal.timeout(25000) });
    const html = await response.text();
    const nonce = response.headers.get('content-security-policy')?.match(/'nonce-([^']+)'/)?.[1];
    const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(([, attrs, body]) => body.trim() && !attrs.includes('application/ld+json'));
    const valid = response.ok && nonce && inline.length && inline.every(([, attrs]) => attrs.includes(`nonce="${nonce}"`));
    if (!valid) failures++;
    console.log(`${valid ? 'PASS' : 'FAIL'} ${route}: HTTP ${response.status}, ${inline.length} inline scripts, nonce ${valid ? 'matches' : 'missing or mismatched'}`);
  } catch (error) { failures++; console.log(`FAIL ${route}: ${error.message}`); }
}
process.exitCode = failures ? 1 : 0;
