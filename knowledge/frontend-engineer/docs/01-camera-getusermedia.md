# Webcam capture with getUserMedia

**Source:** MDN `MediaDevices.getUserMedia()`: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

## API
- `navigator.mediaDevices.getUserMedia(constraints)` returns a `Promise<MediaStream>`. `audio` and `video` default to `false`, and a request with neither always rejects.
- Plain values like `{ width: 1280 }` are **ideal** (preferences). `min`, `max` and `exact` make a constraint mandatory and can fail with `OverconstrainedError`.
- `facingMode: 'user'` (front) or `'environment'` (rear). Use `{ exact: 'environment' }` to require the rear camera.
- **Secure context only** (HTTPS, `localhost`, `file:///`). Otherwise `navigator.mediaDevices` is `undefined`. It's also blocked in sandboxed iframes without `allow-same-origin`, and in `srcdoc` frames.
- Permissions-Policy directive: `camera`, for example `Permissions-Policy: camera=(self)`.

## Errors (MDN table)
| Error | Meaning | Our copy (Wren) |
|---|---|---|
| `NotAllowedError` | user denied, insecure page, or policy | "Camera access is off. You can upload a photo instead." |
| `NotFoundError` | no matching device | "No camera found. You can upload a photo instead." |
| `NotReadableError` | hardware or OS error, or in use | "The camera is being used by another app." |
| `OverconstrainedError` | a min/max/exact constraint can't be met (`err.constraint`) | "This camera can't take photos at the needed size." |
| `TypeError` | empty constraints or insecure context | "The camera needs a secure (https) page." |
| `AbortError`, `SecurityError`, `InvalidStateError` | other failures | generic fallback |

The promise **may never settle** if the user ignores the prompt, so keep Upload usable while waiting.

## Releasing the camera
`stream.getTracks().forEach(t => t.stop())` releases the device and turns off the camera indicator. Stop before switching cameras and right after capturing.

## Verified (`examples/capture-test.cjs`, Chrome fake camera)
- The ideal 1920×1080 request produced a 1920×1080 frame.
- After `captureFrame`, every track's `readyState` was `ended`.
- A mocked `NotAllowedError` showed the friendly fallback copy.
