# Storage quotas, persistence and eviction

**Source:** MDN Storage quotas and eviction criteria: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria

## Chrome / Chromium
- An origin may store up to **60 % of total disk size**, in both best-effort and persistent modes. The quota is based on total disk size (to prevent fingerprinting), so low free space can still stop writes.
- Across all origins Chrome uses at most **80 % of total disk size**. Past that it evicts best-effort origins.

## APIs
```js
const { usage, quota } = await navigator.storage.estimate();   // estimate; padded for cross-origin
const granted = await navigator.storage.persist();             // Chromium decides silently, no prompt
const isPersisted = await navigator.storage.persisted();
```
- In Chromium, `persist()` is approved or denied based on how the user has engaged with the site. Persistent data is evicted only if the user clears it.

## QuotaExceededError
- Writes over quota fail with `QuotaExceededError` (IndexedDB, Cache, OPFS). Wrap saves in `try/catch` and free space by deleting old data, or tell the user.
- Our `trySave()` turns it into `{ ok:false, reason:'quota' }` and the UI shows "Storage is full. Delete some scans." (verified in tests with a simulated error).

## Eviction
- Under storage pressure, browsers evict the **least recently used** non-persistent origin first, and **all of its data at once** (IndexedDB and Cache together).
- Incognito/private mode: storage usually disappears when the session ends, and quotas may differ.

## Budget for our app
A B&W page PNG is about 150–400 KB, plus a ~20 KB JPEG thumbnail. 1,000 scans is about 0.4 GB, far below the quota on any normal disk. Show `usage/quota` in Settings and call `persist()` after the first save.
