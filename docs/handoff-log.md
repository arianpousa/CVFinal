# Hand-off log

Format: `.claude/skills/handoff-log/SKILL.md`. One entry per hand-off or review, append only. Times are approximate local time (UTC−5).

> **How this run was executed (read first).** The plan below was made for the 11-agent team (`docs/build-plan.json`, validated by `plan_waves.py`: 11 tasks, 7 waves, up to 4 in parallel). In this session the orchestrator had **no Agent tool**, so it could not spawn subagents. Morgan (orchestrator) therefore carried out each expert's task **in sequence, in that expert's role**: reading that expert's `knowledge/<agent>/` folder first, building from its tested examples, and reviewing with the named reviewer's checklist. Entries are signed with the role whose work they record, plus "via Morgan". The waves show the dependency order and what could have run in parallel; they did not run concurrently. Every review finding below is real and was fixed and re-tested.

## 2026-11-24 13:12 · orchestrator → (plan) → wave 1: opencv-expert, wasm-expert, indexeddb-expert, ux-designer-apple-hig
- **Task:** plan the build from `knowledge/orchestrator/examples/build-plan.json`, adapted: original + result Blob storage, sample-photo generator, committed tests, README task.
- **Files:** docs/build-plan.json
- **Decisions:** `plan_waves.py docs/build-plan.json` → wave 1 {cv-pipeline, worker, storage, ux-flow} · wave 2 {hosting, ui-system} · wave 3 {app-shell} · wave 4 {pages} · wave 5 {qa-local} · wave 6 {readme} · wave 7 {summary}; disjoint files per wave; ALL PASSED. Pinned OpenCV.js 4.10.0 self-hosted as `vendor/opencv-4.10.0.js`.
- **Review:** n/a (plan) · **Open issues:** live deploy + live QA need the user to connect the repo in Netlify.

