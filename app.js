// ══════════════════════════════════════════
// STATE
// ══════════════════════════════════════════
const probes = [
  {label:'0°',  angle:  0, desc:'Compression · straight beam', color:'#4aaeff', ac:'a0',  depth:'12.4', amp:'68%', tof:'3.2'},
  {label:'37°', angle: 37, desc:'Shear · half-skip',            color:'#4fd98e', ac:'a37', depth:'9.1',  amp:'54%', tof:'2.4'},
  {label:'70°', angle: 70, desc:'Shear · near-surface',         color:'#ff8c42', ac:'a70', depth:'4.7',  amp:'81%', tof:'1.3'},
];
let S = {
  page: 'session',
  session: {partId:'WLD-7741-B', op:'J. Miller', loc:'Bay 3, Joint A', mat:'Steel 316L'},
  pi: 0, frozen: false,
  records: [], photos: [], seq: 0, photoSeq: 0,
  camAnim: null, camPhase: 0,
  shakeBuf: [], shakeTimer: null, lastShake: 0,
};

// ══════════════════════════════════════════
// SIGNAL → CANVAS
// Wire Signal.onFrame to the live canvas renderer
// ══════════════════════════════════════════
if (typeof Signal === 'undefined') {
  console.error('signal.js failed to load — check the file is in your GitHub repo');
  // Stub so app.js doesn't crash
  window.Signal = { start(){}, stop(){}, capture(){ return new Array(300).fill(0); }, onFrame: null };
}
Signal.onFrame = function(pts) {
  const cv = document.getElementById('cv-live');
  if (cv) drawWave(cv, pts, S.pi, false);
};

// ══════════════════════════════════════════
// PAGE NAVIGATION
// ══════════════════════════════════════════
function show(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('show'));
  document.getElementById('pg-' + id).classList.add('show');
  S.page = id;
  if (id === 'scan' && !S.frozen) { Signal.start(S.pi, probes[S.pi].angle); } else { Signal.stop(); }
  if (id === 'camera') { startCam(); }                   else { stopCam(); }
  if (id === 'records') { renderRecords(); }
}

// ══════════════════════════════════════════
// WAVEFORM RENDERER
// Draws a waveform onto any canvas — used for
// live view, saved record thumbnails, and detail view
// ══════════════════════════════════════════
function ha(hex, a) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function drawWave(cv, pts, pi, mini) {
  const dpr = window.devicePixelRatio || 1;
  const W = cv.offsetWidth, H = cv.offsetHeight;
  if (!W || !H) return;
  if (cv.width !== Math.round(W*dpr) || cv.height !== Math.round(H*dpr)) {
    cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
  }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const col = probes[pi].color;
  ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, W, H);
  if (!mini) {
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5;
    for (let i=1; i<8; i++) { ctx.beginPath(); ctx.moveTo(W/8*i,0); ctx.lineTo(W/8*i,H); ctx.stroke(); }
    for (let i=1; i<4; i++) { ctx.beginPath(); ctx.moveTo(0,H/4*i); ctx.lineTo(W,H/4*i); ctx.stroke(); }
  }
  const mid = H/2, amp = mid - (mini ? 3 : 8);
  ctx.fillStyle = ha(col, 0.10); ctx.beginPath(); ctx.moveTo(0, mid);
  for (let x=0; x<Math.min(pts.length,W); x++) ctx.lineTo(x*W/pts.length, mid - pts[x]*amp);
  ctx.lineTo(W, mid); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = mini ? 1 : 1.5; ctx.beginPath();
  for (let x=0; x<Math.min(pts.length,W); x++) {
    const y = mid - pts[x]*amp;
    x === 0 ? ctx.moveTo(x*W/pts.length, y) : ctx.lineTo(x*W/pts.length, y);
  }
  ctx.stroke();
  if (!mini) {
    ctx.strokeStyle='rgba(255,209,102,0.6)'; ctx.lineWidth=0.8; ctx.setLineDash([3,3]);
    ctx.strokeRect(W*0.27, H*0.15, W*0.19, H*0.7); ctx.setLineDash([]);
    ctx.strokeStyle='rgba(74,174,255,0.5)'; ctx.lineWidth=0.8; ctx.setLineDash([3,3]);
    ctx.strokeRect(W*0.60, H*0.15, W*0.19, H*0.7); ctx.setLineDash([]);
  }
}

