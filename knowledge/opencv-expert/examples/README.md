# opencv-expert examples (tested)

| File | Shows |
|---|---|
| `scanner-pipeline.js` | Full worked pipeline: `detectPage(cv, imageData)` → `{found, corners}` and `processScan(cv, imageData, corners, mode)` → RGBA. Every Mat is tracked and deleted in `finally`. Same code runs in the Web Worker. |
| `run-tests.mjs` | 10 checks on a synthetic tilted page: corner order, detection accuracy, blank-image fallback, warp size, pure B&W output, RGBA modes, and **no Wasm heap growth over 200 scans**. |
| `mat-delete-demo.mjs` | Why `delete()` matters: a leaky loop grows the heap, the try/finally loop doesn't. |

## How to run
```bash
mkdir scratch && cd scratch && npm init -y && npm i @techstark/opencv-js@4.10.0-release.1
cp ../knowledge/opencv-expert/examples/* .
node run-tests.mjs
node mat-delete-demo.mjs
```

## Recorded results (2026-11-24, Node 22, OpenCV.js 4.10.0)
```
PASS  orderCorners returns TL,TR,BR,BL
PASS  detectPage found a 4-corner page
PASS  detected corners within 8 px of truth (max error 1.4 px)
PASS  blank image falls back to full frame
PASS  warped size ~ page size (494x394)
PASS  B&W output only contains 0 and 255 (0,255)
PASS  mostly white paper after cleanup (93.1 % white)
PASS  color mode returns RGBA
PASS  gray mode returns RGBA
PASS  no Wasm heap growth over 200 scans (128 MiB -> 128 MiB)
ALL PASSED

mat-delete-demo: start 128 MiB · after 30 clean 128 MiB · after 30 leaky 512 MiB (GREW: leak!)
```
Cross-check: OpenCV-Python 5.0 with the same blur/Canny/dilate/approxPolyDP parameters found the same 4 corners (±1 px).
