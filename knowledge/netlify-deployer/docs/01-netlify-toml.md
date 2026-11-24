# netlify.toml (file-based configuration)

**Source:** https://docs.netlify.com/build/configure-builds/file-based-configuration/

- Location: the root of the repository (the default base directory `/`). All paths in it are relative to the base directory.
- **Precedence:** if a setting is in both `netlify.toml` and the Netlify UI, **`netlify.toml` wins**.
- `[build]` keys:
  - `base`
  - `publish` (the folder Netlify deploys)
  - `command` (runs in Bash)
  - `environment` (use the UI for secrets)
  - `processing`
- `[[redirects]]` blocks take `from`, `to`, `status`, `force`, `query` and `conditions`. `[[headers]]` blocks take `for` plus `[headers.values]`.
- Headers and redirects in `netlify.toml` are **global** and not scoped to deploy contexts. Use `_headers` or `_redirects` files for per-deploy rules.
- Deploy contexts: `[context.production]`, `[context.deploy-preview]`, `[context.branch-deploy]`, `[context.dev]` and `[context.<branch>]`. The most specific one wins.
- Optional `"$schema" = "https://open-api.netlify.com/netlify.schema.json"` enables editor validation and autocomplete. It's ignored at build time.

## Our settings
```toml
[build]
  publish = "."
  command = ""
```
- This matches the assignment guide (step 10): **leave the build command empty and set the publish directory to `.`**.
- Every push to `main` redeploys automatically once the repo is linked at app.netlify.com.
- No functions, no environment variables, no API keys.
- The full tested file is `examples/netlify.toml`, checked by `examples/validate_config.py`.

## Deploy steps (assignment guide step 10)
1. app.netlify.com → **Add new site → Import an existing project → GitHub** → `arianpousa/CVFinal`, branch `main`.
2. Build command: *(empty)*. Publish directory: `.`. Click **Deploy**.
3. Rename the site under Site configuration → Change site name, if you want a nicer `*.netlify.app` URL.
4. Run `node check-live-headers.mjs https://<site>.netlify.app`, then hand the URL to qa-tester.
