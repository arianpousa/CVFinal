# Acceptance checklist (from the assignment guide + rubric)

**Source:** Computer Vision Final Exam guide: https://cvfinal-doc-scanner.netlify.app/guide/

## Requirements to verify
- One app, live on Netlify, **working in Chrome**.
- OpenCV.js performs real, visible computer vision that fits the use case.
- OpenCV.js loads **once**, heavy work runs in a **Web Worker** so the page doesn't freeze, and **every `cv.Mat` is deleted**.
- IndexedDB saves results that **survive a refresh**, and a **"Reset app data"** button exists.
- The repo has `docs/`, `.claude/agents/` (≥ 4: orchestrator, OpenCV.js, WebAssembly, IndexedDB), `.claude/skills/`, and `knowledge/<agent>/` with docs and examples.
- A Resources page lists every project link (official docs, GitHub repo, guide).
- The orchestrator's who-did-what summary is in the repo or README. Everything is on `main`.

## Rubric → check → how we prove it
| Area (pts) | Check | Automated by `examples/smoke-test.cjs` |
|---|---|---|
| Live app (20) | URL opens in Chrome, no console errors | ✔ `no console errors` (run with the live URL) |
| OpenCV.js (20) | page detected, flattened, crisp B&W | ✔ `page detected and flattened`, `output is crisp black & white` |
| WebAssembly (15) | worker, no freezing, Mats deleted | ✔ `opencv.js requested exactly once`, `main thread never froze`, `worker Wasm heap stable` |
| IndexedDB (15) | persists after refresh, Reset works, visible in DevTools | ✔ `scans persist after refresh`, `database visible`, `Reset empties the library`, plus a manual DevTools look (doc 02) |
| Agent team (20) | files exist, skills wired, models set | manual repo review (`meta-agent` audit) |
| Knowledge (10) | real notes with sources and examples on `main` | manual repo review |

## The guide's live test (step 11)
1. Status shows **Ready**. 2. A sample scan works. 3. Scans remain after a refresh.

## Manual extras each release
- Camera: allow, then deny, then no camera.
- Large 12 MP photo. Dark photo. Photo with no page (fallback corners).
- Two tabs open during a DB version bump (blocked-upgrade banner).
- Incognito (data cleared on close, which is expected).
- Keyboard-only pass (Wren's `a11y-check.cjs`). 200 % zoom. Dark mode.
