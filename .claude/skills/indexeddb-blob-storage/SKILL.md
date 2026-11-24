---
name: indexeddb-blob-storage
description: "Saving and loading scan images as Blobs in IndexedDB: create blobs before the transaction, one readwrite transaction per save, object URLs, quotas, QuotaExceededError, navigator.storage.persist/estimate. Use when writing save/load/delete code for the scan library."
---
# Blob storage for scans

## Save (one transaction, blobs made first)
```js
const full  = await new Promise(r => canvas.toBlob(r, 'image/png'));
const thumb = await new Promise(r => thumbCanvas.toBlob(r, 'image/jpeg', 0.8));
const tx = db.transaction(['scans','blobs','history'], 'readwrite');
const add = tx.objectStore('scans').add({title, createdAt: Date.now(), mode, width, height, corners, bytes: full.size});
add.onsuccess = () => {
  tx.objectStore('blobs').put({scanId: add.result, full, thumb});
  tx.objectStore('history').add({at: Date.now(), action: 'scan', scanId: add.result});
};
await txDone(tx);
```
`txDone(tx)` resolves on `complete`. On `error` it rejects with `e.target.error` (the failing request's error, because **`tx.error` is still null inside `onerror`**), and on `abort` with `tx.error`. The tested version is in `knowledge/indexeddb-expert/examples/db.js` (19/19 tests).

## Never
- `await` anything unrelated between creating a transaction and issuing its requests (TransactionInactiveError).
- Store raw RGBA arrays or data URLs — store Blobs.

## Load
- Library grid: `getAll()` on `scans` (sorted by `createdAt` desc) + `thumb` from `blobs`.
- Full image only when opened. `URL.createObjectURL(blob)`; `URL.revokeObjectURL(url)` when the element is removed.

## Delete
One transaction over `scans`, `blobs`, `history` (delete record + blob, add history row).

## Quota
- Wrap saves in try/catch; on `QuotaExceededError` show "Storage full — delete old scans".
- Call `navigator.storage.persist()` after the first successful save.
- Settings screen shows `navigator.storage.estimate()` usage/quota.
