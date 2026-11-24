# Smart Document Scanner: Research Docs

Background research for a **100 % in-browser** document scanner built on **OpenCV.js** (OpenCV compiled to WebAssembly), with scans saved in **IndexedDB** and the app deployed as a static site on **Netlify**. These files are the shared context for the expert agent team in `.claude/agents/`.

## Use case

The user uploads a photo of a receipt or page, or takes one with the webcam. The app:
1. finds the page edges (grayscale → blur → Canny → contours → 4-corner polygon),
2. flattens the page with a perspective warp,
3. cleans it into a crisp black-and-white scan (adaptive threshold),
4. saves every scan to a library in IndexedDB that survives page refreshes.

No server, no API key. All processing runs in a Web Worker so the page never freezes.

## Index

| # | File | Topic | Primary agent |
|---|---|---|---|
| 01 | [01-opencv-js-functions.md](01-opencv-js-functions.md) | Pipeline, loading `opencv.js` and readiness, function signatures (imread, cvtColor, GaussianBlur, Canny, findContours, approxPolyDP, getPerspectiveTransform, warpPerspective, adaptiveThreshold, imshow) | OpenCV.js expert |
| 02 | [02-webassembly-and-workers.md](02-webassembly-and-workers.md) | Why Wasm is fast, the Emscripten heap, why every `cv.Mat` must be deleted, Web Worker architecture | WebAssembly expert |
| 03 | [03-indexeddb-design.md](03-indexeddb-design.md) | Schema for scans (Blobs), settings and history; versions, transactions, quotas, Reset button | IndexedDB expert |
| 04 | [04-netlify-hosting.md](04-netlify-hosting.md) | Serving the ~10 MB `opencv.js` (embedded Wasm), MIME types, cache headers, `netlify.toml` | WebAssembly expert / orchestrator |
| 05 | [05-troubleshooting-hangs.md](05-troubleshooting-hangs.md) | Why it hangs (stuck worker, blocked upgrade, memory) and fixes in Chrome DevTools | all |
| — | [expert-roster.md](expert-roster.md) | The 11-agent team, one-line jobs, shared skills matrix, lifecycle and rubric coverage | orchestrator / meta-agent |
| — | [agent-brains.md](agent-brains.md) | Each agent's name, model (and why), personality and knowledge folder | meta-agent |

Per-agent reference notes and **tested** examples live in [`../knowledge/`](../knowledge/README.md).

## Key decisions

- **Self-host a pinned `opencv.js`** (4.10.0, 10.4 MB raw / ~3.4 MB gzip, Wasm embedded as base64) under `/vendor/`, with a long-lived immutable cache header.
- **Load OpenCV once, inside a classic Web Worker** via `importScripts`. Use a loader that handles both `Module.onRuntimeInitialized` and Promise-style `cv`.
- **`try/finally` delete pattern** for every Mat. Transfer `ImageData` buffers (zero-copy) between threads.
- **IndexedDB `docscanner` v1**: `scans` (metadata), `blobs` (full + thumbnail), `settings`, `history`. One transaction per logical save. Handle `onversionchange`/`onblocked`.
- **"Reset app data"** button always available, plus a DevTools troubleshooting guide.

## Official sources consulted

- OpenCV.js tutorials: https://docs.opencv.org/4.13.0/d5/d10/tutorial_js_root.html (the 4.13.0 root URL returned an error when fetched, so its 4.x pages were used: [Using OpenCV.js](https://docs.opencv.org/4.x/d0/d84/tutorial_js_usage.html), [Smoothing](https://docs.opencv.org/4.x/dd/d6a/tutorial_js_filtering.html), [Thresholding](https://docs.opencv.org/4.x/d7/dd0/tutorial_js_thresholding.html), [Contours: Getting Started](https://docs.opencv.org/4.x/d5/daa/tutorial_js_contours_begin.html), [Contour Features](https://docs.opencv.org/4.x/dc/dcf/tutorial_js_contour_features.html), [Geometric Transformations](https://docs.opencv.org/4.x/dd/d52/tutorial_js_geometric_transformations.html))
- WebAssembly: https://webassembly.org/ · MDN https://developer.mozilla.org/en-US/docs/WebAssembly
- IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API · [Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) · [Storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- Web Workers: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
- Chrome DevTools IndexedDB: https://developer.chrome.com/docs/devtools/storage/indexeddb
- Netlify custom headers: https://docs.netlify.com/manage/routing/headers/

> Items marked *(general API knowledge — verify)* weren't confirmed on a fetched official page. Agents should check them against the linked docs before relying on them.