// ══════════════════════════════════════════
// CANVAS SIZING
// ══════════════════════════════════════════
function sizeCanvas() {
  const cv = document.getElementById('cv-live');
  const body = document.querySelector('.scan-body');
  if (!cv || !body) return;
  cv.style.height = Math.max(80, body.offsetHeight - 100) + 'px';
}

// ══════════════════════════════════════════
// PROBE SWITCHING
// ══════════════════════════════════════════
function switchProbe(i) {
  if (S.frozen) return;
  S.pi = i;
  const p = probes[i];
  document.getElementById('scan-title').textContent = 'A-scan · ' + p.label;
  document.getElementById('m-d').textContent = p.depth; document.getElementById('m-d').style.color = p.color;
  document.getElementById('m-a').textContent = p.amp;   document.getElementById('m-a').style.color = p.color;
  document.getElementById('m-t').textContent = p.tof + 'µs'; document.getElementById('m-t').style.color = p.color;
  ['pb0','pb37','pb70'].forEach((id, j) => {
    const b = document.getElementById(id); b.className = 'pbtn'; if (j === i) b.classList.add(p.ac);
  });
  document.getElementById('cam-probe-lbl').textContent = 'Probe: ' + p.label;
  document.getElementById('cam-probe-lbl').style.color = p.color;
  document.getElementById('cam-probe-tag').textContent = p.label;
  document.getElementById('cam-probe-tag').style.color = p.color;
  if (!S.frozen) Signal.start(i, probes[i].angle);
}

// ══════════════════════════════════════════
// FREEZE / SAVE
// ══════════════════════════════════════════
function toggleFreeze() {
  S.frozen = !S.frozen;
  const pill = document.getElementById('frozen-pill');
  const mode = document.getElementById('scan-mode');
  const btn  = document.getElementById('btn-freeze');
  pill.classList.toggle('on', S.frozen);
  mode.textContent = S.frozen ? 'TIME-DOMAIN · FROZEN' : 'TIME-DOMAIN · LIVE';
  btn.textContent  = S.frozen ? 'Unfreeze' : 'Freeze';
  btn.className    = S.frozen ? 'abtn yel' : 'abtn';
  if (!S.frozen) Signal.start(S.pi, probes[S.pi].angle);
  else           Signal.stop();
}

function doSave() {
  if (!S.frozen) toggleFreeze();
  const p = probes[S.pi]; S.seq++;
  const now = new Date();
  const ts = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0') + ':' + String(now.getSeconds()).padStart(2,'0');
  S.records.unshift({
    id: S.seq, pi: S.pi, probe: p.label, desc: p.desc, color: p.color, ac: p.ac,
    depth: p.depth, amp: p.amp, tof: p.tof,
    pts: Signal.capture(S.pi),   // snapshot from signal source
    ts, partId: S.session.partId, op: S.session.op, mat: S.session.mat,
  });
  document.getElementById('rec-count').textContent = S.records.length + ' scan' + (S.records.length !== 1 ? 's' : '');
  const btn = document.getElementById('btn-save');
  btn.textContent = '✓ Saved'; btn.className = 'abtn grn';
  setTimeout(() => { btn.textContent = 'Save scan'; btn.className = 'abtn blue'; }, 1400);
  toast('Saved · ' + p.label + ' · #' + S.seq);
}

// ══════════════════════════════════════════
// RECORDS
// ══════════════════════════════════════════
function renderRecords() {
  const list = document.getElementById('rec-list');
  const empty = document.getElementById('rec-empty');
  list.querySelectorAll('.rec-card').forEach(e => e.remove());
  empty.style.display = S.records.length ? 'none' : 'block';
  S.records.forEach(rec => {
    const d = document.createElement('div'); d.className = 'rec-card';
    d.innerHTML = `
      <div class="rec-top">
        <span class="rec-probe" style="color:${rec.color}">${rec.probe}</span>
        <span class="rec-time">${rec.ts}</span>
      </div>
      <div class="rec-desc">${rec.desc}</div>
      <div class="rec-mets">
        <span class="rec-met">${rec.depth}mm</span>
        <span class="rec-met">${rec.amp}</span>
        <span class="rec-met">${rec.tof}µs</span>
      </div>`;
    d.addEventListener('click', () => openDetail(rec));
    list.appendChild(d);
  });
}

