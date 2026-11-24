// capture-test.cjs: proves capture.js in real Chrome.
// Uses Chrome's fake camera (--use-fake-device-for-media-stream) and a real PNG upload.
// Run (from this folder): python -m http.server 8766   then   node capture-test.cjs
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8766/capture-demo.html';
const PNG = path.join(__dirname, '../../ui-designer-apple-liquid-glass/examples/screenshot-light.png'); // 760x760

(async () => {
  let fails = 0;
  const check = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!ok) fails++; };
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });

  // Camera allowed
  const ctx = await browser.newContext({ permissions: ['camera'] });
  const page = await ctx.newPage();
  await page.goto(BASE);

  check('fitScale never upscales and caps the long side',
    await page.evaluate(() => __C.fitScale(800, 600, 1000) === 1 && __C.fitScale(4000, 3000, 1000) === 0.25));

  await page.setInputFiles('#file', PNG);
  await page.waitForFunction(() => window.__last);
  const up = await page.evaluate(() => [__last.width, __last.height]);
  check('upload → canvas with the image size', up[0] === 760 && up[1] === 760, `(${up})`);

  const det = await page.evaluate(() => { const big = document.createElement('canvas'); big.width = 4000; big.height = 3000;
    const { imageData, scale } = __C.detectionInput(big); return [imageData.width, imageData.height, scale]; });
  check('detection copy is 1000px long side with scale factor', det[0] === 1000 && det[1] === 750 && det[2] === 4, `(${det})`);

  const blobs = await page.evaluate(async () => { const p = await __C.canvasToBlob(__last); const t = await __C.thumbnailBlob(__last); return [p.type, t.type, p.size > t.size]; });
  check('PNG scan + smaller JPEG thumbnail', blobs[0] === 'image/png' && blobs[1] === 'image/jpeg' && blobs[2], `(${blobs})`);

  await page.click('#cam');
  await page.waitForFunction(() => /Camera on/.test(document.getElementById('msg').textContent));
  await page.waitForFunction(() => document.getElementById('video').videoWidth > 0);
  await page.click('#shot');
  const shot = await page.evaluate(() => [__last.width, __last.height, __trackStates.join()]);
  check('camera frame captured', shot[0] > 0 && shot[1] > 0, `(${shot[0]}x${shot[1]})`);
  check('camera released after capture (tracks ended)', shot[2] === 'ended', `(${shot[2]})`);
  await ctx.close();

  // Camera denied → Wren's message, upload still works
  const ctx2 = await browser.newContext({ permissions: [] });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE);
  await p2.evaluate(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError')); });
  await p2.click('#cam');
  const msg = await p2.textContent('#msg');
  check('denied camera shows friendly fallback copy', msg === 'Camera access is off. You can upload a photo instead.', `("${msg}")`);
  await ctx2.close();

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})();
