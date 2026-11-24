---
name: skill-template
description: "What this skill does and when to use it, key use case first (under ~300 chars). Use when <trigger 1>, <trigger 2>, or reviewing <thing>."
---

# Skill title

One paragraph: the goal, and the one rule that matters most.

## Steps / pattern
1. …
2. …

```js
// the smallest correct code pattern, copied from a TESTED example in knowledge/<agent>/examples/
```

## Checklist (used by reviewers)
- [ ] …
- [ ] …

## References
- Official source: <link>
- Tested example: `knowledge/<agent>/examples/<file>`

<!-- Rules from https://code.claude.com/docs/en/skills:
     - frontmatter must be the first line; keep SKILL.md < 500 lines
     - do NOT set disable-model-invocation: true on team skills (it blocks preloading into subagents)
     - put long reference material in sibling files and link them from here -->
