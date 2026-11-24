# Web Workers for OpenCV.js

**Sources:** MDN Using Web Workers: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers · OpenCV.js usage: https://docs.opencv.org/4.x/d0/d84/tutorial_js_usage.html

## Facts from MDN
- Workers run scripts on background threads, so they don't block the UI. Create one with `new Worker('worker.js')`.
- Messages go through `postMessage` and `onmessage`, and the data is **copied** (structured clone) unless transferred.
- In classic workers, `importScripts('a.js', 'b.js')` loads synchronously and executes in order. A failed load throws `NETWORK_ERROR`.
- `worker.terminate()` kills the thread **immediately**.
- `worker.onerror` receives an `ErrorEvent` with `message`, `filename` and `lineno`.
- Workers can't touch the DOM or `window`; use `self`. They *can* use `fetch`, IndexedDB, timers and `Navigator`.

## Our design (tested in `examples/cv-client.test.mjs`)
- **Worker:** `self.Module = { onRuntimeInitialized }`, then `importScripts('/vendor/opencv-4.10.0.js')`, then `postMessage({type:'ready'})`. Catch import failures and post `{type:'fatal'}`.
- **Client** (`examples/cv-client.js`):
  - A `ready` promise with a 30 s load timeout.
  - An `id` per call, kept in a `pending` map with a 15 s job timeout.
  - Status callbacks: `loading → ready → working → ready | error`.
  - On a timeout or `onerror`: reject everything pending, `terminate()`, spawn a fresh worker, and count `respawns`.
- 10/10 tests pass: happy path, worker error, transfer list forwarded, stuck job → terminate → respawn → next call works, and load timeout → respawn.

## OpenCV.js-specific worker rules
- Use `cv.matFromImageData(imageData)` in the worker, never `cv.imread` or `cv.imshow` (those need the DOM).
- The `cv` module is a **thenable**. Never `await cv` or `resolve(cv)`, or it hangs (reproduced in opencv-expert tests). Signal readiness from `onRuntimeInitialized`.
- Load OpenCV **once per worker lifetime**. A respawn reloads it, which costs about 100 ms from the HTTP cache.
