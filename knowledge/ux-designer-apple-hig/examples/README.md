# Wren's examples (tested)

| File | What good looks like |
|---|---|
| `flow-spec.md` | A complete UX hand-off: the 3-step flow, every state (loading, working, no page found, empty, camera denied, storage full, load failed), the copy deck, and accessibility acceptance criteria, each traced to an HIG rule |
| `accessible-corner-editor.html` | The hardest interaction done right: corner handles with pointer drag **and** keyboard (1 px / 10 px), live status announcements, 44px targets, an empty state with a next step, and a "Working…" state that disables only one button |
| `a11y-check.cjs` | Keyboard-only test of that page in headless Chrome |

## Run
`npx playwright install chromium && node a11y-check.cjs`

## Recorded result (2026-11-24, Chrome)
11/11 pass:
- the empty state offers a next step
- Tab focuses the first action
- Enter opens the editor with focus on the first corner
- the status uses `aria-live`
- ArrowRight moves 1 px and Shift+ArrowDown moves 10 px (60,40 → 61,50)
- the label reads "Top-left corner, x 61, y 50"
- Tab order reaches Save
- Working disables only Save
- a success message appears
- all buttons are ≥ 44 px
- the page is usable at 200 % zoom
