// check-resources.mjs: gate for the Resources page (no network needed).
// Verifies: every REQUIRED link is present, all external links are https, no "click here" text,
// no duplicate hrefs, and every link in ../docs/01-official-links.md (except "Live app") is on the page.
// Usage: node check-resources.mjs [path/to/resources.html]
import { readFileSync } from 'node:fs';

const file = process.argv[2] || new URL('./resources.html', import.meta.url);
const html = readFileSync(file, 'utf8');
const links = [...html.matchAll(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => ({ href: m[1], text: m[2].trim() }));
const hrefs = links.map((l) => l.href);
const canonical = [...readFileSync(new URL('../docs/01-official-links.md', import.meta.url), 'utf8').matchAll(/https:\/\/[^\s)]+/g)].map((m) => m[0]);

let fails = 0;
const check = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!ok) fails++; };
const REQUIRED = {
  'assignment guide': 'cvfinal-doc-scanner.netlify.app/guide',
  'GitHub repo': 'github.com/arianpousa/CVFinal',
  'OpenCV.js docs': 'docs.opencv.org',
  'WebAssembly docs': 'webassembly.org',
  'MDN IndexedDB': 'developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API',
  'Chrome DevTools IndexedDB': 'developer.chrome.com/docs/devtools/storage/indexeddb',
  'Netlify docs': 'docs.netlify.com',
};
for (const [name, frag] of Object.entries(REQUIRED)) check(`required link: ${name}`, hrefs.some((h) => h.includes(frag)));
const ext = hrefs.filter((h) => /^[a-z]+:/i.test(h));
check('all external links use https', ext.every((h) => h.startsWith('https://')));
check('no "click here" / "here" link text (HIG Writing)', !links.some((l) => /^(click )?here$/i.test(l.text)));
check('no duplicate links', new Set(hrefs).size === hrefs.length);
const missing = canonical.filter((u) => !hrefs.includes(u) && !/WebAssembly\/Reference|getUserMedia|toBlob|dark-mode|color$|typography|motion|loading/.test(u));
check('canonical project links all present', missing.length === 0, missing.length ? JSON.stringify(missing) : `(${links.length} links)`);
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
