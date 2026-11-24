# 02 · WebAssembly, memory, and Web Workers

**Owner agent:** `wasm-expert` · **Related:** [01 OpenCV.js](01-opencv-js-functions.md), [05 Troubleshooting](05-troubleshooting-hangs.md)

## 1. What WebAssembly is and why it makes OpenCV.js fast

- Wasm is a binary instruction format for a stack-based virtual machine. It is a portable compilation target. ([webassembly.org][wasm])
- Its compact binary loads quickly and aims for near-native speed by using common hardware capabilities. ([webassembly.org][wasm])
- It runs in a memory-safe sandbox that respects same-origin and permission policies. ([webassembly.org][wasm])
- MDN calls it a compilation target for C/C++, C#, Rust and more, designed to run alongside JavaScript and loaded through the `WebAssembly` JS API. ([MDN WebAssembly][mdnwasm])
- **OpenCV.js** = OpenCV's C++ code compiled by Emscripten to Wasm, plus JS bindings (embind). The pixel loops (blur, Canny, warp, threshold) run as compiled machine-level code instead of JS, which is why a 12 MP image can be processed in well under a second.

### What we verified about the build we will ship
We inspected `@techstark/opencv-js@4.10.0-release.1` (repackages the official `docs.opencv.org/4.10.0/opencv.js`):

| Fact | Value |
|---|---|
| `opencv.js` size | **10,378,215 bytes (~10.4 MB)** |
| gzip -9 size | **~3.4 MB** |
| Wasm delivery | **embedded** in the JS as a base64 `data:application/octet-stream` URI — no separate `.wasm` file |
| Worker support | contains `ENVIRONMENT_IS_WORKER` and `importScripts` paths → loads in a classic Web Worker |

Implication: one file to host, no `.wasm` MIME type to configure for this build (see doc 04 if a split `.wasm` build is ever used).

## 2. Linear memory (the Emscripten heap)

- A Wasm module's memory is a `WebAssembly.Memory`: a resizable `ArrayBuffer` exposed via `.buffer` that grows with `.grow()`. *(general background per MDN's summary — verify on the Memory reference page)* ([MDN WebAssembly][mdnwasm])
- Every `cv.Mat`'s pixel data lives **inside that heap**, not in the JS garbage-collected heap.

## 3. Why every `cv.Mat` must be deleted

- The official tutorial: you must call `delete` on a `cv.Mat` to free memory allocated in Emscripten's heap. ([Using OpenCV.js][usage])
- The JS garbage collector only sees a tiny wrapper object. It never frees the C++ buffer behind it. Leaked Mats pile up until the heap can't grow, then you get `Cannot enlarge memory` / `abort()` errors, or the tab slows down and crashes.
- Applies to: `cv.Mat`, `cv.MatVector`, results of `contours.get(i)`, `cv.matFromArray`, `cv.matFromImageData`, `cv.imread`. Plain value types such as `cv.Size`, `cv.Point` and `cv.Scalar` are JS objects in OpenCV.js 4.x and don't need `.delete()` *(general API knowledge — verify)*.

**Pattern every agent must use:**

```js
function processPage(imageData) {
  const mats = [];
  const track = m => (mats.push(m), m);
  try {
    const src  = track(cv.matFromImageData(imageData));
    const gray = track(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    // ... more steps, each new Mat wrapped in track()
    return result;               // plain JS data, never a Mat
  } finally {
    for (const m of mats) m.delete();
  }
}
```

**Leak check during development:** run the same scan 20 times and watch the worker's memory in DevTools (Memory panel, or `performance.memory` in Chrome). It should plateau, not climb.

## 4. Running the heavy work in a Web Worker

**Why:** OpenCV calls are synchronous. On the main thread a 1–2 s warp freezes clicks, scrolling and the spinner. Workers run scripts on background threads so they don't block the UI. ([MDN Workers][workers])

**Facts from MDN:**
- Create with `new Worker('worker.js')`. Communicate with `postMessage`/`onmessage`; data is **copied** by default. ([MDN Workers][workers])
- Classic workers load scripts synchronously with `importScripts()`; a failed load throws `NETWORK_ERROR`. ([MDN Workers][workers])
- Transferables (e.g. `ArrayBuffer`) move zero-copy: `worker.postMessage(buf, [buf])` leaves the sender's buffer unusable. ([MDN Workers][workers])
- `worker.terminate()` kills the thread immediately. ([MDN Workers][workers])
- Runtime errors fire `worker.onerror` with `message`, `filename` and `lineno`. ([MDN Workers][workers])
- Workers can't touch the DOM or `window`, so use `self`. They *can* use `fetch`, **IndexedDB**, timers and more. ([MDN Workers][workers])

**Architecture we'll use:**

```
main thread (UI)                         cv-worker.js
─────────────────                        ─────────────
load page, show "Loading OpenCV…"   ──►  importScripts('/vendor/opencv.js')  (ONCE)
                                    ◄──  {type:'ready'}
draw image → getImageData
postMessage({id, type:'detect',     ──►  matFromImageData → … → corners
  imageData}, [imageData.data.buffer])
                                    ◄──  {id, type:'detected', corners}
user adjusts corners → 'warp'       ──►  warp + threshold → ImageData
                                    ◄──  {id, type:'result', imageData}  (transfer buffer)
canvas.putImageData → toBlob → IndexedDB
```

Rules:
1. **Load OpenCV once**, in the worker, at startup. Never re-import per scan.
2. Every request has an `id`; the main thread keeps a `Map<id, {resolve, reject, timer}>`.
3. **Watchdog timeout** (e.g. 30 s for the load, 15 s per job): on timeout `worker.terminate()`, create a fresh worker, show "Processing took too long — retrying".
4. Wrap the worker handler in `try/catch` and post `{id, type:'error', message}`; also set `worker.onerror`.
5. Transfer `imageData.data.buffer` both ways to avoid copying 48 MB per 12 MP image.

## Sources
- [wasm]: https://webassembly.org/
- [mdnwasm]: https://developer.mozilla.org/en-US/docs/WebAssembly
- [usage]: https://docs.opencv.org/4.x/d0/d84/tutorial_js_usage.html
- [workers]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
- Emscripten embind memory management: https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html#memory-management
- npm package inspected: https://www.npmjs.com/package/@techstark/opencv-js

[wasm]: https://webassembly.org/
[mdnwasm]: https://developer.mozilla.org/en-US/docs/WebAssembly
[usage]: https://docs.opencv.org/4.x/d0/d84/tutorial_js_usage.html
[workers]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
