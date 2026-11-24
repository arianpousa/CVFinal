---
name: handoff-log
description: "Format and rules for recording hand-offs, reviews and decisions in docs/handoff-log.md so the orchestrator can produce the who-did-what summary. Use whenever an agent finishes a task, hands work on, or reviews another agent's work."
---
# Hand-off log

All hand-offs go **through the orchestrator**: an agent finishes, writes its entry, and returns to the orchestrator, which routes the next task. Agents never call each other directly.

Append to `docs/handoff-log.md` (create it with a `# Hand-off log` heading if missing):

```markdown
## <YYYY-MM-DD HH:MM> · <from-agent> → orchestrator → <to-agent>
- **Task:** one line
- **Files:** path/a.js, path/b.css
- **Decisions:** key choices + why (with doc/source link)
- **Review:** <reviewer-agent> — approved | changes requested: …
- **Open issues:** … (or "none")
```

Rules
- One entry per hand-off or review; append only, never rewrite history.
- Reviews name the skill checklist used (e.g. `cv-mat-memory-hygiene`).
- At the end the orchestrator writes a "Who did what" section in the README from this log.
