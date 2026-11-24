---
name: apple-liquid-glass-ui
description: "Apple Liquid Glass-inspired visual design tokens and component styles for the scanner UI: translucent layered surfaces, typography, color, spacing, radii, motion, light and dark mode. Use when designing or styling any screen or component."
---
# Apple Liquid Glass UI (Sable's system)

Inspired by Apple's Liquid Glass material and Human Interface Guidelines — an original web interpretation, no Apple logos or trademarks.

## Tokens: use the TESTED file
The canonical tokens are `knowledge/ui-designer-apple-liquid-glass/examples/tokens.css`. Copy it into `styles.css` and don't retype values from memory. Key values that passed `contrast-check.mjs` (18/18) and `render-check.cjs`:
```css
:root{
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, sans-serif;
  --fs-large-title: 2.125rem; --fs-title: 1.375rem; --fs-body: 1.0625rem; --fs-footnote: .8125rem; --fs-min: .6875rem;
  --tap: 44px; --radius-m: 16px; --radius-l: 24px;
  --glass-fill: rgba(255,255,255,.85);      /* .55/.72 FAILED 4.5:1 for secondary text in the worst case */
  --glass-blur: saturate(180%) blur(24px);
  --text: #1d1d1f; --text-2: #57575e;        /* #6e6e73 FAILED on glass */
  --accent: #0066cc; --on-accent: #fff;      /* the ONE tinted control (primary action) */
}
@media (prefers-color-scheme: dark){ :root{
  --glass-fill: rgba(30,30,32,.85); --text:#f5f5f7; --text-2:#b0b0b8;
  --accent:#0a84ff; --on-accent:#000; } }   /* white on #0a84ff fails 4.5:1 */
@media (prefers-reduced-motion: reduce){ :root{ --dur:0ms } }
@media (prefers-reduced-transparency: reduce){ :root{ --glass-fill: var(--surface); --glass-blur: none } }
@media (prefers-contrast: more){ :root{ --text-2: var(--text); --glass-fill: var(--surface) } }
```
Glass only on the functional layer (toolbar, status pill, sheets). Content stays solid (HIG Materials). Re-run `contrast-check.mjs` after any color change.

## Principles
- Content first: the scan is the hero; glass chrome floats above it (toolbar, status pill, sheets).
- Hierarchy through layering and translucency, not heavy borders or shadows.
- One accent color (`--tint`); destructive actions in `--danger`.
- Tap targets ≥ 44×44 px; text contrast ≥ 4.5:1 on glass (add a solid fallback when blur is unsupported).
- Motion: short spring-like transitions on sheets and corner handles; respect reduced motion.

## Components
Status pill (Loading OpenCV / Ready / Working… / Error), floating toolbar, corner handles (24 px glass circles),
library grid cards with thumbnail + title + date, bottom sheet for scan details, Settings panel.
