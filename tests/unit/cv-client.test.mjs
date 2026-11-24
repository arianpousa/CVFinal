// cv-client.test.mjs: exercises src/cv-client.js against a fake worker (no browser needed).
// The first 10 checks are the recorded knowledge/wasm-expert/examples/cv-client.test.mjs checks;
// the rest cover what the app adds: fatal load errors, the respawn cap and restart().
// Run (from tests/): node unit/cv-client.test.mjs
import { CvClient } from '../../src/cv-client.js';

// Fake worker that behaves like cv-worker.js: posts 'ready', answers jobs, can be told to hang or fail.
class FakeWorker {
  constructor({ hangOn = null, readyDelay = 5, fatal = false } = {}) {
    this.terminated = false; this.hangOn = hangOn;
    setTimeout(() => !this.terminated && this.onmessage?.({ data: fatal ? { type: 'fatal', message: 'opencv.js 404' } : { type: 'ready', version: '4.10.0', loadMs: 5 } }), readyDelay);
  }
  postMessage(msg, transfer) {
    if (this.terminated) return;
    this.lastTransfer = transfer;
    if (msg.type === this.hangOn) return;                       // simulate a stuck job
    if (msg.type === 'boom') return setTimeout(() => this.onmessage({ data: { id: msg.id, type: 'error', message: 'bad input' } }), 1);
    setTimeout(() => this.onmessage({ data: { id: msg.id, type: 'detected', corners: [1, 2, 3, 4] } }), 1);
  }
  terminate() { this.terminated = true; }
}

let fails = 0;
const check = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1) happy path + status sequence
const statuses = [];
const c1 = new CvClient(() => new FakeWorker(), { onStatus: (s) => statuses.push(s) });
const r = await c1.call('detect', { imageData: {} });
check('call resolves with worker reply', r.type === 'detected' && r.corners.length === 4);
check('status: loading -> ready -> working -> ready', statuses.join('>') === 'loading>ready>working>ready', `(${statuses.join('>')})`);
check('ready info (version) kept for the UI', c1.info?.version === '4.10.0');

// 2) worker-reported error rejects only that call
let err = null; try { await c1.call('boom'); } catch (e) { err = e; }
check('worker error rejects the promise', err?.message === 'bad input');

// 3) transfer list is passed through
const buf = new ArrayBuffer(16);
await c1.call('detect', {}, [buf]);
check('transfer list forwarded to postMessage', c1.worker.lastTransfer[0] === buf);
c1.terminate();

// 4) hung job -> timeout -> terminate -> respawn -> next call works
let made = 0; const workers = [];
const c2 = new CvClient(() => { const w = new FakeWorker({ hangOn: made++ === 0 ? 'process' : null }); workers.push(w); return w; }, { jobTimeoutMs: 50 });
let timeoutErr = null; try { await c2.call('process'); } catch (e) { timeoutErr = e; }
check('stuck job times out', /timed out/.test(timeoutErr?.message));
check('stuck worker was terminated', workers[0].terminated === true);
check('client respawned a fresh worker', c2.respawns === 1 && workers.length === 2);
const again = await c2.call('process');
check('next call succeeds on the new worker', again.type === 'detected');
c2.terminate();

// 5) worker never becomes ready -> load timeout -> respawn
let n3 = 0;
const c3 = new CvClient(() => new FakeWorker({ readyDelay: n3++ === 0 ? 10_000 : 5 }), { loadTimeoutMs: 40 });
await sleep(80);
check('load timeout triggers respawn', c3.respawns === 1);
const r3 = await c3.call('detect');
check('works after load-timeout respawn', r3.type === 'detected');
c3.terminate();

// 6) fatal (opencv.js could not load) -> error state, no respawn loop, call rejects
const st4 = [];
const det4 = [];
const c4 = new CvClient(() => new FakeWorker({ fatal: true }), { onStatus: (s, d) => { st4.push(s); det4.push(d); } });
let fatalErr = null; try { await c4.call('detect'); } catch (e) { fatalErr = e; }
check('fatal load error rejects calls with a readable message', /opencv\.js 404/.test(fatalErr?.message));
check('fatal load error does not respawn (willRespawn:false for the UI)', c4.respawns === 0 && c4.state === 'error' && st4.at(-1) === 'error' && det4.at(-1).willRespawn === false);

// 7) respawn cap: a worker that never loads stops after maxRespawns
let n5 = 0;
const c5 = new CvClient(() => { n5++; return new FakeWorker({ readyDelay: 10_000 }); }, { loadTimeoutMs: 15, maxRespawns: 2 });
await sleep(120);
check('respawns stop at maxRespawns', c5.respawns === 2 && n5 === 3 && c5.state === 'error', `(${n5} workers)`);

// 8) restart() ("Try again") recovers with a fresh budget
let healthy = false;
c5.createWorker = () => (healthy = true, new FakeWorker());
await c5.restart();
const r5 = await c5.call('detect');
check('restart() spawns a fresh worker that works', healthy && r5.type === 'detected' && c5.respawns === 0);
c5.terminate();

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
