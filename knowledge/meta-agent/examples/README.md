# meta-agent examples (tested)

| File | What good looks like |
|---|---|
| `agent-template.md` | A correct subagent file: required fields, model, `disallowedTools: Agent`, preloaded skills, owned files, and the standard **"Before you answer"** section |
| `skill-template/SKILL.md` | A correct project skill: frontmatter on line 1, key use case first in `description`, checklist, tested-example reference, no `disable-model-invocation` |
| `audit_team.py` | Audits the whole repo against the Claude Code docs and our CLAUDE.md rules (agents, skills, knowledge folders, Before-you-answer wording, spawn permissions) |

## Run
`python audit_team.py <repo_root>` (needs `pip install pyyaml`)

## Recorded results (2026-11-24)
- **Before** adding the knowledge rule to the agents: **13 FAILED**. Every agent lacked the "read every file … prefer over memory" wording, and the orchestrator's knowledge folders were empty. This shows the audit catches real gaps.
- **After** writing all knowledge folders and the new Before-you-answer sections: `Audited 11 agents, 14 skills · ALL PASSED`.
