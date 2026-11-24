# Linear memory (WebAssembly.Memory) and why Mats must be deleted

**Sources:** MDN `WebAssembly.Memory`: https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory · OpenCV.js memory note: https://docs.opencv.org/4.x/d0/d84/tutorial_js_usage.html · Emscripten embind memory management: https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html#memory-management

## Facts from MDN
- `new WebAssembly.Memory({ initial, maximum, shared })`. Sizes are in **pages of 64 KiB**.
- `memory.buffer` is the underlying `ArrayBuffer` (or `SharedArrayBuffer` when `shared: true`). JS reads and writes it through typed arrays or a `DataView`, and Wasm memory is little-endian.
- `memory.grow(n)` adds pages and **detaches the previous buffer**, so any view on the old buffer becomes unusable and must be re-created.

## Verified (`examples/wasm-basics.mjs`)
- A fresh 1-page memory is 65,536 bytes. JS-written bytes were summed by Wasm code, so they share one heap.
- After `grow(1)`, the old `Uint8Array` view had `byteLength 0` and the buffer was 131,072 bytes.
- Growing past `maximum` throws a `RangeError`.

## Consequences for OpenCV.js
- Every `cv.Mat`'s pixels live in Emscripten's linear memory (`cv.HEAP8.buffer`), not on the JS heap. The JS garbage collector only frees the tiny wrapper object.
- The OpenCV docs require calling `delete()` on each Mat to free that heap memory.
- Linear memory **only grows, it never shrinks**. Our OpenCV test measured 30 leaked 1080p frames growing it from 128 MiB to 512 MiB. Enough leaks end with an out-of-memory abort or a crashed tab.
- Never keep a typed-array view of `mat.data` across calls. Copy it out (`new Uint8ClampedArray(mat.data)`) before deleting the Mat, because a later heap growth detaches old views.
