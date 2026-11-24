// smoke-test.cjs: the qa-tester's acceptance run, automated in real Chrome with Playwright.
// Maps to the rubric: OpenCV loads once (Ready), real CV result, no main-thread freeze,
// no Mat leak, IndexedDB persists across reload, Reset works, no console errors.
//
// Usage:
//   node smoke-test.cjs <baseUrl> [path/to/opencv.js]
//   e.g. serve smoke-app/ locally:  python -m http.server 8080 --directory smoke-app
//        node smoke-test.cjs http://localhost:8080/ ./opencv.js
//   or against the live site:      node smoke-test.cjs https://<site>.netlify.app/
// When an opencv.js path is given, requests to */vendor/opencv*.js are served from it.
const { chromium } = require('playwright');
const fs = require('fs');

const [baseUrl = 'http://localhost:8080/', opencvPath] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let fails = 0;
  const check = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!ok) fails++; };
  const errors = []; page.on('console', (m) => m.type() === 'error' && errors.push(m.text())); page.on('pageerror', (e) => errors.push(e.message));
  let opencvRequests = 0;
  await ctx.route(/\/vendor\/opencv[^/]*\.js$/, async (route) => {
    opencvRequests++;
    if (opencvPath) return route.fulfill({ body: fs.readFileSync(opencvPath), contentType: 'application/javascript' });
    return route.continue();
  });

  // 1) loads and reaches Ready
  const t0 = Date.now();
  await page.goto(baseUrl);
  await page.waitForFunction(() => /Ready/.test(document.getElementById('status').textContent), null, { timeout: 30000 });
  check('status reaches "Ready" (OpenCV.js loaded in the worker)', true, `(${Date.now() - t0} ms)`);
  check('opencv.js requested exactly once', opencvRequests === 1, `(${opencvRequests})`);

  // 2) real CV + 3) no freeze: a 16 ms heartbeat on the main thread must never stall
  await page.evaluate(() => { window.__gaps = []; let last = performance.now(); window.__hb = setInterval(() => { const n = performance.now(); window.__gaps.push(n - last); last = n; }, 16); });
  const r = await page.evaluate(() => window.__scanOnce());
  check('page detected and flattened', r.found && Math.abs(r.width - 490) < 15 && Math.abs(r.height - 400) < 15, `(${r.width}x${r.height})`);
  const bw = await page.evaluate(() => { const c = document.getElementById('out'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 4) if (d[i] !== 0 && d[i] !== 255) return false; return true; });
  check('output is crisp black & white', bw);

  const heaps = [];
  for (let i = 0; i < 20; i++) heaps.push((await page.evaluate(() => window.__scanOnce())).heap);
  const maxGap = await page.evaluate(() => { clearInterval(window.__hb); return Math.max(...window.__gaps); });
  check('main thread never froze during 21 scans', maxGap < 250, `(longest heartbeat gap ${maxGap.toFixed(0)} ms)`);
  check('worker Wasm heap stable over 20 scans (Mats deleted)', heaps[19] === heaps[0], `(${heaps[0] / 2 ** 20} MiB -> ${heaps[19] / 2 ** 20} MiB)`);

  // 4) persistence across refresh
  const before = Number(await page.textContent('#count'));
  await page.reload();
  await page.waitForFunction(() => /Ready/.test(document.getElementById('status').textContent));
  const after = Number(await page.textContent('#count'));
  check('scans persist after refresh (IndexedDB)', before === 21 && after === 21, `(${before} -> ${after})`);
  const dbInfo = await page.evaluate(async () => (await indexedDB.databases()).map((d) => `${d.name}@v${d.version}`).join());
  check('database visible to DevTools (indexedDB.databases)', dbInfo.includes('docscanner@v1'), `(${dbInfo})`);

  // 5) Reset app data
  await Promise.all([page.waitForNavigation(), page.click('#reset')]);
  await page.waitForFunction(() => /Ready/.test(document.getElementById('status').textContent));
  check('Reset app data empties the library', Number(await page.textContent('#count')) === 0);

  // 6) clean console
  check('no console errors', errors.length === 0, errors.length ? JSON.stringify(errors.slice(0, 3)) : '');

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})();
