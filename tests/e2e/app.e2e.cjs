// app.e2e.cjs: qa-tester (Quinn) acceptance run of the REAL app in Chrome, mapped to browser-testing-checklist.
// Adapted from knowledge/qa-tester/examples/smoke-test.cjs (10/10 on the smoke app).
//
// Usage (from tests/):
//   node e2e/app.e2e.cjs                         starts `python -m http.server` on a free port at the repo root
//   node e2e/app.e2e.cjs http://localhost:8080/  uses a server you started yourself
//   node e2e/app.e2e.cjs https://<site>.netlify.app/   the live site (upgrade tests use route overrides, still safe)
// Env: PW_CHANNEL=chrome to use Google Chrome instead of Playwright's Chromium.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

const ROOT = path.resolve(__dirname, '../..');
const SHOTS = path.join(ROOT, 'docs/screenshots');
const truth = JSON.parse(fs.readFileSync(path.join(ROOT, 'samples/truth.json'), 'utf8'));
let fails = 0, passes = 0;
const results = [];
const check = (n, ok, x = '') => { const line = `${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`; console.log(line); results.push(line); ok ? passes++ : fails++; };

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
async function startServer() {
  const port = await freePort();
  for (const py of process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']) {
    try {
      const proc = spawn(py, ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
      await new Promise((r, j) => { proc.once('error', j); setTimeout(r, 800); });
      return { url: `http://localhost:${port}/`, proc };
    } catch { /* try the next name */ }
  }
  throw new Error('Could not start python -m http.server');
}

const READY = () => /Ready/.test(document.getElementById('status').textContent);

(async () => {
  let server = null;
  let baseUrl = process.argv[2];
  if (!baseUrl) { server = await startServer(); baseUrl = server.url; }
  console.log('Testing', baseUrl);
  const browser = await chromium.launch({
    channel: process.env.PW_CHANNEL || undefined,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  const errors = [];
  const watch = (page, label) => {
    page.on('console', (m) => m.type() === 'error' && errors.push(`${label}: ${m.text()}`));
    page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  };
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['camera'] });
    let opencvRequests = 0;
    await ctx.route(/\/vendor\/opencv-4\.10\.0\.js$/, (route) => { opencvRequests++; route.continue(); });
    const page = await ctx.newPage();
    watch(page, 'main');

    // ---- #2 OpenCV loads once, in the worker, and the status reaches Ready ----
    const t0 = Date.now();
    await page.goto(baseUrl);
    const sawLoading = /Loading scanner/.test(await page.textContent('#status'));
    await page.waitForFunction(READY, null, { timeout: 60000 });
    const info = await page.evaluate(() => window.__docscanner.state.info);
    check('#2 status goes "Loading scanner…" -> "Ready" (OpenCV.js in the worker)', sawLoading, `(${Date.now() - t0} ms, OpenCV ${info.version}, worker load ${info.loadMs} ms)`);
    check('#2 opencv.js requested exactly once', opencvRequests === 1, `(${opencvRequests})`);
    check('#2 no OpenCV on the main thread (window.cv undefined)', await page.evaluate(() => typeof window.cv === 'undefined'));
    await page.waitForSelector('#empty-sample', { state: 'visible', timeout: 10000 });
    check('empty library shows a next step', true);

    // Heartbeat: a 16 ms timer on the main thread must never stall (#4 no freeze)
    const startHeartbeat = () => page.evaluate(() => { window.__gaps = []; let last = performance.now(); window.__hb = setInterval(() => { const n = performance.now(); window.__gaps.push(n - last); last = n; }, 16); });
    const stopHeartbeat = () => page.evaluate(() => { clearInterval(window.__hb); return Math.max(...window.__gaps); });

    // Helper: scan one sample through the real UI and save it.
    async function scanSample(file, { shots = false } = {}) {
      await page.evaluate(() => { document.getElementById('adjust-msg').textContent = ''; document.getElementById('preview').width = 0; });
      await page.click(`[data-sample="samples/${file}"]`);
      await page.waitForFunction(() => /Page found|Couldn/.test(document.getElementById('adjust-msg').textContent), null, { timeout: 30000 });
      await page.waitForFunction(() => document.getElementById('preview').width > 0 && !document.getElementById('preview-box').hasAttribute('aria-busy'), null, { timeout: 30000 });
      const st = await page.evaluate(() => window.__docscanner.state);
      if (shots) await page.screenshot({ path: path.join(SHOTS, `adjust-${file.replace('.jpg', '')}.png`) });
      await page.click('#save');
      await page.waitForFunction(() => /Saved to Library/.test(document.getElementById('capture-msg').textContent), null, { timeout: 30000 });
      await page.evaluate(() => { document.getElementById('capture-msg').textContent = ''; });
      return st;
    }

    // ---- #3 CV feature on BOTH sample photos ----
    await startHeartbeat();
    for (const file of ['receipt.jpg', 'letter.jpg']) {
      const st = await scanSample(file, { shots: true });
      const t = truth[file];
      const diag = Math.hypot(t.width, t.height);
      const err = Math.max(...st.corners.map((c, i) => Math.hypot(c.x - t.corners[i][0], c.y - t.corners[i][1])));
      check(`#3 ${file}: corners found`, st.found, `(max error ${err.toFixed(1)} px, ${(100 * err / diag).toFixed(2)} % of diagonal)`);
      check(`#3 ${file}: corners within 1 % of the photo diagonal`, err <= 0.01 * diag);
    }
    // Inspect what was saved: original blob is the exact file, result is flat and pure black & white.
    const saved = await page.evaluate(async () => {
      const DB = await import('./src/db.js');
      const db = await DB.openDB();
      const scans = await DB.listScans(db);
      const out = [];
      for (const s of scans) {
        const imgs = await DB.getImages(db, s.id);
        const bmp = await createImageBitmap(imgs.result);
        const c = new OffscreenCanvas(bmp.width, bmp.height); c.getContext('2d').drawImage(bmp, 0, 0);
        const d = c.getContext('2d').getImageData(0, 0, bmp.width, bmp.height).data;
        let bw = true, white = 0;
        for (let i = 0; i < d.length; i += 4) { if (d[i] !== 0 && d[i] !== 255) { bw = false; break; } if (d[i] === 255) white++; }
        out.push({ name: s.name, w: bmp.width, h: bmp.height, bw, white: white / (bmp.width * bmp.height), origSize: imgs.original.size, origType: imgs.original.type, resultType: imgs.result.type, createdAt: s.createdAt });
      }
      db.close();
      return out;
    });
    for (const file of ['receipt.jpg', 'letter.jpg']) {
      const s = saved.find((x) => x.name.toLowerCase().startsWith(file.split('.')[0]));
      const want = truth[file].page_aspect, ratio = s.h / s.w;
      check(`#3 ${file}: flattened to the true page shape`, Math.abs(ratio / want - 1) < 0.06, `(${s.w}x${s.h}, h/w ${ratio.toFixed(3)} vs ${want.toFixed(3)})`);
      check(`#3 ${file}: result is crisp black & white`, s.bw && s.white > 0.85 && s.white < 0.995, `(${(s.white * 100).toFixed(1)} % white)`);
      check(`IndexedDB ${file}: original stored as the exact file + result as PNG, with name and date`, s.origSize === fs.statSync(path.join(ROOT, 'samples', file)).size && s.origType === 'image/jpeg' && s.resultType === 'image/png' && s.createdAt > 0, `(${s.origSize} B original)`);
    }

    // ---- #5 Mats deleted: 20 more full-size scans, the worker's Wasm heap must not grow ----
    const heap0 = await page.evaluate(() => window.__docscanner.heap());
    const tLoop = Date.now();
    for (let i = 0; i < 10; i++) { await scanSample('receipt.jpg'); await scanSample('letter.jpg'); }
    const heap1 = await page.evaluate(() => window.__docscanner.heap());
    const maxGap = await stopHeartbeat();
    check('#5 worker Wasm heap stable over 20 more scans (every cv.Mat deleted)', heap1 === heap0, `(${heap0 / 2 ** 20} MiB -> ${heap1 / 2 ** 20} MiB, ${((Date.now() - tLoop) / 20).toFixed(0)} ms per scan incl. UI)`);
    check('#4 main thread never froze during 22 scans', maxGap < 250, `(longest heartbeat gap ${maxGap.toFixed(0)} ms)`);
    check('worker never respawned (no hangs)', (await page.evaluate(() => window.__docscanner.state.respawns)) === 0);

    // ---- #6 persistence across a hard reload ----
    const before = await page.textContent('#count');
    await page.reload();
    await page.waitForFunction(READY, null, { timeout: 60000 });
    await page.waitForFunction(() => document.querySelectorAll('#grid .scan-card').length > 0);
    const after = await page.textContent('#count');
    check('#6 scans persist after reload (IndexedDB)', before === '22 scans' && after === '22 scans', `(${before} -> ${after})`);
    check('#6 opencv.js still loaded once per page load (2 loads total)', opencvRequests === 2, `(${opencvRequests})`);

    // ---- viewer shows original + result after reload ----
    await page.click('#grid .scan-card');
    await page.waitForFunction(() => document.getElementById('viewer').open && document.getElementById('viewer-original').naturalWidth > 0 && document.getElementById('viewer-result').naturalWidth > 0);
    const dims = await page.evaluate(() => [document.getElementById('viewer-original').naturalWidth, document.getElementById('viewer-result').naturalWidth]);
    check('viewer shows the original photo and the scan after reload', dims[0] > dims[1] && dims[1] > 0, `(original ${dims[0]} px wide, scan ${dims[1]} px wide)`);
    await page.fill('#viewer-name', 'Renamed letter');
    await page.click('#rename');
    await page.waitForFunction(() => /Renamed/.test(document.getElementById('capture-msg').textContent), null, { timeout: 10000 });
    await page.keyboard.press('Escape');
    const renamed = await page.evaluate(async () => { const DB = await import('./src/db.js'); const db = await DB.openDB(); const n = (await DB.listScans(db))[0].name; db.close(); return n; });
    check('rename persists (UI and IndexedDB)', (await page.textContent('#grid')).includes('Renamed letter') && renamed === 'Renamed letter');

    // ---- #7 DevTools view: database, version and stores ----
    const dbInfo = await page.evaluate(async () => {
      const dbs = (await indexedDB.databases()).map((d) => `${d.name}@v${d.version}`).join();
      const db = await new Promise((r) => { const q = indexedDB.open('docscanner'); q.onsuccess = () => r(q.result); });
      const stores = [...db.objectStoreNames].join();
      db.close();
      return { dbs, stores };
    });
    check('#7 docscanner@v1 with scans/blobs/settings/history (what DevTools shows)', dbInfo.dbs.includes('docscanner@v1') && dbInfo.stores === 'blobs,history,scans,settings', `(${dbInfo.dbs}: ${dbInfo.stores})`);

    // ---- screenshots for the README (light) ----
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(SHOTS, 'library-light.png') });

    // ---- edge cases: no page in the photo, very large photo, camera ----
    async function uploadGenerated(kind) {
      const b64 = await page.evaluate(async (kind) => {
        let c;
        if (kind === 'blank') {
          c = new OffscreenCanvas(1200, 900); const g = c.getContext('2d');
          g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, 1200, 900);
          for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`; g.fillRect(Math.random() * 1200, Math.random() * 900, 3, 3); }
        } else {
          const bmp = await createImageBitmap(await (await fetch('samples/letter.jpg')).blob());
          c = new OffscreenCanvas(4032, 3024); c.getContext('2d').drawImage(bmp, 0, 0, 4032, 3024);   // 12.2 MP
        }
        const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
        const buf = new Uint8Array(await blob.arrayBuffer()); let s = '';
        for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        return btoa(s);
      }, kind);
      await page.evaluate(() => { document.getElementById('adjust-msg').textContent = ''; document.getElementById('preview').width = 0; });
      await page.setInputFiles('#file', { name: `${kind}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
      await page.waitForFunction(() => /Page found|Couldn/.test(document.getElementById('adjust-msg').textContent), null, { timeout: 60000 });
      return page.evaluate(() => ({ found: window.__docscanner.state.found, msg: document.getElementById('adjust-msg').textContent, c: window.__docscanner.state.corners }));
    }
    const blank = await uploadGenerated('blank');
    check('edge: no page in photo -> full-frame corners + how-to-fix message', !blank.found && /Drag the corners/.test(blank.msg) && blank.c[2].x === 1199);
    await page.click('#retake');
    await startHeartbeat();
    const big = await uploadGenerated('big');
    await page.waitForFunction(() => !document.getElementById('preview-box').hasAttribute('aria-busy') && document.getElementById('preview').width > 0, null, { timeout: 60000 });
    await page.click('#save');
    await page.waitForFunction(() => /Saved to Library/.test(document.getElementById('capture-msg').textContent), null, { timeout: 60000 });
    const bigGap = await stopHeartbeat();
    check('edge: 12 MP photo detected and saved (capped to 4000 px)', big.found, `(longest main-thread gap ${bigGap.toFixed(0)} ms)`);

    await page.click('#camera');
    await page.waitForFunction(() => document.getElementById('video').videoWidth > 0, null, { timeout: 15000 });
    await page.click('#shoot');
    await page.waitForFunction(() => /Page found|Couldn/.test(document.getElementById('adjust-msg').textContent), null, { timeout: 30000 });
    const camOff = await page.evaluate(() => document.getElementById('video').srcObject === null);
    check('#10 camera: Use camera -> Take photo -> Adjust, camera released', camOff && !(await page.isHidden('#adjust-card')));
    await page.click('#retake');

    const denied = await ctx.newPage(); watch(denied, 'denied');
    await denied.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError')); });
    await denied.goto(baseUrl);
    await denied.click('#camera');
    await denied.waitForFunction(() => /Camera access is off/.test(document.getElementById('capture-msg').textContent));
    check('#10 camera denied -> clear fallback copy, focus on Upload photo', await denied.evaluate(() => document.activeElement.id === 'upload'));
    await denied.close();

    // ---- #9 pages are linked from the app and load ----
    for (const [text, file, h1] of [['How it works', 'how-it-works.html', 'How it works'], ['Resources', 'resources.html', 'Resources']]) {
      await page.click(`.topbar >> text=${text}`);
      await page.waitForURL(`**/${file}`);
      check(`#9 "${text}" linked from the app and loads`, (await page.textContent('h1')).trim() === h1);
      await page.goBack();
      await page.waitForFunction(READY, null, { timeout: 60000 });
    }
    const linkCount = await (async () => { const p = await ctx.newPage(); watch(p, 'resources'); await p.goto(baseUrl + 'resources.html'); const n = await p.$$eval('main a[href^="https://"]', (a) => a.length); await p.close(); return n; })();
    check('#9 Resources lists the official links', linkCount >= 30, `(${linkCount} external links)`);
    const anchor = await (async () => { const p = await ctx.newPage(); await p.goto(baseUrl + 'how-it-works.html#troubleshooting'); const ok = await p.isVisible('#troubleshooting'); await p.close(); return ok; })();
    check('#9 the error banner\'s Troubleshooting link target exists', anchor);

    // ---- dark-mode screenshots ----
    const dark = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
    // share the same origin storage? (separate context = separate storage) -> seed it with one scan through the UI
    const dp = await dark.newPage(); watch(dp, 'dark');
    await dp.goto(baseUrl); await dp.waitForFunction(READY, null, { timeout: 60000 });
    await dp.screenshot({ path: path.join(SHOTS, 'empty-dark.png') });
    for (const f of ['letter.jpg', 'receipt.jpg']) {
      await dp.evaluate(() => { document.getElementById('adjust-msg').textContent = ''; });
      await dp.click(`[data-sample="samples/${f}"]`);
      await dp.waitForFunction(() => !document.getElementById('adjust-card').hidden && /Page found/.test(document.getElementById('adjust-msg').textContent), null, { timeout: 30000 });
      await dp.waitForTimeout(600);   // debounce + preview render
      await dp.waitForFunction(() => !document.getElementById('preview-box').hasAttribute('aria-busy'), null, { timeout: 30000 });
      if (f === 'receipt.jpg') await dp.screenshot({ path: path.join(SHOTS, 'adjust-dark.png') });
      await dp.click('#save');
      await dp.waitForFunction(() => /Saved/.test(document.getElementById('capture-msg').textContent));
    }
    await dp.evaluate(() => window.scrollTo(0, 0));
    await dp.screenshot({ path: path.join(SHOTS, 'library-dark.png') });
    await dp.click('#grid .scan-card');
    await dp.waitForFunction(() => document.getElementById('viewer-result').naturalWidth > 0);
    await dp.screenshot({ path: path.join(SHOTS, 'viewer-dark.png') });
    await dark.close();

    // ---- #8 Reset app data ----
    await page.click('#reset');
    await page.click('#confirm-ok');
    await page.waitForLoadState('load');
    await page.waitForFunction(READY, null, { timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('count').textContent === '0 scans');
    const fresh = await page.evaluate(async () => { const db = await new Promise((r) => { const q = indexedDB.open('docscanner'); q.onsuccess = () => r(q.result); }); const n = await new Promise((r) => { const q = db.transaction('scans').objectStore('scans').count(); q.onsuccess = () => r(q.result); }); db.close(); return n; });
    check('#8 Reset app data empties Library and DB, app reloads to Ready', fresh === 0 && await page.isVisible('#empty-sample'));

    // ---- blocked upgrade / outdated tab / stale tab (simulates a new deploy with DB_VERSION 2 and 3) ----
    await scanSample('receipt.jpg');                         // one scan the upgrades must keep
    const withVersion = (v) => async (route) => {
      const res = await route.fetch();
      route.fulfill({ response: res, body: (await res.text()).replace('export const DB_VERSION = 1;', `export const DB_VERSION = ${v};`) });
    };
    // (a) a newer version opens in another tab: the old tab closes its connection and says so
    const v2 = await ctx.newPage(); watch(v2, 'v2');
    await v2.route(/\/src\/db\.js$/, withVersion(2));
    await v2.goto(baseUrl);
    await v2.waitForFunction(() => document.getElementById('count').textContent === '1 scan', null, { timeout: 30000 });
    await page.waitForFunction(() => /updated in another tab/.test(document.getElementById('banner-text').textContent) && !document.getElementById('banner').hidden, null, { timeout: 10000 });
    check('upgrade: old tab gets onversionchange, closes and shows "Reload"', true);
    check('upgrade: v2 tab upgraded in place and kept the scan', (await v2.evaluate(async () => (await indexedDB.databases()).find((d) => d.name === 'docscanner').version)) === 2);
    // (b) a tab that ignores versionchange blocks the next upgrade -> "Close other tabs…" until it closes
    const stubborn = await ctx.newPage();
    await stubborn.goto(baseUrl + 'resources.html');
    await stubborn.evaluate(() => new Promise((r) => { const q = indexedDB.open('docscanner', 2); q.onsuccess = () => { window.__held = q.result; r(); }; }));   // no onversionchange handler
    await v2.close();
    const v3 = await ctx.newPage(); watch(v3, 'v3');
    await v3.route(/\/src\/db\.js$/, withVersion(3));
    await v3.goto(baseUrl);
    await v3.waitForFunction(() => /Close other tabs of this app to finish updating/.test(document.getElementById('banner-text').textContent) && !document.getElementById('banner').hidden, null, { timeout: 15000 });
    check('blocked upgrade: onblocked shows "Close other tabs of this app to finish updating."', true);
    check('blocked upgrade: library says "Opening library…", not "No scans yet"', (await v3.textContent('#count')) === 'Opening library…' && await v3.isHidden('#empty'));
    await v3.screenshot({ path: path.join(SHOTS, 'blocked-upgrade.png') });
    await stubborn.close();                                  // the user closes the other tab
    await v3.waitForFunction(() => document.getElementById('banner').hidden && document.getElementById('count').textContent === '1 scan', null, { timeout: 15000 });
    check('blocked upgrade: finishes by itself once the other tab closes, data kept (v3)', (await v3.evaluate(async () => (await indexedDB.databases()).find((d) => d.name === 'docscanner').version)) === 3);
    // (c) a stale tab still running the v1 code now gets VersionError -> clear message; Reset still works
    const stale = await ctx.newPage(); watch(stale, 'stale');
    await stale.goto(baseUrl);
    await stale.waitForFunction(() => /out of date/.test(document.getElementById('banner-text').textContent), null, { timeout: 15000 });
    check('stale tab (VersionError) shows "This page is out of date. Reload…"', true);
    await v3.close(); await page.close();
    await stale.click('#reset'); await stale.click('#confirm-ok');
    await stale.waitForLoadState('load');
    await stale.waitForFunction(() => document.getElementById('count').textContent === '0 scans' && document.getElementById('banner').hidden, null, { timeout: 30000 });
    check('Reset app data recovers a stuck/stale database (back to a fresh v1)', (await stale.evaluate(async () => (await indexedDB.databases()).find((d) => d.name === 'docscanner').version)) === 1);
    await stale.close();

    // ---- #1 clean console ----
    check('#1 no console errors on any page', errors.length === 0, errors.length ? JSON.stringify(errors.slice(0, 5)) : '');
    await ctx.close();
  } catch (e) {
    console.error(e);
    check('test run completed without exceptions', false, e.message);
  } finally {
    await browser.close();
    if (server) server.proc.kill();
  }
  console.log(`\n${passes} passed, ${fails} failed`);
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
