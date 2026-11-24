# Loading, feedback states and camera permission

**Sources:** Apple HIG, Loading: https://developer.apple.com/design/human-interface-guidelines/loading · Motion: https://developer.apple.com/design/human-interface-guidelines/motion · MDN getUserMedia: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

## Loading (HIG)
- "The best content-loading experience finishes before people become aware of it."
- **Show something as soon as possible**, such as placeholders. An empty screen reads as a broken app.
- **Let people do other things while content loads** (load in the background).
- If loading is unavoidably long, give people something useful to look at (tips, a feature intro).
- **Communicate that loading is happening and how long it might take.** Use a *determinate* indicator when the duration is known and an *indeterminate* one when it isn't.

### Applied
- OpenCV.js is about 3.4 MB (gzipped) on the first visit and loads in the worker. Meanwhile the Library and Upload stay usable, and the pill says "Loading scanner…".
- The Scan button says "Getting ready…" until the worker reports ready.
- Detection and warp take an unknown time, so show an indeterminate spinner in the pill. Only the affected button is disabled.

## Feedback (HIG Motion)
- Feedback should be brief and precise, and **people must be able to cancel**. Never make them wait on an animation.
- Motion is optional, so pair it with text.

## Camera permission (MDN getUserMedia → UX rules)
- It works only in a **secure context** (HTTPS or localhost). Netlify serves HTTPS.
- Ask **only when the user taps "Use camera"**, never on page load.
- Possible errors:
  - `NotAllowedError` (denied or blocked by policy): "Camera access is off. You can upload a photo instead." + **Upload photo**
  - `NotFoundError` (no camera): hide "Use camera" and offer upload.
  - `NotReadableError` (in use by another app): "The camera is being used by another app."
  - The promise may **never settle** if the user ignores the prompt, so keep Upload available while waiting.
- Always stop the tracks after capture (`track.stop()`), which turns off the camera indicator.
