// app.js: the Smart Document Scanner shell (frontend-engineer, Leo). ES module, vanilla JS, no build step.
// Wires the team's tested modules together:
//   src/cv-client.js  (wasm-expert)      worker client: ready promise, request ids, timeouts, respawn
//   cv-worker.js      (wasm-expert)      loads OpenCV.js once, runs src/scanner-pipeline.js (opencv-expert)
//   src/db.js         (indexeddb-expert) docscanner database: original + result Blobs, Reset
//   src/capture.js    (frontend-engineer) upload, camera, canvas <-> Blob helpers
// The main thread never runs OpenCV: it only decodes/scales images with canvas and draws results.
// Flow, states and copy: docs/design/flow-spec.md (Wren). Styles: styles.css (Sable).

import { CvClient } from './src/cv-client.js';
import * as DB from './src/db.js';
import { loadFromFile, loadSample, startCamera, captureFrame, detectionInput, canvasToBlob, thumbnailBlob, toCanvas, UserFacingError } from './src/capture.js';

const $ = (id) => document.getElementById(id);
const PREVIEW_SIDE = 1200;          // live preview runs on a smaller copy; Save runs on the full image
const DISPLAY_SIDE = 1600;          // the on-screen photo copy
const CORNER_NAMES = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left'];

const state = {
  db: null,
  source: null,          // full-resolution canvas (long side <= 4000 px)
  originalBlob: null,    // exactly what the user gave us (File) or a JPEG of the camera frame
  corners: null,         // in source pixels, [TL, TR, BR, BL]
  found: false,
  mode: 'bw',
  defaultName: '',
  saving: false,
  previewSeq: 0,
  urls: [],              // object URLs for library thumbnails (revoked on re-render)
  viewerUrls: [],
  viewerId: null,
  stream: null,
};

// ---------- status pill + messages + banner ----------
const STATUS = { loading: 'Loading scanner…', ready: 'Ready', working: 'Working…', error: 'Scanner error' };
const ICON = { loading: '', ready: '✓ ', working: '', error: '⚠ ' };
function setStatus(s) {
  $('status').dataset.state = s;
  $('status-text').textContent = ICON[s] + STATUS[s];
}
function say(el, text, tone = '') { el.textContent = text; el.dataset.tone = tone; }
function banner(text, tone = 'warn', actions = []) {
  const b = $('banner');
  if (!text) { b.hidden = true; return; }
  $('banner-text').textContent = text;
  b.dataset.tone = tone;
  const box = $('banner-actions'); box.replaceChildren();
  for (const a of actions) {
    const el = a.href ? Object.assign(document.createElement('a'), { href: a.href }) : document.createElement('button');
    el.className = 'btn btn-sm'; el.textContent = a.label;
    if (!a.href) { el.type = 'button'; el.addEventListener('click', a.onClick); }
    box.append(el);
  }
  b.hidden = false;
}

// ---------- the OpenCV worker ----------
const cv = new CvClient(() => new Worker('cv-worker.js'), {
  onStatus: (s, detail) => {
    if (s === 'working' || (s === 'ready' && state.saving)) return setStatus('working');
    setStatus(s);
    if (s === 'ready') {
      if ($('banner').dataset.kind === 'scanner') { banner(''); delete $('banner').dataset.kind; }
      if (detail?.version) $('engine').firstChild.textContent = `OpenCV.js ${detail.version} runs in a Web Worker (loaded in ${(detail.loadMs / 1000).toFixed(1)} s). `;
    }
    if (s === 'error' && !detail?.willRespawn) scannerFailed();
  },
});
function scannerFailed() {
  banner("The scanner didn't load. Check your connection, then try again.", 'error', [
    { label: 'Try again', onClick: () => { banner(''); cv.restart().catch(() => {}); } },
    { label: 'Troubleshooting', href: 'how-it-works.html#troubleshooting' },
  ]);
  $('banner').dataset.kind = 'scanner';
}
cv.ready.catch(() => {});

