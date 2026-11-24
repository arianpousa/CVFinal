// run-tests.mjs: proves scanner-pipeline.js works on a synthetic "photo of a page".
// Run:  npm i @techstark/opencv-js@4.10.0-release.1   (once, in any scratch folder)
//       node run-tests.mjs
// The npm package repackages the official https://docs.opencv.org/4.10.0/opencv.js build.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { detectPage, processScan, orderCorners } = require('./scanner-pipeline.js');

// Load OpenCV.js and wait until it's ready.
// GOTCHA (found while testing): the 4.10 module object is a *thenable* (it has .then).
// `await cv`, `resolve(cv)` or `return cv` from an async function re-enter .then forever
// and the program hangs. Wait for readiness with a promise that resolves with *nothing*,
// then use the module variable directly.
const cv = require('@techstark/opencv-js');
function cvReady() {
  return new Promise((resolve) => {
    if (cv.Mat) return resolve();
    cv.onRuntimeInitialized = () => resolve();   // never resolve(cv)
  });
}

let failures = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) failures++; };

await cvReady();
console.log('OpenCV.js', cv.getBuildInformation().match(/General configuration for OpenCV ([\d.]+)/)?.[1]);

// 1) Synthetic photo: dark desk (40), tilted white page (230) with dark "text" lines.
const W = 800, H = 600;
const page = [{ x: 150, y: 90 }, { x: 640, y: 130 }, { x: 600, y: 520 }, { x: 120, y: 480 }];
function makePhoto() {
  const img = new cv.Mat(H, W, cv.CV_8UC4, new cv.Scalar(40, 40, 40, 255));
  const pts = cv.matFromArray(4, 1, cv.CV_32SC2, page.flatMap((p) => [p.x, p.y]));
  const vec = new cv.MatVector();
  vec.push_back(pts);
  cv.fillPoly(img, vec, new cv.Scalar(230, 230, 230, 255));
  for (let y = 180; y < 440; y += 40) cv.line(img, new cv.Point(220, y), new cv.Point(540, y + 10), new cv.Scalar(30, 30, 30, 255), 4);
  const imageData = { data: new Uint8ClampedArray(img.data), width: W, height: H };
  img.delete(); pts.delete(); vec.delete();
  return imageData;
}
const photo = makePhoto();

// 2) Corner ordering is stable for shuffled input.
const shuffled = [page[2], page[0], page[3], page[1]];
check('orderCorners returns TL,TR,BR,BL', JSON.stringify(orderCorners(shuffled)) === JSON.stringify(page));

// 3) Detection finds the 4 page corners within 8 px.
const det = detectPage(cv, photo);
const maxErr = Math.max(...det.corners.map((c, k) => Math.hypot(c.x - page[k].x, c.y - page[k].y)));
check('detectPage found a 4-corner page', det.found);
check('detected corners within 8 px of truth', maxErr <= 8, `(max error ${maxErr.toFixed(1)} px)`);

// 4) Fallback on an empty image.
const blank = { data: new Uint8ClampedArray(W * H * 4).fill(128), width: W, height: H };
const none = detectPage(cv, blank);
check('blank image falls back to full frame', !none.found && none.corners[2].x === W - 1 && none.corners[2].y === H - 1);

// 5) Warp + B&W: output size matches the page, pixels are pure black/white.
const out = processScan(cv, photo, det.corners, 'bw');
const values = new Set(); for (let i = 0; i < out.data.length; i += 4) values.add(out.data[i]);
check('warped size ~ page size', Math.abs(out.width - 490) < 12 && Math.abs(out.height - 400) < 12, `(${out.width}x${out.height})`);
check('B&W output only contains 0 and 255', [...values].every((v) => v === 0 || v === 255), `(${[...values].join(',')})`);
let white = 0; for (let i = 0; i < out.data.length; i += 4) if (out.data[i] === 255) white++;
const whiteRatio = white / (out.width * out.height);
check('mostly white paper after cleanup', whiteRatio > 0.8, `(${(whiteRatio * 100).toFixed(1)} % white)`);

// 6) Color + gray modes keep 4 channels for ImageData.
for (const mode of ['color', 'gray']) {
  const o = processScan(cv, photo, det.corners, mode);
  check(`${mode} mode returns RGBA`, o.data.length === o.width * o.height * 4);
}

// 7) Leak test: 200 more runs must not grow the Wasm heap (all Mats deleted).
const heapBefore = cv.HEAP8.length;
for (let i = 0; i < 200; i++) { const d = detectPage(cv, photo); processScan(cv, photo, d.corners, 'bw'); }
const heapAfter = cv.HEAP8.length;
check('no Wasm heap growth over 200 scans', heapAfter === heapBefore, `(${(heapBefore / 2 ** 20).toFixed(0)} MiB -> ${(heapAfter / 2 ** 20).toFixed(0)} MiB)`);

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
