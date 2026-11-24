# Claude Code skills: SKILL.md format and rules

**Source:** https://code.claude.com/docs/en/skills (format follows the Agent Skills spec, https://agentskills.io)

## Location
| Scope | Path |
|---|---|
| Project (shared in git) | `.claude/skills/<skill-name>/SKILL.md` |
| Personal | `~/.claude/skills/<skill-name>/SKILL.md` |
| Nested | `<subdir>/.claude/skills/<skill-name>/SKILL.md` |
| Plugin | `<plugin>/skills/<skill-name>/SKILL.md` |

If names collide, enterprise overrides personal, and personal overrides project.

## Format
YAML frontmatter between `---` lines (it **must be the first line**), then Markdown instructions.

| Field | Notes |
|---|---|
| `name` | the `/` command name. Defaults to the directory name |
| `description` | **what it does and when to use it, key use case first**. Combined with `when_to_use` it's truncated at **1,536 chars** in the listing |
| `when_to_use`, `argument-hint`, `arguments` | optional |
| `disable-model-invocation: true` | only the user can invoke it. **This also prevents preloading into subagents**, so don't set it on team skills |
| `user-invocable: false` | hidden from the `/` menu, so only Claude invokes it |
| `allowed-tools`, `disallowed-tools`, `model`, `effort`, `paths`, `hooks`, `shell` | optional |
| `context: fork` + `agent:` | run the skill in a forked subagent (the instructions must be self-contained) |

Unrecognized fields are silently ignored.

## Supporting files
Keep `SKILL.md` focused (**under 500 lines**). Move detail into sibling files such as `reference.md`, `examples.md` and `scripts/`, and link them from `SKILL.md` so Claude knows when to read them. Substitutions: `$ARGUMENTS`, `$0`, `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PROJECT_DIR}`.

## Skills ↔ subagents
| Approach | System prompt | Task |
|---|---|---|
| Skill with `context: fork` | from the `agent` type | the SKILL.md content |
| **Subagent with `skills:` (our approach)** | the subagent's body | the orchestrator's delegation message, plus preloaded skills and CLAUDE.md |
