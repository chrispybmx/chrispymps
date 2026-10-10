import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const browsers=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.BROWSER_ENGINE||'chromium';
const origin=process.env.PREVIEW_ORIGIN||'http://127.0.0.1:3200';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw new Error('Local preview only');
const headers={Authorization:'Bearer local-rider-session-preview','Content-Type':'application/json'};
async function api(body,query='') {
 const response=await fetch(`${origin}/api/rider-sessions-preview${query}`,{headers,...(body?{method:'POST',body:JSON.stringify(body)}:{})});
 const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result.data;
}
const command=command=>api({requestId:randomUUID(),command});
const index=await (await fetch(`${origin}/api/spots/index`)).json();
const spot=index.data.find(s=>s.slug==='jungle-merano-17fe5a')||index.data[0];
assert.ok(spot);
assert.equal((await api()).sessions.some(s=>s.status==='active'),false,'Finish any local demo session before running this test');
const browser=await browsers[engine].launch({headless:true,...(engine==='chromium'&&process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
let id;
try {
 for(const width of [320,390,1440]) {
  const state=await command({action:'start',spotId:spot.id,visibility:'community'});
  id=state.sessions.find(s=>s.status==='active').id;
  assert.equal((await api(undefined,'?live=1')).spots.find(s=>s.spotId===spot.id).count,1);
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  await context.addInitScript(()=>{localStorage.setItem('cmaps_cookie_notice','1');localStorage.setItem('cmaps_onboarding_v2','1');});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${origin}/map?q=${encodeURIComponent(spot.name)}`,{waitUntil:'domcontentloaded'});
  const toggle=page.getByRole('button',{name:'Live',exact:true});
  const markers=page.locator('.leaflet-marker-pane .spot-pin, .leaflet-marker-pane .spot-cluster');
  await markers.first().waitFor();
  if(width<768)await page.getByRole('button',{name:'Mostra gli spot in questa zona',exact:true}).click();
  const original=await markers.count();assert.ok(original>0);
  await toggle.click();
  try { await page.getByText('1 rider · Presenza segnalata',{exact:true}).waitFor(); }
  catch(error){await page.screenshot({path:'/private/tmp/live-debug.png',fullPage:true});console.log(await page.locator('body').innerText());console.log(errors);throw error;}
  assert.equal(await toggle.getAttribute('aria-pressed'),'true');
  assert.equal(await markers.count(),1);
  assert.match(await markers.first().getAttribute('title'),/1 rider/);
  if(await page.locator('.cm-live-pin-count').count())assert.equal(await page.locator('.cm-live-pin-count').first().innerText(),'1');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const bounds=await toggle.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width&&bounds.y>=0);
  assert.equal(await toggle.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'Live is not covered by another control');
  if(width<768)await page.getByRole('button',{name:'Chiudi il pannello e mostra la mappa',exact:true}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.leaflet-tile')].some(img=>img.complete&&img.naturalWidth>0));
  await page.screenshot({path:`/private/tmp/chrispy-live-${engine}-${width}.png`,fullPage:true});
  if(width<768)await page.getByRole('button',{name:'Mostra gli spot in questa zona',exact:true}).click();
  await toggle.click();assert.equal(await toggle.getAttribute('aria-pressed'),'false');
  await markers.first().waitFor();assert.equal(await markers.count(),original);
  await toggle.click();await page.getByText('1 rider · Presenza segnalata',{exact:true}).waitFor();
  await command({action:'hide',id});
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByText('Nessuna presenza condivisa in questa zona.',{exact:true}).waitFor();
  assert.equal(await markers.count(),0);
  // Connection failure must clear the feed instead of leaving old locations visible.
  await page.route('**/api/rider-sessions-preview?live=1',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false})}));
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByText('Live non disponibile.',{exact:false}).waitFor();assert.equal(await markers.count(),0);
  await page.getByRole('button',{name:'Riprova',exact:true}).click();
  await page.unroute('**/api/rider-sessions-preview?live=1');
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByText('Nessuna presenza condivisa in questa zona.',{exact:true}).waitFor();
  await command({action:'delete',id});id=null;
  const another=await command({action:'start',spotId:spot.id,visibility:'community'});id=another.sessions.find(s=>s.status==='active').id;
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByText('1 rider · Presenza segnalata',{exact:true}).waitFor();
  await api({demoExpire:true});
  assert.equal((await api(undefined,'?live=1')).spots.length,0);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByText('Nessuna presenza condivisa in questa zona.',{exact:true}).waitFor();
  assert.equal(await markers.count(),0);assert.deepEqual(errors,[]);
  await command({action:'delete',id});id=null;
  await context.close();
  console.log(`PASS ${engine} ${width}px: real map Live toggle, opt-in count, markers, restore, hide, expiry, error/retry, overflow, hit target`);
 }
}finally{await browser.close();if(id)await command({action:'delete',id});}
