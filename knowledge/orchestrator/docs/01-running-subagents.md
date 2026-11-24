# Running the expert subagents (parallel vs sequential)

**Source:** Claude Code subagents: https://code.claude.com/docs/en/sub-agents · Skills: https://code.claude.com/docs/en/skills

## Facts from the docs
- Claude can **run several subagents at once**. Each works in **its own context**, and the parent synthesizes the results. Up to **20** can run concurrently by default (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`). Past that, a spawn fails with "Concurrent subagent limit reached".
- Subagents can nest up to **three layers below the main conversation**. An agent without the `Agent` tool can't spawn others. In our team that's everyone but you, so **all hand-offs come back through you**.
- A subagent **doesn't see your conversation**. It gets its own system prompt (its agent file), the preloaded `skills`, CLAUDE.md, and the **delegation message you write**. So every brief must be self-contained.
- Invoke with `@agent-<name>` or by name in natural language. A whole session can run as an agent with `claude --agent orchestrator`.
- `background: true` keeps an agent running while you continue. `isolation: worktree` gives an agent its own git worktree, which is useful when parallel agents edit overlapping files.

## Our rules
1. **Plan in waves.** Tasks with no unmet dependencies run **in the same turn** (several Agent calls at once). See `examples/build-plan.json` and `examples/plan_waves.py`.
2. **Avoid file collisions.** Parallel agents must own disjoint files (see the ownership column in the plan). If two need the same file, run them in sequence, or give one `isolation: worktree`.
3. **Brief template** (every delegation message):
   ```
   Task: <one line>      Owner files: <paths>      Inputs: <files/interfaces from earlier waves>
   Acceptance: <tests/checklist that must pass>   Reviewer: <agent>
   Read first: knowledge/<agent>/ (all files), docs/<relevant>.md
   Finish by: appending a handoff-log entry and returning files changed + decisions + open issues.
   ```
4. **Review loop:** owner → you → reviewer → you → (fixes → owner) … until approved.
5. Stay under about 6 concurrent experts per wave (well under the limit of 20) so reviews stay manageable.
