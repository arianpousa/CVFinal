# Transferable objects (zero-copy messaging)

**Source:** MDN Transferable objects: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects

## Facts from MDN
- A transferable resource exists in only one context at a time. After a transfer, the original is **detached**, and reading or writing it throws. For `ArrayBuffer`, `byteLength` becomes 0.
- An `ArrayBuffer` is moved by a zero-copy operation.
- The transfer list only says *how* to send. The object must also be inside the message.
- Transferable types include `ArrayBuffer`, `ImageBitmap`, `OffscreenCanvas`, `MessagePort`, `ReadableStream`, `VideoFrame` and more (MDN says the list may not be exhaustive).
- **Typed arrays are not transferable. Transfer `array.buffer`.**
- `structuredClone(value, { transfer: [buf] })` moves instead of copying.

## Verified (`examples/transfer-demo.mjs`, 4000×3000 RGBA = 48 MB)
- After `postMessage(msg, [buf])` the sender's buffer had `byteLength 0`.
- Transferring a `Uint8ClampedArray` itself threw. Transferring its `.buffer` worked.
- Round trip: **25 ms with transfer vs 69 ms with copy**, and the copy also doubles peak memory.

## In our app
```js
// main -> worker
const img = ctx.getImageData(0, 0, w, h);
client.call('process', { imageData: img, corners, mode }, [img.data.buffer]);
// worker -> main
postMessage({ id, type: 'result', imageData: out }, [out.data.buffer]);
```
Don't use `img` on the main thread after sending it. It is detached.
