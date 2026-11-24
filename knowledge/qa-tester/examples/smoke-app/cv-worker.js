// cv-worker.js: classic worker: loads OpenCV.js ONCE, runs the tested pipeline off the main thread.
let ready = false;
const markReady = () => { if (!ready) { ready = true; postMessage({ type: 'ready' }); } };
self.Module = { onRuntimeInitialized: markReady };
try {
  importScripts('./vendor/opencv.js', './scanner-pipeline.js');   // pipeline = opencv-expert's tested example
} catch (e) {
  postMessage({ type: 'fatal', message: 'opencv.js failed to load: ' + e.message });
}
// Some builds expose a thenable instead of calling Module.onRuntimeInitialized.
// Use the callback form; never resolve a promise WITH the module (it hangs).
if (self.cv && typeof self.cv.then === 'function') self.cv.then(() => markReady());
if (self.cv && self.cv.Mat) markReady();

onmessage = ({ data }) => {
  const { id, type } = data;
  try {
    if (!ready) throw new Error('OpenCV not ready');
    if (type === 'detect') return postMessage({ id, type: 'detected', ...detectPage(cv, data.imageData) });
    if (type === 'process') {
      const out = processScan(cv, data.imageData, data.corners, data.mode);
      return postMessage({ id, type: 'result', imageData: out, heapBytes: cv.HEAP8.length }, [out.data.buffer]);
    }
    throw new Error('Unknown message ' + type);
  } catch (err) {
    postMessage({ id, type: 'error', message: String((err && err.message) || err) });
  }
};
