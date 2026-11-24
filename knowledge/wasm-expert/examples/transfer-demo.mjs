// transfer-demo.mjs: copying vs transferring a 12 MP RGBA frame between threads.
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
// Node's worker_threads uses the same structured-clone/transfer rules as browser workers.
// Run: node transfer-demo.mjs
import { Worker } from 'node:worker_threads';

const echo = new Worker(`
  const { parentPort } = require('node:worker_threads');
  parentPort.on('message', (m) => {
    const px = new Uint8ClampedArray(m.buffer);
    px[0] = 255 - px[0];                          // "process" one pixel
    parentPort.postMessage(m, [m.buffer]);         // transfer it back
  });`, { eval: true });

let fails = 0;
const check = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!ok) fails++; };
const roundTrip = (msg, transfer) => new Promise((res) => { echo.once('message', res); echo.postMessage(msg, transfer); });

const W = 4000, H = 3000;                            // 12 MP photo = 48 MB RGBA
const make = () => { const a = new Uint8ClampedArray(W * H * 4); a[0] = 10; return a; };

// Transfer: sender's buffer is detached (byteLength 0), no 48 MB copy.
const a = make();
let t = performance.now();
const back = await roundTrip({ buffer: a.buffer, width: W, height: H }, [a.buffer]);
const tTransfer = performance.now() - t;
check('after transfer, sender buffer is detached', a.byteLength === 0 && a.buffer.byteLength === 0);
check('worker result came back (pixel processed)', new Uint8ClampedArray(back.buffer)[0] === 245);

// Typed arrays are not transferable themselves: transfer `.buffer`.
let threw = false; try { structuredClone(make(), { transfer: [make()] }); } catch { threw = true; }
check('transferring a Uint8ClampedArray itself throws', threw);

// Copy (no transfer list): both sides keep a buffer: 2x memory, slower.
const b = make();
t = performance.now();
await roundTrip({ buffer: b.buffer, width: W, height: H }, []);
const tCopy = performance.now() - t;
check('without transfer, sender keeps its buffer (copied)', b.byteLength === W * H * 4);
console.log(`      transfer round trip ${tTransfer.toFixed(1)} ms vs copy ${tCopy.toFixed(1)} ms for 48 MB`);

await echo.terminate();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
