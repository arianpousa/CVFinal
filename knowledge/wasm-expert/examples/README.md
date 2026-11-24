# wasm-expert examples (tested)

| File | Shows | Run |
|---|---|---|
| `wasm-basics.mjs` | Hand-assembled Wasm module: validate/instantiate, exports, linear memory shared with JS, `grow()` detaching buffers, max-size `RangeError`, `instantiateStreaming` succeeding with `application/wasm` and failing with the wrong MIME, Module structured-clone | `node wasm-basics.mjs` |
| `cv-client.js` + `cv-client.test.mjs` | Production-shape main-thread worker client: ready promise, request ids, timeouts, terminate and respawn, status callbacks | `node cv-client.test.mjs` |
| `transfer-demo.mjs` | Copy vs transfer of a 48 MB RGBA frame with a real worker thread | `node transfer-demo.mjs` |

No dependencies. Node 18+ exposes the same `WebAssembly`, `Response`, `structuredClone` and worker transfer semantics as Chrome.

## Recorded results (2026-11-24, Node 22)
```
wasm-basics.mjs     10/10 PASS  (wrong MIME → TypeError: WebAssembly response has unsupported MIME type 'application/octet-stream')
cv-client.test.mjs  10/10 PASS  (stuck job → timeout → terminate → respawn → next call OK)
transfer-demo.mjs    4/4  PASS  (transfer 25.4 ms vs copy 69.1 ms for 48 MB; sender detached after transfer)
```
