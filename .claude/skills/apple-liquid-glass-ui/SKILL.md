---
name: apple-liquid-glass-ui
description: "Apple Liquid Glass-inspired visual design tokens and component styles for the scanner UI: translucent layered surfaces, typography, color, spacing, radii, motion, light and dark mode. Use when designing or styling any screen or component."
---
# Apple Liquid Glass UI (Sable's system)

Inspired by Apple's Liquid Glass material and Human Interface Guidelines — an original web interpretation, no Apple logos or trademarks.

## Tokens (CSS custom properties in `styles.css`)
```css
:root{
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --fs-largeTitle: 34px; --fs-title: 22px; --fs-body: 17px; --fs-caption: 13px;
  --radius-s: 10px; --radius-m: 16px; --radius-l: 24px;
  --space: 8px;                               /* 8-pt grid */
  --glass-bg: rgba(255,255,255,.55); --glass-border: rgba(255,255,255,.6);
  --glass-blur: saturate(180%) blur(24px);
  --tint: #0a84ff; --ok: #30d158; --warn: #ff9f0a; --danger: #ff453a;
  --text: #1d1d1f; --text-2: #6e6e73; --bg: #f2f2f7;
  --ease: cubic-bezier(.2,.8,.2,1); --dur: 220ms;
}
@media (prefers-color-scheme: dark){ :root{
  --glass-bg: rgba(30,30,32,.55); --glass-border: rgba(255,255,255,.12);
  --text:#f5f5f7; --text-2:#a1a1a6; --bg:#000; } }
@media (prefers-reduced-motion: reduce){ :root{ --dur: 0ms; } }
.glass{ background:var(--glass-bg); backdrop-filter:var(--glass-blur);
        -webkit-backdrop-filter:var(--glass-blur); border:1px solid var(--glass-border);
        border-radius:var(--radius-l); }
```

## Principles
- Content first: the scan is the hero; glass chrome floats above it (toolbar, status pill, sheets).
- Hierarchy through layering and translucency, not heavy borders or shadows.
- One accent color (`--tint`); destructive actions in `--danger`.
- Tap targets ≥ 44×44 px; text contrast ≥ 4.5:1 on glass (add a solid fallback when blur is unsupported).
- Motion: short spring-like transitions on sheets and corner handles; respect reduced motion.

## Components
Status pill (Loading OpenCV / Ready / Working… / Error), floating toolbar, corner handles (24 px glass circles),
library grid cards with thumbnail + title + date, bottom sheet for scan details, Settings panel.
