---
name: chrome-devtools-debugging
description: "How to inspect and fix the app in Chrome DevTools on Windows: Application panel IndexedDB (refresh, delete entries, clear store, delete database), Clear site data, Network, Console, worker threads, memory checks. Use when testing, debugging hangs, or writing troubleshooting docs."
---
# Chrome DevTools debugging (Windows)

Open DevTools: **F12** or **Ctrl+Shift+I**. Hard reload: **Ctrl+Shift+R**. Reference: `docs/05-troubleshooting-hangs.md`.

## IndexedDB (Application panel)
1. Application → IndexedDB → `docscanner` (shows origin + version).
2. Click a store → entries + Total entries; click a Value to expand.
3. Data does not live-update → **Refresh** / **Refresh database**.
4. Select a row → **Delete** key or **Delete Selected**.
5. **Clear object store**; **Delete database**.
6. Values can't be edited in the panel → use Sources → Snippets.

## Clear everything
Application → Storage → keep IndexedDB checked → **Clear site data** → Ctrl+Shift+R.

## Other checks
- Network: `opencv-*.js` status 200, size, `cache-control`, `content-encoding`.
- Console: worker errors, `VersionError`, `QuotaExceededError`, `TransactionInactiveError`.
- Sources → Threads: the `cv-worker.js` thread is alive; pause to find a hot loop.
- Memory / Performance monitor: memory plateaus over 20 repeated scans (no Mat leak).
