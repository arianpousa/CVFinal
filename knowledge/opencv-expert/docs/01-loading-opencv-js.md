# Loading opencv.js and knowing when it is ready

**Source:** OpenCV.js tutorial "Using OpenCV.js": https://docs.opencv.org/4.x/d0/d84/tutorial_js_usage.html · OpenCV 5 version: https://docs.opencv.org/5.0/js_tutorials/js_setup/js_usage/js_usage.html · OpenCV.js in Node: https://docs.opencv.org/5.x/dc/de6/tutorial_js_nodejs.html

## What the official docs say
- Get `opencv.js` from `https://docs.opencv.org/{VERSION}/opencv.js` or from the `opencv-{VERSION}-docs.zip` release asset.
- Include it with `<script src="opencv.js">`. Add `async` plus an `onload` handler for non-blocking loading.
- Readiness: define a global `Module = { onRuntimeInitialized() { … } }` **before** the script loads. Emscripten calls `onRuntimeInitialized()` when the runtime is ready, and after that `cv` is usable.
- OpenCV 5 docs: `cv` can be a Promise-typed object that must be unwrapped with `await`.
- The Node tutorial wraps loading in `new Promise(resolve => { global.Module = { onRuntimeInitialized: resolve }; global.cv = require('./opencv.js'); })`.

## What we verified ourselves (tested 2026-11-24, `@techstark/opencv-js@4.10.0-release.1`, a repackaged official 4.10.0 build)
- `opencv.js` is **10,378,215 bytes** (~3.4 MB gzipped) with the **Wasm embedded as base64**, so it is one file with no separate `.wasm`.
- Right after `require`/`importScripts`, `cv.Mat` is **undefined**. It becomes a function about 80 ms later.
- The module object is a **thenable** (it has `.then`). ⚠️ `await cv`, `resolve(cv)` or `return cv` from an `async` function **hangs forever**, because the promise keeps re-adopting the thenable. We reproduced this.
- Safe patterns that we ran:
  ```js
  // A) callback
  cv.onRuntimeInitialized = () => start();
  // B) promise that resolves with NOTHING
  await new Promise(r => cv.Mat ? r() : (cv.onRuntimeInitialized = () => r()));
  // C) thenable callback form
  await new Promise(r => cv.then(() => r()));
  ```

## Rules for our app
1. Load once, in the Web Worker: `importScripts('/vendor/opencv-4.10.0.js')`.
2. Signal readiness with `postMessage({type:'ready'})` from `onRuntimeInitialized` (guard against firing twice).
3. Never pass the module object through `resolve()`, `await` or `return` in async code.
4. Pin the version. `docs.opencv.org/4.x/` is a moving alias.
