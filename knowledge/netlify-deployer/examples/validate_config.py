"""validate_config.py: pre-deploy checks for netlify.toml (Python 3.11+, stdlib only).

Checks the rules our team agreed on (see ../docs):
  * [build] publish == "." and command == ""  (static site, no build)
  * /vendor/* is cached immutable for a year
  * /*.wasm is served as application/wasm
  * no header Netlify ignores (Content-Encoding, Content-Length, ...)
  * the vendored opencv file name is versioned (cache busting) if a vendor/ folder exists
Usage:  python validate_config.py [path/to/netlify.toml] [site_root]
"""
import pathlib
import re
import sys
import tomllib

IGNORED = {"accept-ranges", "age", "allow", "alt-svc", "connection", "content-encoding", "content-length",
           "content-range", "date", "server", "trailer", "transfer-encoding", "upgrade"}


def main() -> int:
    toml_path = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "netlify.toml")
    root = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else toml_path.parent
    cfg = tomllib.loads(toml_path.read_text(encoding="utf-8"))
    fails = 0

    def check(name: str, ok: bool, extra: str = "") -> None:
        nonlocal fails
        print(f"{'PASS' if ok else 'FAIL'}  {name} {extra}")
        fails += not ok

    build = cfg.get("build", {})
    check("publish directory is '.'", build.get("publish") == ".", f"({build.get('publish')!r})")
    check("build command is empty", build.get("command", "") == "", f"({build.get('command')!r})")

    rules = {h["for"]: {k.lower(): v for k, v in h.get("values", {}).items()} for h in cfg.get("headers", [])}
    vendor = rules.get("/vendor/*", {})
    check("/vendor/* immutable 1-year cache", "max-age=31536000" in vendor.get("cache-control", "") and "immutable" in vendor.get("cache-control", ""))
    check("/*.wasm served as application/wasm", rules.get("/*.wasm", {}).get("content-type") == "application/wasm")
    bad = sorted({k for v in rules.values() for k in v if k in IGNORED})
    check("no headers Netlify ignores", not bad, f"({', '.join(bad)})" if bad else "")
    check("camera allowed for self", "camera=(self)" in rules.get("/*", {}).get("permissions-policy", ""))

    vendor_dir = root / "vendor"
    if vendor_dir.is_dir():
        files = [p.name for p in vendor_dir.glob("opencv*.js")]
        versioned = all(re.search(r"opencv-\d+\.\d+\.\d+\.js$", f) for f in files) and files
        check("vendored opencv file name is versioned", bool(versioned), f"({files})")
    print("\nALL PASSED" if not fails else f"\n{fails} FAILED")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
