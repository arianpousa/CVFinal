// mat-delete-demo.mjs: shows WHY every cv.Mat needs delete().
// Source: "You have to call delete method of cv.Mat to free memory allocated in
// Emscripten's heap." https://docs.opencv.org/4.x/d0/d84/tutorial_js_usage.html
// Run: node mat-delete-demo.mjs   (needs @techstark/opencv-js@4.10.0-release.1 installed)
import { createRequire } from 'node:module';
const cv = createRequire(import.meta.url)('@techstark/opencv-js');
await new Promise((r) => (cv.Mat ? r() : (cv.onRuntimeInitialized = () => r())));

const MiB = () => (cv.HEAP8.length / 2 ** 20).toFixed(0) + ' MiB';
const frame = () => new cv.Mat(1080, 1920, cv.CV_8UC4, new cv.Scalar(200, 200, 200, 255)); // ~8 MB

// BAD: creates Mats and never frees them. The JS GC can't see the C++ buffers.
function leakyGray() {
  const src = frame(); const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  return gray.rows;                 // src and gray leak
}

// GOOD: try/finally frees every Mat even if an exception is thrown.
function cleanGray() {
  const src = frame(); const gray = new cv.Mat();
  try { cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY); return gray.rows; }
  finally { src.delete(); gray.delete(); }
}

console.log('start heap      ', MiB());
for (let i = 0; i < 30; i++) cleanGray();
console.log('after 30 clean  ', MiB(), '(stable)');
const before = cv.HEAP8.length;
for (let i = 0; i < 30; i++) leakyGray();
console.log('after 30 leaky  ', MiB(), cv.HEAP8.length > before ? '(GREW: leak!)' : '');
process.exit(cv.HEAP8.length > before ? 0 : 1);   // demo succeeds when the leak is visible
