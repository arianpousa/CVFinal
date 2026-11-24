# 01 · OpenCV.js functions for the Smart Document Scanner

**Owner agent:** `opencv-expert` · **Related:** [02 WebAssembly & Workers](02-webassembly-and-workers.md)

## 1. The pipeline at a glance

```
photo / webcam frame
  └─ cvtColor  RGBA → GRAY
     └─ GaussianBlur (5×5)          remove paper texture / sensor noise
        └─ Canny                    edge map
           └─ (optional) dilate     close small gaps in the page border
              └─ findContours       RETR_EXTERNAL, CHAIN_APPROX_SIMPLE
                 └─ sort by contourArea, take the largest few
                    └─ arcLength + approxPolyDP (ε ≈ 2 % of perimeter)
                       └─ first polygon with 4 corners = the page
                          └─ order corners TL, TR, BR, BL
                             └─ getPerspectiveTransform + warpPerspective  → flat page
                                └─ cvtColor GRAY + adaptiveThreshold        → crisp B/W scan
```

Fallback: if no 4-corner contour is found, use the full image rectangle (and let the user drag the corners manually).

## 2. Loading opencv.js and knowing when it is ready

- Include it with a `<script>` tag. For non-blocking loading add `async` and an `onload` callback. ([Using OpenCV.js][usage])
- The official tutorial defines a global `Module` object **before** loading the script, with an `onRuntimeInitialized()` callback; after it runs, `cv` is usable. ([Using OpenCV.js][usage])
- Newer builds (OpenCV 5 docs) expose `cv` as a Promise that must be unwrapped with `await`. ([OpenCV 5 Using OpenCV.js][usage5])
- **Defensive loader that works with both styles** (our recommendation):

```js
// inside the Web Worker (see doc 02)
self.Module = { onRuntimeInitialized: () => resolveReady() };
importScripts('/vendor/opencv.js');
// Some builds make `cv` a thenable instead of calling Module.onRuntimeInitialized
if (self.cv && typeof self.cv.then === 'function') {
  self.cv.then(real => { self.cv = real; resolveReady(); });
}
```

- **Pin a version.** As of Oct 2026, `docs.opencv.org/4.x/opencv.js` redirects to 4.13.0, not the newest release, so pin a numbered version. ([issoh.co.jp][issoh]) We self-host a copy (see doc 04).

## 3. Function reference (what each step needs)

> Signatures come from the official OpenCV.js tutorials unless marked *(general API knowledge — verify)*.

### `cv.imread` / `cv.imshow` (main thread only)
- `cv.imread(imgElementOrCanvas)` → `cv.Mat` (RGBA). Create Mats inside the image's `onload`, because image loading is async. ([Using OpenCV.js][usage])
- `cv.imshow('canvasId', mat)` draws a Mat into a `<canvas>`. ([Using OpenCV.js][usage])
- ⚠️ Both use the DOM, and **workers have no DOM**. ([MDN Workers][workers]) In the worker, use
  `cv.matFromImageData(imageData)` for input and `new ImageData(new Uint8ClampedArray(mat.data), mat.cols, mat.rows)` for output *(general API knowledge — verify)*. The main thread draws the ImageData with `ctx.putImageData`.

### `cv.cvtColor(src, dst, code)`
- `cv.COLOR_RGBA2GRAY` for edge detection; `cv.COLOR_GRAY2RGBA` before returning ImageData. *(general API knowledge — verify)*

### `cv.GaussianBlur(src, dst, ksize, sigmaX, sigmaY = 0, borderType = cv.BORDER_DEFAULT)`
- `ksize` is a `cv.Size`. If `sigmaY` is 0 it equals `sigmaX`. The tutorial recommends setting `ksize`, `sigmaX` and `sigmaY` explicitly. ([Smoothing][filtering])
- We use `new cv.Size(5,5)` with σ = 0 (auto) for documents.

### `cv.Canny(src, dst, threshold1, threshold2, apertureSize = 3, L2gradient = false)`
*(general API knowledge — the official Canny page could not be fetched; verify)*
- Hysteresis thresholds; start with `75, 200` for well-lit pages and expose a "sensitivity" slider.

### `cv.findContours(image, contours, hierarchy, mode, method, offset)`
- `image` is 8-bit single-channel and is treated as binary. Feed it Canny or threshold output. Objects should be white on black. ([Contours: Getting Started][contours])
- `CHAIN_APPROX_SIMPLE` compresses straight lines to their endpoints. ([Contours: Getting Started][contours])
- `contours` is a `cv.MatVector`, `hierarchy` a `cv.Mat`; mode `cv.RETR_EXTERNAL` (outer borders only) is best for a page *(general API knowledge — verify)*.