function openDetail(rec) {
  const badge = document.getElementById('d-badge');
  badge.textContent = rec.probe;
  badge.style.background = ha(rec.color, 0.15);
  badge.style.border = '1px solid ' + rec.color;
  badge.style.color = rec.color;
  document.getElementById('d-desc').textContent = rec.desc;
  document.getElementById('d-dep').textContent = rec.depth; document.getElementById('d-dep').style.color = rec.color;
  document.getElementById('d-amp').textContent = rec.amp;   document.getElementById('d-amp').style.color = rec.color;
  document.getElementById('d-tof').textContent = rec.tof;   document.getElementById('d-tof').style.color = rec.color;
  document.getElementById('d-part').textContent = rec.partId;
  document.getElementById('d-op').textContent = rec.op;
  document.getElementById('d-mat').textContent = rec.mat;
  show('detail');
  setTimeout(() => {
    const cv = document.getElementById('cv-detail');
    drawWave(cv, rec.pts, rec.pi, false);
  }, 30);
}

// ══════════════════════════════════════════
// CAMERA
// ══════════════════════════════════════════
function camLoop() {
  const cv = document.getElementById('cv-cam'); if (!cv) return;
  const dpr = window.devicePixelRatio||1, W = cv.offsetWidth, H = cv.offsetHeight;
  if (!W || !H) { S.camAnim = requestAnimationFrame(camLoop); return; }
  if (cv.width !== Math.round(W*dpr)) { cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr); }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#080e08'; ctx.fillRect(0, 0, W, H);
  const t = S.camPhase, p = probes[S.pi];
  ctx.strokeStyle = 'rgba(100,180,100,0.1)'; ctx.lineWidth = 0.5;
  for (let i=1; i<5; i++) { ctx.beginPath(); ctx.moveTo(0,H/5*i); ctx.lineTo(W,H/5*i); ctx.stroke(); }
  for (let i=1; i<5; i++) { ctx.beginPath(); ctx.moveTo(W/5*i,0); ctx.lineTo(W/5*i,H); ctx.stroke(); }
  ctx.fillStyle = ha(p.color, 0.08);
  for (let i=0; i<5; i++) {
    ctx.beginPath();
    ctx.arc(Math.sin(t*0.5+i*1.3)*W*0.3+W/2, Math.cos(t*0.4+i*1.1)*H*0.3+H/2, 4+i*2, 0, Math.PI*2);
    ctx.fill();
  }
  S.camPhase += 0.03; ctx.setTransform(1, 0, 0, 1, 0, 0);
  S.camAnim = requestAnimationFrame(camLoop);
}
function startCam() { cancelAnimationFrame(S.camAnim); camLoop(); }
function stopCam()  { cancelAnimationFrame(S.camAnim); }

