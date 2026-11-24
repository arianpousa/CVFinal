# docs-writer examples (tested)

| File | What good looks like |
|---|---|
| `resources.html` | The required Resources page: grouped, descriptive link text, every project and official link |
| `check-resources.mjs` | Gate: required links present, https only, no "click here", no duplicates, matches the canonical list in `../docs/01-official-links.md` |
| `how-it-works.md` | Plain-language copy for the How it works page, with each claim linked and numbers taken from recorded tests |

## Run
`node check-resources.mjs [path/to/resources.html]`

## Recorded result (2026-11-24)
The first run **failed**: the Smoothing (Gaussian blur) tutorial was in the canonical list but missing from the page. After adding it, **11/11 pass** with 27 links.
