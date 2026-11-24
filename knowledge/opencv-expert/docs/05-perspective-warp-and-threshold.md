# Perspective warp and adaptive threshold

**Sources:** Geometric Transformations: https://docs.opencv.org/4.x/dd/d52/tutorial_js_geometric_transformations.html (5.x: https://docs.opencv.org/5.x/dd/d52/tutorial_js_geometric_transformations.html) · Image Thresholding: https://docs.opencv.org/4.x/d7/dd0/tutorial_js_thresholding.html · C++ sample: https://docs.opencv.org/4.x/de/dd4/samples_2cpp_2warpPerspective_demo_8cpp-example.html

## getPerspectiveTransform + warpPerspective
- `cv.getPerspectiveTransform(src, dst)` takes 4 source points and 4 destination points, and returns a 3×3 matrix. Three of the four points must not be collinear.
- `cv.warpPerspective(src, dst, M, dsize, flags, borderMode, borderValue)`
  - `M` is 3×3 `CV_64FC1`. `flags` is `cv.INTER_LINEAR` or `INTER_NEAREST`, optionally with `WARP_INVERSE_MAP`.
  - `borderMode` is `cv.BORDER_CONSTANT` or `cv.BORDER_REPLICATE`. `borderValue` defaults to 0.
- The tutorial gives point Mats as `[N,1]` size with type `cv.CV_32FC2` (shown for the affine case, and used the same way for perspective):
  ```js
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [x0,y0, x1,y1, x2,y2, x3,y3]);
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0,0, W-1,0, W-1,H-1, 0,H-1]);
  const M = cv.getPerspectiveTransform(srcTri, dstTri);
  cv.warpPerspective(src, dst, M, new cv.Size(W, H), cv.INTER_LINEAR, cv.BORDER_REPLICATE, new cv.Scalar());
  // delete srcTri, dstTri, M, dst (and src)
  ```
- Output size: `W = max(|TR−TL|, |BR−BL|)`, `H = max(|BL−TL|, |BR−TR|)`. The tested example produced a 494×394 page for the 490×400 truth.

## adaptiveThreshold
`cv.adaptiveThreshold(src, dst, maxValue, adaptiveMethod, thresholdType, blockSize, C)`
- `src` must be **8-bit single-channel**, so convert to grayscale first.
- `adaptiveMethod` is `cv.ADAPTIVE_THRESH_MEAN_C` (neighbourhood mean) or `cv.ADAPTIVE_THRESH_GAUSSIAN_C` (Gaussian-weighted sum).
- `thresholdType` is `cv.THRESH_BINARY` or `cv.THRESH_BINARY_INV`.
- `blockSize` is the **odd** neighbourhood size (3, 5, 7, …). `C` is subtracted from the (weighted) mean, normally positive.
- Our default: `255, GAUSSIAN_C, THRESH_BINARY, 21, 10`. The test output contained only 0 and 255 and was 93 % white paper with black text lines.
- To return it to the UI, convert with `cv.COLOR_GRAY2RGBA` so it fits `ImageData`.
