// scanner-pipeline.js: worked example of the Smart Document Scanner vision pipeline.
// Pure functions that take the `cv` object as their first argument, so the same code
// runs inside the Web Worker (cv from importScripts) and in Node tests (cv from npm).
//
// Sources:
//   Mat basics + delete():      https://docs.opencv.org/4.x/de/d06/tutorial_js_basic_ops.html
//   GaussianBlur:               https://docs.opencv.org/4.x/dd/d6a/tutorial_js_filtering.html
//   Canny:                      https://docs.opencv.org/5.x/d7/de1/tutorial_js_canny.html
//   findContours:               https://docs.opencv.org/4.x/d5/daa/tutorial_js_contours_begin.html
//   arcLength / approxPolyDP:   https://docs.opencv.org/4.x/dc/dcf/tutorial_js_contour_features.html
//   getPerspectiveTransform:    https://docs.opencv.org/4.x/dd/d52/tutorial_js_geometric_transformations.html
//   adaptiveThreshold:          https://docs.opencv.org/4.x/d7/dd0/tutorial_js_thresholding.html
//
// Verified by run-tests.mjs (see README.md in this folder).

/** Order 4 points as [TL, TR, BR, BL]. Pure JS, no OpenCV. */
function orderCorners(pts) {
  const bySum = [...pts].sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const byDiff = [...pts].sort((a, b) => (a.y - a.x) - (b.y - b.x));
  return [bySum[0], byDiff[0], bySum[3], byDiff[3]];
}

/**
 * Find the page's 4 corners.
 * @param cv         the OpenCV.js module
 * @param imageData  {data: Uint8ClampedArray (RGBA), width, height}
 * @param opts       {cannyLow, cannyHigh, minAreaRatio}
 * @returns {{found: boolean, corners: {x,y}[]}} plain JS only, never a Mat
 */
function detectPage(cv, imageData, opts = {}) {
  const { cannyLow = 75, cannyHigh = 200, minAreaRatio = 0.2 } = opts;
  const mats = [];
  const T = (m) => (mats.push(m), m);          // track every allocation
  try {
    const src = T(cv.matFromImageData(imageData));
    const gray = T(new cv.Mat());
    const blur = T(new cv.Mat());
    const edges = T(new cv.Mat());
    const kernel = T(cv.Mat.ones(3, 3, cv.CV_8U));
    const contours = T(new cv.MatVector());
    const hierarchy = T(new cv.Mat());

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    cv.Canny(blur, edges, cannyLow, cannyHigh, 3, false);
    cv.dilate(edges, edges, kernel);             // close small gaps in the border
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Rank contours by area (read area, then free each contour Mat immediately).
    const ranked = [];
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);                  // get() returns a new Mat handle: must delete
      try { ranked.push({ i, area: cv.contourArea(c, false) }); } finally { c.delete(); }
    }
    ranked.sort((a, b) => b.area - a.area);

    const minArea = minAreaRatio * imageData.width * imageData.height;
    for (const { i, area } of ranked.slice(0, 5)) {
      if (area < minArea) break;
      const c = contours.get(i);
      const approx = new cv.Mat();
      try {
        const peri = cv.arcLength(c, true);
        cv.approxPolyDP(c, approx, 0.02 * peri, true);
        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          const p = approx.data32S;               // CV_32SC2: x0,y0,x1,y1,...
          const pts = [0, 1, 2, 3].map((k) => ({ x: p[2 * k], y: p[2 * k + 1] }));
          return { found: true, corners: orderCorners(pts) };
        }
      } finally { c.delete(); approx.delete(); }
    }
    // Fallback: the whole image, so the user can drag the corners manually.
    const w = imageData.width - 1, h = imageData.height - 1;
    return { found: false, corners: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }] };
  } finally {
    mats.forEach((m) => { if (!m.isDeleted()) m.delete(); });
  }
}

/**
 * Flatten the page and clean it up.
 * @param mode 'color' | 'gray' | 'bw'
 * @returns {{data: Uint8ClampedArray, width, height}} RGBA, ready for new ImageData(...)
 */
function processScan(cv, imageData, corners, mode = 'bw', opts = {}) {
  const { blockSize = 21, C = 10 } = opts;     // blockSize must be odd
  const [tl, tr, br, bl] = corners;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const W = Math.max(1, Math.round(Math.max(dist(tr, tl), dist(br, bl))));
  const H = Math.max(1, Math.round(Math.max(dist(bl, tl), dist(br, tr))));

  const mats = [];
  const T = (m) => (mats.push(m), m);
  try {
    const src = T(cv.matFromImageData(imageData));
    const srcPts = T(cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]));
    const dstPts = T(cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, W - 1, 0, W - 1, H - 1, 0, H - 1]));
    const M = T(cv.getPerspectiveTransform(srcPts, dstPts));   // returns a Mat: delete it too
    const warped = T(new cv.Mat());
    cv.warpPerspective(src, warped, M, new cv.Size(W, H), cv.INTER_LINEAR, cv.BORDER_REPLICATE, new cv.Scalar());

    let out = warped;
    if (mode !== 'color') {
      const gray = T(new cv.Mat());
      cv.cvtColor(warped, gray, cv.COLOR_RGBA2GRAY);
      let single = gray;
      if (mode === 'bw') {
        const bw = T(new cv.Mat());
        cv.adaptiveThreshold(gray, bw, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, blockSize, C);
        single = bw;
      }
      out = T(new cv.Mat());
      cv.cvtColor(single, out, cv.COLOR_GRAY2RGBA);
    }
    // Copy out of the Wasm heap BEFORE the Mats are deleted.
    return { data: new Uint8ClampedArray(out.data), width: out.cols, height: out.rows };
  } finally {
    mats.forEach((m) => { if (!m.isDeleted()) m.delete(); });
  }
}

if (typeof module !== 'undefined') module.exports = { orderCorners, detectPage, processScan };
