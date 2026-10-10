import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const engine = process.env.BROWSER_ENGINE || 'chromium';
const browsers = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.PREVIEW_ORIGIN || 'http://127.0.0.1:3200';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Local preview only');
const actor = '11111111-1111-4111-8111-111111111111';
const headers = { Authorization: 'Bearer local-rider-session-preview', 'Content-Type': 'application/json' };
async function api(path, body) {
 const response = await fetch(`${origin}${path}`, { headers, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
 const result = await response.json();
 assert.equal(response.status, 200, JSON.stringify(result));
 return result.data;
}
const command = command => api('/api/rider-sessions-preview', { requestId: randomUUID(), command });
const browser = await browsers[engine].launch({ headless: true, ...(engine === 'chromium' && process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
let sessionId;
try {
 await api('/api/rider-stats-preview', { shared: false });
 const state = await command({ action: 'start', spotId: '22222222-2222-4222-8222-222222222222' });
 sessionId = state.sessions.find(s => s.status === 'active').id;
 const expired = await api('/api/rider-sessions-preview', { demoExpire: true });
 const pending = expired.sessions.find(s => s.id === sessionId);
 await command({ action: 'confirm', id: sessionId, version: pending.version, endedAt: pending.endedAt });
 for (const width of [390, 1440]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const errors = []; context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
  await context.addInitScript(() => { if (location.protocol === 'http:') localStorage.setItem('cmaps_cookie_notice', '1'); });
  const owner = await context.newPage(), visitor = await context.newPage();
  await owner.goto(`${origin}/u/rider_demo`);
  await owner.getByText('Visibilità dei totali',{exact:true}).click();
  const choice = owner.getByRole('checkbox', { name: 'Mostra tempo e session al pubblico', exact: true });
  await choice.waitFor();
  await visitor.goto(`${origin}/u/rider_demo?view=public`);
  assert.equal((await api(`/api/rider-stats-preview?target=${actor}`)), null);
  assert.equal(await visitor.getByRole('region', { name: 'Session del rider' }).count(), 0);
  await choice.click();
  await owner.waitForFunction(() => {
   const input = document.querySelector('input[type=checkbox]'); return input?.checked && !input.disabled;
  });
  await visitor.reload();
  const totals = visitor.getByRole('region', { name: 'Session del rider' });
  await totals.waitFor();
  assert.match(await totals.innerText(), /2 h 0 min/);
  assert.equal(await visitor.getByRole('region', { name: 'Le tue sessioni' }).count(), 0);
  assert.equal(await visitor.getByText('Spot demo Barcellona', { exact: true }).count(), 0);
  assert.equal(await owner.getByText('Spot demo Barcellona', { exact: true }).count(), 0);
  assert.equal(await owner.getByRole('button',{name:'Bella sessione',exact:true}).count(),0);
  assert.equal(await owner.getByRole('link',{name:'Gestisci sessioni',exact:true}).count(),1);
  assert.equal(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await visitor.screenshot({ path: `/private/tmp/rider-public-stats-${engine}-${width}.png`, fullPage: true });
  await owner.screenshot({ path: `/private/tmp/rider-own-stats-${engine}-${width}.png`, fullPage: true });
  await owner.reload(); await owner.getByText('Visibilità dei totali',{exact:true}).click(); await choice.waitFor();
  await owner.waitForFunction(() => {
   const input = document.querySelector('input[type=checkbox]'); return input && !input.disabled;
  });
  assert.equal(await choice.isChecked(), true);
  await choice.click();
  await owner.waitForFunction(() => {
   const input = document.querySelector('input[type=checkbox]'); return input && !input.checked && !input.disabled;
  });
  await visitor.evaluate(() => window.dispatchEvent(new Event('focus')));
  await totals.waitFor({ state: 'hidden' });
  assert.equal((await api(`/api/rider-stats-preview?target=${actor}`)), null);
  assert.deepEqual(errors, []);
  console.log(`PASS ${engine} ${width}px: private default, opt-in, public totals only, refresh, revoke, no overflow/errors`);
  await context.close();
 }
} finally {
 await browser.close();
 await api('/api/rider-stats-preview', { shared: false });
 if (sessionId) await command({ action: 'delete', id: sessionId });
}
