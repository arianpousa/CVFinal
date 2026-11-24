# What the orchestrator must deliver (from the assignment guide)

**Source:** assignment guide: https://cvfinal-doc-scanner.netlify.app/guide/ · Claude Code subagents: https://code.claude.com/docs/en/sub-agents

## Step 9 of the guide: "Ask the orchestrator to build the app"
- You receive **one prompt** (`@agent-orchestrator`). You run the experts, **hand work between them**, and have them **review each other**. The guide expects about 30–45 minutes.
- **Required outputs:**
  - `netlify.toml`
  - a **README with deploy steps**
  - **sample images**
  - a **"How it works" page**
  - a **Resources page**
  - a **hand-off log**

## Requirements you enforce (guide "Requirements" + rubric)
- Live on Netlify and working in Chrome. OpenCV.js does real, visible CV for the use case.
- OpenCV.js loads once, heavy work runs in a Web Worker, every `cv.Mat` is deleted.
- IndexedDB results survive a refresh. The "Reset app data" button exists.
- `docs/`, `.claude/agents/` (≥ 4 required agents), `.claude/skills/` and `knowledge/<agent>/` are all present.
- **The orchestrator's summary of who did what is in the repo or README.** Everything is pushed to `main`.

## Rubric weights to prioritise
Live app 20 · OpenCV.js 20 · Agent team 20 · WebAssembly 15 · IndexedDB 15 · Knowledge and research 10.

## Definition of done (gate before you report back)
- [ ] qa-tester `smoke-test.cjs` passes locally **and** on the live URL (10/10)
- [ ] Wren `a11y-check.cjs` and Sable `contrast-check.mjs` pass on the real UI
- [ ] netlify-deployer `validate_config.py` and `check-live-headers.mjs` pass
- [ ] docs-writer `check-resources.mjs` passes on the real `resources.html`
- [ ] `docs/handoff-log.md` has an entry for every hand-off and review
- [ ] README has the "Who did what" section (see `examples/who-did-what-example.md`)
- [ ] `git push origin main`
