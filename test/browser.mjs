import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { preview } from 'vite';

test('production UI builds, edits and downloads a brick', { timeout: 90_000 }, async t => {
  const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
  t.after(() => new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve())));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, colorScheme: 'light' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const ready = () => page.waitForFunction(() => document.querySelector('#status')?.classList.contains('ready'));
  const cell = (x, y) => page.locator(`[data-x="${x}"][data-y="${y}"]`);

  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
  await ready();
  assert.equal(await page.locator('#size').textContent(), '31,8 × 15,8 × 11,4 mm');
  assert.equal(await page.locator('#canvas-host canvas').count(), 1);
  assert.equal(await page.locator('#stage-message').isHidden(), true);

  await page.getByRole('button', { name: 'Rez dielcom' }).click();
  await page.locator('#cut-axis').selectOption('z');
  assert.equal(await page.locator('#cut-control').isVisible(), true);
  await page.getByRole('button', { name: 'Rez dielcom' }).click();
  await page.getByRole('button', { name: 'Zmeniť pohľad' }).click();
  await page.getByRole('button', { name: 'Zdola' }).click();
  assert.equal(await page.locator('#orientation').textContent(), 'ZDOLA');

  await page.getByRole('button', { name: 'Rýchly' }).click();
  await page.getByRole('button', { name: 'Vlastný tvar' }).click();
  await page.getByRole('button', { name: 'Vymazať' }).click();
  assert.equal(await page.locator('#export').isDisabled(), true);

  await cell(2, 2).click();
  await cell(3, 2).click();
  await cell(2, 3).click();
  await page.getByRole('button', { name: 'Zrkadliť X' }).click();
  assert.equal(await cell(13, 2).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Upraviť jednotlivé study' }).click();
  await cell(13, 2).press('Space');
  assert.equal(await cell(13, 2).getAttribute('aria-pressed'), 'false');
  await page.getByRole('button', { name: 'Dokončiť úpravu studov' }).click();
  await page.getByRole('button', { name: 'Pridať platničku' }).click();
  await page.locator('summary').filter({ hasText: 'Prepojenia' }).click();
  await page.locator('#top').selectOption('hollow');
  await page.locator('summary').filter({ hasText: 'Príprava na tlač' }).click();
  await page.getByRole('button', { name: 'Pre 3D tlač' }).click();
  await page.locator('#nozzle').selectOption('0.6');
  const bridging = page.getByRole('switch', { name: 'Kónický nábeh k rúrkam' });
  await bridging.press('Space');
  assert.equal(await bridging.isChecked(), true);
  await ready();
  assert.equal(await page.locator('#size').textContent(), '15,8 × 15,8 × 14,6 mm');

  const signatures = { stl: null, step: 'ISO-10303-21;', '3mf': 'PK' };
  for (const [format, signature] of Object.entries(signatures)) {
    await page.getByRole('button', { name: 'Exportovať' }).click();
    const downloaded = page.waitForEvent('download');
    await page.locator(`[data-format="${format}"]`).click();
    const file = await downloaded;
    assert.equal(file.suggestedFilename(), `brick-2x2-4p.${format}`);
    const bytes = await readFile(await file.path());
    if (signature) assert.ok(bytes.toString('utf8', 0, signature.length) === signature);
    else assert.equal(bytes.length, 84 + bytes.readUInt32LE(80) * 50);
    await ready();
  }

  await page.emulateMedia({ colorScheme: 'dark' });
  assert.equal(await page.locator('html').evaluate(element => getComputedStyle(element).colorScheme), 'dark');
  assert.equal(await page.locator('#size').textContent(), '15,8 × 15,8 × 14,6 mm');
  await page.setViewportSize({ width: 360, height: 800 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth));
  assert.deepEqual(errors, []);
});
