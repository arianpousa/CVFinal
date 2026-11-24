# Claude Code subagents: file format and rules

**Source:** https://code.claude.com/docs/en/sub-agents

## Location and format
- Project subagents live in **`.claude/agents/`** (subfolders are scanned recursively). Each is a Markdown file with **YAML frontmatter**, and **the body becomes the system prompt**.
- Identity comes **only from `name`**, not from the file path.
- Only **`name`** and **`description`** are required.
- Subagents get their own prompt plus basic environment details. They don't get the main Claude Code system prompt.

## Frontmatter fields (camelCase, exact spelling; unknown fields are silently ignored)
| Field | Notes |
|---|---|
| `name` | unique, ≤ 256 chars, no `:`, can't start with `-` |
| `description` | tells Claude **when to delegate**. Keep it short, because combined descriptions over 15,000 tokens trigger a startup warning |
| `tools` | allowlist (comma string or YAML list). Omit it to inherit |
| `disallowedTools` | denylist, applied before `tools` |
| `model` | `sonnet`, `opus`, `haiku`, `fable`, a full model ID, or `inherit`. Order of precedence: per-invocation, then this field, then `CLAUDE_CODE_SUBAGENT_MODEL`, then the main model |
| `permissionMode` | `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan` or `manual` |
| `skills` | skills whose **full content is preloaded** at startup (≤ 32). This controls preloading, not access. Skills with `disable-model-invocation: true` **can't** be preloaded |
| `memory` | `user` / `project` / `local` agent memory (`MEMORY.md`) |
| `color` | red, blue, green, yellow, purple, orange, pink, cyan (display only) |
| `maxTurns`, `mcpServers`, `hooks`, `background`, `effort`, `isolation: worktree`, `omitClaudeMd`, `initialPrompt` | optional |

## Spawning and invoking
- A subagent can spawn its own subagents **up to three layers below the main conversation** (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`). To stop one from spawning, **omit `Agent` from `tools` or add it to `disallowedTools`**.
- Invoke one with natural language ("use the code-reviewer subagent…"), with an **@-mention** (`@agent-orchestrator`), or as a whole session with `claude --agent <name>`.
- **Parallel:** Claude can run several subagents at once, each in its own context, and up to **20 concurrently** by default (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`).

## Our conventions
- 11 agents, matching `docs/expert-roster.md`.
- Only `orchestrator` can spawn. Every other agent has `disallowedTools: Agent`, so hand-offs go through the orchestrator.
- Every agent preloads `knowledge-lookup` and `handoff-log`, and has a **"Before you answer"** section pointing at `knowledge/<name>/`.
- Models follow the guide: Opus for orchestrator, opencv and wasm; Sonnet for engineering and design; Haiku for deployer and docs.
