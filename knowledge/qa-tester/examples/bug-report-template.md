# Bug report template (worked example)

Write the report as a `handoff-log` entry to the orchestrator, which routes it to the owner. Testers don't fix other agents' code.

```markdown
## 2026-11-24 14:05 · qa-tester → orchestrator → wasm-expert
- **Task:** BUG: worker heap grows on repeated scans (rubric: WebAssembly, 15 pts)
- **Severity:** High (the tab crashes after ~60 scans on 8 GB laptops)
- **Check:** smoke-test.cjs → "worker Wasm heap stable over 20 scans"
- **Steps:** 1) open http://localhost:8765  2) wait for Ready  3) run __scanOnce() 20×
- **Expected:** heap 128 MiB → 128 MiB
- **Actual:** heap 128 MiB → 384 MiB
- **Evidence:** smoke-test output; Shift+Esc Task Manager shows the worker at 410 MB
- **Suspect:** `processScan()` doesn't delete `M` from getPerspectiveTransform (see cv-mat-memory-hygiene checklist)
- **Owner:** opencv-expert (code) · reviewer: wasm-expert
- **Open issues:** re-run smoke-test after the fix
```

Good reports are reproducible (exact steps), measurable (expected vs actual numbers), tied to a rubric line, and name an owner and a reviewer.
