# Typography, sizes and spacing

**Sources:** Apple HIG, Typography: https://developer.apple.com/design/human-interface-guidelines/typography · Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility

## Text sizes (HIG table, default / minimum)
| Platform | Default | Minimum |
|---|---|---|
| iOS, iPadOS | 17 pt | 11 pt |
| macOS | 13 pt | 10 pt |
| visionOS | 17 pt | 12 pt |
| watchOS | 16 pt | 12 pt |
| tvOS | 29 pt | 23 pt |

- Use sizes most people can read, and test legibility in different contexts.
- **Font weight affects legibility.** Thin weights need larger sizes.
- Support enlarging text **to at least 200 %** (Dynamic Type on Apple platforms; on the web, use `rem` units and test Chrome zoom at 200 %).

## Control size and spacing (HIG Accessibility)
| Platform | Default control | Minimum control |
|---|---|---|
| iOS, iPadOS | 44×44 pt | 28×28 pt |
| macOS | 28×28 pt | 20×20 pt |
| visionOS | 60×60 pt | 28×28 pt |

- Spacing matters as much as size: about **12 pt padding around bezeled controls** and about **24 pt around unbezeled** ones.

## Our web scale (`examples/tokens.css`)
- `--font`: system UI stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui…`), so Windows gets Segoe UI. We don't bundle SF Pro (licensing).
- Large Title 34px / Title 22px / Headline 17px semibold / Body 17px / Footnote 13px / never below 11px. All in `rem`, so browser zoom scales them.
- Weights: 400 body, 600 headings and buttons. No thin weights.
- `--tap: 44px` minimum on every button. `render-check.cjs` asserts this in Chrome for light and dark.
- 8-pt spacing scale (4, 8, 12, 16, 24) with `gap` ≥ 12px between bezeled buttons.
