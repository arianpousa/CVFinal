// db.test.mjs: proves src/db.js against a spec-compliant IndexedDB (fake-indexeddb).
// Adapted from knowledge/indexeddb-expert/examples/db.test.mjs (19/19) for original + result Blobs.
// Run (from tests/): node unit/db.test.mjs
import 'fake-indexeddb/auto';
import * as DB from '../../src/db.js';

let fails = 0;
const check = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!ok) fails++; };
const blob = (n, type = 'image/png') => new Blob([new Uint8Array(n).fill(7)], { type });
const scan = (name) => ({ name, mode: 'bw', width: 800, height: 1000, origWidth: 2000, origHeight: 1500, corners: [{ x: 0, y: 0 }], found: true,
  original: blob(9000, 'image/jpeg'), result: blob(5000), thumb: blob(300, 'image/jpeg') });

// 1) open v1 creates schema
let db = await DB.openDB();
check('stores created', [...db.objectStoreNames].sort().join() === 'blobs,history,scans,settings');
check('version is 1 with createdAt + name indexes', db.version === 1 && [...db.transaction('scans').objectStore('scans').indexNames].sort().join() === 'createdAt,name');

// 2) save -> list -> original AND result round-trip as Blobs
const id1 = await DB.saveScan(db, scan('Receipt A'));
await new Promise((r) => setTimeout(r, 5));
const id2 = await DB.saveScan(db, scan('Page B'));
const list = await DB.listScans(db);
check('two scans listed newest first, with name and date', list.length === 2 && list[0].name === 'Page B' && typeof list[0].createdAt === 'number');
check('thumbnail comes back as a Blob', list[0].thumb instanceof Blob && list[0].thumb.size === 300);
const imgs = await DB.getImages(db, id1);
check('original Blob round-trips with type and size', imgs.original instanceof Blob && imgs.original.size === 9000 && imgs.original.type === 'image/jpeg');
check('result Blob round-trips with type and size', imgs.result instanceof Blob && imgs.result.size === 5000 && imgs.result.type === 'image/png');
const meta = await DB.getScan(db, id1);
check('metadata records both sizes', meta.originalBytes === 9000 && meta.resultBytes === 5000 && meta.origWidth === 2000);
let typeErr = ''; try { await DB.saveScan(db, { ...scan('bad'), original: null }); } catch (e) { typeErr = e.name; }
check('saveScan refuses a scan without its original Blob', typeErr === 'TypeError');

// 3) "refresh": close and reopen, data persists
db.close();
db = await DB.openDB();
check('scans survive close/reopen (refresh)', (await DB.listScans(db)).length === 2);

// 4) rename + settings + history
await DB.renameScan(db, id1, 'Receipt A (Nov)');
await DB.setSetting(db, 'mode', 'gray');
check('rename persisted', (await DB.listScans(db)).some((s) => s.name === 'Receipt A (Nov)'));
check('setting persisted; fallback works', (await DB.getSetting(db, 'mode')) === 'gray' && (await DB.getSetting(db, 'nope', 42)) === 42);

// 5) atomic delete removes metadata AND both images
await DB.deleteScan(db, id2);
const hist = await DB.reqP(db.transaction('history').objectStore('history').getAll());
check('delete removes scan + original + result', (await DB.listScans(db)).length === 1 && (await DB.getImages(db, id2)) === null);
check('history logged scan,scan,rename,delete', hist.map((h) => h.action).join() === 'scan,scan,rename,delete');

// 6) failed transaction rolls back everything (atomicity)
let aborted = false;
try {
  const tx = db.transaction(['scans', 'blobs'], 'readwrite');
  tx.objectStore('blobs').put({ scanId: 999, original: blob(1), result: blob(1) });
  tx.objectStore('scans').add({ id: id1, name: 'duplicate key' });   // ConstraintError -> abort
  await DB.txDone(tx);
} catch (e) { aborted = e.name === 'ConstraintError'; }
check('ConstraintError aborts the whole transaction (error read from e.target)', aborted && (await DB.getImages(db, 999)) === null);

// 7) awaiting unrelated async work mid-transaction loses the write
let inactive = '';
try {
  const tx = db.transaction('settings', 'readwrite');
  await new Promise((r) => setTimeout(r, 0));           // e.g. awaiting canvas.toBlob()
  tx.objectStore('settings').put({ key: 'x', value: 1 });
} catch (e) { inactive = e.name; }
check('awaiting unrelated work kills the transaction', ['InvalidStateError', 'TransactionInactiveError'].includes(inactive), `(${inactive})`);
check('...and nothing was written', (await DB.getSetting(db, 'x', 'missing')) === 'missing');

// 8) version upgrade: v2 opened elsewhere -> v1 connection gets versionchange, closes, upgrade keeps data
db.close();
let outdated = false;
db = await DB.openDB({ onOutdated: () => { outdated = true; } });
const db2 = await DB.openDB({ version: 2 });
check('old connection told to close (onOutdated)', outdated);
check('upgrade to v2 kept scans + images and added an index', db2.version === 2 && db2.transaction('scans').objectStore('scans').indexNames.contains('mode') && (await DB.listScans(db2)).length === 1 && (await DB.getImages(db2, id1)).original.size === 9000);

// 9) stale page asking for v1 when DB is v2 -> VersionError
let verr = '';
try { await DB.openDB({ version: 1 }); } catch (e) { verr = e.name; }
check('stale tab gets VersionError', verr === 'VersionError');

// 10) a connection that ignores versionchange BLOCKS the upgrade -> onBlocked, then onUnblocked
const stubborn = await DB.openDB({ version: 2 });
stubborn.onversionchange = null;                         // misbehaving tab: never closes
db2.onversionchange = null;
let sawBlocked = false, sawUnblocked = false;
const db3 = await DB.openDB({ version: 3, onBlocked: () => { sawBlocked = true; setTimeout(() => { stubborn.close(); db2.close(); }, 20); }, onUnblocked: () => { sawUnblocked = true; } });
check('onBlocked fires while an old connection stays open', sawBlocked);
check('onUnblocked fires and the upgrade completes once it closes', sawUnblocked && db3.version === 3);

// 11) QuotaExceededError handled gracefully
const realTx = db3.transaction.bind(db3);
db3.transaction = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); };
const res = await DB.trySave(db3, scan('too big'));
db3.transaction = realTx;
check('QuotaExceededError -> {ok:false, reason:"quota"}', !res.ok && res.reason === 'quota');

// 12) Reset app data deletes the database (and reports a blocking tab)
const other = await DB.openDB({ version: 3 });
other.onversionchange = null;                            // another tab that won't let go
let resetBlocked = false;
await DB.resetAppData(db3, { onBlocked: () => { resetBlocked = true; other.close(); } });
check('reset reports a blocking tab, then finishes', resetBlocked);
const fresh = await DB.openDB();
check('after reset the library is empty (fresh v1 DB)', (await DB.listScans(fresh)).length === 0 && fresh.version === 1);
fresh.close();

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
