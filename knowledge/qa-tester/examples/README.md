# qa-tester examples (tested in real Chrome)

| File | What good looks like |
|---|---|
| `smoke-app/` | The smallest app with the real architecture: `cv-worker.js` loads OpenCV.js once and runs opencv-expert's tested `scanner-pipeline.js`; the page saves to IndexedDB with indexeddb-expert's tested `db.js`; there's a Reset button |
| `prepare.cjs` | Copies those two tested modules into `smoke-app/` (so the test uses the team's real code) |
| `smoke-test.cjs` | Automated acceptance run with Playwright, mapped to the rubric. Works against `localhost` or the live Netlify URL |
| `bug-report-template.md` | How to file a failure back to the owning agent through the orchestrator |

## Run locally (Windows PowerShell or bash)
```bash
node prepare.cjs
mkdir smoke-app/vendor && copy <path>/opencv.js smoke-app/vendor/opencv.js   # or pass the path to the test
python -m http.server 8765 --directory smoke-app
npx playwright install chromium
node smoke-test.cjs http://localhost:8765/ <path>/opencv.js
```
Against production: `node smoke-test.cjs https://<site>.netlify.app/`

## Recorded result (2026-11-24, headless Chrome, OpenCV.js 4.10.0)
```
PASS  status reaches "Ready" (OpenCV.js loaded in the worker) (789 ms)
PASS  opencv.js requested exactly once (1)
PASS  page detected and flattened (493x393)
PASS  output is crisp black & white
PASS  main thread never froze during 21 scans (longest heartbeat gap 22 ms)
PASS  worker Wasm heap stable over 20 scans (Mats deleted) (128 MiB -> 128 MiB)
PASS  scans persist after refresh (IndexedDB) (21 -> 21)
PASS  database visible to DevTools (indexedDB.databases) (docscanner@v1)
PASS  Reset app data empties the library
PASS  no console errors
ALL PASSED
```
