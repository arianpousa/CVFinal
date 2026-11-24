# Viewing and deleting IndexedDB data in Chrome DevTools

**Source:** Chrome DevTools "View and change IndexedDB data": https://developer.chrome.com/docs/devtools/storage/indexeddb

Open DevTools on Windows with **F12** or **Ctrl+Shift+I**, then go to the **Application** panel.

| Task | Steps |
|---|---|
| Find the DB | Expand **IndexedDB**. Each database is listed with its name and origin. Expand it to see object stores and indexes. |
| Version / origin | Click the database (`docscanner`). |
| View records | Click an object store. It shows key–value pairs and **Total entries**, plus **Key generator value** for auto-increment stores. Click a Value cell to expand it. |
| Sort by an index | Click the index under the store (e.g. `createdAt`). |
| Refresh | The view **doesn't update live**. Click **Refresh** (store) or **Refresh database**. |
| Delete one record | Select the row, then press **Delete** or click **Delete Selected**. |
| Empty a store | **Clear object store**. |
| Delete the DB | Select the database, then **Delete database**. |
| Clear all site storage | Open the **Clear storage** / **Storage** pane, keep **IndexedDB** checked, then **Clear site data**. |
| Edit values | Not possible in the panel. Use a **Snippet** (Sources → Snippets) to run JS that writes. |

Caveats from the page: databases from third-party iframes aren't shown, and the data doesn't refresh live.

## What a grader should see for our app
`docscanner` (version 1) with stores `blobs`, `history`, `scans` and `settings`. The `scans` entries show `{id, title, createdAt, mode, width, height, corners, bytes}`. The `blobs` entries show a `Blob` for `full` and for `thumb`.
