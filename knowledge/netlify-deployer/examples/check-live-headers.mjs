// check-live-headers.mjs: post-deploy verification of the live site's headers (Node 18+).
// Usage: node check-live-headers.mjs https://<site>.netlify.app [/vendor/opencv-4.10.0.js]
// Self-test (no network): node check-live-headers.mjs --self-test
import http from 'node:http';

export async function checkSite(base, vendorPath = '/vendor/opencv-4.10.0.js') {
  const results = [];
  const check = (n, ok, x = '') => results.push({ n, ok, x });
  const home = await fetch(base + '/');
  check('home page 200', home.status === 200, `(${home.status})`);
  check('HTML revalidates every request', /max-age=0/.test(home.headers.get('cache-control') || ''), `(${home.headers.get('cache-control')})`);
  check('nosniff set', home.headers.get('x-content-type-options') === 'nosniff');
  check('camera allowed for self', /camera=\(self\)/.test(home.headers.get('permissions-policy') || ''));
  const cv = await fetch(base + vendorPath, { headers: { 'Accept-Encoding': 'br, gzip' } });
  check('opencv.js 200', cv.status === 200, `(${cv.status})`);
  check('opencv.js served as JavaScript', /javascript/.test(cv.headers.get('content-type') || ''), `(${cv.headers.get('content-type')})`);
  check('opencv.js cached immutable', /immutable/.test(cv.headers.get('cache-control') || ''), `(${cv.headers.get('cache-control')})`);
  return results;
}

async function selfTest() {
  // Local server that mimics what Netlify serves with our netlify.toml applied.
  const srv = http.createServer((req, res) => {
    const common = { 'X-Content-Type-Options': 'nosniff', 'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()' };
    if (req.url.startsWith('/vendor/')) res.writeHead(200, { ...common, 'Content-Type': 'application/javascript', 'Cache-Control': 'public, max-age=31536000, immutable' });
    else if (req.url === '/') res.writeHead(200, { ...common, 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=0, must-revalidate' });
    else res.writeHead(404);
    res.end('ok');
  }).listen(0);
  const base = `http://localhost:${srv.address().port}`;
  const good = await checkSite(base);
  const bad = await checkSite(base, '/vendor/missing.js?force404').catch(() => []);
  srv.close();
  return { good, bad };
}

const arg = process.argv[2];
if (arg === '--self-test') {
  const { good } = await selfTest();
  good.forEach((r) => console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.n} ${r.x}`));
  const fails = good.filter((r) => !r.ok).length;
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
} else if (arg) {
  const res = await checkSite(arg.replace(/\/$/, ''), process.argv[3]);
  res.forEach((r) => console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.n} ${r.x}`));
  process.exit(res.some((r) => !r.ok) ? 1 : 0);
}
