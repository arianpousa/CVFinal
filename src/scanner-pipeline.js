// scanner-pipeline.js: the Smart Document Scanner vision pipeline (opencv-expert, Iris).
// Pure functions that take the `cv` object as their first argument, so the same code runs
// inside the Web Worker (cv from importScripts) and in Node tests (cv from npm).
// Built from the tested example knowledge/opencv-expert/examples/scanner-pipeline.js.
//
// Sources:
//   Mat basics + delete():      https://docs.opencv.org/4.x/de/d06/tutorial_js_basic_ops.html
//   GaussianBlur:               https://docs.opencv.org/4.x/dd/d6a/tutorial_js_filtering.html
//   Canny:                      https://docs.opencv.org/5.x/d7/de1/tutorial_js_canny.html
//   findContours:               https://docs.opencv.org/4.x/d5/daa/tutorial_js_contours_begin.html
//   arcLength / approxPolyDP:   https://docs.opencv.org/4.x/dc/dcf/tutorial_js_contour_features.html
//   getPerspectiveTransform:    https://docs.opencv.org/4.x/dd/d52/tutorial_js_geometric_transformations.html
//   threshold / adaptiveThreshold (Otsu, Gaussian C): https://docs.opencv.org/4.x/d7/dd0/tutorial_js_thresholding.html
//
// Memory rule: every cv.Mat / cv.MatVector / contours.get(i) is deleted in a finally block.
// Verified by tests/unit/pipeline.test.mjs (no Wasm heap growth over repeated scans).

/** Order 4 points as [TL, TR, BR, BL]. Pure JS, no OpenCV. */
function orderCorners(pts) {
  const bySum = [...pts].sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const byDiff = [...pts].sort((a, b) => (a.y - a.x) - (b.y - b.x));
  return [bySum[0], byDiff[0], bySum[3], byDiff[3]];
}

/** Full-image rectangle, used when no page is found so the user can drag the corners. */
function fullFrame(width, height) {
  const w = width - 1, h = height - 1;
  return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
}

/**
 * Look for the largest convex 4-corner contour in a binary (edge or mask) image.
 * Deletes every Mat it creates, including each contours.get(i).
 * @returns {{x,y}[] | null}
 */
function findQuad(cv, binary, minArea, maxArea = Infinity) {
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  try {
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    const ranked = [];
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);                   // get() returns a new Mat handle: must delete
      try { ranked.push({ i, area: cv.contourArea(c, false) }); } finally { c.delete(); }
    }
    ranked.sort((a, b) => b.area - a.area);
    for (const { i, area } of ranked.slice(0, 5)) {
      if (area < minArea) break;
      if (area > maxArea) continue;              // the whole frame is not a page (e.g. a uniform image)
      const c = contours.get(i);
      const approx = new cv.Mat();
      try {
        const peri = cv.arcLength(c, true);
        cv.approxPolyDP(c, approx, 0.02 * peri, true);
        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          const p = approx.data32S;                // CV_32SC2: x0,y0,x1,y1,...
          return orderCorners([0, 1, 2, 3].map((k) => ({ x: p[2 * k], y: p[2 * k + 1] })));
        }
      } finally { c.delete(); approx.delete(); }
    }
    return null;
  } finally {
    contours.delete(); hierarchy.delete();
  }
}

/**
 * Find the page's 4 corners.
 * Strategy 1 (tested default): gray -> 5x5 Gaussian blur -> Canny(75, 200) -> 3x3 dilate -> contours.
 * Strategy 2 (fallback for low-contrast edges): Otsu threshold of the blurred gray -> close -> contours.
 * If both fail: the full frame with found:false.
 * @param imageData  {data: Uint8ClampedArray (RGBA), width, height}
 * @param opts       {cannyLow, cannyHigh, minAreaRatio}
 * @returns {{found: boolean, corners: {x,y}[], method: 'canny'|'otsu'|'none'}} plain JS only, never a Mat
 */
function detectPage(cv, imageData, opts = {}) {
  const { cannyLow = 75, cannyHigh = 200, minAreaRatio = 0.2 } = opts;
  const minArea = minAreaRatio * imageData.width * imageData.height;
  const mats = [];
  const T = (m) => (mats.push(m), m);              // track every allocation
  try {
    const src = T(cv.matFromImageData(imageData));
    const gray = T(new cv.Mat());
    const blur = T(new cv.Mat());
    const edges = T(new cv.Mat());
    const kernel = T(cv.Mat.ones(3, 3, cv.CV_8U));

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    cv.Canny(blur, edges, cannyLow, cannyHigh, 3, false);
    cv.dilate(edges, edges, kernel);               // close small gaps in the border
    let corners = findQuad(cv, edges, minArea);
    if (corners) return { found: true, corners, method: 'canny' };

    const mask = T(new cv.Mat());
    const big = T(cv.Mat.ones(9, 9, cv.CV_8U));
    cv.threshold(blur, mask, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);   // paper is brighter than the desk
    cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, big);
    corners = findQuad(cv, mask, minArea, 0.98 * imageData.width * imageData.height);
    if (corners) return { found: true, corners, method: 'otsu' };

    return { found: false, corners: fullFrame(imageData.width, imageData.height), method: 'none' };
  } finally {
    mats.forEach((m) => { if (!m.isDeleted()) m.delete(); });
  }
}

