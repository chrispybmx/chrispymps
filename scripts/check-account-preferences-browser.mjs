// Isolated component harness: real React components, synthetic API only.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {build}=require('esbuild');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.BROWSER_ENGINE||'chromium';
const bundle=await build({stdin:{contents:`import React from 'react'; import {createRoot} from 'react-dom/client'; import RiderPreferences from './components/RiderPreferences'; import EmailVerification from './components/EmailVerification'; createRoot(document.getElementById('root')).render(<><EmailVerification token="synthetic"/><RiderPreferences token="synthetic"/></>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
const css=await readFile('app/globals.css','utf8');
const server=createServer((req,res)=>{
 if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text);}
 else {res.setHeader('Content-Type','text/html');res.end(`<html lang="it"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main id="root" style="max-width:680px;margin:auto;padding:20px"></main><script src="/bundle.js"></script></body></html>`);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try {
 browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});
  let saved,posts=0,emails=0,verified=false,failRead=true;
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!==origin)return route.abort();
   if(url.pathname==='/api/rider/details'){
    if(req.method()==='POST'){posts++;saved=req.postDataJSON();return route.fulfill({json:{ok:true}});}
    if(failRead){failRead=false;return route.fulfill({status:503,json:{ok:false}});}
    return route.fulfill({json:{ok:true,data:{country_code:'IT',disciplines:['bmx']}}});
   }
   if(url.pathname==='/api/auth/email-verification'){
    if(req.method()==='POST'){emails++;return route.fulfill({json:{ok:true,sent:true,verified:false}});}
    return route.fulfill({json:{ok:true,verified,enabled:true}});
   }
   return route.continue();
  });
  await page.goto(origin);
  await page.addStyleTag({content:':root{--font-mono:monospace;--font-body:Arial,sans-serif}body{font-family:Arial,sans-serif}'});
  await page.getByRole('button',{name:'Riprova',exact:true}).click();
  await page.getByLabel('Paese di residenza (privato)').selectOption('US');
  await page.getByRole('checkbox',{name:'MTB',exact:true}).check();
  await page.getByRole('button',{name:'Salva preferenze',exact:true}).evaluate(button=>{button.click();button.click();});
  await page.getByText('Preferenze salvate.',{exact:true}).waitFor();
  assert.equal(posts,1);assert.deepEqual(saved,{countryCode:'US',disciplines:['bmx','mtb']});
  await page.getByRole('button',{name:'Verifica email',exact:true}).evaluate(button=>{button.click();button.click();});
  await page.getByText('Controlla la tua casella e conferma il link. Guarda anche nello spam.').waitFor();
  assert.equal(emails,1);assert.equal(await page.getByRole('button',{name:'Attendi un minuto'}).isDisabled(),true);
  verified=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByText('Email verificata',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Attendi un minuto'}).count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`/private/tmp/crock-preferences-${engine}-${width}.png`});
  assert.deepEqual(errors,[]);
  console.log(`PASS ${engine} ${width}: retry preferences, private save, double-tap, verification cooldown, refreshed proof, no overflow`);
  await page.close();
 }
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