### `cv.contourArea`, `cv.arcLength`, `cv.approxPolyDP`
- `contourArea(contour, oriented=false)` returns area. `arcLength(curve, closed)` returns the perimeter. ([Contour Features][features])
- `approxPolyDP(curve, approxCurve, epsilon, closed)` uses Douglas-Peucker to reduce a contour to fewer vertices; `epsilon` is the maximum distance from the original. ([Contour Features][features])
- Rule of thumb: `epsilon = 0.02 * arcLength(cnt, true)`; accept when `approx.rows === 4` and `cv.isContourConvex(approx)`, and when the area is > 20 % of the image.

### `cv.getPerspectiveTransform(src, dst)` + `cv.warpPerspective(src, dst, M, dsize, flags, borderMode, borderValue)`
- Needs 4 source points and 4 destination points; 3 of them must not be collinear. ([Geometric Transformations][geo])
- `M` is a 3×3 `CV_64FC1`. `flags` is `cv.INTER_LINEAR` and `borderMode` is `cv.BORDER_CONSTANT` or `REPLICATE`. ([Geometric Transformations][geo])
- Build the point Mats with `cv.matFromArray(4, 1, cv.CV_32FC2, [x0,y0, x1,y1, x2,y2, x3,y3])` *(general API knowledge — verify)*.
- Output size: `width = max(|TR−TL|, |BR−BL|)`, `height = max(|BL−TL|, |BR−TR|)`.

### `cv.adaptiveThreshold(src, dst, maxValue, adaptiveMethod, thresholdType, blockSize, C)`
- `src` must be 8-bit single-channel. `thresholdType` is `THRESH_BINARY` or `THRESH_BINARY_INV`. `blockSize` is odd. `C` is subtracted from the local (weighted) mean. ([Thresholding][thresh])
- For scans: `255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 15–25, 8–12`. Expose "Color / Grayscale / B&W" modes.

## 4. Corner ordering (pure JS, no OpenCV)

```js
// pts: [{x,y}×4] → [TL, TR, BR, BL]
function orderCorners(pts) {
  const bySum  = [...pts].sort((a,b)=>(a.x+a.y)-(b.x+b.y));
  const byDiff = [...pts].sort((a,b)=>(a.y-a.x)-(b.y-b.x));
  return [bySum[0], byDiff[0], bySum[3], byDiff[3]];
}
```

## 5. Memory rules for this pipeline

Every `new cv.Mat()`, `cv.MatVector`, `cv.imread`, `cv.matFromArray` and `cv.matFromImageData` allocates on the Emscripten heap and **must** be freed with `.delete()`. ([Using OpenCV.js][usage]) Even the official blur example deletes `src` and `dst`. ([Smoothing][filtering]) Use `try { … } finally { mats.forEach(m => m.delete()) }`. `contours.get(i)` returns a Mat that also needs deleting. Details are in [doc 02](02-webassembly-and-workers.md#3-why-every-cvmat-must-be-deleted).

## 6. Performance tips
- Downscale to ~1000 px on the long side for **detection**, then scale the corners back up and warp the **full-resolution** image.
- Do all of this in the worker (doc 02).

## Sources
- [usage]: https://docs.opencv.org/4.x/d0/d84/tutorial_js_usage.html
- [usage5]: https://docs.opencv.org/5.0/js_tutorials/js_setup/js_usage/js_usage.html
- [filtering]: https://docs.opencv.org/4.x/dd/d6a/tutorial_js_filtering.html
- [contours]: https://docs.opencv.org/4.x/d5/daa/tutorial_js_contours_begin.html
- [features]: https://docs.opencv.org/4.x/dc/dcf/tutorial_js_contour_features.html
- [geo]: https://docs.opencv.org/4.x/dd/d52/tutorial_js_geometric_transformations.html
- [thresh]: https://docs.opencv.org/4.x/d7/dd0/tutorial_js_thresholding.html
- [workers]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
- [issoh]: https://www.issoh.co.jp/md/tech/3608
- OpenCV.js tutorial root (requested; the 4.13.0 URL returned an error when fetched, so the 4.x mirror pages were used): https://docs.opencv.org/4.13.0/d5/d10/tutorial_js_root.html
- Canny tutorial (could not be fetched; verify signature here): https://docs.opencv.org/4.x/d7/de1/tutorial_js_canny.html

[usage]: https://docs.opencv.org/4.x/d0/d84/tutorial_js_usage.html
[usage5]: https://docs.opencv.org/5.0/js_tutorials/js_setup/js_usage/js_usage.html
[filtering]: https://docs.opencv.org/4.x/dd/d6a/tutorial_js_filtering.html
[contours]: https://docs.opencv.org/4.x/d5/daa/tutorial_js_contours_begin.html
[features]: https://docs.opencv.org/4.x/dc/dcf/tutorial_js_contour_features.html
[geo]: https://docs.opencv.org/4.x/dd/d52/tutorial_js_geometric_transformations.html
[thresh]: https://docs.opencv.org/4.x/d7/dd0/tutorial_js_thresholding.html
[workers]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
[issoh]: https://www.issoh.co.jp/md/tech/3608
