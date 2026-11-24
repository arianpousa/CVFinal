// cv-client.js: main-thread client for the OpenCV Web Worker (wasm-expert, Theo). ES module.
// Request ids, a readiness promise, per-call timeouts, terminate + respawn on hang/crash.
// Built from the tested knowledge/wasm-expert/examples/cv-client.js (10/10), plus:
//   - maxRespawns: a missing/blocked opencv.js can't respawn forever; the client stays in 'error'
//   - restart(): what the "Try again" button calls
//   - the 'ready' message's version/loadMs are kept for the UI
// Sources: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
//          https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
//
// In the browser:  const cv = new CvClient(() => new Worker('cv-worker.js'));
// In tests:        inject a fake worker factory (see tests/unit/cv-client.test.mjs).

export class CvClient {
  constructor(createWorker, { loadTimeoutMs = 60000, jobTimeoutMs = 30000, maxRespawns = 3, onStatus = () => {} } = {}) {
    this.createWorker = createWorker;
    this.loadTimeoutMs = loadTimeoutMs;
    this.jobTimeoutMs = jobTimeoutMs;
    this.maxRespawns = maxRespawns;
    this.onStatus = onStatus;            // (state, detail): 'loading' | 'ready' {version, loadMs} | 'working' | 'error' {error, willRespawn}
    this.nextId = 1;
    this.pending = new Map();            // id -> {resolve, reject, timer}
    this.respawns = 0;
    this.spawns = 0;
    this.info = null;                    // {version, loadMs} from the worker's 'ready' message
    this.lastError = null;
    this._spawn();
  }

  _spawn() {
    this.spawns++;
    this.state = 'loading';
    this.onStatus('loading');
    const w = (this.worker = this.createWorker());
    this.ready = new Promise((resolve, reject) => {
      const t = setTimeout(() => { this._fail(new Error('The scanner took too long to load.')); }, this.loadTimeoutMs);
      this._readyResolve = (info) => { clearTimeout(t); resolve(info); };
      this._readyReject = (e) => { clearTimeout(t); reject(e); };
    });
    this.ready.catch(() => {});          // avoid unhandled rejection noise; callers await it explicitly
    w.onmessage = (e) => this._onMessage(e.data);
    w.onerror = (e) => { e?.preventDefault?.(); this._fail(new Error(`Worker error: ${e?.message} (${e?.filename}:${e?.lineno})`)); };
  }

  _onMessage(msg) {
    if (msg.type === 'ready') {
      this.info = { version: msg.version, loadMs: msg.loadMs };
      this.state = 'ready';
      this._readyResolve(this.info);
      this.onStatus('ready', this.info);
      return;
    }
    if (msg.type === 'fatal') { this._fail(new Error(msg.message), { respawn: false }); return; }
    const p = this.pending.get(msg.id);
    if (!p) return;                      // late reply from a job we already timed out
    clearTimeout(p.timer);
    this.pending.delete(msg.id);
    if (this.pending.size === 0 && this.state === 'working') { this.state = 'ready'; this.onStatus('ready', this.info); }
    msg.type === 'error' ? p.reject(new Error(msg.message)) : p.resolve(msg);
  }

  /** Send a job. `transfer` lists ArrayBuffers to move zero-copy (e.g. [imageData.data.buffer]). */
  async call(type, payload = {}, transfer = []) {
    await this.ready;
    const id = this.nextId++;
    this.state = 'working';
    this.onStatus('working');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this._fail(new Error(`${type} timed out after ${this.jobTimeoutMs} ms`)), this.jobTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, type, ...payload }, transfer);
    });
  }

  /** Hang or crash: reject everything in flight, kill the thread, start a fresh worker (up to maxRespawns). */
  _fail(err, { respawn = true } = {}) {
    this.lastError = err;
    for (const { reject, timer } of this.pending.values()) { clearTimeout(timer); reject(err); }
    this.pending.clear();
    this._readyReject?.(err);
    this.worker.terminate();             // MDN: "The worker thread is killed immediately."
    this.state = 'error';
    const willRespawn = respawn && this.respawns < this.maxRespawns;
    this.onStatus('error', { error: err, willRespawn });
    if (willRespawn) {
      this.respawns++;
      this._spawn();
    }
  }

  /** "Try again": start over with a fresh worker and a fresh respawn budget. */
  restart() {
    this.terminate();
    this.respawns = 0;
    this._spawn();
    return this.ready;
  }

  terminate() {
    for (const { reject, timer } of this.pending.values()) { clearTimeout(timer); reject(new Error('terminated')); }
    this.pending.clear();
    this._readyReject?.(new Error('terminated'));   // no-op if already settled
    this.worker.terminate();
  }
}
