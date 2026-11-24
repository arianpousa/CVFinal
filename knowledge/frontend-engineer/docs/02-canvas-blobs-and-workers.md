# Canvas, Blobs, and handing pixels to the worker

**Sources:** MDN `HTMLCanvasElement.toBlob()`: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob · Transferable objects: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects · Using Web Workers: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers

## toBlob
- `canvas.toBlob(callback, type?, quality?)`. The default type is `image/png`, which is also used if the type is unsupported. `quality` (0–1) applies to `image/jpeg` and `image/webp`.
- The callback may receive **`null`** if encoding fails, so reject in that case (see `canvasToBlob` in `examples/capture.js`).
- It throws `SecurityError` if the canvas is **tainted** by a cross-origin image. We only draw user files and camera frames, which are same-origin.
- Revoke object URLs (`URL.revokeObjectURL`) in long-lived apps.

## Pixels to and from the worker
- `ctx.getImageData()` gives an `ImageData` (RGBA `Uint8ClampedArray`). Post it with `[imageData.data.buffer]` in the transfer list, which is zero-copy. **Don't touch it afterwards, because it's detached.**
- The worker returns `{data, width, height}`. Rebuild it with `new ImageData(data, width, height)` and draw it with `putImageData`.
- Workers have no DOM, so all canvas work stays on the main thread. All OpenCV work stays in the worker.

## Sizing rules (tested)
- Cap input at **4000 px** on the long side (a 12 MP photo is already 48 MB of RGBA).
- Detect on a **1000 px** copy and multiply the corners by `scale` (verified: 4000×3000 → 1000×750, scale 4). Warp the full-resolution canvas.
- Store the scan as PNG (lossless B&W) plus a ~200 px JPEG thumbnail at quality 0.8 (verified to be smaller than the PNG).

## Integration contracts
| From | API you call | Notes |
|---|---|---|
| wasm-expert `cv-client.js` | `await client.ready`, `client.call('detect', {imageData}, [buf])`, `client.call('process', {imageData, corners, mode}, [buf])`, `onStatus(s)` | status: loading / ready / working / error |
| indexeddb-expert `db.js` | `openDB({onBlocked,onOutdated})`, `saveScan`, `listScans`, `getFullBlob`, `deleteScan`, `renameScan`, `get/setSetting`, `trySave`, `resetAppData` | create the blobs **before** calling `saveScan` |
