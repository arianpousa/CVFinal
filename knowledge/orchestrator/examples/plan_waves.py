"""plan_waves.py: turn build-plan.json into parallel waves and sanity-check it (stdlib only).

Checks: every owner/reviewer is a real agent in .claude/agents (or "orchestrator"),
reviewer != owner, all deps exist, no cycles, and no two tasks in the same wave write the same file.
Prints the waves: tasks in one wave are launched in parallel in a single turn.
Usage: python plan_waves.py [build-plan.json] [repo_root]
"""
import json
import pathlib
import sys


def waves(tasks: dict) -> list[list[str]]:
    done, out = set(), []
    while len(done) < len(tasks):
        ready = sorted(t for t, v in tasks.items() if t not in done and set(v["deps"]) <= done)
        if not ready:
            raise ValueError(f"dependency cycle among {sorted(set(tasks) - done)}")
        out.append(ready)
        done |= set(ready)
    return out


def main() -> int:
    plan_path = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).with_name("build-plan.json"))
    root = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else pathlib.Path(__file__).resolve().parents[3]
    tasks = {t["id"]: t for t in json.loads(plan_path.read_text(encoding="utf-8"))["tasks"]}
    agents = {p.stem for p in (root / ".claude/agents").glob("*.md")}
    fails = []
    for tid, t in tasks.items():
        for role in ("owner", "reviewer"):
            if t[role] not in agents:
                fails.append(f"{tid}: unknown {role} {t[role]}")
        if t["owner"] == t["reviewer"]:
            fails.append(f"{tid}: reviewer must differ from owner")
        for d in t["deps"]:
            if d not in tasks:
                fails.append(f"{tid}: unknown dep {d}")
    try:
        plan = waves(tasks)
    except ValueError as e:
        fails.append(str(e))
        plan = []
    for i, w in enumerate(plan, 1):
        seen = {}
        for tid in w:
            for f in tasks[tid]["files"]:
                if f in seen:
                    fails.append(f"wave {i}: {tid} and {seen[f]} both write {f}")
                seen[f] = tid
        print(f"Wave {i} (parallel): " + ", ".join(f"{tid}[{tasks[tid]['owner']}]" for tid in w))
    print(f"\n{len(tasks)} tasks in {len(plan)} waves; max parallelism {max(map(len, plan), default=0)}")
    for f in fails:
        print("FAIL ", f)
    print("ALL PASSED" if not fails else f"{len(fails)} FAILED")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
