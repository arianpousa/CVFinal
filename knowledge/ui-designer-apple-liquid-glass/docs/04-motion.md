# Motion

**Sources:** Apple HIG, Motion: https://developer.apple.com/design/human-interface-guidelines/motion · Accessibility (Reduce Motion): https://developer.apple.com/design/human-interface-guidelines/accessibility

## Apple guidance
- **Add motion purposefully.** Gratuitous animation distracts and can cause discomfort.
- **Make motion optional.** Never use it as the only way to communicate something.
- Feedback motion should be realistic, follow the gesture, and be **brief and precise**.
- **Avoid motion on frequent interactions** in apps.
- **Let people cancel motion.** Don't make them wait for an animation to finish.
- When Reduce Motion is on:
  - Reduce automatic and repetitive animation (zooming, scaling, peripheral motion).
  - Tighten springs.
  - Replace x/y/z transitions with fades.
  - Avoid animating into and out of blurs.

## Our motion spec
| Element | Motion | Reduced motion |
|---|---|---|
| Button press | `scale(.97)` over `--dur` (220 ms), `--ease` | none (`--dur: 0ms`) |
| Bottom sheet | 220 ms slide-up + fade | fade only / instant |
| Corner handles while dragging | follow the pointer 1:1 (no easing) | same |
| Status pill state change | color/text crossfade | instant |
| Spinner while "Working…" | small indeterminate spinner inside the pill only | static "Working…" text |

- Never animate the blur radius (HIG: avoid animating into and out of blurs).
- `render-check.cjs` verifies `prefers-reduced-motion: reduce` sets `--dur` to `0ms`.
