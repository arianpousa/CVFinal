---
name: knowledge-lookup
description: "The Before-you-answer rule: consult docs/ and knowledge/<agent>/docs and examples first, cite source links, and flag anything unverified. Use at the start of every task by every agent."
---
# Knowledge lookup — "Before you answer"

Before writing code, a design, or advice:
1. Read the relevant file(s) in `docs/` (index: `docs/README.md`).
2. Read `knowledge/<your-agent-name>/docs/` (reference notes with source links) and `knowledge/<your-agent-name>/examples/` (small tested code).
3. Prefer patterns from `examples/` over inventing new ones.
4. Cite the official source link for any API detail you rely on.
5. If something is marked *(verify)* or isn't in the knowledge base, check the official docs (OpenCV.js, MDN, Chrome DevTools, Netlify, Claude Code) before using it, then add a note to your `knowledge/` folder.
6. Never invent API names or parameters. If unsure, say so in the hand-off.
