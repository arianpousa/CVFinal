// a11y.e2e.cjs: Wren's keyboard-only accessibility check (knowledge/ux-designer-apple-hig/examples/a11y-check.cjs)
// adapted to the REAL app. Proves the acceptance criteria in docs/design/flow-spec.md.
// Usage (from tests/): node e2e/a11y.e2e.cjs [baseUrl]   (starts its own python http.server when no URL is given)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

const ROOT = path.resolve(__dirname, '../..');
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });

(async () => {
  let proc = null, baseUrl = process.argv[2];
  if (!baseUrl) {
    const port = await freePort();
    proc = spawn(process.platform === 'win32' ? 'python' : 'python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 800));
    baseUrl = `http://localhost:${port}/`;
  }
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let fails = 0;
  const check = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!ok) fails++; };
  const active = () => page.evaluate(() => ({ id: document.activeElement.id, text: document.activeElement.textContent.trim(), i: document.activeElement.dataset.i, label: document.activeElement.getAttribute('aria-label') }));
  try {
    await page.goto(baseUrl);
    await page.waitForFunction(() => /Ready/.test(document.getElementById('status').textContent), null, { timeout: 60000 });

    check('status pill is a polite live region', (await page.getAttribute('#status', 'role')) === 'status' && (await page.getAttribute('#status', 'aria-live')) === 'polite');
    await page.waitForSelector('#empty-sample', { state: 'visible', timeout: 10000 });
    check('empty state offers a next step ("Try a sample")', true);

    await page.keyboard.press('Tab');
    check('first Tab reaches "Skip to content"', (await active()).text === 'Skip to content');
    const order = [];
    for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); order.push((await active()).text.replace(/\s+/g, ' ')); }
    check('Tab order: nav links, then Upload photo, Use camera, samples', order.join(' | ') === 'How it works | Resources | Upload photo | Use camera | Receipt | Letter', `(${order.join(' | ')})`);

    // "Letter" is focused: Enter starts the scan; when the page is found, focus moves to the first corner.
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement.classList.contains('handle'), null, { timeout: 30000 });
    const a = await active();
    check('Enter on a sample opens Adjust with focus on the top-left corner', a.i === '0' && /^Top-left corner, x \d+, y \d+$/.test(a.label), `("${a.label}")`);
    check('adjust message announced in a live region', (await page.getAttribute('#adjust-msg', 'aria-live')) === 'polite' && /Page found/.test(await page.textContent('#adjust-msg')));

    const p0 = await page.evaluate(() => ({ ...window.__docscanner.state.corners[0] }));
    const pxPer = await page.evaluate(() => { const c = document.getElementById('photo'); return window.__docscanner.state.corners && (c.getBoundingClientRect().width ? 1 : 0) && (document.getElementById('overlay').viewBox.baseVal.width / c.getBoundingClientRect().width); });
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    const p1 = await page.evaluate(() => ({ ...window.__docscanner.state.corners[0] }));
    const dx = (p1.x - p0.x) / pxPer, dy = (p1.y - p0.y) / pxPer;
    check('ArrowRight moves 1 screen px, Shift+ArrowDown moves 10', Math.abs(dx - 1) < 0.01 && Math.abs(dy - 10) < 0.01, `(${dx.toFixed(2)}, ${dy.toFixed(2)} screen px)`);
    const lbl = (await active()).label;
    check('corner label updates for screen readers', lbl === `Top-left corner, x ${Math.round(p1.x)}, y ${Math.round(p1.y)}`, `("${lbl}")`);

    for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
    check('Tab moves through all four corners', (await active()).i === '3');
    await page.keyboard.press('Tab');
    check('then reaches the mode toggle (radio group)', await page.evaluate(() => document.activeElement.name === 'mode'));
    await page.keyboard.press('ArrowLeft');
    check('arrow keys change the mode (B&W -> Gray)', await page.evaluate(() => document.querySelector('input[name=mode]:checked').value === 'gray'));
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    check('then the Save scan button', (await active()).id === 'save');

    await page.keyboard.press('Enter');
    const busy = await page.evaluate(() => ({ save: document.getElementById('save').disabled, retake: document.getElementById('retake').disabled, upload: document.getElementById('upload').disabled, pill: document.getElementById('status').textContent }));
    check('Working disables only Save (and the mode toggle); pill says Working…', busy.save && !busy.retake && !busy.upload && /Working/.test(busy.pill), `(${JSON.stringify(busy)})`);
    await page.waitForFunction(() => /Saved to Library/.test(document.getElementById('capture-msg').textContent), null, { timeout: 30000 });
    check('success message, focus moves to the new library card', (await page.evaluate(() => document.activeElement.classList.contains('scan-card'))));

    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('viewer').open);
    check('Enter opens the scan viewer (modal dialog)', true);
    await page.keyboard.press('Escape');
    check('Esc closes it and returns focus to the card', await page.evaluate(() => !document.getElementById('viewer').open && document.activeElement.classList.contains('scan-card')));

    await page.focus('#reset'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('confirm').open);
    check('Reset asks for confirmation; Cancel is focused by default', (await page.textContent('#confirm-title')) === 'Delete all scans?' && (await active()).text === 'Cancel');
    await page.keyboard.press('Escape');
    check('Esc cancels without deleting', (await page.textContent('#count')) === '1 scan');

    // Targets and zoom, with the adjust view visible
    await page.click('[data-sample="samples/receipt.jpg"]');
    await page.waitForFunction(() => document.activeElement.classList.contains('handle'), null, { timeout: 30000 });
    const small = await page.$$eval('button, a.btn, .segmented label', (els) => els.filter((b) => b.offsetParent && (b.getBoundingClientRect().width < 44 || b.getBoundingClientRect().height < 44)).map((b) => b.textContent.trim() || b.className));
    check('every visible button and toggle is at least 44x44 px', small.length === 0, small.length ? JSON.stringify(small) : '');
    const minFont = await page.$$eval('body *', (els) => Math.min(...els.filter((e) => e.offsetParent && e.childNodes[0]?.nodeType === 3 && e.textContent.trim()).map((e) => parseFloat(getComputedStyle(e).fontSize))));
    check('no text smaller than 11 px', minFont >= 11, `(smallest ${minFont} px)`);
    await page.setViewportSize({ width: 640, height: 900 });       // 1280 px at 200 % zoom
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && document.getElementById('save').getBoundingClientRect().width > 0);
    check('usable at 200 % zoom (no horizontal scrolling)', fits);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    check('Reduce Motion: motion token drops to 0 ms', (await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dur').trim())) === '0ms');
  } catch (e) {
    console.error(e); fails++;
  } finally {
    await browser.close();
    if (proc) proc.kill();
  }
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})();