function drawThumb(cv, seed, pi) {
  const dpr = window.devicePixelRatio||1, W = cv.offsetWidth||80, H = cv.offsetHeight||60;
  cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#080e08'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(100,180,100,0.15)'; ctx.lineWidth = 0.5;
  for (let i=1; i<4; i++) { ctx.beginPath(); ctx.moveTo(0,H/4*i); ctx.lineTo(W,H/4*i); ctx.stroke(); }
  ctx.fillStyle = ha(probes[pi].color, 0.2);
  ctx.beginPath();
  ctx.arc(W/2 + Math.sin(seed)*W*0.2, H/2 + Math.cos(seed)*H*0.2, 12, 0, Math.PI*2);
  ctx.fill();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function capturePhoto() {
  const fl = document.getElementById('flash');
  fl.style.opacity = '1'; setTimeout(() => fl.style.opacity = '0', 110);
  S.photoSeq++;
  const seed = Math.random() * 10, p = probes[S.pi];
  S.photos.unshift({pi: S.pi, probe: p.label, color: p.color, seed});
  renderPhotos();
  toast('Photo saved · ' + p.label);
}

function renderPhotos() {
  const strip = document.getElementById('photo-strip'); strip.innerHTML = '';
  S.photos.slice(0, 8).forEach(ph => {
    const wrap = document.createElement('div'); wrap.className = 'pt';
    const cv   = document.createElement('canvas');
    const lbl  = document.createElement('div'); lbl.className = 'pt-lbl'; lbl.style.color = ph.color; lbl.textContent = ph.probe;
    wrap.appendChild(cv); wrap.appendChild(lbl); strip.appendChild(wrap);
    setTimeout(() => drawThumb(cv, ph.seed, ph.pi), 10);
  });
}

// ══════════════════════════════════════════
// SHAKE GESTURE
// ══════════════════════════════════════════
function doShake() {
  const now = Date.now();
  if (now - S.lastShake < 150) return;
  S.lastShake = now;
  S.shakeBuf.push(now);
  const btn = document.getElementById('shake-btn');
  btn.classList.add('shaking'); setTimeout(() => btn.classList.remove('shaking'), 400);
  const txt = document.getElementById('shake-txt');
  if (S.shakeBuf.length >= 2 && (S.shakeBuf[S.shakeBuf.length-1] - S.shakeBuf[S.shakeBuf.length-2]) < 800) {
    clearTimeout(S.shakeTimer); S.shakeBuf = [];
    show('camera'); txt.textContent = 'Shake ×1 = next probe · Shake ×2 = camera'; return;
  }
  clearTimeout(S.shakeTimer);
  txt.textContent = 'Shake again for camera…';
  S.shakeTimer = setTimeout(() => {
    S.shakeBuf = [];
    txt.textContent = 'Shake ×1 = next probe · Shake ×2 = camera';
    if (!S.frozen && S.page === 'scan') switchProbe((S.pi + 1) % 3);
  }, 700);
}

// ══════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════
let toastT;
function toast(msg) {
  const el = document.getElementById('toast'); el.textContent = msg; el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2200);
}

// ══════════════════════════════════════════
// EVENT WIRING
// ══════════════════════════════════════════
function on(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
}

document.getElementById('pg-session').addEventListener('touchmove', function(e) {
  if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') e.preventDefault();
}, { passive: false });

// Session
on('btn-start', () => {
  S.session.partId = document.getElementById('f-part').value || 'WLD-7741-B';
  S.session.op     = document.getElementById('f-op').value   || 'J. Miller';
  S.session.loc    = document.getElementById('f-loc').value  || '';
  S.session.mat    = document.getElementById('f-mat').value  || 'Steel 316L';
  show('scan');
  setTimeout(sizeCanvas, 50);
  switchProbe(0);
  toast('Session started · ' + S.session.partId);
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function')
    DeviceMotionEvent.requestPermission().catch(() => {});
});

// Scan page
on('pb0',        () => switchProbe(0));
on('pb37',       () => switchProbe(1));
on('pb70',       () => switchProbe(2));
on('btn-freeze', toggleFreeze);
on('btn-save',   doSave);
on('shake-btn',  doShake);
on('tab-scan',   () => show('scan'));
on('tab-rec',    () => show('records'));
on('tab-cam',    () => show('camera'));
on('tab-home',   () => show('session'));

// Records page
on('btn-rec-back', () => show('scan'));
on('tab-scan2',    () => show('scan'));
on('tab-rec2',     () => show('records'));
on('tab-cam2',     () => show('camera'));
on('tab-home2',    () => show('session'));

// Camera page
on('btn-cam-back', () => show('scan'));
on('btn-cam-cap',  capturePhoto);
on('btn-capture',  capturePhoto);
on('tab-scan3',    () => show('scan'));
on('tab-rec3',     () => show('records'));
on('tab-cam3',     () => show('camera'));
on('tab-home3',    () => show('session'));

// Detail page
on('btn-detail-back', () => show('records'));

// Device motion (real shake on iPhone)
if (typeof DeviceMotionEvent !== 'undefined') {
  window.addEventListener('devicemotion', e => {
    const a = e.accelerationIncludingGravity; if (!a) return;
    if (Math.sqrt((a.x||0)**2 + (a.y||0)**2 + (a.z||0)**2) / 9.81 > 2.5) doShake();
  });
}

window.addEventListener('resize', sizeCanvas);
