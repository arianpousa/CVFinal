# indexeddb-expert examples (tested)

| File | Shows |
|---|---|
| `db.js` | The complete `docscanner` data layer: `openDB` (upgrade by `oldVersion`, `onblocked`, `onversionchange`, `onclose`), atomic `saveScan` across 3 stores, `listScans`, `getFullBlob`, `deleteScan`, `renameScan`, settings, `storageInfo`, `trySave` (QuotaExceededError), `resetAppData` |
| `db.test.mjs` | 19 checks against a spec-compliant IndexedDB (`fake-indexeddb`) |

## Run
```bash
cd knowledge/indexeddb-expert/examples && npm install && npm test
```

## Recorded result (2026-11-24, Node 22, fake-indexeddb 6)
All 19 pass:
- schema
- Blob round-trip (type and size kept)
- persists across close/reopen
- rename, settings, history
- atomic delete
- ConstraintError rolls back the whole transaction
- awaiting unrelated work kills the transaction (`InvalidStateError`) and writes nothing
- v1→v2 upgrade with `onversionchange` keeps data
- stale tab gets `VersionError`
- ignored `versionchange` makes `onblocked` fire
- QuotaExceededError is handled
- Reset leaves an empty fresh DB

Two gotchas were found by these tests and are now documented in `../docs/02-transactions.md`: `tx.error` is null inside `onerror`, and an idle transaction auto-commits, giving `InvalidStateError`.
