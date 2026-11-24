---
name: opencv-js-pipeline
description: "Smart Document Scanner vision pipeline in OpenCV.js: grayscale, blur, Canny, contours, 4-corner page detection, perspective warp, adaptive-threshold cleanup. Use when writing or tuning any page-detection or scan-cleanup code."
---
# OpenCV.js document pipeline

Reference: `docs/01-opencv-js-functions.md`.

## Detection (run on a copy downscaled to ~1000 px on the long side)
1. `cv.matFromImageData(imageData)` → RGBA Mat (in the worker; `cv.imread` only on the main thread).
2. `cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)`
3. `cv.GaussianBlur(gray, blur, new cv.Size(5,5), 0, 0, cv.BORDER_DEFAULT)`
4. `cv.Canny(blur, edges, 75, 200)` — expose low/high as a "sensitivity" setting.
5. Optional `cv.dilate(edges, edges, kernel3x3)` to close gaps in the page border.
6. `cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)`
7. Sort contours by `cv.contourArea` (descending), inspect the top 5.
8. For each: `peri = cv.arcLength(c, true)`; `cv.approxPolyDP(c, approx, 0.02*peri, true)`;
   accept the first with `approx.rows === 4`, `cv.isContourConvex(approx)` and area > 20 % of the image.
9. If none: fall back to the full-image rectangle and tell the UI `{found:false}` so the user can drag corners.
10. Scale corners back to full resolution.

## Corner ordering (TL, TR, BR, BL)
Smallest x+y = TL, largest x+y = BR, smallest y−x = TR, largest y−x = BL.

## Warp (full resolution)
- `w = max(dist(TR,TL), dist(BR,BL))`, `h = max(dist(BL,TL), dist(BR,TR))`
- `srcPts = cv.matFromArray(4,1,cv.CV_32FC2,[TL,TR,BR,BL flattened])`
- `dstPts = cv.matFromArray(4,1,cv.CV_32FC2,[0,0, w-1,0, w-1,h-1, 0,h-1])`
- `M = cv.getPerspectiveTransform(srcPts, dstPts)`
- `cv.warpPerspective(src, warped, M, new cv.Size(w,h), cv.INTER_LINEAR, cv.BORDER_REPLICATE, new cv.Scalar())`

## Cleanup modes
- `color`: warped as is.
- `gray`: `cvtColor` to GRAY.
- `bw` (default): GRAY → `cv.adaptiveThreshold(gray, bw, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 21, 10)` (blockSize must be odd).
- Convert back with `cv.COLOR_GRAY2RGBA` before returning ImageData.

## Must
- Every Mat follows the `cv-mat-memory-hygiene` skill.
- Return plain JS (`{corners, found}` or ImageData), never a Mat.
- Tune against `samples/` and record the chosen parameters in the hand-off log.
