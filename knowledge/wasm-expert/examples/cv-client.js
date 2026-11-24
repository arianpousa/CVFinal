// cv-client.js: main-thread client for the OpenCV Web Worker.
// Request ids, a readiness promise, per-call timeouts, terminate + respawn on hang/crash.
// Sources: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
//          https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
//
// In the browser:  const cv = new CvClient(() => new Worker('/cv-worker.js'));
// In tests:        inject a fake worker factory (see cv-client.test.mjs).

class CvClient {
  constructor(createWorker, { loadTimeoutMs = 30000, jobTimeoutMs = 15000, onStatus = () => {} } = {}) {
    this.createWorker = createWorker;
    this.loadTimeoutMs = loadTimeoutMs;
    this.jobTimeoutMs = jobTimeoutMs;
    this.onStatus = onStatus;            // 'loading' | 'ready' | 'working' | 'error'
    this.nextId = 1;
    this.pending = new Map();            // id -> {resolve, reject, timer}
    this.respawns = 0;
    this._spawn();
  }

  _spawn() {
    this.onStatus('loading');
    const w = (this.worker = this.createWorker());
    this.ready = new Promise((resolve, reject) => {
      const t = setTimeout(() => { this._fail(new Error('OpenCV load timed out')); reject(new Error('load timeout')); }, this.loadTimeoutMs);
      this._readyResolve = () => { clearTimeout(t); resolve(); };
      this._readyReject = (e) => { clearTimeout(t); reject(e); };
    });
    this.ready.catch(() => {});          // avoid unhandled rejection noise; callers await it explicitly
    w.onmessage = (e) => this._onMessage(e.data);
    w.onerror = (e) => this._fail(new Error(`Worker error: ${e.message} (${e.filename}:${e.lineno})`));
  }

  _onMessage(msg) {
    if (msg.type === 'ready') { this._readyResolve(); this.onStatus('ready'); return; }
    if (msg.type === 'fatal') { this._readyReject(new Error(msg.message)); this.onStatus('error'); return; }
    const p = this.pending.get(msg.id);
    if (!p) return;                      // late reply from a job we already timed out
    clearTimeout(p.timer);
    this.pending.delete(msg.id);
    if (this.pending.size === 0) this.onStatus('ready');
    msg.type === 'error' ? p.reject(new Error(msg.message)) : p.resolve(msg);
  }

  /** Send a job. `transfer` lists ArrayBuffers to move zero-copy (e.g. [imageData.data.buffer]). */
  async call(type, payload = {}, transfer = []) {
    await this.ready;
    const id = this.nextId++;
    this.onStatus('working');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this._fail(new Error(`${type} timed out after ${this.jobTimeoutMs} ms`)), this.jobTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, type, ...payload }, transfer);
    });
  }

  /** Hang or crash: reject everything in flight, kill the thread, start a fresh worker. */
  _fail(err) {
    for (const { reject, timer } of this.pending.values()) { clearTimeout(timer); reject(err); }
    this.pending.clear();
    this.onStatus('error');
    this.worker.terminate();             // MDN: "The worker thread is killed immediately."
    this.respawns++;
    this._spawn();
  }

  terminate() {
    for (const { reject, timer } of this.pending.values()) { clearTimeout(timer); reject(new Error('terminated')); }
    this.pending.clear();
    this.worker.terminate();
  }
}

if (typeof module !== 'undefined') module.exports = { CvClient };
