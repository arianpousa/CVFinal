# 05 · Why the app can hang, and how to fix it in Chrome DevTools

**Owner agents:** all · **Related:** [02](02-webassembly-and-workers.md), [03](03-indexeddb-design.md)

## 1. Root causes

| Symptom | Likely cause | Prevention in code |
|---|---|---|
| Status stuck on **"Loading OpenCV…"** | `opencv.js` failed to download (404 or wrong path), or `importScripts` threw `NETWORK_ERROR` ([MDN Workers][workers]), or `onRuntimeInitialized` never fired because the build uses the Promise style ([OpenCV 5 usage][usage5]) | Defensive loader (doc 01 §2), 30 s watchdog, `worker.onerror` showing the message/filename/line ([MDN Workers][workers]) |
| Stuck on **"Working…"** / page frozen | CV work running on the main thread, or the worker threw and never replied | All CV in the worker. Per-job timeout, then `worker.terminate()` (immediate kill ([MDN Workers][workers])) and respawn |
| Gets slower each scan, then crashes ("Aw, Snap!", `Cannot enlarge memory`) | Leaked `cv.Mat`s on the Emscripten heap ([Using OpenCV.js][usage]) or leaked object URLs | `try/finally` delete pattern (doc 02 §3), `URL.revokeObjectURL` |
| Library never loads / app waits forever after an update | **Blocked DB upgrade**: another tab holds an older-version connection ([Using IndexedDB][using]) | `db.onversionchange → db.close()`, `req.onblocked → banner` |
| `VersionError` on open | Stale cached page asks for an older version than stored ([Using IndexedDB][using]) | Catch it and prompt a reload |
| Save fails / `TransactionInactiveError` | `await` of unrelated async work inside a transaction ([Using IndexedDB][using]) | Create blobs first, then one short transaction |
| Save fails with `QuotaExceededError` | Disk/quota full ([MDN Storage quotas][quota]) | Catch it, offer to delete old scans, show `storage.estimate()` |
| Corrupt record breaks the library grid | Bad data from an earlier version | Validate each record when rendering; skip and log bad ones |

## 2. User fix #1: the in-app "Reset app data" button
It terminates the worker, closes the DB, deletes the `docscanner` database and reloads (code in doc 03 §5). It must be reachable even if OpenCV never loaded, so put it in the header and don't gate it on `ready`.

## 3. User fix #2: Chrome DevTools (when the page is frozen)

Open DevTools with **F12** or **Ctrl+Shift+I** (Windows), then go to the **Application** tab.

**Inspect / repair IndexedDB** ([Chrome DevTools IndexedDB][devtools])
1. Expand **IndexedDB**. Each DB is listed by name and origin. Click `docscanner` to see its **version**.
2. Click a store (e.g. `scans`) to see key–value pairs and **Total entries**. Click a Value cell to expand it.
3. The view does **not** update live, so click **Refresh** (store) or **Refresh database**.
4. Delete one bad record: select the row, then press **Delete** or click **Delete Selected**.
5. Empty a store with **Clear object store**. Remove the whole DB with **Delete database**.
6. Values can't be edited in the panel. To change data, use a **Snippet** (Sources → Snippets).

**Nuke everything for the site** ([Chrome DevTools IndexedDB][devtools])
- Application → **Storage** (called "Clear storage" in older versions), keep **IndexedDB** checked, then **Clear site data**. Then hard-reload with **Ctrl+Shift+R**.

**Other panels that help**
- **Console:** worker errors, `QuotaExceededError`, `VersionError`.
- **Network:** confirm `opencv.js` is 200 (not 404) and check how big it is.
- **Sources → Threads:** see whether the worker is alive and pause it to find a hot loop.
- **Memory / Performance monitor:** confirm the JS heap and worker memory plateau after repeated scans.
- **Application → Service workers** (if added later): "Unregister" and "Update on reload" for stale caches.

## 4. Troubleshooting table (for the README / How-it-works page)

| Problem | Try first | If still stuck |
|---|---|---|
| Stuck "Loading OpenCV…" | Reload; check your connection (~3.4 MB download) | DevTools → Network, find `opencv.js`; Console for errors |
| Stuck "Working…" | Wait 15 s (auto-retry) | Reset app data → reload |
| "Close other tabs" banner | Close other tabs of the app | Application → IndexedDB → Delete database |
| Library empty after update | Reload | Check Application → IndexedDB → `docscanner` → `scans` (Refresh) |
| Weird / broken thumbnails | Delete that scan | Delete Selected in DevTools, or Reset app data |
| Tab crashes after many scans | Reload | Report it as a memory leak (Mats not deleted) |

## Sources
- [devtools]: https://developer.chrome.com/docs/devtools/storage/indexeddb
- [using]: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
- [quota]: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- [workers]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
- [usage]: https://docs.opencv.org/4.x/d0/d84/tutorial_js_usage.html
- [usage5]: https://docs.opencv.org/5.0/js_tutorials/js_setup/js_usage/js_usage.html

[devtools]: https://developer.chrome.com/docs/devtools/storage/indexeddb
[using]: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
[quota]: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
[workers]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
[usage]: https://docs.opencv.org/4.x/d0/d84/tutorial_js_usage.html
[usage5]: https://docs.opencv.org/5.0/js_tutorials/js_setup/js_usage/js_usage.html
