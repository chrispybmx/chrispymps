// Read-only UI regression: never starts a session or submits a spot.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const engines = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.BROWSER_ENGINE || 'chromium';
const origin = process.env.PREVIEW_ORIGIN || 'http://127.0.0.1:3200';
const browser = await engines[engine].launch({ headless: true, ...(engine === 'chromium' && process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
try {
  for (const width of [320, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('cmaps_cookie_notice', '1');
      localStorage.setItem('cmaps_onboarding_v2', '1');
    });
    await page.goto(`${origin}/map`);
    const trigger = page.getByRole('button', { name: 'Spot e sessioni', exact: true });
    const action = page.getByRole('button', { name: 'Vai in sessione', exact: true });
    const panel = page.getByRole('region', { name: 'Inizia una sessione', exact: true });
    await trigger.tap();
    const sheet=page.getByRole('dialog',{name:'Cosa vuoi fare?',exact:true});
    await sheet.waitFor();
    await page.waitForFunction(()=>{const rect=document.querySelector('.mbn-actions')?.getBoundingClientRect();return rect&&Math.abs(rect.bottom-innerHeight)<2;});
    const box=await sheet.boundingBox();
    assert.ok(box&&box.x===0&&Math.abs(box.width-width)<2&&Math.abs(box.y+box.height-844)<2,'Full-width bottom sheet');
    await action.waitFor();
    // Touch browsers can blur a button with no next focus target before click.
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(100);
    assert.equal(await action.isVisible(), true, 'Null blur must not remove the action before its click');
    await action.tap();
    await panel.waitFor();
    await page.getByRole('button', { name: 'Torna alla mappa', exact: true }).tap();
    await panel.waitFor({ state: 'hidden' });
    await trigger.tap();
    await action.tap();
    await panel.waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `/private/tmp/chrispy-map-actions-${width}.png` });
    await page.getByRole('button', { name: 'Torna alla mappa', exact: true }).tap();

    await trigger.tap();
    await page.keyboard.press('Escape');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
    await trigger.tap();
    await sheet.getByRole('button',{name:'Aggiungi spot',exact:true}).focus();
    await page.keyboard.press('Tab');
    assert.equal(await sheet.getByRole('button',{name:'Chiudi azioni',exact:true}).evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await sheet.getByRole('button',{name:'Aggiungi spot',exact:true}).evaluate(el=>el===document.activeElement),true);
    await page.locator('.mbn-sheet-backdrop').tap({position:{x:10,y:100}});
    await action.waitFor({ state: 'hidden' });

    await trigger.tap();
    await page.evaluate(() => document.activeElement?.blur());
    await page.getByRole('button', { name: 'Aggiungi spot', exact: true }).tap();
    await page.getByRole('dialog', { name: 'Accedi a Chrispy Maps', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(`PASS ${engine} ${width}px: bottom sheet, null blur, touch, reopen, Escape, focus trap, backdrop, add spot sign-in, no overflow/errors`);
    await page.close();
  }
} finally {
  await browser.close();
}
