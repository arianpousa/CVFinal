// cv-client.test.mjs: exercises CvClient against a fake worker (no browser needed).
// Run: node cv-client.test.mjs
import { createRequire } from 'node:module';
const { CvClient } = createRequire(import.meta.url)('./cv-client.js');

// Fake worker that behaves like cv-worker.js: posts 'ready', answers jobs, can be told to hang.
class FakeWorker {
  constructor({ hangOn = null, readyDelay = 5 } = {}) {
    this.terminated = false; this.hangOn = hangOn;
    setTimeout(() => this.onmessage?.({ data: { type: 'ready' } }), readyDelay);
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

// 1) happy path + status sequence
const statuses = [];
const c1 = new CvClient(() => new FakeWorker(), { onStatus: (s) => statuses.push(s) });
const r = await c1.call('detect', { imageData: {} });
check('call resolves with worker reply', r.type === 'detected' && r.corners.length === 4);
check('status: loading -> ready -> working -> ready', statuses.join('>') === 'loading>ready>working>ready', `(${statuses.join('>')})`);

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
await new Promise((res) => setTimeout(res, 80));
check('load timeout triggers respawn', c3.respawns === 1);
const r3 = await c3.call('detect');
check('works after load-timeout respawn', r3.type === 'detected');
c3.terminate();

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
