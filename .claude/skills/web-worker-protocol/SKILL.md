---
name: web-worker-protocol
description: "Web Worker architecture for OpenCV.js: load opencv.js once via importScripts, readiness handshake, request ids, transferable ImageData buffers, timeouts, terminate and respawn. Use when writing cv-worker.js or the main-thread client that talks to it."
---
# Web Worker protocol

Reference: `docs/02-webassembly-and-workers.md`.

## Worker (`cv-worker.js`, classic worker)
```js
let ready = false;
function markReady(){ if (!ready){ ready = true; postMessage({type:'ready'}); } }
self.Module = { onRuntimeInitialized: markReady };
try { importScripts('/vendor/opencv-4.10.0.js'); }
catch (e) { postMessage({type:'fatal', message:'opencv.js failed to load: ' + e.message}); }
// The module is a THENABLE: use the callback form only. `await cv`, `resolve(cv)` or `return cv`
// from an async function loops forever (reproduced in knowledge/opencv-expert/docs/01-loading-opencv-js.md).
if (self.cv && typeof self.cv.then === 'function') self.cv.then(() => markReady());
if (self.cv && self.cv.Mat) markReady();

onmessage = ({data}) => {
  const {id, type} = data;
  try {
    if (!ready) throw new Error('OpenCV not ready');
    if (type === 'detect')  return postMessage({id, type:'detected', ...detect(data.imageData)});
    if (type === 'process') { const out = processScan(data.imageData, data.corners, data.mode);
                              return postMessage({id, type:'result', imageData: out}, [out.data.buffer]); }
    throw new Error('Unknown message ' + type);
  } catch (err) { postMessage({id, type:'error', message: String(err && err.message || err)}); }
};
```

## Main-thread client
- One `CvClient` class: `ready` promise, `pending = new Map()` of `{resolve, reject, timer}`.
- `call(type, payload, transfer)` assigns an incrementing `id`, starts a timeout (load 30 s, job 15 s).
- On timeout or `worker.onerror`: reject all pending, `worker.terminate()`, spawn a new worker, set UI status.
- Transfer `imageData.data.buffer` in both directions (zero-copy).
- Status values surfaced to UI: `loading` → `ready` → `working` → `ready` | `error`.

## Rules
- OpenCV loads exactly once per worker lifetime.
- No DOM in the worker (`self`, not `window`).
- Messages contain only structured-cloneable data (ImageData, arrays, plain objects).

## Tested references
- Worker client with timeouts and respawn: `knowledge/wasm-expert/examples/cv-client.js` (10/10 tests)
- Real worker + OpenCV.js + IndexedDB in Chrome: `knowledge/qa-tester/examples/smoke-app/` (10/10)
