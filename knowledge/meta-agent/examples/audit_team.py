"""audit_team.py: the meta-agent's team audit (Python 3.11+, needs PyYAML).

Checks the rules from the Claude Code subagent/skills docs and our CLAUDE.md:
  agents: frontmatter parses; name + description present; name matches the file; model valid;
          skills <= 32 and all exist; only the orchestrator may spawn (others disallow Agent);
          a "Before you answer" section that points at knowledge/<name>/ and says to prefer it over memory;
          knowledge/<name>/docs and /examples exist and are non-empty; docs cite https sources.
  skills: SKILL.md frontmatter on line 1; description <= 1536 chars; no disable-model-invocation;
          < 500 lines; every skill is used by at least one agent.
Usage: python audit_team.py [repo_root]
"""
import pathlib
import re
import sys

import yaml

VALID_MODELS = {"sonnet", "opus", "haiku", "fable", "inherit"}


def frontmatter(path: pathlib.Path) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError("frontmatter must start on line 1")
    _, fm, body = text.split("---", 2)
    return yaml.safe_load(fm), body


def main() -> int:
    root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    fails, used = [], set()
    skills = {p.parent.name: p for p in (root / ".claude/skills").glob("*/SKILL.md")}
    agents = sorted((root / ".claude/agents").glob("*.md"))

    for p in agents:
        try:
            fm, body = frontmatter(p)
        except Exception as e:  # noqa: BLE001
            fails.append(f"{p.name}: {e}")
            continue
        name = fm.get("name", "")
        err = lambda m: fails.append(f"{name or p.name}: {m}")  # noqa: E731
        if not name or not fm.get("description"):
            err("missing name/description")
        if name != p.stem:
            err("name does not match file name")
        if fm.get("model") not in VALID_MODELS:
            err(f"invalid model {fm.get('model')!r}")
        sk = fm.get("skills") or []
        used.update(sk)
        if len(sk) > 32:
            err("more than 32 skills")
        for s in sk:
            if s not in skills:
                err(f"unknown skill {s}")
        spawns = "Agent" not in str(fm.get("disallowedTools", ""))
        if spawns != (name == "orchestrator"):
            err("only the orchestrator may spawn agents")
        m = re.search(r"^## Before you answer\n(.+?)(?=^## |\Z)", body, re.S | re.M)
        if not m:
            err("no '## Before you answer' section")
        else:
            sec = m.group(1)
            if f"knowledge/{name}/" not in sec or "every file" not in sec.lower() or "memory" not in sec.lower():
                err("'Before you answer' must say: read every file in knowledge/<name>/ and prefer it over memory")
        for sub in ("docs", "examples"):
            d = root / "knowledge" / name / sub
            files = [f for f in d.rglob("*") if f.is_file()] if d.is_dir() else []
            if not files:
                err(f"knowledge/{name}/{sub} missing or empty")
        docs = list((root / "knowledge" / name / "docs").glob("*.md"))
        if docs and not all("https://" in d.read_text(encoding="utf-8") for d in docs):
            err("a knowledge doc has no https source link")

    for s, p in skills.items():
        fm, _ = frontmatter(p)
        lines = p.read_text(encoding="utf-8").count("\n")
        if len(fm.get("description", "")) > 1536:
            fails.append(f"skill {s}: description > 1536 chars")
        if fm.get("disable-model-invocation"):
            fails.append(f"skill {s}: disable-model-invocation blocks preloading")
        if lines >= 500:
            fails.append(f"skill {s}: SKILL.md has {lines} lines (keep < 500)")
        if s not in used:
            fails.append(f"skill {s}: not used by any agent")

    print(f"Audited {len(agents)} agents, {len(skills)} skills")
    for f in fails:
        print("FAIL ", f)
    print("ALL PASSED" if not fails else f"{len(fails)} FAILED")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
