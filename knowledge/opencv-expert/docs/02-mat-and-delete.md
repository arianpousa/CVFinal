# cv.Mat basics and delete()

**Source:** OpenCV.js "Basic Operations on Images": https://docs.opencv.org/4.x/de/d06/tutorial_js_basic_ops.html · memory note in "Using OpenCV.js": https://docs.opencv.org/4.x/d0/d84/tutorial_js_usage.html

## Creating Mats (official API)
```js
new cv.Mat();                                  // empty
new cv.Mat(rows, cols, cv.CV_8UC3);            // rows, cols, type
new cv.Mat(new cv.Size(w, h), cv.CV_8UC1);
new cv.Mat(2, 2, cv.CV_8UC1, new cv.Scalar(255));
cv.Mat.zeros(3, 3, cv.CV_32F); cv.Mat.ones(3, 3, cv.CV_8U); cv.Mat.eye(3, 3, cv.CV_64F);
cv.matFromArray(2, 2, cv.CV_8UC1, [10, 20, 30, 40]);
cv.matFromImageData(ctx.getImageData(0, 0, w, h));   // RGBA, CV_8UC4
```
- Properties: `rows`, `cols`, `size()`, `channels()`, `depth()`, `type()`. The docs suggest checking `type()` first when debugging, because many errors come from wrong types.
- Deep copy with `mat_clone()`. The docs warn `clone()` may be shallow in OpenCV.js. `copyTo(dst, mask)` copies where the mask is non-zero.
- ROI: `src.roi(new cv.Rect(x, y, w, h))` returns a view.
- Pixels: `data` (for CV_8U, when `isContinuous()`), `data32F`, `data32S`, `ucharPtr(r, c)`, `ucharAt(r, c)`, `floatPtr`, `intPtr`.
- `cv.MatVector`: `push_back(m)`, `get(i)` (returns a **new Mat handle**), `size()`.

## delete(): the rule
- "You have to call delete method of cv.Mat to free memory allocated in Emscripten's heap" (Using OpenCV.js).
- The Basic Operations page says to delete every `cv.Mat` and `cv.MatVector` you create, **and every Mat you get back from `get()`**.
- Also delete Mats returned by functions such as `cv.getPerspectiveTransform` (it returns a new Mat).

## Measured effect (our `examples/mat-delete-demo.mjs`)
30 un-deleted 1920×1080 RGBA frames grew the Wasm heap from **128 MiB to 512 MiB**. The same loop with `try/finally` deletes stayed at 128 MiB. The heap never shrinks, so leaks eventually crash the tab.

## Pattern
```js
const mats = []; const T = m => (mats.push(m), m);
try { /* T(new cv.Mat()) … */ return plainJs; }
finally { mats.forEach(m => { if (!m.isDeleted()) m.delete(); }); }
```
Copy pixel data out (`new Uint8ClampedArray(mat.data)`) **before** the `finally` deletes the Mat.
