# Color and Dark Mode

**Sources:** Apple HIG, Color: https://developer.apple.com/design/human-interface-guidelines/color (updated Dec 16, 2025) · Dark Mode: https://developer.apple.com/design/human-interface-guidelines/dark-mode

## Color: key guidance
- **Don't use the same color to mean different things.** Use it consistently for status and interactivity.
- Make every color work in **light, dark and increased-contrast** contexts. Custom colors need light and dark variants plus a higher-contrast option.
- **Don't rely on color alone** to differentiate objects, show interactivity or carry essential information. Add text labels or glyph shapes.
- **Liquid Glass color:**
  - Glass has no color of its own; it takes color from what's behind it.
  - **Apply color sparingly.** Reserve it for status indicators or **primary actions**, and tint the **background** of a primary button (like Done), not its symbol.
  - **Don't tint the background of multiple controls.**
  - Over colorful content, prefer monochrome toolbars.
- Don't hard-code system color values. They're documented as a reference and may change between releases.
- System Blue (default light) is R0 G136 B255. Increased-contrast light Blue is R30 G110 B244. Gray6 light is R242 G242 B247, and dark is R28 G28 B30.

## Dark Mode: key guidance
- Respect the system setting. **Avoid an app-specific appearance setting.**
- Test both modes, and test with Increase Contrast and Reduce Transparency on.
- Dark palettes use dimmer backgrounds and brighter foregrounds. They aren't simple inversions.
- **Contrast: at least 4.5:1. Aim for 7:1 for custom colors, especially small text.**
- **Soften white backgrounds** in content images so they don't glow in Dark Mode.
- Base vs elevated backgrounds: foreground layers (sheets, popovers) get a slightly brighter background.

## Our palette decisions (verified with `examples/contrast-check.mjs`)
- **One accent**, `--accent`, appears only on the primary action (Scan, Save scan). Everything else is neutral.
- Status uses color + dot + text ("✓ Ready", "Working…", "Error"), never color alone.
- Body text: 15.1:1 light and 19.3:1 dark on the background, both above the 7:1 goal.
- Secondary text on glass: worst case 4.5:1+ after darkening `--text-2` to `#57575e` and raising glass opacity.
- In dark mode the accent label is **black on #0a84ff** (5.76:1). White on that blue fails.
- In dark mode thumbnails get `filter: brightness(.85)` (soften white backgrounds).
- We follow `prefers-color-scheme` only, with no in-app theme toggle.
