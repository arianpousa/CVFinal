// pipeline.test.mjs: proves src/scanner-pipeline.js on a synthetic page AND on both real sample photos.
// Run (from tests/): npm install && node unit/pipeline.test.mjs
// OpenCV.js comes from @techstark/opencv-js@4.10.0-release.1, a repackaged official 4.10.0 build
// (the same file the app self-hosts as vendor/opencv-4.10.0.js). JPEGs are decoded with jpeg-js
// because this OpenCV.js build has no imgcodecs (cv.imdecode is undefined).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const { detectPage, processScan, orderCorners, pageSize } = require(path.join(root, 'src/scanner-pipeline.js'));
const cv = require('@techstark/opencv-js');
const jpeg = require('jpeg-js');

// GOTCHA (knowledge/opencv-expert/docs/01): the module is a thenable. Never `await cv` / resolve(cv).
await new Promise((r) => (cv.Mat ? r() : (cv.onRuntimeInitialized = () => r())));

let failures = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) failures++; };
const isBW = (o) => { for (let i = 0; i < o.data.length; i += 4) if (o.data[i] !== 0 && o.data[i] !== 255) return false; return true; };
const whiteRatio = (o) => { let w = 0; for (let i = 0; i < o.data.length; i += 4) if (o.data[i] === 255) w++; return w / (o.width * o.height); };

// ---------- 1) synthetic page (the recorded knowledge-folder checks) ----------
const W = 800, H = 600;
const page = [{ x: 150, y: 90 }, { x: 640, y: 130 }, { x: 600, y: 520 }, { x: 120, y: 480 }];
function makePhoto() {
  const img = new cv.Mat(H, W, cv.CV_8UC4, new cv.Scalar(40, 40, 40, 255));
  const pts = cv.matFromArray(4, 1, cv.CV_32SC2, page.flatMap((p) => [p.x, p.y]));
  const vec = new cv.MatVector(); vec.push_back(pts);
  cv.fillPoly(img, vec, new cv.Scalar(230, 230, 230, 255));
  for (let y = 180; y < 440; y += 40) cv.line(img, new cv.Point(220, y), new cv.Point(540, y + 10), new cv.Scalar(30, 30, 30, 255), 4);
  const out = { data: new Uint8ClampedArray(img.data), width: W, height: H };
  img.delete(); pts.delete(); vec.delete();
  return out;
}
const photo = makePhoto();
check('orderCorners returns TL,TR,BR,BL', JSON.stringify(orderCorners([page[2], page[0], page[3], page[1]])) === JSON.stringify(page));
const det = detectPage(cv, photo);
const synErr = Math.max(...det.corners.map((c, k) => Math.hypot(c.x - page[k].x, c.y - page[k].y)));
check('synthetic: page found by Canny strategy', det.found && det.method === 'canny');
check('synthetic: corners within 8 px', synErr <= 8, `(max error ${synErr.toFixed(1)} px)`);
const blank = { data: new Uint8ClampedArray(W * H * 4).fill(128), width: W, height: H };
const none = detectPage(cv, blank);
check('blank image falls back to full frame', !none.found && none.method === 'none' && none.corners[2].x === W - 1 && none.corners[2].y === H - 1);
const forced = detectPage(cv, photo, { cannyLow: 5000, cannyHigh: 9000 });   // Canny finds nothing -> Otsu fallback
const otsuErr = Math.max(...forced.corners.map((c, k) => Math.hypot(c.x - page[k].x, c.y - page[k].y)));
check('Otsu fallback finds the page when Canny cannot', forced.found && forced.method === 'otsu' && otsuErr <= 8, `(${forced.method}, max error ${otsuErr.toFixed(1)} px)`);
const out = processScan(cv, photo, det.corners, 'bw');
check('synthetic: warped size ~ page size', Math.abs(out.width - 490) < 12 && Math.abs(out.height - 400) < 12, `(${out.width}x${out.height})`);
check('synthetic: B&W output only 0/255, mostly white', isBW(out) && whiteRatio(out) > 0.8, `(${(whiteRatio(out) * 100).toFixed(1)} % white)`);
const flat = pageSize([{ x: 0, y: 0 }, { x: 99, y: 0 }, { x: 99, y: 199 }, { x: 0, y: 199 }], 100, 200);
check('pageSize: a straight-on page keeps its size', flat.W === 99 && flat.H === 199, `(${flat.W}x${flat.H})`);
for (const mode of ['color', 'gray']) {
  const o = processScan(cv, photo, det.corners, mode);
  check(`${mode} mode returns RGBA`, o.data.length === o.width * o.height * 4);
}

