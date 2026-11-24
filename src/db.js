// db.js: the docscanner IndexedDB layer (indexeddb-expert, Archie). ES module.
// Built from the tested knowledge/indexeddb-expert/examples/db.js (19/19), extended so every scan keeps
// BOTH the original photo and the cleaned result as Blobs, plus a small thumbnail, a name and a date.
//
// Schema, database "docscanner" version 1:
//   scans    keyPath id (autoIncrement)  {id, name, createdAt, mode, width, height, origWidth, origHeight,
//                                         corners, found, resultBytes, originalBytes, originalType}
//            indexes: createdAt, name
//   blobs    keyPath scanId              {scanId, original: Blob, result: Blob, thumb: Blob}
//   settings keyPath key                 {key, value}
//   history  keyPath id (autoIncrement)  {at, action, scanId}   index: at
//
// Sources:
//   Using IndexedDB:  https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
//   IndexedDB API:    https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
//   Storage quotas:   https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
// Tested by tests/unit/db.test.mjs (fake-indexeddb) and in Chrome by tests/e2e/app.e2e.cjs.

export const DB_NAME = 'docscanner';
export const DB_VERSION = 1;

// Wrap one request / one transaction in a Promise.
export const reqP = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
// Gotcha (found in testing): when a request fails, its error event bubbles to tx.onerror BEFORE the
// transaction aborts, so tx.error is still null there. Use the failing request's error (e.target.error).
export const txDone = (tx) => new Promise((res, rej) => {
  tx.oncomplete = () => res();
  tx.onerror = (e) => rej(e.target?.error ?? tx.error);
  tx.onabort = () => rej(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
});

/** Migrations are additive: one `if (oldVersion < N)` block per version. Never edit an old block. */
export function upgrade(db, oldVersion, tx) {
  if (oldVersion < 1) {
    const scans = db.createObjectStore('scans', { keyPath: 'id', autoIncrement: true });
    scans.createIndex('createdAt', 'createdAt');
    scans.createIndex('name', 'name');
    db.createObjectStore('blobs', { keyPath: 'scanId' });
    db.createObjectStore('settings', { keyPath: 'key' });
    db.createObjectStore('history', { keyPath: 'id', autoIncrement: true }).createIndex('at', 'at');
  }
  // The next version goes here. This block is exercised by the tests (and the blocked-upgrade e2e test)
  // by opening version 2, which proves upgrades keep existing scans.
  if (oldVersion < 2 && db.version >= 2) {
    tx.objectStore('scans').createIndex('mode', 'mode');
  }
}

/**
 * Open the database.
 * @param events {onBlocked, onUnblocked, onOutdated, onClosed}: UI hooks (banners)
 *   onBlocked   another tab holds an older version open, so this upgrade has to wait
 *   onUnblocked the wait is over (the open succeeded after being blocked)
 *   onOutdated  a newer version was opened in another tab; this connection was closed for it
 *   onClosed    the browser closed the connection unexpectedly (e.g. site data cleared)
 */
export function openDB({ name = DB_NAME, version = DB_VERSION, onBlocked = () => {}, onUnblocked = () => {}, onOutdated = () => {}, onClosed = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    let wasBlocked = false;
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = (e) => upgrade(req.result, e.oldVersion, req.transaction);
    req.onblocked = () => { wasBlocked = true; onBlocked(); };
    req.onerror = () => reject(req.error);              // e.g. VersionError: stale page, newer DB
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); onOutdated(); };   // let the newer tab upgrade
      db.onclose = () => onClosed();
      if (wasBlocked) onUnblocked();
      resolve(db);
    };
  });
}

/**
 * Save a scan atomically: metadata + original/result/thumb blobs + history in ONE readwrite transaction.
 * All Blobs must already exist: never await canvas.toBlob() while a transaction is open.
 * @returns the new scan id
 */
