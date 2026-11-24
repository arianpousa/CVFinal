// db.test.mjs: proves db.js against a spec-compliant IndexedDB (fake-indexeddb).
// Run: npm i fake-indexeddb@6 && node db.test.mjs
import 'fake-indexeddb/auto';
import * as DB from './db.js';

let fails = 0;
const check = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!ok) fails++; };
const blob = (n, type = 'image/png') => new Blob([new Uint8Array(n).fill(7)], { type });
const scan = (title) => ({ title, mode: 'bw', width: 800, height: 1000, corners: [{ x: 0, y: 0 }], full: blob(5000), thumb: blob(300, 'image/jpeg') });

// 1) open v1 creates schema
let db = await DB.openDB();
check('stores created', [...db.objectStoreNames].sort().join() === 'blobs,history,scans,settings');
check('version is 1', db.version === 1);

// 2) save -> list -> blobs round-trip as Blobs
const id1 = await DB.saveScan(db, scan('Receipt A'));
await new Promise((r) => setTimeout(r, 5));
const id2 = await DB.saveScan(db, scan('Page B'));
const list = await DB.listScans(db);
check('two scans listed newest first', list.length === 2 && list[0].title === 'Page B');
check('thumbnail comes back as a Blob', list[0].thumb instanceof Blob && list[0].thumb.size === 300);
const full = await DB.getFullBlob(db, id1);
check('full image Blob round-trips with type', full instanceof Blob && full.size === 5000 && full.type === 'image/png');

// 3) "refresh": close and reopen, data persists
db.close();
db = await DB.openDB();
check('scans survive close/reopen (refresh)', (await DB.listScans(db)).length === 2);

// 4) rename + settings + history
await DB.renameScan(db, id1, 'Receipt A (Nov)');
await DB.setSetting(db, 'mode', 'gray');
check('rename persisted', (await DB.listScans(db)).some((s) => s.title === 'Receipt A (Nov)'));
check('setting persisted; fallback works', (await DB.getSetting(db, 'mode')) === 'gray' && (await DB.getSetting(db, 'nope', 42)) === 42);

// 5) atomic delete removes metadata AND blob
await DB.deleteScan(db, id2);
const hist = await DB.reqP(db.transaction('history').objectStore('history').getAll());
check('delete removes scan + blob', (await DB.listScans(db)).length === 1 && (await DB.getFullBlob(db, id2)) === null);
check('history logged scan,scan,rename,delete', hist.map((h) => h.action).join() === 'scan,scan,rename,delete');

// 6) failed transaction rolls back everything (atomicity)
let aborted = false;
try {
  const tx = db.transaction(['scans', 'blobs'], 'readwrite');
  tx.objectStore('blobs').put({ scanId: 999, full: blob(1) });
  tx.objectStore('scans').add({ id: id1, title: 'duplicate key' });   // ConstraintError -> abort
  await DB.txDone(tx);
} catch (e) { aborted = e.name === 'ConstraintError'; }
check('ConstraintError aborts the whole transaction', aborted && (await DB.getFullBlob(db, 999)) === null);

// 7) Awaiting unrelated async work mid-transaction loses the write.
//    With no pending requests the transaction auto-commits, so the next call throws
//    InvalidStateError ("transaction has finished"). If requests are still pending but
//    the transaction is inactive, it's TransactionInactiveError. Either way: create Blobs FIRST.
let inactive = '';
try {
  const tx = db.transaction('settings', 'readwrite');
  await new Promise((r) => setTimeout(r, 0));           // e.g. awaiting canvas.toBlob()
  tx.objectStore('settings').put({ key: 'x', value: 1 });
} catch (e) { inactive = e.name; }
check('awaiting unrelated work kills the transaction', ['InvalidStateError', 'TransactionInactiveError'].includes(inactive), `(${inactive})`);
check('...and nothing was written', (await DB.getSetting(db, 'x', 'missing')) === 'missing');

// 8) version upgrade: second tab opens v2 -> v1 connection gets versionchange, closes, upgrade proceeds
let outdated = false, blocked = false;
db.onversionchange = () => { db.close(); outdated = true; };
const db2 = await DB.openDB({ version: 2, onBlocked: () => { blocked = true; } });
check('old connection notified via onversionchange', outdated);
check('upgrade to v2 kept data and added index', db2.version === 2 && db2.transaction('scans').objectStore('scans').indexNames.contains('mode') && (await DB.listScans(db2)).length === 1);

// 9) stale page asking for v1 when DB is v2 -> VersionError
let verr = '';
try { await DB.openDB({ version: 1 }); } catch (e) { verr = e.name; }
check('stale tab gets VersionError', verr === 'VersionError');

// 10) a connection that ignores versionchange BLOCKS the upgrade -> onblocked fires
const stubborn = await DB.openDB({ version: 2 });
stubborn.onversionchange = null;                         // misbehaving tab: never closes
db2.onversionchange = null;
let sawBlocked = false;
const p3 = DB.openDB({ version: 3, onBlocked: () => { sawBlocked = true; stubborn.close(); db2.close(); } });
const db3 = await p3;
check('onblocked fires while old connections stay open', sawBlocked && db3.version === 3);

// 11) QuotaExceededError handled gracefully
const realSave = db3.transaction.bind(db3);
db3.transaction = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); };
const res = await DB.trySave(db3, scan('too big'));
db3.transaction = realSave;
check('QuotaExceededError -> {ok:false, reason:"quota"}', !res.ok && res.reason === 'quota');

// 12) Reset app data deletes the database
await DB.resetAppData(db3);
const fresh = await DB.openDB();
check('after reset the library is empty (fresh v1 DB)', (await DB.listScans(fresh)).length === 0 && fresh.version === 1);
fresh.close();

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
