# Sable's examples (tested)

| File | What good looks like |
|---|---|
| `tokens.css` | Design tokens: system type scale (17px body, 11px minimum), 44px tap size, solid content layer, glass functional layer, one accent, light/dark palettes, and media queries for reduced motion, reduced transparency and increased contrast |
| `glass-components.html` | Reference components: floating glass toolbar, status pill (color + icon + text), dimmed photo with a glass sheet, solid library cards, destructive Reset button |
| `contrast-check.mjs` | Computes WCAG contrast for 9 token pairs × 2 themes. Glass is checked at its **worst case** (composited over black *and* white) |
| `render-check.cjs` | Renders the components in headless Chrome (light + dark), asserts every button is ≥ 44×44 px, checks that glass uses `backdrop-filter`, verifies reduced motion, and writes screenshots |
| `screenshot-light.png`, `screenshot-dark.png` | Rendered output for visual review |

## Run
```bash
node contrast-check.mjs
npx playwright install chromium && node render-check.cjs
```

## Recorded results (2026-11-24)
- **contrast-check:** the first run **failed 2 pairs**. Secondary text on 72 %-opaque glass was 3.18:1 (light) and 3.05:1 (dark) in the worst case. Fixed by raising glass to 85 % and darkening `--text-2` to `#57575e`. Now **18/18 pass**: body text 15.1:1 light and 19.3:1 dark, primary label 5.6:1 and 5.8:1.
- **render-check:** 3/3 pass. All buttons ≥ 44×44 px in both themes, `backdrop-filter: saturate(1.8) blur(24px)`, and reduced motion gives `--dur: 0ms`.
- Visual review found white thumbnails glowing in dark mode, so `brightness(.85)` was added per HIG Dark Mode.
