// Requires Playwright in the local toolchain (or PLAYWRIGHT_MODULE absolute path).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.PREVIEW_ORIGIN||'http://127.0.0.1:3200';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw new Error('Local preview only');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
 for(const viewport of [{width:390,height:844},{width:1440,height:1000}]){
  const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('cmaps_cookie_notice','1'));
  await page.goto(`${origin}/anteprima-sessioni`);
  await page.getByRole('button',{name:'Inizio sessione',exact:true}).click();
  assert.equal(await page.getByRole('radio',{name:'Solo io',exact:true}).isChecked(),true);
  await page.getByRole('button',{name:'Conferma e inizia',exact:true}).click();
  await page.getByRole('button',{name:'Termina sessione',exact:true}).waitFor();
  await page.reload();await page.getByRole('button',{name:'Termina sessione',exact:true}).waitFor();
  await page.getByRole('button',{name:'Termina sessione',exact:true}).click();
  await page.getByRole('button',{name:'Profilo rider',exact:true}).click();
  await page.getByRole('region',{name:'Le tue sessioni'}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`/private/tmp/crock-session-${viewport.width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Elimina sessione',exact:true}).click();
  await page.getByRole('button',{name:'Conferma eliminazione',exact:true}).click();
  await page.getByText('Non hai ancora registrato sessioni.',{exact:false}).waitFor();
  assert.deepEqual(errors,[]);console.log(`PASS browser ${viewport.width}x${viewport.height}: start, refresh, stop, private history, delete, overflow`);
  await page.close();
 }
}finally{await browser.close();}
