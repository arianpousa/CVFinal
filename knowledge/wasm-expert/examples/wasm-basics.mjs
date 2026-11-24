// wasm-basics.mjs: modules, instances, memory, and the application/wasm MIME rule.
// Runs in Node 18+ (same WebAssembly JS API as Chrome). `node wasm-basics.mjs`
// Sources:
//  https://developer.mozilla.org/en-US/docs/WebAssembly
//  https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/instantiateStreaming_static
//  https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory

// A complete hand-assembled Wasm binary (WAT shown below), so no toolchain is needed:
//   (module
//     (memory (export "mem") 1 4)                           ;; 1 page = 64 KiB, max 4
//     (func (export "add") (param i32 i32) (result i32)
//       local.get 0 local.get 1 i32.add)
//     (func (export "sum") (param $ptr i32) (param $n i32) (result i32)  ;; sum n bytes
//       (local $s i32)
//       (block (loop
//         (br_if 1 (i32.eqz (local.get $n)))
//         (local.set $s (i32.add (local.get $s) (i32.load8_u (local.get $ptr))))
//         (local.set $ptr (i32.add (local.get $ptr) (i32.const 1)))
//         (local.set $n (i32.sub (local.get $n) (i32.const 1)))
//         (br 0)))
//       local.get $s))
const bytes = new Uint8Array([
  0x00,0x61,0x73,0x6d, 0x01,0x00,0x00,0x00,                     // magic + version
  0x01,0x07,0x01,0x60,0x02,0x7f,0x7f,0x01,0x7f,                 // type: (i32,i32)->i32
  0x03,0x03,0x02,0x00,0x00,                                     // 2 funcs, type 0
  0x05,0x04,0x01,0x01,0x01,0x04,                                // memory min 1 max 4
  0x07,0x13,0x03, 0x03,0x6d,0x65,0x6d,0x02,0x00,                // export "mem"
        0x03,0x61,0x64,0x64,0x00,0x00,                          // export "add"
        0x03,0x73,0x75,0x6d,0x00,0x01,                          // export "sum"
  0x0a,0x35,0x02,
  0x07,0x00,0x20,0x00,0x20,0x01,0x6a,0x0b,                      // add body
  0x2b,0x01,0x01,0x7f,                                          // sum: 1 local i32
  0x02,0x40,0x03,0x40,
  0x20,0x01,0x45,0x0d,0x01,                                     // br_if 1 (n==0)
  0x20,0x02,0x20,0x00,0x2d,0x00,0x00,0x6a,0x21,0x02,            // s += load8_u(ptr)
  0x20,0x00,0x41,0x01,0x6a,0x21,0x00,                           // ptr++
  0x20,0x01,0x41,0x01,0x6b,0x21,0x01,                           // n--
  0x0c,0x00,0x0b,0x0b,                                          // br 0, end loop, end block
  0x20,0x02,0x0b,                                               // return s
]);

let fails = 0;
const check = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!ok) fails++; };

// 1) validate + compile + instantiate
check('WebAssembly.validate', WebAssembly.validate(bytes));
const { module, instance } = await WebAssembly.instantiate(bytes);
check('exported add(2,3) === 5', instance.exports.add(2, 3) === 5);
check('Module lists exports', WebAssembly.Module.exports(module).map((e) => e.name).join() === 'mem,add,sum');

// 2) linear memory: JS writes bytes, Wasm reads them (this is how cv.Mat pixel data lives)
const mem = instance.exports.mem;
check('1 page = 64 KiB', mem.buffer.byteLength === 65536);
new Uint8Array(mem.buffer).set([10, 20, 30, 40], 100);
check('Wasm sums bytes written by JS', instance.exports.sum(100, 4) === 100);

// 3) grow() detaches the old ArrayBuffer: views must be re-created
const oldView = new Uint8Array(mem.buffer);
mem.grow(1);
check('grow() detaches old buffer', oldView.byteLength === 0 && mem.buffer.byteLength === 131072);
let threw = false; try { mem.grow(10); } catch { threw = true; }
check('cannot grow past maximum (RangeError)', threw);

// 4) instantiateStreaming needs Content-Type: application/wasm
const ok = await WebAssembly.instantiateStreaming(new Response(bytes, { headers: { 'Content-Type': 'application/wasm' } }));
check('instantiateStreaming with application/wasm', ok.instance.exports.add(1, 1) === 2);
let mimeErr = null;
try { await WebAssembly.instantiateStreaming(new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } })); }
catch (e) { mimeErr = e; }
check('wrong MIME rejects with TypeError', mimeErr instanceof TypeError, `(${mimeErr?.message})`);

// 5) a compiled Module is structured-cloneable (can be posted to a worker)
const cloned = structuredClone(module);
const inst2 = await WebAssembly.instantiate(cloned);
check('Module survives structuredClone; new instance has its own memory', inst2.exports.mem !== mem && inst2.exports.add(4, 5) === 9);

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
