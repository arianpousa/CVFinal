// cv-worker.js: the OpenCV Web Worker (wasm-expert, Theo).
// Classic worker: loads the pinned, self-hosted OpenCV.js ONCE per worker lifetime with importScripts,
// then runs opencv-expert's pipeline (src/scanner-pipeline.js) off the main thread.
//
// Sources:
//   Using Web Workers (importScripts, postMessage):  https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
//   Transferable objects (zero-copy ArrayBuffers):    https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
//   Using OpenCV.js (Module.onRuntimeInitialized):    https://docs.opencv.org/4.x/d0/d84/tutorial_js_usage.html
//
// Protocol (main -> worker):  {id, type:'detect', imageData}            -> {id, type:'detected', found, corners, method, heapBytes}
//                             {id, type:'process', imageData, corners, mode} -> {id, type:'result', imageData, aspect, heapBytes}  (buffer transferred)
//                             {id, type:'stats'}                           -> {id, type:'stats', heapBytes}
// Worker -> main (unsolicited): {type:'ready', version, loadMs} once, or {type:'fatal', message}
// Errors in a job:              {id, type:'error', message}
'use strict';

const OPENCV_URL = 'vendor/opencv-4.10.0.js';   // pinned; upgrading = new file name (immutable cache)
const t0 = Date.now();
let ready = false;

function markReady() {
  if (ready) return;                             // the runtime callback and the thenable can both fire: post once
  // Review fix (opencv-expert): the runtime callback can fire while importScripts is still running,
  // before the UMD wrapper has assigned self.cv. Only mark ready once cv.Mat really exists, and never
  // let reading the version throw (that used to swallow the 'ready' message).
  if (!self.cv || !self.cv.Mat) { setTimeout(markReady, 0); return; }
  ready = true;
  let version = 'unknown';
  try {
    const m = /General configuration for OpenCV ([\d.]+)/.exec(self.cv.getBuildInformation());
    if (m) version = m[1];
  } catch (e) { /* version is informational only */ }
  postMessage({ type: 'ready', version: version, loadMs: Date.now() - t0 });
}

// Readiness: define Module.onRuntimeInitialized BEFORE loading (Using OpenCV.js).
// GOTCHA (knowledge/opencv-expert/docs/01): the cv module is a thenable, so never `await cv`, `resolve(cv)`
// or `return cv` from async code; that hangs forever. Use callbacks only.
self.Module = { onRuntimeInitialized: markReady };
try {
  importScripts(OPENCV_URL, 'src/scanner-pipeline.js');    // relative to this worker's URL; loads once
} catch (e) {
  postMessage({ type: 'fatal', message: 'The scanner files could not be loaded (' + (e && e.message ? e.message : e) + ').' });
}
if (self.cv && typeof self.cv.then === 'function') self.cv.then(function () { markReady(); });
if (self.cv && self.cv.Mat) markReady();

self.onmessage = function (event) {
  const data = event.data || {};
  const id = data.id;
  try {
    if (!ready) throw new Error('OpenCV is not ready yet');
    if (data.type === 'detect') {
      const det = detectPage(self.cv, data.imageData);
      postMessage({ id, type: 'detected', found: det.found, corners: det.corners, method: det.method, heapBytes: self.cv.HEAP8.length });
      return;
    }
    if (data.type === 'process') {
      const out = processScan(self.cv, data.imageData, data.corners, data.mode || 'bw');
      // Transfer the result buffer back zero-copy; the worker never touches it again.
      postMessage({ id, type: 'result', imageData: { data: out.data, width: out.width, height: out.height }, aspect: out.aspect, heapBytes: self.cv.HEAP8.length }, [out.data.buffer]);
      return;
    }
    if (data.type === 'stats') {
      postMessage({ id, type: 'stats', heapBytes: self.cv.HEAP8.length });
      return;
    }
    throw new Error('Unknown message type: ' + data.type);
  } catch (err) {
    postMessage({ id, type: 'error', message: String((err && err.message) || err) });
  }
};