## 2026-11-24 13:20 · Iris (opencv-expert) via Morgan → orchestrator → Theo (wasm-expert, review)
- **Task:** cv-pipeline: page detection, perspective warp, B&W cleanup, two sample photos.
- **Files:** src/scanner-pipeline.js, tools/make_samples.py, samples/receipt.jpg, samples/letter.jpg, samples/truth.json, tests/unit/pipeline.test.mjs
- **Decisions:** built from the tested example (Canny 75/200 + 3×3 dilate, ε = 0.02·perimeter, Gaussian adaptive threshold C = 10; docs: https://docs.opencv.org/4.x/dc/dcf/tutorial_js_contour_features.html, https://docs.opencv.org/4.x/d7/dd0/tutorial_js_thresholding.html). Added: (1) Otsu + morphological-close fallback before the full-frame fallback; (2) true aspect-ratio estimate from the 4 corners (Zhang & He 2007) because max-edge sizing squashed the angled letter (1374×1165 for a portrait page); (3) blockSize scales with page size. Samples are rendered with a pinhole-camera projection (no internet for real photos), desk texture, uneven light, shadow, blur, noise, JPEG.
- **Found by own tests and fixed:** the Otsu fallback accepted the whole frame on a blank image → reject quads > 98 % of the image.
- **Review:** pending · **Open issues:** none

## 2026-11-24 13:31 · Theo (wasm-expert) via Morgan → orchestrator → Iris (opencv-expert, review)
- **Task:** worker: load opencv.js once in a classic worker, message protocol, client with timeouts/respawn.
- **Files:** cv-worker.js, src/cv-client.js, vendor/opencv-4.10.0.js, tests/unit/cv-client.test.mjs
- **Decisions:** `importScripts` once, `Module.onRuntimeInitialized` + thenable callback, never `await cv` (https://docs.opencv.org/4.x/d0/d84/tutorial_js_usage.html). ImageData buffers transferred both ways (https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects). Client = tested `cv-client.js` + respawn cap (3), `restart()` for "Try again", `fatal` → no respawn, `{willRespawn}` passed to the UI. Copied 10,378,215-byte opencv.js from `@techstark/opencv-js@4.10.0-release.1` (repackaged official 4.10.0, one-line `var Module` patch).
- **Review:** pending · **Open issues:** none

## 2026-11-24 13:36 · Archie (indexeddb-expert) via Morgan → orchestrator → Quinn (qa-tester, review)
- **Task:** storage: `docscanner` v1 storing original AND result Blobs + thumbnail with name and date; blocked upgrade; Reset.
- **Files:** src/db.js, tests/unit/db.test.mjs
- **Decisions:** `blobs` = {scanId, original, result, thumb}; `scans` = metadata incl. name, createdAt, sizes, corners; indexes createdAt + name. Kept version 1 (nothing deployed) with the additive `oldVersion` upgrade path and a v2 block exercised by tests. Added `onUnblocked`, `getImages`, `requestPersist`. One readwrite transaction per save, Blobs created before it; `txDone` reads `e.target.error` (https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB).
- **Review:** pending · **Open issues:** none

## 2026-11-24 13:40 · Wren (ux-designer-apple-hig) via Morgan → orchestrator → Sable (ui-designer-apple-liquid-glass, review)
- **Task:** ux-flow: 3-step flow, every state (loading, working, done, error, no page, empty, camera denied, storage full, blocked/outdated/closed DB), copy deck, a11y acceptance.
- **Files:** docs/design/flow-spec.md
- **Decisions:** library and upload usable while OpenCV loads (HIG Loading); only Save + mode toggle disabled while working; Reset always available; descriptive links.
- **Review:** pending · **Open issues:** none

## 2026-11-24 13:42 · reviews of wave 1 (orchestrator routes each result to its reviewer)
- **Theo (wasm-expert) reviews Iris's pipeline** with `cv-mat-memory-hygiene`: every Mat, MatVector, `contours.get(i)`, `approx` and the `getPerspectiveTransform` result is deleted in `finally`; pixels copied out before delete. **Approved**: pipeline.test 21/21, Wasm heap 128 → 128 MiB over 400 synthetic + 20 full-size scans.
- **Iris (opencv-expert) reviews Theo's worker** with `web-worker-protocol`: **changes requested**: `markReady()` set `ready = true` before reading `self.cv.getBuildInformation()`; if the runtime callback fires during `importScripts` (before the UMD wrapper assigns `self.cv`), that read throws and the second call returns early, so `ready` is never posted. → Theo fixed it (wait until `cv.Mat` exists, version read in try/catch). **Re-review approved**; cv-client.test 15/15; real Chrome reaches Ready.
- **Quinn (qa-tester) reviews Archie's storage**: **approved**: db.test 24/24 (Blob round-trip of original + result, refresh, atomic delete, ConstraintError rollback, InvalidStateError when awaiting inside a transaction, v1→v2 with onversionchange, VersionError, onBlocked → onUnblocked, QuotaExceededError, Reset with a blocking tab).
- **Sable reviews Wren's flow spec**: **approved**; status pill keeps color + icon + text.

## 2026-11-24 13:46 · Piper (netlify-deployer) via Morgan → orchestrator → Theo (wasm-expert, review)
- **Task:** hosting: netlify.toml.
- **Files:** netlify.toml
- **Decisions:** publish ".", empty build, `/vendor/*` immutable 1-year cache, `/*.wasm` application/wasm, nosniff, Referrer-Policy, `Permissions-Policy: camera=(self)`, X-Frame-Options DENY (https://docs.netlify.com/manage/routing/headers/).
- **Review:** Theo, **approved**: validate_config.py 7/7; check-live-headers --self-test pass. Note: no CSP on purpose (a CSP would need `'wasm-unsafe-eval'` for OpenCV.js).
- **Open issues:** live header check after the site is connected.

## 2026-11-24 13:48 · Sable (ui-designer-apple-liquid-glass) via Morgan → orchestrator → Wren (review)
- **Task:** ui-system: styles.css.
- **Files:** styles.css
- **Decisions:** tested tokens verbatim (glass 85 %, `--text-2 #57575e`), glass only on top bar/pill/banners/dialogs, solid content cards, one accent, light/dark, Reduce Motion/Transparency/Increase Contrast (https://developer.apple.com/design/human-interface-guidelines/materials).
- **Review:** Wren, **approved** after the app-shell visual pass below. contrast.test (on the real styles.css) 18/18.

## 2026-11-24 13:58 · Leo (frontend-engineer) via Morgan → orchestrator → Wren + Sable (review)
- **Task:** app-shell: index.html, app.js, capture, corner editor, library, viewer (original + scan), Reset.
- **Files:** index.html, app.js, src/capture.js
- **Decisions:** reuses cv-client, db.js, capture.js and Wren's corner-editor pattern; detection on a 1000 px copy, preview on 1200 px, save on the full image (≤ 4000 px); main thread only scales with canvas. Removed a `<link rel="prefetch">` for opencv.js (Chrome's prefetch cache could fetch the 10 MB file twice, breaking "loads once").
- **Review:** **Sable, changes requested**: (1) library thumbnails cropped (percentage height inside aspect-ratio box); (2) dashed black ticks on the B&W page edge (routed to Iris: corners mapped a few px outside the output, outer pixel frame painted white; new border test 0.06 % dark); (3) sticky bar covered the scrolled-to card (scroll-margin); (4) card date wrapped to 2 lines (short date on cards). **Wren, changes requested**: during a blocked upgrade the library said "No scans yet", which is misleading (now "Opening library…" / "Library unavailable"). All fixed; **re-review approved**; a11y.e2e 22/22.

## 2026-11-24 14:05 · Paige (docs-writer) via Morgan → orchestrator → Wren (review)
- **Task:** pages: How it works + Resources, linked from the app.
- **Files:** how-it-works.html, resources.html
- **Decisions:** plain-language sections for OpenCV.js, WebAssembly, Web Worker, IndexedDB; Troubleshooting table + Windows DevTools steps (F12 / Ctrl+Shift+I, Ctrl+Shift+R) at `#troubleshooting` (the error banner links there). Resources generated from the canonical list `knowledge/docs-writer/docs/01-official-links.md`.
- **Review:** check-resources first run **failed** "no duplicate links" (nav links repeated in the list) → fixed → 11/11 (38 links). Wren **approved** link text.

## 2026-11-24 14:20 · Quinn (qa-tester) via Morgan → orchestrator (sign-off requested)
- **Task:** qa-local with `browser-testing-checklist`, real app, headless Google Chrome, both sample photos.
- **Files:** tests/e2e/app.e2e.cjs, tests/e2e/a11y.e2e.cjs, tests/unit/contrast.test.mjs, tests/package.json, docs/screenshots/
- **Bugs filed (owner):** #3-edge, **Leo**: when no page is found, corners were the 1000 px full frame scaled up (1198.8 instead of 1199) → app now uses the source full frame. Test bugs (Quinn's own): rename check raced the re-render; screenshot waits used a stale preview → fixed.
- **Result:** app.e2e **39/39**, a11y.e2e **22/22**, unit 21 + 15 + 24, contrast 18/18 (numbers in README).
- **Review:** orchestrator **approved** (sign-off).

## 2026-11-24 14:25 · Paige (docs-writer) via Morgan → orchestrator → Piper (netlify-deployer, review)
- **Task:** README: features, run on Windows, deploy to Netlify step by step, troubleshooting, tests, team.
- **Files:** README.md
- **Review:** Piper **approved** the deploy steps against netlify.toml (publish ".", empty build, connect `arianpousa/CVFinal` `main`).

## 2026-11-24 14:28 · orchestrator → (summary) → Paige (docs-writer, review)
- **Task:** "Who did what" section in README from this log; final gates: validate_config 7/7, check-resources 11/11, audit_team (11 agents, 14 skills) ALL PASSED, plan_waves ALL PASSED.
- **Review:** Paige **approved**.
- **Open issues:** deploy + live QA (`node e2e/app.e2e.cjs https://<site>.netlify.app/`, `check-live-headers.mjs`) after the user connects the repo in Netlify.
