# orchestrator examples (tested)

| File | What good looks like |
|---|---|
| `build-plan.json` | The guide-step-9 build as 12 tasks with owner, **different** reviewer, dependencies and owned files |
| `plan_waves.py` | Turns the plan into **parallel waves** and validates it: real agents only, reviewer ≠ owner, no unknown deps, no cycles, no two parallel tasks writing the same file |
| `handoff-and-summary-example.md` | Real-shape hand-off log entries (parallel launch, review asking for changes, re-review) and the README "Who did what" section |

## Run
`python plan_waves.py` (from anywhere. It finds `.claude/agents` three levels up.)

## Recorded result (2026-11-24)
```
Wave 1 (parallel): cv-pipeline[opencv-expert], storage[indexeddb-expert], ux-flow[ux-designer-apple-hig], worker[wasm-expert]
Wave 2 (parallel): hosting[netlify-deployer], ui-system[ui-designer-apple-liquid-glass]
Wave 3 (parallel): app-shell[frontend-engineer]
Wave 4 … Wave 8: pages → qa-local → deploy → qa-live → summary
12 tasks in 8 waves; max parallelism 4
ALL PASSED
```
