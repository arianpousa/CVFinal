# Object stores, keys, indexes, cursors and Blobs

**Source:** MDN Using IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB · Blob: https://developer.mozilla.org/en-US/docs/Web/API/Blob · Structured clone: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm

## Keys (MDN table)
| keyPath | autoIncrement | Behaviour |
|---|---|---|
| no | no | any value; you supply the key on each add |
| yes | no | objects only; the key-path property must exist |
| no | yes | any value; the key is generated (or supplied) |
| yes | yes | objects only; the generated key is written into the key-path property |

The key generator starts at 1 and never goes down, even after delete or `clear()`. It only rolls back if the transaction aborts.

## Indexes
- `store.createIndex('createdAt', 'createdAt', { unique: false })`. Compound indexes are allowed: `createIndex('a_b', ['a','b'])`.
- `store.index('createdAt').getAll()` returns records sorted by that index. For a non-unique index, `get(x)` returns the lowest-key match.
- Use `IDBKeyRange.bound(lo, hi, openLo, openHi)` for ranges, and `openCursor(range, 'prev')` for descending order.
- Use `getAll()` for everything at once. Use a cursor to stop early or for key-only walks.

## CRUD
`add` (fails if the key exists), `put` (insert or overwrite), `get`, `delete`, `clear`, `openCursor` / `cursor.continue()`.

## Blobs
- Values are stored with the **structured clone algorithm** (IndexedDB spec), which supports `Blob` and `File`. MDN's Using IndexedDB page itself doesn't cover Blobs, so this comes from the spec and the structured-clone page.
- **Verified:** a 5000-byte `image/png` Blob and a 300-byte JPEG thumbnail round-tripped as real `Blob`s with the correct `size` and `type`, across a close and reopen.
- Store **Blobs**, not data URLs (33 % larger) and not raw RGBA (huge).
- Display a stored Blob with `img.src = URL.createObjectURL(blob)`, and call `URL.revokeObjectURL(url)` when done.

## Our schema (`docscanner` v1)
| store | keyPath | indexes | value |
|---|---|---|---|
| scans | `id` autoIncrement | `createdAt`, `title` | metadata (title, mode, size, corners, bytes, createdAt) |
| blobs | `scanId` | none | `{scanId, full: Blob, thumb: Blob}` |
| settings | `key` | none | `{key, value}` |
| history | `id` autoIncrement | `at` | `{at, action, scanId}` |
