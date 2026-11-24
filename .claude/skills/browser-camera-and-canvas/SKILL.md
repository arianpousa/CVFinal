---
name: browser-camera-and-canvas
description: "Browser image input and output for the scanner: file upload, getUserMedia webcam capture, canvas getImageData/putImageData/toBlob, downscaling for detection. Use when writing capture, preview, or image-conversion code on the main thread."
---
# Camera & canvas

## Upload
`<input type="file" accept="image/*" capture="environment">` → `createImageBitmap(file, {imageOrientation:'from-image'})` → draw to canvas.

## Webcam
```js
const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment', width:{ideal:1920}}});
video.srcObject = stream; await video.play();
// capture
canvas.width = video.videoWidth; canvas.height = video.videoHeight;
ctx.drawImage(video, 0, 0);
stream.getTracks().forEach(t => t.stop());       // always release the camera
```
Requires HTTPS (Netlify provides it) or localhost. Handle `NotAllowedError` / `NotFoundError` with an upload fallback.

## To and from the worker
- `ctx.getImageData(0,0,w,h)` → send to worker, transferring `imageData.data.buffer`.
- Result ImageData → `ctx.putImageData(result, 0, 0)`.
- Detection copy: draw into an offscreen canvas scaled so the long side ≤ 1000 px; keep the scale factor.

## Export
`canvas.toBlob(cb, 'image/png')` for the scan, `'image/jpeg', 0.8` for a ~200 px thumbnail; download via an `<a download>` with an object URL (revoke after click).

## Limits
Cap input at ~4000 px on the long side (downscale larger photos) to keep memory sane.
