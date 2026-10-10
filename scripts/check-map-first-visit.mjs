// Read-only public UI: no account, no submissions, no consent to analytics.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const engines=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.CHECK_ORIGIN||'https://maps.chrispybmx.com';
const engine=process.env.BROWSER_ENGINE||'chromium';
const browser=await engines[engine].launch({headless:true,...(engine==='chromium'&&process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try {
 for(const viewport of [{width:320,height:568},{width:390,height:844}]) {
  const page=await browser.newPage({viewport,isMobile:true,hasTouch:true});
  const errors=[],analytics=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/\/(_vercel\/insights|va\/)|vitals\.vercel-insights\.com/.test(r.url()))analytics.push(new URL(r.url()).pathname);});
  await page.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(_success,error){queueMicrotask(()=>error({code:1,message:'Permission denied in test'}));},watchPosition(){return 1;},clearWatch(){}}}));
  await page.goto(`${origin}/map`);
  const notice=page.getByRole('region',{name:'Informativa privacy'});
  await notice.waitFor();
  const box=await notice.boundingBox(),nav=await page.getByRole('navigation',{name:'Navigazione principale'}).boundingBox();
  assert.ok(box&&nav&&box.y+box.height<=nav.y,'Cookie notice must leave navigation visible');
  await notice.getByRole('button',{name:'Accetta',exact:true}).tap();
  const welcome=page.getByRole('dialog',{name:'Benvenuto su Chrispy Maps'});
  await welcome.waitFor();await welcome.getByRole('button',{name:'ESPLORO',exact:true}).tap();
  await page.getByRole('button',{name:'Spot e sessioni',exact:true}).tap();
  await page.getByRole('button',{name:'Vai in sessione',exact:true}).tap();
  const panel=page.getByRole('region',{name:'Inizia una sessione'});await panel.waitFor();
  await panel.getByRole('searchbox',{name:'Cerca uno spot'}).waitFor();
  await panel.getByRole('button',{name:'Lo spot manca? Aggiungi spot',exact:true}).tap();
  const login=page.getByRole('dialog',{name:'Accedi a Chrispy Maps'});await login.waitFor();
  await login.locator('input[type=email]').fill('rider@example.invalid');
  await login.locator('input[type=password]').fill('not-submitted-test-only');
  const submit=login.getByRole('button',{name:'Accedi',exact:true}).last();
  await submit.scrollIntoViewIfNeeded();
  const submitBox=await submit.boundingBox();
  assert.ok(submitBox&&submitBox.y>=0&&submitBox.y+submitBox.height<=viewport.height,'Sign-in action must be reachable inside the small viewport');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`/private/tmp/chrispy-first-visit-${engine}-${viewport.width}.png`});
  assert.deepEqual(analytics,[],'Accepting the notice must not enable analytics');
  assert.deepEqual(errors,[]);
  console.log(`PASS ${engine} ${viewport.width}px: fresh visit, cookie clear of nav, onboarding, GPS denied, Add spot sign-in, no analytics/overflow/errors`);
  await page.close();
 }
} finally {await browser.close();}