// ---------- database ----------
async function openDatabase() {
  try {
    state.db = await DB.openDB({
      onBlocked: () => banner('Close other tabs of this app to finish updating.', 'warn'),
      onUnblocked: () => banner(''),
      onOutdated: () => { state.db = null; banner('This app was updated in another tab. Reload to keep going.', 'warn', [{ label: 'Reload', onClick: () => location.reload() }]); },
      onClosed: () => { state.db = null; banner('Saved scans are unavailable. Reload the page.', 'error', [{ label: 'Reload', onClick: () => location.reload() }]); },
    });
    state.mode = await DB.getSetting(state.db, 'mode', 'bw');
    document.querySelector(`input[name="mode"][value="${state.mode}"]`).checked = true;
    await renderLibrary();
  } catch (err) {
    console.warn('IndexedDB open failed', err);
    const msg = err?.name === 'VersionError'
      ? 'This page is out of date. Reload to use the latest version.'
      : 'Saved scans are unavailable in this browser window. Scanning still works. If this keeps happening, use Reset app data.';
    banner(msg, 'error', [{ label: 'Reload', onClick: () => location.reload() }]);
    $('count').textContent = 'Library unavailable';   // never claim "No scans yet" when the DB just isn't open
  }
  showStorage();
}

async function showStorage() {
  const info = await DB.storageInfo().catch(() => null);
  if (!info) return;
  const mb = (b) => (b / 1e6 < 1000 ? `${(b / 1e6).toFixed(1)} MB` : `${(b / 1e9).toFixed(1)} GB`);
  $('storage').textContent = `Using ${mb(info.usage)} of ${mb(info.quota)} on this device.`;
}

// ---------- library ----------
const fmtDate = (t) => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
// Cards: short date (Sable review: the full date wrapped to two lines); the viewer shows the full date.
const fmtShort = (t) => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const MODE_LABEL = { color: 'Color', gray: 'Gray', bw: 'B&W' };

async function renderLibrary(focusId) {
  state.urls.forEach((u) => URL.revokeObjectURL(u));
  state.urls = [];
  if (!state.db) return;                              // keep "Opening library…" / "Library unavailable"
  const scans = await DB.listScans(state.db);
  const grid = $('grid');
  grid.replaceChildren(...scans.map((s) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'scan-card'; btn.dataset.id = s.id;
    btn.setAttribute('aria-label', `${s.name}, ${fmtDate(s.createdAt)}, ${MODE_LABEL[s.mode]}. Open`);
    const thumb = document.createElement('div'); thumb.className = 'thumb';
    if (s.thumb) {
      const url = URL.createObjectURL(s.thumb); state.urls.push(url);
      const img = new Image(); img.src = url; img.alt = ''; thumb.append(img);
    }
    const meta = document.createElement('div'); meta.className = 'meta';
    const t = document.createElement('span'); t.className = 'title'; t.textContent = s.name;
    const sub = document.createElement('span'); sub.className = 'sub'; sub.textContent = `${fmtShort(s.createdAt)} · ${MODE_LABEL[s.mode]}`;
    meta.append(t, sub);
    btn.append(thumb, meta);
    btn.addEventListener('click', () => openViewer(s.id));
    li.append(btn);
    return li;
  }));
  $('count').textContent = `${scans.length} ${scans.length === 1 ? 'scan' : 'scans'}`;
  $('empty').hidden = scans.length > 0;
  if (focusId != null) grid.querySelector(`[data-id="${focusId}"]`)?.focus();
}

// ---------- step 1: getting an image ----------
async function useImage(file, name) {
  say($('capture-msg'), '');
  stopCamera();
  try {
    const canvas = await loadFromFile(file);
    state.source = canvas;
    state.originalBlob = file;
    state.defaultName = name || defaultName();
    $('name').value = state.defaultName;
    drawPhoto();
    showAdjust();
    await detect();
  } catch (err) {
    say($('capture-msg'), err instanceof UserFacingError ? err.message : 'That photo could not be opened. Try a JPG or PNG.', 'error');
    console.warn(err);
  }
}
function defaultName() { return 'Scan ' + new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }

$('upload').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', () => { const f = $('file').files[0]; $('file').value = ''; if (f) useImage(f); });
document.querySelectorAll('[data-sample]').forEach((b) => b.addEventListener('click', () => pickSample(b.dataset.sample, b.dataset.name)));
$('empty-sample').addEventListener('click', () => pickSample('samples/receipt.jpg', 'Receipt sample'));
async function pickSample(url, name) {
  try { await useImage(await loadSample(url), name); }
  catch (err) { say($('capture-msg'), err.message, 'error'); }
}

