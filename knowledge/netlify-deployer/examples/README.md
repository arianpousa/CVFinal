# netlify-deployer examples (tested)

| File | What good looks like |
|---|---|
| `netlify.toml` | Static site (`publish="."`, empty build), immutable cache for `/vendor/*`, `application/wasm` for `.wasm`, security and permission headers |
| `_headers` | The same rules in `_headers` syntax. Use one format or the other, not both |
| `validate_config.py` | Pre-deploy gate (Python stdlib `tomllib`): publish/build, cache, MIME, ignored headers, camera policy, versioned opencv filename |
| `check-live-headers.mjs` | Post-deploy header check of the live URL, plus `--self-test` against a local server |

## Run
```bash
python validate_config.py ../../../netlify.toml ../../..     # repo-root config + site root
node check-live-headers.mjs --self-test
node check-live-headers.mjs https://<site>.netlify.app
```

## Recorded results (2026-11-24)
- `validate_config.py netlify.toml`: **6/6 pass**
- With an unversioned `vendor/opencv.js`, the validator correctly **fails** "vendored opencv file name is versioned" (proof that the gate works)
- `check-live-headers.mjs --self-test`: **7/7 pass**
