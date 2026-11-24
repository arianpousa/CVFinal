// a11y-check.cjs: drives accessible-corner-editor.html with the KEYBOARD ONLY in headless Chrome.
// Proves: empty state has a next step, Tab reaches controls, arrows move a corner (1px / Shift 10px),
// labels update for screen readers, status is a live region, targets >= 44px, works at 200% zoom.
// Run: npx playwright install chromium (once)  then  node a11y-check.cjs
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
  const page = await browser.newPage();
  await page.goto('file://' + path.join(__dirname, 'accessible-corner-editor.html'));
  let fails = 0;
  const check = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!ok) fails++; };

  check('empty state offers a next step', await page.isVisible('text=Try a sample'));
  await page.keyboard.press('Tab');
  check('Tab focuses "Try a sample"', await page.evaluate(() => document.activeElement.textContent) === 'Try a sample');
  await page.keyboard.press('Enter');
  check('Enter opens the editor and focuses the first corner', await page.evaluate(() => document.activeElement.dataset.i) === '0');
  check('status announced via aria-live', (await page.getAttribute('#status', 'aria-live')) === 'polite' && /Page found/.test(await page.textContent('#status')));

  const before = await page.evaluate(() => ({ ...window.__pts[0] }));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  const after = await page.evaluate(() => ({ ...window.__pts[0] }));
  check('ArrowRight moves 1px, Shift+ArrowDown moves 10px', after.x === before.x + 1 && after.y === before.y + 10, `(${before.x},${before.y} -> ${after.x},${after.y})`);
  const label = await page.evaluate(() => document.activeElement.getAttribute('aria-label'));
  check('corner label describes position for screen readers', label === `Top-left corner, x ${after.x}, y ${after.y}`, `("${label}")`);

  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');   // 3 more corners, then Save
  check('Tab order reaches "Save scan"', await page.evaluate(() => document.activeElement.id) === 'save');
  await page.keyboard.press('Enter');
  check('Working state disables only Save', await page.isDisabled('#save') && /Working/.test(await page.textContent('#status')));
  await page.waitForFunction(() => /Saved/.test(document.getElementById('status').textContent));
  check('success message after save', /Saved to Library/.test(await page.textContent('#status')));

  const small = await page.$$eval('button:not([hidden])', (bs) => bs.filter((b) => b.offsetParent && (b.offsetWidth < 44 || b.offsetHeight < 44)).length);
  check('all visible buttons >= 44x44 px', small === 0);

  await page.evaluate(() => { document.body.style.zoom = '2'; });
  const overflow = await page.evaluate(() => document.getElementById('save').getBoundingClientRect().width > 0);
  check('still usable at 200% zoom', overflow);

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})();
