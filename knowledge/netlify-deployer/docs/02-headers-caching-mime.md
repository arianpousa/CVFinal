# Custom headers, caching and MIME types

**Sources:** Netlify custom headers: https://docs.netlify.com/manage/routing/headers/ · MDN instantiateStreaming (MIME rule): https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/instantiateStreaming_static · Netlify default cache header, observed in a Netlify forum response: https://answers.netlify.com/t/headers-file-not-affecting-the-site/24056

## Syntax (Netlify docs)
- `_headers` file in the publish directory: a path line, then indented `Name: value` lines. `#` starts a comment, and header names are case-insensitive.
- `netlify.toml`: `[[headers]]` with `for = "/path"` and `[headers.values]`.
- Path matching:
  - `*` matches anything within a segment.
  - `:placeholder` must start a segment and doesn't match `/`.
  - You **can't mix** `*` and `:placeholder` in one segment.
- Multi-value headers: repeat the line in `_headers`, or use a `'''` multiline string in TOML. Netlify joins them into one comma-separated header.
- **Ignored** custom values (Netlify sets these itself): `Accept-Ranges`, `Age`, `Allow`, `Alt-Svc`, `Connection`, `Content-Encoding`, `Content-Length`, `Content-Range`, `Date`, `Server`, `Trailer`, `Transfer-Encoding`, `Upgrade`. Also `Location` (use redirects) and `Set-Cookie`.
- Custom headers apply to **static files in the deploy**. They don't apply to proxied responses or Functions/Edge Functions.
- `Content-Type` isn't on the ignored list, so setting it for `/*.wasm` is allowed. Verify it with `curl -I` after deploying.

## Caching strategy
| Path | Cache-Control | Why |
|---|---|---|
| HTML / app JS / CSS | Netlify default `public, max-age=0, must-revalidate` (seen in real responses) | every deploy shows up immediately, and revalidation via ETag is cheap |
| `/vendor/opencv-4.10.0.js` (10.4 MB raw, ~3.4 MB gzip) | `public, max-age=31536000, immutable` | it never changes under that name |
| `/*.wasm` (only for split builds) | same, plus `Content-Type: application/wasm` | `instantiateStreaming` rejects any other MIME with a `TypeError` |

**Cache busting:** never overwrite `vendor/opencv-4.10.0.js`. Upgrading means a new filename, for example `vendor/opencv-4.13.0.js`, plus updating the `importScripts` path. `validate_config.py` fails on an unversioned name (tested).

## Verify after deploy
`node examples/check-live-headers.mjs https://<site>.netlify.app` checks:
- the home page returns 200 and revalidates
- `nosniff` is set
- `camera=(self)` is allowed
- opencv.js returns 200 as JavaScript with the immutable cache header

Its self-test against a local server passes 7/7.
