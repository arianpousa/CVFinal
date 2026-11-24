# Expert Roster: Smart Document Scanner

**Project decision:** everything runs in the browser and ships to Netlify as a static site, with no servers and no API keys. OpenCV.js does the computer vision. WebAssembly makes it fast, running inside a Web Worker. IndexedDB keeps the scan library.

Since there is no backend, the roster has **no** backend, database-server, auth, API or cloud-infra roles. Every role below maps to something a static, browser-only app actually needs: vision, Wasm/worker plumbing, local storage, the UI, testing in Chrome, docs, and a Netlify deploy.

Research context for all agents: [`docs/README.md`](README.md).

---

## 1. The team (11 agents)

### Required core (4)

| Agent (file name) | One-line job |
|---|---|
| **`orchestrator`** | Team lead: breaks the build into tasks, routes each one to the right expert, enforces peer review between experts, and keeps the hand-off log and final "who did what" summary. |
| **`opencv-expert`** | Owns the vision pipeline (gray → blur → Canny → contours → 4-corner detection → perspective warp → adaptive threshold) and tunes it on the sample images. |
| **`wasm-expert`** | Owns OpenCV.js loading, the Web Worker, the message protocol, zero-copy transfers, timeouts and `cv.Mat` memory hygiene, plus the Netlify caching rules for the ~10 MB `opencv.js`. |
| **`indexeddb-expert`** | Owns the `docscanner` database: schema and versions, Blob storage for scans and thumbnails, settings, history, quota handling, upgrade blocking and the "Reset app data" button. |

### Required by this project (3)

| Agent (file name) | Persona | One-line job |
|---|---|---|
| **`meta-agent`** | — | Builds and maintains the team itself: writes and edits the `.claude/agents/*.md` and `.claude/skills/*` files, the knowledge folders and `CLAUDE.md`, and checks that every agent follows the "Before you answer" rule. |
| **`ui-designer-apple-liquid-glass`** | **Sable** | Visual designer in the Apple Liquid Glass style: translucent layered surfaces, SF-style type scale, color and motion tokens, light/dark themes, and the look of the scanner, library and settings screens. |
| **`ux-designer-apple-hig`** | **Wren** | Interaction designer grounded in Apple's Human Interface Guidelines: the upload/camera → adjust corners → save flow, empty/loading/error states, accessibility (keyboard, contrast, reduced motion) and copy. |

### Supporting roles a browser-only app needs (4)

| Agent (file name) | One-line job |
|---|---|
| **`frontend-engineer`** | Writes the vanilla HTML/CSS/JS shell: file upload and `getUserMedia` webcam capture, canvas rendering, the draggable corner editor, the library grid, and the How-it-works and Resources pages. Implements Sable's and Wren's designs. |
| **`qa-tester`** | Tests the app in Chrome locally and on the live Netlify URL. Checks that the status shows "Ready", that sample scans work, that data persists after refresh, and that Reset works. Hunts Mat leaks, frozen UI and IndexedDB errors in DevTools, and files bugs back to the owning expert. |
| **`netlify-deployer`** | Owns static hosting: `netlify.toml` (empty build, publish `.`), cache and MIME headers, the pinned `vendor/opencv-<ver>.js`, the deploy steps in the README, and post-deploy `curl -I` header checks. |
| **`docs-writer`** | Keeps the README, the "How it works" page, the Resources page (every official link, the repo and the guide), the troubleshooting table and the `knowledge/<agent>/docs` notes accurate and sourced. |

---

## 2. Skills

Each skill becomes a folder in `.claude/skills/<skill-name>/SKILL.md`. A skill is written once and shared by every agent that lists it.

