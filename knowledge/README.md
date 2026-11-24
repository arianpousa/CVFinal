# Team knowledge base

Each agent in `.claude/agents/` has `knowledge/<agent-name>/` with:
- `docs/`: reference notes taken from the **official documentation**, each with its source link
- `examples/`: 2–3 small worked examples that show what good looks like. **Every runnable example was run**, and the results are recorded in that folder's `examples/README.md`.

Every agent file has a **"Before you answer"** section: read every file in your knowledge folder first, and prefer it over memory.

| Agent | Sources | Tested examples (recorded result) |
|---|---|---|
| [opencv-expert](opencv-expert/) | docs.opencv.org: Using OpenCV.js, Mat basics, smoothing, Canny, contours, contour features, geometric transforms, thresholding | full pipeline on OpenCV.js 4.10.0: **10/10**, corners within 1.4 px, heap flat over 200 scans; leak demo 128 → 512 MiB without `delete()` |
| [wasm-expert](wasm-expert/) | webassembly.org; MDN WebAssembly, instantiateStreaming, Memory, Web Workers, Transferables | hand-built `.wasm` (memory, grow, MIME TypeError): **10/10**; worker client with timeout/respawn: **10/10**; transfer vs copy 48 MB: **4/4** |
| [indexeddb-expert](indexeddb-expert/) | MDN IndexedDB API, Using IndexedDB, Storage quotas; Chrome DevTools IndexedDB | `db.js` against a spec-compliant IndexedDB: **19/19** (Blobs, upgrades, onblocked, VersionError, rollback, Reset) |
| [ui-designer-apple-liquid-glass](ui-designer-apple-liquid-glass/) (Sable) | Apple HIG: Materials (Liquid Glass), Color, Dark Mode, Typography, Accessibility, Motion | contrast check **18/18** (after fixing 2 real failures); Chrome render **3/3** (44 px targets, blur, reduced motion) + screenshots |
| [ux-designer-apple-hig](ux-designer-apple-hig/) (Wren) | Apple HIG: Accessibility, Writing, Loading, Motion; MDN getUserMedia | keyboard-only corner editor in Chrome: **11/11** |
| [frontend-engineer](frontend-engineer/) | MDN getUserMedia, toBlob, Transferables, Workers | upload + **fake camera** in Chrome: **7/7** |
| [qa-tester](qa-tester/) | assignment guide + rubric; Chrome DevTools; MDN | **end-to-end in Chrome** (worker + OpenCV.js + IndexedDB): **10/10**: Ready in 0.8 s, max UI stall 22 ms, heap flat, persists after reload, Reset works |
| [netlify-deployer](netlify-deployer/) | Netlify headers, file-based configuration | config gate **6/6** (and correctly fails an unversioned vendor file); live-header checker self-test **7/7** |
| [docs-writer](docs-writer/) | all official links; HIG Writing; assignment guide | Resources page gate **11/11** (after catching a missing link) |
| [meta-agent](meta-agent/) | Claude Code subagents and skills docs | team audit of this repo: all agents and skills pass |
| [orchestrator](orchestrator/) | Claude Code subagents; assignment guide step 9 | build plan → **8 parallel waves**, validated |

Bugs and wrong assumptions found **by running the examples** (now written into the notes and skills):
1. The OpenCV.js 4.10 module is a thenable, so `await cv` / `return cv` from async code hangs forever.
2. Inside an IndexedDB `tx.onerror`, `tx.error` is still `null`. Use `event.target.error`.
3. An idle IndexedDB transaction auto-commits. Awaiting `canvas.toBlob()` mid-transaction gives `InvalidStateError` and nothing is written.
4. 72 %-opaque glass with `#5f5f66` secondary text fails 4.5:1. The fix is 85 % glass and `#57575e`.
5. The draft Resources page was missing the Smoothing tutorial link.
