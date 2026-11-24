---
name: apple-hig-ux
description: "Apple Human Interface Guidelines-based UX for the scanner: core flow, feedback and empty/loading/error states, accessibility, and plain-language copy. Use when designing flows, reviewing UI for usability/accessibility, or writing UI text."
---
# Apple HIG UX (Wren's playbook)

## Core flow (3 steps max)
1. **Capture** — "Upload photo" or "Use camera" (+ "Try a sample" on empty state).
2. **Adjust** — auto-detected corners shown; drag handles to fix; mode toggle Color / Gray / B&W.
3. **Save** — saves to Library with an editable title; toast "Saved to Library".

## States every screen must design
| State | Requirement |
|---|---|
| Loading | Status pill "Loading OpenCV…" with progress feel; app UI still usable for browsing library |
| Ready | Pill turns green "Ready" |
| Working | Pill "Working…", disable only the affected action, never the whole page |
| Empty library | Friendly illustration-free message + "Try a sample" |
| Error | What happened + what to do (see `reset-and-recovery`) |

## Accessibility
- Full keyboard path (Tab order, Enter/Space, arrow keys nudge a focused corner handle by 1 px / Shift = 10 px).
- `aria-live="polite"` on the status pill; labels on icon buttons; visible focus rings.
- Contrast ≥ 4.5:1; respects `prefers-reduced-motion` and `prefers-color-scheme`.
- Camera: ask only on "Use camera"; explain denial and offer upload instead.

## Copy rules
Short, plain, verb-first ("Save scan", "Delete", "Reset app data"). No jargon like "Mat" or "IndexedDB" in the main UI — keep it for How-it-works.