// Drag and drop onto the capture card
$('capture').addEventListener('dragover', (e) => { e.preventDefault(); });
$('capture').addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) useImage(f); });

// Camera: ask only after the user taps "Use camera"; always release it.
$('camera').addEventListener('click', async () => {
  say($('capture-msg'), '');
  try {
    $('camera-panel').hidden = false;
    state.stream = await startCamera($('video'));
    $('shoot').focus();
  } catch (err) {
    $('camera-panel').hidden = true;
    say($('capture-msg'), err.message, 'error');
    $('upload').focus();
  }
});
$('shoot').addEventListener('click', async () => {
  if (!state.stream) return;
  const canvas = captureFrame($('video'), state.stream);
  state.stream = null;
  $('camera-panel').hidden = true;
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
  await useImage(new File([blob], 'camera.jpg', { type: 'image/jpeg' }), defaultName());
});
$('camera-cancel').addEventListener('click', () => { stopCamera(); $('camera').focus(); });
function stopCamera() {
  if (state.stream) { state.stream.getTracks().forEach((t) => t.stop()); state.stream = null; }
  $('video').srcObject = null;
  $('camera-panel').hidden = true;
}

// ---------- step 2: detect, adjust, preview ----------
function drawPhoto() {
  const c = $('photo');
  const small = toCanvas(state.source, state.source.width, state.source.height, DISPLAY_SIDE);
  c.width = small.width; c.height = small.height;
  c.getContext('2d').drawImage(small, 0, 0);
  $('overlay').setAttribute('viewBox', `0 0 ${state.source.width} ${state.source.height}`);
}
function showAdjust() {
  $('adjust-card').hidden = false;
  $('capture').hidden = true;
  $('adjust-card').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
function hideAdjust() {
  $('adjust-card').hidden = true;
  $('capture').hidden = false;
  state.source = null; state.originalBlob = null; state.corners = null;
}

async function detect() {
  const msg = $('adjust-msg');
  if (cv.state === 'loading') say(msg, 'The scanner is still loading. Your photo will be scanned in a moment.');
  const { imageData, scale } = detectionInput(state.source);      // 1000 px copy, built with canvas
  const sourceAtStart = state.source;
  try {
    await cv.ready.catch(async () => { await cv.ready; });         // a respawn replaces the promise
    const det = await cv.call('detect', { imageData }, [imageData.data.buffer]);
    if (state.source !== sourceAtStart) return;                    // user retook meanwhile
    state.found = det.found;
    // Found: scale the 1000 px corners up. Not found: the exact full frame of the source (QA bug: 999*1.2 != 1199).
    setCorners(det.found ? det.corners.map((p) => ({ x: p.x * scale, y: p.y * scale })) : fullFrame());
    say(msg, det.found ? 'Page found. Adjust the corners if needed.' : "Couldn't find the page edges. Drag the corners to fit the page.", det.found ? '' : 'error');
    if (det.found) handles[0].focus({ preventScroll: true });
  } catch (err) {
    console.warn(err);
    state.found = false;
    setCorners(fullFrame());
    say(msg, "The scanner isn't available right now. You can still adjust the corners, then try again.", 'error');
  }
}
const fullFrame = () => { const w = state.source.width - 1, h = state.source.height - 1; return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }]; };

