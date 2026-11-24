// capture.js: main-thread image input/output for the scanner (ES module, no framework).
// Sources:
//   getUserMedia:  https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
//   toBlob:        https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
//   Transferables: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
// Tested by capture-test.cjs in Chrome (fake camera device + real file upload).

export const MAX_SIDE = 4000;      // cap huge photos (memory)
export const DETECT_SIDE = 1000;   // detection runs on a downscaled copy

/** Pure math: scale factor so the long side <= max (never upscale). */
export function fitScale(w, h, max) { return Math.min(1, max / Math.max(w, h)); }

/** Draw any image source into a new canvas, optionally downscaled. */
export function toCanvas(source, w, h, max = MAX_SIDE) {
  const s = fitScale(w, h, max);
  const c = document.createElement('canvas');
  c.width = Math.round(w * s); c.height = Math.round(h * s);
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  return c;
}

/** File input → canvas. createImageBitmap honours EXIF orientation with imageOrientation. */
export async function loadFromFile(file) {
  if (!file || !file.type.startsWith('image/')) throw new UserFacingError('Choose an image file (JPG, PNG or HEIC exported as JPG).');
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try { return toCanvas(bmp, bmp.width, bmp.height); } finally { bmp.close(); }
}

export class UserFacingError extends Error {}

/** Map getUserMedia errors to Wren's copy (see ux-designer-apple-hig/examples/flow-spec.md). */
export function cameraMessage(err) {
  switch (err && err.name) {
    case 'NotAllowedError': return 'Camera access is off. You can upload a photo instead.';
    case 'NotFoundError': return 'No camera found. You can upload a photo instead.';
    case 'NotReadableError': return 'The camera is being used by another app.';
    case 'OverconstrainedError': return 'This camera can’t take photos at the needed size.';
    case 'TypeError': return 'The camera needs a secure (https) page.';
    default: return 'The camera couldn’t start. You can upload a photo instead.';
  }
}

/** Start the rear camera (ideal 1920 wide). Ask ONLY after the user taps "Use camera". */
export async function startCamera(video) {
  if (!navigator.mediaDevices?.getUserMedia) throw new UserFacingError(cameraMessage({ name: 'TypeError' }));
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
    video.srcObject = stream; video.muted = true; video.playsInline = true;
    await video.play();
    return stream;
  } catch (err) { throw new UserFacingError(cameraMessage(err)); }
}

/** Grab the current frame, then ALWAYS release the camera (turns the indicator off). */
export function captureFrame(video, stream) {
  try { return toCanvas(video, video.videoWidth, video.videoHeight); }
  finally { stream.getTracks().forEach((t) => t.stop()); video.srcObject = null; }
}

/** Canvas → {imageData, scale} for the worker; transfer imageData.data.buffer when posting. */
export function detectionInput(canvas) {
  const small = toCanvas(canvas, canvas.width, canvas.height, DETECT_SIDE);
  const imageData = small.getContext('2d').getImageData(0, 0, small.width, small.height);
  return { imageData, scale: canvas.width / small.width };   // multiply corners by scale
}

/** Canvas → Blob (PNG for the scan, JPEG for thumbnails). Promise wrapper around toBlob. */
export function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), type, quality));
}

export async function thumbnailBlob(canvas, side = 200) {
  return canvasToBlob(toCanvas(canvas, canvas.width, canvas.height, side), 'image/jpeg', 0.8);
}
