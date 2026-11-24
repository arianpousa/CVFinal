# Opening, versions, onupgradeneeded, onblocked, onversionchange

**Source:** MDN Using IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB · IndexedDB API overview: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API

## open()
```js
const req = indexedDB.open('docscanner', 1);   // returns IDBOpenDBRequest
req.onupgradeneeded = e => { /* schema changes: ONLY here */ };
req.onsuccess = () => { const db = req.result; };
req.onerror  = () => console.error(req.error);
req.onblocked = () => { /* other tabs still hold an older version */ };
```
- The DB is usable only after `success`. A new DB, or a higher version than stored, fires `upgradeneeded` **before** `success`.
- **Versions are integers.** MDN warns that 2.1 and 2.4 both round to 2, so no upgrade event fires.
- Opening with a **lower** version than stored fails with `VersionError` (this happens to a stale cached page).
- Object stores and indexes can be created or deleted **only** inside `onupgradeneeded`. Creating one that exists, or deleting one that doesn't, throws.
- To change a store's `keyPath` you must delete and recreate it, which **loses its data**, so copy the data first.

## Migrations by oldVersion
```js
req.onupgradeneeded = (e) => {
  const db = req.result, tx = req.transaction;
  if (e.oldVersion < 1) { /* v1 stores */ }
  if (e.oldVersion < 2) { tx.objectStore('scans').createIndex('mode', 'mode'); }
};
```
Additive blocks run in order, so a user jumping from v0 to v3 gets every step. Never edit an old block.

## Blocked upgrades (MDN's recommended pattern)
- If other connections are open when a newer version is requested, they **block** the upgrade.
- Every connection should release the DB when asked:
  ```js
  db.onversionchange = () => { db.close(); /* banner: "A new version is ready, reload" */ };
  ```
- The upgrading request gets `onblocked` until the old connections close. Show "Close other tabs of this app".
- If nobody closes, the upgrade waits until the user closes the old tab.
- `db.onclose` fires on unexpected closure (for example, the user cleared site data).

## Verified in `examples/db.test.mjs`
- A v1 connection received `versionchange` when a second connection opened v2, closed itself, and the upgrade added an index while keeping the data.
- A stale `open(name, 1)` against v2 gave `VersionError`.
- A connection that ignored `versionchange` made `onblocked` fire on the v3 request. The upgrade finished after it closed.
