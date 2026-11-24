# Smoothing and Canny edge detection

**Sources:** Smoothing Images: https://docs.opencv.org/4.x/dd/d6a/tutorial_js_filtering.html · Canny (JS): https://docs.opencv.org/5.x/d7/de1/tutorial_js_canny.html · tutorial snippet (OpenCV 4.5.1 docs source, `js_canny.html`): https://sources.debian.org/src/opencv/4.5.1%2Bdfsg-5/doc/js_tutorials/js_assets/js_canny.html

## GaussianBlur
`cv.GaussianBlur(src, dst, ksize, sigmaX, sigmaY = 0, borderType = cv.BORDER_DEFAULT)`
- `ksize` is a `cv.Size` (width and height). If `sigmaY` is 0 it equals `sigmaX`. If both are 0, they're computed from `ksize`. The page recommends specifying ksize, sigmaX and sigmaY.
- Official example: `cv.GaussianBlur(src, dst, new cv.Size(5,5), 0, 0, cv.BORDER_DEFAULT)`, then `src.delete(); dst.delete();`.

## Canny
`cv.Canny(image, edges, threshold1, threshold2, apertureSize = 3, L2gradient = false)`
- `image`: 8-bit input. `edges`: single-channel 8-bit output, same size.
- `threshold1` and `threshold2` are the hysteresis thresholds. `apertureSize` is the Sobel kernel size. `L2gradient` selects the more accurate L2 norm.
- Official tutorial snippet:
  ```js
  let src = cv.imread('canvasInput'); let dst = new cv.Mat();
  cv.cvtColor(src, src, cv.COLOR_RGB2GRAY, 0);
  cv.Canny(src, dst, 50, 100, 3, false);
  cv.imshow('canvasOutput', dst);
  src.delete(); dst.delete();
  ```

## Our tuned defaults (verified in `examples/run-tests.mjs`)
- Blur 5×5, σ = 0, then `Canny(75, 200, 3, false)`, then `dilate` with a 3×3 ones kernel to close gaps.
- On the synthetic test page this gave corners within **1.4 px** of truth. OpenCV-Python 5.0 with the same parameters found the same 4 corners (±1 px).
- Expose a sensitivity setting that scales both thresholds for dim photos.
