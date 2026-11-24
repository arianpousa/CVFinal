---
name: cv-mat-memory-hygiene
description: "Rules and patterns for freeing OpenCV.js memory: delete every cv.Mat/MatVector, try/finally tracking, leak testing. Use whenever code creates OpenCV.js objects or when reviewing such code."
---
# cv.Mat memory hygiene

Why: Mats live in the Emscripten (WebAssembly) heap; the JS garbage collector never frees them.
Official rule: call `delete()` on every `cv.Mat` (see `docs/02-webassembly-and-workers.md`).

## Must delete
`new cv.Mat()`, `cv.MatVector`, `contours.get(i)`, `cv.matFromArray`, `cv.matFromImageData`,
`cv.imread`, the Mat returned by `cv.getPerspectiveTransform`, `cv.Mat.ones/zeros/eye` kernels.

## Pattern
```js
const mats = [];
const T = m => (mats.push(m), m);
try {
  const src = T(cv.matFromImageData(img));
  const gray = T(new cv.Mat());
  // ...
  for (let i = 0; i < contours.size(); i++) {
    const c = contours.get(i);       // must delete
    try { /* ... */ } finally { c.delete(); }
  }
  return plainResult;
} finally {
  mats.forEach(m => { if (!m.isDeleted()) m.delete(); });
}
```

## Review checklist
- [ ] Every allocation is tracked or deleted in `finally`.
- [ ] Loop-created Mats are deleted inside the loop.
- [ ] No Mat escapes the function (return JS data only).
- [ ] Early `return`/`throw` paths still free memory (that is what `finally` is for).

## Leak test
Run the same sample scan 20× in Chrome; worker memory (DevTools → Memory / Performance monitor) must plateau.