// ---------- 2) the two real sample photos, exactly as the app runs them ----------
// The app detects on a copy whose long side is 1000 px, scales the corners back up, and warps the full image.
function loadJpeg(file, maxSide) {
  const raw = jpeg.decode(fs.readFileSync(file), { useTArray: true, formatAsRGBA: true });
  const s = Math.min(1, maxSide / Math.max(raw.width, raw.height));
  const src = cv.matFromImageData({ data: new Uint8ClampedArray(raw.data.buffer), width: raw.width, height: raw.height });
  const dst = new cv.Mat();
  try {
    cv.resize(src, dst, new cv.Size(Math.round(raw.width * s), Math.round(raw.height * s)), 0, 0, cv.INTER_AREA);
    return { img: { data: new Uint8ClampedArray(dst.data), width: dst.cols, height: dst.rows }, scale: s };
  } finally { src.delete(); dst.delete(); }
}
const truth = JSON.parse(fs.readFileSync(path.join(root, 'samples/truth.json'), 'utf8'));
const outDir = path.join(here, '../output'); fs.mkdirSync(outDir, { recursive: true });
const samples = {};
for (const name of ['receipt.jpg', 'letter.jpg']) {
  const file = path.join(root, 'samples', name);
  const small = loadJpeg(file, 1000);
  const full = loadJpeg(file, 4000);
  const d = detectPage(cv, small.img);
  const k = full.scale / small.scale;
  const corners = d.corners.map((c) => ({ x: c.x * k, y: c.y * k }));
  const t = truth[name].corners.map(([x, y]) => ({ x: x * full.scale, y: y * full.scale }));
  const err = Math.max(...corners.map((c, i) => Math.hypot(c.x - t[i].x, c.y - t[i].y)));
  const diag = Math.hypot(full.img.width, full.img.height);
  check(`${name}: page found`, d.found, `(${d.method})`);
  check(`${name}: corners within 1 % of the photo diagonal`, err <= 0.01 * diag, `(max error ${err.toFixed(1)} px of ${diag.toFixed(0)})`);
  const o = processScan(cv, full.img, corners, 'bw');
  const ratio = o.height / o.width, want = truth[name].page_aspect;
  check(`${name}: flattened with the true page shape (height/width)`, Math.abs(ratio / want - 1) < 0.06, `(${o.width}x${o.height}, ${ratio.toFixed(3)} vs true ${want.toFixed(3)})`);
  check(`${name}: crisp B&W, mostly white paper with ink`, isBW(o) && whiteRatio(o) > 0.85 && whiteRatio(o) < 0.995, `(${(whiteRatio(o) * 100).toFixed(1)} % white)`);
  let edgeDark = 0, edgeN = 0;
  for (let x = 0; x < o.width; x++) for (const y of [0, 1, o.height - 2, o.height - 1]) { edgeN++; if (o.data[(y * o.width + x) * 4] === 0) edgeDark++; }
  for (let y = 0; y < o.height; y++) for (const x of [0, 1, o.width - 2, o.width - 1]) { edgeN++; if (o.data[(y * o.width + x) * 4] === 0) edgeDark++; }
  check(`${name}: clean page border (no black edge ticks)`, edgeDark / edgeN < 0.01, `(${(100 * edgeDark / edgeN).toFixed(2)} % dark)`);
  fs.writeFileSync(path.join(outDir, name.replace('.jpg', '-scan.jpg')), Buffer.from(jpeg.encode({ data: Buffer.from(o.data.buffer), width: o.width, height: o.height }, 85).data));
  samples[name] = { small, full, corners };
}

// ---------- 3) leak test: no Wasm heap growth (every Mat deleted) ----------
// Warm up once so the allocator has grown to its working size, then measure.
const heapBefore = cv.HEAP8.length;
for (let i = 0; i < 200; i++) { const d = detectPage(cv, photo); processScan(cv, photo, d.corners, 'bw'); detectPage(cv, blank); }
for (let i = 0; i < 10; i++) for (const s of Object.values(samples)) { detectPage(cv, s.small.img); processScan(cv, s.full.img, s.corners, 'bw'); }
const heapAfter = cv.HEAP8.length;
check('no Wasm heap growth over 400 synthetic + 20 full-size sample scans', heapAfter === heapBefore, `(${(heapBefore / 2 ** 20).toFixed(0)} MiB -> ${(heapAfter / 2 ** 20).toFixed(0)} MiB)`);

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
