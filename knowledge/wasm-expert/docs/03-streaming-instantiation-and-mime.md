# Streaming instantiation and the application/wasm MIME type

**Source:** MDN `WebAssembly.instantiateStreaming()`: https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/instantiateStreaming_static · Netlify custom headers: https://docs.netlify.com/manage/routing/headers/

## API (MDN)
```js
WebAssembly.instantiateStreaming(source, importObject?, compileOptions?)
// source: a Response or a Promise<Response> (e.g. fetch('x.wasm'))
// resolves to { module, instance }
```
- The `importObject` needs one matching property per import, or the call fails with `LinkError`.
- It rejects with a `TypeError` for bad arguments **or when the response's MIME type isn't `application/wasm`**. Compile, link and runtime failures reject with `CompileError`, `LinkError` or `RuntimeError`.
- MDN note: for this to work, `.wasm` files should be returned with an `application/wasm` MIME type by the server.
- A strict Content-Security-Policy can block Wasm compilation. See CSP `script-src` (`'wasm-unsafe-eval'`).

## Verified (`examples/wasm-basics.mjs`)
- `new Response(bytes, {headers:{'Content-Type':'application/wasm'}})` instantiated fine.
- The same bytes with `application/octet-stream` rejected with `TypeError: WebAssembly response has unsupported MIME type 'application/octet-stream'`.

## What it means for our deploy
- Our pinned `opencv.js` (4.10.0) **embeds** its Wasm, so there is no `.wasm` request and the MIME rule doesn't apply to it.
- If a split build (`opencv.js` + `opencv_js.wasm`) is ever used, keep this Netlify rule:
  ```toml
  [[headers]]
    for = "/*.wasm"
    [headers.values]
      Content-Type = "application/wasm"
  ```
  Then check it with `curl -sI https://<site>/vendor/opencv_js.wasm`.