// Corner handles: pointer drag AND keyboard (Wren's accessible-corner-editor pattern).
const handles = CORNER_NAMES.map((n, i) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'handle'; b.dataset.i = i;
  b.setAttribute('aria-describedby', 'adjust-help');
  $('stage').append(b);
  b.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d || !state.corners) return;
    e.preventDefault();
    const step = (e.shiftKey ? 10 : 1) * pxPerScreenPx();
    moveCorner(i, state.corners[i].x + d[0] * step, state.corners[i].y + d[1] * step);
  });
  b.addEventListener('pointerdown', (e) => {
    if (!state.corners) return;
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    b.focus({ preventScroll: true });
    const move = (ev) => {
      const r = $('photo').getBoundingClientRect();
      moveCorner(i, (ev.clientX - r.left) / r.width * state.source.width, (ev.clientY - r.top) / r.height * state.source.height);
    };
    b.addEventListener('pointermove', move);
    b.addEventListener('pointerup', () => b.removeEventListener('pointermove', move), { once: true });
  });
  return b;
});
const pxPerScreenPx = () => state.source.width / $('photo').getBoundingClientRect().width;
function moveCorner(i, x, y) {
  const c = state.corners.slice();
  c[i] = { x: Math.max(0, Math.min(state.source.width - 1, x)), y: Math.max(0, Math.min(state.source.height - 1, y)) };
  setCorners(c);
}
function setCorners(c) {
  state.corners = c;
  const W = state.source.width, H = state.source.height;
  c.forEach((p, i) => {
    handles[i].style.left = `${(p.x / W) * 100}%`;
    handles[i].style.top = `${(p.y / H) * 100}%`;
    handles[i].setAttribute('aria-label', `${CORNER_NAMES[i]} corner, x ${Math.round(p.x)}, y ${Math.round(p.y)}`);
  });
  $('poly').setAttribute('points', c.map((p) => `${p.x},${p.y}`).join(' '));
  schedulePreview();
}

// Live preview on a smaller copy, debounced; stale results are dropped.
let previewTimer = 0;
function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(runPreview, 120); }
async function runPreview() {
  if (!state.source || !state.corners || cv.state === 'loading' || cv.state === 'error') return;
  const seq = ++state.previewSeq;
  const small = toCanvas(state.source, state.source.width, state.source.height, PREVIEW_SIDE);
  const k = small.width / state.source.width;
  const imageData = small.getContext('2d').getImageData(0, 0, small.width, small.height);
  $('preview-box').setAttribute('aria-busy', 'true');
  try {
    const res = await cv.call('process', { imageData, corners: state.corners.map((p) => ({ x: p.x * k, y: p.y * k })), mode: state.mode }, [imageData.data.buffer]);
    if (seq !== state.previewSeq) return;
    paint($('preview'), res.imageData);
  } catch (err) { console.warn('preview failed', err); }
  finally { if (seq === state.previewSeq) $('preview-box').removeAttribute('aria-busy'); }
}
function paint(canvas, img) {
  canvas.width = img.width; canvas.height = img.height;
  canvas.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
}

document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener('change', () => {
  state.mode = r.value;
  if (state.db) DB.setSetting(state.db, 'mode', state.mode).catch(() => {});
  schedulePreview();
}));
$('retake').addEventListener('click', () => { hideAdjust(); say($('adjust-msg'), ''); $('upload').focus(); });

// ---------- save: full-resolution scan, then ONE IndexedDB transaction ----------
$('save').addEventListener('click', save);
async function save() {
  if (!state.source || !state.corners || state.saving) return;
  state.saving = true;
  setBusy(true);
  const msg = $('adjust-msg');
  say(msg, 'Working…');
  try {
    const src = state.source;
    const imageData = src.getContext('2d').getImageData(0, 0, src.width, src.height);
    const res = await cv.call('process', { imageData, corners: state.corners, mode: state.mode }, [imageData.data.buffer]);
    const out = document.createElement('canvas');
    paint(out, res.imageData);
    // Create every Blob BEFORE the transaction opens (an awaited toBlob inside it would end the transaction).
    const result = await canvasToBlob(out, 'image/png');
    const thumb = await thumbnailBlob(out, 360);
    const original = state.originalBlob instanceof Blob && state.originalBlob.size ? state.originalBlob : await canvasToBlob(src, 'image/jpeg', 0.92);
    if (!state.db) throw Object.assign(new Error('no db'), { name: 'NoDatabase' });
    const r = await DB.trySave(state.db, {
      name: ($('name').value || '').trim() || state.defaultName,
      mode: state.mode, width: out.width, height: out.height, origWidth: src.width, origHeight: src.height,
      corners: state.corners, found: state.found, original, result, thumb,
    });
    if (!r.ok) {
      banner('Storage is full. Delete some scans to save new ones.', 'error', [{ label: 'Open Library', onClick: () => $('library').scrollIntoView() }]);
      say(msg, 'Not saved: storage is full.', 'error');
      return;
    }
    DB.requestPersist();
    hideAdjust();
    say($('capture-msg'), 'Saved to Library.', 'ok');
    await renderLibrary(r.id);
    showStorage();
  } catch (err) {
    console.warn('save failed', err);
    say(msg, err?.name === 'NoDatabase'
      ? 'Saved scans are unavailable right now. Reload the page, or use Reset app data.'
      : 'The scan could not be saved. Try again.', 'error');
  } finally {
    state.saving = false;
    setBusy(false);
    if (cv.state === 'ready') setStatus('ready');
  }
}
function setBusy(on) {
  $('save').disabled = on;                                         // only Save and the mode toggle are disabled
  document.querySelectorAll('input[name="mode"]').forEach((r) => { r.disabled = on; });
  $('adjust-card').setAttribute('aria-busy', on ? 'true' : 'false');
  if (on) setStatus('working');
}