/**
 * Output size for the flattened page. Max-edge sizing alone squashes a page photographed at an
 * angle (the far edge looks short), so we also estimate the page's TRUE width/height ratio from the
 * 4 corners with a pinhole-camera model: Zhang & He, "Whiteboard scanning and image enhancement",
 * Digital Signal Processing 17(2), 2007 (https://www.microsoft.com/en-us/research/publication/whiteboard-scanning-image-enhancement/).
 * The principal point is assumed at the image centre. If the focal-length estimate is not physically
 * plausible (f^2 <= 0, or far outside 0.2x..10x the image size) we fall back to max-edge sizing.
 * Pure JS, no OpenCV.
 * @returns {{W, H, aspect: number|null}} aspect = estimated width/height, or null when it fell back
 */
function pageSize(corners, imgW, imgH) {
  const [tl, tr, br, bl] = corners;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const maxW = Math.max(dist(tr, tl), dist(br, bl));
  const maxH = Math.max(dist(bl, tl), dist(br, tr));
  const fallback = { W: Math.max(1, Math.round(maxW)), H: Math.max(1, Math.round(maxH)), aspect: null };
  const v = (p) => [p.x, p.y, 1];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const m1 = v(tl), m2 = v(tr), m3 = v(bl), m4 = v(br);
  const k2 = dot(cross(m1, m4), m3) / dot(cross(m2, m4), m3);
  const k3 = dot(cross(m1, m4), m2) / dot(cross(m3, m4), m2);
  const n2 = m2.map((c, i) => k2 * c - m1[i]);
  const n3 = m3.map((c, i) => k3 * c - m1[i]);
  const u0 = imgW / 2, v0 = imgH / 2;
  let aspect;
  if (Math.abs(n2[2] * n3[2]) < 1e-9) {
    aspect = Math.sqrt((n2[0] ** 2 + n2[1] ** 2) / (n3[0] ** 2 + n3[1] ** 2));   // no perspective: affine case
  } else {
    const f2 = -((n2[0] * n3[0] - (n2[0] * n3[2] + n2[2] * n3[0]) * u0 + n2[2] * n3[2] * u0 * u0) +
                 (n2[1] * n3[1] - (n2[1] * n3[2] + n2[2] * n3[1]) * v0 + n2[2] * n3[2] * v0 * v0)) / (n2[2] * n3[2]);
    const side = Math.max(imgW, imgH);
    if (!(f2 > 0) || Math.sqrt(f2) < 0.2 * side || Math.sqrt(f2) > 10 * side) return fallback;
    const f = Math.sqrt(f2);
    const q = (n) => [(n[0] - u0 * n[2]) / f, (n[1] - v0 * n[2]) / f, n[2]];   // A^-1 n
    aspect = Math.sqrt(dot(q(n2), q(n2)) / dot(q(n3), q(n3)));
  }
  if (!Number.isFinite(aspect) || aspect < 0.1 || aspect > 10) return fallback;
  // Keep the larger of the two consistent sizes so no detail is lost.
  const a = { W: maxW, H: maxW / aspect }, b = { W: maxH * aspect, H: maxH };
  const pick = a.W * a.H >= b.W * b.H ? a : b;
  return { W: Math.max(1, Math.round(pick.W)), H: Math.max(1, Math.round(pick.H)), aspect };
}

/**
 * Flatten the page and clean it up.
 * @param mode 'color' | 'gray' | 'bw'
 * @param opts {blockSize (odd), C, keepAspect}: adaptive threshold parameters (blockSize scales with
 *             the page if omitted); keepAspect (default true) corrects perspective foreshortening
 * @returns {{data: Uint8ClampedArray, width, height, aspect}} RGBA, ready for new ImageData(...)
 */
function processScan(cv, imageData, corners, mode = 'bw', opts = {}) {
  const [tl, tr, br, bl] = corners;
  const size = opts.keepAspect === false
    ? pageSize(corners, NaN, NaN)            // NaN centre -> invalid focal length -> max-edge fallback
    : pageSize(corners, imageData.width, imageData.height);
  const { W, H } = size;
  // Neighbourhood ~2 % of the short side (21 px at ~1000 px), always odd and >= 11.
  const auto = Math.max(11, Math.round(Math.min(W, H) * 0.02) | 1);
  const { blockSize = auto, C = 10 } = opts;

  const mats = [];
  const T = (m) => (mats.push(m), m);
  try {
    const src = T(cv.matFromImageData(imageData));
    const srcPts = T(cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]));
    // Map the corners a few pixels OUTSIDE the output so the paper's own edge (and any sliver of desk
    // a hand-placed corner includes) is cropped away; otherwise the threshold turns it into black ticks.
    const m = Math.max(2, Math.round(0.006 * Math.min(W, H)));
    const dstPts = T(cv.matFromArray(4, 1, cv.CV_32FC2, [-m, -m, W - 1 + m, -m, W - 1 + m, H - 1 + m, -m, H - 1 + m]));
    const M = T(cv.getPerspectiveTransform(srcPts, dstPts));     // returns a Mat: delete it too
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
        // The outermost pixel row/column thresholds dark at the image border (measured: 89 % of the top row); paint it white.
        cv.rectangle(bw, new cv.Point(0, 0), new cv.Point(W - 1, H - 1), new cv.Scalar(255), 1);
        single = bw;
      }
      out = T(new cv.Mat());
      cv.cvtColor(single, out, cv.COLOR_GRAY2RGBA);
    }
    // Copy out of the Wasm heap BEFORE the Mats are deleted.
    return { data: new Uint8ClampedArray(out.data), width: out.cols, height: out.rows, aspect: size.aspect };
  } finally {
    mats.forEach((m) => { if (!m.isDeleted()) m.delete(); });
  }
}

if (typeof module !== 'undefined') module.exports = { orderCorners, fullFrame, findQuad, detectPage, pageSize, processScan };