export async function saveScan(db, { name, mode, width, height, origWidth, origHeight, corners, found, original, result, thumb, createdAt = Date.now() }) {
  if (!(original instanceof Blob) || !(result instanceof Blob) || !(thumb instanceof Blob)) throw new TypeError('saveScan needs original, result and thumb Blobs');
  const tx = db.transaction(['scans', 'blobs', 'history'], 'readwrite');
  const add = tx.objectStore('scans').add({
    name, mode, width, height, origWidth, origHeight, corners, found,
    resultBytes: result.size, originalBytes: original.size, originalType: original.type, createdAt,
  });
  let id;
  add.onsuccess = () => {
    id = add.result;
    tx.objectStore('blobs').put({ scanId: id, original, result, thumb });
    tx.objectStore('history').add({ at: Date.now(), action: 'scan', scanId: id });
  };
  await txDone(tx);
  return id;
}

/** Newest first: metadata + thumbnail only (the full images load on demand). */
export async function listScans(db) {
  const tx = db.transaction(['scans', 'blobs'], 'readonly');
  const scans = await reqP(tx.objectStore('scans').index('createdAt').getAll());
  const blobs = tx.objectStore('blobs');
  const recs = await Promise.all(scans.map((s) => reqP(blobs.get(s.id))));
  return scans.map((s, i) => ({ ...s, thumb: recs[i]?.thumb ?? null })).reverse();
}

export async function getScan(db, id) {
  return reqP(db.transaction('scans').objectStore('scans').get(id));
}

/** Both full-size images for one scan: {original, result} (Blobs) or null. */
export async function getImages(db, id) {
  const rec = await reqP(db.transaction('blobs').objectStore('blobs').get(id));
  return rec ? { original: rec.original, result: rec.result } : null;
}

export async function deleteScan(db, id) {
  const tx = db.transaction(['scans', 'blobs', 'history'], 'readwrite');
  tx.objectStore('scans').delete(id);
  tx.objectStore('blobs').delete(id);
  tx.objectStore('history').add({ at: Date.now(), action: 'delete', scanId: id });
  await txDone(tx);
}

export async function renameScan(db, id, name) {
  const tx = db.transaction(['scans', 'history'], 'readwrite');
  const store = tx.objectStore('scans');
  const rec = await reqP(store.get(id));     // OK: awaiting a request OF THIS transaction keeps it alive
  if (!rec) throw new DOMException('Scan not found', 'NotFoundError');
  store.put({ ...rec, name });
  tx.objectStore('history').add({ at: Date.now(), action: 'rename', scanId: id });
  await txDone(tx);
}

export async function setSetting(db, key, value) {
  const tx = db.transaction('settings', 'readwrite');
  tx.objectStore('settings').put({ key, value });
  await txDone(tx);
}
export async function getSetting(db, key, fallback) {
  const rec = await reqP(db.transaction('settings').objectStore('settings').get(key));
  return rec ? rec.value : fallback;
}

/** Storage usage for the footer; null where the Storage API is missing. */
export async function storageInfo() {
  if (!globalThis.navigator?.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  const persisted = (await navigator.storage.persisted?.()) ?? false;
  return { usage, quota, persisted };
}

/** Ask the browser not to evict our data under storage pressure (best effort, may be denied). */
export async function requestPersist() {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}

/** Friendly wrapper: turn QuotaExceededError into a UI-level result. */
export async function trySave(db, scan) {
  try { return { ok: true, id: await saveScan(db, scan) }; }
  catch (err) {
    if (err?.name === 'QuotaExceededError') return { ok: false, reason: 'quota' };
    throw err;
  }
}

/** Reset app data: close our connection first, or deleteDatabase is blocked by ourselves. */
export function resetAppData(db, { name = DB_NAME, onBlocked = () => {} } = {}) {
  try { db?.close(); } catch { /* already closed */ }
  return new Promise((resolve, reject) => {
    const r = indexedDB.deleteDatabase(name);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
    r.onblocked = () => onBlocked();        // another tab still has it open; resolves once that tab closes it
  });
}