// ---------- viewer: original + result ----------
async function openViewer(id) {
  if (!state.db) return;
  const [meta, imgs] = await Promise.all([DB.getScan(state.db, id), DB.getImages(state.db, id)]);
  if (!meta || !imgs) return renderLibrary();
  closeViewerUrls();
  const o = URL.createObjectURL(imgs.original), r = URL.createObjectURL(imgs.result);
  state.viewerUrls = [o, r];
  state.viewerId = id;
  $('viewer-original').src = o; $('viewer-result').src = r;
  $('viewer-name').value = meta.name;
  $('viewer-title').textContent = meta.name;
  $('viewer-meta').textContent = `${fmtDate(meta.createdAt)} · ${MODE_LABEL[meta.mode]} · scan ${meta.width}×${meta.height} · original ${meta.origWidth}×${meta.origHeight}`;
  const safe = meta.name.replace(/[^\w\- ]+/g, '').trim() || 'scan';
  Object.assign($('dl-result'), { href: r, download: `${safe}.png` });
  const ext = (imgs.original.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  Object.assign($('dl-original'), { href: o, download: `${safe}-original.${ext}` });
  $('viewer').showModal();
}
function closeViewerUrls() { state.viewerUrls.forEach((u) => URL.revokeObjectURL(u)); state.viewerUrls = []; }
$('viewer').addEventListener('close', () => {
  closeViewerUrls();
  const id = state.viewerId; state.viewerId = null;
  if (id != null) $('grid').querySelector(`[data-id="${id}"]`)?.focus();
});
$('viewer-close').addEventListener('click', () => $('viewer').close());
$('rename-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('viewer-name').value.trim();
  if (!name || state.viewerId == null) return;
  await DB.renameScan(state.db, state.viewerId, name);
  $('viewer-title').textContent = name;
  await renderLibrary();
  say($('capture-msg'), 'Renamed.', 'ok');
});
$('delete').addEventListener('click', async () => {
  const id = state.viewerId;
  if (!(await confirmDialog('Delete this scan?', "The original photo and the scan are removed from this browser. You can't undo this.", 'Delete'))) return;
  state.viewerId = null;
  $('viewer').close();
  await DB.deleteScan(state.db, id);
  await renderLibrary();
  say($('capture-msg'), 'Scan deleted.');
  showStorage();
});

function confirmDialog(title, body, ok) {
  const d = $('confirm');
  $('confirm-title').textContent = title; $('confirm-body').textContent = body; $('confirm-ok').textContent = ok;
  d.returnValue = '';
  d.showModal();
  return new Promise((resolve) => d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true }));
}

// ---------- Reset app data: always available, even if the scanner or the database is stuck ----------
$('reset').addEventListener('click', async () => {
  if (!(await confirmDialog('Delete all scans?', "This removes every scan and setting stored in this browser. You can't undo this.", 'Delete all'))) return;
  cv.terminate();                                     // stop any stuck job
  stopCamera();
  banner('Resetting…', 'warn');
  try {
    await DB.resetAppData(state.db, { onBlocked: () => banner('Close other tabs of this app to finish resetting.', 'warn') });
  } catch (err) { console.warn('reset failed', err); }
  location.reload();
});

// ---------- diagnostics for automated tests and DevTools (read-only) ----------
window.__docscanner = {
  get state() { return { cv: cv.state, respawns: cv.respawns, spawns: cv.spawns, info: cv.info, corners: state.corners, found: state.found, mode: state.mode }; },
  heap: async () => (await cv.call('stats')).heapBytes,
};

setStatus('loading');
openDatabase();
