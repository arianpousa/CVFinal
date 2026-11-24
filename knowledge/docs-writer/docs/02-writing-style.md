# Writing style for README, How it works and Resources

**Sources:** Apple HIG Writing: https://developer.apple.com/design/human-interface-guidelines/writing · Apple Style Guide: https://help.apple.com/applestyleguide/#/ · assignment guide (required outputs): https://cvfinal-doc-scanner.netlify.app/guide/

## Rules we follow (from HIG Writing)
- **Be clear and brief.** Check each word and use fewer words. Put the most important information first.
- **Write for everyone.** Use plain language with no unexplained jargon. On first use, define a term in a few words ("WebAssembly, a fast binary format browsers can run").
- **Action-oriented, descriptive links.** Never "click here". Name the destination ("Using IndexedDB on MDN").
- **Consistent terms.** Scan, page, library, worker. Pick one capitalization style (sentence case) and keep it.
- Avoid "we" in UI text. In the README, "the app" or "this project" is clearer.

## What the assignment requires us to document
- README with **deploy steps**, a **"How it works"** page, a **Resources** page, the **hand-off log**, and the orchestrator's **who-did-what** summary.
- The Resources page must list every project link: official docs, the GitHub repo and the guide.

## README skeleton (fill in, don't pad)
1. One-line description + live URL + screenshot
2. Features (3–5 bullets)
3. How it works (one short paragraph per tech: OpenCV.js, WebAssembly + Worker, IndexedDB) → link to the How it works page
4. Run locally on Windows: `python -m http.server 8080`, open http://localhost:8080 in Chrome
5. Deploy to Netlify (empty build, publish `.`)
6. Troubleshooting table (Reset app data → DevTools → Clear site data)
7. Team and who did what (from `docs/handoff-log.md`)
8. Resources link

## Fact rules
Every technical claim links to its official source in `01-official-links.md`. Numbers (file sizes, timings) come only from recorded test results in `knowledge/*/examples/README.md`.
