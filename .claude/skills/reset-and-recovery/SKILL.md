---
name: reset-and-recovery
description: "The Reset app data flow and in-app recovery from stuck loading, stuck processing, blocked DB upgrades and storage errors. Use when building the Reset button, error banners, or the troubleshooting docs."
---
# Reset & recovery

## Reset app data (always visible, never gated on OpenCV being ready)
```js
async function resetAppData() {
  if (!confirm('Delete all scans and settings on this device?')) return;
  cvClient?.terminate();
  db?.close();
  await new Promise((res, rej) => {
    const r = indexedDB.deleteDatabase('docscanner');
    r.onsuccess = res; r.onerror = () => rej(r.error);
    r.onblocked = () => showBanner('Close other tabs of this app, then press Reset again.');
  });
  location.reload();
}
```

## Banners (copy reviewed by Wren)
| Event | Message | Action |
|---|---|---|
| load timeout | "OpenCV is taking too long to load." | Retry · Troubleshooting |
| job timeout | "That scan took too long. Trying again…" | auto-respawn worker |
| db-blocked | "Close other tabs of Doc Scanner to finish updating." | — |
| db-outdated | "A new version is ready." | Reload |
| QuotaExceededError | "Storage is full. Delete some scans." | Open library |

## Escalation
If the page is frozen: DevTools → Application → Storage → Clear site data (see `chrome-devtools-debugging`).
