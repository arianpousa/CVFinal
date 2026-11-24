# frontend-engineer examples (tested in Chrome)

| File | What good looks like |
|---|---|
| `capture.js` | One ES module for all image I/O: upload with EXIF orientation, camera start/capture/**release**, friendly error copy, 4000 px cap, 1000 px detection copy plus scale, PNG scan and JPEG thumbnail |
| `capture-demo.html` | Minimal wiring with a status line (`aria-live`) |
| `capture-test.cjs` | Real Chrome with a **fake camera device**: upload, scaling math, blobs, capture, tracks ended, denied-camera copy |

Related tested examples you should reuse rather than rewrite:
- `../../wasm-expert/examples/cv-client.js` (worker client)
- `../../indexeddb-expert/examples/db.js` (storage)
- `../../ux-designer-apple-hig/examples/accessible-corner-editor.html` (corner editor)
- `../../ui-designer-apple-liquid-glass/examples/tokens.css` (styles)

## Run
```bash
python -m http.server 8766          # from this folder
npx playwright install chromium && node capture-test.cjs
```

## Recorded result (2026-11-24)
7/7 pass:
- `fitScale` OK
- upload 760×760
- detection copy 1000×750 with scale 4
- PNG plus a smaller JPEG thumbnail
- camera frame 1920×1080
- tracks `ended` after capture
- denied camera shows "Camera access is off. You can upload a photo instead."