| Skill | What it teaches |
|---|---|
| `opencv-js-pipeline` | The document-detection and cleanup pipeline, parameter defaults, corner ordering, the full-image fallback |
| `cv-mat-memory-hygiene` | `try/finally` delete pattern, which objects need `.delete()`, the repeat-20-scans leak test |
| `web-worker-protocol` | Loading OpenCV once with `importScripts`, readiness handshake (callback + Promise), request ids, transfers, watchdog timeout and respawn |
| `indexeddb-schema-and-migrations` | `docscanner` stores and indexes, `onupgradeneeded` by `oldVersion`, `onversionchange`/`onblocked`, `VersionError` |
| `indexeddb-blob-storage` | Producing blobs before the transaction, one-transaction saves, object URLs and revoking them, quotas and `QuotaExceededError`, `storage.persist()`/`estimate()` |
| `reset-and-recovery` | The "Reset app data" flow (terminate worker → close DB → `deleteDatabase` → reload) and in-app error banners |
| `chrome-devtools-debugging` | Application → IndexedDB (refresh, delete, clear), Clear site data, Network, Console, worker threads, memory checks |
| `netlify-static-deploy` | `netlify.toml`, `_headers` syntax, immutable caching plus cache busting by filename, the deploy checklist |
| `apple-liquid-glass-ui` | Design tokens: translucency/blur layers, radii, spacing, type scale, color in light and dark, motion |
| `apple-hig-ux` | HIG principles for flows, feedback states, accessibility, plain-language copy |
| `browser-camera-and-canvas` | `getUserMedia` (HTTPS, permissions), canvas `getImageData`/`putImageData`/`toBlob`, downscaling for detection |
| `browser-testing-checklist` | The acceptance tests from the rubric, sample-image regression, test steps on the live URL |
| `knowledge-lookup` | The "Before you answer" rule: read `knowledge/<agent>/docs` and `examples` and `docs/` first, cite the source link, flag anything not verified |
| `handoff-log` | Format for logging each hand-off and review in `docs/handoff-log.md` (who, what, files, reviewer, outcome) |

### Skill × agent matrix (✔ = uses the skill)

| Skill | orch | opencv | wasm | idb | meta | Sable | Wren | fe | qa | deploy | docs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `opencv-js-pipeline` | | ✔ | ✔ | | | | | | ✔ | | ✔ |
| `cv-mat-memory-hygiene` | | ✔ | ✔ | | | | | | ✔ | | |
| `web-worker-protocol` | | ✔ | ✔ | | | | | ✔ | ✔ | | |
| `indexeddb-schema-and-migrations` | | | | ✔ | | | | ✔ | ✔ | | |
| `indexeddb-blob-storage` | | | | ✔ | | | | ✔ | ✔ | | |
| `reset-and-recovery` | | | ✔ | ✔ | | | ✔ | ✔ | ✔ | | ✔ |
| `chrome-devtools-debugging` | | | ✔ | ✔ | | | | | ✔ | ✔ | ✔ |
| `netlify-static-deploy` | ✔ | | ✔ | | | | | | | ✔ | ✔ |
| `apple-liquid-glass-ui` | | | | | | ✔ | ✔ | ✔ | | | |
| `apple-hig-ux` | | | | | | ✔ | ✔ | ✔ | ✔ | | |
| `browser-camera-and-canvas` | | ✔ | | | | | ✔ | ✔ | ✔ | | |
| `browser-testing-checklist` | ✔ | | | | | | | ✔ | ✔ | ✔ | |
| `knowledge-lookup` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `handoff-log` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

Column key: orch = `orchestrator`, opencv = `opencv-expert`, wasm = `wasm-expert`, idb = `indexeddb-expert`, meta = `meta-agent`, Sable = `ui-designer-apple-liquid-glass`, Wren = `ux-designer-apple-hig`, fe = `frontend-engineer`, qa = `qa-tester`, deploy = `netlify-deployer`, docs = `docs-writer`.

---

## 3. How the team works across the lifecycle

| Phase | Lead | Contributors | Peer reviewer |
|---|---|---|---|
| **Design** | Wren (flows) → Sable (visuals) | orchestrator, frontend-engineer | each other, then orchestrator |
| **Build: vision** | opencv-expert | wasm-expert | wasm-expert reviews Mat deletes and worker safety |
| **Build: worker and loading** | wasm-expert | frontend-engineer | opencv-expert |
| **Build: storage** | indexeddb-expert | frontend-engineer | wasm-expert (worker ↔ DB boundaries), qa-tester |
| **Build: UI** | frontend-engineer | Sable, Wren | Sable (visual), Wren (UX and accessibility) |
| **Test** | qa-tester | all experts fix their own bugs | orchestrator signs off |
| **Deploy** | netlify-deployer | wasm-expert (headers) | qa-tester (live-URL checks) |
| **Docs** | docs-writer | every agent supplies notes | orchestrator |
| **Team upkeep** | meta-agent | — | orchestrator |

**Hand-off rule:** every hand-off and review is appended to `docs/handoff-log.md` using the `handoff-log` skill. The orchestrator turns that log into the final "who did what" summary in the README.

---

## 4. Rubric coverage

| Rubric area | Covered by |
|---|---|
| Live app (20) | netlify-deployer, qa-tester |
| OpenCV.js (20) | opencv-expert |
| WebAssembly (15) | wasm-expert |
| IndexedDB (15) | indexeddb-expert |
| Agent team (20) | orchestrator, meta-agent, the four required experts plus seven others, skills, models, personalities |
| Knowledge and research (10) | docs-writer, meta-agent, `knowledge-lookup` skill |
