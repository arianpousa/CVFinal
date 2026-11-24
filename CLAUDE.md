# CLAUDE.md: Smart Document Scanner team

## Project
A **100 % browser-only** Smart Document Scanner. The user uploads a photo of a receipt or page, or captures one with the webcam. The app finds the page edges, flattens the page with a perspective warp, cleans it into a crisp black-and-white scan, and saves it to a library that survives a page refresh.

- **OpenCV.js** (OpenCV compiled to **WebAssembly**) does the computer vision. It loads **once**, inside a **Web Worker**, so the page never freezes. Every `cv.Mat` is deleted.
- **IndexedDB** stores the scan library (Blobs plus metadata), settings and history. A **Reset app data** button always works.
- Deployed to **Netlify as a static site**: no build step, publish directory `.`, no servers, no API keys. Every push to `main` redeploys.

Research: `docs/README.md` (index) · Team design: `docs/expert-roster.md` · Names, models and personalities: `docs/agent-brains.md` · Hand-offs: `docs/handoff-log.md`

## The team (`.claude/agents/`)

| Agent | Model | Role |
|---|---|---|
| `orchestrator` (**Morgan**) | opus | Team lead. Plans, runs experts, routes every hand-off, enforces review, writes the who-did-what summary |
| `opencv-expert` (**Iris**) | opus | Vision pipeline: detect corners, warp, threshold |
| `wasm-expert` (**Theo**) | opus | opencv.js loading, Web Worker protocol, Mat memory, opencv.js caching |
| `indexeddb-expert` (**Archie**) | sonnet | `docscanner` DB: schema, Blob storage, quota, upgrades, Reset |
| `meta-agent` (**Mira**) | sonnet | Maintains agents, skills, knowledge folders and this file |
| `ui-designer-apple-liquid-glass` (**Sable**) | sonnet | Liquid Glass visual system and component styling |
| `ux-designer-apple-hig` (**Wren**) | sonnet | HIG flows, states, accessibility, copy |
| `frontend-engineer` (**Leo**) | sonnet | HTML/CSS/JS shell, camera and canvas, corner editor, library UI, pages |
| `qa-tester` (**Quinn**) | sonnet | Chrome testing (local and live), DevTools, leak and persistence checks |
| `netlify-deployer` (**Piper**) | haiku | `netlify.toml`, headers, deploy and verification |
| `docs-writer` (**Paige**) | haiku | README, How it works, Resources, troubleshooting |

Shared skills live in `.claude/skills/<skill-name>/SKILL.md`. Each agent preloads its skills through the `skills:` frontmatter field, following the matrix in `docs/expert-roster.md`. Every agent preloads `knowledge-lookup` and `handoff-log`.

## How the team works

1. **Start with the orchestrator.** Send build, test or deploy requests to `@agent-orchestrator`.
2. **The orchestrator runs experts in parallel.** Independent tasks are launched as several subagents in the same turn. For example, `opencv-expert`, `wasm-expert`, `indexeddb-expert` and Wren can start at once. Dependent tasks run in sequence.
3. **Agents hand work to each other through the orchestrator.** Only the orchestrator can spawn agents, because every other agent has `disallowedTools: Agent`. An expert finishes, appends an entry to `docs/handoff-log.md`, and returns its result to the orchestrator. The orchestrator then briefs the next agent or the reviewer. Experts never call each other directly.
4. **Peer review is mandatory.** `wasm-expert` reviews OpenCV code for Mat deletion and worker safety. Sable and Wren review the UI. `qa-tester` signs off against `browser-testing-checklist`.
5. **"Before you answer":** each agent first reads `docs/` and its own `knowledge/<agent-name>/docs` and `examples`, then cites official sources.
6. **Finish:** qa-tester runs the checklist, netlify-deployer deploys and verifies, docs-writer updates the README, and the orchestrator writes the "Who did what" section.

## Non-negotiables
- OpenCV.js loads once, in the worker. No CV work on the main thread.
- Every `cv.Mat`, `MatVector` and `contours.get(i)` is deleted (`try/finally`).
- One IndexedDB transaction per logical change. Handle `onversionchange`, `onblocked` and `QuotaExceededError`.
- Self-host a pinned `vendor/opencv-<version>.js`.
- Static site only. Test in Chrome. Commit and push everything to `main`.

## Local dev (Windows)
From the repo root, run `python -m http.server 8080` and open http://localhost:8080 in Chrome. DevTools: **F12**. Hard reload: **Ctrl+Shift+R**.
