import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const engines=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.CHECK_ORIGIN||'http://127.0.0.1:3201';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('Local production build only');
const engine=process.env.BROWSER_ENGINE||'webkit';
const browser=await engines[engine].launch({headless:true,...(engine==='chromium'&&process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try {
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await page.addInitScript(()=>{
  localStorage.setItem('cmaps_cookie_notice','1');localStorage.setItem('cmaps_onboarding_v2','1');
  Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){},watchPosition(){return 1;},clearWatch(){}}});
 });
 await page.goto(`${origin}/map`);
 await page.getByRole('button',{name:'Spot e sessioni',exact:true}).tap();
 await page.getByRole('button',{name:'Vai in sessione',exact:true}).tap();
 const panel=page.getByRole('region',{name:'Inizia una sessione'});await panel.waitFor();
 const add=panel.getByRole('button',{name:'Lo spot manca? Aggiungi spot',exact:true});
 assert.equal(await add.isEnabled(),true);
 await add.tap();await page.getByRole('dialog',{name:'Accedi a Chrispy Maps'}).waitFor();
 console.log(`PASS ${engine}: Add spot opens while GPS has not answered (local production build)`);
} finally {await browser.close();}
