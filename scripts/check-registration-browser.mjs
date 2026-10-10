// Synthetic signup only: no account creation, production network or email sends.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.BROWSER_ENGINE||'chromium';
const origin=process.env.PREVIEW_ORIGIN||'http://127.0.0.1:3200';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw new Error('Local only');
const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try {
 for(const width of [320,390,1440]) {
  // Production CSP deliberately excludes the fake local Supabase origin.
  // Only this isolated test context bypasses it; application headers stay intact.
  const page=await browser.newPage({viewport:{width,height:900},locale:'it-IT',bypassCSP:true});
  const errors=[];let submissions=0;let payload;let preflight=0;
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{localStorage.setItem('cmaps_cookie_notice','1');localStorage.setItem('cmaps_language','it');});
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(!['localhost','127.0.0.1'].includes(url.hostname))return route.abort();
   if(url.pathname==='/api/auth/registration-check'){preflight++;return route.fulfill({json:{ok:true}});}
   if(url.pathname==='/auth/v1/signup'){
    submissions++;payload=route.request().postDataJSON();
    await new Promise(resolve=>setTimeout(resolve,200));
    return route.fulfill({json:{id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',email:'synthetic@example.com',user_metadata:payload.data,app_metadata:{provider:'email'},created_at:new Date().toISOString(),identities:[]}});
   }
   if(url.port==='54321')return route.fulfill({json:[]});
   return route.continue();
  });
  await page.goto(`${origin}/map?add=1`,{waitUntil:'domcontentloaded'});
  const dialog=page.getByRole('dialog',{name:'Accedi a Chrispy Maps'});
  await dialog.waitFor({timeout:60000});
  await dialog.getByRole('button',{name:'Registrati',exact:true}).click();
  await page.locator('#signup-username').fill('synthetic_rider');
  await page.locator('#signup-email').fill('synthetic@example.com');
  await page.locator('#signup-password').fill('test-only-password');
  await page.getByLabel('Giorno',{exact:true}).selectOption('1');
  await page.getByLabel('Mese',{exact:true}).selectOption('1');
  await page.getByLabel('Anno',{exact:true}).selectOption('2020');
  await page.locator('#signup-country').selectOption('IT');
  await page.getByRole('button',{name:'Crea account',exact:true}).click();
  await page.getByText('Per registrarti devi avere almeno 14 anni.',{exact:false}).waitFor();
  assert.equal(preflight,0);assert.equal(submissions,0);
  await page.getByLabel('Anno',{exact:true}).selectOption('2000');
  await page.getByRole('checkbox',{name:'BMX',exact:true}).check();
  await page.getByRole('checkbox',{name:'MTB',exact:true}).check();
  assert.equal(await page.getByRole('checkbox').evaluateAll(nodes=>nodes.filter(n=>n.checked).length),2);
  assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'dialog overflow');
  await page.locator('#signup-country').scrollIntoViewIfNeeded();
  await page.screenshot({path:`/private/tmp/crock-registration-${engine}-${width}.png`});
  await page.getByRole('button',{name:'Crea account',exact:true}).evaluate(button=>{button.click();button.click();});
  try { await page.getByText('CONTROLLA LA TUA EMAIL',{exact:true}).waitFor(); }
  catch(error) { console.log({preflight,submissions,dialog:(await dialog.innerText()).slice(-1200)}); throw error; }
  assert.equal(submissions,1);assert.equal(preflight,1);
  assert.deepEqual(payload.data.initial_rider_details.disciplines,['bmx','mtb']);
  assert.equal(payload.data.initial_rider_details.countryCode,'IT');
  assert.equal(payload.data.registration_version,2);
  assert.deepEqual(errors,[]);
  console.log(`PASS ${engine} ${width}: age rejection, private country, multi-sport, newsletter off, double-tap, email-pending, no overflow`);
  await page.close();
 }
}finally{await browser.close();}
