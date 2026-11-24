---
name: netlify-static-deploy
description: "Deploying the app as a static site on Netlify: netlify.toml (empty build, publish .), headers for vendor/opencv and wasm, immutable caching with filename cache-busting, deploy and verification checklist. Use when editing netlify.toml/_headers, preparing a release, or checking the live site."
---
# Netlify static deploy

Reference: `docs/04-netlify-hosting.md`.

## netlify.toml
```toml
[build]
  publish = "."
  command = ""

[[headers]]
  for = "/vendor/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.wasm"
  [headers.values]
    Content-Type = "application/wasm"
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(self)"
```

## Rules
- Self-host a pinned `vendor/opencv-<version>.js`; upgrading = new filename (immutable cache).
- Don't set `Content-Encoding`/`Content-Length` (Netlify ignores them).
- No build step, no functions, no environment variables, no API keys.

## Deploy
1. app.netlify.com → Add new site → Import from GitHub → `arianpousa/CVFinal`, branch `main`.
2. Build command: empty. Publish directory: `.`. Deploy.
3. Every push to `main` redeploys.

## Verify
`curl -sI https://<site>.netlify.app/vendor/opencv-4.10.0.js` → JS content-type, long max-age, br/gzip.
Then run the `browser-testing-checklist` on the live URL.
