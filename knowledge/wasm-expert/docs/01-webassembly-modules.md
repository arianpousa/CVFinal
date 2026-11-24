# WebAssembly: what it is, modules and instances

**Sources:** https://webassembly.org/ · MDN WebAssembly: https://developer.mozilla.org/en-US/docs/WebAssembly

## Key facts
- Wasm is a **binary instruction format for a stack-based virtual machine**, designed as a portable compilation target for programming languages (webassembly.org).
- Design goals (webassembly.org):
  - **Fast:** a compact binary that loads quickly and aims for near-native speed.
  - **Safe:** a memory-safe sandbox that enforces same-origin and permission policies.
  - **Open:** a text format for debugging, and it can call into and out of JavaScript and use Web APIs.
- MDN: a low-level, assembly-like language with near-native performance. It is a compilation target for C/C++, C#, Rust and others, and it is designed to **run alongside JavaScript**, loaded through the `WebAssembly` JS API.
- JS API surface (MDN): `compile`, `compileStreaming`, `instantiate`, `instantiateStreaming`, `validate`, `Module`, `Instance`, `Memory`, `Table`, `Global`, and the errors `CompileError`, `LinkError` and `RuntimeError`.

## Module vs Instance
- `WebAssembly.Module` is compiled, stateless code. It is structured-cloneable, so it can be posted to a worker and instantiated there.
- `WebAssembly.Instance` is a Module plus its own memory, tables and globals. Its exports are on `instance.exports`.
- Verified in `examples/wasm-basics.mjs`: `structuredClone(module)` produced a working second instance with its **own** memory.

## How this applies to OpenCV.js
- OpenCV.js is OpenCV's C++ compiled with **Emscripten** to Wasm, plus embind JS bindings (`cv.Mat`, `cv.Canny`, …).
- The 4.10.0 `opencv.js` we ship **embeds the .wasm as base64** inside the JS file (we verified this in the build), and Emscripten instantiates it itself.
- Pixel loops run as compiled Wasm instead of JS. That is the speed win, and the reason the work still has to stay off the main thread (doc 04).
