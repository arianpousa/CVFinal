# Worked example: hand-off log entries and the "Who did what" summary

## A) `docs/handoff-log.md`: a wave-1 parallel launch, then a review loop
```markdown
## 2026-11-25 09:00 · orchestrator → opencv-expert, wasm-expert, indexeddb-expert, ux-designer-apple-hig (wave 1, parallel)
- **Task:** cv-pipeline, worker, storage, ux-flow (see knowledge/orchestrator/examples/build-plan.json)
- **Files:** disjoint per owner (no collisions in wave 1)
- **Decisions:** pinned OpenCV.js 4.10.0 self-hosted at vendor/opencv-4.10.0.js
- **Review:** pending
- **Open issues:** none

## 2026-11-25 09:20 · opencv-expert → orchestrator → wasm-expert (review)
- **Task:** cv-pipeline done: detectPage / processScan
- **Files:** src/cv/scanner-pipeline.js, samples/receipt.jpg, samples/letter.jpg
- **Decisions:** Canny 75/200 + 3×3 dilate; ε = 0.02·perimeter; blockSize 21, C 10 (docs/05-perspective-warp-and-threshold.md)
- **Review:** wasm-expert, changes requested: `M` from getPerspectiveTransform not deleted (cv-mat-memory-hygiene)
- **Open issues:** fix and re-run the leak test

## 2026-11-25 09:28 · opencv-expert → orchestrator → wasm-expert (re-review)
- **Task:** fixed the M leak
- **Review:** wasm-expert, approved: run-tests 10/10, heap 128 → 128 MiB over 200 scans
- **Open issues:** none
```

## B) README section the orchestrator writes at the end
```markdown
## Who did what

Built by an 11-agent Claude Code team run by the **orchestrator** (see `.claude/agents/` and `docs/handoff-log.md`).

| Agent | Delivered | Reviewed by |
|---|---|---|
| ux-designer-apple-hig (Wren) | flow spec, states, copy deck, a11y criteria | Sable |
| ui-designer-apple-liquid-glass (Sable) | styles.css tokens, glass components | Wren |
| opencv-expert | page detection, perspective warp, B&W cleanup, sample images | wasm-expert |
| wasm-expert | cv-worker.js, cv-client.js, pinned opencv.js + cache headers | opencv-expert |
| indexeddb-expert | db.js (scans, blobs, settings, history, Reset) | qa-tester |
| frontend-engineer | index.html, app.js, camera/upload, corner editor, library | Wren, Sable |
| docs-writer | README, How it works, Resources | Wren |
| netlify-deployer | netlify.toml, deploy, header checks | qa-tester |
| qa-tester | local + live acceptance runs (10/10) | orchestrator |
| meta-agent | agent/skill/knowledge upkeep, team audit | orchestrator |

Parallelism: wave 1 ran 4 experts at once; 12 tasks in 8 waves; 3 review rounds requested changes (all resolved).
```
