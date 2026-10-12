/* ==========================================================================
   MONOCHROME  ·  game.js
   Three.js r128 (CDN) · Web Audio API · Gamepad API · WebHID (optional lightbar)
   Everything (textures, models, sound) is generated procedurally.
   ========================================================================== */
(() => {
'use strict';

const BUILD = 7;
window.MONOCHROME_BUILD = BUILD;       // index.html checks this to catch mismatched/old files

// refuse to boot on a stale index.html (it would be missing the newer screens)
const REQUIRED_IDS = ['viewport', 'btn-about', 'btn-multi', 'radar-canvas', 'death-stats', 'set-host-menu', 'set-host-pause',
  'hotbar', 'choke', 'pause-seed', 'photo-input', 't-radar', 'stick', 'objectives', 'acts', 'act2lore', 'btn-act2'];
const missingIds = REQUIRED_IDS.filter((id) => !document.getElementById(id));
if (missingIds.length) {
  const showStale = () => {
    const e = document.getElementById('boot-error');
    if (!e) return;
    e.innerHTML = '<div><h2>Files out of sync</h2><p>This game.js is newer than your index.html. Re-download the whole monochrome folder (or open monochrome-play.html) and hard-refresh.</p></div>';
    e.style.display = 'flex';
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showStale); else showStale();
  return;
}

if (typeof THREE === 'undefined') {
  const show = () => { const e = document.getElementById('boot-error'); if (e) e.style.display = 'flex'; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
  return;
}

/* ======================================================================
   HELPERS
   ====================================================================== */
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
const hash2 = (x, z) => { let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

const LOW = /[?&]low(=|&|$)/.test(location.search);
const COARSE = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
const Settings = {
  look: 1, shadows: 'hard', fx: true, quality: 'medium', seed: '',
  load() {
    try {
      const s = JSON.parse(localStorage.getItem('monochrome.settings') || '{}');
      if (typeof s.look === 'number') this.look = clamp(s.look, 0.2, 3);
      if (['hard', 'soft', 'off'].indexOf(s.shadows) >= 0) this.shadows = s.shadows;
      if (typeof s.fx === 'boolean') this.fx = s.fx;
      if (['low', 'medium', 'high'].indexOf(s.quality) >= 0) this.quality = s.quality;
      if (typeof s.seed === 'string') this.seed = s.seed.slice(0, 16);
    } catch (e) { /* storage unavailable: defaults */ }
  },
  save() { try { localStorage.setItem('monochrome.settings', JSON.stringify({ look: this.look, shadows: this.shadows, fx: this.fx, quality: this.quality, seed: this.seed })); } catch (e) { /* ignore */ } },
};
Settings.load();
if (LOW) { Settings.shadows = 'off'; Settings.quality = 'low'; }

/* ======================================================================
   WORLD CONSTANTS
   ====================================================================== */
const TILE = 3, WALL_H = 3.4, EYE_H = 1.62, PLAYER_R = 0.34;
const CW = 15, CH = 15;                    // coarse maze cells
const HOUSE_W = CW * 2 + 1;                // 31 tiles of house
const YARD_TILES = 21;
const MW = HOUSE_W + YARD_TILES + 1;       // 53 tiles total width (last column = fence)
const MH = CH * 2 + 1;                     // 31
const WALK = 2.5, RUN = 5.0;               // player speeds (units / s)
const MON_PATROL = 2.1, MON_INVEST = 3.4, MON_CHASE = 5.6, MON_CLOSET = 3.0;
const TOTAL_KEYS = 5, HOLD_NEEDED = 4.2;
const DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0];                   // N E S W
const DIRS = [{ dx: 0, dz: -1 }, { dx: 1, dz: 0 }, { dx: 0, dz: 1 }, { dx: -1, dz: 0 }];

const grid = new Uint8Array(MW * MH);       // 1 = wall
const zone = new Uint8Array(MW * MH);       // 0 corridor, 1 safe room, 2 furnished room, 3 backyard
const roomId = new Int8Array(MW * MH);
const idx = (x, z) => z * MW + x;
const inB = (x, z) => x >= 0 && z >= 0 && x < MW && z < MH;
const solid = (x, z) => x < 0 || z < 0 || x >= MW || z >= MH || grid[z * MW + x] === 1;
const tileOf = (v) => Math.floor(v / TILE);
const zoneAt = (wx, wz) => { const x = tileOf(wx), z = tileOf(wz); return inB(x, z) ? zone[idx(x, z)] : 0; };

const ROOM_DEFS = [
  { cx: 4, cy: 0, w: 3, h: 2, name: 'NORTH WING' },
  { cx: 9, cy: 1, w: 3, h: 3, name: 'EAST ROOM' },
  { cx: 1, cy: 5, w: 3, h: 3, name: 'WEST ROOM' },
  { cx: 6, cy: 7, w: 4, h: 3, name: 'CENTRAL HALL' },
  { cx: 11, cy: 9, w: 3, h: 3, name: 'SERVICE ROOM' },
  { cx: 3, cy: 11, w: 3, h: 3, name: 'SOUTH ROOM' },
];
const rooms = ROOM_DEFS.map((r, i) => ({
  id: i, name: r.name,
  x0: 2 * r.cx + 1, x1: 2 * (r.cx + r.w - 1) + 1,
  z0: 2 * r.cy + 1, z1: 2 * (r.cy + r.h - 1) + 1,
}));
rooms.forEach((r) => { r.cxw = (r.x0 + r.x1 + 1) / 2 * TILE; r.czw = (r.z0 + r.z1 + 1) / 2 * TILE; });

const SAFE = { x0: 1, x1: 5, z0: 1, z1: 3 };
const DOOR = { x: 6, z: 3 };
const DOOR_W = { x: (DOOR.x + 0.5) * TILE, z: (DOOR.z + 0.5) * TILE };
const YARD_DOORS = [9, 19, 27];
const GATE_TZ = 15;

const openTiles = [];   // every walkable tile the monster may visit (excludes safe room)
const deadEnds = [];

/* ======================================================================
   MAZE GENERATOR  (recursive backtracker + braiding + carved rooms)
   ====================================================================== */
function generateMaze(act) {
  grid.fill(1); zone.fill(0); roomId.fill(-1);
  const vis = new Uint8Array(CW * CH);
  // the safe room occupies the top-left coarse cells; keep the maze out of them
  for (let cy = 0; cy <= 1; cy++) for (let cx = 0; cx <= 2; cx++) vis[cy * CW + cx] = 2;

  const open = (x, z) => { grid[idx(x, z)] = 0; };
  const start = [3, 1];
  vis[start[1] * CW + start[0]] = 1;
  open(2 * start[0] + 1, 2 * start[1] + 1);
  const stack = [start];
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const cx = cur[0], cy = cur[1];
    const nb = [];
    for (const d of D4) {
      const nx = cx + d[0], ny = cy + d[1];
      if (nx >= 0 && ny >= 0 && nx < CW && ny < CH && !vis[ny * CW + nx]) nb.push([nx, ny]);
    }
    if (!nb.length) { stack.pop(); continue; }
    let n = nb[Math.floor(Math.random() * nb.length)];
    if (act === 2 && stack.length > 1) {                                  // sewers: long straight tunnels
      const pv = stack[stack.length - 2], ld = [cx - pv[0], cy - pv[1]];
      const straight = nb.find((q) => q[0] - cx === ld[0] && q[1] - cy === ld[1]);
      if (straight && Math.random() < 0.72) n = straight;
    }
    vis[n[1] * CW + n[0]] = 1;
    open(cx + n[0] + 1, cy + n[1] + 1);
    open(2 * n[0] + 1, 2 * n[1] + 1);
    stack.push(n);
  }

  // braid: knock through a few walls so the maze has loops to run around
  for (let z = 1; z < 2 * CH; z++) for (let x = 1; x < 2 * CW; x++) {
    if ((x & 1) === (z & 1)) continue;
    if (grid[idx(x, z)] === 0) continue;
    const a = (x & 1) ? [x, z - 1, x, z + 1] : [x - 1, z, x + 1, z];
    if (grid[idx(a[0], a[1])] === 0 && grid[idx(a[2], a[3])] === 0 && Math.random() < (act === 2 ? 0.10 : 0.14)) grid[idx(x, z)] = 0;
  }

  // furnished rooms
  rooms.forEach((r) => {
    for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) {
      grid[idx(x, z)] = 0; zone[idx(x, z)] = 2; roomId[idx(x, z)] = r.id;
    }
  });

  // safe room + its single doorway
  for (let z = SAFE.z0; z <= SAFE.z1; z++) for (let x = SAFE.x0; x <= SAFE.x1; x++) { grid[idx(x, z)] = 0; zone[idx(x, z)] = 1; }
  grid[idx(DOOR.x, DOOR.z)] = 0;
  if (act !== 2) { grid[idx(0, 2)] = 0; zone[idx(0, 2)] = 1; }           // the stair alcove behind the safe room's exit door

  // backyard
  for (let z = 1; z < MH - 1; z++) for (let x = HOUSE_W; x < MW - 1; x++) { grid[idx(x, z)] = 0; zone[idx(x, z)] = 3; }
  YARD_DOORS.forEach((z) => { grid[idx(HOUSE_W - 1, z)] = 0; });

  openTiles.length = 0; deadEnds.length = 0;
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    if (grid[idx(x, z)] !== 0 || zone[idx(x, z)] === 1) continue;
    openTiles.push({ x, z });
    if (zone[idx(x, z)] === 0 && x < HOUSE_W) {
      let n = 0, dir = -1;
      for (let k = 0; k < 4; k++) if (!solid(x + DX[k], z + DZ[k])) { n++; dir = k; }
      if (n === 1) deadEnds.push({ x, z, dir });
    }
  }
}

/* ======================================================================
   LINE OF SIGHT · COLLISION · PATH FIELDS
   ====================================================================== */
function hasLOS(x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0;
  const n = Math.ceil(Math.hypot(dx, dz) / 0.6);
  let prev = tileOf(z0) * MW + tileOf(x0);
  for (let i = 1; i < n; i++) {
    const t = i / n, tx = tileOf(x0 + dx * t), tz = tileOf(z0 + dz * t);
    if (solid(tx, tz)) return false;
    const cur = tz * MW + tx;
    if (cur !== prev && doorEdges.size) { const d = doorEdges.get(prev * 4096 + cur); if (d && d.angle < 0.9) return false; }   // a closed door blocks sight
    prev = cur;
  }
  return true;
}

const colliders = [];
const cBuckets = new Array(MW * MH);
function addCollider(minX, minZ, maxX, maxZ, flags) {
  const c = { minX, minZ, maxX, maxZ, off: false, jamb: !!(flags && flags.jamb) };
  colliders.push(c);
  for (let z = tileOf(minZ); z <= tileOf(maxZ); z++) for (let x = tileOf(minX); x <= tileOf(maxX); x++) {
    if (!inB(x, z)) continue;
    const i = idx(x, z);
    (cBuckets[i] || (cBuckets[i] = [])).push(c);
  }
  return c;
}
function pushFromBox(pos, r, minX, minZ, maxX, maxZ) {
  const cx = clamp(pos.x, minX, maxX), cz = clamp(pos.z, minZ, maxZ);
  const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2), pen = r - d;
    pos.x += dx / d * pen; pos.z += dz / d * pen;
  } else {
    const l = pos.x - minX, rr = maxX - pos.x, t = pos.z - minZ, b = maxZ - pos.z;
    const m = Math.min(l, rr, t, b);
    if (m === l) pos.x = minX - r; else if (m === rr) pos.x = maxX + r; else if (m === t) pos.z = minZ - r; else pos.z = maxZ + r;
  }
}
function resolveCollisions(pos, r, useProps) {
  for (let pass = 0; pass < 2; pass++) {
    const tx = tileOf(pos.x), tz = tileOf(pos.z);
    for (let z = tz - 1; z <= tz + 1; z++) for (let x = tx - 1; x <= tx + 1; x++) {
      if (solid(x, z)) pushFromBox(pos, r, x * TILE, z * TILE, (x + 1) * TILE, (z + 1) * TILE);
      else if (useProps) {
        const b = cBuckets[idx(x, z)];
        if (b) for (let i = 0; i < b.length; i++) { const c = b[i]; if (c.off || (useProps === 'jamb' && !c.jamb && !c.locked)) continue; pushFromBox(pos, r, c.minX, c.minZ, c.maxX, c.maxZ); }
      }
    }
  }
}

const qBuf = new Int32Array(MW * MH);
function bfs(tx, tz, out) {
  out.fill(-1);
  if (!inB(tx, tz) || grid[idx(tx, tz)] === 1) return out;
  let h = 0, t = 0;
  const s = idx(tx, tz);
  out[s] = 0; qBuf[t++] = s;
  while (h < t) {
    const i = qBuf[h++];
    const x = i % MW, z = (i / MW) | 0, d = out[i] + 1;
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k], nz = z + DZ[k];
      if (nx < 0 || nz < 0 || nx >= MW || nz >= MH) continue;
      const n = nz * MW + nx;
      if (grid[n] === 1 || zone[n] === 1 || out[n] >= 0) continue;
      out[n] = d; qBuf[t++] = n;
    }
  }
  return out;
}

/* ======================================================================
   AUDIO  —  everything is synthesised with the Web Audio API
   ====================================================================== */
const Snd = (() => {
  let ctx = null, master = null, muffle = null, noiseBuf = null, revIn = null;
  let monPan = null, droneGain = null, tensionGain = null, staticGain = null;
  let ready = false, hbT = 0;

  const mkNoise = (sec) => {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  };
  const mkImpulse = (sec, decay) => {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  };
  const distCurve = (k) => {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (3 + k) * x * 20 * (Math.PI / 180) / (Math.PI + k * Math.abs(x)); }
    return c;
  };
  function setPos(node, x, y, z) {
    if (node.positionX) { node.positionX.value = x; node.positionY.value = y; node.positionZ.value = z; }
    else node.setPosition(x, y, z);
  }

  function build(AC) {
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.85;
    muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 20000;
    const comp = ctx.createDynamicsCompressor();
    master.connect(muffle); muffle.connect(comp); comp.connect(ctx.destination);
    noiseBuf = mkNoise(3);

    // corridor echo (shared reverb)
    const reverb = ctx.createConvolver(); reverb.buffer = mkImpulse(2.6, 2.4);
    revIn = ctx.createGain(); revIn.gain.value = 1; revIn.connect(reverb);
    const revOut = ctx.createGain(); revOut.gain.value = 0.55; reverb.connect(revOut); revOut.connect(master);

    // the monster's footsteps live in true 3D space
    monPan = ctx.createPanner();
    monPan.panningModel = 'HRTF'; monPan.distanceModel = 'inverse';
    monPan.refDistance = 3; monPan.maxDistance = 100; monPan.rolloffFactor = 1.2;
    monPan.connect(master);
    const monSend = ctx.createGain(); monSend.gain.value = 0.7; monPan.connect(monSend); monSend.connect(revIn);

    // ambient drone
    droneGain = ctx.createGain(); droneGain.gain.value = 0; droneGain.connect(master);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; lp.Q.value = 2; lp.connect(droneGain);
    [41, 41.7, 82.2].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'sine'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = i < 2 ? 0.5 : 0.3; o.connect(g); g.connect(lp); o.start();
    });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 50; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    // room tone
    const rn = ctx.createBufferSource(); rn.buffer = noiseBuf; rn.loop = true;
    const rf = ctx.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 220; rf.Q.value = 0.7;
    const rg = ctx.createGain(); rg.gain.value = 0.05; rn.connect(rf); rf.connect(rg); rg.connect(master); rn.start();
    // thin tension whine
    tensionGain = ctx.createGain(); tensionGain.gain.value = 0; tensionGain.connect(master);
    [1480, 1493].forEach((f) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(tensionGain); o.start(); });

    // pursuit radio static
    const sn = ctx.createBufferSource(); sn.buffer = noiseBuf; sn.loop = true;
    const sbp = ctx.createBiquadFilter(); sbp.type = 'bandpass'; sbp.frequency.value = 2400; sbp.Q.value = 0.5;
    const shp = ctx.createBiquadFilter(); shp.type = 'highpass'; shp.frequency.value = 500;
    const ws = ctx.createWaveShaper(); ws.curve = distCurve(40);
    staticGain = ctx.createGain(); staticGain.gain.value = 0;
    sn.connect(sbp); sbp.connect(shp); shp.connect(ws); ws.connect(staticGain); staticGain.connect(master); sn.start();
    const rt = ctx.createOscillator(); rt.type = 'square'; rt.frequency.value = 118;
    const rtg = ctx.createGain(); rtg.gain.value = 0.04; rt.connect(rtg); rtg.connect(staticGain); rt.start();
    ready = true;
  }
  function init() {
    if (ready) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { build(AC); } catch (e) { ready = false; }
  }

  /* ---- little synth building blocks ---- */
  function env(g, t, a, peak, d) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function thump(dest, vol, f0, dur, when) {
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f0 * 0.42), t + dur);
    const g = ctx.createGain(); env(g, t, 0.008, vol, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.1);
    const n = ctx.createBufferSource(); n.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = f0 * 5;
    const ng = ctx.createGain(); env(ng, t, 0.004, vol * 0.7, 0.14);
    n.connect(f); f.connect(ng); ng.connect(dest); n.start(t, Math.random() * 2); n.stop(t + 0.2);
  }
  function burst(dest, vol, type, freq, q, dur, when, a) {
    const t = ctx.currentTime + (when || 0), at = a || 0.005;
    const n = ctx.createBufferSource(); n.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t, at, vol, dur);
    n.connect(f); f.connect(g); g.connect(dest); n.start(t, Math.random() * 2); n.stop(t + at + dur + 0.05);
  }
  function tone(dest, type, f0, f1, vol, dur, when) {
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); env(g, t, 0.01, vol, dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.1);
  }
  function creak(dur, vol) {
    const t = ctx.currentTime;
    const n = ctx.createBufferSource(); n.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(320, t); f.frequency.linearRampToValueAtTime(880, t + dur);
    const g = ctx.createGain(); env(g, t, 0.05, vol, dur);
    n.connect(f); f.connect(g); g.connect(master); n.start(t, Math.random() * 2); n.stop(t + dur + 0.1);
  }
  const ok = (fn) => function () { if (ready) { try { fn.apply(null, arguments); } catch (e) { /* ignore */ } } };

  let sAct = 1, dripT = 1.2, echoT = 6, rattleT = 11, humG = null, monIn = null, monOut = null, monHum = null, monDripT = 1, monRattleT = 8;
  function ensureAct2() {
    if (humG || !ready) return;
    humG = ctx.createGain(); humG.gain.value = 0; humG.connect(master);                              // low pipe hum
    const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 200; lp2.connect(humG);
    [53, 79.5, 106.4].forEach((f, i) => { const o = ctx.createOscillator(); o.type = i ? 'sine' : 'sawtooth'; o.frequency.value = f; const gg = ctx.createGain(); gg.gain.value = i ? 0.3 : 0.5; o.connect(gg); gg.connect(lp2); o.start(); });
    monIn = ctx.createGain();                                                                          // the console's tinny, noisy "microphone" chain
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 220;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
    const ws = ctx.createWaveShaper(); ws.curve = distCurve(12);
    monOut = ctx.createGain(); monOut.gain.value = 0;
    monIn.connect(hp); hp.connect(lp); lp.connect(ws); ws.connect(monOut); monOut.connect(master);
    const hiss = ctx.createBufferSource(); hiss.buffer = noiseBuf; hiss.loop = true;
    const hb = ctx.createBiquadFilter(); hb.type = 'bandpass'; hb.frequency.value = 3800;
    const hg = ctx.createGain(); hg.gain.value = 0.06; hiss.connect(hb); hb.connect(hg); hg.connect(monOut); hiss.start();
    monHum = ctx.createOscillator(); monHum.type = 'sawtooth'; monHum.frequency.value = 60;
    const mg = ctx.createGain(); mg.gain.value = 0.12; monHum.connect(mg); mg.connect(monIn); monHum.start();
  }
  function pan(node, p) { if (ctx.createStereoPanner) { const sp = ctx.createStereoPanner(); sp.pan.value = clamp(p, -1, 1); sp.connect(node); return sp; } return node; }
  function drip() { const f = 1100 + Math.random() * 1900; tone(master, 'sine', f, f * 0.35, 0.07, 0.1); if (Math.random() < 0.7) tone(revIn, 'sine', f, f * 0.35, 0.09, 0.14); }
  function distantEcho() { burst(revIn, 0.5, 'lowpass', 500, 1, 0.5, 0, 0.03); thump(revIn, 0.45, 55 + Math.random() * 20, 0.5); }
  function pipeRattle() { burst(master, 0.2, 'bandpass', 250 + Math.random() * 120, 4, 0.9, 0, 0.12); for (let i = 0; i < 3; i++) tone(master, 'square', 150 + Math.random() * 80, 100, 0.04, 0.1, 0.18 + i * 0.22); }
  const api = {
    init,
    isReady: () => ready,
    stepMonster: ok(() => { if (sAct === 2) { thump(monPan, 1.0, 58 + Math.random() * 8, 0.42); burst(monPan, 0.9, 'bandpass', 700, 0.6, 0.5, 0, 0.01); burst(monPan, 0.5, 'highpass', 2200, 1, 0.2, 0.06, 0.005); } else { thump(monPan, 1.0, 62 + Math.random() * 10, 0.42); burst(monPan, 0.25, 'lowpass', 300, 1, 0.3, 0.05, 0.02); } }),
    stepPlayer: ok(() => { thump(master, 0.28, 120, 0.2); burst(master, 0.22, 'bandpass', 900, 1, 0.1); }),
    click: ok(() => { burst(master, 0.3, 'highpass', 3000, 1, 0.03); burst(master, 0.2, 'highpass', 2500, 1, 0.03, 0.06); }),
    key: ok(() => { tone(master, 'sine', 1320, 0, 0.22, 0.6); tone(master, 'sine', 1760, 0, 0.16, 0.9, 0.08); burst(master, 0.12, 'bandpass', 5000, 2, 0.2); }),
    search: ok(() => { burst(master, 0.25, 'bandpass', 1200, 0.8, 0.25); burst(master, 0.2, 'bandpass', 1800, 0.8, 0.2, 0.3); burst(master, 0.2, 'bandpass', 1000, 0.8, 0.25, 0.6); }),
    drawer: ok(() => { creak(0.45, 0.28); thump(master, 0.2, 140, 0.15, 0.4); }),
    closet: ok(() => { creak(0.5, 0.3); thump(master, 0.5, 95, 0.3, 0.35); }),
    laptop: ok(() => { tone(master, 'square', 880, 0, 0.05, 0.08); tone(master, 'square', 1320, 0, 0.05, 0.08, 0.1); }),
    camSwitch: ok(() => { burst(master, 0.3, 'bandpass', 3000, 0.5, 0.18); tone(master, 'square', 440, 0, 0.04, 0.06); }),
    note: ok(() => { burst(master, 0.15, 'bandpass', 3000, 0.8, 0.18); }),
    locked: ok(() => { for (let i = 0; i < 3; i++) burst(master, 0.3, 'bandpass', 1500 + i * 400, 3, 0.06, i * 0.08); thump(master, 0.3, 80, 0.2); }),
    gasp: ok(() => { burst(master, 0.5, 'lowpass', 1800, 0.7, 0.35, 0, 0.05); }),
    spotted: ok(() => { burst(master, 0.55, 'bandpass', 2400, 0.4, 0.5, 0, 0.01); tone(master, 'sawtooth', 1800, 2800, 0.2, 0.45); thump(master, 0.6, 50, 0.6); }),
    growl: ok(() => { tone(monPan, 'sawtooth', 62, 36, 0.35, 1.6); }),
    door: ok(() => { creak(0.7, 0.4); thump(master, 0.7, 70, 0.4, 0.5); }),
    death: ok(() => { burst(master, 1.0, 'bandpass', 2000, 0.4, 1.6, 0, 0.01); thump(master, 1.0, 45, 1.2); tone(master, 'sawtooth', 1500, 3000, 0.3, 1.0); }),
    win: ok(() => { tone(master, 'sine', 440, 0, 0.25, 3, 0); tone(master, 'sine', 660, 0, 0.2, 3.2, 0.2); tone(master, 'sine', 880, 0, 0.15, 3.5, 0.4); }),
    ping: ok((close) => { const f = 880 + 700 * close; tone(master, 'sine', f, f * 0.97, 0.1 + 0.16 * close, 0.18); burst(master, 0.05, 'highpass', 4000, 1, 0.03); }),
    radarToggle: ok(() => { burst(master, 0.22, 'bandpass', 700, 2, 0.12); tone(master, 'square', 320, 520, 0.04, 0.12); }),
    zap: ok((v) => { burst(master, 0.35 * v, 'bandpass', 3500, 1.2, 0.25, 0, 0.002); tone(master, 'sawtooth', 120, 60, 0.2 * v, 0.3); }),
    thunk: ok((v) => { thump(master, 0.55 * v, 80, 0.35); burst(master, 0.2 * v, 'lowpass', 500, 1, 0.2); }),
    duck: ok((on) => { const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(on ? 0.0001 : 0.85, t, on ? 0.015 : 0.05); }),
    staticBurst: ok(() => {
      const t = ctx.currentTime, n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 350;
      const ws = ctx.createWaveShaper(); ws.curve = distCurve(30);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9, t + 0.03);
      g.gain.setValueAtTime(0.9, t + 1.0); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
      n.connect(f); f.connect(ws); ws.connect(g); g.connect(master); n.start(t); n.stop(t + 2.4);
      tone(master, 'square', 118, 0, 0.12, 2.0);
    }),
    doorCreak: ok((v, closing) => { creak(closing ? 0.35 : 0.5, 0.3 * v); thump(master, (closing ? 0.55 : 0.3) * v, closing ? 70 : 90, closing ? 0.3 : 0.2, closing ? 0.05 : 0.3); }),
    stomp: ok(() => { thump(master, 1.0, 38, 1.0); burst(master, 0.6, 'lowpass', 600, 1, 0.5, 0, 0.002); burst(master, 0.4, 'bandpass', 2500, 2, 0.12, 0.02, 0.001); }),
    glass: ok(() => { burst(master, 0.5, 'highpass', 3500, 1, 0.35, 0, 0.002); for (let i = 0; i < 6; i++) tone(master, 'sine', 2200 + Math.random() * 2500, 0, 0.08, 0.15, 0.03 * i); }),
    setAct: (n) => { sAct = n; if (!ready) return; ensureAct2(); humG.gain.setTargetAtTime(n === 2 ? 0.1 : 0, ctx.currentTime, 1.2); },
    stepWet: ok((vol) => { thump(master, 0.3 * vol, 95, 0.22); burst(master, 0.42 * vol, 'bandpass', 800, 0.7, 0.26, 0, 0.01); burst(master, 0.25 * vol, 'highpass', 2600, 1, 0.12, 0.04, 0.005); }),
    gateCreak: ok((v, closing) => { creak(closing ? 0.7 : 1.0, 0.55 * v); tone(master, 'sawtooth', 160, 90, 0.08 * v, 0.8); thump(master, 0.5 * v, 70, 0.25, closing ? 0.45 : 0.9); }),
    lockOpen: ok(() => { burst(master, 0.4, 'bandpass', 3000, 3, 0.05); thump(master, 0.3, 140, 0.12, 0.05); tone(master, 'sine', 900, 0, 0.1, 0.2, 0.08); }),
    radioStatic: ok(() => { burst(master, 0.35, 'bandpass', 1800, 0.6, 0.5, 0, 0.02); tone(master, 'sawtooth', 440 + Math.random() * 400, 0, 0.05, 0.3); }),
    thudDown: ok(() => { thump(master, 0.9, 55, 0.45); burst(master, 0.5, 'lowpass', 500, 1, 0.25); }),
    monitor: ok((on, ch) => { ensureAct2(); monOut.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.12); if (on && ch) monHum.frequency.setTargetAtTime(ch.hum, ctx.currentTime, 0.05); }),
    monitorStep: ok((vol, p) => { const d = pan(monIn, p); thump(d, 0.9 * vol, 70, 0.35); burst(d, 0.8 * vol, 'bandpass', 700, 0.6, 0.4, 0, 0.01); }),
    monitorGrowl: ok((vol, p) => { tone(pan(monIn, p), 'sawtooth', 70, 40, 0.5 * vol, 1.2); }),
    monitorAmbient: ok((dt, ch) => {
      monDripT -= dt; if (monDripT <= 0) { monDripT = ch.drip * (0.5 + Math.random()); tone(monIn, 'sine', 1200 + Math.random() * 1600, 400, 0.18, 0.12); }
      monRattleT -= dt; if (monRattleT <= 0) { monRattleT = ch.rattle * (0.6 + Math.random() * 0.8); burst(monIn, 0.5, 'bandpass', 300, 4, 0.7, 0, 0.05); }
    }),
    update: (dt, o) => {
      if (!ready) return;
      const t = ctx.currentTime, L = ctx.listener;
      if (sAct === 2) {                                                                                  // continuous dripping, distant echoes, pipe rattles
        dripT -= dt; if (dripT <= 0) { dripT = 0.35 + Math.random() * 1.9; drip(); }
        echoT -= dt; if (echoT <= 0) { echoT = 5 + Math.random() * 9; distantEcho(); }
        rattleT -= dt; if (rattleT <= 0) { rattleT = 9 + Math.random() * 18; pipeRattle(); }
      }
      if (o.monitorOn && o.chan) api.monitorAmbient(dt, o.chan);
      if (L.positionX) {
        L.positionX.value = o.lx; L.positionY.value = 1.6; L.positionZ.value = o.lz;
        L.forwardX.value = o.fx; L.forwardY.value = o.fy; L.forwardZ.value = o.fz;
        L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
      } else { L.setPosition(o.lx, 1.6, o.lz); L.setOrientation(o.fx, o.fy, o.fz, 0, 1, 0); }
      setPos(monPan, o.mx, 1.4, o.mz);
      const sg = o.sees ? clamp(1.15 - o.dist / 32, 0.28, 1) * 0.42 : 0;
      staticGain.gain.setTargetAtTime(sg * (0.7 + Math.random() * 0.6), t, 0.04);
      tensionGain.gain.setTargetAtTime(o.tension * 0.02, t, 0.3);
      droneGain.gain.setTargetAtTime(0.2 + o.tension * 0.08, t, 0.8);
      muffle.frequency.setTargetAtTime(o.holding ? 600 : 20000, t, 0.15);
      hbT -= dt;
      if (hbT <= 0 && o.tension > 0.15) {
        const v = 0.25 + o.tension * 0.5;
        thump(master, v, 58, 0.22); thump(master, v * 0.7, 52, 0.2, 0.19);
        hbT = 1.15 - o.tension * 0.7;
      }
    },
  };
  return api;
})();

/* ======================================================================
   INPUT  —  keyboard + mouse + PS4 (DualShock 4) via Gamepad API
   ====================================================================== */
const Input = (() => {
  const down = Object.create(null), edge = Object.create(null);
  let mdx = 0, mdy = 0, wheelY = 0, padActive = false, padPrev = [], padConnected = false, lastTouchDev = COARSE;
  const nav = { x: 0, y: 0, t: 0 };
  const MOUSE_SENS = 0.0022;   // radians per pixel at slider = 1
  const PAD_LOOK = 2.7;        // radians per SECOND at full stick, slider = 1
  const TOUCH_LOOK = 0.005;    // radians per pixel dragged, slider = 1
  const DEAD = 0.18;
  const GAME_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
  // one place decides how strongly the "Look sensitivity" slider scales every kind of look input
  const lookScale = () => clamp(Settings.look, 0.2, 3);

  const TCH = { on: false, mx: 0, mz: 0, lx: 0, ly: 0, runOn: false, breath: false, flags: {}, stickId: null, lookId: null, lastX: 0, lastY: 0 };
  const stickEl = $('stick'), knobEl = $('stick-knob');

  /* ---- which controls to show: phone buttons (touch) or nothing extra (PC / controller) ---- */
  function resetTouchState() {
    TCH.mx = 0; TCH.mz = 0; TCH.lx = 0; TCH.ly = 0; TCH.stickId = null; TCH.lookId = null; TCH.runOn = false; TCH.breath = false; TCH.flags = {};
    knobEl.style.transform = 'translate(0,0)';
    const rb = $('t-run'); if (rb) rb.classList.remove('on');
  }
  function setUiMode(touch) {
    if (touch === TCH.on) return;
    TCH.on = touch;
    document.body.classList.toggle('touch', touch);
    if (touch) padActive = false; else resetTouchState();
  }
  // phone buttons only on a touch device with no controller and no keyboard in use
  const refreshMode = () => setUiMode(COARSE && lastTouchDev && !padConnected);
  setUiMode(COARSE);

  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'text') return;      // typing a seed: not a game key
    if (GAME_KEYS.indexOf(e.code) >= 0) e.preventDefault();
    if (e.repeat) return;
    down[e.code] = true; edge[e.code] = true; padActive = false;
    if (COARSE) { lastTouchDev = false; refreshMode(); }       // a keyboard is attached: treat it like a PC
  });
  window.addEventListener('keyup', (e) => { down[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in down) down[k] = false; });
  let drag = false;
  window.addEventListener('mousedown', (e) => { if (e.button === 0 && e.target && e.target.tagName === 'CANVAS') drag = true; });
  window.addEventListener('mouseup', () => { drag = false; });
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement || drag) {
      const dx = e.movementX || 0, dy = e.movementY || 0;
      if (Math.abs(dx) > 400 || Math.abs(dy) > 400) return;      // browsers emit one huge bogus delta when the lock engages
      mdx += dx; mdy += dy; padActive = false;
    }
  });
  window.addEventListener('wheel', (e) => { wheelY += e.deltaY > 0 ? 1 : (e.deltaY < 0 ? -1 : 0); }, { passive: true });

  /* ---- touch: floating look-drag, on-screen stick + buttons ---- */
  function setStick(t) {
    const r = stickEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, rad = r.width / 2;
    let dx = (t.clientX - cx) / rad, dy = (t.clientY - cy) / rad;
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    TCH.mx = Math.abs(dx) < 0.12 ? 0 : dx; TCH.mz = Math.abs(dy) < 0.12 ? 0 : -dy;
    knobEl.style.transform = 'translate(' + (dx * rad * 0.55) + 'px,' + (dy * rad * 0.55) + 'px)';
  }
  function resetStick() { TCH.mx = 0; TCH.mz = 0; TCH.stickId = null; knobEl.style.transform = 'translate(0,0)'; }
  const onBtn = (tg) => !!(tg && tg.closest && tg.closest('button, input, .slot'));
  window.addEventListener('touchstart', (e) => {
    if (COARSE) { lastTouchDev = true; refreshMode(); }
    if (!TCH.on) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (onBtn(t.target)) continue;
      const r = stickEl.getBoundingClientRect();
      if (TCH.stickId === null && t.clientX >= r.left - 30 && t.clientX <= r.right + 30 && t.clientY >= r.top - 30 && t.clientY <= r.bottom + 30) { TCH.stickId = t.identifier; setStick(t); }
      else if (TCH.lookId === null) { TCH.lookId = t.identifier; TCH.lastX = t.clientX; TCH.lastY = t.clientY; }
    }
    if (e.cancelable && !onBtn(e.target)) e.preventDefault();
  }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    if (!TCH.on) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === TCH.stickId) setStick(t);
      else if (t.identifier === TCH.lookId) { TCH.lx += (t.clientX - TCH.lastX) * TOUCH_LOOK; TCH.ly += (t.clientY - TCH.lastY) * TOUCH_LOOK; TCH.lastX = t.clientX; TCH.lastY = t.clientY; }
    }
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  const tEnd = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const id = e.changedTouches[i].identifier;
      if (id === TCH.stickId) resetStick();
      if (id === TCH.lookId) TCH.lookId = null;
    }
  };
  window.addEventListener('touchend', tEnd); window.addEventListener('touchcancel', tEnd);
  function bindBtn(id, onDown, onUp) {
    const b = $(id); if (!b) return;
    b.addEventListener('pointerdown', (e) => { if (!TCH.on) return; onDown(); if (e.cancelable) e.preventDefault(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => b.addEventListener(ev, () => { if (onUp) onUp(); }));
  }
  bindBtn('t-interact', () => { TCH.flags.interact = true; });
  bindBtn('t-flash', () => { TCH.flags.flash = true; });
  bindBtn('t-map', () => { TCH.flags.journal = true; });
  bindBtn('t-pause', () => { TCH.flags.pause = true; });
  bindBtn('t-radar', () => { TCH.flags.radar = true; });
  bindBtn('t-run', () => { TCH.runOn = !TCH.runOn; const b = $('t-run'); if (b) b.classList.toggle('on', TCH.runOn); });   // tap to toggle running
  bindBtn('t-breath', () => { TCH.breath = true; }, () => { TCH.breath = false; });

  function getPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) return pads[i];
    return null;
  }
  const radial = (x, y) => {
    const m = Math.hypot(x, y);
    if (m < DEAD) return [0, 0];
    const s = Math.min(1, (m - DEAD) / (1 - DEAD)) / m;
    return [x * s, y * s];
  };

  // dt = frame time used by the game (capped); rawDt = real elapsed time, so stick-look speed never depends on the frame rate
  function poll(dt, rawDt) {
    const rdt = clamp(rawDt || dt, 0.001, 0.25);
    const o = {
      mx: 0, mz: 0, lx: 0, ly: 0, run: false, breath: false, interact: false, flash: false, journal: false,
      back: false, prev: false, next: false, cam: -1, pause: false, confirm: false, pad: false, radar: false,
      use: false, itemPrev: false, itemNext: false, select: false, navX: 0, navY: 0,
    };
    const look = lookScale();
    // keyboard + mouse
    o.mx = (down.KeyD ? 1 : 0) - (down.KeyA ? 1 : 0);
    o.mz = (down.KeyW ? 1 : 0) - (down.KeyS ? 1 : 0);
    o.run = !!(down.ShiftLeft || down.ShiftRight);
    o.breath = !!down.Space;
    o.interact = !!edge.KeyE; o.flash = !!edge.KeyF; o.journal = !!edge.KeyJ;
    o.back = !!(edge.Escape || edge.Backspace);
    o.prev = !!(edge.ArrowLeft || edge.KeyA); o.next = !!(edge.ArrowRight || edge.KeyD);
    o.pause = !!edge.KeyP; o.radar = !!edge.KeyR; o.confirm = !!(edge.Enter || edge.NumpadEnter);
    o.use = !!edge.KeyQ; o.itemPrev = !!edge.KeyZ; o.itemNext = !!edge.KeyX;
    for (let i = 1; i <= 9; i++) if (edge['Digit' + i] || edge['Numpad' + i]) o.cam = i - 1;
    if (edge.Digit0 || edge.Numpad0) o.cam = 9;
    if (wheelY > 0) o.itemNext = true; else if (wheelY < 0) o.itemPrev = true;
    wheelY = 0;
    o.lx = mdx * MOUSE_SENS * look; o.ly = mdy * MOUSE_SENS * look; mdx = 0; mdy = 0;

    // gamepad
    const gp = getPad();
    if (!!gp !== padConnected) { padConnected = !!gp; refreshMode(); }
    if (gp) {
      const ax = gp.axes || [];
      const l = radial(ax[0] || 0, ax[1] || 0), r = radial(ax[2] || 0, ax[3] || 0);
      const now = gp.buttons.map((b) => !!b.pressed);
      const val = (i) => (gp.buttons[i] ? gp.buttons[i].value : 0);
      const E = (i) => now[i] && !padPrev[i];
      if (Math.abs(l[0]) + Math.abs(l[1]) + Math.abs(r[0]) + Math.abs(r[1]) > 0.01 || now.some(Boolean)) padActive = true;
      o.mx += l[0]; o.mz += -l[1];
      o.lx += r[0] * PAD_LOOK * rdt * look; o.ly += r[1] * PAD_LOOK * rdt * look;
      if (now[7] || val(7) > 0.5) o.run = true;           // R2
      if (now[6] || val(6) > 0.5) o.breath = true;        // L2
      if (E(2)) o.interact = true;                        // Square
      if (E(3)) o.flash = true;                           // Triangle
      if (E(8) || E(17)) o.journal = true;                // Share/Select or Touchpad
      if (E(1)) { o.back = true; o.use = true; }          // Circle: back in menus, use item in the game
      if (E(14) || E(4)) o.prev = true;                   // D-Pad left / L1
      if (E(15) || E(5)) o.next = true;                   // D-Pad right / R1
      if (E(14)) o.itemPrev = true;
      if (E(15)) o.itemNext = true;
      if (E(9)) o.pause = true;                           // Options
      if (E(5) || E(13)) o.radar = true;                  // R1 / D-Pad down
      if (E(0) || E(2)) o.select = true;                  // Cross or Square confirms in menus
      // menu navigation: D-Pad or left stick, with key-repeat when held
      let nx = 0, ny = 0;
      if (now[14]) nx = -1; else if (now[15]) nx = 1;
      if (now[12]) ny = -1; else if (now[13]) ny = 1;
      if (!nx && !ny) {
        const lx = ax[0] || 0, ly = ax[1] || 0;
        if (Math.abs(lx) > 0.6 || Math.abs(ly) > 0.6) { if (Math.abs(lx) > Math.abs(ly)) nx = lx > 0 ? 1 : -1; else ny = ly > 0 ? 1 : -1; }
      }
      const same = nx === nav.x && ny === nav.y;
      if ((nx || ny) && (!same || (nav.t -= rdt) <= 0)) { o.navX = nx; o.navY = ny; nav.t = same ? 0.16 : 0.38; }
      if (!nx && !ny) nav.t = 0;
      nav.x = nx; nav.y = ny;
      padPrev = now;
    } else padPrev = [];

    if (TCH.on) {
      o.mx += TCH.mx; o.mz += TCH.mz; o.lx += TCH.lx * look; o.ly += TCH.ly * look; TCH.lx = 0; TCH.ly = 0;
      if (TCH.runOn) o.run = true;
      if (TCH.breath) o.breath = true;
      if (TCH.flags.interact) o.interact = true;
      if (TCH.flags.flash) o.flash = true;
      if (TCH.flags.journal) o.journal = true;
      if (TCH.flags.pause) o.pause = true;
      if (TCH.flags.radar) o.radar = true;
      TCH.flags = {};
    }

    const m = Math.hypot(o.mx, o.mz);
    if (m > 1) { o.mx /= m; o.mz /= m; }
    o.pad = padActive;
    for (const k in edge) delete edge[k];
    return o;
  }
  return {
    poll, getPad, lookScale, isPad: () => padActive, isTouch: () => TCH.on, padConnected: () => padConnected,
    setPadActive: (v) => { padActive = v; },
  };
})();

/* ======================================================================
   CONTROLLER FEEDBACK  —  rumble (Gamepad API) + lightbar (WebHID, optional)
   The Gamepad API cannot set the DualShock lightbar, so the colour is always
   mirrored on an on-screen LED, and written to the real lightbar when the
   player connects it through WebHID.
   ====================================================================== */
const Pad = (() => {
  let dev = null, mode = null, lastSend = 0, lastKey = '', rumbleAt = 0;
  const led = $('padled');
  const TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[i] = c >>> 0; }
    return t;
  })();
  const crc32 = (bytes) => { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (~c) >>> 0; };

  function send(r, g, b) {
    if (!dev) return;
    try {
      if (mode === 'usb') {
        const d = new Uint8Array(31);
        d[0] = 0x07; d[1] = 0x04; d[5] = r; d[6] = g; d[7] = b;
        dev.sendReport(0x05, d).catch(() => {});
      } else if (mode === 'bt') {
        const rep = new Uint8Array(78);
        rep[0] = 0x11; rep[1] = 0xC4; rep[3] = 0x07; rep[8] = r; rep[9] = g; rep[10] = b;
        const body = new Uint8Array(75); body[0] = 0xA2; body.set(rep.subarray(0, 74), 1);
        const crc = crc32(body);
        rep[74] = crc & 0xFF; rep[75] = (crc >>> 8) & 0xFF; rep[76] = (crc >>> 16) & 0xFF; rep[77] = (crc >>> 24) & 0xFF;
        dev.sendReport(0x11, rep.subarray(1)).catch(() => {});
      }
    } catch (e) { /* ignore */ }
  }
  function setLight(r, g, b) {
    r = r | 0; g = g | 0; b = b | 0;
    if (led) led.style.background = 'rgb(' + r + ',' + g + ',' + b + ')';
    const key = r + ',' + g + ',' + b, now = performance.now();
    if (dev && key !== lastKey && now - lastSend > 60) { lastKey = key; lastSend = now; send(r, g, b); }
  }
  async function connect() {
    if (!navigator.hid) return false;
    try {
      const list = await navigator.hid.requestDevice({
        filters: [{ vendorId: 0x054c, productId: 0x05c4 }, { vendorId: 0x054c, productId: 0x09cc }, { vendorId: 0x054c, productId: 0x0ba0 }],
      });
      if (!list.length) return false;
      const d = list[0];
      if (!d.opened) await d.open();
      const ids = [];
      (d.collections || []).forEach((c) => (c.outputReports || []).forEach((r) => ids.push(r.reportId)));
      mode = ids.indexOf(0x05) >= 0 ? 'usb' : (ids.indexOf(0x11) >= 0 ? 'bt' : null);
      if (!mode) return false;
      dev = d; lastKey = '';
      return true;
    } catch (e) { return false; }
  }
  function rumble(strong, weak, ms) {
    const now = performance.now();
    if (now - rumbleAt < 120) return;
    rumbleAt = now;
    const gp = Input.getPad();
    if (!gp) return;
    try {
      const a = gp.vibrationActuator;
      if (a && a.playEffect) a.playEffect('dual-rumble', { startDelay: 0, duration: ms || 200, weakMagnitude: clamp(weak, 0, 1), strongMagnitude: clamp(strong, 0, 1) }).catch(() => {});
    } catch (e) { /* ignore */ }
  }
  return { setLight, connect, rumble, supported: () => !!navigator.hid, connected: () => !!dev };
})();

/* ======================================================================
   DOM REFERENCES
   ====================================================================== */
const el = {};
['viewport', 'menu', 'btn-play', 'btn-full', 'btn-hid', 'menu-hint', 'lore', 'lore-text', 'btn-begin', 'hud', 'hud-keys',
  'prompt', 'prompt-text', 'prompt-bar', 'toast', 'controls', 'padled', 'hud-full', 'breath', 'b-hold', 'b-air', 'b-noise',
  'closet-overlay', 'cam-ui', 'cam-label', 'cam-time', 'cam-tabs', 'cam-hint', 'journal', 'journal-canvas', 'note-view',
  'note-canvas', 'pause', 'btn-resume', 'btn-full2', 'death', 'death-stats', 'btn-retry', 'btn-menu', 'win', 'btn-again', 'grain', 'flash', 'alert',
  'radar', 'radar-canvas', 'r-dist', 'cut', 'mc-label', 'mc-time', 'menu-glitch',
  'settings', 'about', 'btn-settings', 'btn-about', 'btn-about-close', 'btn-set-back', 'btn-multi', 'soon-banner', 'set-host-menu', 'set-host-pause',
  'hotbar', 'choke', 'pause-seed', 'photo-input',
  'objectives', 'pause-objectives', 'acts', 'btn-act1', 'btn-act2pick', 'btn-acts-back', 'act2lore', 'act2-text', 'btn-act2', 'win-title', 'win-text',
].forEach((id) => { el[id] = $(id); });

/* ======================================================================
   RENDERER · SCENE · LIGHTS
   ====================================================================== */
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOW ? 0.75 : 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
renderer.shadowMap.enabled = false;   // switched on by applyShadowMode() from the Shadows setting
el.viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.055);
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 140);
camera.rotation.order = 'YXZ';
const cctv = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.1, 160);

const ambient = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambient);
const flash = new THREE.SpotLight(0xffffff, 0, 28, 0.42, 0.55, 1.2);
flash.castShadow = !LOW;
flash.shadow.mapSize.set(1024, 1024);
flash.shadow.camera.near = 0.4; flash.shadow.camera.far = 30; flash.shadow.bias = -0.0006; flash.shadow.normalBias = 0.02;
scene.add(flash); scene.add(flash.target);
// a faint light that lives on the player; it casts its own all-round shadows
const playerLight = new THREE.PointLight(0xffffff, 0.28, 7, 2);
playerLight.castShadow = false;
playerLight.shadow.mapSize.set(256, 256); playerLight.shadow.camera.near = 0.1; playerLight.shadow.camera.far = 8; playerLight.shadow.bias = -0.003;
scene.add(playerLight);

// a small pool of point lights hops between the nearest ceiling lamps (cross-fading, so nothing pops)
const POOL = 5;
const lampSlots = [];
for (let i = 0; i < POOL; i++) {
  const l = new THREE.PointLight(0xffffff, 0, 13, 1.6);
  scene.add(l);
  lampSlots.push({ light: l, lamp: null, w: 0, want: 0 });
}

const world = new THREE.Group();
scene.add(world);

/* ======================================================================
   PROCEDURAL TEXTURES  (all grayscale)
   ====================================================================== */
const T = { noteCanvas: [], noteTex: [] };
function canvasTex(w, h, paint, rx, rz) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); paint(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, rz || 1);
  t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return t;
}
const dots = (g, w, h, n, lo, hi, a, s) => {
  for (let i = 0; i < n; i++) { const v = rndi(lo, hi); g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + a + ')'; g.fillRect(Math.random() * w, Math.random() * h, rnd(1, s), rnd(1, s)); }
};
const ln = (g, x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };

/* ---- notes: disturbing doodles + cryptic rules ---- */
const NOTE_DEFS = [
  { lines: ['RULE 1', '', 'DO NOT RUN.', 'IT HEARS EVERY', 'HURRIED STEP.'], doodle: 'runx' },
  { lines: ['THE WARDROBES', 'ARE NOT SAFE.', '', 'THEY ARE ONLY', 'QUIET.'], doodle: 'closet' },
  { lines: ['IF IT STANDS', 'AT THE DOORS', '', 'STOP', 'BREATHING.'], doodle: 'eyes' },
  { lines: ['THE LIGHT HELPS', 'YOU SEE.', '', 'THE LIGHT HELPS', 'IT MORE.'], doodle: 'figure' },
  { lines: ['FIVE KEYS.', 'ONE GATE.', '', 'I FOUND THREE.'], doodle: 'tally' },
  { lines: ['ITS HEAD', 'IS WIDER EVERY', 'NIGHT.', '', 'I COUNTED.'], doodle: 'figure' },
  { lines: ['DONT LOOK', 'AT THE EYES.', '', 'I LOOKED.'], doodle: 'eyes' },
  { lines: ['THE BACKYARD', 'IS NOT OUTSIDE.', '', 'IT IS JUST', 'MORE OF IT.'], doodle: 'spiral' },
  { lines: ['THE SAFE ROOM', 'IS THE ONLY ROOM', 'IT CANNOT ENTER.', '', 'WHY?'], doodle: 'door' },
  { lines: ['WALK.', 'WALK.', 'WALK.', '', 'LISTEN FOR THE', 'SLOW STEPS.'], doodle: 'steps' },
  { lines: ['IT WAS ONCE', 'A MAN.', '', 'HE WAS TALL.', 'HE STAYED TALL.'], doodle: 'figure' },
  { lines: ['DAY 41', '', 'NO LIGHT HERE.', 'NO COLOUR.', 'NO WAY BACK.'], doodle: 'spiral' },
];
const DOODLES = {
  figure(g, x, y, w, h) {
    const cx = x + w / 2;
    g.fillStyle = '#111'; g.strokeStyle = '#111'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(cx - 95, y + 26); g.lineTo(cx + 95, y + 26); g.lineTo(cx, y + 50); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(cx, y + 56, 16, 21, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(cx - 20, y + 76); g.lineTo(cx + 20, y + 76); g.lineTo(cx + 12, y + 150); g.lineTo(cx - 12, y + 150); g.closePath(); g.fill();
    ln(g, cx - 18, y + 80, cx - 40, y + 160); ln(g, cx + 18, y + 80, cx + 40, y + 160);
    ln(g, cx - 8, y + 150, cx - 12, y + h - 4); ln(g, cx + 8, y + 150, cx + 12, y + h - 4);
    g.fillStyle = '#eee'; g.beginPath(); g.arc(cx - 6, y + 52, 3, 0, TAU); g.arc(cx + 6, y + 52, 3, 0, TAU); g.fill();
  },
  eyes(g, x, y, w, h) {
    g.strokeStyle = '#111'; g.lineWidth = 4;
    for (let i = 0; i < 7; i++) {
      const cx = x + 40 + Math.random() * (w - 80), cy = y + 20 + Math.random() * (h - 40), r = rnd(14, 28);
      g.fillStyle = '#e8e8e8'; g.beginPath(); g.ellipse(cx, cy, r * 1.5, r * 0.7, rnd(-0.3, 0.3), 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#111'; g.beginPath(); g.arc(cx, cy, r * 0.38, 0, TAU); g.fill();
    }
  },
  runx(g, x, y, w, h) {
    const cx = x + w / 2, cy = y + h / 2;
    g.strokeStyle = '#111'; g.lineWidth = 7;
    g.beginPath(); g.arc(cx, cy - 55, 14, 0, TAU); g.stroke();
    ln(g, cx, cy - 40, cx - 8, cy + 20); ln(g, cx - 4, cy - 25, cx + 34, cy - 10); ln(g, cx - 4, cy - 25, cx - 38, cy - 5);
    ln(g, cx - 8, cy + 20, cx + 26, cy + 54); ln(g, cx - 8, cy + 20, cx - 40, cy + 48);
    g.strokeStyle = 'rgba(20,20,20,0.9)'; g.lineWidth = 12; ln(g, x + 20, y + 4, x + w - 20, y + h - 4); ln(g, x + w - 20, y + 4, x + 20, y + h - 4);
  },
  closet(g, x, y, w, h) {
    const cx = x + w / 2;
    g.strokeStyle = '#111'; g.fillStyle = '#222'; g.lineWidth = 6;
    g.fillRect(cx - 55, y + 6, 110, h - 12); g.strokeRect(cx - 55, y + 6, 110, h - 12);
    g.strokeStyle = '#555'; g.lineWidth = 3;
    for (let k = 0; k < 9; k++) ln(g, cx - 48, y + 22 + k * 15, cx + 48, y + 22 + k * 15);
    g.fillStyle = '#f2f2f2'; g.beginPath(); g.arc(cx - 14, y + 70, 5, 0, TAU); g.arc(cx + 14, y + 70, 5, 0, TAU); g.fill();
  },
  tally(g, x, y, w, h) {
    g.strokeStyle = '#111'; g.lineWidth = 6;
    for (let grp = 0; grp < 3; grp++) for (let k = 0; k < 4; k++) ln(g, x + 30 + grp * 120 + k * 22, y + 20, x + 30 + grp * 120 + k * 22, y + 90);
    for (let grp = 0; grp < 2; grp++) ln(g, x + 20 + grp * 120, y + 85, x + 110 + grp * 120, y + 25);
    g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,0.85)'; ln(g, x + 280, y + 10, x + 400, y + 120); ln(g, x + 400, y + 10, x + 280, y + 120);
  },
  spiral(g, x, y, w, h) {
    const cx = x + w / 2, cy = y + h / 2;
    g.strokeStyle = '#111'; g.lineWidth = 5; g.beginPath();
    for (let t = 0; t < 26; t += 0.2) { const r = 3 + t * 3.4; const px = cx + Math.cos(t) * r * 1.5, py = cy + Math.sin(t) * r * 0.9; if (t === 0) g.moveTo(px, py); else g.lineTo(px, py); }
    g.stroke();
  },
  door(g, x, y, w, h) {
    const cx = x + w / 2;
    g.strokeStyle = '#111'; g.lineWidth = 7; g.strokeRect(cx - 55, y + 4, 110, h - 8);
    g.fillStyle = '#111'; g.beginPath(); g.arc(cx + 32, y + h / 2, 7, 0, TAU); g.fill();
    g.font = 'bold 70px "Courier New", monospace'; g.fillText('?', cx - 20, y + h / 2 + 24);
  },
  steps(g, x, y, w, h) {
    g.fillStyle = '#151515';
    for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse(x + 30 + i * 52, y + h / 2 + (i % 2 ? 26 : -26), 14, 28, 0.3, 0, TAU); g.fill(); }
  },
};
function paintNote(def) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#c4c4c4'; g.fillRect(0, 0, 512, 512);
  dots(g, 512, 512, 3500, 90, 230, 0.2, 3);
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; ln(g, 0, 256, 512, 262); ln(g, 256, 0, 250, 512);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 512, 10); g.fillRect(0, 502, 512, 10); g.fillRect(0, 0, 8, 512); g.fillRect(504, 0, 8, 512);
  g.fillStyle = '#e8e8e8'; g.beginPath(); g.arc(256, 22, 9, 0, TAU); g.fill();
  g.fillStyle = '#141414'; g.font = 'bold 38px "Courier New", monospace';
  def.lines.forEach((l, i) => g.fillText(l, 34, 78 + i * 44));
  DOODLES[def.doodle](g, 40, 320, 430, 170);
  return c;
}
function makeNoteTexture(def) {
  const c = paintNote(def);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  T.noteCanvas.push(c); T.noteTex.push(t);
}

function initTextures() {
  T.wall = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8c8c8c'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(x, 0, 16, h); }
    dots(g, w, h, 6000, 40, 200, 0.25, 3);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, h * 0.78, w, h * 0.22);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, h * 0.78, w, 3);
  });
  T.floor = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4e4e4e'; g.fillRect(0, 0, w, h);
    dots(g, w, h, 9000, 20, 120, 0.5, 3);
    g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1;
    for (let i = 0; i < w; i += 32) { ln(g, i, 0, i, h); ln(g, 0, i, w, i); }
  });
  T.ceil = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b8b8b8'; g.fillRect(0, 0, w, h);
    dots(g, w, h, 3000, 120, 220, 0.25, 3);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
  }, HOUSE_W * TILE / 1.5, MH * TILE / 1.5);
  T.ground = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, w, h);
    dots(g, w, h, 12000, 10, 110, 0.5, 4);
    for (let i = 0; i < 25; i++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, rnd(10, 40), 0, TAU); g.fill(); }
  }, (MW - HOUSE_W) * TILE / 4, MH * TILE / 4);
  T.fence = canvasTex(256, 256, (g, w, h) => {
    for (let x = 0; x < w; x += 24) { const v = rndi(70, 120); g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(x, 0, 22, h); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x + 22, 0, 2, h); }
    dots(g, w, h, 3000, 20, 160, 0.25, 3);
  });
  T.slat = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#242424'; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 12) { g.fillStyle = '#4c4c4c'; g.fillRect(8, y, w - 16, 7); g.fillStyle = '#111'; g.fillRect(8, y + 7, w - 16, 3); }
    g.strokeStyle = '#111'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  });
  T.rug = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, w, h);
    dots(g, w, h, 2500, 100, 210, 0.4, 3);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
  }, 3, 2);
  T.glow = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  T.glow.wrapS = T.glow.wrapT = THREE.ClampToEdgeWrapping;
  NOTE_DEFS.forEach(makeNoteTexture);
  // ----- decor textures -----
  const cv = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g2 = c.getContext('2d'); fn(g2, w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; };
  const aged = (g2, w, h) => { dots(g2, w, h, 1400, 20, 200, 0.18, 3); g2.fillStyle = 'rgba(0,0,0,0.35)'; g2.fillRect(0, 0, w, 6); g2.fillRect(0, h - 6, w, 6); g2.fillRect(0, 0, 6, h); g2.fillRect(w - 6, 0, 6, h); };
  T.paint = [
    cv(128, 160, (g2, w, h) => {                                   // portrait, face scratched out
      g2.fillStyle = '#5b5b5b'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#1b1b1b'; g2.beginPath(); g2.ellipse(64, 150, 54, 56, 0, Math.PI, 0); g2.fill();
      g2.fillStyle = '#9a9a9a'; g2.beginPath(); g2.ellipse(64, 68, 28, 36, 0, 0, TAU); g2.fill();
      g2.strokeStyle = '#0b0b0b'; g2.lineWidth = 3; for (let k = 0; k < 14; k++) ln(g2, 36 + Math.random() * 56, 36 + Math.random() * 70, 36 + Math.random() * 56, 36 + Math.random() * 70);
      aged(g2, w, h); }),
    cv(128, 160, (g2, w, h) => {                                   // endless hallway with a tiny figure
      g2.fillStyle = '#767676'; g2.fillRect(0, 0, w, h);
      g2.fillStyle = '#2a2a2a'; g2.beginPath(); g2.moveTo(0, 0); g2.lineTo(46, 58); g2.lineTo(82, 58); g2.lineTo(128, 0); g2.closePath(); g2.fill();
      g2.fillStyle = '#3d3d3d'; g2.beginPath(); g2.moveTo(0, 160); g2.lineTo(46, 102); g2.lineTo(82, 102); g2.lineTo(128, 160); g2.closePath(); g2.fill();
      g2.fillStyle = '#161616'; g2.fillRect(46, 58, 36, 44); g2.fillStyle = '#d8d8d8'; g2.fillRect(62, 78, 4, 16); g2.beginPath(); g2.arc(64, 74, 3, 0, TAU); g2.fill();
      aged(g2, w, h); }),
    cv(128, 160, (g2, w, h) => {                                   // bare tree against pale sky
      const gr = g2.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8a8a8a'); gr.addColorStop(1, '#4a4a4a'); g2.fillStyle = gr; g2.fillRect(0, 0, w, h);
      g2.strokeStyle = '#0d0d0d'; g2.lineWidth = 7; ln(g2, 64, 160, 64, 70); g2.lineWidth = 3;
      for (let k = 0; k < 9; k++) { const y = 70 + Math.random() * 60, s = Math.random() < 0.5 ? -1 : 1; ln(g2, 64, y, 64 + s * (20 + Math.random() * 40), y - 20 - Math.random() * 40); }
      aged(g2, w, h); }),
    cv(128, 160, (g2, w, h) => {                                   // a field of tiny eyes
      g2.fillStyle = '#141414'; g2.fillRect(0, 0, w, h);
      for (let k = 0; k < 26; k++) { const x = 10 + Math.random() * 108, y = 10 + Math.random() * 140; g2.fillStyle = '#d6d6d6'; g2.beginPath(); g2.ellipse(x, y, 5, 2.5, 0, 0, TAU); g2.fill(); g2.fillStyle = '#000'; g2.beginPath(); g2.arc(x, y, 1.4, 0, TAU); g2.fill(); }
      aged(g2, w, h); }),
    cv(128, 160, (g2, w, h) => {                                   // the tall one, standing in a doorway
      g2.fillStyle = '#8a8a8a'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#232323'; g2.fillRect(34, 14, 60, 146);
      g2.fillStyle = '#000'; g2.beginPath(); g2.moveTo(40, 32); g2.lineTo(88, 32); g2.lineTo(64, 44); g2.closePath(); g2.fill();
      g2.fillRect(58, 42, 12, 70); g2.fillRect(52, 54, 24, 50); g2.fillRect(57, 100, 5, 56); g2.fillRect(66, 100, 5, 56);
      g2.fillStyle = '#e6e6e6'; g2.fillRect(60, 40, 2, 2); g2.fillRect(66, 40, 2, 2); aged(g2, w, h); }),
  ];
  T.rugs = [
    cv(256, 160, (g2, w, h) => {
      g2.fillStyle = '#4a4a4a'; g2.fillRect(0, 0, w, h);
      for (let k = 0; k < 5; k++) { g2.strokeStyle = k % 2 ? '#8a8a8a' : '#222'; g2.lineWidth = 6; g2.strokeRect(10 + k * 12, 10 + k * 8, w - 20 - k * 24, h - 20 - k * 16); }
      g2.fillStyle = '#9d9d9d'; for (let k = 0; k < 5; k++) { const cx = w / 2 + (k - 2) * 30; g2.beginPath(); g2.moveTo(cx, h / 2 - 14); g2.lineTo(cx + 12, h / 2); g2.lineTo(cx, h / 2 + 14); g2.lineTo(cx - 12, h / 2); g2.fill(); }
      dots(g2, w, h, 1500, 20, 160, 0.3, 3); }),
    cv(256, 160, (g2, w, h) => {
      g2.fillStyle = '#2f2f2f'; g2.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 24) { g2.fillStyle = (x / 24) % 2 ? '#6a6a6a' : '#1c1c1c'; g2.fillRect(x, 0, 12, h); }
      g2.fillStyle = '#9a9a9a'; g2.fillRect(0, 0, w, 8); g2.fillRect(0, h - 8, w, 8); dots(g2, w, h, 1800, 10, 150, 0.3, 3); }),
    cv(256, 160, (g2, w, h) => {
      g2.fillStyle = '#383838'; g2.fillRect(0, 0, w, h); g2.strokeStyle = '#6e6e6e'; g2.lineWidth = 3; g2.strokeRect(8, 8, w - 16, h - 16);
      for (let k = 0; k < 6; k++) { g2.fillStyle = 'rgba(0,0,0,0.4)'; g2.beginPath(); g2.arc(Math.random() * w, Math.random() * h, rnd(10, 36), 0, TAU); g2.fill(); }
      dots(g2, w, h, 2500, 10, 130, 0.35, 3); }),
  ];
  const scrawl = (fn) => cv(256, 256, (g2, w, h) => { g2.clearRect(0, 0, w, h); g2.fillStyle = 'rgba(8,8,8,0.88)'; g2.strokeStyle = 'rgba(8,8,8,0.88)'; g2.lineCap = 'round'; fn(g2, w, h); });
  const drip = (g2, x, y, len) => { g2.lineWidth = 3; ln(g2, x, y, x, y + len); g2.beginPath(); g2.arc(x, y + len, 3, 0, TAU); g2.fill(); };
  T.scrawls = [
    scrawl((g2) => { g2.font = 'bold 56px "Courier New", monospace'; g2.fillText('IT SEES', 18, 100); g2.fillText('YOU', 70, 170); drip(g2, 50, 105, 40); drip(g2, 150, 106, 26); drip(g2, 120, 175, 34); }),
    scrawl((g2) => { g2.font = 'bold 50px "Courier New", monospace'; g2.fillText('LOOK', 50, 100); g2.fillText('AWAY', 50, 160); drip(g2, 90, 106, 30); }),
    scrawl((g2) => { for (let k = 0; k < 4; k++) { const x = 40 + k * 52 + Math.random() * 10, y = 70 + Math.random() * 60; g2.beginPath(); g2.ellipse(x, y + 22, 18, 22, 0, 0, TAU); g2.fill(); for (let f = 0; f < 5; f++) { g2.lineWidth = 7; ln(g2, x - 14 + f * 7, y + 8, x - 16 + f * 8, y - 14 - (f % 3) * 6); } } }),
    scrawl((g2) => { for (let k = 0; k < 6; k++) { const x = 40 + Math.random() * 176, y = 40 + Math.random() * 176; g2.fillStyle = 'rgba(210,210,210,0.85)'; g2.beginPath(); g2.ellipse(x, y, 26, 12, 0, 0, TAU); g2.fill(); g2.fillStyle = 'rgba(8,8,8,0.95)'; g2.beginPath(); g2.arc(x, y, 7, 0, TAU); g2.fill(); } }),
    scrawl((g2) => { g2.beginPath(); g2.moveTo(60, 40); g2.lineTo(196, 40); g2.lineTo(128, 66); g2.closePath(); g2.fill(); g2.beginPath(); g2.ellipse(128, 76, 16, 22, 0, 0, TAU); g2.fill(); g2.fillRect(118, 90, 20, 100); g2.fillRect(112, 100, 32, 60); g2.fillRect(115, 190, 8, 60); g2.fillRect(133, 190, 8, 60); g2.fillStyle = 'rgba(235,235,235,0.9)'; g2.fillRect(120, 72, 4, 4); g2.fillRect(132, 72, 4, 4); }),
    scrawl((g2) => { g2.lineWidth = 6; for (let gp = 0; gp < 4; gp++) { for (let k = 0; k < 4; k++) ln(g2, 30 + gp * 54 + k * 9, 60, 30 + gp * 54 + k * 9, 130); ln(g2, 24 + gp * 54, 125, 70 + gp * 54, 65); } g2.font = 'bold 40px "Courier New", monospace'; g2.fillText('NO EXIT', 40, 200); }),
  ];
  T.stain = cv(256, 256, (g2, w, h) => {
    g2.clearRect(0, 0, w, h);
    for (let k = 0; k < 9; k++) { const x = 128 + rnd(-60, 60), y = 128 + rnd(-60, 60), r = rnd(14, 52), gr = g2.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, 'rgba(5,5,5,0.85)'); gr.addColorStop(1, 'rgba(5,5,5,0)'); g2.fillStyle = gr; g2.beginPath(); g2.arc(x, y, r, 0, TAU); g2.fill(); }
  });
  T.paper = cv(64, 64, (g2, w, h) => { g2.fillStyle = '#dcdcdc'; g2.fillRect(0, 0, w, h); g2.strokeStyle = 'rgba(0,0,0,0.3)'; g2.lineWidth = 1; for (let y = 10; y < h; y += 8) ln(g2, 6, y, w - 6, y); dots(g2, w, h, 120, 100, 200, 0.4, 2); });
  T.picket = cv(512, 128, (g2, w, h) => {
    g2.clearRect(0, 0, w, h);
    for (let k = 0; k < 24; k++) {
      const x = k * (w / 24) + 1, pw = w / 24 - 3, top = 10 + (Math.random() < 0.15 ? rnd(8, 40) : 0), v = rndi(60, 110);
      g2.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g2.beginPath(); g2.moveTo(x, h); g2.lineTo(x, top + 12); g2.lineTo(x + pw / 2, top); g2.lineTo(x + pw, top + 12); g2.lineTo(x + pw, h); g2.closePath(); g2.fill();
      g2.fillStyle = 'rgba(0,0,0,0.35)'; g2.fillRect(x + pw - 3, top + 14, 3, h);
    }
    g2.fillStyle = 'rgba(0,0,0,0.5)'; g2.fillRect(0, h * 0.55, w, 8);
  });
  T.picket.wrapS = T.picket.wrapT = THREE.ClampToEdgeWrapping;
  T.sky = cv(16, 256, (g2, w, h) => {
    const gr = g2.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#000'); gr.addColorStop(0.35, '#0b0b0b'); gr.addColorStop(0.5, '#6d6d6d'); gr.addColorStop(0.62, '#262626'); gr.addColorStop(1, '#050505');
    g2.fillStyle = gr; g2.fillRect(0, 0, w, h);
  });
  T.sky.wrapS = T.sky.wrapT = THREE.ClampToEdgeWrapping;
}

/* ======================================================================
   MATERIALS · SMALL BUILDING HELPERS
   ====================================================================== */
const M = {};
function initMaterials() {
  const ph = (c, o) => new THREE.MeshPhongMaterial(Object.assign({ color: c, shininess: 5, specular: 0x0c0c0c }, o || {}));
  M.wall = ph(0xd0d0d0, { map: T.wall });
  M.fence = ph(0xbdbdbd, { map: T.fence });
  M.floor = ph(0xffffff, { map: T.floor });
  M.ceil = ph(0xdddddd, { map: T.ceil });
  M.ground = ph(0xffffff, { map: T.ground });
  M.rug = ph(0xffffff, { map: T.rug });
  M.slat = ph(0xffffff, { map: T.slat, side: THREE.DoubleSide });
  M.wood = ph(0x4a4a4a); M.dark = ph(0x1e1e1e); M.drawer = ph(0x6a6a6a); M.pillar = ph(0x9a9a9a);
  M.metal = ph(0x9a9a9a, { shininess: 40, specular: 0x666666 });
  M.rubble = ph(0x3c3c3c); M.dirt = ph(0x2a2a2a); M.sheet = ph(0xcfcfcf); M.books = ph(0x151515);
  M.tree = ph(0x1c1c1c); M.bush = ph(0x202020);
  M.win = new THREE.MeshBasicMaterial({ color: 0xa8a8a8 });
  M.black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  M.noteMats = T.noteTex.map((t) => ph(0xffffff, { map: t, emissive: 0x262626 }));
  M.paintings = T.paint.map((t) => ph(0xffffff, { map: t, emissive: 0x151515 }));
  M.frame = ph(0x2c2c2c);
  M.rugs = T.rugs.map((t) => ph(0xffffff, { map: t, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  M.scrawls = T.scrawls.map((t) => ph(0xffffff, { map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  M.stain = ph(0xffffff, { map: T.stain, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  M.paper = ph(0xe0e0e0, { map: T.paper, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  M.picket = ph(0xffffff, { map: T.picket, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  M.pot = ph(0x4d4d4d); M.stem = ph(0x1a1a1a); M.glass = ph(0x808080, { shininess: 60, specular: 0x777777, transparent: true, opacity: 0.8 });
  M.shade = ph(0x8d8d8d); M.shadeOn = new THREE.MeshBasicMaterial({ color: 0xdadada });
  M.cardboard = ph(0x6c6c6c); M.stone = ph(0x4a4a4a); M.hedge = ph(0x171717);
  M.sky = new THREE.MeshBasicMaterial({ map: T.sky, side: THREE.BackSide, fog: false, depthWrite: false });
  M.farTree = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
}

const geoCache = {};
const bgeo = (w, h, d) => { const k = w + '|' + h + '|' + d; return geoCache[k] || (geoCache[k] = new THREE.BoxGeometry(w, h, d)); };
function newGroup(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; world.add(g); return g;
}
function addBox(parent, w, h, d, x, y, z, m, o) {
  const me = new THREE.Mesh(bgeo(w, h, d), m);
  me.position.set(x, y, z);
  if (o) { if (o.ry) me.rotation.y = o.ry; if (o.rx) me.rotation.x = o.rx; if (o.rz) me.rotation.z = o.rz; }
  me.castShadow = true; me.receiveShadow = true;
  parent.add(me); return me;
}
const wallPoint = (tx, tz, i) => [(tx + 0.5) * TILE + DIRS[i].dx * TILE / 2, (tz + 0.5) * TILE + DIRS[i].dz * TILE / 2];
const faceYaw = (i) => Math.atan2(-DIRS[i].dx, -DIRS[i].dz);
function wallItem(tx, tz, i) {
  const o = wallPoint(tx, tz, i);
  return { g: newGroup(o[0], o[1], faceYaw(i)), ox: o[0], oz: o[1], fx: -DIRS[i].dx, fz: -DIRS[i].dz, i };
}
function footprint(ox, oz, fx, fz, w, dp) {
  const cx = ox + fx * dp / 2, cz = oz + fz * dp / 2;
  const ex = fx !== 0 ? dp : w, ez = fz !== 0 ? dp : w;
  addCollider(cx - ex / 2, cz - ez / 2, cx + ex / 2, cz + ez / 2);
  return { cx, cz };
}

/* ======================================================================
   FURNITURE  ·  CLOSETS (hide)  ·  DRAWERS (search)  ·  NOTES
   ====================================================================== */
const lamps = [], interactables = [], searchSpots = [], closets = [], cams = [];

function makeCloset(tx, tz, i) {
  const it = wallItem(tx, tz, i), g = it.g, W = 1.3, H = 2.3, D = 0.8;
  addBox(g, W, H, D, 0, H / 2, D / 2, M.wood);
  const dw = (W - 0.14) / 2, dz0 = D + 0.012;                       // two hinged door halves that can swing open
  const hl = new THREE.Group(); hl.position.set(-W / 2 + 0.07, 0, dz0); g.add(hl);
  const dl = new THREE.Mesh(new THREE.PlaneGeometry(dw, H - 0.3), M.slat); dl.position.set(dw / 2, H / 2, 0); hl.add(dl);
  const hr = new THREE.Group(); hr.position.set(W / 2 - 0.07, 0, dz0); g.add(hr);
  const dr = new THREE.Mesh(new THREE.PlaneGeometry(dw, H - 0.3), M.slat); dr.position.set(-dw / 2, H / 2, 0); hr.add(dr);
  addBox(hl, 0.04, 0.28, 0.04, dw - 0.02, 1.1, 0.03, M.metal); addBox(hr, 0.04, 0.28, 0.04, -dw + 0.02, 1.1, 0.03, M.metal);
  addBox(g, W + 0.06, 0.06, D + 0.04, 0, H + 0.03, D / 2, M.wood);
  const fp = footprint(it.ox, it.oz, it.fx, it.fz, W, D);
  const c = {
    kind: 'closet', id: closets.length, x: fp.cx, z: fp.cz, range: 2.5, minDot: 0.45, group: g, tx, tz,
    face: { x: it.fx, z: it.fz }, yaw: Math.atan2(-it.fx, -it.fz),
    inside: { x: fp.cx + it.fx * 0.22, z: fp.cz + it.fz * 0.22 },
    front: { x: fp.cx + it.fx * (D / 2 + 1.35), z: fp.cz + it.fz * (D / 2 + 1.35) },
    doorL: hl, doorR: hr, doorOpen: 0, doorTarget: 0, doorFast: false,
  };
  closets.push(c); interactables.push(c);
  return c;
}
function makeDresser(tx, tz, i, yardSide) {
  const it = wallItem(tx, tz, i), g = it.g, W = 1.5, H = 1.0, D = 0.55;
  addBox(g, W, H, D, 0, H / 2, D / 2, M.wood);
  addBox(g, W + 0.04, 0.05, D + 0.04, 0, H + 0.02, D / 2, M.wood);
  const fronts = [];
  for (let k = 0; k < 3; k++) {
    const y = 0.2 + k * 0.3;
    fronts.push(addBox(g, W - 0.12, 0.26, 0.04, 0, y, D + 0.02, M.drawer));
    addBox(g, 0.14, 0.03, 0.04, 0, y, D + 0.06, M.metal);
  }
  const fp = footprint(it.ox, it.oz, it.fx, it.fz, W, D);
  clutterTop(it, W, D, H + 0.045);
  const s = { kind: 'drawer', x: fp.cx, z: fp.cz, range: 2.3, minDot: 0.4, dur: 1.3, searched: false, hasKey: false, fronts, frontZ: D + 0.02, yard: !!yardSide };
  interactables.push(s); searchSpots.push(s);
  return s;
}
function makeFloorSpot(x, z, yard) {
  const g = newGroup(x, z, rnd(0, TAU));
  if (yard) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), M.dirt);
    m.scale.set(1, 0.3, 0.8); m.position.y = 0.05; m.castShadow = true; g.add(m);
    for (let k = 0; k < 4; k++) addBox(g, rnd(0.2, 0.4), 0.03, rnd(0.08, 0.14), rnd(-0.4, 0.4), 0.2 + k * 0.02, rnd(-0.3, 0.3), M.rubble, { ry: rnd(0, 3) });
  } else {
    for (let k = 0; k < 6; k++) addBox(g, rnd(0.25, 0.7), rnd(0.03, 0.09), rnd(0.12, 0.3), rnd(-0.4, 0.4), 0.05 + k * 0.025, rnd(-0.4, 0.4), M.rubble, { ry: rnd(0, 3) });
  }
  const s = { kind: 'floor', x, z, range: 1.7, minDot: 0.1, dur: 1.8, searched: false, hasKey: false, yard: !!yard };
  interactables.push(s); searchSpots.push(s);
  return s;
}
function addPillar(tx, tz) {
  const x = (tx + 0.5) * TILE, z = (tz + 0.5) * TILE, g = newGroup(x, z, 0);
  addBox(g, 0.8, WALL_H, 0.8, 0, WALL_H / 2, 0, M.pillar);
  addBox(g, 1.05, 0.25, 1.05, 0, 0.125, 0, M.wood);
  addBox(g, 1.05, 0.2, 1.05, 0, WALL_H - 0.1, 0, M.wood);
  addCollider(x - 0.52, z - 0.52, x + 0.52, z + 0.52);
}
function makeTable(x, z, quarter) {
  const ry = quarter * Math.PI / 2, g = newGroup(x, z, ry);
  addBox(g, 1.6, 0.07, 0.9, 0, 0.78, 0, M.wood);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((s) => addBox(g, 0.07, 0.76, 0.07, s[0] * 0.72, 0.38, s[1] * 0.38, M.dark));
  const r90 = (quarter % 2) !== 0, ex = r90 ? 0.9 : 1.6, ez = r90 ? 1.6 : 0.9;
  addCollider(x - ex / 2, z - ez / 2, x + ex / 2, z + ez / 2);
  return g;
}
function makeChair(x, z, ry) {
  const g = newGroup(x, z, ry);
  addBox(g, 0.5, 0.06, 0.5, 0, 0.46, 0, M.wood);
  addBox(g, 0.5, 0.55, 0.05, 0, 0.75, -0.22, M.wood);
  addBox(g, 0.06, 0.44, 0.06, -0.2, 0.22, 0.2, M.dark); addBox(g, 0.06, 0.44, 0.06, 0.2, 0.22, 0.2, M.dark);
  addBox(g, 0.06, 0.44, 0.06, -0.2, 0.22, -0.2, M.dark); addBox(g, 0.06, 0.44, 0.06, 0.2, 0.22, -0.2, M.dark);
  addCollider(x - 0.27, z - 0.27, x + 0.27, z + 0.27);
}
function makeShelf(tx, tz, i) {
  const it = wallItem(tx, tz, i), g = it.g, W = 1.6, H = 2.2, D = 0.4;
  addBox(g, W, H, D, 0, H / 2, D / 2, M.wood);
  for (let k = 0; k < 4; k++) {
    addBox(g, W - 0.08, 0.04, D - 0.04, 0, 0.4 + k * 0.5, D / 2 + 0.02, M.drawer);
    if (k < 3) addBox(g, W - 0.3, 0.28, D - 0.18, rnd(-0.1, 0.1), 0.58 + k * 0.5, D / 2 - 0.02, M.books);
  }
  footprint(it.ox, it.oz, it.fx, it.fz, W, D);
}
function makeToppled(x, z) {
  const g = newGroup(x, z, rnd(0, TAU));
  addBox(g, 1.3, 0.7, 0.6, 0, 0.5, 0, M.wood, { rz: 0.45 });
  addBox(g, 1.2, 0.05, 0.55, 0.9, 0.04, 0.3, M.drawer, { ry: 0.4 });
  addCollider(x - 0.85, z - 0.85, x + 0.85, z + 0.85);
}
function makeNote(tx, tz, i, defIdx) {
  const o = wallPoint(tx, tz, i), ry = faceYaw(i), lat = rnd(-0.6, 0.6);
  const g = newGroup(o[0], o[1], ry);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), M.noteMats[defIdx]);
  p.position.set(lat, 1.45 + rnd(-0.12, 0.2), 0.015); p.rotation.z = rnd(-0.1, 0.1); g.add(p);
  addBox(g, 0.04, 0.04, 0.02, lat, p.position.y + 0.27, 0.02, M.metal);
  interactables.push({ kind: 'note', x: o[0] + lat * Math.cos(ry), z: o[1] - lat * Math.sin(ry), range: 2.2, minDot: 0.5, def: defIdx });
}
function makeWindow(tx, tz, i) {
  const it = wallItem(tx, tz, i), g = it.g;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.1), M.win); p.position.set(0, 1.8, 0.012); g.add(p);
  const f = (w, h, x, y) => { const m = new THREE.Mesh(bgeo(w, h, 0.04), M.dark); m.position.set(x, y, 0.03); g.add(m); };
  f(0.05, 1.2, 0, 1.8); f(1.5, 0.05, 0, 1.8); f(1.5, 0.06, 0, 1.25); f(1.5, 0.06, 0, 2.35); f(0.06, 1.2, -0.72, 1.8); f(0.06, 1.2, 0.72, 1.8);
}

/* ======================================================================
   WORLD CONSTRUCTION
   ====================================================================== */
const used = new Set();
const keyOf = (x, z) => x + ',' + z;
let counterCtx = null, counterTex = null;
const laptopSpot = { x: 0, z: 0 };
let GATE_POS = { x: 0, z: 0 };

const lightGroups = {}, lightGroupList = [];
function lightGroupKey(x, z, y) {
  const tx = tileOf(x), tz = tileOf(z);
  if (y > 3.5 && tx >= HOUSE_W) return 'y' + lamps.length;            // every garden lamp post is on its own
  if (inB(tx, tz) && zone[idx(tx, tz)] === 1) return 'safe';           // the safe room never goes dark
  const rid = inB(tx, tz) ? roomId[idx(tx, tz)] : -1;
  if (rid >= 0) return 'r' + rid;                                      // a furnished room is one circuit
  return 'c' + Math.floor(tx / 6) + '_' + Math.floor(tz / 6);          // corridors: one circuit per 6x6 tiles
}
function addLamp(x, z, y, power, flick, fs) {
  const key = lightGroupKey(x, z, y);
  let grp = lightGroups[key];
  if (!grp) { grp = lightGroups[key] = { key, lamps: [], state: 'on', t: 0, dur: 0, k: 1, ph: Math.random() * TAU, safe: key === 'safe', thunked: false }; lightGroupList.push(grp); }
  const L = { x, z, y, power, flick: !!flick, ph: Math.random() * TAU, _d: 0, group: grp, vis: true, idx: lamps.length, fs: fs || 1 };
  lamps.push(L); grp.lamps.push(L);
}

function mergeGeos(list) {
  const pos = [], nor = [], uvs = [], ind = [];
  let off = 0;
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  list.forEach((it) => {
    const gg = it.geo, p = gg.attributes.position, nn = gg.attributes.normal, uv = gg.attributes.uv;
    nm.getNormalMatrix(it.matrix);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(it.matrix); pos.push(v.x, v.y, v.z);
      n.fromBufferAttribute(nn, i).applyMatrix3(nm).normalize(); nor.push(n.x, n.y, n.z);
      if (uv) uvs.push(uv.getX(i), uv.getY(i)); else uvs.push(0, 0);
    }
    if (gg.index) for (let i = 0; i < gg.index.count; i++) ind.push(gg.index.getX(i) + off);
    else for (let i = 0; i < p.count; i++) ind.push(i + off);
    off += p.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  out.setIndex(ind);
  return out;
}
function makeTreeGeo(variant) {
  const parts = [], tall = variant === 0, th = tall ? 4.4 : 2.9;
  const trunk = new THREE.CylinderGeometry(tall ? 0.09 : 0.15, tall ? 0.3 : 0.4, th, 7); trunk.translate(0, th / 2, 0);
  parts.push({ geo: trunk, matrix: new THREE.Matrix4() });
  for (let k = 0; k < 4; k++) {                                   // roots
    const r = new THREE.CylinderGeometry(0.03, 0.12, 0.9, 5); r.translate(0, 0.45, 0);
    const m = new THREE.Matrix4().makeRotationY(k * 1.57 + rnd(-0.4, 0.4)).multiply(new THREE.Matrix4().makeRotationZ(1.25));
    m.setPosition(0, 0.1, 0); parts.push({ geo: r, matrix: m });
  }
  const branch = (base, yaw, tilt, len, r0, depth) => {
    const geo = new THREE.CylinderGeometry(r0 * 0.4, r0, len, 5); geo.translate(0, len / 2, 0);
    const m = new THREE.Matrix4().makeRotationY(yaw).multiply(new THREE.Matrix4().makeRotationZ(tilt));
    m.setPosition(base.x, base.y, base.z);
    parts.push({ geo, matrix: m });
    if (depth > 0) {
      for (let k = 0; k < 2; k++) {
        const tip = new THREE.Vector3(0, len * rnd(0.4, 0.95), 0).applyMatrix4(m);
        branch(tip, yaw + rnd(-1.8, 1.8), tilt + rnd(-0.5, 0.9), len * rnd(0.45, 0.7), r0 * 0.5, depth - 1);
      }
    }
  };
  const n = tall ? 9 : 11;
  for (let k = 0; k < n; k++) branch(new THREE.Vector3(0, th * rnd(0.4, 0.95), 0), rnd(0, TAU), rnd(0.5, 1.2), rnd(1.2, tall ? 2.4 : 2.0), tall ? 0.08 : 0.1, 1);
  return mergeGeos(parts);
}

function buildStructure() {
  [[3, 0, HOUSE_W * TILE, MH * TILE], [0, 0, 3, 6], [0, 9, 3, MH * TILE]].forEach((r) => addFloorPlane(r[0], r[1], r[2], r[3], 0, M.floor, 2.5));   // (with a hole for the stairwell)
  const yw = (MW - HOUSE_W) * TILE;
  const gg = new THREE.PlaneGeometry(yw, MH * TILE); gg.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(gg, M.ground); ground.position.set(HOUSE_W * TILE + yw / 2, 0, MH * TILE / 2); ground.receiveShadow = true; world.add(ground);
  const cg = new THREE.PlaneGeometry(HOUSE_W * TILE, MH * TILE); cg.rotateX(Math.PI / 2);
  const ceil = new THREE.Mesh(cg, M.ceil); ceil.position.set(HOUSE_W * TILE / 2, WALL_H, MH * TILE / 2); world.add(ceil);

  // wall tiles (only those that touch walkable space) as instanced boxes
  const wl = [], fl = [];
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    if (grid[idx(x, z)] !== 1) continue;
    let adj = false;
    for (let dz = -1; dz <= 1 && !adj; dz++) for (let dx = -1; dx <= 1; dx++) { if (inB(x + dx, z + dz) && grid[idx(x + dx, z + dz)] === 0) { adj = true; break; } }
    if (adj) (x >= HOUSE_W ? fl : wl).push([x, z]);
  }
  const inst = (list, mat, h) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE, h, TILE), mat, list.length), d = new THREE.Object3D();
    list.forEach((p, i) => { d.position.set((p[0] + 0.5) * TILE, h / 2, (p[1] + 0.5) * TILE); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
    world.add(im);
  };
  inst(wl, M.wall, WALL_H); inst(fl, M.fence, 3.0);

  // door lintels
  const lintel = (tx, tz) => addBox(world, TILE, 0.9, TILE, (tx + 0.5) * TILE, WALL_H - 0.45, (tz + 0.5) * TILE, M.wall);
  lintel(DOOR.x, DOOR.z);
  YARD_DOORS.forEach((z) => lintel(HOUSE_W - 1, z));

  // windows along the east wall (cold light from outside)
  for (let z = 1; z < MH - 1; z += 2) {
    if (zone[idx(HOUSE_W - 2, z)] === 0 && grid[idx(HOUSE_W - 2, z)] === 0 && solid(HOUSE_W - 1, z) && Math.random() < 0.5) {
      makeWindow(HOUSE_W - 2, z, 1); used.add(keyOf(HOUSE_W - 2, z));
    }
  }
}

function buildSafeRoom() {
  const rg = new THREE.PlaneGeometry(6, 4); rg.rotateX(-Math.PI / 2);
  const rug = new THREE.Mesh(rg, M.rug); rug.position.set(10.5, 0.012, 8.2); world.add(rug);
  addLamp(10.5, 7.8, WALL_H - 0.05, 2.0, false);

  // desk with the security laptop against the north wall
  const it = wallItem(3, 1, 0), g = it.g;
  addBox(g, 1.9, 0.07, 0.9, 0, 0.78, 0.5, M.wood);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((s) => addBox(g, 0.07, 0.76, 0.07, s[0] * 0.88, 0.38, 0.5 + s[1] * 0.38, M.dark));
  footprint(it.ox, it.oz, it.fx, it.fz, 1.9, 0.95);
  addBox(g, 0.5, 0.03, 0.34, 0, 0.83, 0.58, M.dark);
  const scr = new THREE.Group(); scr.position.set(0, 0.85, 0.42); scr.rotation.x = -0.25; g.add(scr);
  addBox(scr, 0.5, 0.34, 0.02, 0, 0.17, 0, M.dark);
  const st = canvasTex(256, 160, (c, w, h) => {
    c.fillStyle = '#0b0b0b'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8e8e8'; c.font = 'bold 22px "Courier New", monospace';
    c.fillText('SEC-CAM  v1.3', 20, 36); c.font = '16px "Courier New", monospace';
    c.fillText('10 FEEDS ONLINE', 20, 66); c.fillText('SIGNAL: POOR', 20, 90); c.fillText('> OPEN', 20, 130);
    c.strokeStyle = '#888'; c.strokeRect(6, 6, w - 12, h - 12);
  });
  st.wrapS = st.wrapT = THREE.ClampToEdgeWrapping; st.repeat.set(1, 1);
  laptopScreen.idleTex = st; laptopScreen.mat = new THREE.MeshBasicMaterial({ map: st });
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.28), laptopScreen.mat); sp.position.set(0, 0.17, 0.012); scr.add(sp);
  laptopScreen.pose = { x: it.ox, y: 1.154, z: it.oz + 0.923, yaw: 0, pitch: -0.25, fov: 38 };
  laptopSpot.x = it.ox; laptopSpot.z = it.oz + 1.45;
  interactables.push({ kind: 'laptop', x: laptopSpot.x, z: laptopSpot.z, range: 1.9, minDot: 0.3 });

  // wall HUD counter
  const cc = document.createElement('canvas'); cc.width = 512; cc.height = 192;
  counterCtx = cc.getContext('2d'); counterTex = new THREE.CanvasTexture(cc);
  const cp = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshBasicMaterial({ map: counterTex }));
  cp.position.set(0, 2.15, 0.02); g.add(cp);
  drawCounter();

  // chair, bed, crates
  makeChair(10.5, 5.15, Math.PI);
  const bed = newGroup(4.5, 10.4, 0);
  addBox(bed, 1.2, 0.3, 2.1, 0, 0.2, 0, M.wood); addBox(bed, 1.1, 0.2, 2.0, 0, 0.45, 0, M.sheet); addBox(bed, 0.7, 0.12, 0.35, 0, 0.62, -0.75, M.sheet);
  addCollider(3.9, 9.35, 5.1, 11.45);
  const c1 = newGroup(16.4, 4.0, 0.3); addBox(c1, 0.9, 0.9, 0.9, 0, 0.45, 0, M.wood); addCollider(15.85, 3.45, 16.95, 4.55);
  const c2 = newGroup(16.9, 5.2, 0.1); addBox(c2, 0.6, 0.6, 0.6, 0, 0.3, 0, M.drawer); addCollider(16.55, 4.9, 17.25, 5.5);
  buildExitDoor();
}

function buildRooms() {
  rooms.forEach((r) => {
    const big = (r.x1 - r.x0 + 1) * (r.z1 - r.z0 + 1) > 22;
    const pil = new Set();
    for (let z = r.z0 + 1; z <= r.z1 - 1; z += 2) for (let x = r.x0 + 1; x <= r.x1 - 1; x += 2) { addPillar(x, z); pil.add(keyOf(x, z)); }
    addLamp(r.cxw, r.czw, WALL_H - 0.05, 1.3, true);
    if (big) { addLamp(r.cxw - 6, r.czw, WALL_H - 0.05, 1.2, true); addLamp(r.cxw + 6, r.czw, WALL_H - 0.05, 1.2, false); }

    const cand = [];
    for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) for (let i = 0; i < 4; i++) {
      if (solid(x + DX[i], z + DZ[i])) cand.push({ x, z, i, done: false });
    }
    shuffle(cand);
    const take = (n, fn) => {
      let c = 0;
      for (let k = 0; k < cand.length && c < n; k++) {
        const t = cand[k];
        if (t.done || used.has(keyOf(t.x, t.z))) continue;
        used.add(keyOf(t.x, t.z)); t.done = true; fn(t); c++;
      }
    };
    take(big ? 3 : 2, (t) => makeCloset(t.x, t.z, t.i));
    take(2, (t) => makeDresser(t.x, t.z, t.i, false));
    take(2, (t) => makeShelf(t.x, t.z, t.i));

    const free = [];
    for (let z = r.z0 + 1; z <= r.z1 - 1; z++) for (let x = r.x0 + 1; x <= r.x1 - 1; x++) if (!pil.has(keyOf(x, z))) free.push({ x, z });
    shuffle(free);
    const tables = big ? 3 : 2;
    for (let k = 0; k < tables && free.length > 2; k++) {
      const f = free.pop(), cx = (f.x + 0.5) * TILE, cz = (f.z + 0.5) * TILE;
      makeTable(cx, cz, rndi(0, 3));
      makeChair(cx + (Math.random() < 0.5 ? -1 : 1) * 1.05, cz + rnd(-0.5, 0.5), rnd(0, TAU));
    }
    if (free.length) { const f = free.pop(); makeToppled((f.x + 0.5) * TILE, (f.z + 0.5) * TILE); }
    if (free.length) { const f = free.pop(); makeFloorSpot((f.x + 0.5) * TILE + rnd(-0.6, 0.6), (f.z + 0.5) * TILE + rnd(-0.6, 0.6), false); }
  });
}

function buildCorridorItems() {
  shuffle(deadEnds).forEach((de) => {
    const wd = (de.dir + 2) % 4, roll = Math.random();
    used.add(keyOf(de.x, de.z));
    if (roll < 0.4) makeCloset(de.x, de.z, wd);
    else if (roll < 0.78) makeDresser(de.x, de.z, wd, false);
    else makeFloorSpot((de.x + 0.5) * TILE + rnd(-0.6, 0.6), (de.z + 0.5) * TILE + rnd(-0.6, 0.6), false);
  });
  // sheds + workbenches against the back of the house
  [5, 13, 23].forEach((z) => { used.add(keyOf(HOUSE_W, z)); makeCloset(HOUSE_W, z, 3); });
  [3, 25].forEach((z) => { used.add(keyOf(HOUSE_W, z)); makeDresser(HOUSE_W, z, 3, true); });

  // corridor lamps: sparse, so there are dark gaps between pools of light
  addLamp(22.5, 10.5, WALL_H - 0.05, 1.3, false);
  openTiles.forEach((t) => {
    if (t.x >= HOUSE_W || zone[idx(t.x, t.z)] !== 0 || hash2(t.x, t.z) > 0.2) return;
    const wx = (t.x + 0.5) * TILE, wz = (t.z + 0.5) * TILE;
    if (lamps.some((L) => Math.hypot(L.x - wx, L.z - wz) < 5.5)) return;
    addLamp(wx, wz, WALL_H - 0.05, 1.15, hash2(t.z, t.x) < 0.3);
  });
}

function buildNotes() {
  const cands = [];
  openTiles.forEach((t) => {
    if (used.has(keyOf(t.x, t.z))) return;
    for (let i = 0; i < 4; i++) if (solid(t.x + DX[i], t.z + DZ[i])) cands.push({ x: t.x, z: t.z, i });
  });
  shuffle(cands);
  const seen = new Set();
  let n = 0;
  for (let k = 0; k < cands.length && n < 28; k++) {
    const c = cands[k], key = keyOf(c.x, c.z);
    if (seen.has(key)) continue;
    seen.add(key); wallDeco.add(c.x + ',' + c.z + ',' + c.i); makeNote(c.x, c.z, c.i, n % NOTE_DEFS.length); n++;
  }
}

function buildYard() {
  const x0 = (HOUSE_W + 1.5) * TILE, x1 = (MW - 1.5) * TILE, z0 = 2 * TILE, z1 = (MH - 2) * TILE;
  GATE_POS = { x: (MW - 1) * TILE, z: (GATE_TZ + 0.5) * TILE };
  const posts = [[34, 6], [34, 24], [41, 10], [41, 20], [47, 6], [47, 24], [49, 15]];
  const clear = [];
  YARD_DOORS.forEach((z) => clear.push({ x: (HOUSE_W + 1) * TILE, z: (z + 0.5) * TILE, r: 6 }));
  [5, 13, 23, 3, 25].forEach((z) => clear.push({ x: (HOUSE_W + 1) * TILE, z: (z + 0.5) * TILE, r: 3.6 }));
  clear.push({ x: GATE_POS.x - 3, z: GATE_POS.z, r: 6 });
  posts.forEach((p) => clear.push({ x: (p[0] + 0.5) * TILE, z: (p[1] + 0.5) * TILE, r: 3 }));

  // dead trees (one merged geometry, instanced)
  const pts = [];
  for (let tries = 0; pts.length < 44 && tries < 800; tries++) {
    const x = rnd(x0, x1), z = rnd(z0, z1);
    if (clear.some((c) => Math.hypot(c.x - x, c.z - z) < c.r)) continue;
    if (pts.some((p) => Math.hypot(p.x - x, p.z - z) < 5)) continue;
    pts.push({ x, z, s: rnd(0.85, 1.35) });
  }
  const d = new THREE.Object3D();
  [0, 1].forEach((variant) => {
    const sub = pts.filter((p, k) => (k % 3 === 2) === (variant === 1));
    const trees = new THREE.InstancedMesh(makeTreeGeo(variant), M.tree, Math.max(1, sub.length));
    sub.forEach((p, i) => {
      d.position.set(p.x, 0, p.z); d.rotation.set(0, rnd(0, TAU), 0); d.scale.set(p.s, p.s, p.s); d.updateMatrix();
      trees.setMatrixAt(i, d.matrix);
      addCollider(p.x - 0.3 * p.s, p.z - 0.3 * p.s, p.x + 0.3 * p.s, p.z + 0.3 * p.s);
    });
    trees.count = sub.length; trees.frustumCulled = false; trees.castShadow = true; trees.receiveShadow = true; world.add(trees);
  });

  // shrubs
  const bp = [];
  for (let tries = 0; bp.length < 34 && tries < 400; tries++) {
    const x = rnd(x0, x1), z = rnd(z0, z1);
    if (clear.some((c) => Math.hypot(c.x - x, c.z - z) < c.r)) continue;
    bp.push({ x, z, s: rnd(0.7, 1.3) });
  }
  const bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.9, 0), M.bush, Math.max(1, bp.length));
  bp.forEach((p, i) => {
    d.position.set(p.x, 0.35, p.z); d.rotation.set(0, rnd(0, TAU), 0); d.scale.set(p.s, p.s * 0.7, p.s); d.updateMatrix();
    bushes.setMatrixAt(i, d.matrix);
    addCollider(p.x - 0.5 * p.s, p.z - 0.5 * p.s, p.x + 0.5 * p.s, p.z + 0.5 * p.s);
  });
  bushes.count = bp.length; bushes.frustumCulled = false; bushes.castShadow = true; world.add(bushes);

  // lamp posts
  posts.forEach((p) => {
    const x = (p[0] + 0.5) * TILE, z = (p[1] + 0.5) * TILE, g = newGroup(x, z, 0);
    addBox(g, 0.12, 3.6, 0.12, 0, 1.8, 0, M.dark);
    addBox(g, 0.7, 0.1, 0.7, 0, 3.62, 0, M.dark);
    addCollider(x - 0.12, z - 0.12, x + 0.12, z + 0.12);
    addLamp(x, z, 3.55, 1.5, Math.random() < 0.4);
  });

  // buried things
  for (let k = 0, tries = 0; k < 5 && tries < 200; tries++) {
    const x = rnd(x0, x1 - 6), z = rnd(z0, z1);
    if (clear.some((c) => Math.hypot(c.x - x, c.z - z) < c.r)) continue;
    if (pts.some((p) => Math.hypot(p.x - x, p.z - z) < 2)) continue;
    makeFloorSpot(x, z, true); k++;
  }

  // the locked escape gate
  const gg = newGroup(GATE_POS.x - 0.15, GATE_POS.z, -Math.PI / 2);
  addBox(gg, 0.25, 3.2, 0.25, -1.2, 1.6, 0, M.metal); addBox(gg, 0.25, 3.2, 0.25, 1.2, 1.6, 0, M.metal); addBox(gg, 2.65, 0.2, 0.25, 0, 3.2, 0, M.metal);
  for (let k = 0; k < 12; k++) addBox(gg, 0.05, 2.9, 0.05, -1.0 + k * 0.18, 1.5, 0, M.dark);
  [0.5, 1.6, 2.6].forEach((y) => addBox(gg, 2.3, 0.07, 0.07, 0, y, 0.03, M.metal));
  addBox(gg, 0.3, 0.34, 0.12, 0, 1.6, 0.12, M.metal);
  interactables.push({ kind: 'gate', x: GATE_POS.x - 1.4, z: GATE_POS.z, range: 2.5, minDot: 0.35 });
}

function assignKeys() {
  searchSpots.forEach((s) => { s.hasKey = false; s.searched = false; if (s.fronts) s.fronts.forEach((f) => { f.position.z = s.frontZ; }); });
  const indoor = shuffle(searchSpots.filter((s) => !s.yard && Math.hypot(s.x - 10.5, s.z - 7.5) > 20));
  const yard = shuffle(searchSpots.filter((s) => s.yard));
  const chosen = [];
  indoor.forEach((s) => { if (chosen.length < TOTAL_KEYS - 1 && chosen.every((c) => Math.hypot(c.x - s.x, c.z - s.z) > 24)) chosen.push(s); });
  indoor.forEach((s) => { if (chosen.length < TOTAL_KEYS - 1 && chosen.indexOf(s) < 0) chosen.push(s); });
  if (yard.length) chosen.push(yard[0]);
  shuffle(searchSpots.slice()).forEach((s) => { if (chosen.length < TOTAL_KEYS && chosen.indexOf(s) < 0) chosen.push(s); });
  if (S.act === 1) chosen.forEach((s) => { s.hasKey = true; });          // keys only exist in act 1
}

let lampFix = null, lampDec = null;
const lampDummy = new THREE.Object3D();
function writeLamp(L) {
  const v = L.vis ? 1 : 0.0001;
  lampDummy.position.set(L.x, L.y, L.z); lampDummy.rotation.set(0, 0, 0); lampDummy.scale.set(v * L.fs, v * L.fs, v * L.fs); lampDummy.updateMatrix();
  lampFix.setMatrixAt(L.idx, lampDummy.matrix);
  const r = (L.y > 3.5 ? 10 : 7) * v * (L.fs < 1 ? 0.45 : 1);
  lampDummy.position.set(L.x, 0.02, L.z); lampDummy.scale.set(r, v, r); lampDummy.updateMatrix();
  lampDec.setMatrixAt(L.idx, lampDummy.matrix);
}
function syncLampMeshes() {
  let changed = false;
  for (let i = 0; i < lamps.length; i++) {
    const L = lamps[i], v = L.group.k > 0.5;
    if (v !== L.vis) { L.vis = v; writeLamp(L); changed = true; }
  }
  if (changed) { lampFix.instanceMatrix.needsUpdate = true; lampDec.instanceMatrix.needsUpdate = true; }
}
function buildLampMeshes() {
  const n = Math.max(1, lamps.length);
  lampFix = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), n);
  const pg = new THREE.PlaneGeometry(1, 1); pg.rotateX(-Math.PI / 2);
  lampDec = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ map: T.glow, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }), n);
  lamps.forEach(writeLamp);
  lampFix.instanceMatrix.needsUpdate = true; lampDec.instanceMatrix.needsUpdate = true;
  lampFix.count = lamps.length; lampDec.count = lamps.length;
  lampFix.frustumCulled = false; lampDec.frustumCulled = false;
  world.add(lampFix); world.add(lampDec);
}

function drawCounter() {
  if (!counterCtx) return;
  const g = counterCtx, w = 512, h = 192;
  g.fillStyle = '#050505'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#dcdcdc'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = '#dcdcdc'; g.font = '28px "Courier New", monospace'; g.fillText('KEYS FOUND', 24, 48);
  g.font = 'bold 96px "Courier New", monospace'; g.fillText(S.keys + ' / ' + TOTAL_KEYS, 120, 150);
  counterTex.needsUpdate = true;
}

/* ======================================================================
   DECOR  —  frames, rugs, lamps, fallen furniture, plants, clutter, fences, hedges, stones…
   Everything is batched (merged per material + 24-unit chunk) so hundreds of props stay cheap.
   ====================================================================== */
const UB = new THREE.BoxGeometry(1, 1, 1), UP = new THREE.PlaneGeometry(1, 1);
const cgeoCache = {};
const cgeo = (rt, rb, h, seg) => { const k = rt + '|' + rb + '|' + h + '|' + seg; return cgeoCache[k] || (cgeoCache[k] = new THREE.CylinderGeometry(rt, rb, h, seg || 8)); };
const decoCast = new Map(), decoNoCast = new Map();
const _E = new THREE.Euler(), _Q = new THREE.Quaternion(), _V = new THREE.Vector3(), _S = new THREE.Vector3(), _L = new THREE.Matrix4();
const wallDeco = new Set();
let decoParts = 0;
function decoClear(x, z, r) {
  for (let i = 0; i < searchSpots.length; i++) if (Math.hypot(searchSpots[i].x - x, searchSpots[i].z - z) < r) return false;
  for (let i = 0; i < closets.length; i++) if (Math.hypot(closets[i].front.x - x, closets[i].front.z - z) < r) return false;
  return Math.hypot(laptopSpot.x - x, laptopSpot.z - z) > r;
}

function baseM(x, y, z, ry, rx, rz) {
  _E.set(rx || 0, ry || 0, rz || 0, 'YXZ'); _Q.setFromEuler(_E); _V.set(x, y, z); _S.set(1, 1, 1);
  return new THREE.Matrix4().compose(_V, _Q, _S);
}
function decoPart(pm, geo, mat, ox, oy, oz, rx, ry, rz, sx, sy, sz, noCast) {
  _E.set(rx || 0, ry || 0, rz || 0, 'YXZ'); _Q.setFromEuler(_E); _V.set(ox, oy, oz);
  _S.set(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz);
  _L.compose(_V, _Q, _S);
  const m = new THREE.Matrix4().multiplyMatrices(pm, _L);
  decoParts++;
  const map = noCast ? decoNoCast : decoCast;
  let byMat = map.get(mat);
  if (!byMat) { byMat = new Map(); map.set(mat, byMat); }
  const key = Math.floor(m.elements[12] / 24) * 100 + Math.floor(m.elements[14] / 24);
  let arr = byMat.get(key);
  if (!arr) { arr = []; byMat.set(key, arr); }
  arr.push({ geo, matrix: m });
}
const dBox = (pm, mat, ox, oy, oz, sx, sy, sz, rx, ry, rz, noCast) => decoPart(pm, UB, mat, ox, oy, oz, rx, ry, rz, sx, sy, sz, noCast);
function flushDeco() {
  [[decoCast, true], [decoNoCast, false]].forEach((pair) => {
    pair[0].forEach((byMat, mat) => byMat.forEach((items) => {
      const mesh = new THREE.Mesh(mergeGeos(items), mat);
      mesh.castShadow = pair[1]; mesh.receiveShadow = true; mesh.userData.deco = true;
      world.add(mesh);
    }));
  });
  decoCast.clear(); decoNoCast.clear();
}
const sidePos = (tx, tz, i, dist) => [(tx + 0.5) * TILE + DIRS[i].dx * (TILE / 2 - dist), (tz + 0.5) * TILE + DIRS[i].dz * (TILE / 2 - dist)];

/* ---------- wall dressing ---------- */
function wallLocal(tx, tz, i, lat, outward) {
  const o = wallPoint(tx, tz, i), ry = faceYaw(i);
  return { ry, x: o[0] + Math.cos(ry) * lat - DIRS[i].dx * outward, z: o[1] - Math.sin(ry) * lat - DIRS[i].dz * outward };
}
function addFrame(tx, tz, i, photo) {
  const w0 = wallLocal(tx, tz, i, rnd(-0.75, 0.75), 0.035), cy = rnd(1.45, 1.95);
  let w = rnd(0.5, 0.95), h = w * rnd(1.15, 1.45);
  const t = 0.05;
  if (photo) { w = photo.aspect >= 1 ? rnd(0.75, 1.15) : rnd(0.5, 0.8); h = w / photo.aspect; }   // frame fits the picture, whatever its ratio
  const tilt = Math.random() < 0.3 ? rnd(-0.3, 0.3) : rnd(-0.03, 0.03);
  const pm = baseM(w0.x, cy, w0.z, w0.ry, 0, tilt);
  decoPart(pm, UP, photo ? photo.mat : M.paintings[rndi(0, M.paintings.length - 1)], 0, 0, 0.012, 0, 0, 0, w, h, 1, true);
  dBox(pm, M.frame, 0, h / 2 + t / 2, 0, w + 2 * t, t, 0.04, 0, 0, 0, true);
  dBox(pm, M.frame, 0, -h / 2 - t / 2, 0, w + 2 * t, t, 0.04, 0, 0, 0, true);
  dBox(pm, M.frame, -w / 2 - t / 2, 0, 0, t, h, 0.04, 0, 0, 0, true);
  dBox(pm, M.frame, w / 2 + t / 2, 0, 0, t, h, 0.04, 0, 0, 0, true);
}
function addScrawl(tx, tz, i) {
  const w0 = wallLocal(tx, tz, i, rnd(-0.5, 0.5), 0.012), s = rnd(1.0, 1.7);
  decoPart(baseM(w0.x, rnd(1.3, 1.9), w0.z, w0.ry, 0, rnd(-0.1, 0.1)), UP, M.scrawls[rndi(0, M.scrawls.length - 1)], 0, 0, 0, 0, 0, 0, s, s, 1, true);
}
function addPilaster(tx, tz, i, lat) {
  const w0 = wallLocal(tx, tz, i, lat, 0.14), pm = baseM(w0.x, 0, w0.z, w0.ry);
  if (!decoClear(w0.x, w0.z, 1.3)) return;
  dBox(pm, M.pillar, 0, WALL_H / 2, 0, 0.42, WALL_H, 0.28);
  dBox(pm, M.wood, 0, 0.12, 0, 0.52, 0.24, 0.34); dBox(pm, M.wood, 0, WALL_H - 0.1, 0, 0.52, 0.2, 0.34);
  addCollider(w0.x - 0.28, w0.z - 0.28, w0.x + 0.28, w0.z + 0.28);
}

/* ---------- floor dressing ---------- */
function addRug(x, z, ry, w, h) {
  decoPart(baseM(x, 0.013, z, ry, -Math.PI / 2, 0), UP, M.rugs[rndi(0, M.rugs.length - 1)], 0, 0, 0, 0, 0, 0, w, h, 1, true);
}
function litterPaper(x, z) { decoPart(baseM(x, 0.012, z, rnd(0, TAU), -Math.PI / 2, 0), UP, M.paper, 0, 0, 0, 0, 0, 0, rnd(0.18, 0.3), rnd(0.24, 0.36), 1, true); }
function floorStain(x, z, s) { decoPart(baseM(x, 0.011, z, rnd(0, TAU), -Math.PI / 2, 0), UP, M.stain, 0, 0, 0, 0, 0, 0, s, s, 1, true); }

/* ---------- furniture states ---------- */
function chairParts(pm) {
  dBox(pm, M.wood, 0, 0.46, 0, 0.5, 0.06, 0.5); dBox(pm, M.wood, 0, 0.75, -0.22, 0.5, 0.55, 0.05);
  [[-0.2, 0.2], [0.2, 0.2], [-0.2, -0.2], [0.2, -0.2]].forEach((p) => dBox(pm, M.dark, p[0], 0.22, p[1], 0.06, 0.44, 0.06));
}
function fallenChair(x, z) {
  if (!decoClear(x, z, 1.5)) return;
  chairParts(baseM(x, 0.25, z, rnd(0, TAU), 0, Math.PI / 2 + rnd(-0.15, 0.15)));
  addCollider(x - 0.5, z - 0.5, x + 0.5, z + 0.5);
}
function overturnedTable(x, z) {
  if (!decoClear(x, z, 2.0)) return;
  const pm = baseM(x, 0.82, z, rnd(0, TAU), Math.PI + rnd(-0.12, 0.12), 0);
  dBox(pm, M.wood, 0, 0.78, 0, 1.6, 0.07, 0.9);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((s) => dBox(pm, M.dark, s[0] * 0.72, 0.38, s[1] * 0.38, 0.07, 0.76, 0.07));
  dBox(baseM(x + rnd(-0.4, 0.4), 0.02, z + rnd(0.6, 1.0), rnd(0, 3)), M.drawer, 0, 0.02, 0, 0.5, 0.04, 0.3, 0, 0, 0, true);
  addCollider(x - 0.9, z - 0.9, x + 0.9, z + 0.9);
}
function floorLamp(x, z, lit) {
  if (!decoClear(x, z, 1.4)) return;
  const pm = baseM(x, 0, z, 0);
  dBox(pm, M.dark, 0, 0.03, 0, 0.32, 0.06, 0.32);
  decoPart(pm, cgeo(0.018, 0.018, 1.5, 6), M.dark, 0, 0.78, 0);
  decoPart(pm, cgeo(0.14, 0.22, 0.32, 10), lit ? M.shadeOn : M.shade, 0, 1.58, 0);
  addCollider(x - 0.2, z - 0.2, x + 0.2, z + 0.2);
  if (lit) addLamp(x, z, 1.5, 0.8, true, 0.3);
}
function deadPlant(x, z, tipped) {
  if (!decoClear(x, z, 1.4)) return;
  const ry = rnd(0, TAU);
  const pm = tipped ? baseM(x, 0.2, z, ry, 0, Math.PI / 2 - 0.1) : baseM(x, 0, z, ry);
  decoPart(pm, cgeo(0.2, 0.15, 0.32, 10), M.pot, 0, 0.16, 0);
  decoPart(pm, cgeo(0.18, 0.18, 0.03, 10), M.dirt, 0, 0.31, 0);
  for (let k = 0; k < 7; k++) {
    const len = rnd(0.45, 1.1), t = rnd(0.15, 0.75), ph = rnd(0, TAU);
    const dx = -Math.sin(t) * Math.cos(ph), dy = Math.cos(t), dz = Math.sin(t) * Math.sin(ph);
    decoPart(pm, cgeo(0.008, 0.014, len, 4), M.stem, dx * len / 2, 0.3 + dy * len / 2, dz * len / 2, 0, ph, t);
    if (k % 2 === 0) decoPart(pm, UP, M.stem, dx * len, 0.3 + dy * len, dz * len, rnd(-1, 1), rnd(0, 3), rnd(-1, 1), 0.1, 0.18, 1);
  }
  if (tipped) decoPart(baseM(x + 0.25, 0.006, z, rnd(0, 3)), cgeo(0.3, 0.3, 0.012, 10), M.dirt, 0, 0, 0, 0, 0, 0, 1, 1, 1, true);
  addCollider(x - 0.25, z - 0.25, x + 0.25, z + 0.25);
}
function carton(x, z) {
  if (!decoClear(x, z, 1.4)) return;
  const ry = rnd(0, 3), pm = baseM(x, 0, z, ry);
  dBox(pm, M.cardboard, 0, 0.25, 0, 0.55, 0.5, 0.5); dBox(pm, M.cardboard, 0.05, 0.62, 0.03, 0.46, 0.24, 0.42, 0, rnd(-0.3, 0.3), 0);
  addCollider(x - 0.4, z - 0.4, x + 0.4, z + 0.4);
}
// cluttered drawer / table tops
function clutterTop(it, W, D, topY) {
  const ry = faceYaw(it.i), pm = baseM(it.ox, topY, it.oz, ry);
  const pick3 = shuffle([0, 1, 2, 3, 4]).slice(0, 3);
  pick3.forEach((k) => {
    if (k === 0) for (let b = 0; b < 3; b++) dBox(pm, M.books, -W / 2 + 0.3, 0.02 + b * 0.04, D * 0.5, 0.24, 0.04, 0.32, 0, rnd(-0.3, 0.3), 0, true);
    else if (k === 1) decoPart(pm, cgeo(0.035, 0.035, 0.26, 8), M.glass, W / 2 - 0.35, 0.13, D * 0.45, 0, 0, 0, 1, 1, 1, true);
    else if (k === 2) { decoPart(pm, cgeo(0.05, 0.06, 0.05, 8), M.metal, 0.05, 0.025, D * 0.4, 0, 0, 0, 1, 1, 1, true); decoPart(pm, cgeo(0.016, 0.016, 0.16, 6), M.sheet, 0.05, 0.13, D * 0.4, 0, 0, 0, 1, 1, 1, true); }
    else if (k === 3) dBox(pm, M.paper, -0.1, 0.012, D * 0.55, 0.28, 0.02, 0.2, 0, rnd(-0.5, 0.5), 0, true);
    else dBox(pm, M.frame, W / 2 - 0.12, 0.12, D * 0.4, 0.2, 0.24, 0.02, -0.15, rnd(-0.4, 0.2), 0, true);
  });
}

/* ---------- indoor decoration pass ---------- */
function wallFaces() {
  const out = [];
  openTiles.forEach((t) => {
    if (t.x >= HOUSE_W || used.has(keyOf(t.x, t.z))) return;
    for (let i = 0; i < 4; i++) if (solid(t.x + DX[i], t.z + DZ[i]) && !wallDeco.has(t.x + ',' + t.z + ',' + i)) out.push({ x: t.x, z: t.z, i, room: zone[idx(t.x, t.z)] === 2 });
  });
  return shuffle(out);
}
function buildDecor() {
  const faces = wallFaces(), dcn = Q().decor;
  // reserve wall spots for photo frames (the first three are in the safe room, so you see them straight away)
  photoSlots.push({ x: 2, z: 3, i: 2, used: false }, { x: 5, z: 1, i: 0, used: false }, { x: 1, z: 1, i: 3, used: false });
  faces.forEach((f, q) => { if (q % 6 === 0 && photoSlots.length < 24) { photoSlots.push({ x: f.x, z: f.z, i: f.i, used: false }); wallDeco.add(f.x + ',' + f.z + ',' + f.i); } });
  const frameMax = Math.round(46 * Q().decor);
  let nF = 0, nS = 0;
  faces.forEach((f) => {
    const k = f.x + ',' + f.z + ',' + f.i;
    if (wallDeco.has(k)) return;
    if (nF < frameMax && (nS >= Math.round(18 * dcn) || Math.random() < 0.7)) { addFrame(f.x, f.z, f.i); wallDeco.add(k); nF++; }
    else if (nS < Math.round(18 * dcn)) { addScrawl(f.x, f.z, f.i); wallDeco.add(k); nS++; }
  });

  const corridorFaces = faces.filter((f) => !f.room && !wallDeco.has(f.x + ',' + f.z + ',' + f.i));
  const roomFaces = (r) => faces.filter((f) => f.room && roomId[idx(f.x, f.z)] === r.id);
  let nPlant = 0, nCarton = 0, nChair = 0, nPil = 0, nLamp = 0;

  rooms.forEach((r) => {
    addRug(r.cxw + rnd(-1.2, 1.2), r.czw + rnd(-1, 1), Math.random() < 0.5 ? 0 : Math.PI / 2, rnd(3.0, 4.0), rnd(2.0, 2.8));
    const rf = roomFaces(r);
    const pil = new Set();
    for (let z = r.z0 + 1; z <= r.z1 - 1; z += 2) for (let x = r.x0 + 1; x <= r.x1 - 1; x += 2) pil.add(keyOf(x, z));
    const interior = [];
    for (let z = r.z0 + 1; z <= r.z1 - 1; z++) for (let x = r.x0 + 1; x <= r.x1 - 1; x++) if (!pil.has(keyOf(x, z))) interior.push({ x, z });
    shuffle(interior);
    const spot = () => { const f = interior.pop(); return f ? [(f.x + 0.5) * TILE + rnd(-0.5, 0.5), (f.z + 0.5) * TILE + rnd(-0.5, 0.5)] : null; };
    for (let k = 0; k < 2; k++) { const s = spot(); if (s) fallenChair(s[0], s[1]); }
    { const s = spot(); if (s) overturnedTable(s[0], s[1]); }
    // pilasters, plants, lamps, cartons against the walls
    let used3 = 0;
    rf.forEach((f) => {
      if (used3 >= Math.max(3, Math.round(6 * dcn))) return;
      const key = f.x + ',' + f.z + ',' + f.i;
      if (wallDeco.has(key)) return;
      wallDeco.add(key);
      if (used3 < 2) addPilaster(f.x, f.z, f.i, rnd(-0.9, 0.9));
      else if (used3 === 2) { const p = sidePos(f.x, f.z, f.i, 0.5); deadPlant(p[0], p[1], Math.random() < 0.3); }
      else if (used3 === 3) { const p = sidePos(f.x, f.z, f.i, 0.45); floorLamp(p[0], p[1], Math.random() < 0.5); nLamp++; }
      else if (used3 === 4) { const p = sidePos(f.x, f.z, f.i, 0.5); carton(p[0], p[1]); }
      else { const p = sidePos(f.x, f.z, f.i, 0.5); deadPlant(p[0], p[1], false); }
      used3++;
    });
  });

  // corridors
  corridorFaces.forEach((f) => {
    const key = f.x + ',' + f.z + ',' + f.i;
    if (wallDeco.has(key)) return;
    const p = sidePos(f.x, f.z, f.i, 0.5);
    if (nPlant < Math.round(12 * dcn)) { wallDeco.add(key); deadPlant(p[0], p[1], Math.random() < 0.25); nPlant++; }
    else if (nCarton < Math.round(8 * dcn)) { wallDeco.add(key); carton(p[0], p[1]); nCarton++; }
    else if (nChair < Math.round(6 * dcn)) { wallDeco.add(key); fallenChair(p[0], p[1]); nChair++; }
    else if (nLamp < Math.round(8 * dcn)) { wallDeco.add(key); const q = sidePos(f.x, f.z, f.i, 0.4); floorLamp(q[0], q[1], Math.random() < 0.6); nLamp++; }
    else if (nPil < Math.round(6 * dcn)) { wallDeco.add(key); addPilaster(f.x, f.z, f.i, rnd(-0.8, 0.8)); nPil++; }
  });

  // runner rugs down straight corridor tiles, litter, stains
  let runners = 0;
  shuffle(openTiles.slice()).forEach((t) => {
    if (t.x >= HOUSE_W || zone[idx(t.x, t.z)] !== 0 || runners >= Math.round(9 * dcn)) return;
    const ns = !solid(t.x, t.z - 1) && !solid(t.x, t.z + 1) && solid(t.x - 1, t.z) && solid(t.x + 1, t.z);
    const ew = !solid(t.x - 1, t.z) && !solid(t.x + 1, t.z) && solid(t.x, t.z - 1) && solid(t.x, t.z + 1);
    if (!ns && !ew) return;
    addRug((t.x + 0.5) * TILE, (t.z + 0.5) * TILE, ew ? Math.PI / 2 : 0, 1.3, 2.7); runners++;
  });
  for (let k = 0, n = Math.round(90 * Q().decor); k < n; k++) { const t = pick(openTiles); litterPaper((t.x + rnd(0.05, 0.95)) * TILE, (t.z + rnd(0.05, 0.95)) * TILE); }
  for (let k = 0, n = Math.round(30 * Q().decor); k < n; k++) { const t = pick(openTiles); if (t.x < HOUSE_W) floorStain((t.x + rnd(0.2, 0.8)) * TILE, (t.z + rnd(0.2, 0.8)) * TILE, rnd(0.8, 2.0)); }
}

/* ---------- backyard decoration pass ---------- */
function buildYardDecor() {
  const XH = HOUSE_W * TILE, XE = (MW - 1) * TILE, ZN = TILE, ZS = (MH - 1) * TILE, seg = 6;
  const gate = GATE_POS;
  // fence perimeter: tall picket strips + leaning posts + broken boards along the inner faces
  const strip = (cx, cz, ry) => {
    if (Math.random() < 0.12) return;                                  // missing section
    decoPart(baseM(cx, 3.55, cz, ry, 0, rnd(-0.05, 0.05)), UP, M.picket, 0, 0, 0, 0, 0, 0, seg, 1.5, 1, true);
  };
  const post = (px, pz) => { const pm = baseM(px, 0, pz, 0, rnd(-0.05, 0.05), rnd(-0.05, 0.05)); dBox(pm, M.wood, 0, 1.85, 0, 0.22, 3.7, 0.22); };
  for (let x = XH + seg / 2; x < XE; x += seg) { strip(x, ZN + 0.03, 0); strip(x, ZS - 0.03, Math.PI); post(x - seg / 2, ZN + 0.15); post(x - seg / 2, ZS - 0.15); }
  for (let z = ZN + seg / 2; z < ZS; z += seg) { strip(XE - 0.03, z, -Math.PI / 2); post(XE - 0.15, z - seg / 2); }
  for (let k = 0; k < 16; k++) {
    const onX = Math.random() < 0.5, px = onX ? rnd(XH + 2, XE - 2) : XE - 0.5, pz = onX ? (Math.random() < 0.5 ? ZN + 0.6 : ZS - 0.6) : rnd(ZN + 2, ZS - 2);
    dBox(baseM(px, 0.6, pz, rnd(0, 3)), M.wood, 0, 0, 0, 0.16, 1.2, 0.03, 0, 0, rnd(0.2, 0.5));
  }

  // overgrown hedges hugging the fence (instanced) with colliders
  const hedges = [];
  const okHedge = (x, z) => Math.hypot(x - gate.x, z - gate.z) > 6;
  for (let x = XH + 2; x < XE - 1.5; x += 1.8) {
    if (okHedge(x, ZN + 1.1)) hedges.push([x + rnd(-0.3, 0.3), ZN + 1.1 + rnd(-0.2, 0.2), rnd(0.8, 1.5)]);
    if (okHedge(x, ZS - 1.1)) hedges.push([x + rnd(-0.3, 0.3), ZS - 1.1 + rnd(-0.2, 0.2), rnd(0.8, 1.5)]);
  }
  for (let z = ZN + 2; z < ZS - 1.5; z += 1.8) if (okHedge(XE - 1.1, z)) hedges.push([XE - 1.1 + rnd(-0.2, 0.2), z + rnd(-0.3, 0.3), rnd(0.8, 1.5)]);
  const hm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.8, 1), M.hedge, Math.max(1, hedges.length)), d = new THREE.Object3D();
  hedges.forEach((h, i) => {
    d.position.set(h[0], 0.55 * h[2], h[1]); d.rotation.set(rnd(0, 1), rnd(0, TAU), 0); d.scale.set(h[2], h[2] * rnd(0.8, 1.3), h[2]); d.updateMatrix();
    hm.setMatrixAt(i, d.matrix); addCollider(h[0] - 0.55, h[1] - 0.55, h[0] + 0.55, h[1] + 0.55);
  });
  hm.count = hedges.length; hm.frustumCulled = false; hm.castShadow = true; hm.receiveShadow = true; world.add(hm);

  // scattered stones
  const stones = [];
  for (let k = 0, n = Math.round(80 * Q().decor); k < n; k++) {
    const x = rnd(XH + 3, XE - 3), z = rnd(ZN + 3, ZS - 3);
    if (Math.hypot(x - gate.x, z - gate.z) < 5 || (x < XH + 8 && YARD_DOORS.some((dz) => Math.abs(z - (dz + 0.5) * TILE) < 4))) continue;
    stones.push([x, z, rnd(0.18, 0.75)]);
  }
  const sm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), M.stone, Math.max(1, stones.length));
  stones.forEach((s, i) => {
    d.position.set(s[0], s[2] * 0.18, s[1]); d.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); d.scale.set(s[2], s[2] * rnd(0.5, 0.9), s[2] * rnd(0.8, 1.2)); d.updateMatrix();
    sm.setMatrixAt(i, d.matrix);
    if (s[2] > 0.5) addCollider(s[0] - 0.3, s[1] - 0.3, s[0] + 0.3, s[1] + 0.3);
  });
  sm.count = stones.length; sm.frustumCulled = false; sm.castShadow = true; sm.receiveShadow = true; world.add(sm);

  // worn stepping-stone paths from each back door
  YARD_DOORS.forEach((dz) => {
    const zc = (dz + 0.5) * TILE;
    for (let k = 0, x = XH + 1.2; x < XH + 26; k++, x += 1.4) {
      dBox(baseM(x, 0.035, zc + Math.sin(k * 0.55) * 1.1, rnd(-0.3, 0.3)), M.stone, 0, 0, 0, 0.9, 0.07, 0.6, 0, 0, 0, true);
    }
  });
  // dead-grass tufts and leaf litter
  for (let k = 0, n = Math.round(140 * Q().decor); k < n; k++) {
    const x = rnd(XH + 2, XE - 2), z = rnd(ZN + 2, ZS - 2);
    decoPart(baseM(x, 0.009, z, rnd(0, TAU), -Math.PI / 2, 0), UP, M.stain, 0, 0, 0, 0, 0, 0, rnd(0.6, 1.8), rnd(0.6, 1.8), 1, true);
  }
  // far tree silhouettes beyond the fence, against the haze
  const far = [];
  for (let k = 0, n = Math.round(90 * Q().decor); k < n; k++) {
    const side = k % 3; let x, z;
    if (side === 0) { x = rnd(XE + 8, XE + 70); z = rnd(-60, ZS + 60); } else if (side === 1) { x = rnd(XH - 10, XE + 70); z = rnd(-70, -8); } else { x = rnd(XH - 10, XE + 70); z = rnd(ZS + 8, ZS + 70); }
    far.push([x, z, rnd(2.2, 3.8)]);
  }
  const fm = new THREE.InstancedMesh(makeTreeGeo(0), M.farTree, far.length);
  far.forEach((f, i) => { d.position.set(f[0], 0, f[1]); d.rotation.set(0, rnd(0, TAU), 0); d.scale.set(f[2], f[2], f[2]); d.updateMatrix(); fm.setMatrixAt(i, d.matrix); });
  fm.frustumCulled = false; world.add(fm);
}

let skyDome = null;
function buildSky() {
  skyDome = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 14), M.sky);
  skyDome.renderOrder = -10; skyDome.frustumCulled = false;
  scene.add(skyDome);
}
function finalizeShadows() {
  world.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
}

/* ======================================================================
   THE WATCHER  —  procedural model: tall, pitch black, wide blade-like head, two white eyes
   ====================================================================== */
/* ======================================================================
   GAME STATE
   ====================================================================== */
const S = {
  mode: 'menu', prevMode: 'play', time: 0, frame: 0, keys: 0, camSel: 0, glitchT: 4, outT: 0, searching: null,
  deathT: 0, tension: 0, flashT: 0, flashI: 0, locked: false, notesRead: [],
  menuCam: -1, menuCamT: 0, lightT: 8, dark: 0, scareLight: 0, scareYaw: 0, scareD0: 1, staticT: 0,
  deathPhase: null, deathChoice: 0, deathOutT: 0, deathPick: 'retry',
  mapUp: false, lz: 0, lzDir: 0, camStatic: 0, lzStatic: false, lzFrom: null, dcam: null, choke: 0, deathType: 'stare', scareT: 1.4, impact: false, dbase: null, seed: 0, worldUsed: false,
  act: 1, locks: 0, stairsOpen: false, cs: null, quest: { screen: false, key: false, battery: false, crowbar: false }, obj: { explore: false, screen: false, radio: false, exit: false, crowbar: false },
  radarBroken: false, radioDone: false, visited: new Set(), monitorOn: false, controlLocked: false, act2FromMenu: false,
};
const P = {
  x: 10.5, z: 8, yaw: 0, pitch: 0, flashOn: false, running: false, moving: false, hiding: false, closet: null,
  safe: true, bob: 0, stepAcc: 0, fov: 72, camY: EYE_H, boostT: 0, quietT: 0, anim: null,
};
const mon = {
  x: 0, z: 0, yaw: 0, wantYaw: 0, baseYaw: 0, state: 'PATROL', timer: 0, wp: null, wpKey: -1,
  lastSeen: { x: 0, z: 0 }, sees: false, prevSees: false, noSightT: 0, ignoreT: 0, grace: 0, stepAcc: 0, moved: 0,
  anim: 0, lean: 0, headScale: 1, eyeScale: 1, closet: null, closetCool: {}, waiting: 0, arrived: false, src: { x: 0, z: 0 }, turnT: 0, speedNow: 0, dist: 100,
  duck: 0, reach: 0, doorWork: null, passDoor: null, ov: { armL: null, armR: null, legL: null, legR: null, curl: 0 },
};
const breath = { air: 1, hold: 0, noise: 0, grace: 1.4, gasp: 0, holding: false };
const discovered = new Uint8Array(MW * MH);
const fieldP = new Int16Array(MW * MH), fieldWp = new Int16Array(MW * MH);
let fieldPKey = -1;
let monMesh = null;

const LORE = 'You awaken in an endless monochrome labyrinth stripped of light and life. A silent watcher prowls the halls. Find all hidden keys to escape, but tread carefully\u2014it hears every hurried footstep.';
const ACTIVE = ['play', 'laptop', 'journal', 'note'];

function setMode(m) {
  S.mode = m; document.body.setAttribute('data-mode', m);
  el.viewport.classList.toggle('cctv', m === 'laptop' || m === 'menu' || m === 'lore');   // security-camera look
}
let toastTimer = 0;
function toast(msg, ms) { el.toast.textContent = msg; el.toast.classList.add('on'); toastTimer = (ms || 2200) / 1000; }
function setPrompt(text, prog) {
  if (!text) { el.prompt.classList.remove('on'); return; }
  el.prompt.classList.add('on');
  if (Input.isTouch()) text = text.replace('[E] / [Square]', '[USE]');
  if (el['prompt-text'].textContent !== text) el['prompt-text'].textContent = text;
  const bar = el['prompt-bar'];
  if (prog == null) bar.style.display = 'none';
  else { bar.style.display = 'block'; bar.firstElementChild.style.width = Math.round(clamp(prog, 0, 1) * 100) + '%'; }
}
function updateKeyUI() { el['hud-keys'].textContent = 'KEYS ' + S.keys + ' / ' + TOTAL_KEYS; drawCounter(); renderObjectives(); }

/* ======================================================================
   RESET / DISCOVERY
   ====================================================================== */
function discover() {
  const tx = tileOf(P.x), tz = tileOf(P.z), R = zoneAt(P.x, P.z) === 3 ? 3 : 2;
  for (let z = tz - R; z <= tz + R; z++) for (let x = tx - R; x <= tx + R; x++) if (inB(x, z)) discovered[idx(x, z)] = 1;
  const rid = inB(tx, tz) ? roomId[idx(tx, tz)] : -1;
  if (rid >= 0) { const r = rooms[rid]; for (let z = r.z0 - 1; z <= r.z1 + 1; z++) for (let x = r.x0 - 1; x <= r.x1 + 1; x++) if (inB(x, z)) discovered[idx(x, z)] = 1; }
}
function resetGame() {
  S.keys = 0; S.searching = null; S.tension = 0; S.deathT = 0; S.flashT = 0; S.notesRead = [];
  S.dark = 0; S.scareLight = 0; S.deathPhase = null; S.staticT = 0; S.lightT = rnd(8, 14);
  lightGroupList.forEach((lg) => { lg.state = 'on'; lg.k = 1; lg.t = 0; });
  radar.up = false; S.mapUp = false; S.dcam = null; S.choke = 0; S.lz = 0; S.lzDir = 0; P.anim = null; clearOverrides();
  P.x = 10.5; P.z = 8; P.yaw = 0; P.pitch = 0; P.flashOn = false; P.hiding = false; P.closet = null; P.safe = true;
  P.running = false; P.moving = false; P.bob = 0; P.stepAcc = 0;
  closets.forEach((c) => { c.group.visible = true; c.doorOpen = 0; c.doorTarget = 0; c.doorL.rotation.y = 0; c.doorR.rotation.y = 0; });
  const r = rooms[S.act === 2 ? 5 : 4];
  mon.x = r.cxw; mon.z = r.czw; mon.yaw = 0; mon.wantYaw = 0; mon.state = 'PATROL'; mon.timer = 0; mon.wp = null; mon.wpKey = -1;
  mon.sees = false; mon.prevSees = false; mon.noSightT = 0; mon.ignoreT = 0; mon.grace = 12; mon.closetCool = {}; mon.lean = 0;
  mon.headScale = 1; mon.eyeScale = 1; mon.duck = 0; mon.reach = 0; mon.doorWork = null; mon.passDoor = null; mon.closet = null; mon.waiting = 1; mon.arrived = false; mon.speedNow = 0; mon.stepAcc = 0; mon.moved = 0; mon.dist = 100;
  breath.air = 1; breath.hold = 0; breath.noise = 0; breath.grace = 1.4; breath.gasp = 0; breath.holding = false;
  fieldPKey = -1;
  discovered.fill(0);
  for (let z = SAFE.z0 - 1; z <= SAFE.z1 + 1; z++) for (let x = SAFE.x0 - 1; x <= SAFE.x1 + 1; x++) discovered[idx(x, z)] = 1;
  discover();
  assignKeys(); resetInventory(); resetExitDoor(); resetAct2State();
  document.body.setAttribute('data-act', String(S.act)); Snd.setAct(S.act); updateKeyUI();
  el['closet-overlay'].classList.remove('on'); el.breath.classList.remove('on');
  ['black', 'show', 'sel-retry', 'sel-menu', 'fade'].forEach((c) => el.death.classList.remove(c));
  document.body.classList.remove('hold'); document.body.classList.remove('static');
  setPrompt('');
}

/* ======================================================================
   INTERACTIONS
   ====================================================================== */
function promptFor(it) {
  switch (it.kind) {
    case 'laptop': return S.act === 2 ? '[E] / [Square]  Listen to the audio feeds' : '[E] / [Square]  Open Security Cameras';
    case 'closet': return '[E] / [Square]  Hide';
    case 'drawer': return it.searched ? null : '[E] / [Square]  Search Drawers';
    case 'floor': return it.searched ? null : (it.yard ? '[E] / [Square]  Dig Through Leaves' : '[E] / [Square]  Search Debris');
    case 'note': return '[E] / [Square]  Read Note';
    case 'gate': return S.keys >= TOTAL_KEYS ? '[E] / [Square]  Unlock Gate' : '[E] / [Square]  Inspect Gate';
    case 'door': if (it.locked) return S.quest.key ? '[E] / [Square]  Unlock Gate' : '[E] / [Square]  Locked Gate'; return S.act === 2 ? (it.target ? '[E] / [Square]  Close Gate' : '[E] / [Square]  Open Gate') : (it.target ? '[E] / [Square]  Close Door' : '[E] / [Square]  Open Door');
    case 'item': return it.taken ? null : '[E] / [Square]  Pick up ' + ITEM_DEFS[it.type].name;
    case 'exitdoor': return S.locks >= 5 ? null : (S.keys > S.locks ? '[E] / [Square]  Unlock padlock (' + (S.locks + 1) + '/5)' : '[E] / [Square]  Inspect Door');
    case 'quest': return it.taken ? null : '[E] / [Square]  Take ' + QUEST_NAMES[it.type];
    case 'radio': return S.radioDone ? null : (S.quest.battery ? '[E] / [Square]  Insert battery & call for help' : '[E] / [Square]  Inspect Radio');
    case 'exit': return exitHatch.open ? null : (S.quest.crowbar && !S.obj.crowbar ? '[E] / [Square]  Pry off the planks' : (S.obj.crowbar ? '[E] / [Square]  Try the hatch' : '[E] / [Square]  Inspect Hatch'));
    default: return null;
  }
}
function findInteract() {
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  let best = null, bestScore = 1e9;
  for (let i = 0; i < interactables.length; i++) {
    const it = interactables[i];
    const dx = it.x - P.x, dz = it.z - P.z, d = Math.hypot(dx, dz);
    if (d > it.range) continue;
    const dot = (dx * fx + dz * fz) / (d || 1);
    if (dot < it.minDot) continue;
    if (!promptFor(it)) continue;
    const score = d - dot * 0.8;
    if (score < bestScore) { best = it; bestScore = score; }
  }
  return best;
}
function useInteractable(it) {
  switch (it.kind) {
    case 'laptop': openLaptop(); break;
    case 'closet': enterCloset(it); break;
    case 'drawer': case 'floor': if (!it.searched) startSearch(it); break;
    case 'note': openNote(it); break;
    case 'gate': useGate(); break;
    case 'door': toggleDoor(it); break;
    case 'item': pickupItem(it); break;
    case 'exitdoor': useExitDoor(); break;
    case 'quest': collectQuest(it); break;
    case 'radio': startRadio(it); break;
    case 'exit': useExitHatch(it); break;
    default: break;
  }
}
function startSearch(it) { S.searching = { it, t: 0 }; if (it.kind === 'drawer') Snd.drawer(); else Snd.search(); triggerReach(it.kind === 'drawer' ? 'drawer' : 'pick', it.dur); }
function finishSearch() {
  const it = S.searching.it; S.searching = null;
  if (it.kind === 'radio') { finishRadio(it); return; }
  if (it.kind === 'exit') { finishHatch(it); return; }
  it.searched = true;
  if (it.fronts) it.fronts[1].position.z = it.frontZ + 0.08;          // drawer slides shut (a little ajar so you know you looked)
  if (it.hasKey) {
    S.keys++; Snd.key(); updateKeyUI(); triggerReach('pick', 0.7);
    toast('FOUND A KEY   ' + S.keys + ' / ' + TOTAL_KEYS, 2600);
    if (S.keys >= TOTAL_KEYS) setTimeout(() => { if (ACTIVE.indexOf(S.mode) >= 0) toast('ALL KEYS FOUND. GET TO THE GATE.', 3400); }, 2700);
  } else {
    const drop = Math.random() < 0.4 ? pick(DROP_TABLE) : null;
    if (drop && invAdd(drop)) { Snd.key(); triggerReach('pick', 0.6); toast('FOUND: ' + ITEM_DEFS[drop].name.toUpperCase(), 2200); }
    else toast(it.kind === 'drawer' ? 'EMPTY.' : 'NOTHING BUT DUST.');
  }
}
function useGate() {
  Snd.locked(); toast('THE GATE LEADS NOWHERE.\nTHE WAY DOWN IS THE DOOR IN THE SAFE ROOM.', 3400);
}
function openNote(it) {
  setMode('note'); setPrompt('');
  const c = el['note-canvas'].getContext('2d');
  c.drawImage(T.noteCanvas[it.def], 0, 0, 512, 512);
  if (S.notesRead.indexOf(it.def) < 0) S.notesRead.push(it.def);
  Snd.note();
}
function toggleMap() { S.mapUp = !S.mapUp; if (S.mapUp) { radar.up = false; drawJournal(); if (vm.mapTex) vm.mapTex.needsUpdate = true; vm.mapDraw = S.time; } Snd.note(); }

function enterCloset(c) {
  P.hiding = true; P.closet = c; P.flashOn = false; P.running = false; P.moving = false;
  P.anim = { type: 'in', t: 0, dur: 0.85, fx: P.x, fz: P.z, fyaw: P.yaw, fpitch: P.pitch, c };
  c.group.visible = true; c.doorTarget = 1; c.doorFast = false;      // doors swing open, you step in and turn round, they close behind you
  triggerReach('door', 0.55); Snd.closet();
  if (mon.state === 'CHASE' || mon.state === 'INVESTIGATE' || mon.state === 'SEARCH') beginClosetCheck();
}
function exitCloset() {
  const c = P.closet; if (!c) return;
  P.anim = { type: 'out', t: 0, dur: 0.7, fx: P.x, fz: P.z, fyaw: P.yaw, fpitch: P.pitch, tx: c.x + c.face.x * 1.3, tz: c.z + c.face.z * 1.3, c };
  P.hiding = false; P.closet = null;
  c.group.visible = true; c.doorTarget = 1; c.doorFast = false;
  triggerReach('door', 0.55); Snd.closet();
}
function updatePlayerAnim(dt) {
  const a = P.anim, c = a.c;
  a.t += dt;
  const k = clamp(a.t / a.dur, 0, 1), e = ease3(k);
  if (a.type === 'in') {
    P.x = lerp(a.fx, c.inside.x, e); P.z = lerp(a.fz, c.inside.z, e);
    P.yaw = a.fyaw + angDiff(a.fyaw, c.yaw) * e; P.pitch = lerp(a.fpitch, 0.3, e);
    if (k > 0.55) c.doorTarget = 0;
    if (k >= 1) { c.doorOpen = 0; c.doorTarget = 0; c.doorL.rotation.y = 0; c.doorR.rotation.y = 0; c.group.visible = false; P.anim = null; }
  } else if (a.type === 'wake') {
    P.pitch = lerp(0.9, 0, e); if (k >= 1) P.anim = null;
  } else {
    P.x = lerp(a.fx, a.tx, e); P.z = lerp(a.fz, a.tz, e); P.pitch = lerp(a.fpitch, 0, e);
    if (k > 0.6) c.doorTarget = 0;
    if (k >= 1) P.anim = null;
  }
}

/* ======================================================================
   PLAYER
   ====================================================================== */
function updatePlayer(dt, inp) {
  const mode = S.mode;
  P.boostT = Math.max(0, P.boostT - dt); P.quietT = Math.max(0, P.quietT - dt);
  if (mode === 'play') {
    if (P.anim) { updatePlayerAnim(dt); P.moving = false; P.running = false; P.safe = zoneAt(P.x, P.z) === 1; return; }
    // look
    if (P.hiding) {
      P.yaw = clamp(P.yaw - inp.lx, P.closet.yaw - 0.65, P.closet.yaw + 0.65);
      P.pitch = clamp(P.pitch - inp.ly, -0.2, 0.75);
    } else { P.yaw -= inp.lx; P.pitch = clamp(P.pitch - inp.ly, -1.35, 1.35); }

    // move (walking is silent, running is loud)
    if (!P.hiding && !S.searching) {
      const m = Math.hypot(inp.mx, inp.mz);
      P.moving = m > 0.12; P.running = P.moving && inp.run;
      if (P.moving) {
        const base = (P.running ? RUN : WALK) * (P.boostT > 0 ? 1.25 : 1);
        const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
        const pos = { x: P.x + (fx * inp.mz + rx * inp.mx) * base * dt, z: P.z + (fz * inp.mz + rz * inp.mx) * base * dt };
        resolveCollisions(pos, PLAYER_R, true);
        P.x = pos.x; P.z = pos.z;
        P.bob += base * dt * 2.2; P.stepAcc += base * dt;
        if (S.act === 2) { if (P.stepAcc >= (P.running ? 1.5 : 1.45)) { P.stepAcc = 0; Snd.stepWet(P.running ? 1 : 0.65); } }     // loud wet sloshing in the sewers
        else if (P.running && P.stepAcc >= 1.6) { P.stepAcc = 0; if (!(P.quietT > 0)) Snd.stepPlayer(); }
        else if (!P.running && P.stepAcc >= 2.6) P.stepAcc = 0;
      }
    } else { P.moving = false; P.running = false; }

    if (S.stairsOpen && S.act === 1 && !P.hiding && P.x < 2.7 && Math.abs(P.z - 7.5) < 1.1) { startFall(); return; }     // you step onto the stairs…
    if (inp.flash && !P.hiding) { P.flashOn = !P.flashOn; Snd.click(); }
    if (inp.radar) toggleRadar();
    if (inp.journal) toggleMap();
    // inventory
    if (inp.cam >= 0 && inp.cam < INV_SLOTS) selectSlot(inp.cam);
    if (inp.itemPrev) selectSlot((inv.sel + INV_SLOTS - 1) % INV_SLOTS);
    if (inp.itemNext) selectSlot((inv.sel + 1) % INV_SLOTS);
    if (inp.use) useSelected();

    // interaction
    const it = P.hiding ? null : findInteract();
    if (S.searching) {
      const sr = S.searching, d = sr.it;
      sr.t += dt;
      if (d.kind === 'radio' || d.kind === 'exit') { d.noiseT = (d.noiseT || 0) - dt; if (d.noiseT <= 0) { d.noiseT = d.kind === 'radio' ? 1.2 : 0.9; monHearNoise(d.x, d.z); if (d.kind === 'radio') Snd.radioStatic(); else Snd.gateCreak(0.5, false); } }   // the noise carries
      if (d.fronts) d.fronts[1].position.z = d.frontZ + 0.3 * (ease3(sr.t / 0.4) * (1 - ease3((sr.t - (d.dur - 0.4)) / 0.4)));   // drawer slides open, then shut
      setPrompt(d.kind === 'radio' ? 'BROADCASTING...' : (d.kind === 'exit' ? 'PRYING...' : 'SEARCHING...'), sr.t / d.dur);
      if (sr.t >= d.dur) finishSearch();
    } else if (P.hiding) {
      if (mon.state === 'STARE') setPrompt('');
      else if (mon.state === 'CLOSET_CHECK') setPrompt("DON'T MOVE");
      else setPrompt('[E] / [Square]  Leave Closet');
    } else setPrompt(it ? promptFor(it) : '');

    if (inp.interact && !S.searching) {
      if (P.hiding) {
        if (mon.state === 'STARE' || mon.state === 'CLOSET_CHECK') toast("DON'T MOVE", 900);
        else exitCloset();
      } else if (it) useInteractable(it);
    }
  } else if (mode === 'laptop') {
    P.moving = false; P.running = false;
    if (S.lzDir > 0 && S.lz > 0.9) {
      if (inp.cam >= 0 && inp.cam < cams.length) selectCam(inp.cam);
      if (inp.prev) selectCam((S.camSel + cams.length - 1) % cams.length);
      if (inp.next) selectCam((S.camSel + 1) % cams.length);
      if (inp.interact || inp.back) closeLaptop();
    }
  } else if (mode === 'journal') {
    P.moving = false; P.running = false;
    if (inp.journal || inp.back || inp.interact) setMode('play');
  } else if (mode === 'note') {
    P.moving = false; P.running = false;
    if (inp.interact || inp.back || inp.journal) setMode('play');
  }
  P.safe = zoneAt(P.x, P.z) === 1;
}

/* ======================================================================
   THE WATCHER  —  AI STATE MACHINE
   PATROL → (hears running) INVESTIGATE → (sees you) CHASE → (loses you) SEARCH → PATROL
   CHASE + you hide → CLOSET_CHECK → STARE (hold your breath) → LEAVE / KILL
   ====================================================================== */
function refreshFieldP() {
  const tx = P.safe ? DOOR.x : tileOf(P.x), tz = P.safe ? DOOR.z : tileOf(P.z);
  const key = tz * MW + tx;
  if (key !== fieldPKey) { fieldPKey = key; bfs(tx, tz, fieldP); }
}
function moveAlong(field, tx, tz, speed, dt) {
  const m = mon;
  let gx = tx, gz = tz;
  const dist0 = Math.hypot(tx - m.x, tz - m.z);
  if (!(dist0 < 14 && hasLOS(m.x, m.z, tx, tz))) {
    const cx = tileOf(m.x), cz = tileOf(m.z), cur = inB(cx, cz) ? field[cz * MW + cx] : -1;
    if (cur > 0) {
      let best = cur, bx = cx, bz = cz;
      for (let k = 0; k < 4; k++) {
        const nx = cx + DX[k], nz = cz + DZ[k];
        if (!inB(nx, nz)) continue;
        const v = field[nz * MW + nx];
        if (v >= 0 && v < best) { best = v; bx = nx; bz = nz; }
      }
      gx = (bx + 0.5) * TILE; gz = (bz + 0.5) * TILE;
    }
  }
  const dx = gx - m.x, dz = gz - m.z, d = Math.hypot(dx, dz);
  if (d > 0.001) {
    const step = Math.min(speed * dt, d);
    const pos = { x: m.x + dx / d * step, z: m.z + dz / d * step };
    resolveCollisions(pos, 0.3, 'jamb');
    if (zoneAt(pos.x, pos.z) === 1) { pos.x = m.x; pos.z = m.z; }   // it can never enter the safe room
    m.moved += Math.hypot(pos.x - m.x, pos.z - m.z);
    m.x = pos.x; m.z = pos.z; m.wantYaw = Math.atan2(dx, dz);
  }
  return Math.hypot(tx - m.x, tz - m.z);
}
function monGoTile(wx, wz, speed, dt) {
  const key = tileOf(wz) * MW + tileOf(wx);
  if (mon.wpKey !== key) { bfs(tileOf(wx), tileOf(wz), fieldWp); mon.wpKey = key; }
  return moveAlong(fieldWp, wx, wz, speed, dt);
}
function pickWaypoint(far) {
  const mt = tileOf(mon.x), mz = tileOf(mon.z);
  let best = null;
  for (let tries = 0; tries < 40 && !best; tries++) {
    const c = pick(openTiles);
    if (S.act === 2 && S.controlLocked && roomId[idx(c.x, c.z)] === 4) continue;      // it cannot patrol a locked room
    if (!far && Math.random() < 0.35 && !P.safe) { const d = fieldP[c.z * MW + c.x]; if (d < 3 || d > 11) continue; }
    if (Math.hypot(c.x - mt, c.z - mz) < (far ? 14 : 7)) continue;
    best = c;
  }
  if (!best) best = pick(openTiles);
  mon.wp = { x: (best.x + 0.5) * TILE, z: (best.z + 0.5) * TILE };
}
function startChase() { mon.state = 'CHASE'; mon.wp = null; }
function startInvestigate(x, z) { mon.state = 'INVESTIGATE'; mon.src = { x, z }; mon.turnT = 0.9; mon.wp = null; }
function startSearch2() { mon.state = 'SEARCH'; mon.timer = 7; mon.arrived = false; mon.wpKey = -1; }
function beginClosetCheck() { mon.state = 'CLOSET_CHECK'; mon.closet = P.closet; mon.wp = null; mon.wpKey = -1; Snd.growl(); }
function closetRoll() {
  if (!P.hiding || !P.closet) return;
  const c = P.closet;
  if (S.time < (mon.closetCool[c.id] || 0)) return;
  if (Math.hypot(c.x - mon.x, c.z - mon.z) < 6) {
    mon.closetCool[c.id] = S.time + 14;
    if (Math.random() < 0.45) beginClosetCheck();
  }
}
function onSpotted() { S.flashT = 0.6; Snd.spotted(); Pad.rumble(1, 0.8, 500); toast('IT SEES YOU', 1400); }
function monsterLeave() {
  mon.state = 'LEAVE'; mon.timer = 7; mon.wp = null; mon.wpKey = -1;
  if (mon.closet) mon.closetCool[mon.closet.id] = S.time + 35;
  Snd.growl(); toast('IT LEAVES...', 2000);
}

function updateMonster(dt) {
  const m = mon;
  m.grace = Math.max(0, m.grace - dt); m.ignoreT = Math.max(0, m.ignoreT - dt);
  refreshFieldP();
  const dx = P.x - m.x, dz = P.z - m.z, dist = Math.hypot(dx, dz);
  m.dist = dist;

  // --- perception
  const blind = m.grace > 0 || m.state === 'STARE' || m.state === 'CLOSET_CHECK' || m.state === 'LEAVE' || m.state === 'KILL' || (P.safe && m.ignoreT > 0);
  let sees = false, heard = false;
  if (!P.hiding && !blind) {
    const range = P.flashOn ? 30 : 19;       // the flashlight makes you easier to spot
    if (dist < range && hasLOS(m.x, m.z, P.x, P.z)) {
      const diff = Math.abs(angDiff(m.yaw, Math.atan2(dx, dz)));
      if (diff < 1.35 || dist < 5 || m.state === 'CHASE') sees = true;
    }
    if (P.running && P.moving && !P.safe && !(P.quietT > 0) && dist < 15) {
      const pd = fieldP[tileOf(m.z) * MW + tileOf(m.x)];
      if (pd >= 0 && pd <= 8) heard = true;  // walking is silent; running is not
    }
  }
  m.sees = sees;
  if (sees) { m.lastSeen.x = P.x; m.lastSeen.z = P.z; m.noSightT = 0; } else m.noSightT += dt;
  if (sees && !m.prevSees) onSpotted();
  m.prevSees = sees;

  // --- doors: it stops, reaches out and hauls them open (and drags them shut behind itself)
  const busyDoor = (m.state !== 'STARE' && m.state !== 'KILL') ? monsterDoorCheck(dt) : false;
  if (!busyDoor) m.reach = Math.max(0, m.reach - dt * 2.2);
  // --- states
  if (!busyDoor) switch (m.state) {
    case 'PATROL': {
      if (sees) { startChase(); break; }
      if (heard) { startInvestigate(P.x, P.z); break; }
      closetRoll();
      if (m.waiting > 0) {
        m.waiting -= dt; m.wantYaw = m.baseYaw + Math.sin(S.time * 0.8) * 0.9;
      } else {
        if (!m.wp) pickWaypoint(false);
        const rem = monGoTile(m.wp.x, m.wp.z, MON_PATROL, dt);
        if (rem < 1.1) { m.wp = null; m.waiting = rnd(1.2, 3); m.baseYaw = m.yaw; }
      }
      break;
    }
    case 'INVESTIGATE': {
      if (sees) { startChase(); break; }
      if (heard) { m.src.x = P.x; m.src.z = P.z; }
      closetRoll();
      m.turnT -= dt;
      if (m.turnT > 0) { m.wantYaw = Math.atan2(m.src.x - m.x, m.src.z - m.z); break; }   // stops, turns toward the noise
      const rem = monGoTile(m.src.x, m.src.z, MON_INVEST, dt);
      if (rem < 1.2) { m.state = 'SEARCH'; m.timer = 5; m.arrived = true; m.baseYaw = m.yaw; }
      break;
    }
    case 'SEARCH': {
      if (sees) { startChase(); break; }
      if (heard) { startInvestigate(P.x, P.z); break; }
      closetRoll();
      if (!m.arrived) {
        const rem = monGoTile(m.lastSeen.x, m.lastSeen.z, MON_INVEST, dt);
        if (rem < 1.2) { m.arrived = true; m.baseYaw = m.yaw; }
      } else {
        m.timer -= dt; m.wantYaw = m.baseYaw + Math.sin(S.time * 1.4) * 1.2;
        if (m.timer <= 0) { m.state = 'PATROL'; m.wp = null; m.waiting = 0; }
      }
      break;
    }
    case 'CHASE': {
      if (P.hiding) { beginClosetCheck(); break; }
      const tx = P.safe ? DOOR_W.x : P.x, tz = P.safe ? DOOR_W.z : P.z;
      const rem = moveAlong(fieldP, tx, tz, MON_CHASE, dt);
      if (P.safe && rem < 1.5) { m.state = 'LOITER'; m.timer = 3.5; break; }
      if (!sees && m.noSightT > 5.5 && !P.safe) startSearch2();
      break;
    }
    case 'LOITER': {
      m.timer -= dt; m.wantYaw = Math.atan2(dx, dz);
      if (!P.safe && sees) { startChase(); break; }
      if (m.timer <= 0) { m.state = 'PATROL'; m.ignoreT = 14; m.wp = null; m.waiting = 0; }
      break;
    }
    case 'CLOSET_CHECK': {
      const c = m.closet;
      const rem = monGoTile(c.front.x, c.front.z, MON_CLOSET, dt);
      if (rem < 0.45) {
        m.state = 'STARE';
        breath.air = 1; breath.hold = 0; breath.noise = 0; breath.grace = 1.4; breath.gasp = 0;
        Snd.growl();
      }
      break;
    }
    case 'STARE': {
      const c = m.closet;
      m.x = lerp(m.x, c.front.x, Math.min(1, dt * 3)); m.z = lerp(m.z, c.front.z, Math.min(1, dt * 3));
      m.wantYaw = Math.atan2(-c.face.x, -c.face.z);
      m.lean = lerp(m.lean, 0.38, Math.min(1, dt * 1.5));
      break;
    }
    case 'LEAVE': {
      if (!m.wp) pickWaypoint(true);
      m.timer -= dt;
      const rem = monGoTile(m.wp.x, m.wp.z, MON_INVEST, dt);
      if (m.timer <= 0 || rem < 1) { m.state = 'PATROL'; m.wp = null; m.waiting = 1; m.baseYaw = m.yaw; }
      break;
    }
    default: break;   // KILL
  }
  if (m.state !== 'STARE' && m.state !== 'KILL') m.lean = lerp(m.lean, 0, Math.min(1, dt * 3));

  // caught
  if (S.mode !== 'dead' && m.grace <= 0 && !P.hiding && !P.safe && dist < 1.05 &&
      m.state !== 'KILL' && m.state !== 'CLOSET_CHECK' && m.state !== 'STARE' && m.state !== 'LEAVE') dieNow();

  updateDuck(dt);
  // turning, footsteps
  const turn = m.state === 'CHASE' ? 8 : 3.2;
  m.yaw += clamp(angDiff(m.yaw, m.wantYaw), -turn * dt, turn * dt);
  const movedNow = m.moved; m.moved = 0;
  m.speedNow = lerp(m.speedNow, movedNow / Math.max(dt, 1e-4), Math.min(1, dt * 8));
  m.stepAcc += movedNow;
  if (m.stepAcc >= 1.75) { m.stepAcc -= 1.75; Snd.stepMonster(); if (S.monitorOn) monitorHook(); }
}

/* ======================================================================
   HOLD YOUR BREATH
   ====================================================================== */
function updateBreath(dt, inp) {
  const active = mon.state === 'STARE' && P.hiding && S.mode !== 'dead';
  el.breath.classList.toggle('on', active);
  document.body.classList.toggle('hold', active);
  breath.holding = false;
  if (!active) return;
  if (breath.grace > 0) breath.grace -= dt;
  const want = inp.breath && breath.gasp <= 0 && breath.air > 0.02;
  if (want) {
    breath.air -= dt / 3.4; breath.hold += dt; breath.noise = Math.max(0, breath.noise - dt * 0.3); breath.holding = true;
    if (breath.air <= 0.02) { breath.air = 0; breath.gasp = 1.2; breath.noise += 0.18; breath.holding = false; Snd.gasp(); }
  } else {
    breath.air = Math.min(1, breath.air + dt * (breath.gasp > 0 ? 0.18 : 0.45));
    if (breath.grace <= 0) breath.noise += dt * 0.2;
  }
  if (breath.gasp > 0) breath.gasp -= dt;
  el['b-hold'].style.width = Math.round(clamp(breath.hold / HOLD_NEEDED, 0, 1) * 100) + '%';
  el['b-air'].style.width = Math.round(clamp(breath.air, 0, 1) * 100) + '%';
  el['b-noise'].style.width = Math.round(clamp(breath.noise, 0, 1) * 100) + '%';
  if (breath.hold >= HOLD_NEEDED) { el.breath.classList.remove('on'); monsterLeave(); return; }
  if (breath.noise >= 1) dieNow();
}

/* ======================================================================
   DEATH · WIN
   ====================================================================== */
/* ======================================================================
   THE WATCHER  —  tall, pitch black, wide flared blade-like head.
   Eyes follow the reference: round, wide-set, unblinking white orbs with small dark pupils (self-lit).
   ====================================================================== */
function buildMonsterMesh() {
  const g = new THREE.Group(), blk = M.black;
  const cyl = (rt, rb, h, seg) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const legs = [], arms = [], hands = [];
  [-1, 1].forEach((sx) => {
    const piv = new THREE.Group(); piv.position.set(sx * 0.13, 1.22, 0);
    const l = new THREE.Mesh(cyl(0.065, 0.045, 1.22, 6), blk); l.position.y = -0.61; piv.add(l);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.32), blk); foot.position.set(0, -1.2, 0.08); piv.add(foot);
    g.add(piv); legs.push(piv);
  });
  const upper = new THREE.Group(); upper.position.y = 1.22; g.add(upper);
  const torso = new THREE.Mesh(cyl(0.2, 0.15, 1.0, 8), blk); torso.position.y = 0.5; upper.add(torso);
  const sh = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.2), blk); sh.position.y = 0.98; upper.add(sh);
  [-1, 1].forEach((sx) => {
    const piv = new THREE.Group(); piv.position.set(sx * 0.3, 0.96, 0);
    const a = new THREE.Mesh(cyl(0.04, 0.03, 1.35, 5), blk); a.position.y = -0.675; piv.add(a);
    const hand = new THREE.Group(); hand.position.y = -1.35; piv.add(hand);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.035), blk); palm.position.y = -0.065; hand.add(palm);
    const fingers = [];
    for (let f = 0; f < 4; f++) {                                  // long, thin fingers that can close round a throat
      const fp = new THREE.Group(); fp.position.set(-0.036 + f * 0.024, -0.13, 0);
      const fm = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.22, 0.014), blk); fm.position.y = -0.11; fp.add(fm);
      hand.add(fp); fingers.push(fp);
    }
    upper.add(piv); arms.push(piv); hands.push({ fingers });
  });
  const neck = new THREE.Mesh(cyl(0.045, 0.06, 0.3, 6), blk); neck.position.y = 1.12; upper.add(neck);
  const head = new THREE.Group(); head.position.y = 1.38; upper.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), blk); skull.scale.set(0.9, 1.2, 0.95); head.add(skull);
  const blade = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), blk); blade.scale.set(1.0, 0.055, 0.2); blade.position.y = 0.12; head.add(blade);

  // eyes: white orbs (basic material = emissive, always lit) with a small, intense dark pupil
  const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
  const glowMat = new THREE.SpriteMaterial({ map: T.glow, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.32 });
  const eyes = [], glows = [];
  [-1, 1].forEach((sx) => {
    const eg = new THREE.Group(); eg.position.set(sx * 0.085, 0.045, 0.118);
    eg.add(new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 10), eyeWhite));
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 10, 8), pupilMat);
    pupil.scale.set(1, 1, 0.5); pupil.position.set(0, 0, 0.029); eg.add(pupil);
    head.add(eg); eyes.push(eg);
    const s = new THREE.Sprite(glowMat); s.scale.set(0.13, 0.13, 1); s.position.set(sx * 0.085, 0.045, 0.147); head.add(s); glows.push(s);
  });
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
  return { group: g, legs, arms, upper, head, eyes, glows, hands };
}

function syncMonster(dt) {
  const mm = monMesh, m = mon, ov = m.ov;
  mm.group.position.set(m.x, -0.3 * m.duck, m.z);
  mm.group.rotation.y = m.yaw;
  const mv = clamp(m.speedNow / 3, 0, 1.4);
  m.anim += dt * (2 + m.speedNow * 1.6);
  const s = Math.sin(m.anim), dk = 1 - 0.245 * m.duck, swing = s * 0.3 * mv;
  mm.legs[0].rotation.x = ov.legL != null ? ov.legL : s * 0.55 * mv;
  mm.legs[1].rotation.x = ov.legR != null ? ov.legR : -s * 0.55 * mv;
  mm.legs[0].scale.y = dk; mm.legs[1].scale.y = dk;
  mm.arms[0].rotation.x = ov.armL != null ? ov.armL : -swing - 0.15 * m.duck;
  mm.arms[1].rotation.x = ov.armR != null ? ov.armR : swing - 1.15 * m.reach - 0.15 * m.duck;     // reaches out for doors
  const curl = -(0.12 + ov.curl * 1.3);
  for (let h = 0; h < mm.hands.length; h++) for (let f = 0; f < 4; f++) mm.hands[h].fingers[f].rotation.x = curl - f * 0.03;
  mm.upper.rotation.x = m.lean + 0.75 * m.duck;                                                      // ducks under door frames
  mm.upper.rotation.z = Math.sin(m.anim * 0.5) * 0.03;
  mm.head.rotation.z = Math.sin(S.time * 0.7) * 0.05; mm.head.rotation.x = Math.sin(S.time * 0.5) * 0.04;
  mm.head.scale.set(m.headScale, m.headScale, m.headScale);
  for (let i = 0; i < mm.eyes.length; i++) { const es = m.eyeScale; mm.eyes[i].scale.set(es, es, es); mm.glows[i].scale.set(0.13 * es, 0.13 * es, 1); }
}

/* ======================================================================
   GAME OVER  —  four jumpscares:
   stare · neck grab & lift · ground push & step-on  (caught outside)   |   closet drag-out (found hiding)
   ====================================================================== */
const BLACK_T = 2.0, HEAD_FWD = 1.38 * Math.sin(0.75);
const ease3 = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
function clearOverrides() { const o = mon.ov; o.armL = null; o.armR = null; o.legL = null; o.legR = null; o.curl = 0; }

function dieNow() {
  if (S.mode === 'dead') return;
  const hiding = !!(P.hiding && P.closet);
  setMode('dead'); S.deathT = 0; S.deathPhase = 'scare'; S.deathChoice = 0; S.searching = null; P.anim = null;
  mon.state = 'KILL'; mon.sees = false; mon.doorWork = null; mon.reach = 0; mon.duck = 0; clearOverrides();
  S.deathType = hiding ? 'drag' : pick(['stare', 'grab', 'push']);
  S.scareT = { stare: 1.4, grab: 2.5, push: 1.4, drag: 1.8 }[S.deathType];
  S.dcam = null; S.choke = 0; S.impact = false;
  if (P.closet) { P.closet.group.visible = true; if (hiding) { P.closet.doorTarget = 1; P.closet.doorFast = true; } }   // the door is ripped open
  el['closet-overlay'].classList.remove('on'); el.breath.classList.remove('on'); document.body.classList.remove('hold');
  radar.up = false; S.mapUp = false; setPrompt('');
  S.scareYaw = Math.atan2(-(mon.x - P.x), -(mon.z - P.z));
  S.scareD0 = Math.max(0.6, Math.hypot(mon.x - P.x, mon.z - P.z));
  S.dbase = { x: P.x, z: P.z, y: hiding ? 1.45 : EYE_H };
  Snd.death(); if (hiding) Snd.door();
  Pad.rumble(1, 1, 1200);
  S.flashT = 1;
}
function updateDeathSel() {
  el['btn-retry'].classList.toggle('sel', S.deathChoice === 0);
  el['btn-menu'].classList.toggle('sel', S.deathChoice === 1);
}
function chooseDeath(which) {
  if (S.mode !== 'dead' || S.deathPhase !== 'card') return;
  S.deathPhase = 'out'; S.deathOutT = 0; S.deathPick = which;
  el.death.classList.add(which === 'retry' ? 'sel-retry' : 'sel-menu');   // the other button + the stats fade away
  Snd.click();
}
function finishDeath() {
  const pk = S.deathPick;
  S.deathPhase = null;
  if (pk === 'retry') beginGame(); else { toMenu(); fadeFromBlack(1300); }
}

// 1) standard stare: it lunges in and leans its flared head into your face
function deathStare(t, dt) {
  const e = easeOut(t / 0.28);
  const fx = -Math.sin(S.scareYaw), fz = -Math.cos(S.scareYaw);
  const D = lerp(S.scareD0, 0.8 + HEAD_FWD, e);
  mon.x = P.x + fx * D; mon.z = P.z + fz * D;
  mon.yaw = S.scareYaw; mon.wantYaw = S.scareYaw;
  mon.lean = 0.75 * e; mon.headScale = lerp(1, 2, e);
  mon.eyeScale = lerp(1, 2.4, e) + Math.sin(t * 45) * 0.12 * e;
  mon.speedNow = 0;
  P.yaw += angDiff(P.yaw, S.scareYaw) * Math.min(1, dt * 25);
  P.pitch = lerp(P.pitch, 0.78, Math.min(1, dt * 14));
}
// 2) neck grab & lift: the long arm closes round your throat, lifts you, and brings you up to its face
function deathGrab(t, dt) {
  const b = S.dbase, sy = S.scareYaw;
  const fx = -Math.sin(sy), fz = -Math.cos(sy), rx = Math.cos(sy), rz = -Math.sin(sy);
  const rush = ease3(t / 0.3), lift = ease3((t - 0.35) / 1.4), pull = ease3((t - 1.75) / 0.65);
  const camY = lerp(b.y, 2.45, lift);
  const phi = Math.acos(clamp((2.48 - camY) / 1.5, -1, 1));            // arm angle that keeps the hand on your neck as you rise
  const D = lerp(S.scareD0, 1.5 * Math.sin(phi), rush);
  mon.x = b.x + fx * D - rx * 0.3; mon.z = b.z + fz * D - rz * 0.3;
  mon.yaw = sy; mon.wantYaw = sy; mon.speedNow = 0;
  mon.ov.armR = -phi * rush; mon.ov.armL = -0.35 * rush; mon.ov.curl = clamp(t / 0.4, 0, 1);
  mon.lean = 0.55 * pull; mon.headScale = lerp(1, 1.7, pull); mon.eyeScale = lerp(1, 2.2, pull) + Math.sin(t * 40) * 0.1 * pull;
  S.choke = clamp((t - 0.3) / 1.6, 0, 1);
  S.dcam = { x: b.x, y: camY, z: b.z, yaw: sy + Math.sin(t * 9) * 0.03 * lift, pitch: lerp(-0.22, 0.06, lift), roll: Math.sin(t * 7) * 0.05 * lift };
  if (!S.impact && t > 0.3) { S.impact = true; Snd.gasp(); }
}
// 3) ground push & step-on: shoved flat on your back, it strides over and brings a foot down on you
function deathPush(t, dt) {
  const b = S.dbase, sy = S.scareYaw;
  const fx = -Math.sin(sy), fz = -Math.cos(sy), rx = Math.cos(sy), rz = -Math.sin(sy);
  const rush = ease3(t / 0.22), fall = easeOut((t - 0.2) / 0.4), back = 1.3 * fall, stride = ease3((t - 0.5) / 0.7);
  const along = lerp(lerp(S.scareD0, 1.0, rush), -back, stride);
  mon.x = b.x + fx * along + rx * 0.13 * stride; mon.z = b.z + fz * along + rz * 0.13 * stride;
  mon.yaw = sy; mon.wantYaw = sy; mon.speedNow = 3 * stride * (1 - ease3((t - 1.1) / 0.2));
  const shove = rush * (1 - ease3((t - 0.4) / 0.3));
  mon.ov.armR = -1.15 * shove; mon.ov.armL = -1.15 * shove;
  const raise = ease3((t - 0.45) / 0.45), slam = ease3((t - 0.95) / 0.22);
  mon.ov.legL = -1.3 * raise * (1 - slam); mon.lean = -0.15 * raise;
  S.dcam = { x: b.x - fx * back, y: lerp(b.y, 0.16, fall), z: b.z - fz * back, yaw: sy, pitch: lerp(0, 0.95, fall), roll: lerp(0, 0.45, fall) };
  if (!S.impact && t > 1.18) { S.impact = true; Snd.stomp(); S.flashT = 1; }
}
// 4) closet drag-out: it rips the door open and hauls you out onto the floor
function deathDrag(t, dt) {
  const c = P.closet, f = c.face;
  const reach = ease3(t / 0.25), pull = ease3((t - 0.25) / 1.0), end = ease3((t - 1.2) / 0.5);
  const stepIn = 0.35 * reach, stepBack = 0.45 * pull;
  mon.x = c.front.x - f.x * stepIn + f.x * stepBack; mon.z = c.front.z - f.z * stepIn + f.z * stepBack;
  mon.yaw = Math.atan2(-f.x, -f.z); mon.wantYaw = mon.yaw; mon.speedNow = 2.5 * pull * (1 - end);
  mon.ov.armR = -1.25 * reach; mon.ov.curl = reach;
  mon.lean = 0.5 * end; mon.headScale = lerp(1, 1.8, end); mon.eyeScale = lerp(1, 2.3, end) + Math.sin(t * 40) * 0.1 * end;
  S.dcam = {
    x: lerp(c.inside.x, c.x + f.x * 1.05, pull), y: lerp(1.45, 0.55, pull), z: lerp(c.inside.z, c.z + f.z * 1.05, pull),
    yaw: c.yaw + Math.sin(t * 10) * 0.05, pitch: lerp(0.3, 0.8, pull), roll: lerp(0, 0.4, pull) + Math.sin(t * 8) * 0.06 * pull,
  };
  if (!S.impact && t > 0.2) { S.impact = true; Snd.door(); }
}
const DEATH_ANIM = { stare: deathStare, grab: deathGrab, push: deathPush, drag: deathDrag };

function updateDeath(dt) {
  S.deathT += dt;
  const t = S.deathT;
  if (S.deathPhase === 'scare') {
    DEATH_ANIM[S.deathType](t, dt);
    if (t > 0.1 && t < S.scareT - 0.3 && Math.random() < 0.2) S.flashT = Math.max(S.flashT, rnd(0.2, 0.55));
    if (t >= S.scareT) { S.deathPhase = 'black'; el.death.classList.add('black'); Snd.duck(true); S.flashT = 0; S.choke = 0; }   // hard cut to pitch black
  } else if (S.deathPhase === 'black') {
    if (t >= S.scareT + BLACK_T) {                      // two seconds of nothing, then…
      S.deathPhase = 'card'; Snd.duck(false); Snd.staticBurst(); S.staticT = 2.2;
      el['death-stats'].textContent = S.act === 2 ? 'Objectives Completed: ' + objectivesDone() + ' / ' + OBJ2.length : 'Keys Collected: ' + S.keys + ' / ' + TOTAL_KEYS;
      el.death.classList.add('show'); updateDeathSel();
      try { document.exitPointerLock(); } catch (e) { /* ignore */ }
    }
  } else if (S.deathPhase === 'out') {
    S.deathOutT += dt;
    if (S.deathOutT > 1.5 && !el.death.classList.contains('fade')) el.death.classList.add('fade');
    if (S.deathOutT > 2.5) finishDeath();
  }
}

function winGame() {
  setMode('won'); radar.up = false; setPrompt(''); Snd.win();
  if (S.act === 2) { el['win-title'].textContent = 'Act 2 complete.'; el['win-text'].textContent = 'The hatch groans open onto cold air and a thin grey light. Far above, a radio answers.'; }
  try { document.exitPointerLock(); } catch (e) { /* ignore */ }
}

/* ======================================================================
   JOURNAL  —  hand-drawn monochrome sketch of what you have seen
   ====================================================================== */
function drawJournal() {
  const cv = el['journal-canvas'], g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.fillStyle = '#cdcdcd'; g.fillRect(0, 0, W, H);
  dots(g, W, H, 5000, 80, 220, 0.18, 3);
  const pad = 26, top = 66;
  const sc = Math.min((W - pad * 2) / MW, (H - top - pad) / MH);
  const ox = (W - sc * MW) / 2, oy = top + (H - top - pad - sc * MH) / 2;
  const jit = (x, z, k) => (hash2(x * 7 + k, z * 13 + k) - 0.5) * sc * 0.2;
  g.fillStyle = '#111'; g.font = 'bold 30px "Courier New", monospace'; g.fillText('JOURNAL', 24, 40);
  g.font = '20px "Courier New", monospace'; g.fillText('KEYS ' + S.keys + ' / ' + TOTAL_KEYS, W - 190, 40);
  g.fillText('[J] / MAP: lower', W - 230, H - 8);

  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    const i = idx(x, z);
    if (!discovered[i] || grid[i] !== 0) continue;
    g.fillStyle = zone[i] === 1 ? '#f6f6f6' : (zone[i] === 3 ? '#b4b4b4' : '#e4e4e4');
    g.fillRect(ox + x * sc + jit(x, z, 1) * 0.3, oy + z * sc + jit(x, z, 2) * 0.3, sc + 0.8, sc + 0.8);
  }
  g.strokeStyle = '#151515'; g.lineWidth = 2; g.lineCap = 'round';
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    const i = idx(x, z);
    if (!discovered[i] || grid[i] !== 0) continue;
    for (let k = 0; k < 4; k++) {
      if (!solid(x + DX[k], z + DZ[k])) continue;
      const x0 = ox + (x + (k === 1 ? 1 : 0)) * sc, z0 = oy + (z + (k === 2 ? 1 : 0)) * sc;
      const x1 = (k === 0 || k === 2) ? x0 + sc : x0, z1 = (k === 1 || k === 3) ? z0 + sc : z0;
      g.beginPath(); g.moveTo(x0 + jit(x, z, 3 + k), z0 + jit(x, z, 7 + k)); g.lineTo(x1 + jit(x, z, 11 + k), z1 + jit(x, z, 15 + k)); g.stroke();
    }
  }
  // labels
  g.fillStyle = '#222'; g.font = '13px "Courier New", monospace';
  g.fillText('SAFE', ox + 2.2 * sc, oy + 2.1 * sc);
  rooms.forEach((r) => {
    if (discovered[idx(Math.floor((r.x0 + r.x1) / 2), Math.floor((r.z0 + r.z1) / 2))]) g.fillText(r.name, ox + (r.x0 + 0.4) * sc, oy + (r.z0 + 0.9) * sc);
  });
  // the locked escape gate
  if (discovered[idx(MW - 2, GATE_TZ)]) {
    const gx = ox + (MW - 1) * sc, gz = oy + (GATE_TZ + 0.5) * sc;
    g.strokeStyle = '#000'; g.lineWidth = 4; g.strokeRect(gx - 8, gz - 14, 14, 28);
    ln(g, gx - 8, gz - 14, gx + 6, gz + 14); ln(g, gx + 6, gz - 14, gx - 8, gz + 14);
    g.fillStyle = '#000'; g.font = 'bold 14px "Courier New", monospace'; g.fillText('GATE - LOCKED', gx - 120, gz - 20);
  }
  // you
  const px = ox + (P.x / TILE) * sc, pz = oy + (P.z / TILE) * sc;
  g.fillStyle = '#000'; g.beginPath(); g.arc(px, pz, 5, 0, TAU); g.fill();
  g.strokeStyle = '#000'; g.lineWidth = 3; ln(g, px, pz, px - Math.sin(P.yaw) * 14, pz - Math.cos(P.yaw) * 14);
}

/* ======================================================================
   CAMERA · LIGHTS
   ====================================================================== */
function updateCamera(dt) {
  if (S.mode === 'laptop') {                       // glide down to the 3D laptop screen
    const z = S.lz, e = z * z * (3 - 2 * z), pz = laptopScreen.pose, f = S.lzFrom;
    camera.position.set(lerp(f.x, pz.x, e), lerp(EYE_H, pz.y, e), lerp(f.z, pz.z, e));
    camera.rotation.set(lerp(f.pitch, pz.pitch, e), f.yaw + angDiff(f.yaw, pz.yaw) * e, 0);
    P.fov = lerp(72, pz.fov, e); camera.fov = P.fov; camera.updateProjectionMatrix();
    return EYE_H;
  }
  if ((S.mode === 'dead' || S.mode === 'cutscene') && S.dcam) {               // scripted jumpscare camera
    const sh = S.mode === 'dead' ? 0.025 * (1 - Math.min(1, S.deathT / Math.max(0.5, S.scareT))) : 0;
    camera.position.set(S.dcam.x + (Math.random() - 0.5) * sh, S.dcam.y + (Math.random() - 0.5) * sh, S.dcam.z + (Math.random() - 0.5) * sh);
    camera.rotation.set(S.dcam.pitch, S.dcam.yaw, S.dcam.roll || 0);
    return S.dcam.y;
  }
  let ty = EYE_H;
  if (P.hiding) ty = 1.45;
  else if (P.moving) ty += Math.sin(P.bob) * (P.running ? 0.055 : 0.03);
  else ty += Math.sin(S.time * 1.3) * 0.006;
  if (P.anim) ty -= 0.1 * Math.sin(Math.PI * clamp(P.anim.t / P.anim.dur, 0, 1));
  if (P.anim && P.anim.type === 'wake') ty = lerp(0.3, EYE_H, ease3(P.anim.t / P.anim.dur));      // you wake up lying in the water
  P.camY = lerp(P.camY, ty, Math.min(1, dt * (P.anim ? 10 : 20)));
  const y = P.camY;
  let shake = 0;
  if (mon.sees && ACTIVE.indexOf(S.mode) >= 0) shake += 0.005 + S.tension * 0.008;
  if (S.mode === 'dead' && S.deathPhase === 'scare') shake += 0.02 + 0.05 * (1 - Math.min(1, S.deathT / 1.4));
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  camera.position.set(P.x + sx, y + sy, P.z + sx * 0.5);
  camera.rotation.set(P.pitch + sy * 0.4, P.yaw + sx * 0.4, 0);
  const tf = 72 + (P.running && P.moving ? 6 : 0) + (P.boostT > 0 ? 3 : 0) - (mon.sees ? 3 : 0);
  const nf = lerp(P.fov, tf, Math.min(1, dt * 5));
  if (Math.abs(nf - P.fov) > 0.02) { P.fov = nf; camera.fov = nf; camera.updateProjectionMatrix(); }
  return y;
}
/* ======================================================================
   DYNAMIC ROOM LIGHTING  —  circuits flicker unnervingly or cut out completely
   ====================================================================== */
const FEED = (m) => m === 'laptop' || m === 'menu' || m === 'lore';
function flickerPat(t, ph) {
  const v = Math.sin(t * 61 + ph) + Math.sin(t * 23.7 + ph * 1.3) + Math.sin(t * 9.3 + ph * 2.1);
  return v > -0.3 ? 1 : 0.03;
}
function groupDist(grp) {
  let best = 1e9;
  for (let i = 0; i < grp.lamps.length; i++) best = Math.min(best, Math.hypot(grp.lamps[i].x - P.x, grp.lamps[i].z - P.z));
  return best;
}
function updateLightEvents(dt) {
  const live = ACTIVE.indexOf(S.mode) >= 0 || S.mode === 'menu' || S.mode === 'lore';
  if (live) {
    S.lightT -= dt;
    if (S.lightT <= 0) {
      S.lightT = rnd(5, 12);
      const cand = lightGroupList.filter((x) => !x.safe && x.state === 'on');
      if (cand.length) {
        const near = cand.filter((x) => groupDist(x) < 34);
        const grp = (near.length && Math.random() < 0.65) ? pick(near) : pick(cand);
        const black = Math.random() < 0.5;
        grp.state = black ? 'off' : 'flicker'; grp.t = 0; grp.thunked = false;
        grp.dur = black ? rnd(5, 13) : rnd(1.2, 3.2);
        const d = groupDist(grp);
        if (d < 32) Snd.zap(clamp(1 - d / 32, 0.1, 1));
      }
    }
  }
  for (let i = 0; i < lightGroupList.length; i++) {
    const grp = lightGroupList[i];
    if (grp.state === 'on') { grp.k = 1; continue; }
    grp.t += dt;
    if (grp.t >= grp.dur) { grp.state = 'on'; grp.k = 1; continue; }
    if (grp.state === 'flicker') grp.k = flickerPat(S.time, grp.ph);
    else {
      const rem = grp.dur - grp.t;
      if (grp.t < 0.6 || rem < 1.0) grp.k = flickerPat(S.time, grp.ph);     // stutters out… and stutters back
      else {
        grp.k = 0;
        if (!grp.thunked) { grp.thunked = true; const d = groupDist(grp); if (d < 32) Snd.thunk(clamp(1 - d / 32, 0.1, 1)); }
      }
    }
  }
}

/* ======================================================================
   MOTION TRACKER  —  handheld radar: green cone sweep, blip when it moves, accelerating ping
   ====================================================================== */
const RADAR_RANGE = 36, RADAR_HALF = 1.3;
const radar = { up: false, sw: 0, hitT: -99, blip: null, pingT: 0.4, flash: 0, ctx: null, label: '' };
function toggleRadar() {
  radar.up = !radar.up; if (radar.up) S.mapUp = false; radar.pingT = 0.25; Snd.radarToggle();
  el.radar.classList.toggle('up', radar.up);
}
function updateRadar(dt) {
  const show = radar.up && ACTIVE.indexOf(S.mode) >= 0;
  el.radar.classList.toggle('up', show);
  if (!show) return;
  if (S.act === 2 && S.radarBroken) { drawBrokenRadar(); return; }       // cracked, full of static, no pings
  const g = radar.ctx || (radar.ctx = el['radar-canvas'].getContext('2d'));
  const W = 360, H = 270, ox = W / 2, oy = H - 14, R = H - 34;
  const dx = mon.x - P.x, dz = mon.z - P.z, dist = Math.hypot(dx, dz);
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  const a = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);          // 0 = straight ahead, + = to your right
  const moving = mon.speedNow > 0.35 && dist < RADAR_RANGE && mon.state !== 'KILL';   // a motion tracker only sees movement

  // sweep + detection
  const prev = radar.sw;
  radar.sw += dt / 1.7;
  let wrapped = false;
  if (radar.sw >= 1) { radar.sw -= 1; wrapped = true; }
  if (moving) {
    const inFan = Math.abs(a) <= RADAR_HALF, u = (a + RADAR_HALF) / (2 * RADAR_HALF);
    let hit = false;
    if (inFan) hit = wrapped ? (u >= prev || u <= radar.sw) : (prev <= u && radar.sw > u);
    else hit = wrapped;
    if (hit) { radar.hitT = S.time; radar.blip = { a, d: dist, inFan }; }
  }

  // accelerating ping
  radar.pingT -= dt;
  if (radar.pingT <= 0) {
    const f = clamp(dist / RADAR_RANGE, 0, 1);
    Snd.ping(1 - f); radar.flash = 1;
    radar.pingT = 0.28 + Math.pow(f, 0.8) * 2.3;
  }
  radar.flash = Math.max(0, radar.flash - dt * 4);

  // draw the CRT
  g.fillStyle = '#021208'; g.fillRect(0, 0, W, H);
  const a0 = -Math.PI / 2 - RADAR_HALF, a1 = -Math.PI / 2 + RADAR_HALF;
  g.beginPath(); g.moveTo(ox, oy); g.arc(ox, oy, R, a0, a1); g.closePath();
  g.fillStyle = 'rgba(20,90,45,0.35)'; g.fill();
  g.strokeStyle = 'rgba(70,255,130,0.6)'; g.lineWidth = 1.5; g.stroke();
  g.lineWidth = 1; g.strokeStyle = 'rgba(70,255,130,0.32)';
  for (let k = 1; k <= 3; k++) { g.beginPath(); g.arc(ox, oy, R * k / 4, a0, a1); g.stroke(); }
  for (let i = -2; i <= 2; i++) { const ang = i * RADAR_HALF / 2; g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.sin(ang) * R, oy - Math.cos(ang) * R); g.stroke(); }
  const sa = -RADAR_HALF + radar.sw * 2 * RADAR_HALF;
  for (let i = 0; i < 14; i++) {
    const ang = sa - i * 0.035;
    if (ang < -RADAR_HALF) break;
    g.strokeStyle = 'rgba(130,255,170,' + (0.55 * (1 - i / 14)).toFixed(3) + ')'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.sin(ang) * R, oy - Math.cos(ang) * R); g.stroke();
  }
  if (radar.blip) {
    const al = Math.exp(-(S.time - radar.hitT) * 1.3);
    if (al > 0.03) {
      const rr = clamp(radar.blip.d / RADAR_RANGE, 0, 1) * R;
      g.shadowColor = '#3dff7a'; g.shadowBlur = 16; g.fillStyle = 'rgba(150,255,185,' + al.toFixed(3) + ')';
      if (radar.blip.inFan) {
        g.beginPath(); g.arc(ox + Math.sin(radar.blip.a) * rr, oy - Math.cos(radar.blip.a) * rr, 7, 0, TAU); g.fill();
      } else {                                                            // outside the cone: marker on the edge, left or right
        const ex = radar.blip.a > 0 ? W - 16 : 16, ey = oy - Math.max(0.1, rr / R) * R, s = radar.blip.a > 0 ? 1 : -1;
        g.beginPath(); g.moveTo(ex + 8 * s, ey); g.lineTo(ex - 6 * s, ey - 9); g.lineTo(ex - 6 * s, ey + 9); g.closePath(); g.fill();
      }
      g.shadowBlur = 0;
    }
  }
  g.fillStyle = 'rgba(120,255,160,0.35)';
  for (let i = 0; i < 16; i++) g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  if (radar.flash > 0) { g.fillStyle = 'rgba(120,255,160,' + (radar.flash * 0.12).toFixed(3) + ')'; g.fillRect(0, 0, W, H); }
  g.fillStyle = 'rgba(120,255,160,0.8)'; g.font = '18px "Courier New", monospace';
  g.fillText('MOTION', 10, 22); g.fillText(radar.blip && S.time - radar.hitT < 3 ? radar.blip.d.toFixed(0) + ' M' : '-- M', W - 70, 22);
  const lbl = radar.blip && S.time - radar.hitT < 3 ? radar.blip.d.toFixed(0) + ' M' : '--';
  if (lbl !== radar.label) { radar.label = lbl; el['r-dist'].textContent = lbl; }
  if (vm.tex) vm.tex.needsUpdate = true;
}

/* ======================================================================
   FIRST-PERSON VIEWMODEL  —  arms & hands bound to the camera
   · flashlight in the right hand · motion tracker (left side, two hands) · journal map (right hand)
   · walk / sprint bob, interaction reaches, closet doors. Drawn in a second pass on top of the
   world — and on top of the 3D closet slats — so the radar is always "inside the closet" with you.
   ====================================================================== */
scene.add(camera);                                 // the closet slats are a child of the camera
const vmScene = new THREE.Scene();
const vmCam = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.02, 6);
const vmAmb = new THREE.AmbientLight(0xffffff, 0.2);
const vmDir = new THREE.DirectionalLight(0xffffff, 0.3); vmDir.position.set(-0.5, 1, 0.8);
const vmGlow = new THREE.PointLight(0x4dff88, 0, 1.2, 1.5);
vmScene.add(vmAmb); vmScene.add(vmDir); vmScene.add(vmGlow);
const vm = {
  built: false, idle: null, held: null, dev: null, hR: null, hL: null, tex: null, mapG: null, mapTex: null, mapDraw: -9,
  slat: null, sx: 0, sy: 0, mv: 0, lastYaw: 0, lastPitch: 0, radarT: 0, mapT: 0, idleT: 0, lit: 0, slatA: 0, reach: null,
};
const vmMat = {};
const approach = (v, t, s) => (v < t ? Math.min(t, v + s) : Math.max(t, v - s));
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
function triggerReach(kind, dur) { vm.reach = { kind, t: 0, dur: dur || 0.6 }; }

// a hand that wraps around a vertical grip (axis = local y). back of hand faces +z, fingers wrap round the grip.
function buildHand(right, gripR, gripH, showGrip) {
  const h = new THREE.Group(), R = gripR + 0.013;
  h.userData.R = R;
  if (showGrip) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(gripR, gripR, gripH, 12), vmMat.metal);
    h.add(grip); h.userData.grip = grip;
  }
  const arc = Math.PI * 1.1, start = right ? Math.PI / 2 : Math.PI / 2 - arc;
  for (let i = 0; i < 4; i++) {
    const fg = new THREE.Group(); fg.rotation.y = -start; fg.position.y = 0.039 - i * 0.026;
    const t = new THREE.Mesh(new THREE.TorusGeometry(R, 0.0125, 6, 14, arc * (i === 0 || i === 3 ? 0.92 : 1)), vmMat.skin);
    t.rotation.x = Math.PI / 2; fg.add(t); h.add(fg);
  }
  const tg = new THREE.Group(); tg.rotation.y = -(right ? 0 : Math.PI / 2); tg.position.y = 0.06;
  const thumb = new THREE.Mesh(new THREE.TorusGeometry(R + 0.003, 0.0145, 6, 10, Math.PI * 0.5), vmMat.skin);
  thumb.rotation.x = Math.PI / 2; tg.add(thumb); h.add(tg);
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.125, 0.034), vmMat.skin);
  palm.position.set(0, 0, R + 0.017); h.add(palm);
  return h;
}
// forearm + sleeve leaving the wrist in direction `dir` (given in the hand's parent frame)
function attachArm(h, dir) {
  const d = dir.clone().normalize().applyQuaternion(h.quaternion.clone().invert());
  const wrist = new THREE.Vector3(0, -0.04, h.userData.R + 0.036), up = new THREE.Vector3(0, 1, 0);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.032, 0.6, 10), vmMat.skin);
  arm.quaternion.setFromUnitVectors(up, d); arm.position.copy(wrist).addScaledVector(d, 0.3); h.add(arm);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.056, 0.4, 10), vmMat.sleeve);
  sleeve.quaternion.setFromUnitVectors(up, d); sleeve.position.copy(wrist).addScaledVector(d, 0.34); h.add(sleeve);
}
function buildViewmodel() {
  const ph = (c, o) => new THREE.MeshPhongMaterial(Object.assign({ color: c, shininess: 10, specular: 0x222222 }, o || {}));
  vmMat.skin = ph(0x8a8a8a, { shininess: 10 }); vmMat.sleeve = ph(0x1c1c1c); vmMat.metal = ph(0x3c3c3c, { shininess: 30, specular: 0x555555 });
  vmMat.body = ph(0x1b1b1b); vmMat.bezel = new THREE.MeshBasicMaterial({ color: 0x050505 }); vmMat.board = ph(0x161616);
  vmMat.led = new THREE.MeshBasicMaterial({ color: 0xb8b8b8 }); vmMat.lens = new THREE.MeshBasicMaterial({ color: 0xffffff });
  vm.tex = new THREE.CanvasTexture(el['radar-canvas']);
  vmMat.screen = new THREE.MeshBasicMaterial({ map: vm.tex });

  // ---- hands at rest: right one holds the flashlight (when it is on), left hangs loose
  vm.idle = new THREE.Group(); vmScene.add(vm.idle);
  const hR = buildHand(true, 0.022, 0.18, true);
  hR.position.set(0.22, -0.27, -0.42); hR.rotation.set(-Math.PI / 2 + 0.1, 0, -0.1);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.026, 0.05, 12), vmMat.metal); head.position.y = 0.11; hR.userData.grip.add(head);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), vmMat.lens); lens.rotation.x = -Math.PI / 2; lens.position.y = 0.136; hR.userData.grip.add(lens);
  attachArm(hR, new THREE.Vector3(0.12, -0.55, 0.85)); vm.idle.add(hR); vm.hR = hR;
  const hL = buildHand(false, 0.02, 0.1, false);
  hL.position.set(-0.22, -0.28, -0.42); hL.rotation.set(-Math.PI / 2 + 0.15, 0, 0.12);
  attachArm(hL, new THREE.Vector3(-0.12, -0.55, 0.85)); vm.idle.add(hL); vm.hL = hL;
  hR.userData.bp = hR.position.clone(); hR.userData.br = hR.rotation.clone();
  hL.userData.bp = hL.position.clone(); hL.userData.br = hL.rotation.clone();

  // ---- the motion tracker (smaller, on the left), held two-handed; screen tilted back toward the player
  vm.held = new THREE.Group(); vmScene.add(vm.held);
  const dev = new THREE.Group(); vm.held.add(dev); vm.dev = dev; dev.scale.set(0.72, 0.72, 0.72);
  const part = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); dev.add(m); return m; };
  part(new THREE.BoxGeometry(0.34, 0.26, 0.085), vmMat.body, 0, 0, 0);
  part(new THREE.BoxGeometry(0.22, 0.03, 0.06), vmMat.body, 0, 0.145, 0);
  part(new THREE.PlaneGeometry(0.285, 0.225), vmMat.bezel, 0.01, 0, 0.0436);
  part(new THREE.PlaneGeometry(0.25, 0.1875), vmMat.screen, 0.01, 0, 0.0442);
  for (let k = 0; k < 7; k++) part(new THREE.BoxGeometry(0.014, 0.01, 0.01), vmMat.led, -0.148, 0.095 - k * 0.032, 0.044);
  const hl = buildHand(false, 0.03, 0.17, true); hl.position.set(-0.075, -0.215, 0);
  attachArm(hl, new THREE.Vector3(-0.3, -0.5, 0.8)); dev.add(hl);
  const hr = buildHand(true, 0.016, 0.17, true); hr.position.set(0.19, -0.03, 0);
  attachArm(hr, new THREE.Vector3(0.3, -0.55, 0.75)); dev.add(hr);

  // ---- the journal map, held in the right hand on a clipboard (the live journal canvas is its page)
  vm.mapG = new THREE.Group(); vmScene.add(vm.mapG);
  vm.mapTex = new THREE.CanvasTexture(el['journal-canvas']);
  vmMat.paper = new THREE.MeshBasicMaterial({ map: vm.mapTex, color: 0xe4e4e4 });
  const mg = new THREE.Group(); vm.mapG.add(mg); vm.mapBody = mg;
  const mpart = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); mg.add(m); return m; };
  mpart(new THREE.BoxGeometry(0.46, 0.285, 0.012), vmMat.board, 0, 0, 0);
  mpart(new THREE.PlaneGeometry(0.43, 0.25), vmMat.paper, 0, 0, 0.0066);
  mpart(new THREE.BoxGeometry(0.08, 0.025, 0.02), vmMat.metal, 0, 0.152, 0.004);
  const hm = buildHand(true, 0.016, 0.15, true); hm.position.set(0.13, -0.21, 0);
  attachArm(hm, new THREE.Vector3(0.3, -0.5, 0.8)); mg.add(hm);
  mg.scale.set(0.9, 0.9, 0.9);

  // ---- closet slats: a screen-space layer in the world pass, so everything in the viewmodel pass is drawn on top of it
  const sc = document.createElement('canvas'); sc.width = 256; sc.height = 512;
  const g2 = sc.getContext('2d');
  g2.clearRect(0, 0, 256, 512); g2.fillStyle = 'rgba(4,4,4,0.97)';
  for (let y = 0; y < 512; y += 32) g2.fillRect(0, y + 8, 256, 24);
  g2.fillRect(0, 0, 26, 512); g2.fillRect(230, 0, 26, 512);
  const gr = g2.createRadialGradient(128, 256, 120, 128, 256, 330); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.85)');
  g2.fillStyle = gr; g2.fillRect(0, 0, 256, 512);
  vm.slat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }));
  vm.slat.renderOrder = 1000; vm.slat.position.set(0, 0, -0.12); vm.slat.visible = false; vm.slat.frustumCulled = false;
  camera.add(vm.slat);

  vm.idle.visible = false; vm.held.visible = false; vm.mapG.visible = false;
  vm.built = true;
}

function updateViewmodel(dt) {
  if (!vm.built) return;
  const playing = S.mode === 'play', inGame = playing || S.mode === 'paused';
  vm.radarT = approach(vm.radarT, playing && radar.up ? 1 : 0, dt * 3.4);
  vm.mapT = approach(vm.mapT, playing && S.mapUp ? 1 : 0, dt * 3.4);
  vm.idleT = approach(vm.idleT, playing && (!P.hiding || P.anim) ? 1 : 0, dt * 4);
  const eR = easeOut(vm.radarT), eM = easeOut(vm.mapT), eHide = Math.max(eR, eM), k = Math.min(1, dt * 7);

  // closet slats fade in once you are inside, out as you leave
  const slatOn = inGame && P.hiding && (!P.anim || (P.anim.type === 'in' && P.anim.t / P.anim.dur > 0.7));
  vm.slatA = approach(vm.slatA, slatOn ? 1 : 0, dt * 3);
  vm.slat.visible = vm.slatA > 0.01; vm.slat.material.opacity = vm.slatA;
  if (vm.slat.visible) { const hh = 2 * 0.12 * Math.tan(camera.fov * Math.PI / 360) * 1.05; vm.slat.scale.set(hh * camera.aspect, hh, 1); }

  // sway: hands lag behind the camera; walking bobs them, sprinting pumps them
  const wy = angDiff(vm.lastYaw, P.yaw) / Math.max(dt, 0.001), wp = (P.pitch - vm.lastPitch) / Math.max(dt, 0.001);
  vm.lastYaw = P.yaw; vm.lastPitch = P.pitch;
  vm.sx = lerp(vm.sx, clamp(wy * 0.02, -0.06, 0.06), k); vm.sy = lerp(vm.sy, clamp(-wp * 0.02, -0.04, 0.04), k);
  vm.mv = lerp(vm.mv, P.moving ? 1 : 0, k);
  const run = P.running ? 1.5 : 1;
  const bx = Math.cos(P.bob * 0.5) * 0.012 * vm.mv * run, by = -Math.abs(Math.sin(P.bob)) * 0.016 * vm.mv * run + Math.sin(S.time * 1.6) * 0.003;
  const pump = Math.sin(P.bob) * vm.mv * (P.running ? 0.05 : 0.016);       // hands swing forward and back, out of phase

  // lighting on the hands follows the light around you
  let lit = 0;
  for (let i = 0; i < lampSlots.length; i++) {
    const s = lampSlots[i];
    if (s.lamp) lit += s.w * s.lamp.group.k * Math.pow(clamp(1 - Math.hypot(s.lamp.x - P.x, s.lamp.z - P.z) / 13, 0, 1), 1.2);
  }
  vm.lit = lerp(vm.lit, clamp(lit, 0, 1), k);
  vmAmb.intensity = 0.1 + 0.3 * vm.lit + (P.flashOn ? 0.28 : 0);
  vmDir.intensity = 0.08 + 0.22 * vm.lit + (P.flashOn ? 0.16 : 0);

  // interaction reach: right hand stretches out (pick up / drawer / door), left joins for doors
  let rr = 0, rk = null;
  if (vm.reach) {
    vm.reach.t += dt;
    const p = vm.reach.t / vm.reach.dur;
    if (p >= 1) vm.reach = null; else { rr = Math.sin(Math.PI * p); rk = vm.reach.kind; }
  }
  const hR = vm.hR, hL = vm.hL, bpR = hR.userData.bp, bpL = hL.userData.bp, brR = hR.userData.br, brL = hL.userData.br;
  let tR = [0.1, -0.14, -0.62, 0.45], tL = [bpL.x, bpL.y, bpL.z, 0];
  if (rk === 'drawer') tR = [0.02, -0.2, -0.56, 0.2];
  else if (rk === 'door') { tR = [0.13, -0.1, -0.64, 0.5]; tL = [-0.13, -0.1, -0.64, 0.5]; }
  hR.position.set(lerp(bpR.x, tR[0], rr), lerp(bpR.y, tR[1], rr), lerp(bpR.z, tR[2], rr) - pump);
  hR.rotation.set(brR.x + tR[3] * rr, brR.y, brR.z);
  hL.position.set(lerp(bpL.x, tL[0], rr), lerp(bpL.y, tL[1], rr), lerp(bpL.z, tL[2], rr) + pump);
  hL.rotation.set(brL.x + tL[3] * rr, brL.y, brL.z);
  hR.userData.grip.visible = P.flashOn;

  vm.idle.visible = vm.idleT > 0.02 && eHide < 0.98;
  vm.idle.position.set(vm.sx + bx, vm.sy + by - (1 - vm.idleT) * 0.5 - eHide * 0.5, 0);
  vm.idle.rotation.z = -vm.sx * 0.6;

  // the tracker rises from below on the LEFT, hands wrapped round it
  const halfW = 0.47 * Math.tan(29 * Math.PI / 180) * vmCam.aspect;
  vm.held.visible = vm.radarT > 0.02;
  vm.dev.position.set(clamp(-halfW * 0.62, -0.32, -0.15) + vm.sx * 1.2 + bx * 1.2, -0.05 + vm.sy + by * 1.2 - (1 - eR) * 0.55, -0.47 - radar.flash * 0.008);
  vm.dev.rotation.set(-0.3 + (1 - eR) * 0.5 + vm.sy * 2, 0.3 - vm.sx * 2, 0.04 + bx * 1.5);
  vmGlow.position.set(vm.dev.position.x, vm.dev.position.y + 0.05, vm.dev.position.z + 0.2);
  vmGlow.intensity = 0.55 * eR * (0.8 + 0.2 * radar.flash);

  // the map rises on the RIGHT, in one hand — and keeps updating while you walk
  vm.mapG.visible = vm.mapT > 0.02;
  vm.mapG.position.set(clamp(halfW * 0.6, 0.15, 0.3) + vm.sx * 1.2 + bx * 1.2, -0.04 + vm.sy + by * 1.2 - (1 - eM) * 0.6, -0.5);
  vm.mapG.rotation.set(-0.28 + (1 - eM) * 0.5 + vm.sy * 2, -0.3 - vm.sx * 2, -0.04 + bx * 1.5);
  if (vm.mapG.visible && S.mapUp && S.time - vm.mapDraw > 0.25) { drawJournal(); vm.mapTex.needsUpdate = true; vm.mapDraw = S.time; }
}
function renderViewmodel() {
  if (!vm.built || S.mode !== 'play' || (vm.idleT < 0.02 && vm.radarT < 0.02 && vm.mapT < 0.02)) return;
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(vmScene, vmCam);
  renderer.autoClear = true;
}

function updateLampPool(dt) {
  const cx = P.x, cz = P.z, sel = [];
  for (let i = 0; i < lamps.length; i++) {
    const L = lamps[i], dx = L.x - cx, dz = L.z - cz;
    L._d = dx * dx + dz * dz;
    if (L._d > 400) continue;
    let k = sel.length;
    if (k < 4) sel.push(L); else if (L._d < sel[3]._d) { sel[3] = L; k = 3; } else continue;
    while (k > 0 && sel[k - 1]._d > sel[k]._d) { const t = sel[k]; sel[k] = sel[k - 1]; sel[k - 1] = t; k--; }
  }
  lampSlots.forEach((s) => { s.want = (s.lamp && sel.indexOf(s.lamp) >= 0) ? 1 : 0; });
  sel.forEach((L) => {
    if (lampSlots.some((s) => s.lamp === L)) return;
    const free = lampSlots.find((s) => !s.lamp);
    if (free) { free.lamp = L; free.w = 0; free.want = 1; free.light.position.set(L.x, L.y - 0.3, L.z); }
  });
  lampSlots.forEach((s) => {
    if (!s.lamp) { s.light.intensity = 0; return; }
    s.w += clamp(s.want - s.w, -dt * 2.5, dt * 2.5);
    if (s.w <= 0.01 && s.want === 0) { s.lamp = null; s.light.intensity = 0; return; }
    let fl = 1;
    if (s.lamp.flick) {
      fl = 0.78 + 0.22 * Math.sin(S.time * 37 + s.lamp.ph) * Math.sin(S.time * 11.3 + s.lamp.ph * 1.7);
      if (Math.sin(S.time * 0.7 + s.lamp.ph * 3) > 0.985) fl *= 0.08;
    }
    s.light.intensity = s.lamp.power * s.w * fl * s.lamp.group.k;
  });
}
function updateWorldVisuals(dt, camY) {
  const out = (S.act === 1 && P.x > HOUSE_W * TILE) ? 1 : 0;
  S.outT = lerp(S.outT, out, Math.min(1, dt * 2));
  // when the circuit you're standing in dies, the world drops to near-total darkness
  let dtar = 0;
  if (ACTIVE.indexOf(S.mode) >= 0 && !P.safe) {
    let nl = null, nd = 100;
    for (let i = 0; i < lamps.length; i++) { const L = lamps[i], d = (L.x - P.x) * (L.x - P.x) + (L.z - P.z) * (L.z - P.z); if (d < nd) { nd = d; nl = L; } }
    if (nl && nl.group.state !== 'on') dtar = 1 - nl.group.k;
  }
  S.dark = lerp(S.dark, dtar, Math.min(1, dt * 12));
  S.scareLight = lerp(S.scareLight, (S.mode === 'dead' && S.deathPhase === 'scare') ? 1 : 0, Math.min(1, dt * 20));
  if (!FEED(S.mode)) {
    const base = S.act === 2 ? 0.12 : lerp(0.2, 0.3, S.outT);
    ambient.intensity = lerp(lerp(base, 0.03, S.dark), 0.8, S.scareLight);
    scene.fog.density = lerp(S.act === 2 ? 0.07 : lerp(0.055, 0.078, S.outT), 0.025, S.scareLight);
  }
  const cp = Math.cos(P.pitch), dirx = -Math.sin(P.yaw) * cp, diry = Math.sin(P.pitch), dirz = -Math.cos(P.yaw) * cp;
  flash.position.set(P.x, camY - 0.05, P.z);
  flash.target.position.set(P.x + dirx * 6, camY - 0.05 + diry * 6, P.z + dirz * 6);
  const on = P.flashOn && !P.hiding && S.mode !== 'dead' && S.mode !== 'menu' && S.mode !== 'lore';
  let target = on ? 1.9 : 0;                           // infinite battery — no drain, ever
  if (on && S.tension > 0.6 && Math.random() < 0.06) target *= 0.25;
  S.flashI = lerp(S.flashI, target, Math.min(1, dt * 30));
  flash.intensity = S.flashI;
  updateLampPool(dt);
  playerLight.position.set(P.x, camY, P.z);
  playerLight.intensity = (S.mode === 'menu' || S.mode === 'lore') ? 0 : 0.28 * (1 - S.dark) * (P.hiding ? 0.3 : 1);
  if (skyDome) skyDome.position.set(P.x, 0, P.z);
}
function menuFeed(dt) {
  // the title screen cycles through live CCTV feeds while the watcher keeps patrolling
  P.x = 10.5; P.z = 8.6; P.yaw = 0; P.pitch = 0; P.safe = true; P.moving = false; P.running = false; P.hiding = false;
  S.menuCamT -= dt;
  if (S.menuCamT <= 0) {
    S.menuCamT = 5; S.menuCam = (S.menuCam + 1) % cams.length;
    el['mc-label'].textContent = 'CAM ' + pad2(S.menuCam + 1) + '  ' + cams[S.menuCam].name;
    el['menu-glitch'].classList.add('on'); setTimeout(() => el['menu-glitch'].classList.remove('on'), 240);
  }
  const t = Math.floor(S.time);
  el['mc-time'].textContent = '02:' + pad2(Math.floor(t / 60) % 60) + ':' + pad2(t % 60);
  mon.grace = 999;
  updateMonster(dt);
}
function renderFrame() {
  // the title screen shows live, slowly panning CCTV feeds; in-game the laptop shows them on its own screen
  const feed = (S.mode === 'menu' || S.mode === 'lore') ? cams[Math.max(0, S.menuCam)] : null;
  if (feed) {
    const a = camAim(feed, S.time);
    cctv.position.set(feed.x, feed.y, feed.z); cctv.lookAt(a.x, a.y, a.z);
    const a0 = ambient.intensity, f0 = scene.fog.density;
    ambient.intensity = 0.9; scene.fog.density = 0.012; flash.intensity = 0;
    renderer.render(scene, cctv);
    ambient.intensity = a0; scene.fog.density = f0; flash.intensity = S.flashI;
  } else { renderer.render(scene, camera); renderViewmodel(); }
}

/* ======================================================================
   UI · FEEDBACK
   ====================================================================== */
const gctx = el.grain.getContext('2d');
el.grain.width = 192; el.grain.height = 108;
const grainFrames = [];
for (let f = 0; f < 6; f++) {
  const im = gctx.createImageData(192, 108), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const v = (Math.random() * 255) | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  grainFrames.push(im);
}
const pad2 = (n) => (n < 10 ? '0' : '') + n;

function updateAudio(dt) {
  const cp = Math.cos(P.pitch), act = ACTIVE.indexOf(S.mode) >= 0;
  const near = clamp(1 - mon.dist / 22, 0, 1), f = (mon.state === 'CHASE' || mon.state === 'STARE') ? 1 : 0.6;
  S.tension = lerp(S.tension, act ? near * f : 0, Math.min(1, dt * 2));
  Snd.update(dt, {
    lx: P.x, lz: P.z, fx: -Math.sin(P.yaw) * cp, fy: Math.sin(P.pitch), fz: -Math.cos(P.yaw) * cp,
    mx: mon.x, mz: mon.z, sees: mon.sees && act, dist: mon.dist, tension: S.tension, holding: breath.holding || S.choke > 0.25, act: S.act, monitorOn: S.monitorOn, chan: S.monitorOn ? cams[S.camSel] : null,
  });
}
function updateLightbar() {
  let r = 70, g = 70, b = 70;                                         // dim white
  if (S.mode === 'dead') { const k = Math.sin(S.time * 6) * 0.5 + 0.5; r = 40 + 215 * k; g = 0; b = 0; }   // pulsing red
  else if (mon.sees && ACTIVE.indexOf(S.mode) >= 0) { const on = Math.floor(S.time * 6) % 2 === 0; r = g = b = on ? 255 : 0; }  // flashing black / white
  Pad.setLight(r, g, b);
}
function updateRumble() {
  if (ACTIVE.indexOf(S.mode) < 0 || !Input.getPad()) return;
  const d = mon.dist;
  if (d < 14) {
    const k = Math.pow(1 - d / 14, 1.4), boost = P.hiding ? 1.25 : 1;
    Pad.rumble(clamp(k * boost, 0, 1), clamp(k * 0.7, 0, 1), 220);   // heavy rumble when it walks near you or your closet
  }
}
function updateUI(dt) {
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) el.toast.classList.remove('on'); }
  if (S.flashT > 0) S.flashT = Math.max(0, S.flashT - dt * 1.6);
  el.flash.style.opacity = S.flashT.toFixed(3);
  if (S.staticT > 0) S.staticT -= dt;
  document.body.classList.toggle('static', S.staticT > 0);
  if ((Settings.fx || S.staticT > 0) && (S.frame & 1) === 0) gctx.putImageData(grainFrames[(S.frame >> 1) % 6], 0, 0);
  const seen = mon.sees && ACTIVE.indexOf(S.mode) >= 0;
  el.grain.style.opacity = (0.13 + S.tension * 0.16 + (seen ? 0.14 : 0)).toFixed(3);
  el.alert.classList.toggle('on', seen);
  el.choke.style.opacity = clamp(S.choke, 0, 1).toFixed(3);
}

/* ======================================================================
   MENUS · FLOW
   ====================================================================== */
let typeTimer = null;
function typeLore() {
  let i = 0;
  el['lore-text'].textContent = '';
  clearInterval(typeTimer);
  typeTimer = setInterval(() => {
    i += 2; el['lore-text'].textContent = LORE.slice(0, i);
    if (i >= LORE.length) clearInterval(typeTimer);
  }, 26);
}
function lockPointer() {
  try { const r = renderer.domElement.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignore */ }
}
function fadeFromBlack(ms) {
  const c = el.cut;
  c.style.transition = 'none'; c.style.opacity = '1';
  void c.offsetWidth;
  c.style.transition = 'opacity ' + ms + 'ms ease'; c.style.opacity = '0';
}
function toMenu() {
  closeModals();
  if (S.act !== 1) { S.act = 1; buildWorld(newSeed(), 1); }                 // back to the house
  resetGame(); mon.grace = 999; S.menuCamT = 0; setMode('menu');
  try { document.exitPointerLock(); } catch (e) { /* ignore */ }
}
function toLore() { Snd.init(); setMode('lore'); typeLore(); }
function finishBegin() {
  S.worldUsed = true; resetGame(); setMode('play'); lockPointer();
  toast(S.act === 2 ? 'FIND A WAY OUT' : 'FIND ALL 5 KEYS', 2600);
}
// every new game builds a brand-new layout (maze, doors, decor, keys, items) from a fresh seed
function beginGame(instant) {
  Snd.init(); clearInterval(typeTimer);
  if (!S.worldUsed || !worldBuilt) { finishBegin(); return; }
  if (instant === true) { buildWorld(newSeed()); finishBegin(); return; }
  el.cut.style.transition = 'none'; el.cut.style.opacity = '1';          // black while the new layout is generated
  setTimeout(() => { buildWorld(newSeed()); finishBegin(); fadeFromBlack(1100); }, 90);
}
function setPause(on) {
  if (on) {
    if (ACTIVE.indexOf(S.mode) < 0) return;
    S.prevMode = S.mode; setMode('paused'); refreshSettingsUI(); renderObjectives();
    try { document.exitPointerLock(); } catch (e) { /* ignore */ }
  } else {
    if (S.mode !== 'paused') return;
    setMode(S.prevMode); if (S.prevMode === 'play') lockPointer();
  }
}
function toggleFull() {
  try {
    if (!document.fullscreenElement) { const r = document.documentElement.requestFullscreen(); if (r && r.catch) r.catch(() => {}); }
    else document.exitFullscreen();
  } catch (e) { /* ignore */ }
}
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  cctv.aspect = w / h; cctv.updateProjectionMatrix();
  vmCam.aspect = w / h; vmCam.updateProjectionMatrix();
}

function simulate(dt, inp) {
  if (inp.pause) { setPause(true); return; }
  updatePlayer(dt, inp);
  updateMonster(dt);
  updateBreath(dt, inp);
  discover();
}
function handleMode(dt, inp) {
  const padNav = inp.pad || UINav.padUsed;
  switch (S.mode) {
    case 'menu':
      if (padNav) uiNavStep(inp);
      if (modalOpen) { if (inp.back && !inp.pad) closeModals(); } else if (inp.confirm) toActSelect();
      menuFeed(dt); break;
    case 'acts': if (padNav) uiNavStep(inp); if (inp.back && !inp.pad) setMode('menu'); menuFeed(dt); break;
    case 'lore': if (padNav) uiNavStep(inp); if (inp.confirm) beginGame(); menuFeed(dt); break;
    case 'play': case 'laptop': case 'journal': case 'note': simulate(dt, inp); break;
    case 'paused': if (padNav) uiNavStep(inp); if (inp.confirm || inp.pause) setPause(false); break;
    case 'dead':
      updateDeath(dt);
      if (S.deathPhase === 'card') {
        if (padNav) uiNavStep(inp);
        if (!inp.pad) {
          if (inp.prev || inp.next) { S.deathChoice = 1 - S.deathChoice; updateDeathSel(); Snd.camSwitch(); }
          if (inp.confirm) chooseDeath(S.deathChoice === 0 ? 'retry' : 'menu');
        }
      }
      break;
    case 'won': if (padNav) uiNavStep(inp); if (inp.confirm) { S.act = 1; beginGame(); } break;
    case 'cutscene': updateFall(dt); break;
    case 'act2lore': if (padNav) uiNavStep(inp); if (inp.confirm) startAct2(); if (inp.back && !inp.pad && S.act2FromMenu) { clearInterval(type2Timer); setMode('acts'); } break;
    default: break;
  }
}

let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.max(0.001, (now - lastT) / 1000);
  const dt = Math.min(0.05, raw); lastT = now;
  S.time += dt; S.frame++;
  const inp = Input.poll(dt, raw);
  handleMode(dt, inp);
  updateDoors(dt); updateClosetDoors(dt); updateFlares(dt); updatePickups(dt); updateLaptop(dt); updateCamMeshes();
  updateExitDoor(dt); updateAct2(dt); updateConsoleRadar(dt); updateSewer(dt);
  updateLightEvents(dt); syncLampMeshes();
  const camY = updateCamera(dt);
  updateWorldVisuals(dt, camY);
  syncMonster(dt);
  updateDust(dt);
  updateAudio(dt);
  updateRadar(dt);
  updateRumble();
  updateLightbar();
  updateUI(dt);
  updateViewmodel(dt);
  renderFrame();
}

/* ======================================================================
   SEEDING  ·  every new game builds a fresh layout (maze, doors, decor, keys, items) from a seed
   ====================================================================== */
const realRandom = Math.random;
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function newSeed() {
  const s = String(Settings.seed || '').trim();
  if (s) return /^\d+$/.test(s) ? (parseInt(s, 10) >>> 0) : hashSeed(s);
  return (realRandom() * 4294967296) >>> 0;
}

/* ======================================================================
   GRAPHICS QUALITY PRESETS  +  drifting dust
   ====================================================================== */
const QUALITY = {
  low: { pr: 0.75, shadowMap: 512, dust: 0, decor: 0.5, playerShadow: false },
  medium: { pr: 1.0, shadowMap: 1024, dust: 120, decor: 0.8, playerShadow: false },
  high: { pr: Math.min(window.devicePixelRatio || 1, 1.5), shadowMap: 2048, dust: 320, decor: 1.0, playerShadow: true },
};
const Q = () => QUALITY[Settings.quality] || QUALITY.medium;
const DUST_MAX = 320;
const dustPos = new Float32Array(DUST_MAX * 3), dustVel = new Float32Array(DUST_MAX * 3);
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dustPts = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.045, color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false, sizeAttenuation: true }));
dustPts.frustumCulled = false;
scene.add(dustPts);
function initDust() {
  for (let i = 0; i < DUST_MAX; i++) {
    dustPos[i * 3] = P.x + rnd(-7, 7); dustPos[i * 3 + 1] = rnd(0.1, 3.2); dustPos[i * 3 + 2] = P.z + rnd(-7, 7);
    dustVel[i * 3] = rnd(-0.05, 0.05); dustVel[i * 3 + 1] = rnd(-0.02, 0.04); dustVel[i * 3 + 2] = rnd(-0.05, 0.05);
  }
}
function updateDust(dt) {
  const n = Q().dust;
  dustPts.visible = n > 0 && (S.mode === 'play' || S.mode === 'paused');
  if (!dustPts.visible) return;
  for (let i = 0; i < n; i++) {
    const k = i * 3;
    dustPos[k] += dustVel[k] * dt; dustPos[k + 1] += dustVel[k + 1] * dt; dustPos[k + 2] += dustVel[k + 2] * dt;
    if (dustPos[k] - P.x > 7) dustPos[k] -= 14; else if (dustPos[k] - P.x < -7) dustPos[k] += 14;
    if (dustPos[k + 2] - P.z > 7) dustPos[k + 2] -= 14; else if (dustPos[k + 2] - P.z < -7) dustPos[k + 2] += 14;
    if (dustPos[k + 1] > 3.2) dustPos[k + 1] = 0.1; else if (dustPos[k + 1] < 0.05) dustPos[k + 1] = 3.1;
  }
  dustGeo.setDrawRange(0, n);
  dustGeo.attributes.position.needsUpdate = true;
}
function applyQuality() {
  const q = Q();
  renderer.setPixelRatio(q.pr); renderer.setSize(window.innerWidth, window.innerHeight);
  if (flash.shadow.mapSize.x !== q.shadowMap) {
    flash.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    if (flash.shadow.map) { flash.shadow.map.dispose(); flash.shadow.map = null; }
  }
  playerLight.castShadow = Settings.shadows !== 'off' && q.playerShadow && !COARSE;
}

/* ======================================================================
   REBUILDABLE WORLD
   ====================================================================== */
const doors = [], doorEdges = new Map(), doorFrames = [];
let worldBuilt = false;
function ensureAssets() { if (!T.wall) { initTextures(); initMaterials(); } }
function disposeWorld() {
  for (let i = world.children.length - 1; i >= 0; i--) {
    const o = world.children[i];
    world.remove(o);
    o.traverse((n) => { if (n.geometry && n.geometry.dispose) n.geometry.dispose(); });
  }
}
function resetWorldData() {
  colliders.length = 0; cBuckets.fill(undefined);
  lamps.length = 0; interactables.length = 0; searchSpots.length = 0; closets.length = 0; cams.length = 0;
  doors.length = 0; doorEdges.clear(); doorFrames.length = 0;
  pickups.length = 0; flares.length = 0; photoSlots.length = 0; questSpots.length = 0;
  exitDoor.hinge = null; exitDoor.locks.length = 0; exitDoor.collider = null; exitHatch.hinge = null; exitHatch.planks.length = 0;
  used.clear(); wallDeco.clear(); decoParts = 0;
  for (const k in lightGroups) delete lightGroups[k];
  lightGroupList.length = 0;
  lampSlots.forEach((s) => { s.lamp = null; s.w = 0; s.want = 0; s.light.intensity = 0; });
  disposeWorld();
}
function buildWorld(seed, act) {
  act = act || S.act || 1;
  S.act = act; S.seed = seed;
  const prev = Math.random;
  Math.random = mulberry32(seed);              // everything below is deterministic for this seed
  try {
    resetWorldData();
    generateMaze(act);
    ensureAssets();
    if (act === 2) initSewerAssets();
    useMaterials(act);
    rooms.forEach((r, i) => { r.name = (act === 2 ? ACT2_NAMES : ACT1_NAMES)[i]; });
    if (act === 1) {
      buildStructure(); buildSafeRoom(); buildRooms(); buildCorridorItems(); buildDoors(); buildYard(); buildNotes();
      buildDecor(); buildYardDecor(); if (!skyDome) buildSky();
      buildPickups(); placePhotoFrames(); flushDeco(); finalizeShadows();
      assignKeys(); buildCameras(); buildLampMeshes();
    } else {
      buildSewerStructure(); buildSewerSafeRoom(); buildRooms(); buildCorridorItems(); buildDoors(); buildSewerHall();
      buildQuest(); buildSewerDecor(); buildPickups(); flushDeco(); finalizeShadows();
      assignKeys(); buildChannels(); buildLampMeshes();
    }
  } finally { Math.random = prev; }
  if (skyDome) skyDome.visible = act === 1;
  worldBuilt = true; S.worldUsed = false; S.menuCam = -1;
}

/* ======================================================================
   DOORS  —  room doorways with real doors. The watcher ducks under the frames,
   stops to haul doors open and drags them shut behind itself.
   ====================================================================== */
function doorSound(d, closing) {
  const dist = Math.hypot(d.cx - P.x, d.cz - P.z);
  if (dist < 42) { if (S.act === 2) Snd.gateCreak(clamp(1 - dist / 42, 0.1, 1), !!closing); else Snd.doorCreak(clamp(1 - dist / 42, 0.1, 1), !!closing); }
}
function makeDoor(ax, az, i, bx, bz) {
  const cx = (ax + 0.5 + DX[i] * 0.5) * TILE, cz = (az + 0.5 + DZ[i] * 0.5) * TILE;
  const alongX = DX[i] === 0;                          // the door spans the x axis when the passage runs north-south
  const g = newGroup(cx, cz, Math.atan2(DX[i], DZ[i]));
  const th = 0.28;
  addBox(g, 0.8, WALL_H, th, -1.1, WALL_H / 2, 0, M.wall); addBox(g, 0.8, WALL_H, th, 1.1, WALL_H / 2, 0, M.wall);
  addBox(g, 1.5, WALL_H - 2.4, th, 0, 2.4 + (WALL_H - 2.4) / 2, 0, M.wall);
  addBox(g, 0.08, 2.4, th + 0.04, -0.72, 1.2, 0, M.dark); addBox(g, 0.08, 2.4, th + 0.04, 0.72, 1.2, 0, M.dark);
  const hinge = new THREE.Group(); hinge.position.set(-0.68, 0, 0); g.add(hinge);
  if (S.act === 2) {                                                      // rusty iron gate: bars between rails
    for (let k = 0; k < 9; k++) addBox(hinge, 0.05, 2.3, 0.05, 0.1 + k * 0.145, 1.2, 0, M.bars);
    [0.3, 1.2, 2.2].forEach((y) => addBox(hinge, 1.36, 0.08, 0.07, 0.68, y, 0, M.bars));
    addBox(hinge, 0.06, 2.36, 0.07, 0.03, 1.18, 0, M.bars); addBox(hinge, 0.06, 2.36, 0.07, 1.33, 1.18, 0, M.bars);
    addBox(hinge, 0.14, 0.06, 0.16, 1.2, 1.05, 0, M.metal);
  } else {
    addBox(hinge, 1.36, 2.36, 0.06, 0.68, 1.18, 0, M.drawer);
    addBox(hinge, 0.14, 0.06, 0.16, 1.2, 1.05, 0, M.metal);
  }
  const jamb = (lo, hi) => (alongX ? addCollider(cx + lo, cz - 0.14, cx + hi, cz + 0.14, { jamb: true }) : addCollider(cx - 0.14, cz + lo, cx + 0.14, cz + hi, { jamb: true }));
  jamb(-1.5, -0.7); jamb(0.7, 1.5);
  const leaf = alongX ? addCollider(cx - 0.7, cz - 0.07, cx + 0.7, cz + 0.07) : addCollider(cx - 0.07, cz - 0.7, cx + 0.07, cz + 0.7);
  const d = { kind: 'door', cx, cz, x: cx, z: cz, ax, az, bx, bz, alongX, range: 2.3, minDot: 0.2, hinge, collider: leaf, locked: false, angle: 0, target: Math.random() < 0.22 ? 1 : 0, fast: false, byMonster: false };
  d.angle = d.target * 1.45; hinge.rotation.y = d.angle; leaf.off = d.angle > 0.5;
  doors.push(d); interactables.push(d);
  const a = az * MW + ax, b = bz * MW + bx;
  if (S.act !== 2) { doorEdges.set(a * 4096 + b, d); doorEdges.set(b * 4096 + a, d); }      // gates are see-through; wooden doors block sight
  doorFrames.push({ x: cx, z: cz, r: 1.6 });
}
function buildDoors() {
  YARD_DOORS.forEach((z) => doorFrames.push({ x: (HOUSE_W - 0.5) * TILE, z: (z + 0.5) * TILE, r: 1.7 }));
  doorFrames.push({ x: DOOR_W.x, z: DOOR_W.z, r: 1.7 });
  rooms.forEach((r) => {
    for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) for (let i = 0; i < 4; i++) {
      const nx = x + DX[i], nz = z + DZ[i];
      if (!inB(nx, nz) || grid[idx(nx, nz)] !== 0 || zone[idx(nx, nz)] !== 0) continue;   // room <-> corridor openings only
      makeDoor(x, z, i, nx, nz);
    }
  });
}
function updateDoors(dt) {
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i], tgt = d.target ? 1.45 : 0;
    if (d.angle === tgt) continue;
    d.angle = approach(d.angle, tgt, (d.fast ? 7 : 3.2) * dt);
    d.hinge.rotation.y = d.angle;
    d.collider.off = d.angle > 0.5;
    if (d.angle === tgt) d.fast = false;
  }
}
function toggleDoor(d) {
  if (d.locked) {                                                         // the Control Room's gate
    if (S.quest.key) {
      S.quest.key = false; doors.forEach((x) => { x.locked = false; x.collider.locked = false; }); S.controlLocked = false;
      Snd.lockOpen(); Snd.gateCreak(0.8, false); toast('YOU FORCE THE RUSTED LOCK.\nTHE CONTROL ROOM IS OPEN.', 3000); renderObjectives();
    } else { Snd.locked(); toast('LOCKED.\nTHE LOCK IS RUSTED SHUT. YOU NEED A KEY.', 2600); }
    return;
  }
  d.target = d.target ? 0 : 1; d.byMonster = false; d.fast = false;
  doorSound(d, d.target === 0); triggerReach('door', 0.55);
}
function monsterDoorCheck(dt) {
  const m = mon;
  if (m.passDoor && Math.hypot(m.passDoor.cx - m.x, m.passDoor.cz - m.z) > 2.3) {       // it is through: pull the door shut behind it
    const pd = m.passDoor; m.passDoor = null;
    if (pd.byMonster && pd.target === 1) { pd.target = 0; pd.fast = m.state === 'CHASE'; pd.byMonster = false; m.reach = Math.max(m.reach, 0.8); doorSound(pd, true); }
  }
  if (m.doorWork) {
    const w = m.doorWork; w.t += dt;
    m.wantYaw = Math.atan2(w.door.cx - m.x, w.door.cz - m.z);
    m.reach = 1;
    if (w.t > 0.2 && w.door.target === 0) { w.door.target = 1; w.door.fast = w.fast; w.door.byMonster = true; doorSound(w.door, false); }
    if (w.t > (w.fast ? 0.4 : 0.9) || (w.door.target === 1 && w.door.angle > 1.0 && w.t > 0.3)) { m.doorWork = null; m.passDoor = w.door; }
    return true;
  }
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i];
    if (d.target === 1 || d === m.passDoor || d.angle > 0.6 || d.locked) continue;
    const dx = d.cx - m.x, dz = d.cz - m.z, dist = Math.hypot(dx, dz);
    if (dist < 1.3 && dist > 0.15 && (dx * Math.sin(m.yaw) + dz * Math.cos(m.yaw)) / dist > 0.3) { m.doorWork = { door: d, t: 0, fast: m.state === 'CHASE' }; return true; }
  }
  return false;
}
function updateDuck(dt) {
  let near = false;
  for (let i = 0; i < doorFrames.length; i++) if (Math.hypot(doorFrames[i].x - mon.x, doorFrames[i].z - mon.z) < doorFrames[i].r) { near = true; break; }
  mon.duck = lerp(mon.duck, near ? 1 : 0, Math.min(1, dt * 6));       // bends at the hips and knees to fit under the frame
}

/* ======================================================================
   CLOSET DOORS  (hinged halves that swing open/shut)
   ====================================================================== */
function updateClosetDoors(dt) {
  for (let i = 0; i < closets.length; i++) {
    const c = closets[i];
    if (c.doorOpen === c.doorTarget) continue;
    c.doorOpen = approach(c.doorOpen, c.doorTarget, dt * (c.doorFast ? 6.5 : 3.5));
    c.doorL.rotation.y = -1.5 * c.doorOpen; c.doorR.rotation.y = 1.5 * c.doorOpen;
  }
}

/* ======================================================================
   SECURITY LAPTOP  —  the camera glides down to the 3D screen; the feed is rendered to a texture
   ====================================================================== */
const laptopScreen = { mat: null, idleTex: null, pose: null };
const FEED_W = 512, FEED_H = 320;
const feedRT = new THREE.WebGLRenderTarget(FEED_W, FEED_H, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
const feedCam = new THREE.PerspectiveCamera(68, FEED_W / FEED_H, 0.1, 160);
const staticCv = document.createElement('canvas'); staticCv.width = 128; staticCv.height = 80;
const staticCtx = staticCv.getContext('2d');
const staticTex = new THREE.CanvasTexture(staticCv);
staticTex.minFilter = THREE.NearestFilter; staticTex.magFilter = THREE.NearestFilter; staticTex.generateMipmaps = false;
let staticImg = null;
// white noise drawn straight onto the monitor — independent of the "Screen grain / CRT" setting, so it always plays
function drawStaticNoise() {
  if (!staticImg) staticImg = staticCtx.createImageData(128, 80);
  const d = staticImg.data;
  for (let i = 0; i < d.length; i += 4) { const v = 90 + ((Math.random() * 165) | 0); d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  const bars = 2 + ((Math.random() * 3) | 0);
  for (let b = 0; b < bars; b++) {
    const y = (Math.random() * 80) | 0, h = 1 + ((Math.random() * 3) | 0);
    for (let yy = y; yy < Math.min(80, y + h); yy++) for (let x = 0; x < 128; x++) { const k = (yy * 128 + x) * 4; d[k] = d[k + 1] = d[k + 2] = 255; }
  }
  staticCtx.putImageData(staticImg, 0, 0); staticTex.needsUpdate = true;
}
function camAim(c, t) {
  const bx = c.tx - c.x, bz = c.tz - c.z, a = c.amp * Math.sin(t * c.spd + c.ph), ca = Math.cos(a), sa = Math.sin(a);
  return { x: c.x + bx * ca - bz * sa, y: c.ty, z: c.z + bx * sa + bz * ca };
}
function renderFeed() {
  const c = cams[S.camSel], a = camAim(c, S.time);
  feedCam.position.set(c.x, c.y, c.z); feedCam.lookAt(a.x, a.y, a.z);
  const a0 = ambient.intensity, f0 = scene.fog.density, fi = flash.intensity, pl = playerLight.intensity;
  ambient.intensity = 0.9; scene.fog.density = 0.012; flash.intensity = 0; playerLight.intensity = 0;
  renderer.setRenderTarget(feedRT); renderer.render(scene, feedCam); renderer.setRenderTarget(null);
  ambient.intensity = a0; scene.fog.density = f0; flash.intensity = fi; playerLight.intensity = pl;
}
function openLaptop() {
  if (S.mode !== 'play') return;
  S.lzFrom = { x: P.x, z: P.z, yaw: P.yaw, pitch: P.pitch };
  S.mapUp = false; radar.up = false;
  setMode('laptop'); S.lzDir = 1; S.lz = 0; S.camSel = 0; S.camStatic = 0; S.lzStatic = false;
  Snd.laptop(); updateCamUI(); setPrompt('');
}
function closeLaptop() { if (S.lzDir > 0) { S.lzDir = -1; Snd.laptop(); } }
function selectCam(i) { S.camSel = i; S.camStatic = 0.6; Snd.camSwitch(); if (S.act === 2) Snd.monitor(true, cams[i]); updateCamUI(); }
function updateCamUI() {
  el['cam-label'].textContent = S.act === 2 ? 'CH ' + pad2(S.camSel + 1) + '  ' + cams[S.camSel].name + '   *AUDIO ONLY*' : 'CAM ' + pad2(S.camSel + 1) + '  ' + cams[S.camSel].name;
  const kids = el['cam-tabs'].children;
  for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('sel', i === S.camSel);
}
function updateLaptop(dt) {
  if (S.mode !== 'laptop') return;
  S.lz = clamp(S.lz + S.lzDir * dt / (S.lzDir > 0 ? 0.95 : 0.7), 0, 1);
  if (S.lzDir < 0 && S.lz <= 0) { if (S.monitorOn) { S.monitorOn = false; Snd.monitor(false); } setMode('play'); laptopScreen.mat.map = laptopScreen.idleTex; return; }
  if (S.act === 2) {                                                      // broken camera lenses: heavy static, but the microphones still work
    const on = S.lzDir > 0 && S.lz > 0.9;
    if (on !== S.monitorOn) { S.monitorOn = on; Snd.monitor(on, cams[S.camSel]); }
    drawAudioScreen(); laptopScreen.mat.map = audioScreen.tex;
    const t2 = Math.floor(S.time); el['cam-time'].textContent = '02:' + pad2(Math.floor(t2 / 60) % 60) + ':' + pad2(t2 % 60);
    return;
  }
  if (S.lz >= 0.85 && S.lzDir > 0 && !S.lzStatic) { S.lzStatic = true; S.camStatic = 0.9; }      // zoomed in: static first…
  if (S.camStatic > 0) S.camStatic -= dt;
  if (S.lzDir > 0 && S.lzStatic && S.camStatic > 0) { drawStaticNoise(); laptopScreen.mat.map = staticTex; }
  else if (S.lzDir > 0 && S.lzStatic) { renderFeed(); laptopScreen.mat.map = feedRT.texture; }                // …then the live camera
  else laptopScreen.mat.map = laptopScreen.idleTex;
  const t = Math.floor(S.time);
  el['cam-time'].textContent = '02:' + pad2(Math.floor(t / 60) % 60) + ':' + pad2(t % 60);
}
function updateCamMeshes() {
  for (let i = 0; i < cams.length; i++) { const c = cams[i]; if (!c.mesh) continue; const a = camAim(c, S.time); c.mesh.lookAt(a.x, a.y, a.z); }
}

/* ---------- ten panning CCTV cameras ---------- */
function corridorRuns() {
  const out = [];
  const isC = (x, z) => x >= 0 && x < HOUSE_W && z >= 0 && z < MH && grid[idx(x, z)] === 0 && zone[idx(x, z)] === 0;
  for (let z = 1; z < MH - 1; z++) {
    let x = 0;
    while (x < HOUSE_W) { if (isC(x, z)) { const s = x; while (x < HOUSE_W && isC(x, z)) x++; if (x - s >= 3) out.push({ len: x - s, ax: s, az: z, bx: x - 1, bz: z }); } else x++; }
  }
  for (let x = 1; x < HOUSE_W; x++) {
    let z = 0;
    while (z < MH) { if (isC(x, z)) { const s = z; while (z < MH && isC(x, z)) z++; if (z - s >= 3) out.push({ len: z - s, ax: x, az: s, bx: x, bz: z - 1 }); } else z++; }
  }
  return out.sort((a, b) => b.len - a.len);
}
function buildCameras() {
  cams.length = 0;
  const add = (name, x, y, z, tx, ty, tz, amp) => cams.push({ name, x, y, z, tx, ty, tz, amp: amp || 0.5, spd: rnd(0.28, 0.45), ph: rnd(0, TAU), mesh: null });
  const runs = corridorRuns();
  const r1 = runs[0] || null, r2 = r1 ? runs.find((r) => Math.hypot(r.ax - r1.ax, r.az - r1.az) > 8) : null;
  const runCam = (name, r, fb) => {
    if (r) add(name, (r.ax + 0.5) * TILE, WALL_H - 0.5, (r.az + 0.5) * TILE, (r.bx + 0.5) * TILE, 1.2, (r.bz + 0.5) * TILE, 0.34);
    else add(name, fb[0], WALL_H - 0.5, fb[1], fb[2], 1.2, fb[3], 0.34);
  };
  const roomCam = (ri, corner) => {
    const r = rooms[ri];
    const x = corner ? (r.x1 + 1) * TILE - 0.45 : r.x0 * TILE + 0.45, z = corner ? (r.z1 + 1) * TILE - 0.45 : r.z0 * TILE + 0.45;
    add(r.name, x, WALL_H - 0.45, z, r.cxw, 0.9, r.czw, 0.55);
  };
  runCam('WEST HALL', r1, [22.5, 10.5, 22.5, 25]);
  roomCam(0, false); roomCam(3, false); roomCam(1, true); roomCam(5, true);
  add('BACKYARD', HOUSE_W * TILE + 0.4, 3.1, 15.5 * TILE, GATE_POS.x, 1.0, GATE_POS.z, 0.7);
  roomCam(4, false); roomCam(2, true);
  runCam('EAST HALL', r2 || r1, [22.5, 10.5, 22.5, 25]);
  add('GATE', GATE_POS.x - 0.5, 3.0, GATE_POS.z + 5, GATE_POS.x - 24, 1.0, GATE_POS.z - 2, 0.7);
  cams.forEach((c) => {
    const g = newGroup(c.x, c.z, 0);
    c.mesh = addBox(g, 0.22, 0.18, 0.34, 0, c.y, 0, M.dark);
    g.updateMatrixWorld(true);
    const a = camAim(c, 0); c.mesh.lookAt(a.x, a.y, a.z);
  });
}

/* ======================================================================
   INVENTORY  ·  HELPFUL ITEMS  ·  PICKUPS
   keys: [1-6] pick a slot · wheel / Z X cycle · [Q] use     pad: D-Pad ◀ ▶ cycle · Circle use     touch: tap a slot, tap again to use
   ====================================================================== */
const ITEM_DEFS = {
  bottle: { name: 'Glass Bottle', desc: 'Throw it ahead. The crash pulls the watcher toward where it lands.' },
  flare: { name: 'Glow Flare', desc: 'Drops a bright light at your feet for 45 seconds.' },
  energy: { name: 'Energy Drink', desc: 'Move 25% faster for 10 seconds.' },
  boots: { name: 'Padded Boots', desc: 'Running makes no noise for 25 seconds.' },
  blueprint: { name: 'Blueprint', desc: 'Reveals the whole map in your journal.' },
};
const INV_SLOTS = 6, STACK_MAX = 5;
const DROP_TABLE = ['bottle', 'bottle', 'flare', 'flare', 'energy', 'boots', 'blueprint'];
const inv = { slots: [], sel: 0 };
const pickups = [], flares = [], tempMeshes = [];
const flareGroup = { key: 'flare', lamps: [], state: 'on', t: 0, dur: 0, k: 1, ph: 0, safe: true, thunked: false };
const slotEls = [];

function drawIcon(g, type) {
  g.strokeStyle = '#eee'; g.fillStyle = '#eee'; g.lineWidth = 2.5; g.lineCap = 'round'; g.lineJoin = 'round';
  if (type === 'bottle') { g.strokeRect(14, 16, 12, 20); g.strokeRect(17, 6, 6, 10); g.fillRect(17, 4, 6, 3); }
  else if (type === 'flare') { g.lineWidth = 6; g.beginPath(); g.moveTo(10, 32); g.lineTo(26, 14); g.stroke(); g.lineWidth = 2; ln(g, 30, 8, 34, 4); ln(g, 32, 14, 37, 12); ln(g, 27, 8, 27, 3); }
  else if (type === 'energy') { g.strokeRect(13, 10, 14, 26); g.fillRect(13, 19, 14, 7); g.strokeRect(15, 6, 10, 4); }
  else if (type === 'boots') { g.beginPath(); g.moveTo(14, 6); g.lineTo(14, 26); g.lineTo(32, 28); g.lineTo(32, 35); g.lineTo(8, 35); g.lineTo(8, 6); g.closePath(); g.stroke(); }
  else if (type === 'blueprint') { g.strokeRect(8, 9, 24, 22); ln(g, 12, 15, 28, 15); ln(g, 12, 20, 24, 20); ln(g, 12, 25, 27, 25); g.beginPath(); g.arc(31, 31, 4, 0, TAU); g.stroke(); }
}
function refreshHotbar() {
  for (let i = 0; i < slotEls.length; i++) {
    const s = slotEls[i], it = inv.slots[i], g = s.cv.getContext('2d');
    s.d.classList.toggle('sel', i === inv.sel); s.d.classList.toggle('full', !!it);
    g.clearRect(0, 0, 40, 40);
    if (it) drawIcon(g, it.type);
    s.n.textContent = it && it.n > 1 ? String(it.n) : '';
  }
}
function buildHotbar() {
  for (let i = 0; i < INV_SLOTS; i++) {
    const d = document.createElement('div'); d.className = 'slot';
    const cv = document.createElement('canvas'); cv.width = 40; cv.height = 40;
    const n = document.createElement('b'), k = document.createElement('i'); k.textContent = String(i + 1);
    d.appendChild(cv); d.appendChild(n); d.appendChild(k);
    d.addEventListener('pointerdown', (e) => { e.preventDefault(); tapSlot(i); });
    el.hotbar.appendChild(d); slotEls.push({ d, cv, n });
  }
  refreshHotbar();
}
function invAdd(type) {
  const s = inv.slots.find((x) => x.type === type && x.n < STACK_MAX);
  if (s) s.n++;
  else { if (inv.slots.length >= INV_SLOTS) { toast('INVENTORY FULL'); return false; } inv.slots.push({ type, n: 1 }); }
  refreshHotbar(); return true;
}
function selectSlot(i) {
  inv.sel = clamp(i, 0, INV_SLOTS - 1); refreshHotbar();
  const it = inv.slots[inv.sel];
  if (it) toast(ITEM_DEFS[it.type].name.toUpperCase() + (it.n > 1 ? '  x' + it.n : '') + '\n' + ITEM_DEFS[it.type].desc, 2600);
}
function tapSlot(i) { if (S.mode !== 'play') return; if (i === inv.sel && inv.slots[i]) useSelected(); else selectSlot(i); }
function resetInventory() {
  inv.slots.length = 0; inv.sel = 0; refreshHotbar();
  P.boostT = 0; P.quietT = 0;
  flares.forEach((f) => { const k = lamps.indexOf(f.lamp); if (k >= 0) lamps.splice(k, 1); });
  flares.length = 0;
  tempMeshes.forEach((m) => world.remove(m)); tempMeshes.length = 0;
  pickups.forEach((p) => { p.taken = false; p.group.visible = true; p.sprite.visible = true; });
}

/* ---- effects ---- */
function monHearNoise(x, z) {
  if (mon.grace > 0 || ['CHASE', 'STARE', 'CLOSET_CHECK', 'KILL', 'LEAVE'].indexOf(mon.state) >= 0) return false;
  if (Math.hypot(mon.x - x, mon.z - z) > 48) return false;
  startInvestigate(x, z);                                     // it stops, turns to the crash and goes to look
  return true;
}
function throwBottle() {
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  let lx = P.x, lz = P.z;
  for (let d = 0.5; d <= 18; d += 0.5) { const x = P.x + fx * d, z = P.z + fz * d; if (solid(tileOf(x), tileOf(z))) break; lx = x; lz = z; }
  if (Math.hypot(lx - P.x, lz - P.z) < 3) { toast('NO ROOM TO THROW', 1200); return false; }
  for (let k = 0; k < 5; k++) tempMeshes.push(addBox(world, 0.06, 0.02, rnd(0.05, 0.12), lx + rnd(-0.3, 0.3), 0.02, lz + rnd(-0.3, 0.3), M.glass, { ry: rnd(0, 3) }));
  Snd.glass(); triggerReach('pick', 0.5);
  const lured = monHearNoise(lx, lz);
  toast(lured ? 'THE CRASH ECHOES...' : 'CRASH.', 1400);
  return true;
}
function dropFlare() {
  const x = P.x, z = P.z;
  const lamp = { x, z, y: 0.25, power: 1.7, flick: true, ph: Math.random() * TAU, _d: 0, group: flareGroup, vis: true, idx: -1, fs: 1 };
  lamps.push(lamp);
  const mesh = new THREE.Mesh(cgeo(0.02, 0.02, 0.22, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
  mesh.rotation.z = Math.PI / 2; mesh.position.set(x, 0.03, z); world.add(mesh);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
  sprite.scale.set(1.3, 1.3, 1); sprite.position.set(x, 0.2, z); world.add(sprite);
  flares.push({ lamp, mesh, sprite, t: 45 });
  Snd.click(); triggerReach('pick', 0.5); toast('FLARE DROPPED', 1400);
  return true;
}
function updateFlares(dt) {
  for (let i = flares.length - 1; i >= 0; i--) {
    const f = flares[i];
    f.t -= dt;
    const fade = clamp(f.t / 5, 0, 1);
    f.lamp.power = 1.7 * (0.85 + 0.15 * Math.sin(S.time * 23)) * fade;
    f.sprite.material.opacity = 0.8 * fade;
    if (f.t <= 0) { const k = lamps.indexOf(f.lamp); if (k >= 0) lamps.splice(k, 1); world.remove(f.mesh); world.remove(f.sprite); flares.splice(i, 1); }
  }
}
const USE_FX = {
  bottle() { if (P.hiding) { toast("CAN'T THROW FROM HERE", 1000); return false; } return throwBottle(); },
  flare() { if (P.hiding) { toast("CAN'T DO THAT HERE", 1000); return false; } return dropFlare(); },
  energy() { P.boostT = 10; Snd.gasp(); toast('ENERGY BOOST', 1600); return true; },
  boots() { P.quietT = 25; Snd.click(); toast('YOUR STEPS ARE SILENT...', 1800); return true; },
  blueprint() { discovered.fill(1); Snd.note(); toast('BLUEPRINT: THE WHOLE MAP IS NOW IN YOUR JOURNAL', 2600); return true; },
};
function useSelected() {
  const it = inv.slots[inv.sel];
  if (!it) { toast('NOTHING SELECTED', 900); return; }
  if (!USE_FX[it.type]()) return;
  it.n--;
  if (it.n <= 0) inv.slots.splice(inv.sel, 1);
  refreshHotbar();
}

/* ---- pickups lying around the house, the yard and the safe room ---- */
let pickupGlow = null;
function makePickup(type, x, z) {
  const g = newGroup(x, z, rnd(0, TAU));
  const add = (geo, mat, px, py, pz, rx, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); if (rx) m.rotation.x = rx; if (rz) m.rotation.z = rz; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  if (type === 'bottle') { add(cgeo(0.04, 0.04, 0.2, 8), M.glass, 0, 0.1, 0); add(cgeo(0.015, 0.02, 0.1, 6), M.glass, 0, 0.25, 0); }
  else if (type === 'flare') { add(cgeo(0.02, 0.02, 0.26, 6), M.sheet, 0, 0.03, 0, 0, Math.PI / 2); add(cgeo(0.023, 0.023, 0.04, 6), M.shadeOn, 0.14, 0.03, 0, 0, Math.PI / 2); }
  else if (type === 'energy') { add(cgeo(0.045, 0.045, 0.14, 10), M.metal, 0, 0.07, 0); add(cgeo(0.04, 0.04, 0.02, 10), M.sheet, 0, 0.15, 0); }
  else if (type === 'boots') { add(bgeo(0.1, 0.09, 0.26), M.dark, -0.07, 0.045, 0); add(bgeo(0.1, 0.09, 0.26), M.dark, 0.07, 0.045, 0.05); }
  else { add(cgeo(0.035, 0.035, 0.34, 8), M.paper, 0, 0.035, 0, 0, Math.PI / 2); }
  if (!pickupGlow) pickupGlow = new THREE.SpriteMaterial({ map: T.glow, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.4 });
  const sprite = new THREE.Sprite(pickupGlow); sprite.scale.set(0.55, 0.55, 1); sprite.position.set(x, 0.14, z); world.add(sprite);
  const p = { kind: 'item', type, x, z, range: 1.7, minDot: 0.12, group: g, sprite, taken: false, k: Math.random() * 6 };
  interactables.push(p); pickups.push(p);
  return p;
}
function insideCollider(x, z) {
  const b = cBuckets[idx(tileOf(x), tileOf(z))];
  return !!(b && b.some((c) => x > c.minX - 0.2 && x < c.maxX + 0.2 && z > c.minZ - 0.2 && z < c.maxZ + 0.2));
}
function buildPickups() {
  pickupGlow = null;
  // supplies in the safe room
  [['flare', 13.4, 5.0], ['bottle', 14.3, 5.5], ['bottle', 7.2, 4.7], ['energy', 8.3, 10.6]].forEach((p) => makePickup(p[0], p[1], p[2]));
  const kinds = ['bottle', 'bottle', 'bottle', 'bottle', 'flare', 'flare', 'flare', 'flare', 'energy', 'energy', 'energy', 'boots', 'boots', 'blueprint'];
  const tiles = shuffle(openTiles.slice());
  const seenTiles = new Set();
  let k = 0;
  for (let q = 0; q < tiles.length && k < kinds.length; q++) {
    const t = tiles[q];
    if (seenTiles.has(keyOf(t.x, t.z))) continue;
    let side = -1;
    for (let i = 0; i < 4; i++) if (solid(t.x + DX[i], t.z + DZ[i])) { side = i; break; }
    if (side < 0) continue;
    const p = sidePos(t.x, t.z, side, 0.4);
    if (!decoClear(p[0], p[1], 1.3) || insideCollider(p[0], p[1])) continue;
    seenTiles.add(keyOf(t.x, t.z)); makePickup(kinds[k++], p[0], p[1]);
  }
}
function updatePickups(dt) {
  for (let i = 0; i < pickups.length; i++) { const p = pickups[i]; if (!p.taken) p.sprite.scale.setScalar(0.5 + 0.08 * Math.sin(S.time * 3 + p.k)); }
}
function pickupItem(it) {
  if (it.taken) return;
  if (invAdd(it.type)) {
    it.taken = true; it.group.visible = false; it.sprite.visible = false;
    Snd.key(); triggerReach('pick', 0.55); toast('PICKED UP: ' + ITEM_DEFS[it.type].name.toUpperCase(), 1800);
  }
}

/* ======================================================================
   PHOTOS  —  drop images into  Photos/  next to index.html and they hang in picture frames.
   Any aspect ratio works (frames are sized to the picture). Every photo gets the same grayscale + grain treatment
   as the in-game paintings. Works when the page is served over http(s); a "Load photos…" button in Settings
   covers browsers that block local files (and phones).
   ====================================================================== */
const photoPool = [], photoSlots = [];
const photoState = { folder: 0, picked: 0, blocked: false };
let pickedData = [];
const PHOTO_KEY = 'monochrome.photos.v1';

function agePhoto(g, w, h) {
  dots(g, w, h, Math.round(w * h / 110), 20, 230, 0.2, 3);                                       // film grain
  const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);   // vignette
  g.strokeStyle = 'rgba(235,235,235,0.12)'; g.lineWidth = 1;
  for (let k = 0; k < 6; k++) ln(g, Math.random() * w, 0, Math.random() * w, h);                // scratches
  g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6); g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h);
}
// returns { canvas, aspect } or null when the browser will not let us read the pixels (e.g. file:// images)
function processPhoto(img, done) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;
  const asp = clamp(iw / ih, 0.45, 2.4);
  let sw = iw, sh = ih, sx = 0, sy = 0;
  if (iw / ih > asp) { sw = ih * asp; sx = (iw - sw) / 2; } else if (iw / ih < asp) { sh = iw / asp; sy = (ih - sh) / 2; }
  const maxS = 512, W = asp >= 1 ? maxS : Math.round(maxS * asp), H = asp >= 1 ? Math.round(maxS / asp) : maxS;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  if (!done) {
    try {
      const id = g.getImageData(0, 0, W, H), d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        let v = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        v = (v - 128) * 1.18 + 118; v = v < 0 ? 0 : (v > 255 ? 255 : v);
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      g.putImageData(id, 0, 0);
    } catch (e) { return null; }
    agePhoto(g, W, H);
  }
  return { canvas: c, aspect: W / H };
}
function addPhoto(res, source) {
  const t = new THREE.CanvasTexture(res.canvas); t.anisotropy = 4;
  const mat = new THREE.MeshPhongMaterial({ color: 0xffffff, map: t, emissive: 0x151515, shininess: 5, specular: 0x0c0c0c });
  const p = { aspect: res.aspect, tex: t, mat, source, canvas: res.canvas };
  photoPool.push(p);
  return p;
}
function loadImage(src) {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') { resolve(null); return; }
    const im = new Image();
    im.onload = () => resolve(im); im.onerror = () => resolve(null);
    im.src = src;
  });
}
const wait = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
async function fetchText(url, ms) {
  try {
    if (typeof fetch === 'undefined') return null;
    const r = await Promise.race([fetch(url), wait(ms, null)]);
    if (!r || !r.ok) return null;
    return await r.text();
  } catch (e) { return null; }
}
async function discoverPhotoFiles() {
  const names = new Set();
  const isImg = (n) => /\.(jpe?g|png|webp|gif)$/i.test(n);
  const listing = await fetchText('Photos/', 1500);                 // 1) servers that list folders
  if (listing) {
    const re = /href\s*=\s*["']([^"'#?]+)["']/gi; let m;
    while ((m = re.exec(listing))) { let n = m[1]; try { n = decodeURIComponent(n); } catch (e) { /* keep */ } n = n.split('/').pop(); if (isImg(n)) names.add(n); }
  }
  if (!names.size) {                                                // 2) an explicit list: Photos/photos.json  ->  ["a.jpg","b.png"]
    const txt = await fetchText('Photos/photos.json', 1500);
    if (txt) { try { const arr = JSON.parse(txt); if (Array.isArray(arr)) arr.forEach((n) => { if (typeof n === 'string' && isImg(n)) names.add(n); }); } catch (e) { /* ignore */ } }
  }
  if (!names.size && typeof Image !== 'undefined') {                // 3) numbered guesses: 1.jpg, 2.png, ...
    const tries = [];
    for (let n = 1; n <= 12; n++) ['jpg', 'jpeg', 'png', 'webp'].forEach((ext) => tries.push(n + '.' + ext));
    const found = await Promise.race([Promise.all(tries.map((f) => loadImage('Photos/' + f).then((im) => (im ? f : null)))), wait(2500, [])]);
    (found || []).forEach((f) => { if (f) names.add(f); });
  }
  return Array.from(names);
}
async function loadFolderPhotos() {
  try {
    const names = await discoverPhotoFiles();
    const fresh = [];
    for (let i = 0; i < names.length && photoPool.length < 40; i++) {
      const img = await loadImage('Photos/' + encodeURIComponent(names[i]));
      if (!img) continue;
      const res = processPhoto(img, false);
      if (!res) { photoState.blocked = true; continue; }              // tainted: opened as a plain file
      fresh.push(addPhoto(res, 'folder')); photoState.folder++;
    }
    return fresh;
  } catch (e) { return []; }
}
function loadSavedPicks() {
  try {
    const arr = JSON.parse(localStorage.getItem(PHOTO_KEY) || '[]');
    if (!Array.isArray(arr)) return Promise.resolve([]);
    pickedData = arr.filter((s) => typeof s === 'string').slice(0, 10);
  } catch (e) { return Promise.resolve([]); }
  return Promise.all(pickedData.map((src) => loadImage(src))).then((imgs) => {
    const fresh = [];
    imgs.forEach((im) => { if (!im) return; const res = processPhoto(im, true); if (res) { fresh.push(addPhoto(res, 'picked')); photoState.picked++; } });
    return fresh;
  });
}
async function pickPhotos(fileList) {
  const fresh = [];
  for (let i = 0; i < fileList.length && i < 12; i++) {
    const url = URL.createObjectURL(fileList[i]);
    const img = await loadImage(url);
    if (!img) continue;
    const res = processPhoto(img, false);
    if (!res) continue;
    fresh.push(addPhoto(res, 'picked')); photoState.picked++;
    // keep a small copy so the picks survive a reload
    const sm = document.createElement('canvas'), k = Math.min(1, 320 / Math.max(res.canvas.width, res.canvas.height));
    sm.width = Math.round(res.canvas.width * k); sm.height = Math.round(res.canvas.height * k);
    sm.getContext('2d').drawImage(res.canvas, 0, 0, sm.width, sm.height);
    try { pickedData.push(sm.toDataURL('image/jpeg', 0.72)); if (pickedData.length > 10) pickedData.shift(); } catch (e) { /* ignore */ }
  }
  try { localStorage.setItem(PHOTO_KEY, JSON.stringify(pickedData)); } catch (e) { /* storage full or unavailable */ }
  if (fresh.length) addPhotosToWorld(fresh);
  return fresh.length;
}
function clearPickedPhotos() {
  for (let i = photoPool.length - 1; i >= 0; i--) if (photoPool[i].source === 'picked') photoPool.splice(i, 1);
  pickedData = []; photoState.picked = 0;
  try { localStorage.removeItem(PHOTO_KEY); } catch (e) { /* ignore */ }
}
// frames for reserved wall slots — called while the world is built (photos known so far) …
function placePhotoFrames() {
  const n = photoSlots.length;
  if (!n) return;
  const want = photoPool.length ? Math.min(n, Math.max(8, photoPool.length * 2)) : Math.min(n, 12);
  for (let k = 0; k < want; k++) { const s = photoSlots[k]; addFrame(s.x, s.z, s.i, photoPool.length ? photoPool[k % photoPool.length] : null); s.used = true; }
}
// … and when photos arrive later (loaded after the menu appeared, or picked in Settings)
function addPhotosToWorld(list) {
  let placed = 0;
  list.forEach((p) => {
    for (let rep = 0; rep < 2; rep++) {
      const s = photoSlots.find((q) => !q.used);
      if (!s) return;
      addFrame(s.x, s.z, s.i, p); s.used = true; placed++;
    }
  });
  if (placed) flushDeco();
}
function photoStatus() {
  const total = photoPool.length;
  let s = total + (total === 1 ? ' photo' : ' photos') + ' loaded';
  if (photoState.folder || photoState.picked) s += '  (' + photoState.folder + ' from Photos/, ' + photoState.picked + ' picked)';
  if (photoState.blocked && !photoState.folder) s += '  — browser blocks local files: use Load photos…';
  return s;
}
function startPhotoLoad() {
  loadSavedPicks().then((a) => { if (a.length) addPhotosToWorld(a); refreshSettingsUI(); });
  loadFolderPhotos().then((a) => { if (a.length) addPhotosToWorld(a); refreshSettingsUI(); });
}

/* ======================================================================
   ACT 1 ENDING  —  the heavy safe-room door with 5 padlocks, the stairs, the fall
   ====================================================================== */
const ACT1_NAMES = ROOM_DEFS.map((r) => r.name);
const ACT2_NAMES = ['PUMP ROOM', 'TOOL ROOM', 'UTILITY ROOM', 'STORAGE VAULT', 'CONTROL ROOM', 'FILTER ROOM'];
const exitDoor = { hinge: null, locks: [], angle: 0, target: 0, collider: null };

// a flat floor (or ceiling) panel whose texture repeats every `per` units, whatever its size
function addFloorPlane(x0, z0, x1, z1, y, mat, per) {
  const w = x1 - x0, d = z1 - z0, geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / per, uv.getY(i) * d / per);
  const m = new THREE.Mesh(geo, mat); m.position.set(x0 + w / 2, y, z0 + d / 2); m.receiveShadow = true; world.add(m);
  return m;
}
function addCeilPlane(x0, z0, x1, z1, y, mat, per) {
  const w = x1 - x0, d = z1 - z0, geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(Math.PI / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / per, uv.getY(i) * d / per);
  const m = new THREE.Mesh(geo, mat); m.position.set(x0 + w / 2, y, z0 + d / 2); world.add(m);
  return m;
}

function buildExitDoor() {
  const X = 3.0, Z0 = 6.0, Z1 = 9.0, ZC = 7.5, OW = 0.9;           // door plane at x = 3, opening 1.8 wide centred on z = 7.5
  exitDoor.locks.length = 0; exitDoor.angle = 0; exitDoor.target = 0;
  addBox(world, 0.4, WALL_H, 0.6, X, WALL_H / 2, Z0 + 0.3, M.wall);                // jambs …
  addBox(world, 0.4, WALL_H, 0.6, X, WALL_H / 2, Z1 - 0.3, M.wall);
  addBox(world, 0.4, WALL_H - 2.6, 3.0, X, 2.6 + (WALL_H - 2.6) / 2, ZC, M.wall);   // … and lintel
  addCollider(X - 0.2, Z0, X + 0.2, Z0 + 0.6, { jamb: true }); addCollider(X - 0.2, Z1 - 0.6, X + 0.2, Z1, { jamb: true });
  const hinge = new THREE.Group(); hinge.position.set(X + 0.05, 0, ZC - OW); world.add(hinge);
  addBox(hinge, 0.12, 2.55, OW * 2, 0, 1.275, OW, M.metal);                         // the heavy steel leaf
  addBox(hinge, 0.05, 2.1, 0.12, 0.09, 1.3, OW, M.dark);                            // hasp
  for (let k = 0; k < 5; k++) {                                                      // five padlock slots
    const y0 = 0.6 + k * 0.4, lg = new THREE.Group(); lg.position.set(0.14, y0, OW); hinge.add(lg);
    const body = addBox(lg, 0.09, 0.2, 0.17, 0, 0, 0, M.metal);
    const sh = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 12, Math.PI), M.dark); sh.position.set(0, 0.11, 0); sh.rotation.y = Math.PI / 2; lg.add(sh);
    exitDoor.locks.push({ group: lg, body, shackle: sh, state: 0, t: 0, y0 });
  }
  exitDoor.hinge = hinge;
  exitDoor.collider = addCollider(X - 0.07, ZC - OW, X + 0.07, ZC + OW);
  // the stairwell: a trench below the floor, dimly lit, ending in black
  addBox(world, 3.0, 2.6, 0.6, 1.5, -1.3, Z0 + 0.3, M.wall); addBox(world, 3.0, 2.6, 0.6, 1.5, -1.3, Z1 - 0.3, M.wall);
  for (let k = 0; k < 6; k++) { const h = 2.6 - 0.4 * (k + 1); addBox(world, 0.5, h, 1.8, X - 0.5 * (k + 0.5), -2.6 + h / 2, ZC, M.pillar); }
  addBox(world, 0.3, 6, 3.0, -0.15, 0, ZC, M.black);
  addLamp(1.6, ZC, 3.0, 0.7, true);
  interactables.push({ kind: 'exitdoor', x: 4.6, z: ZC, range: 2.4, minDot: 0.2 });
}
function resetExitDoor() {
  S.locks = 0; S.stairsOpen = false;
  if (!exitDoor.hinge) return;
  exitDoor.angle = 0; exitDoor.target = 0; exitDoor.hinge.rotation.y = 0; if (exitDoor.collider) exitDoor.collider.off = false;
  exitDoor.locks.forEach((L) => { L.state = 0; L.t = 0; L.group.visible = true; L.group.position.y = L.y0; L.group.rotation.z = 0; L.shackle.rotation.z = 0; });
}
function unlockNextLock() {
  const L = exitDoor.locks[S.locks];
  if (!L) return;
  L.state = 1; S.locks++;
  Snd.lockOpen(); triggerReach('pick', 0.6);
  toast('PADLOCK ' + S.locks + ' / ' + exitDoor.locks.length + ' OPEN', 1800);
  if (S.locks >= exitDoor.locks.length) setTimeout(() => { exitDoor.target = 1; Snd.door(); toast('THE DOOR GROANS OPEN...', 2400); }, 700);
  updateObjectives();
}
function useExitDoor() {
  if (S.locks >= exitDoor.locks.length) return;
  if (S.keys > S.locks) unlockNextLock();
  else { Snd.locked(); toast('SEALED BY 5 PADLOCKS.   ' + S.locks + ' / 5 OPEN\nFIND THE KEYS.', 2400); }
}
function updateExitDoor(dt) {
  if (S.act !== 1 || !exitDoor.hinge) return;
  exitDoor.locks.forEach((L) => {
    if (L.state !== 1) return;
    L.t += dt;
    if (L.t < 0.3) L.shackle.rotation.z = Math.min(1.2, L.t * 5);                   // shackle pops open …
    else { const f = L.t - 0.3; L.group.position.y = L.y0 - f * f * 4.5; L.group.rotation.z = f * 3; if (L.group.position.y < 0.08) L.group.visible = false; }   // … and the lock drops
  });
  const tgt = exitDoor.target ? 1.7 : 0;
  if (exitDoor.angle !== tgt) {
    exitDoor.angle = approach(exitDoor.angle, tgt, dt * 1.1);
    exitDoor.hinge.rotation.y = exitDoor.angle;
    if (exitDoor.collider) exitDoor.collider.off = exitDoor.angle > 0.6;
  }
  S.stairsOpen = exitDoor.angle > 1.0;
}

/* ---------- the scripted trip down the stairs ---------- */
const ACT2_LORE = 'You tumbled down into the dark abyss. You wake up bruised, surrounded by cold echoing dampness. The air smells of decay and standing water... and your portable motion tracker screen is completely shattered.';
let type2Timer = null;
function startFall() {
  S.act2FromMenu = false;
  S.cs = { type: 'fall', t: 0, fx: P.x, fz: P.z, fyaw: P.yaw, fpitch: P.pitch, cut: false, thuds: 0 };
  setMode('cutscene'); setPrompt(''); radar.up = false; S.mapUp = false; P.moving = false; P.running = false;
  Snd.gasp();
}
function updateFall(dt) {
  const c = S.cs;
  if (!c) return;
  c.t += dt;
  const t = c.t, WEST = Math.PI / 2;
  let x, y, pitch, roll = 0, yaw;
  if (t < 0.55) {                                                  // a step onto the first stair
    const e = ease3(t / 0.55);
    x = lerp(c.fx, 2.75, e); y = EYE_H - 0.1 * e; pitch = lerp(c.fpitch, -0.25, e); yaw = c.fyaw + angDiff(c.fyaw, WEST) * e;
  } else if (t < 1.0) {                                            // …and the foot finds nothing
    const e = ease3((t - 0.55) / 0.45);
    x = lerp(2.75, 2.3, e); y = lerp(EYE_H - 0.1, 1.05, e); pitch = lerp(-0.25, -1.0, e); roll = 0.4 * e; yaw = WEST;
  } else {                                                         // tumbling down the steps
    const k = clamp((t - 1.0) / 1.0, 0, 1);
    x = lerp(2.3, 0.5, k); y = lerp(1.05, -1.7, k * k); pitch = -1.0 + Math.sin(k * 14) * 0.6; roll = lerp(0.4, 4.5, k); yaw = WEST + Math.sin(k * 9) * 0.35;
    const th = [1.15, 1.4, 1.65];
    if (c.thuds < 3 && t > th[c.thuds]) { c.thuds++; Snd.thudDown(); }
  }
  const sh = t > 0.55 ? 0.03 : 0.006;
  S.dcam = { x: x + (Math.random() - 0.5) * sh, y: y + (Math.random() - 0.5) * sh, z: 7.5 + Math.sin(t * 6) * 0.08 * clamp(t - 0.55, 0, 1), yaw, pitch, roll };
  if (t >= 2.0 && !c.cut) { c.cut = true; el.cut.style.transition = 'none'; el.cut.style.opacity = '1'; Snd.duck(true); Snd.stomp(); }   // hard cut to pitch black…
  if (t >= 4.0) showAct2Lore();                                    // …for two seconds, then the story card
}
function showAct2Lore() {
  S.cs = null; S.dcam = null;
  el.cut.style.transition = 'none'; el.cut.style.opacity = '0';
  setMode('act2lore'); Snd.duck(false);
  let i = 0;
  el['act2-text'].textContent = '';
  clearInterval(type2Timer);
  type2Timer = setInterval(() => { i += 2; el['act2-text'].textContent = ACT2_LORE.slice(0, i); if (i >= ACT2_LORE.length) clearInterval(type2Timer); }, 34);
  try { document.exitPointerLock(); } catch (e) { /* ignore */ }
}
function startAct2() {
  clearInterval(type2Timer);
  el['act2-text'].textContent = ACT2_LORE;
  el.cut.style.transition = 'none'; el.cut.style.opacity = '1';
  setTimeout(() => {
    S.act = 2; buildWorld(newSeed(), 2); finishBegin();
    P.anim = { type: 'wake', t: 0, dur: 2.6 }; P.camY = 0.3; P.pitch = 0.9;
    fadeFromBlack(1800);
  }, 60);
}

/* ======================================================================
   ACT 2  —  THE SEWERS
   arched concrete tunnels · flooded floor · drain pipes · culverts · outfall hall · control console
   ====================================================================== */
const sewer = { water: null };
const SEWER_SHELL = new THREE.CylinderGeometry(1.5, 1.5, 3.0, 12, 1, true, -Math.PI / 2, Math.PI);
const SEWER_DISC = new THREE.CircleGeometry(0.78, 24), SEWER_RING = new THREE.TorusGeometry(0.8, 0.11, 8, 24);
const M0 = {};

function initSewerAssets() {
  if (T.sWall) return;
  const ph = (c, o) => new THREE.MeshPhongMaterial(Object.assign({ color: c, shininess: 6, specular: 0x0c0c0c }, o || {}));
  const blot = (g, w, h, n, a) => { for (let k = 0; k < n; k++) { const x = Math.random() * w, y = Math.random() * h, r = rnd(14, 60), gr = g.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,' + a + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } };
  T.sWall = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#5b5d5b'; g.fillRect(0, 0, w, h);
    dots(g, w, h, 7000, 30, 150, 0.3, 3);
    for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(0,0,0,' + rnd(0.05, 0.22).toFixed(2) + ')'; g.fillRect(Math.random() * w, 0, rnd(1, 5), rnd(60, h)); }    // drip streaks
    blot(g, w, h, 10, 0.35);
    g.fillStyle = 'rgba(0,0,0,0.42)'; g.fillRect(0, h * 0.8, w, h * 0.2);                                                                           // wet band
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);                                                                    // block joints
  });
  T.sFloor = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#2a2b2a'; g.fillRect(0, 0, w, h); dots(g, w, h, 9000, 10, 90, 0.4, 3);
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2;
    for (let k = 0; k < 9; k++) { let x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += rnd(-30, 30); y += rnd(-30, 30); g.lineTo(x, y); } g.stroke(); }
  });
  T.sArch = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#585a58'; g.fillRect(0, 0, w, h); dots(g, w, h, 5000, 30, 140, 0.25, 3); blot(g, w, h, 8, 0.4);
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; ln(g, 0, 8, w, 8); ln(g, 0, h - 8, w, h - 8);
  });
  T.water = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#6a6c69'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 90; k++) { const x = Math.random() * w, y = Math.random() * h, r = rnd(6, 28); g.strokeStyle = 'rgba(' + (Math.random() < 0.5 ? '255,255,255' : '0,0,0') + ',' + rnd(0.05, 0.16).toFixed(2) + ')'; g.lineWidth = rnd(1, 3); g.beginPath(); g.ellipse(x, y, r, r * 0.45, 0, 0, TAU); g.stroke(); }
    dots(g, w, h, 1500, 60, 180, 0.2, 2);
  });
  T.rust = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#585858'; g.fillRect(0, 0, w, h); dots(g, w, h, 3500, 20, 160, 0.4, 3); blot(g, w, h, 8, 0.5);
    for (let k = 0; k < 14; k++) { g.fillStyle = 'rgba(0,0,0,' + rnd(0.1, 0.3).toFixed(2) + ')'; g.fillRect(Math.random() * w, Math.random() * h, rnd(1, 3), rnd(10, 60)); }
  });
  T.plank = canvasTex(128, 32, (g, w, h) => {
    g.fillStyle = '#5a5a5a'; g.fillRect(0, 0, w, h); dots(g, w, h, 500, 20, 140, 0.4, 2);
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; for (let y = 4; y < h; y += 5) ln(g, 0, y + Math.random() * 2, w, y + Math.random() * 2);
  });
  M.sWall = ph(0xd2d2d2, { map: T.sWall });
  M.sFloor = ph(0xffffff, { map: T.sFloor });
  M.sArch = ph(0xc8c8c8, { map: T.sArch, side: THREE.DoubleSide });
  M.sCeil = ph(0xbfbfbf, { map: T.sArch });
  M.water = new THREE.MeshPhongMaterial({ color: 0x20231f, map: T.water, transparent: true, opacity: 0.8, shininess: 90, specular: 0xb0b0b0, depthWrite: false });
  M.rust = ph(0x6a6a6a, { map: T.rust, shininess: 18, specular: 0x333333 });
  M.rustDark = ph(0x3e3e3e, { map: T.rust });
  M.bars = ph(0x555555, { map: T.rust, shininess: 20, specular: 0x333333 });
  M.plank = ph(0x6a6a6a, { map: T.plank });
  M.daylight = new THREE.MeshBasicMaterial({ color: 0xf2f2f2, fog: false });
}
// furniture makers use M.wood / M.drawer / M.wall / M.pillar: in the sewers those become rusted metal and wet concrete
function useMaterials(act) {
  if (!M0.wood) { M0.wood = M.wood; M0.drawer = M.drawer; M0.wall = M.wall; M0.pillar = M.pillar; }
  if (act === 2) { M.wood = M.rustDark; M.drawer = M.rust; M.wall = M.sWall; M.pillar = M.sWall; }
  else { M.wood = M0.wood; M.drawer = M0.drawer; M.wall = M0.wall; M.pillar = M0.pillar; }
}

function buildSewerStructure() {
  const W = MW * TILE, D = MH * TILE;
  addFloorPlane(0, 0, W, D, 0, M.sFloor, 3);                                       // concrete…
  sewer.water = addFloorPlane(0, 0, W, D, 0.1, M.water, 5);                        // …under a skin of standing water
  sewer.water.receiveShadow = false;
  const lists = { 2: [], 3.6: [], 5: [] };
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    if (grid[idx(x, z)] !== 1) continue;
    let adj = false, tall = 2;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (inB(x + dx, z + dz) && grid[idx(x + dx, z + dz)] === 0) adj = true;
    if (!adj) continue;
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k], nz = z + DZ[k];
      if (inB(nx, nz) && grid[idx(nx, nz)] === 0) { const zn = zone[idx(nx, nz)]; if (zn === 3) tall = 5; else if ((zn === 1 || zn === 2) && tall < 3.6) tall = 3.6; }
    }
    lists[tall].push([x, z]);
  }
  [2, 3.6, 5].forEach((h) => {                                                      // low tunnel walls, taller chamber walls, tall hall walls
    const list = lists[h];
    if (!list.length) return;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE, h, TILE), M.sWall, list.length), d = new THREE.Object3D();
    list.forEach((p, i) => { d.position.set((p[0] + 0.5) * TILE, h / 2, (p[1] + 0.5) * TILE); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; world.add(im);
  });
  // ceilings: flat over the chambers + the hall, a half-pipe vault over every tunnel tile
  addCeilPlane(SAFE.x0 * TILE, SAFE.z0 * TILE, (SAFE.x1 + 1) * TILE, (SAFE.z1 + 1) * TILE, 3.4, M.sCeil, 3);
  rooms.forEach((r) => addCeilPlane(r.x0 * TILE, r.z0 * TILE, (r.x1 + 1) * TILE, (r.z1 + 1) * TILE, 3.6, M.sCeil, 3));
  addCeilPlane(HOUSE_W * TILE, TILE, (MW - 1) * TILE, (MH - 1) * TILE, 5.0, M.sCeil, 3);
  openTiles.forEach((t) => {
    if (zone[idx(t.x, t.z)] !== 0) return;
    const zax = !solid(t.x, t.z - 1) || !solid(t.x, t.z + 1), xax = !solid(t.x - 1, t.z) || !solid(t.x + 1, t.z);
    const cx = (t.x + 0.5) * TILE, cz = (t.z + 0.5) * TILE;
    if (zax || !xax) decoPart(baseM(cx, 2.0, cz, 0, -Math.PI / 2, 0), SEWER_SHELL, M.sArch, 0, 0, 0, 0, 0, 0, 1, 1, 1, true);
    if (xax) decoPart(baseM(cx, 2.0, cz, Math.PI / 2, -Math.PI / 2, 0), SEWER_SHELL, M.sArch, 0, 0, 0, 0, 0, 0, 1, 1, 1, true);
  });
}

function buildSewerDecor() {
  const dcn = Q().decor;
  openTiles.forEach((t) => {
    if (zone[idx(t.x, t.z)] !== 0) return;
    const cx = (t.x + 0.5) * TILE, cz = (t.z + 0.5) * TILE;
    for (let i = 0; i < 4; i++) {                                                   // drain pipes hugging the tunnel walls
      if (!solid(t.x + DX[i], t.z + DZ[i]) || Math.random() > 0.38 * dcn + 0.06) continue;
      const p = sidePos(t.x, t.z, i, 0.2), y = rnd(0.5, 1.25), r = rnd(0.08, 0.18), alongX = DX[i] === 0;
      decoPart(baseM(p[0], y, p[1], 0, alongX ? 0 : Math.PI / 2, alongX ? Math.PI / 2 : 0), cgeo(r, r, 3.0, 10), M.rust, 0, 0, 0);
      dBox(baseM(p[0], y, p[1], 0), M.dark, 0, 0, 0, 0.14, r * 2 + 0.1, 0.14);
    }
    if (Math.random() < 0.3 * dcn) {                                                // big pipe along the vault
      const zax = !solid(t.x, t.z - 1) || !solid(t.x, t.z + 1);
      decoPart(baseM(cx, 3.3, cz, 0, zax ? Math.PI / 2 : 0, zax ? 0 : Math.PI / 2), cgeo(0.2, 0.2, 3.0, 10), M.rust, 0, 0, 0, 0, 0, 0, 1, 1, 1, true);
    }
  });
  deadEnds.forEach((de) => {                                                        // round culvert mouths at the ends of dead-end tunnels
    const w0 = wallLocal(de.x, de.z, (de.dir + 2) % 4, 0, 0.03);
    decoPart(baseM(w0.x, 1.0, w0.z, w0.ry), SEWER_DISC, M.black, 0, 0, 0, 0, 0, 0, 1, 1, 1, true);
    decoPart(baseM(w0.x, 1.0, w0.z, w0.ry), SEWER_RING, M.sWall, 0, 0, 0.02, 0, 0, 0, 1, 1, 1, true);
  });
  // scattered rust-coloured debris
  for (let k = 0, n = Math.round(60 * dcn); k < n; k++) { const t = pick(openTiles); dBox(baseM((t.x + rnd(0.1, 0.9)) * TILE, 0.04, (t.z + rnd(0.1, 0.9)) * TILE, rnd(0, 3)), M.rubble, 0, 0, 0, rnd(0.1, 0.4), 0.08, rnd(0.1, 0.3), 0, 0, 0, true); }
}

function buildSewerHall() {
  GATE_POS = { x: (MW - 1) * TILE, z: (GATE_TZ + 0.5) * TILE };
  const XH = HOUSE_W * TILE, XE = (MW - 1) * TILE;
  for (let tx = HOUSE_W + 3; tx < MW - 3; tx += 4) for (let tz = 4; tz < MH - 3; tz += 4) {       // columns on a loose grid
    const x = (tx + 0.5) * TILE, z = (tz + 0.5) * TILE;
    if (Math.hypot(x - GATE_POS.x, z - GATE_POS.z) < 9) continue;
    if (YARD_DOORS.some((dz) => Math.abs(z - (dz + 0.5) * TILE) < 3.6 && x < XH + 12)) continue;
    decoPart(baseM(x, 0, z, 0), cgeo(0.5, 0.55, 5.0, 12), M.sWall, 0, 2.5, 0);
    decoPart(baseM(x, 0, z, 0), cgeo(0.8, 0.8, 0.3, 12), M.sWall, 0, 0.15, 0);
    addCollider(x - 0.55, z - 0.55, x + 0.55, z + 0.55);
  }
  for (let k = 0; k < 5; k++) decoPart(baseM(XH + (XE - XH) / 2, 4.3, rnd(8, MH * TILE - 8), 0, 0, Math.PI / 2), cgeo(0.35, 0.35, XE - XH, 12), M.rust, 0, 0, 0, 0, 0, 0, 1, 1, 1, true);
  for (let tx = HOUSE_W + 2; tx < MW - 2; tx += 6) for (let tz = 3; tz < MH - 2; tz += 6) addLamp((tx + 0.5) * TILE, (tz + 0.5) * TILE, 4.8, 1.5, Math.random() < 0.4);
  buildExitHatch();
}

/* ---------- the exit hatch (planks nailed across it) ---------- */
const exitHatch = { group: null, hinge: null, planks: [], angle: 0, open: false, t: 0, pried: false };
function buildExitHatch() {
  exitHatch.planks.length = 0; exitHatch.angle = 0; exitHatch.open = false; exitHatch.t = 0; exitHatch.pried = false;
  const g = newGroup(GATE_POS.x - 0.15, GATE_POS.z, -Math.PI / 2);                 // local +z points west, into the hall
  addBox(g, 2.9, 0.4, 0.5, 0, 2.7, 0, M.sWall); addBox(g, 0.5, 2.7, 0.5, -1.2, 1.35, 0, M.sWall); addBox(g, 0.5, 2.7, 0.5, 1.2, 1.35, 0, M.sWall);
  addBox(g, 1.9, 2.5, 0.02, 0, 1.25, -0.2, M.daylight);                            // what is behind it
  const hinge = new THREE.Group(); hinge.position.set(-0.85, 0, 0.05); g.add(hinge);
  addBox(hinge, 1.7, 2.45, 0.1, 0.85, 1.225, 0, M.rust); addBox(hinge, 0.12, 0.6, 0.12, 1.5, 1.2, 0.1, M.metal);
  for (let k = 0; k < 5; k++) {
    const pk = addBox(g, 2.5, 0.2, 0.06, rnd(-0.05, 0.05), 0.45 + k * 0.46, 0.2 + k * 0.004, M.plank, { rz: rnd(-0.06, 0.06) });
    exitHatch.planks.push({ mesh: pk, y0: pk.position.y, fall: 0 });
  }
  exitHatch.group = g; exitHatch.hinge = hinge;
  interactables.push({ kind: 'exit', x: GATE_POS.x - 1.5, z: GATE_POS.z, range: 2.5, minDot: 0.25, dur: 3.5, noiseT: 0 });
}

/* ---------- quest items, tables and the emergency radio ---------- */
const questSpots = [];
function rectFree(x0, z0, x1, z1) {
  for (let i = 0; i < colliders.length; i++) { const c = colliders[i]; if (c.off) continue; if (x1 > c.minX && x0 < c.maxX && z1 > c.minZ && z0 < c.maxZ) return false; }
  return true;
}
function findRoomSpot(r, hw, hd) {
  for (let k = 0; k < 160; k++) {
    const x = rnd(r.x0 * TILE + 1.6, (r.x1 + 1) * TILE - 1.6), z = rnd(r.z0 * TILE + 1.6, (r.z1 + 1) * TILE - 1.6);
    if (rectFree(x - hw, z - hd, x + hw, z + hd) && decoClear(x, z, 1.4)) return [x, z];
  }
  return [r.cxw, r.czw];
}
function makeQuestItem(type, x, z, y) {
  const g = newGroup(x, z, rnd(0, TAU)); g.position.y = y;
  if (type === 'screen') { addBox(g, 0.3, 0.02, 0.2, 0, 0.01, 0, M.dark); addBox(g, 0.26, 0.005, 0.16, 0, 0.022, 0, M.shadeOn); }
  else if (type === 'key') { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 12), M.metal); ring.rotation.x = Math.PI / 2; ring.position.set(-0.06, 0.02, 0); g.add(ring); addBox(g, 0.14, 0.015, 0.02, 0.03, 0.02, 0, M.metal); addBox(g, 0.02, 0.015, 0.04, 0.08, 0.02, 0.02, M.metal); }
  else if (type === 'battery') { const b = new THREE.Mesh(cgeo(0.05, 0.05, 0.22, 10), M.metal); b.rotation.z = Math.PI / 2; b.position.y = 0.05; g.add(b); addBox(g, 0.03, 0.04, 0.04, 0.12, 0.05, 0, M.shadeOn); }
  else { addBox(g, 0.7, 0.035, 0.035, 0, 0.02, 0, M.metal); addBox(g, 0.1, 0.035, 0.035, 0.34, 0.04, 0, M.metal, { rz: 0.5 }); }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 }));
  sprite.scale.set(0.8, 0.8, 1); sprite.position.set(x, y + 0.1, z); world.add(sprite);
  const q = { kind: 'quest', type, x, z, range: 1.9, minDot: 0.1, group: g, sprite, taken: false };
  interactables.push(q); questSpots.push(q);
  return q;
}
function makeRadio(x, z, y) {
  const g = newGroup(x, z, 0); g.position.y = y;
  addBox(g, 0.5, 0.3, 0.25, 0, 0.15, 0, M.dark); addBox(g, 0.4, 0.2, 0.01, 0, 0.16, 0.13, M.shade);
  addBox(g, 0.02, 0.5, 0.02, 0.2, 0.55, 0, M.metal);
  const dial = new THREE.Mesh(cgeo(0.04, 0.04, 0.02, 12), M.metal); dial.rotation.x = Math.PI / 2; dial.position.set(-0.12, 0.16, 0.14); g.add(dial);
  const r = { kind: 'radio', x, z, range: 1.9, minDot: 0.1, dur: 7, noiseT: 0, group: g };
  interactables.push(r);
  return r;
}
function buildQuest() {
  questSpots.length = 0;
  const place = (ri, type) => { const s = findRoomSpot(rooms[ri], 0.95, 0.6); makeTable(s[0], s[1], 0); makeQuestItem(type, s[0], s[1], 0.84); };
  place(2, 'screen'); place(0, 'key'); place(3, 'battery'); place(1, 'crowbar');
  const s = findRoomSpot(rooms[4], 0.95, 0.6);
  makeTable(s[0], s[1], 0); makeRadio(s[0], s[1], 0.84);
  doors.forEach((d) => { if (roomId[idx(d.ax, d.az)] === 4) { d.locked = true; d.target = 0; d.angle = 0; d.hinge.rotation.y = 0; d.collider.off = false; d.collider.locked = true; } });                // the control room's gates are locked
}

/* ---------- the central radar console + the "audio only" monitor ---------- */
const consoleRadar = { cv: null, ctx: null, tex: null, layout: null, blipT: -9, bx: 0, by: 0, sweep: 0 };
const sideStatic = { w: 64, h: 40, cv: null, ctx: null, img: null, tex: null, mat: null };
const audioScreen = { w: 256, h: 160, cv: null, ctx: null, img: null, tex: null };
function mkNoiseSurface(o) {
  o.cv = document.createElement('canvas'); o.cv.width = o.w; o.cv.height = o.h; o.ctx = o.cv.getContext('2d');
  o.tex = new THREE.CanvasTexture(o.cv); o.tex.minFilter = THREE.NearestFilter; o.tex.magFilter = THREE.NearestFilter; o.tex.generateMipmaps = false;
}
function drawNoise(o) {
  if (!o.ctx) return;
  if (!o.img) o.img = o.ctx.createImageData(o.w, o.h);
  const d = o.img.data;
  for (let i = 0; i < d.length; i += 4) { const v = 70 + ((Math.random() * 185) | 0); d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  o.ctx.putImageData(o.img, 0, 0); o.tex.needsUpdate = true;
}
function drawAudioScreen() {
  const a = audioScreen, g = a.ctx;
  if (!g) return;
  drawNoise(a);
  const c = cams[S.camSel] || { name: '—' };
  for (let b = 0, n = 2 + ((Math.random() * 3) | 0); b < n; b++) { g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, (Math.random() * a.h) | 0, a.w, 1 + ((Math.random() * 3) | 0)); }
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(12, 46, a.w - 24, 70);
  g.fillStyle = '#fff'; g.font = 'bold 30px "Courier New", monospace'; g.fillText('*AUDIO ONLY*', 24, 86);
  g.font = '16px "Courier New", monospace'; g.fillText('CH ' + pad2(S.camSel + 1) + '   ' + c.name, 24, 108);
  a.tex.needsUpdate = true;
}
function buildConsoleRadarLayout() {                                               // the whole sewer, seen from above
  const lay = document.createElement('canvas'); lay.width = lay.height = 512;
  const g = lay.getContext('2d'), s = 8, ox = 256 - MW * s / 2, oz = 256 - MH * s / 2;
  g.fillStyle = '#021208'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(70,255,130,0.22)'; g.lineWidth = 1;
  for (let r = 60; r <= 240; r += 60) { g.beginPath(); g.arc(256, 256, r, 0, TAU); g.stroke(); }
  ln(g, 256, 8, 256, 504); ln(g, 8, 256, 504, 256);
  g.fillStyle = 'rgba(40,160,80,0.35)';
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) if (grid[idx(x, z)] === 0) g.fillRect(ox + x * s, oz + z * s, s, s);
  g.strokeStyle = 'rgba(150,255,185,0.9)'; g.lineWidth = 1.5; g.beginPath();
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    if (grid[idx(x, z)] !== 0) continue;
    for (let k = 0; k < 4; k++) {
      if (!solid(x + DX[k], z + DZ[k])) continue;
      const x0 = ox + (x + (k === 1 ? 1 : 0)) * s, z0 = oz + (z + (k === 2 ? 1 : 0)) * s;
      g.moveTo(x0, z0); g.lineTo((k === 0 || k === 2) ? x0 + s : x0, (k === 1 || k === 3) ? z0 + s : z0);
    }
  }
  g.stroke();
  consoleRadar.layout = lay;
}
function updateConsoleRadar(dt) {
  const cr = consoleRadar;
  if (S.act !== 2 || !cr.ctx || !cr.layout) return;
  const g = cr.ctx;
  cr.sweep = (cr.sweep + dt * 1.25) % TAU;
  const a = cr.sweep;
  g.clearRect(0, 0, 512, 512);
  g.save(); g.beginPath(); g.arc(256, 256, 252, 0, TAU); g.clip();
  g.drawImage(cr.layout, 0, 0);
  for (let i = 0; i < 26; i++) {                                                   // the rotating green sweep beam
    const ang = a - i * 0.035;
    g.strokeStyle = 'rgba(130,255,170,' + (0.55 * (1 - i / 26)).toFixed(3) + ')'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(256, 256); g.lineTo(256 + Math.cos(ang) * 252, 256 + Math.sin(ang) * 252); g.stroke();
  }
  const sc = 8 / TILE, bx = 256 + (mon.x - MW * TILE / 2) * sc, by = 256 + (mon.z - MH * TILE / 2) * sc;
  if (mon.state !== 'KILL' && Math.abs(angDiff(Math.atan2(by - 256, bx - 256), a)) < 0.1 + dt * 1.25) { cr.blipT = S.time; cr.bx = bx; cr.by = by; }   // lit as the beam sweeps over it
  const age = S.time - cr.blipT;
  if (age < 2.6) {
    const al = Math.exp(-age * 1.1);
    g.shadowColor = '#3dff7a'; g.shadowBlur = 18; g.fillStyle = 'rgba(170,255,200,' + al.toFixed(3) + ')';
    g.beginPath(); g.arc(cr.bx, cr.by, 7, 0, TAU); g.fill(); g.shadowBlur = 0;
  }
  g.restore();
  g.strokeStyle = 'rgba(70,255,130,0.6)'; g.lineWidth = 4; g.beginPath(); g.arc(256, 256, 252, 0, TAU); g.stroke();
  cr.tex.needsUpdate = true;
}

function buildSewerSafeRoom() {
  addLamp(10.5, 7.8, WALL_H - 0.05, 1.8, false);
  const g = newGroup(10.5, 3.0, 0);                                                // the console wall (faces +z, into the room)
  addBox(g, 4.8, 0.9, 0.9, 0, 0.45, 0.46, M.rustDark); addBox(g, 4.8, 0.05, 0.95, 0, 0.92, 0.46, M.metal);
  addCollider(10.5 - 2.4, 3.0, 10.5 + 2.4, 3.95);
  consoleRadar.cv = document.createElement('canvas'); consoleRadar.cv.width = consoleRadar.cv.height = 512; consoleRadar.ctx = consoleRadar.cv.getContext('2d');
  consoleRadar.tex = new THREE.CanvasTexture(consoleRadar.cv); buildConsoleRadarLayout(); consoleRadar.blipT = -9;
  const rg = new THREE.Group(); rg.position.set(0, 1.62, 0.52); rg.rotation.x = -0.3; g.add(rg);
  rg.add(new THREE.Mesh(new THREE.CircleGeometry(0.62, 48), new THREE.MeshBasicMaterial({ map: consoleRadar.tex })));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.05, 8, 48), M.metal); ring.position.z = 0.01; rg.add(ring);
  addBox(g, 0.16, 0.6, 0.16, 0, 1.2, 0.5, M.dark);
  mkNoiseSurface(sideStatic); sideStatic.mat = new THREE.MeshBasicMaterial({ map: sideStatic.tex });
  [-1.95, -1.3, 1.95].forEach((x) => {                                              // static-covered monitors
    const m = new THREE.Group(); m.position.set(x, 0.95, 0.44); m.rotation.y = -x * 0.09; g.add(m);
    addBox(m, 0.62, 0.42, 0.07, 0, 0.21, 0, M.dark);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.34), sideStatic.mat); p.position.set(0, 0.21, 0.04); m.add(p);
  });
  mkNoiseSurface(audioScreen);                                                      // the broken-camera monitor: "*AUDIO ONLY*"
  const am = new THREE.Group(); am.position.set(1.3, 0.95, 0.45); am.rotation.x = -0.18; g.add(am);
  addBox(am, 0.62, 0.42, 0.07, 0, 0.21, 0, M.dark);
  laptopScreen.idleTex = audioScreen.tex; laptopScreen.mat = new THREE.MeshBasicMaterial({ map: audioScreen.tex });
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.34), laptopScreen.mat); sp.position.set(0, 0.21, 0.04); am.add(sp);
  laptopScreen.pose = { x: 11.8, y: 1.275, z: 4.062, yaw: 0, pitch: -0.18, fov: 36 };
  laptopSpot.x = 11.8; laptopSpot.z = 4.75;
  interactables.push({ kind: 'laptop', x: laptopSpot.x, z: laptopSpot.z, range: 2.0, minDot: 0.3 });
  makeChair(8.4, 5.0, Math.PI);
  const c1 = newGroup(16.4, 4.0, 0.3); addBox(c1, 0.9, 0.9, 0.9, 0, 0.45, 0, M.wood); addCollider(15.85, 3.45, 16.95, 4.55);
  const c2 = newGroup(4.3, 10.4, 0.2); addBox(c2, 1.2, 0.5, 0.8, 0, 0.25, 0, M.rust); addCollider(3.7, 10.0, 4.9, 10.8);
}

/* ---------- ten audio-only channels ---------- */
function buildChannels() {
  cams.length = 0;
  const runs = corridorRuns();
  const r1 = runs[0] || { ax: 7, az: 3, bx: 7, bz: 3 };
  const r2 = runs.find((r) => Math.hypot(r.ax - r1.ax, r.az - r1.az) > 8) || r1;
  const add = (name, x, z, tx, tz) => cams.push({ name, x, y: 2.4, z, tx, ty: 1.0, tz, amp: 0.4, spd: 0.3, ph: 0, mesh: null, hum: rnd(48, 110), drip: rnd(0.5, 2.2), rattle: rnd(7, 18) });
  const mid = (r) => [((r.ax + r.bx) / 2 + 0.5) * TILE, ((r.az + r.bz) / 2 + 0.5) * TILE, (r.bx + 0.5) * TILE, (r.bz + 0.5) * TILE];
  let m = mid(r1); add('WEST TUNNEL', m[0], m[1], m[2], m[3]);
  [0, 1, 2, 3, 5].forEach((ri) => add(rooms[ri].name, rooms[ri].cxw, rooms[ri].czw, rooms[ri].cxw + 3, rooms[ri].czw));
  m = mid(r2); add('EAST TUNNEL', m[0], m[1], m[2], m[3]);
  add('OUTFALL WEST', 104, 46.5, 130, 46.5); add('OUTFALL EAST', 140, 30, 150, 46.5);
  add(rooms[4].name, rooms[4].cxw, rooms[4].czw, rooms[4].cxw + 3, rooms[4].czw);
}

function updateSewer(dt) {
  if (S.act !== 2) return;
  T.water.offset.x += dt * 0.012; T.water.offset.y += dt * 0.007;
  if (S.frame % 3 === 0) { drawNoise(sideStatic); drawAudioScreen(); }
}

/* ======================================================================
   OBJECTIVES  ·  ACT 2 STORY LOGIC
   ====================================================================== */
const OBJ2 = [
  { key: 'explore', text: 'Explore the flooded sewers.' },
  { key: 'screen', text: 'Find a replacement screen to repair the Motion Tracker.' },
  { key: 'radio', text: 'Locate the locked Control Room and find a fresh battery to power the emergency radio to broadcast for help.' },
  { key: 'exit', text: 'Locate the sewer exit door.' },
  { key: 'crowbar', text: 'Find a heavy crowbar to pry away the wooden planks blocking the final exit hatch.' },
];
const QUEST_NAMES = { screen: 'Replacement Radar Screen', key: 'Control Room Key', battery: 'Fresh Battery', crowbar: 'Heavy Crowbar' };
function objectiveList() {
  if (S.act === 1) {
    return [
      { text: 'Find the 5 keys hidden in the house.  (' + S.keys + '/' + TOTAL_KEYS + ')', done: S.keys >= TOTAL_KEYS },
      { text: 'Unlock the 5 padlocks on the safe room door.  (' + S.locks + '/5)', done: S.locks >= 5 },
      { text: 'Go down the stairs.', done: false },
    ];
  }
  return OBJ2.map((o) => ({ text: o.text, done: !!S.obj[o.key] }));
}
function objectivesDone() { return objectiveList().filter((o) => o.done).length; }
function renderObjectives() {
  if (!el.objectives) return;
  const list = objectiveList();
  let html = '', pauseHtml = '';
  for (let i = 0; i < list.length; i++) {
    const o = list[i], row = '<div class="o' + (o.done ? ' done' : '') + '">' + (o.done ? '[x] ' : '[ ] ') + o.text + '</div>';
    if (i === 0 || list[i - 1].done) { html += row; pauseHtml += row; }       // tasks appear as the story unfolds
    else pauseHtml += '<div class="o locked">[ ] ???</div>';
  }
  let carry = '';
  if (S.act === 2) {
    const have = [];
    if (S.quest.key) have.push('Control Room key'); if (S.quest.battery) have.push('Fresh battery'); if (S.quest.crowbar && !S.obj.crowbar) have.push('Crowbar');
    if (have.length) carry = '<div class="o carry">Carrying: ' + have.join(', ') + '</div>';
    if (S.radarBroken) carry += '<div class="o carry">Motion Tracker: BROKEN</div>';
  }
  el.objectives.innerHTML = html + carry;
  if (el['pause-objectives']) el['pause-objectives'].innerHTML = '<h3>Objectives</h3>' + pauseHtml + carry;
}
const updateObjectives = renderObjectives;

function resetAct2State() {
  S.quest = { screen: false, key: false, battery: false, crowbar: false };
  S.obj = { explore: false, screen: false, radio: false, exit: false, crowbar: false };
  S.radarBroken = S.act === 2; S.radioDone = false; S.visited = new Set(); S.monitorOn = false;
  S.controlLocked = doors.some((d) => d.locked);
  doors.forEach((d) => { if (d.locked) { d.target = 0; d.angle = 0; d.hinge.rotation.y = 0; d.collider.off = false; d.collider.locked = true; } });
  questSpots.forEach((q) => { q.taken = false; q.group.visible = true; q.sprite.visible = true; });
  if (S.act === 2 && exitHatch.hinge) {
    exitHatch.planks.forEach((p) => { p.fall = 0; p.mesh.position.y = p.y0; p.mesh.rotation.z = 0; p.mesh.visible = true; });
    exitHatch.open = false; exitHatch.angle = 0; exitHatch.hinge.rotation.y = 0; exitHatch.t = 0; exitHatch.pried = false;
  }
  renderObjectives();
}

/* ---------- picking things up ---------- */
function collectQuest(q) {
  if (q.taken) return;
  q.taken = true; q.group.visible = false; q.sprite.visible = false;
  Snd.key(); triggerReach('pick', 0.6);
  if (q.type === 'screen') {                                                        // swapping the spare screen repairs the tracker
    S.quest.screen = true; S.obj.screen = true; S.radarBroken = false;
    Snd.laptop(); toast('YOU SWAP THE SHATTERED SCREEN.\nMOTION TRACKER REPAIRED', 3400);
  } else if (q.type === 'key') { S.quest.key = true; toast('CONTROL ROOM KEY', 2200); }
  else if (q.type === 'battery') { S.quest.battery = true; toast('FRESH BATTERY', 2200); }
  else if (q.type === 'crowbar') { S.quest.crowbar = true; toast('HEAVY CROWBAR', 2200); }
  renderObjectives();
}

/* ---------- the emergency radio ---------- */
function startRadio(it) {
  if (S.radioDone) { toast('THE RADIO IS STILL CRACKLING...', 1600); return; }
  if (!S.quest.battery) { Snd.locked(); toast('THE EMERGENCY RADIO IS DEAD.\nIT NEEDS A FRESH BATTERY.', 2800); return; }
  S.quest.battery = false; renderObjectives();
  toast('BROADCASTING FOR HELP...\nSTAY WHERE YOU ARE.', 3200);
  S.searching = { it, t: 0 }; it.noiseT = 0; Snd.radioStatic(); triggerReach('pick', it.dur);
}
function finishRadio(it) {
  S.radioDone = true; S.obj.radio = true; it.noiseT = 0;
  Snd.win(); toast('THE CALL WENT OUT.\nSOMEONE HEARD YOU.', 3400); renderObjectives();
}

/* ---------- the exit hatch ---------- */
function useExitHatch(it) {
  if (exitHatch.open) return;
  S.obj.exit = true;
  if (!S.obj.crowbar) {
    if (!S.quest.crowbar) { Snd.locked(); toast('THE HATCH IS BOARDED UP WITH HEAVY PLANKS.\nYOU NEED SOMETHING TO PRY THEM OFF.', 3200); renderObjectives(); return; }
    S.searching = { it, t: 0 }; it.noiseT = 0; Snd.gateCreak(0.8, false); triggerReach('door', it.dur); toast('PRYING OFF THE PLANKS...', 2200); renderObjectives(); return;
  }
  if (!S.radioDone) { Snd.locked(); toast("THE HATCH IS FREE, BUT IT WON'T BUDGE.\nSOMEONE HAS TO HEAR YOU FIRST.", 3200); }
}
function finishHatch(it) {
  S.obj.crowbar = true; exitHatch.pried = true;
  exitHatch.planks.forEach((p) => { p.fall = 0.001; });
  Snd.gateCreak(1, true); Snd.stomp(); toast('THE PLANKS FALL AWAY.', 2600); renderObjectives();
}

/* ---------- per-frame story state ---------- */
function updateAct2(dt) {
  if (S.act !== 2) return;
  if (S.mode === 'play') {
    const rid = roomId[idx(tileOf(P.x), tileOf(P.z))];
    if (rid >= 0) S.visited.add(rid);
    if (!S.obj.explore && (S.visited.size >= 3 || S.obj.screen || S.quest.key || S.quest.battery || S.quest.crowbar)) { S.obj.explore = true; renderObjectives(); }
    if (!S.obj.exit && Math.hypot(P.x - GATE_POS.x, P.z - GATE_POS.z) < 14 && hasLOS(P.x, P.z, GATE_POS.x - 1.2, GATE_POS.z)) { S.obj.exit = true; renderObjectives(); }
  }
  exitHatch.planks.forEach((p) => {
    if (p.fall > 0) { p.fall += dt; p.mesh.position.y = Math.max(0.05, p.y0 - p.fall * p.fall * 6); p.mesh.rotation.z += dt * 2; if (p.fall > 1.4) p.mesh.visible = false; }
  });
  // radio call transmitted + planks gone  ->  the hatch opens and Act 2 is complete
  if (S.obj.radio && S.obj.crowbar && !exitHatch.open && S.mode === 'play') { exitHatch.open = true; exitHatch.t = 0; Snd.gateCreak(1, false); toast('THE HATCH GROANS OPEN...', 3200); }
  if (exitHatch.open) {
    exitHatch.t += dt;
    exitHatch.angle = approach(exitHatch.angle, 1.6, dt);
    exitHatch.hinge.rotation.y = -exitHatch.angle;
    if (exitHatch.t > 3.0 && S.mode === 'play') winGame();
  }
}

/* ---------- the portable tracker, cracked and full of static (until you swap the screen) ---------- */
const CRACKS = [[[40, 0], [70, 60], [55, 110], [95, 170], [80, 270]], [[250, 0], [230, 70], [270, 130], [240, 200], [300, 270]], [[0, 140], [90, 130], [160, 150], [240, 125], [360, 160]]];
function drawBrokenRadar() {
  const g = radar.ctx || (radar.ctx = el['radar-canvas'].getContext('2d')), W = 360, H = 270;
  g.fillStyle = '#031208'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 280; i++) { const v = (50 + Math.random() * 205) | 0; g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.75)'; g.fillRect(Math.random() * W, Math.random() * H, rnd(2, 12), rnd(1, 3)); }
  g.strokeStyle = 'rgba(235,235,235,0.9)'; g.lineWidth = 2;
  CRACKS.forEach((c) => { g.beginPath(); c.forEach((p, i) => { if (i === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); }); g.stroke(); });
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, (S.time * 80) % H, W, 12);
  if (Math.random() < 0.8) { g.fillStyle = 'rgba(120,255,160,0.9)'; g.font = '22px "Courier New", monospace'; g.fillText('SIGNAL LOST', 100, 140); }
  if (vm.tex) vm.tex.needsUpdate = true;
}

/* ---------- the console's audio-only channels: what the monster sounds like from there ---------- */
function monitorHook() {
  const c = cams[S.camSel];
  if (!c) return;
  const dx = mon.x - c.x, dz = mon.z - c.z, d = Math.hypot(dx, dz);
  const vol = Math.pow(clamp(1 - d / 26, 0, 1), 1.3);
  if (vol < 0.02) return;
  const fx = c.tx - c.x, fz = c.tz - c.z, fl = Math.hypot(fx, fz) || 1, rx = -fz / fl, rz = fx / fl;       // the channel's right-hand direction
  Snd.monitorStep(vol, clamp((dx * rx + dz * rz) / (d || 1), -1, 1));
  if (mon.state === 'CHASE' && vol > 0.15 && Math.random() < 0.25) Snd.monitorGrowl(vol, 0);
}

/* ---------- main menu: Play -> choose an act ---------- */
function toActSelect() { Snd.init(); setMode('acts'); }
function pickAct(n) {
  Snd.init();
  if (n === 1) { S.act = 1; toLore(); return; }                      // Act 1: the story card, then the house
  S.act2FromMenu = true; showAct2Lore();                             // Act 2: the "you tumbled down..." card, then the sewers
}

/* ======================================================================
   SETTINGS · ABOUT · MENU EXTRAS · CONTROLLER MENU NAVIGATION
   ====================================================================== */
const settingsUIs = [];
let modalOpen = null, soonTimer = null;

function applyFx() { document.body.classList.toggle('fx-off', !Settings.fx); }
function applyShadowMode(mode) {
  const on = mode !== 'off';
  renderer.shadowMap.enabled = on;
  renderer.shadowMap.type = mode === 'soft' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  flash.castShadow = on;
  playerLight.castShadow = on && Q().playerShadow && !COARSE;
  // shadow-map defines are baked into the shaders, so every material has to be rebuilt
  scene.traverse((o) => {
    const m = o.material;
    if (!m) return;
    (Array.isArray(m) ? m : [m]).forEach((mm) => { mm.needsUpdate = true; });
  });
}
function buildSettingsUI(host) {
  host.innerHTML = '';
  const row = (label) => {
    const r = document.createElement('div'); r.className = 'set-row';
    const l = document.createElement('label'); l.textContent = label; r.appendChild(l); host.appendChild(r);
    return r;
  };
  const segment = (r, opts, get, set) => {
    const seg = document.createElement('div'); seg.className = 'seg';
    const btns = {};
    opts.forEach((o) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = o[1];
      b.addEventListener('click', () => { set(o[0]); Settings.save(); refreshSettingsUI(); });
      seg.appendChild(b); btns[o[0]] = b;
    });
    r.appendChild(seg);
    return btns;
  };
  const u = {};
  // look sensitivity — scales mouse (pointer lock), right stick and touch drag from one place
  const r1 = row('Look sensitivity');
  const range = document.createElement('input'); range.type = 'range'; range.min = '0.2'; range.max = '3'; range.step = '0.05'; range.value = String(Settings.look);
  const val = document.createElement('span'); val.className = 'set-val';
  range.addEventListener('input', () => { Settings.look = clamp(parseFloat(range.value) || 1, 0.2, 3); Settings.save(); refreshSettingsUI(); });
  r1.appendChild(range); r1.appendChild(val); u.range = range; u.val = val;
  u.shadowBtns = segment(row('Shadows'), [['hard', 'HARD'], ['soft', 'SOFT'], ['off', 'OFF']], null, (v) => { Settings.shadows = v; applyQuality(); applyShadowMode(v); });
  u.qualityBtns = segment(row('Quality preset'), [['low', 'LOW'], ['medium', 'MEDIUM'], ['high', 'HIGH']], null, (v) => { Settings.quality = v; applyQuality(); applyShadowMode(Settings.shadows); });
  const r3 = row('Screen grain / CRT effects');
  const fxBtn = document.createElement('button'); fxBtn.type = 'button'; fxBtn.className = 'tog';
  fxBtn.addEventListener('click', () => { Settings.fx = !Settings.fx; Settings.save(); applyFx(); refreshSettingsUI(); });
  r3.appendChild(fxBtn); u.fxBtn = fxBtn;
  const r4 = row('Seed (next game)');
  const seed = document.createElement('input'); seed.type = 'text'; seed.className = 'set-text'; seed.maxLength = 16; seed.placeholder = 'random';
  seed.addEventListener('change', () => { Settings.seed = seed.value.trim(); Settings.save(); refreshSettingsUI(); });
  r4.appendChild(seed); u.seed = seed;
  const r5 = row('Photos');
  const pb = document.createElement('button'); pb.type = 'button'; pb.className = 'tog'; pb.textContent = 'LOAD PHOTOS…';
  pb.addEventListener('click', () => el['photo-input'].click());
  const pc = document.createElement('button'); pc.type = 'button'; pc.className = 'tog'; pc.textContent = 'CLEAR';
  pc.addEventListener('click', () => { clearPickedPhotos(); refreshSettingsUI(); });
  const ps = document.createElement('span'); ps.className = 'set-note';
  r5.appendChild(pb); r5.appendChild(pc); r5.appendChild(ps); u.photoNote = ps;
  settingsUIs.push(u);
}
function refreshSettingsUI() {
  settingsUIs.forEach((u) => {
    u.range.value = String(Settings.look);
    u.val.textContent = Settings.look.toFixed(2) + 'x';
    ['hard', 'soft', 'off'].forEach((k) => u.shadowBtns[k].classList.toggle('on', Settings.shadows === k));
    ['low', 'medium', 'high'].forEach((k) => u.qualityBtns[k].classList.toggle('on', Settings.quality === k));
    u.fxBtn.textContent = Settings.fx ? 'ON' : 'OFF';
    u.fxBtn.classList.toggle('on', Settings.fx);
    if (document.activeElement !== u.seed) u.seed.value = Settings.seed || '';
    u.photoNote.textContent = photoStatus();
  });
  if (el['pause-seed']) el['pause-seed'].textContent = 'SEED ' + (S.seed || '—');
}
function openModal(id) { closeModals(); el[id].classList.add('open'); modalOpen = id; if (id === 'settings') refreshSettingsUI(); }
function closeModals() { el.settings.classList.remove('open'); el.about.classList.remove('open'); modalOpen = null; }
function showSoon() {
  el['soon-banner'].classList.add('on');
  clearTimeout(soonTimer);
  soonTimer = setTimeout(() => el['soon-banner'].classList.remove('on'), 2800);
}

/* ---- controller navigation: D-Pad / left stick move a visible focus outline, Cross / Square select, Circle goes back ---- */
const UINav = { el: null, key: '', padUsed: false };
function uiScope() {
  switch (S.mode) {
    case 'menu': return modalOpen ? el[modalOpen] : el.menu;
    case 'lore': return el.lore;
    case 'paused': return el.pause;
    case 'dead': return S.deathPhase === 'card' ? el.death : null;
    case 'won': return el.win;
    case 'acts': return el.acts;
    case 'act2lore': return el.act2lore;
    default: return null;
  }
}
function navTargets(scope) {
  const out = [], list = scope.querySelectorAll('button, input[type=range]');
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b.disabled) continue;
    const r = b.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;                    // hidden (display: none)
    out.push(b);
  }
  return out;
}
function navPick(fromRect, cands, from, dx, dy) {
  const fx = fromRect.left + fromRect.width / 2, fy = fromRect.top + fromRect.height / 2;
  let best = null, bs = 1e9;
  cands.forEach((c) => {
    if (c === from) return;
    const r = c.getBoundingClientRect(), ddx = r.left + r.width / 2 - fx, ddy = r.top + r.height / 2 - fy;
    const along = dx ? ddx * dx : ddy * dy, across = dx ? Math.abs(ddy) : Math.abs(ddx);
    if (along < 4) return;                                        // must lie in the pressed direction
    const score = along + across * 2.2;
    if (score < bs) { bs = score; best = c; }
  });
  return best;
}
function clearNavFocus() { if (UINav.el && UINav.el.classList) UINav.el.classList.remove('pad-focus'); UINav.el = null; }
function setNavFocus(b) {
  clearNavFocus();
  UINav.el = b; b.classList.add('pad-focus');
  try { b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* ignore */ }
  if (S.mode === 'dead') { S.deathChoice = b === el['btn-menu'] ? 1 : 0; updateDeathSel(); }
}
function navDefault(scope, t) { return scope.querySelector('.sel') || scope.querySelector('#btn-begin, #btn-resume, #btn-play, #btn-again') || t[0] || null; }
function uiBack() {
  if (S.mode === 'menu' && modalOpen) closeModals();
  else if (S.mode === 'acts') setMode('menu');
  else if (S.mode === 'lore') { clearInterval(typeTimer); setMode('acts'); }
  else if (S.mode === 'act2lore' && S.act2FromMenu) { clearInterval(type2Timer); setMode('acts'); }
  else if (S.mode === 'paused') setPause(false);
}
// returns true when the controller handled something this frame
function uiNavStep(inp) {
  const scope = uiScope();
  const key = S.mode + '|' + (modalOpen || '') + '|' + (S.deathPhase || '');
  const changed = key !== UINav.key;
  if (changed) { UINav.key = key; clearNavFocus(); }
  if (!scope) return false;
  const moved = inp.navX || inp.navY;
  if (!moved && !inp.select && !(inp.back && inp.pad)) {
    if (changed && UINav.padUsed) { const t = navTargets(scope), d = navDefault(scope, t); if (d) setNavFocus(d); }   // new screen: highlight its default straight away
    return false;
  }
  UINav.padUsed = true;
  const targets = navTargets(scope);
  if (inp.back && inp.pad) { uiBack(); return true; }
  if (!UINav.el || targets.indexOf(UINav.el) < 0) { const d = navDefault(scope, targets); if (d) setNavFocus(d); return true; }
  if (moved) {
    const cur = UINav.el;
    if (cur.type === 'range' && inp.navX) {                        // sliders: left / right change the value
      const step = parseFloat(cur.step) || 0.05;
      cur.value = String(clamp(parseFloat(cur.value) + inp.navX * step * 2, parseFloat(cur.min), parseFloat(cur.max)));
      cur.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    const nxt = navPick(cur.getBoundingClientRect(), targets, cur, inp.navX, inp.navY);
    if (nxt) { setNavFocus(nxt); Snd.camSwitch(); }
    return true;
  }
  if (inp.select && UINav.el.type !== 'range') { Snd.click(); UINav.el.click(); }
  return true;
}

function initMenuExtras() {
  buildSettingsUI(el['set-host-menu']); buildSettingsUI(el['set-host-pause']);
  refreshSettingsUI(); applyFx(); applyQuality(); applyShadowMode(Settings.shadows);
  el['btn-settings'].addEventListener('click', () => openModal('settings'));
  el['btn-set-back'].addEventListener('click', closeModals);
  el['btn-about'].addEventListener('click', () => openModal('about'));
  el['btn-about-close'].addEventListener('click', closeModals);
  el['btn-multi'].addEventListener('click', showSoon);
  el['photo-input'].addEventListener('change', () => {
    const files = el['photo-input'].files;
    if (files && files.length) pickPhotos(files).then((n) => { refreshSettingsUI(); toast(n ? n + ' PHOTO' + (n > 1 ? 'S' : '') + ' ADDED' : 'COULD NOT READ THOSE IMAGES', 2200); });
  });
  window.addEventListener('mousemove', () => { if (UINav.padUsed) { UINav.padUsed = false; clearNavFocus(); } });   // mouse takes over: hide the controller outline
}

function init() {
  buildWorld(newSeed());
  monMesh = buildMonsterMesh();
  buildViewmodel(); buildHotbar(); initMenuExtras(); initDust();
  { const bt = document.getElementById('build-tag'); if (bt) bt.textContent = 'BUILD ' + BUILD; }
  for (let i = 0; i < 10; i++) {                                              // ten camera tabs: keys 1-9 and 0
    const b = document.createElement('button');
    b.textContent = String((i + 1) % 10);
    b.addEventListener('click', () => { if (S.mode === 'laptop' && S.lzDir > 0 && S.lz > 0.9) selectCam(i); });
    el['cam-tabs'].appendChild(b);
  }

  el['btn-play'].addEventListener('click', toActSelect);
  el['btn-act1'].addEventListener('click', () => pickAct(1));
  el['btn-act2pick'].addEventListener('click', () => pickAct(2));
  el['btn-acts-back'].addEventListener('click', () => setMode('menu'));
  el['btn-act2'].addEventListener('click', startAct2);
  el['btn-begin'].addEventListener('click', beginGame);
  el['btn-retry'].addEventListener('click', () => chooseDeath('retry'));
  el['btn-menu'].addEventListener('click', () => chooseDeath('menu'));
  el['btn-again'].addEventListener('click', () => { S.act = 1; beginGame(); });
  el['btn-resume'].addEventListener('click', () => setPause(false));
  [el['btn-full'], el['btn-full2'], el['hud-full']].forEach((b) => { if (b) b.addEventListener('click', toggleFull); });
  if (Pad.supported()) {
    el['btn-hid'].style.display = 'inline-block';
    el['btn-hid'].addEventListener('click', () => {
      Pad.connect().then((ok) => { el['menu-hint'].textContent = ok ? 'CONTROLLER LIGHTBAR LINKED' : 'LIGHTBAR NOT LINKED (USB / BLUETOOTH DS4 ONLY)'; });
    });
  }
  document.addEventListener('fullscreenchange', () => {
    const t = document.fullscreenElement ? 'EXIT FULLSCREEN' : 'FULLSCREEN';
    el['btn-full'].textContent = t; el['btn-full2'].textContent = t;
  });
  document.addEventListener('pointerlockchange', () => {
    S.locked = document.pointerLockElement === renderer.domElement;
    if (!S.locked && S.mode === 'play' && !Input.isPad() && !Input.isTouch()) setPause(true);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); });
  renderer.domElement.addEventListener('click', () => { if (S.mode === 'play' && !document.pointerLockElement) lockPointer(); });
  window.addEventListener('gamepadconnected', () => { el['menu-hint'].textContent = 'CONTROLLER CONNECTED'; toast('CONTROLLER CONNECTED', 1800); });
  window.addEventListener('resize', onResize);
  const firstGesture = () => { Snd.init(); };
  window.addEventListener('pointerdown', firstGesture); window.addEventListener('keydown', firstGesture);

  resetGame();
  mon.grace = 999;
  setMode('menu');
  startPhotoLoad();
  window.MONOCHROME = {
    S, P, mon, breath, grid, zone, rooms, closets, interactables, searchSpots, cams, lamps, openTiles, deadEnds, bfs, dieNow, fieldP, hasLOS,
    resolveCollisions, updateMonster, updatePlayer, lightGroupList, radar, chooseDeath, toMenu, toggleRadar, updateRadar, Settings, vm,
    applyShadowMode, applyFx, applyQuality, openModal, closeModals, isModalOpen: () => modalOpen, world, decoCount: () => decoParts,
    beginGame: () => beginGame(true), buildWorld, newSeed, mulberry32, QUALITY, Q, Input, UINav, uiNavStep, navPick,
    inv, invAdd, selectSlot, useSelected, tapSlot, pickups, flares, ITEM_DEFS, doors, doorFrames, doorEdges, toggleDoor, monsterDoorCheck, updateDoors,
    openLaptop, closeLaptop, selectCam, updateLaptop, camAim, toggleMap, enterCloset, exitCloset, updatePlayerAnim, updateClosetDoors,
    photoPool, photoSlots, processPhoto, addPhoto, addPhotosToWorld, photoStatus, DEATH_ANIM, updateDeath, lampSlots, lampFix, laptopScreen, feedRT,
    setMode, discovered, corridorRuns, Snd, exitDoor, exitHatch, questSpots, consoleRadar, audioScreen, sideStatic, startFall, updateFall, startAct2, showAct2Lore, collectQuest, startRadio,
    objectiveList, renderObjectives, objectivesDone, drawBrokenRadar, monitorHook, unlockNextLock, useExitDoor, resetAct2State, OBJ2, toActSelect, pickAct, uiBack,
  };
  requestAnimationFrame(frame);
}
init();
})();
