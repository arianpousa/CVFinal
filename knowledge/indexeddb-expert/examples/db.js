// db.js: the docscanner IndexedDB layer (worked example, ES module).
// Sources:
//   Using IndexedDB:  https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
//   IndexedDB API:    https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
//   Storage quotas:   https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
// Tested by db.test.mjs (fake-indexeddb implements the IndexedDB spec in Node).

export const DB_NAME = 'docscanner';
export const DB_VERSION = 1;

// Wrap one request / one transaction in a Promise.
export const reqP = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
// Gotcha (found in testing): when a request fails, its error event bubbles to tx.onerror
// BEFORE the transaction aborts, so tx.error is still null there. Use the failing
// request's error (e.target.error) and fall back to tx.error on abort.
export const txDone = (tx) => new Promise((res, rej) => {
  tx.oncomplete = () => res();
  tx.onerror = (e) => rej(e.target?.error ?? tx.error);
  tx.onabort = () => rej(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
});

/** Migrations are additive: one `if (oldVersion < N)` block per version. Never edit old blocks. */
export function upgrade(db, oldVersion, tx) {
  if (oldVersion < 1) {
    const scans = db.createObjectStore('scans', { keyPath: 'id', autoIncrement: true });
    scans.createIndex('createdAt', 'createdAt');
    scans.createIndex('title', 'title');
    db.createObjectStore('blobs', { keyPath: 'scanId' });
    db.createObjectStore('settings', { keyPath: 'key' });
    db.createObjectStore('history', { keyPath: 'id', autoIncrement: true }).createIndex('at', 'at');
  }
  // Example of a future v2 (exercised in the tests with version 2):
  if (oldVersion < 2 && db.version >= 2) {
    tx.objectStore('scans').createIndex('mode', 'mode');
  }
}

/**
 * Open the database.
 * @param events {onBlocked, onOutdated, onClosed}: UI hooks (banners)
 */
export function openDB({ name = DB_NAME, version = DB_VERSION, onBlocked = () => {}, onOutdated = () => {}, onClosed = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = (e) => upgrade(req.result, e.oldVersion, req.transaction);
    req.onblocked = () => onBlocked();                  // another tab holds an older version open
    req.onerror = () => reject(req.error);              // e.g. VersionError: stale page, newer DB
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); onOutdated(); };   // let the newer tab upgrade
      db.onclose = () => onClosed();                    // unexpected close (storage cleared, etc.)
      resolve(db);
    };
  });
}

/**
 * Save a scan atomically: metadata + blobs + history in ONE readwrite transaction.
 * Blobs must already exist: never await canvas.toBlob() while a transaction is open.
 */
export async function saveScan(db, { title, mode, width, height, corners, full, thumb }) {
  const tx = db.transaction(['scans', 'blobs', 'history'], 'readwrite');
  const add = tx.objectStore('scans').add({ title, mode, width, height, corners, bytes: full.size, createdAt: Date.now() });
  let id;
  add.onsuccess = () => {
    id = add.result;
    tx.objectStore('blobs').put({ scanId: id, full, thumb });
    tx.objectStore('history').add({ at: Date.now(), action: 'scan', scanId: id });
  };
  await txDone(tx);
  return id;
}

/** Newest first, metadata + thumbnail only (full blobs load on demand). */
export async function listScans(db) {
  const tx = db.transaction(['scans', 'blobs'], 'readonly');
  const scans = await reqP(tx.objectStore('scans').index('createdAt').getAll());
  const blobs = tx.objectStore('blobs');
  const thumbs = await Promise.all(scans.map((s) => reqP(blobs.get(s.id))));
  return scans.map((s, i) => ({ ...s, thumb: thumbs[i]?.thumb ?? null })).reverse();
}

export async function getFullBlob(db, id) {
  const rec = await reqP(db.transaction('blobs').objectStore('blobs').get(id));
  return rec?.full ?? null;
}

export async function deleteScan(db, id) {
  const tx = db.transaction(['scans', 'blobs', 'history'], 'readwrite');
  tx.objectStore('scans').delete(id);
  tx.objectStore('blobs').delete(id);
  tx.objectStore('history').add({ at: Date.now(), action: 'delete', scanId: id });
  await txDone(tx);
}

export async function renameScan(db, id, title) {
  const tx = db.transaction(['scans', 'history'], 'readwrite');
  const store = tx.objectStore('scans');
  const rec = await reqP(store.get(id));     // OK: awaiting a request OF THIS transaction keeps it alive
  store.put({ ...rec, title });
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

/** Storage usage for the Settings screen; asks for persistence once. */
export async function storageInfo() {
  if (!globalThis.navigator?.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  const persisted = (await navigator.storage.persisted?.()) ?? false;
  return { usage, quota, persisted };
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
  db?.close();
  return new Promise((resolve, reject) => {
    const r = indexedDB.deleteDatabase(name);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
    r.onblocked = () => onBlocked();
  });
}
