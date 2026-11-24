# Accessibility (Apple HIG)

**Source:** https://developer.apple.com/design/human-interface-guidelines/accessibility (Markdown: …/accessibility.md, expanded March 2025, updated June 2025)

An accessible interface is **intuitive** (familiar, consistent interactions), **perceivable** (doesn't rely on any one sense) and **adaptable** (respects system settings and personalization).

## Vision
- Support larger text, ideally **enlarging text by at least 200 %**.
- Default and minimum text sizes: iOS 17 / 11 pt, macOS 13 / 10 pt, visionOS 17 / 12 pt, watchOS 16 / 12 pt.
- Thin weights need larger sizes.
- **Contrast minimums (WCAG AA, as used by Accessibility Inspector):**

  | Text size | Weight | Minimum |
  |---|---|---|
  | up to 17 pt | all | **4.5:1** |
  | 18 pt+ | all | 3:1 |
  | all | bold | 3:1 |

  If the defaults fall short, provide a higher-contrast scheme when Increase Contrast is on. Check both light and dark.
- **Convey information with more than color alone**, for example a distinct shape or icon. Red–green and blue–orange are hard pairs.
- Describe the UI for screen readers (VoiceOver).

## Mobility
- **Control sizes** (default / minimum): iOS 44×44 / 28×28 pt, macOS 28×28 / 20×20, visionOS 60×60 / 28×28, watchOS 44×44 / 28×28.
- **Spacing is as important as size.** Use about 12 pt of padding around bezeled elements and about 24 pt around unbezeled ones.
- Use simple gestures for common interactions. **Offer alternatives to gestures**, meaning an on-screen way to do the same thing (for example, a button as well as swipe-to-delete).
- **Let people use the keyboard alone** to navigate and interact (Full Keyboard Access). Don't override system shortcuts.

## Cognitive
- Keep actions simple and consistent.
- **Minimize time-boxed UI.** Prefer explicit dismissal over auto-dismiss timers.
- Be careful with fast-moving or blinking animation, and respond to **Reduce Motion**: tighten springs, track gestures directly, avoid z-axis depth animation, swap slides for fades, and don't animate in or out of blurs.
- Assistive Access: one interaction per screen, and **confirm twice** for hard-to-recover actions such as deleting.

## Applied to the scanner (verified in `examples/a11y-check.cjs`)
- Corner handles have pointer drag **and** arrow keys (1 px, or 10 px with Shift) as the gesture alternative.
- Every button is ≥ 44×44 px. Status is `aria-live="polite"`. Labels update with the coordinates.
- Complete keyboard path: Try a sample → corners → Save scan.
- "Reset app data" and "Delete all" require a confirmation dialog.
- The "Saved to Library" toast stays until dismissed or the next action (no timer-only dismissal).
