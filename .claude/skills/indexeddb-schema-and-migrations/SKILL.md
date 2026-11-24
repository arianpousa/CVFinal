---
name: indexeddb-schema-and-migrations
description: "The docscanner IndexedDB schema (scans, blobs, settings, history), version upgrades via oldVersion, onversionchange/onblocked handling, VersionError recovery. Use when opening the database, changing the schema, or debugging upgrade problems."
---
# IndexedDB schema & migrations

Reference: `docs/03-indexeddb-design.md`.

## Schema — DB `docscanner`, version 1
| Store | keyPath | Indexes |
|---|---|---|
| `scans` | `id` (autoIncrement) | `createdAt`, `title` |
| `blobs` | `scanId` | — |
| `settings` | `key` | — |
| `history` | `id` (autoIncrement) | `at` |

## Open
```js
export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('docscanner', 1);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (e.oldVersion < 1) {
        const s = db.createObjectStore('scans', {keyPath:'id', autoIncrement:true});
        s.createIndex('createdAt','createdAt'); s.createIndex('title','title');
        db.createObjectStore('blobs', {keyPath:'scanId'});
        db.createObjectStore('settings', {keyPath:'key'});
        db.createObjectStore('history', {keyPath:'id', autoIncrement:true}).createIndex('at','at');
      }
      // if (e.oldVersion < 2) { ... future migrations, never edit old branches }
    };
    req.onblocked = () => emit('db-blocked');           // UI: "Close other tabs of this app"
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); emit('db-outdated'); };   // UI: "Reload to update"
      db.onclose = () => emit('db-closed');
      resolve(db);
    };
    req.onerror = () => reject(req.error);              // VersionError → prompt reload
  });
}
```

## Rules
- Versions are integers; bump by 1; migrations are additive `if (oldVersion < N)` blocks.
- Schema changes only inside `onupgradeneeded`.
- Never change a store's keyPath in place (delete+recreate loses data — migrate explicitly).
