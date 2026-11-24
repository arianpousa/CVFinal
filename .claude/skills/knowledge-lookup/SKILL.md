---
name: knowledge-lookup
description: "The Before-you-answer rule: read every file in knowledge/<agent>/docs and examples first and prefer it over memory, then docs/, cite source links, flag anything unverified. Use at the start of every task by every agent."
---
# Knowledge lookup: "Before you answer"

Before writing code, a design, or advice:
1. **Read every file** in `knowledge/<your-agent-name>/docs/` (reference notes from official docs, each with its source link) and `knowledge/<your-agent-name>/examples/` (small examples that were **run**, with results recorded in `examples/README.md`).
2. **Prefer the knowledge folder over memory.** When they disagree, the knowledge folder wins, because it was checked against the official docs and by running code. Several of our notes record gotchas that contradict common assumptions:
   - the OpenCV.js module is a thenable, so `await cv` hangs
   - `tx.error` is null inside an IndexedDB transaction's `onerror`
   - 72 %-opaque glass fails contrast
3. Then read the relevant shared research in `docs/` (index: `docs/README.md`).
4. Reuse tested examples instead of inventing new patterns. Cite the official source link for any API detail you rely on.
5. If something is marked *(verify)* or isn't in the knowledge base, check the official docs (OpenCV.js, MDN, Chrome DevTools, Netlify, Apple HIG, Claude Code) before using it, then add a sourced note to your `knowledge/` folder.
6. Never invent API names or parameters. If unsure, say so in the hand-off.
