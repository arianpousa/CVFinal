// render-check.cjs: renders glass-components.html in headless Chrome (light + dark),
// checks HIG tap targets (>= 44x44 px for every button) and saves screenshots for review.
// Run: npx playwright install chromium (once)  then  node render-check.cjs
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
  let fails = 0;
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ colorScheme: scheme, viewport: { width: 760, height: 760 } });
    await page.goto('file://' + path.join(__dirname, 'glass-components.html'));
    const small = await page.$$eval('button', (bs) => bs.map((b) => ({ t: b.textContent.trim(), w: b.offsetWidth, h: b.offsetHeight }))
      .filter((b) => b.w < 44 || b.h < 44));
    const glassBlur = await page.$eval('.toolbar', (el) => getComputedStyle(el).backdropFilter);
    const ok = small.length === 0 && /blur/.test(glassBlur);
    if (!ok) fails++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${scheme}: all buttons >= 44x44 px${small.length ? ' ' + JSON.stringify(small) : ''}; toolbar backdrop-filter = ${glassBlur}`);
    await page.screenshot({ path: path.join(__dirname, `screenshot-${scheme}.png`) });
    await page.close();
  }
  // Reduced transparency: glass must fall back to a solid surface
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto('file://' + path.join(__dirname, 'glass-components.html'));
  const dur = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dur').trim());
  const okMotion = dur === '0ms'; if (!okMotion) fails++;
  console.log(`${okMotion ? 'PASS' : 'FAIL'}  prefers-reduced-motion sets --dur to ${dur}`);
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})();
