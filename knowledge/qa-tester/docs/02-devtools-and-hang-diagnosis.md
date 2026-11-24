# Diagnosing hangs, leaks and storage issues in Chrome DevTools (Windows)

**Sources:** Chrome DevTools IndexedDB: https://developer.chrome.com/docs/devtools/storage/indexeddb · MDN Using Web Workers: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers · MDN Using IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB · MDN Storage quotas: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria

Shortcuts: DevTools **F12** / **Ctrl+Shift+I**, hard reload **Ctrl+Shift+R**, command menu **Ctrl+Shift+P**.

## IndexedDB (Application panel)
- **IndexedDB → docscanner** shows the version. Click a store to see entries and Total entries.
- Press **Refresh**, because the view doesn't live-update.
- Delete one record: select the row, then **Delete** / **Delete Selected**. Empty a store with **Clear object store**. Remove the DB with **Delete database**.
- Clear everything: the **Clear storage / Storage** pane, keep IndexedDB checked, then **Clear site data**.
- Values can't be edited in the panel. Use Sources → Snippets.

## Symptom → cause → evidence
| Symptom | Likely cause | Where to look |
|---|---|---|
| Stuck "Loading scanner…" | `opencv.js` 404 or slow; `importScripts` threw `NETWORK_ERROR`; or code did `await cv` on the thenable module (hangs, reproduced by opencv-expert) | Network (opencv request status and size); Console (worker errors with filename and line) |
| Stuck "Working…" | worker threw and never replied; CV on the main thread | Console; Sources → Threads (is `cv-worker.js` alive?); Performance recording (long tasks on Main) |
| Tab gets slower and crashes | `cv.Mat` leak (the heap only grows) | Memory panel / Task Manager (**Shift+Esc**) for the worker; repeat 20 scans and watch it plateau |
| Library never loads after an update | upgrade blocked by another tab (`onblocked`) | Close other tabs; Application → IndexedDB version |
| `VersionError` | stale cached page vs newer DB | Hard reload |
| Save fails | `QuotaExceededError`, or awaiting inside a transaction (`InvalidStateError` / `TransactionInactiveError`) | Console; Storage usage |

## How our automated checks measure these
- **Freeze:** a 16 ms `setInterval` heartbeat on the main thread records the largest gap while scans run. Measured: **22 ms max over 21 scans**, so nothing blocked the UI. A CV call on the main thread would show gaps of hundreds of ms.
- **Leak:** the worker reports `cv.HEAP8.length` after each job. Measured: **128 MiB constant over 20 scans**.
- **Persistence:** count the scans, reload, count again (21 → 21).
- **DevTools visibility:** `indexedDB.databases()` lists `docscanner@v1`, the same thing the Application panel shows.
