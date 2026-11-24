---
name: browser-testing-checklist
description: "Acceptance and regression test checklist for the scanner in Chrome, locally and on the live Netlify URL, mapped to the grading rubric. Use before sign-off, after each feature merge, and after every deploy."
---
# Browser testing checklist

Serve locally with `python -m http.server 8080` from the repo root (opencv.js must be served over http, not file://).

## Rubric checks
| # | Check | Pass when |
|---|---|---|
| 1 | Live app | Netlify URL opens in Chrome with no Console errors |
| 2 | OpenCV loads | Status pill reaches "Ready" once; Network shows opencv.js fetched once |
| 3 | CV feature | Each `samples/` image: corners found, warp flat, B&W crisp |
| 4 | No freeze | While "Working…", scrolling/clicking stays responsive |
| 5 | Mats deleted | 20 repeated scans → memory plateaus |
| 6 | Persistence | Save 2 scans → Ctrl+Shift+R → both still in Library |
| 7 | DevTools | Application → IndexedDB → docscanner → scans shows the records (after Refresh) |
| 8 | Reset | "Reset app data" empties Library and DB, app reloads to Ready |
| 9 | Pages | How it works + Resources pages load; all links work |
| 10 | Camera | "Use camera" works or shows a clear fallback when denied |

## Edge cases
No page in photo (fallback rectangle), very large photo (≥ 12 MP), dark photo, two tabs open during an upgrade, Incognito.

## Reporting
File each failure in the hand-off log: check #, steps, expected vs actual, owner agent.
