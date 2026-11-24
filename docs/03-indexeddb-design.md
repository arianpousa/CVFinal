# 03 · IndexedDB design: scans, settings, history

**Owner agent:** `indexeddb-expert` · **Related:** [05 Troubleshooting](05-troubleshooting-hangs.md)

## 1. Core facts (MDN "Using IndexedDB")

- `indexedDB.open(name, version)` returns a request; the DB is usable only after `success`. ([Using IndexedDB][using])
- A new DB or a higher version fires `onupgradeneeded` **before** `onsuccess`. **Versions are integers.** Opening with a lower version than stored fails with `VersionError`. ([Using IndexedDB][using])
- Stores and indexes can only be created or deleted inside `onupgradeneeded`. Changing a store's `keyPath` means delete + recreate, which loses its data. ([Using IndexedDB][using])
- Transaction modes are `readonly` (default), `readwrite`, and `versionchange`. Only one `readwrite` transaction per store runs at a time. ([Using IndexedDB][using])
- A transaction auto-commits once it has no pending requests and control returns to the event loop. Requests made after that throw `TransactionInactiveError`, **so never `await` unrelated work (like `canvas.toBlob`) mid-transaction.** ([Using IndexedDB][using])
- Keep each logical change in **one** transaction, or a crash between two transactions can leave the DB inconsistent. ([Using IndexedDB][using])
- Unhandled request errors abort the whole transaction. A duplicate key on `add()` raises `ConstraintError`. ([Using IndexedDB][using])
- `IDBDatabase.onclose` fires on unexpected closure, and affected transactions abort. ([Using IndexedDB][using])
- Values are stored with the **structured clone** algorithm (per the IndexedDB spec), which is why `Blob`s can be stored directly. ([Using IndexedDB][using])

## 2. Schema (DB name `docscanner`, version 1)

| Store | keyPath | Indexes | Value |
|---|---|---|---|
| `scans` | `id` (autoIncrement) | `createdAt`, `title` | `{id, title, createdAt, mode:'bw'|'gray'|'color', width, height, corners:[{x,y}×4], bytes}` |
| `blobs` | `scanId` | — | `{scanId, full: Blob(image/png or webp), thumb: Blob(jpeg ~200px)}` |
| `settings` | `key` | — | `{key:'cannyLow', value:75}`, `{key:'mode', value:'bw'}`, … |
| `history` | `id` (autoIncrement) | `at` | `{id, at, action:'scan'|'delete'|'rename'|'reset', scanId?}` |

**Why split metadata and blobs:** the library grid reads `scans` + thumbnails quickly with `getAll()`, and full-size blobs load only when a scan is opened.

**Saving a scan (one transaction across three stores):**

```js
// 1) produce blobs FIRST (async), 2) then open ONE short transaction
const full  = await canvasToBlob(outCanvas, 'image/png');
const thumb = await canvasToBlob(thumbCanvas, 'image/jpeg', 0.8);
const tx = db.transaction(['scans','blobs','history'], 'readwrite');
const req = tx.objectStore('scans').add({title, createdAt: Date.now(), mode, width, height, corners, bytes: full.size});
req.onsuccess = () => {
  const scanId = req.result;
  tx.objectStore('blobs').put({scanId, full, thumb});
  tx.objectStore('history').add({at: Date.now(), action:'scan', scanId});
};
await txDone(tx); // resolve on complete, reject on error/abort
```

Display a stored blob with `URL.createObjectURL(blob)` and **revoke** the URL when the card is removed.

## 3. Versioning & migrations

```js
req.onupgradeneeded = (e) => {
  const db = req.result;
  const old = e.oldVersion;            // 0 for brand-new DB
  if (old < 1) { /* create v1 stores + indexes */ }
  if (old < 2) { /* e.g. add index 'tags' on scans */ }
};
```

- Always `db.onversionchange = () => { db.close(); showBanner('App updated — reload'); }`. Otherwise another tab blocks upgrades. ([Using IndexedDB][using])
- Handle `req.onblocked` by showing "Close other tabs of this app". ([Using IndexedDB][using])
- Handle `VersionError` (an old cached page against a newer DB) by prompting a reload.

## 4. Storage limits & persistence

- Chromium lets an origin store up to **60 % of total disk size**, and the browser as a whole caps at 80 %. ([MDN Storage quotas][quota])
- `navigator.storage.persist()` requests persistent storage. Chromium decides silently based on how the user has engaged with the site, and persisted data is evicted only if the user clears it. ([MDN Storage quotas][quota])
- `navigator.storage.estimate()` returns `{usage, quota}`. Show it in Settings ("Using 18 MB of 120 GB"). ([MDN Storage quotas][quota])
- Over-quota writes fail with **`QuotaExceededError`**. Catch it, and offer to delete old scans. ([MDN Storage quotas][quota])
- Under pressure, browsers evict the least-recently-used non-persistent origin, **all at once**. ([MDN Storage quotas][quota])
- Incognito storage is usually wiped when the session ends, so warn the user. ([MDN Storage quotas][quota])
- **Size budget:** a B&W 2500×3300 PNG is ~150–400 KB. Store a ~200 px JPEG thumbnail per scan. Never store raw RGBA arrays.

## 5. "Reset app data" button (required by the rubric)

```js
async function resetAppData() {
  worker?.terminate();
  db?.close();                                   // our own connection must close or delete is blocked
  await new Promise((res, rej) => {
    const r = indexedDB.deleteDatabase('docscanner');
    r.onsuccess = res; r.onerror = () => rej(r.error);
    r.onblocked = () => alert('Close other tabs of this app, then try again.');
  });
  location.reload();
}
```

## 6. Verifying in DevTools
In the **Application** panel, expand **IndexedDB** → `docscanner` → `scans` and press **Refresh**, because the view doesn't live-update. ([Chrome DevTools IndexedDB][devtools]) More in [doc 05](05-troubleshooting-hangs.md).

## Sources
- [api]: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- [using]: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
- [quota]: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- [devtools]: https://developer.chrome.com/docs/devtools/storage/indexeddb

[using]: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
[quota]: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
[devtools]: https://developer.chrome.com/docs/devtools/storage/indexeddb
