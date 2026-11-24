# Transactions: modes, lifetime, atomicity, errors

**Source:** MDN Using IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB

## Modes and scope
- `db.transaction(['scans','blobs'], 'readwrite')`. Modes are `readonly` (the default), `readwrite`, and `versionchange` (implicit during upgrades).
- List only the stores you need. Non-overlapping scopes can run concurrently. Many `readonly` transactions can overlap, but only one `readwrite` per store runs at a time.
- Don't pass an empty store list (`InvalidAccessError`).

## Lifetime (auto-commit)
- A transaction stays active only while it has pending requests. When control returns to the event loop with nothing pending, it commits and fires `complete`.
- Making a request on an inactive transaction throws `TransactionInactiveError`.
- **Verified:** awaiting a `setTimeout` (a stand-in for `canvas.toBlob()`) inside a transaction meant the next `put` threw **`InvalidStateError`**, because the transaction had already finished, and nothing was written.
- Rule: **create Blobs and do all other async work first**, then open one short transaction. Awaiting a request *from the same transaction* is fine.

## Atomicity
- Keep each logical change in **one** transaction. MDN warns that clearing in one transaction and rewriting in another can leave the DB empty if the browser closes between them.
- **Verified:** a transaction that `put` a blob and then hit a duplicate-key `ConstraintError` on `add` was rolled back entirely, so the blob wasn't saved.

## Errors
- Error events go to the request, then the transaction, then the database. An unhandled request error **aborts the whole transaction**. Use `event.stopPropagation()` + `preventDefault()` in the request handler to recover locally.
- Common errors:
  - `ConstraintError`: duplicate key on `add`, or a unique-index violation.
  - `VersionError`: the stored version is newer than the one requested.
  - `AbortError`: the connection closed unexpectedly.
- **Gotcha (found in testing):** inside `tx.onerror`, `tx.error` is still `null`. Read `event.target.error` (the failing request's error). `tx.error` is only set by the time `onabort` fires.
- Durability: `complete` may fire before the data reaches disk (MDN notes this for Firefox, plus a non-standard `readwriteflush`). That's acceptable for scans.

## Promise helper (tested)
```js
const txDone = tx => new Promise((res, rej) => {
  tx.oncomplete = () => res();
  tx.onerror = e => rej(e.target?.error ?? tx.error);
  tx.onabort = () => rej(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
});
```
