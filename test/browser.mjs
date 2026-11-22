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
  const classic = page.getByRole('radio', { name: 'Klasická' });
  const technical = page.getByRole('radio', { name: 'Technická' });
  const children = page.getByRole('radio', { name: 'Detská' });
  const section = page.getByRole('combobox', { name: 'Sekcia' });
  const showSection = async id => {
    await section.selectOption(id);
    assert.deepEqual(await page.locator('.sidebar .panel:visible').evaluateAll(panels => panels.map(panel => panel.id)), [id]);
  };

  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
  await ready();
  assert.equal(await page.locator('#size').textContent(), '31,8 × 15,8 × 11,4 mm');
  assert.equal(await page.locator('#canvas-host canvas').count(), 1);
  assert.equal(await page.locator('#stage-message').isHidden(), true);

  assert.ok(await classic.isChecked());
  await classic.press('ArrowRight');
  assert.ok(await technical.isChecked());
  await ready();
  assert.equal(await page.locator('#size').textContent(), '39,4 × 7,4 × 8 mm');
  assert.ok(await page.getByLabel('Dĺžka nosníka').isVisible());
  await showSection('connections');
  const passage = page.getByLabel('Priechodný spoj');
  assert.equal(await passage.inputValue(), 'pin');
  assert.equal(await page.locator('#connection-note').textContent(), 'Priechodné otvory · 5 · os Z');
  const alignment = page.locator('#beam-alignment');
  const alignmentRows = () => alignment.locator('tbody tr').evaluateAll(rows => rows.map(row =>
    Array.from(row.cells, cell => cell.textContent),
  ));
  await alignment.locator('summary').press('Enter');
  assert.ok(await alignment.getByRole('table').isVisible());
  assert.deepEqual(await alignmentRows(), [['1', '0', '0 mm'], ['3', '5', '16 mm'], ['5', '10', '32 mm']]);
  await showSection('footprint');
  const beamLength = page.getByLabel('Dĺžka nosníka');
  await beamLength.fill('9');
  await beamLength.press('Tab');
  await showSection('connections');
  assert.deepEqual((await alignmentRows()).slice(-2), [['7', '15', '48 mm'], ['9', '20', '64 mm']]);
  await passage.selectOption('none');
  assert.ok(await alignment.isHidden());
  await passage.selectOption('pin');
  await page.getByLabel('Tvar dielca').selectOption('brick');
  assert.ok(await alignment.isHidden());
  assert.equal(await page.locator('#connection-note').textContent(), 'Priechodné otvory · 3 · os Y');
  await passage.selectOption('axle');
  await children.check();
  await ready();
  assert.equal(await page.locator('#category-pitch').textContent(), 'Rozstup 16 mm.');
  assert.equal(await page.locator('#size').textContent(), '63,68 × 31,68 × 23,6 mm');
  assert.equal(await page.getByLabel('Horný povrch').inputValue(), 'hollow');
  assert.ok(await passage.isHidden());
  await page.getByLabel('Horný povrch').selectOption('hollow-classic');
  assert.match(await page.locator('#connection-note').textContent(), /6,6 mm/);
  await showSection('height');
  assert.equal(await page.locator('#body-height').textContent(), '19,2 mm');
  await ready();
  await page.getByRole('button', { name: 'Exportovať' }).click();
  const downloadingLargePart = page.waitForEvent('download');
  await page.locator('[data-format="3mf"]').click();
  assert.equal((await downloadingLargePart).suggestedFilename(), 'brick-detska-4x2-3p.3mf');
  await classic.check();
  await showSection('connections');
  assert.equal(await passage.inputValue(), 'none');
  await technical.check();
  assert.equal(await passage.inputValue(), 'axle');
  await classic.check();
  await showSection('footprint');
  await ready();
  assert.equal(await page.locator('#size').textContent(), '31,8 × 15,8 × 11,4 mm');

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
  await showSection('height');
  await page.getByRole('button', { name: 'Pridať platničku' }).click();
  await showSection('connections');
  await page.locator('#top').selectOption('hollow');
  await showSection('print');
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
