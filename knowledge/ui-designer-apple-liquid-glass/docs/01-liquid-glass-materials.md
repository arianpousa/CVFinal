# Liquid Glass and materials

**Source:** Apple HIG, Materials: https://developer.apple.com/design/human-interface-guidelines/materials (Markdown: …/materials.md). Updated for Liquid Glass Sept 9, 2025.

## What Apple says
- Materials separate foreground (text, controls) from background (content). Letting color pass through keeps a sense of place.
- **Liquid Glass** is a distinct **functional layer for controls and navigation** (tab bars, sidebars) that floats above the content layer. Content scrolls and peeks through underneath.
- **Don't use Liquid Glass in the content layer.** Use standard materials for content such as backgrounds. The exception is transient controls like sliders and toggles while they're being used.
- **Use Liquid Glass effects sparingly.** Overusing them in custom controls distracts from the content. Limit them to the most important functional elements.
- Two variants:
  - **Regular** blurs and adjusts the luminosity of what's behind it, for legibility. Most system components use it. Use it when the background may hurt legibility, or for text-heavy components (alerts, sidebars, popovers).
  - **Clear** is highly translucent. Use it only over **visually rich media** (photos, video). If the media is bright, add a **dark dimming layer of 35 % opacity**. Dark media needs no dimming.
- Appearance changes with system settings, including the **reduce transparency** and **increase contrast** accessibility settings.
- Standard materials: choose by **semantic purpose**, not by the color they seem to give. Use vibrant colors on top for legibility. Thicker (more opaque) materials give better contrast for fine text, and thinner ones keep more context visible.

## Web translation for our scanner
| HIG concept | Our CSS |
|---|---|
| Functional layer (glass) | `.glass` on the toolbar, status pill and bottom sheet: `backdrop-filter: saturate(180%) blur(24px)` plus a translucent fill |
| Regular variant (luminosity for legibility) | fill **85 %** opaque. We tested 72 % and it failed 4.5:1 for secondary text in the worst case (see `examples/contrast-check.mjs`) |
| Clear over photos + 35 % dim | the capture view puts a `rgba(0,0,0,.35)` layer under the sheet |
| Content layer, no glass | library cards, scan preview and settings lists are solid `--surface` |
| Reduce transparency | `@media (prefers-reduced-transparency: reduce)` makes glass a solid surface |
| Increase contrast | `@media (prefers-contrast: more)` gives a solid surface, full-strength secondary text and a visible stroke |
| No backdrop-filter support | `@supports not (backdrop-filter…)` falls back to solid |

Our components are an original interpretation. Never use Apple's logos, SF Symbols artwork or screenshots.
