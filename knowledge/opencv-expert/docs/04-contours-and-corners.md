# Contours and 4-corner detection

**Sources:** Contours: Getting Started: https://docs.opencv.org/4.x/d5/daa/tutorial_js_contours_begin.html (OpenCV 5 mirror: https://docs.opencv.org/5.0/js_tutorials/js_imgproc/js_contours/js_contours_begin/js_contours_begin.html) · Contour Features: https://docs.opencv.org/4.x/dc/dcf/tutorial_js_contour_features.html · Python contours tutorial (same API semantics): https://docs.opencv.org/4.x/d4/d73/tutorial_py_contours_begin.html

## findContours
`cv.findContours(image, contours, hierarchy, mode, method, offset = new cv.Point(0, 0))`
- `image` is 8-bit single-channel, and non-zero pixels count as 1. Use thresholded or Canny output.
- The object should be **white on a black background**. Since OpenCV 3.2 the source isn't modified.
- `contours` is a `cv.MatVector`. `hierarchy` is a `cv.Mat` (one entry per contour).
- `CHAIN_APPROX_SIMPLE` compresses straight segments to their endpoints. The Python tutorial's rectangle example stores only 4 points instead of 734 with `CHAIN_APPROX_NONE`.
- Mode `cv.RETR_EXTERNAL` keeps only outer contours, which is what we want for a page.
- `drawContours(image, contours, idx, color, thickness, …)` is useful for a debug overlay.

## Contour features
- `cv.contourArea(cnt, oriented = false)` returns the area.
- `cv.arcLength(cnt, closed)` returns the perimeter.
- `cv.approxPolyDP(curve, approxCurve, epsilon, closed)` is Douglas-Peucker simplification. `epsilon` is the maximum distance from the original.
- `cv.isContourConvex(cnt)` returns a boolean.

## Our page rule (tested)
Sort by area and look at the top 5. Skip anything under 20 % of the image. Use `approxPolyDP(c, approx, 0.02 * arcLength(c, true), true)`. Accept `approx.rows === 4 && isContourConvex(approx)`.
- `approx` is `CV_32SC2`, so read it with `approx.data32S` as `[x0,y0,x1,y1,…]`.
- Every `contours.get(i)` and `approx` must be deleted, inside the loop.
- Order the corners TL, TR, BR, BL (smallest x+y is TL and largest is BR; smallest y−x is TR and largest is BL).
- If nothing qualifies, fall back to the full image rectangle with `found:false`.
