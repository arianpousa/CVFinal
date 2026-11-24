# 04 · Hosting opencv.js and WebAssembly on Netlify (static site)

**Owner agents:** `wasm-expert` (headers/caching), `orchestrator` (deploy) · **Related:** [02](02-webassembly-and-workers.md)

## 1. Deployment shape

- Pure static site: `index.html`, `app.js`, `cv-worker.js`, `db.js`, `styles.css`, `vendor/opencv.js`, `samples/*.jpg`, `how-it-works.html`, `resources.html`.
- Netlify settings: **build command empty, publish directory `.`**, and every push to `main` redeploys (from the assignment guide).
- Netlify headers can be set in either a `_headers` file in the publish directory or `[[headers]]` in `netlify.toml`. ([Netlify custom headers][headers])

## 2. Where to get opencv.js — self-host it

| Option | Pros | Cons |
|---|---|---|
| `https://docs.opencv.org/<ver>/opencv.js` | zero setup | third-party uptime; `4.x` alias moves (redirects to 4.13.0 as of Oct 2026) ([issoh][issoh]); can't set cache headers |
| **Self-host `vendor/opencv.js` (pinned)** ✅ | same origin (no CORS issues inside workers), our own cache headers, works offline after first load | ~10 MB file in the repo |

Verified for the 4.10.0 build: **10,378,215 bytes raw, ~3.4 MB gzipped, with the Wasm embedded as base64** (see doc 02). That's well below GitHub's 100 MB per-file limit.

## 3. File size, compression and MIME types

- The file is `.js`, so it is served as JavaScript. Because the Wasm is embedded, **no `application/wasm` header is required**.
- If a split build is ever used (`opencv.js` + `opencv_js.wasm`): `WebAssembly.instantiateStreaming()`/`compileStreaming()` reject with `TypeError` unless the response has `Content-Type: application/wasm`. *(general background per MDN summary — verify)* ([MDN WebAssembly][mdnwasm]) Add a header rule for `/*.wasm` to be safe.
- `Content-Encoding` and `Content-Length` are on Netlify's list of headers you can't override, because Netlify sets them itself. ([Netlify custom headers][headers]) Don't try to pre-gzip files manually.

## 4. Caching headers

Netlify's default is `cache-control: public, max-age=0, must-revalidate` (revalidate every request; cheap 304s via ETag). ([Netlify forum][forum]) That's fine for HTML/JS we edit often. For the big, pinned OpenCV file, cache it long:

**`netlify.toml`**

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

- Syntax: each rule has `for` plus `[headers.values]`. In `netlify.toml`, multi-value headers use a multiline string. ([Netlify custom headers][headers])
- Wildcards `*` match anything in a segment, and you can't mix `:placeholder` and `*` in one segment. ([Netlify custom headers][headers])
- Headers apply to static files in the deploy, but **not** to proxied or Functions responses. ([Netlify custom headers][headers])
- **Cache busting:** because `/vendor/*` is immutable, upgrading OpenCV means a **new filename/path** (e.g. `vendor/opencv-4.10.0.js`). Never overwrite the same path.
- `Content-Type` isn't on Netlify's ignored list, but the docs give no explicit example of overriding it. Verify with `curl -I` after deploying. ([Netlify custom headers][headers])

## 5. Camera access
`getUserMedia` needs a secure context. Netlify serves HTTPS by default, so the webcam works on `*.netlify.app`. The `Permissions-Policy: camera=(self)` header above allows it for our own origin.

## 6. Post-deploy checks
```
curl -sI https://<site>.netlify.app/vendor/opencv-4.10.0.js | grep -i -E 'content-type|cache-control|content-encoding'
```
Expect `application/javascript`, the long `max-age`, and `br` or `gzip`.

## Sources
- [headers]: https://docs.netlify.com/manage/routing/headers/
- [forum]: https://dev.to/hugo__df/enable-cdn-cloudflare-caching-for-your-netlify-site-4lmm
- [mdnwasm]: https://developer.mozilla.org/en-US/docs/WebAssembly
- [issoh]: https://www.issoh.co.jp/md/tech/3608
- Netlify file-based config: https://docs.netlify.com/build/configure-builds/file-based-configuration/

[headers]: https://docs.netlify.com/manage/routing/headers/
[forum]: https://dev.to/hugo__df/enable-cdn-cloudflare-caching-for-your-netlify-site-4lmm
[mdnwasm]: https://developer.mozilla.org/en-US/docs/WebAssembly
[issoh]: https://www.issoh.co.jp/md/tech/3608
