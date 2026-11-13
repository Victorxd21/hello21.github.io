/* ==========================================================================
   MONOCHROME  ·  game.js
   Three.js r128 (CDN) · Web Audio API · Gamepad API · WebHID (optional lightbar)
   Everything (textures, models, sound) is generated procedurally.
   ========================================================================== */
(() => {
'use strict';
/* debug flags: read by the game loop (all neutral by default) */
const DBG = {
  panel: false, timeScale: 1, freeze: false, god: false, noclip: false, flyY: 0, speed: 1, monSpeed: 1, freezeMon: false, hideMon: false, noDetail: false,
  hideUI: false, keepFx: false, hideVM: false, deathType: null, forceDie: false, fov: 0, fog: -1, amb: -1, fullbright: false, wire: false, infBreath: false,
  fps: false, shotScale: 1, lookX: 0, lookY: 0, keys: {}, watches: [], history: [], hpos: 0, fpsNow: 60,
  gizmos: { colliders: false, monster: false, player: false, path: false, inShots: false },
  cam: { on: false, x: 0, y: 1.6, z: 0, yaw: 0, pitch: 0, speed: 5, lamp: false, fov: 72 },
  lab: { on: false, armL: null, armR: null, legL: null, legR: null, curl: 0, lean: 0, headScale: 1, eyeScale: 1, duck: 0, crouch: 0, reach: 0, speed: 0, jaw: null, spin: 0, state: 'PATROL' },
};


const BUILD = 13;
window.MONOCHROME_BUILD = BUILD;       // index.html checks this to catch mismatched/old files

// refuse to boot on a stale index.html (it would be missing the newer screens)
const REQUIRED_IDS = ['viewport', 'btn-about', 'btn-multi', 'radar-canvas', 'death-stats', 'set-host-menu', 'set-host-pause',
  'hotbar', 'choke', 'pause-seed', 'photo-input', 't-radar', 'stick', 'objectives', 'acts', 'act2lore', 'btn-act2', 'keypad', 'term-text', 'mp', 'lobby', 'btn-vr'];
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
  look: 1, shadows: 'hard', fx: true, quality: 'medium', seed: '', binds: {},
  load() {
    try {
      const s = JSON.parse(localStorage.getItem('monochrome.settings') || '{}');
      if (typeof s.look === 'number') this.look = clamp(s.look, 0.2, 3);
      if (['hard', 'soft', 'off'].indexOf(s.shadows) >= 0) this.shadows = s.shadows;
      if (typeof s.fx === 'boolean') this.fx = s.fx;
      if (['low', 'medium', 'high'].indexOf(s.quality) >= 0) this.quality = s.quality;
      if (typeof s.seed === 'string') this.seed = s.seed.slice(0, 16);
      if (s.binds && typeof s.binds === 'object') this.binds = s.binds;
    } catch (e) { /* storage unavailable: defaults */ }
  },
  save() { try { localStorage.setItem('monochrome.settings', JSON.stringify({ look: this.look, shadows: this.shadows, fx: this.fx, quality: this.quality, seed: this.seed, binds: this.binds })); } catch (e) { /* ignore */ } },
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
let TOTAL_KEYS = 5;
const HOLD_NEEDED = 4.2;
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
function generateMaze(act, floor) {
  grid.fill(1); zone.fill(0); roomId.fill(-1);
  initRoomsAct1(); pitMask.fill(0); blockedEdges.clear(); platforms.length = 0; ramps.length = 0; guardNav = false;
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
  for (let z = SAFE.z0; z <= SAFE.z1; z++) for (let x = SAFE.x0; x <= SAFE.x1; x++) { grid[idx(x, z)] = 0; zone[idx(x, z)] = floor === 2 ? 0 : 1; }
  grid[idx(DOOR.x, DOOR.z)] = 0;
  if (act !== 2 && floor !== 2) { grid[idx(0, 2)] = 0; zone[idx(0, 2)] = 1; }           // the stair alcove behind the safe room's exit door

  // backyard
  if (floor !== 2) {                                                  // (upstairs has no back yard)
    for (let z = 1; z < MH - 1; z++) for (let x = HOUSE_W; x < MW - 1; x++) { grid[idx(x, z)] = 0; zone[idx(x, z)] = 3; }
    YARD_DOORS.forEach((z) => { grid[idx(HOUSE_W - 1, z)] = 0; });
  }

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
      if (solid(x, z) || (inB(x, z) && pitMask[idx(x, z)])) pushFromBox(pos, r, x * TILE, z * TILE, (x + 1) * TILE, (z + 1) * TILE);
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
  if (!inB(tx, tz) || grid[idx(tx, tz)] === 1 || pitMask[idx(tx, tz)]) return out;
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
      if (grid[n] === 1 || zone[n] === 1 || out[n] >= 0 || pitMask[n]) continue;
      if (blockedEdges.size && blockedEdges.has(i * 4096 + n)) continue;
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
    tabOn: ok(() => { burst(master, 0.16, 'bandpass', 900, 1.5, 0.18); tone(master, 'sine', 300, 780, 0.05, 0.18); tone(master, 'sine', 780, 1170, 0.04, 0.1, 0.12); }),
    tabOff: ok(() => { tone(master, 'sine', 700, 220, 0.05, 0.2); burst(master, 0.08, 'lowpass', 600, 1, 0.12); }),
    tabSwitch: ok(() => { burst(master, 0.12, 'bandpass', 2400, 2, 0.08); tone(master, 'square', 500, 900, 0.025, 0.07); }),
    whoosh: ok((v) => { burst(master, 0.2 * (v || 1), 'bandpass', 500, 0.8, 0.8, 0, 0.25); }),
    menuClick: ok(() => { tone(master, 'square', 880, 440, 0.05, 0.07); burst(master, 0.1, 'highpass', 3000, 1, 0.04); }),
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
    crawl: ok(() => { burst(master, 0.5, 'bandpass', 500, 0.8, 0.5, 0, 0.05); burst(master, 0.25, 'highpass', 2400, 1, 0.2, 0.1, 0.01); thump(master, 0.3, 90, 0.2, 0.25); }),
    kp: ok((f) => { tone(master, 'square', f, 0, 0.05, 0.07); }),
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

  const TCH = { hold: false, on: false, mx: 0, mz: 0, lx: 0, ly: 0, runOn: false, breath: false, flags: {}, stickId: null, lookId: null, lastX: 0, lastY: 0 };
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
  bindBtn('t-interact', () => { TCH.flags.interact = true; TCH.hold = true; }, () => { TCH.hold = false; });
  bindBtn('t-tprev', () => { TCH.flags.sPrev = true; });
  bindBtn('t-tnext', () => { TCH.flags.sNext = true; });
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
      hold: false, sPrev: false, sNext: false, mnavX: 0, mnavY: 0,
    };
    const look = lookScale();
    // keyboard + mouse
    const bc = bindCode;
    o.mx = (down[bc('moveR')] ? 1 : 0) - (down[bc('moveL')] ? 1 : 0);
    o.mz = (down[bc('moveF')] ? 1 : 0) - (down[bc('moveB')] ? 1 : 0);
    o.run = !!(down[bc('run')] || down.ShiftRight);
    o.breath = !!down[bc('breath')];
    o.interact = !!edge[bc('interact')]; o.hold = !!down[bc('interact')]; o.flash = !!edge[bc('flash')]; o.journal = !!edge[bc('journal')];
    o.back = !!(edge.Escape || edge.Backspace);
    o.prev = !!(edge.ArrowLeft || edge[bc('moveL')]); o.next = !!(edge.ArrowRight || edge[bc('moveR')]);
    o.pause = !!edge[bc('pause')]; o.radar = !!edge[bc('tablet')]; o.confirm = !!(edge.Enter || edge.NumpadEnter);
    o.use = !!edge[bc('use')]; o.itemPrev = !!edge[bc('itemPrev')]; o.itemNext = !!edge[bc('itemNext')];
    o.sPrev = !!edge[bc('screenPrev')]; o.sNext = !!edge[bc('screenNext')];
    o.mnavY = (edge.ArrowDown || edge[bc('moveB')] ? 1 : 0) - (edge.ArrowUp || edge[bc('moveF')] ? 1 : 0);
    o.mnavX = (edge.ArrowRight || edge[bc('moveR')] ? 1 : 0) - (edge.ArrowLeft || edge[bc('moveL')] ? 1 : 0);
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
      if (E(13)) o.radar = true;                          // D-Pad down: the tablet
      if (E(4)) o.sPrev = true;                           // L1 / R1: tablet screens and cameras
      if (E(5)) o.sNext = true;
      if (now[2]) o.hold = true;                          // Square held: zoom the tablet
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
      if (TCH.flags.sPrev) o.sPrev = true;
      if (TCH.flags.sNext) o.sNext = true;
      if (TCH.hold) o.hold = true;
      TCH.flags = {};
    }

    if (VR.active) vrFillInput(o, dt);                                        // the VR controllers are the input
    const m = Math.hypot(o.mx, o.mz);
    if (m > 1) { o.mx /= m; o.mz /= m; }
    o.pad = padActive;
    o.any = false; for (const k in edge) { o.any = true; break; }
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
    if (VR.active) { vrHaptic(strong, weak, ms); return; }                  // controllers buzz instead
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
  'settings', 'about', 'controls', 'ctl-list', 'btn-ctl-reset', 'btn-ctl-back', 'btn-settings', 'btn-about', 'btn-about-close', 'btn-set-back', 'btn-multi', 'soon-banner', 'set-host-menu', 'set-host-pause',
  'hotbar', 'choke', 'pause-seed', 'photo-input',
  'objectives', 'pause-objectives', 'acts', 'btn-act1', 'btn-act2pick', 'btn-acts-back', 'act2lore', 'act2-text', 'btn-act2', 'win-title', 'win-text', 'term-view', 'term-text', 'keypad', 'kp-code', 'kp-msg', 'kp-keys', 'kp-close',
  'mp', 'mp-name', 'mp-create', 'mp-code-in', 'mp-join', 'mp-list', 'mp-msg', 'mp-back', 'lobby', 'lb-code', 'lb-public', 'lb-private', 'lb-players', 'lb-keys', 'lb-start', 'lb-wait', 'lb-vis-note', 'lb-leave', 'lb-msg', 'mp-hud', 'btn-leave-mp', 'btn-vr',
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
  (S.floor === 2 ? [[6, 0, HOUSE_W * TILE, MH * TILE], [0, 0, 3, MH * TILE], [3, 0, 6, 6], [3, 9, 6, MH * TILE]] : [[3, 0, HOUSE_W * TILE, MH * TILE], [0, 0, 3, 6], [0, 9, 3, MH * TILE]]).forEach((r) => addFloorPlane(r[0], r[1], r[2], r[3], 0, M.floor, 2.5));   // (with a hole for the stairwell)
  const yw = (MW - HOUSE_W) * TILE;
  const gg = new THREE.PlaneGeometry(yw, MH * TILE); gg.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(gg, M.ground); ground.position.set(HOUSE_W * TILE + yw / 2, 0, MH * TILE / 2); ground.receiveShadow = true; if (S.floor !== 2) world.add(ground);
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
  if (S.floor !== 2) YARD_DOORS.forEach((z) => lintel(HOUSE_W - 1, z));

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

  // chair, bed, crates
  makeChair(10.5, 5.15, Math.PI);
  const bed = newGroup(4.5, 10.4, 0);
  addBox(bed, 1.2, 0.3, 2.1, 0, 0.2, 0, M.wood); addBox(bed, 1.1, 0.2, 2.0, 0, 0.45, 0, M.sheet); addBox(bed, 0.7, 0.12, 0.35, 0, 0.62, -0.75, M.sheet);
  addCollider(3.9, 9.35, 5.1, 11.45);
  const c1 = newGroup(16.4, 4.0, 0.3); addBox(c1, 0.9, 0.9, 0.9, 0, 0.45, 0, M.wood); addCollider(15.85, 3.45, 16.95, 4.55);
  const c2 = newGroup(16.9, 5.2, 0.1); addBox(c2, 0.6, 0.6, 0.6, 0, 0.3, 0, M.drawer); addCollider(16.55, 4.9, 17.25, 5.5);
  buildSafeExtras();
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

function assignKeys(K) {
  K = K == null ? TOTAL_KEYS : K;
  searchSpots.forEach((s) => { s.hasKey = false; s.searched = false; if (s.fronts) s.fronts.forEach((f) => { f.position.z = s.frontZ; }); });
  const indoor = shuffle(searchSpots.filter((s) => !s.yard && Math.hypot(s.x - 10.5, s.z - 7.5) > 20));
  const yard = shuffle(searchSpots.filter((s) => s.yard));
  const chosen = [];
  indoor.forEach((s) => { if (chosen.length < K - 1 && chosen.every((c) => Math.hypot(c.x - s.x, c.z - s.z) > 24)) chosen.push(s); });
  indoor.forEach((s) => { if (chosen.length < K - 1 && chosen.indexOf(s) < 0) chosen.push(s); });
  if (yard.length) chosen.push(yard[0]);
  shuffle(searchSpots.slice()).forEach((s) => { if (chosen.length < K && chosen.indexOf(s) < 0) chosen.push(s); });
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
  const faces = wallFaces(), dcn = QD();
  // reserve wall spots for photo frames (the first three are in the safe room, so you see them straight away)
  photoSlots.push({ x: 2, z: 3, i: 2, used: false }, { x: 5, z: 1, i: 0, used: false }, { x: 1, z: 1, i: 3, used: false });
  faces.forEach((f, q) => { if (q % 6 === 0 && photoSlots.length < 24) { photoSlots.push({ x: f.x, z: f.z, i: f.i, used: false }); wallDeco.add(f.x + ',' + f.z + ',' + f.i); } });
  const frameMax = Math.round(46 * QD());
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
  for (let k = 0, n = Math.round(90 * QD()); k < n; k++) { const t = pick(openTiles); litterPaper((t.x + rnd(0.05, 0.95)) * TILE, (t.z + rnd(0.05, 0.95)) * TILE); }
  for (let k = 0, n = Math.round(30 * QD()); k < n; k++) { const t = pick(openTiles); if (t.x < HOUSE_W) floorStain((t.x + rnd(0.2, 0.8)) * TILE, (t.z + rnd(0.2, 0.8)) * TILE, rnd(0.8, 2.0)); }
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
  for (let k = 0, n = Math.round(80 * QD()); k < n; k++) {
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
  for (let k = 0, n = Math.round(140 * QD()); k < n; k++) {
    const x = rnd(XH + 2, XE - 2), z = rnd(ZN + 2, ZS - 2);
    decoPart(baseM(x, 0.009, z, rnd(0, TAU), -Math.PI / 2, 0), UP, M.stain, 0, 0, 0, 0, 0, 0, rnd(0.6, 1.8), rnd(0.6, 1.8), 1, true);
  }
  // far tree silhouettes beyond the fence, against the haze
  const far = [];
  for (let k = 0, n = Math.round(90 * QD()); k < n; k++) {
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
  act: 1, floor: 1, floorGo: null, locks: 0, stairsOpen: false, cs: null, quest: { screen: false, battery: false, lockerKey: false, crowbar: false }, obj: { explore: false, screen: false, radio: false, exit: false, crowbar: false },
  radarBroken: false, radioDone: false, visited: new Set(), monitorOn: false, controlLocked: false, act2FromMenu: false, codeSeen: [false, false, false, false], codeOk: false,
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
const ACTIVE = ['play', 'laptop', 'journal', 'note', 'terminal', 'keypad', 'spectate'];

function setMode(m) {
  S.mode = m; document.body.setAttribute('data-mode', m);
  el.viewport.classList.toggle('cctv', m === 'laptop' || ((m === 'menu' || m === 'lore') && !m3On()));   // security-camera look
}
let toastTimer = 0;
function toast(msg, ms) { VR.toastText = msg; VR.toastT = (ms || 2200) / 1000; el.toast.textContent = msg; el.toast.classList.add('on'); toastTimer = (ms || 2200) / 1000; }
function setPrompt(text, prog) {
  VR.promptText = text ? text.replace('[E] / [Square]', '[TRIGGER]') : ''; VR.promptProg = text && prog != null ? prog : null;
  if (!text) { el.prompt.classList.remove('on'); return; }
  el.prompt.classList.add('on');
  if (Input.isTouch()) text = text.replace('[E] / [Square]', '[USE]'); else text = text.split('[E] / [Square]').join(bindHint('interact') + ' / [Square]');
  if (el['prompt-text'].textContent !== text) el['prompt-text'].textContent = text;
  const bar = el['prompt-bar'];
  if (prog == null) bar.style.display = 'none';
  else { bar.style.display = 'block'; bar.firstElementChild.style.width = Math.round(clamp(prog, 0, 1) * 100) + '%'; }
}
function updateKeyUI() { el['hud-keys'].textContent = 'KEYS ' + S.keys + ' / ' + TOTAL_KEYS + (floorsOn() && S.act === 1 ? '   ·   ' + FLOORS.name[S.floor || 1] : ''); drawCounter(); renderObjectives(); }

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
  const r = rooms[S.act === 2 ? sewerInfo.monRoom : 4];
  P.gy = 0; mon.gy = 0; mon.crouch = 0;
  mon.x = r.cxw; mon.z = r.czw; mon.yaw = 0; mon.wantYaw = 0; mon.state = 'PATROL'; mon.timer = 0; mon.wp = null; mon.wpKey = -1;
  mon.sees = false; mon.prevSees = false; mon.noSightT = 0; mon.ignoreT = 0; mon.grace = 12; mon.closetCool = {}; mon.lean = 0;
  mon.headScale = 1; mon.eyeScale = 1; mon.duck = 0; mon.reach = 0; mon.doorWork = null; mon.passDoor = null; mon.closet = null; mon.waiting = 1; mon.arrived = false; mon.speedNow = 0; mon.stepAcc = 0; mon.moved = 0; mon.dist = 100;
  breath.air = 1; breath.hold = 0; breath.noise = 0; breath.grace = 1.4; breath.gasp = 0; breath.holding = false;
  fieldPKey = -1;
  discovered.fill(0);
  for (let z = SAFE.z0 - 1; z <= SAFE.z1 + 1; z++) for (let x = SAFE.x0 - 1; x <= SAFE.x1 + 1; x++) discovered[idx(x, z)] = 1;
  discover();
  withSeed((S.seed ^ 0x51ed) >>> 0, () => assignKeys(floorKeys(1))); resetInventory(); resetExitDoor(); resetAct2State();
  document.body.setAttribute('data-act', String(S.act)); Snd.setAct(S.act); updateKeyUI(); vrOnReset(); floorsReset();
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
    case 'closet': return it.style === 'hole' ? '[E] / [Square]  Crawl Into Pipe' : '[E] / [Square]  Hide';
    case 'drawer': return it.searched ? null : '[E] / [Square]  Search Drawers';
    case 'floor': return it.searched ? null : (it.yard ? '[E] / [Square]  Dig Through Leaves' : '[E] / [Square]  Search Debris');
    case 'note': return '[E] / [Square]  Read Note';
    case 'gate': return S.keys >= TOTAL_KEYS ? '[E] / [Square]  Unlock Gate' : '[E] / [Square]  Inspect Gate';
    case 'door': if (it.locked) return S.quest.key ? '[E] / [Square]  Unlock Gate' : '[E] / [Square]  Locked Gate'; return S.act === 2 ? (it.target ? '[E] / [Square]  Close Gate' : '[E] / [Square]  Open Gate') : (it.target ? '[E] / [Square]  Close Door' : '[E] / [Square]  Open Door');
    case 'item': return it.taken ? null : '[E] / [Square]  Pick up ' + ITEM_DEFS[it.type].name;
    case 'exitdoor': return S.locks >= exitDoor.locks.length ? null : (S.keys > S.locks ? '[E] / [Square]  Unlock padlock (' + (S.locks + 1) + '/' + exitDoor.locks.length + ')' : '[E] / [Square]  Inspect Door');
    case 'alcove': return it.searched ? null : (it.style === 'toolbox' ? '[E] / [Square]  Search Toolbox' : '[E] / [Square]  Search Alcove');
    case 'terminal': return '[E] / [Square]  Read Terminal';
    case 'cterm': return S.codeOk ? '[E] / [Square]  Central Terminal' : '[E] / [Square]  Enter Security Code';
    case 'locker': return it.open ? null : (S.quest.lockerKey ? '[E] / [Square]  Unlock Locker' : '[E] / [Square]  Locked Locker');
    case 'radio': return S.radioDone ? null : ((S.codeOk && S.quest.battery) ? '[E] / [Square]  Insert battery & call for help' : '[E] / [Square]  Inspect Radio');
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
    case 'alcove': if (!it.searched) startSearch(it); break;
    case 'terminal': openTerminal(it); break;
    case 'cterm': openKeypad(it); break;
    case 'locker': useLocker(it); break;
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
  if (it.kind === 'alcove') { finishAlcove(it); return; }
  it.searched = true;
  if (MP.active) mpSend({ k: 'search', i: searchSpots.indexOf(it), by: MP.me });
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
function toggleMap() { S.mapUp = !S.mapUp; if (S.mapUp) { if (!VR.active) radar.up = false; drawJournal(); if (vm.mapTex) vm.mapTex.needsUpdate = true; vm.mapDraw = S.time; } Snd.note(); }

function enterCloset(c) {
  P.hiding = true; P.closet = c; P.flashOn = false; P.running = false; P.moving = false;
  P.anim = { type: 'in', t: 0, dur: c.style === 'hole' ? 1.1 : 0.85, fx: P.x, fz: P.z, fyaw: P.yaw, fpitch: P.pitch, c };
  c.group.visible = true; c.doorTarget = 1; c.doorFast = false;      // doors swing open, you step in and turn round, they close behind you
  triggerReach(c.style === 'hole' ? 'pick' : 'door', 0.55); if (c.style === 'hole') Snd.crawl(); else Snd.closet();
  if (mon.state === 'CHASE' || mon.state === 'INVESTIGATE' || mon.state === 'SEARCH') beginClosetCheck();
}
function exitCloset() {
  const c = P.closet; if (!c) return;
  const ex = c.exit || { x: c.x + c.face.x * 1.3, z: c.z + c.face.z * 1.3 };
  P.anim = { type: 'out', t: 0, dur: c.style === 'hole' ? 0.9 : 0.7, fx: P.x, fz: P.z, fyaw: P.yaw, fpitch: P.pitch, tx: ex.x, tz: ex.z, c };
  P.hiding = false; P.closet = null;
  c.group.visible = true; c.doorTarget = 1; c.doorFast = false;
  triggerReach(c.style === 'hole' ? 'pick' : 'door', 0.55); if (c.style === 'hole') Snd.crawl(); else Snd.closet();
}
function updatePlayerAnim(dt) {
  const a = P.anim, c = a.c;
  a.t += dt;
  const k = clamp(a.t / a.dur, 0, 1), e = ease3(k);
  if (a.type === 'in') {
    const hole = c.style === 'hole', ey = hole ? ease3(clamp((k - 0.45) / 0.55, 0, 1)) : e;       // crawling in: you face the pipe, then turn to watch the corridor
    P.x = lerp(a.fx, c.inside.x, e); P.z = lerp(a.fz, c.inside.z, e);
    P.yaw = a.fyaw + angDiff(a.fyaw, c.yaw) * ey; P.pitch = lerp(a.fpitch, hole ? 0.08 : 0.3, e);
    if (k > 0.55) c.doorTarget = 0;
    if (k >= 1) { c.doorOpen = 0; c.doorTarget = 0; c.doorL.rotation.y = 0; c.doorR.rotation.y = 0; c.group.visible = c.style === 'hole'; P.anim = null; }
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
  floorsTick(dt, inp);
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
        const base = (P.running ? RUN : WALK) * (P.boostT > 0 ? 1.25 : 1) * DBG.speed;
        const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
        const pos = { x: P.x + (fx * inp.mz + rx * inp.mx) * base * dt, z: P.z + (fz * inp.mz + rz * inp.mx) * base * dt };
        if (!DBG.noclip) resolveCollisions(pos, PLAYER_R, true);
        P.x = pos.x; P.z = pos.z;
        P.bob += base * dt * 2.2; P.stepAcc += base * dt;
        if (S.act === 2) { if (P.stepAcc >= (P.running ? 1.5 : 1.45)) { P.stepAcc = 0; Snd.stepWet(P.running ? 1 : 0.65); } }     // loud wet sloshing in the sewers
        else if (P.running && P.stepAcc >= 1.6) { P.stepAcc = 0; if (!(P.quietT > 0)) Snd.stepPlayer(); }
        else if (!P.running && P.stepAcc >= 2.6) P.stepAcc = 0;
      }
    } else { P.moving = false; P.running = false; }

    if (!P.hiding) P.gy = DBG.noclip ? DBG.flyY : approach(P.gy || 0, floorH(P.x, P.z), 4.5 * dt);
    if (S.stairsOpen && S.act === 1 && !P.hiding && P.x < 2.7 && Math.abs(P.z - 7.5) < 1.1) { startFall(); return; }     // you step onto the stairs…
    if (inp.flash && !P.hiding) { P.flashOn = !P.flashOn; Snd.click(); }
    if (VR.active) { if (inp.radar) toggleRadar(); if (inp.journal) toggleMap(); } else tabletInput(inp);
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
      else setPrompt(P.closet && P.closet.style === 'hole' ? '[E] / [Square]  Crawl Out' : '[E] / [Square]  Leave Closet');
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
  } else if (mode === 'terminal') {
    P.moving = false; P.running = false;
    if (inp.interact || inp.back || inp.journal || inp.select) setMode('play');
  } else if (mode === 'keypad') {
    P.moving = false; P.running = false;
    if (inp.back) setMode('play');
    else { if (inp.navX) kpMove(inp.navX); if (inp.navY) kpStep(-inp.navY); if (inp.select) kpSubmit(); }
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
  const cx = tileOf(m.x), cz = tileOf(m.z), cur = inB(cx, cz) ? field[cz * MW + cx] : -1;
  const direct = dist0 < 14 && hasLOS(m.x, m.z, tx, tz) && (!guardNav || navLineClear(m.x, m.z, tx, tz));   // never cut straight across a pit or through a platform
  if (!direct) {
    if (cur > 0) {
      let best = cur, bx = cx, bz = cz;
      for (let k = 0; k < 4; k++) {
        const nx = cx + DX[k], nz = cz + DZ[k];
        if (!inB(nx, nz)) continue;
        const v = field[nz * MW + nx];
        if (v >= 0 && v < best && !(blockedEdges.size && blockedEdges.has((cz * MW + cx) * 4096 + nz * MW + nx))) { best = v; bx = nx; bz = nz; }   // platform faces and stair rails are not steps
      }
      gx = (bx + 0.5) * TILE; gz = (bz + 0.5) * TILE;
    }
  }
  const dx = gx - m.x, dz = gz - m.z, d = Math.hypot(dx, dz);
  if (d > 0.001) {
    const step = Math.min(speed * dt, d);
    let pos = { x: m.x + dx / d * step, z: m.z + dz / d * step };
    resolveCollisions(pos, 0.3, 'jamb');
    m.slideT = (m.slideT || 0) - dt;
    if (Math.hypot(pos.x - m.x, pos.z - m.z) < step * 0.3 && step > 0.001) {                 // wedged against a pipe hole / rail: slide round it
      const px = -dz / d, pz = dx / d;
      let best = null, bg = Math.hypot(pos.x - m.x, pos.z - m.z);
      [1, -1].forEach((sg) => {
        if (m.slideT > 0 && m.slide && sg !== m.slide) return;                                // keep sliding the same way for a moment
        const q = { x: m.x + px * sg * step * 1.2 + dx / d * step * 0.3, z: m.z + pz * sg * step * 1.2 + dz / d * step * 0.3 };
        resolveCollisions(q, 0.3, 'jamb');
        const mv = Math.hypot(q.x - m.x, q.z - m.z);
        if (mv > bg * 1.2) { best = q; bg = mv; m.slide = sg; }
      });
      if (best) { pos = best; m.slideT = 0.7; }
    }
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
function onSpotted() {
  if (MP.active && MP.swapId && MP.swapId !== MP.me) { mpSend({ k: 'spotted', id: MP.swapId }); return; }
  S.flashT = 0.6; Snd.spotted(); Pad.rumble(1, 0.8, 500); toast('IT SEES YOU', 1400);
}
function monsterLeave() {
  if (MP.active && !MP.isHost) { mpSend({ k: 'leave', id: MP.me }); return; }
  mon.state = 'LEAVE'; mon.timer = 7; mon.wp = null; mon.wpKey = -1;
  if (mon.closet) mon.closetCool[mon.closet.id] = S.time + 35;
  Snd.growl(); if (!(MP.active && MP.swapId && MP.swapId !== MP.me)) toast('IT LEAVES...', 2000);
}

function updateMonster(dt) {
  const m = mon;
  if (m.away) { m.awayT -= dt; m.dist = 999; m.sees = false; if (m.awayT <= 0) monsterArrive(); return; }          // it is on the other floor
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
      m.lean = lerp(m.lean, c.style === 'hole' ? 0.1 : 0.38, Math.min(1, dt * 1.5));
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
  if (m.state !== 'KILL') {
    const peer = m.closet && m.closet.style === 'hole' && (m.state === 'STARE' || (m.state === 'CLOSET_CHECK' && Math.hypot(m.closet.front.x - m.x, m.closet.front.z - m.z) < 2.6));
    m.crouch = lerp(m.crouch || 0, peer ? 1 : 0, Math.min(1, dt * (peer ? 2.2 : 3)));       // crouches right down, eyes to the pipe mouth
    m.gy = approach(m.gy || 0, floorH(m.x, m.z), 4.5 * dt);
  }

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
  const active = mon.state === 'STARE' && P.hiding && S.mode !== 'dead' && mon.closet === P.closet;
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
  const g = new THREE.Group(), blk = M.black, hi = Settings.quality !== 'low';
  const skin = new THREE.MeshPhongMaterial({ color: 0x0b0b0b, specular: 0x333333, shininess: 34 });                 // wet, tight skin that catches the flashlight
  const bone = new THREE.MeshLambertMaterial({ color: 0x6b6b64 }), tooth = new THREE.MeshLambertMaterial({ color: 0xa9a9a0 });
  const cloth = new THREE.MeshLambertMaterial({ color: 0x151515, side: THREE.DoubleSide }), pit = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const cyl = (rt, rb, h, seg) => new THREE.CylinderGeometry(rt, rb, h, seg), box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const sph = (r, a, b) => new THREE.SphereGeometry(r, a || 10, b || 8), cone = (r, h, seg) => new THREE.ConeGeometry(r, h, seg || 5);
  const put = (parent, geo, mat, x, y, z, fine) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (fine) m.userData.fine = true; parent.add(m); return m; };
  const legs = [], arms = [], hands = [], knees = [], ankles = [], elbows = [], rags = [], wisps = [];

  /* ---- legs: digitigrade (backward knee, long foot, claws) ---- */
  [-1, 1].forEach((sx) => {
    const piv = new THREE.Group(); piv.position.set(sx * 0.13, 1.22, 0);
    const th = put(piv, cyl(0.07, 0.048, 0.604, 7), skin, 0, -0.29, 0.085); th.rotation.x = -0.285;                  // hip -> knee (down and forward)
    put(piv, sph(0.075, 8, 6), skin, 0, 0, 0);
    const knee = new THREE.Group(); knee.position.set(0, -0.58, 0.17); piv.add(knee);
    put(knee, sph(0.05, 8, 6), bone, 0, 0, 0.012, true);
    const sn = put(knee, cyl(0.046, 0.026, 0.472, 7), skin, 0, -0.22, -0.085); sn.rotation.x = 0.368;                  // knee -> ankle (down and back)
    const ank = new THREE.Group(); ank.position.set(0, -0.44, -0.17); knee.add(ank);
    put(ank, sph(0.032, 7, 5), bone, 0, 0, 0, true);
    const ft = put(ank, cyl(0.026, 0.019, 0.269, 6), skin, 0, -0.09, 0.1); ft.rotation.x = -0.837;                    // ankle -> toes
    for (let i = -1; i <= 1; i++) {
      put(ank, box(0.02, 0.016, 0.12), skin, i * 0.042, -0.172, 0.255, true);
      const c = put(ank, cone(0.011, 0.055, 4), bone, i * 0.042, -0.172, 0.348, true); c.rotation.x = Math.PI / 2;
    }
    const spur = put(ank, cone(0.012, 0.07, 4), bone, 0, -0.02, -0.05, true); spur.rotation.x = -Math.PI / 2;
    g.add(piv); legs.push(piv); knees.push(knee); ankles.push(ank);
  });

  /* ---- torso: pelvis, thin waist, ribcage with visible ribs, spine, shoulder blades, collarbones ---- */
  const upper = new THREE.Group(); upper.position.y = 1.22; g.add(upper);
  put(upper, box(0.3, 0.17, 0.19), skin, 0, 0.03, 0);
  put(upper, cyl(0.145, 0.115, 0.5, 10), skin, 0, 0.27, 0);
  const chest = new THREE.Group(); chest.position.y = 0.72; upper.add(chest);
  const ch = put(chest, sph(1, 14, 10), skin, 0, 0, 0); ch.scale.set(0.215, 0.31, 0.14);
  if (hi) for (let i = 0; i < 6; i++) {
    const y = -0.17 + i * 0.07, f = Math.sqrt(1 - (y / 0.31) * (y / 0.31));
    const rib = put(chest, new THREE.TorusGeometry(1, 0.011, 4, 16), bone, 0, y, 0, true); rib.rotation.x = Math.PI / 2; rib.scale.set(0.215 * f + 0.007, 0.14 * f + 0.007, 1);
  }
  if (hi) put(chest, box(0.026, 0.3, 0.012), bone, 0, 0, 0.142, true);
  put(upper, box(0.5, 0.1, 0.17), skin, 0, 0.98, 0);
  if (hi) {
    for (let i = 0; i < 11; i++) { const y = 0.06 + i * 0.087, v = put(upper, sph(0.021, 6, 5), bone, 0, y, y < 0.45 ? -0.126 : -0.141, true); v.scale.set(1, 0.8, 1); }
    [-1, 1].forEach((sx) => {
      const sb = put(upper, box(0.1, 0.14, 0.012), bone, sx * 0.12, 0.85, -0.142, true); sb.rotation.z = -sx * 0.25;
      const cb = put(upper, box(0.17, 0.016, 0.016), bone, sx * 0.12, 1.01, 0.085, true); cb.rotation.y = sx * 0.4; cb.rotation.z = -sx * 0.14;
    });
  }
  for (let i = 0; i < 6; i++) {                                                                                     // tattered cloth hanging from the waist
    const a = (i / 6) * Math.PI * 2, rg = new THREE.Group(); rg.position.set(Math.sin(a) * 0.15, 0.06, Math.cos(a) * 0.12); rg.rotation.y = a;
    put(rg, box(0.07, 0.5 + (i % 3) * 0.08, 0.012), cloth, 0, -0.27 - (i % 3) * 0.04, 0.0, true); upper.add(rg); rags.push(rg);
  }

  /* ---- arms: shoulder, upper arm, elbow, forearm, long clawed hand ---- */
  [-1, 1].forEach((sx) => {
    const piv = new THREE.Group(); piv.position.set(sx * 0.3, 0.96, 0);
    put(piv, sph(0.056, 8, 6), skin, 0, 0, 0);
    put(piv, cyl(0.04, 0.03, 0.64, 7), skin, 0, -0.32, 0);
    const el = new THREE.Group(); el.position.y = -0.64; piv.add(el);
    put(el, sph(0.034, 7, 5), skin, 0, 0, 0); put(el, sph(0.02, 6, 4), bone, 0, 0, -0.03, true);
    put(el, cyl(0.03, 0.021, 0.7, 7), skin, 0, -0.35, 0);
    const hand = new THREE.Group(); hand.position.y = -0.71; el.add(hand);
    put(hand, sph(0.026, 6, 5), bone, 0, 0, 0, true);
    put(hand, box(0.1, 0.13, 0.035), skin, 0, -0.065, 0);
    const th = put(hand, box(0.015, 0.1, 0.015), skin, -sx * 0.055, -0.07, 0.01, true); th.rotation.z = sx * 0.5;       // thumb
    const fingers = [], fingers2 = [];
    for (let f = 0; f < 4; f++) {                                                                                      // two-segment fingers that can close round a throat
      const fp = new THREE.Group(); fp.position.set(-0.036 + f * 0.024, -0.13, 0);
      put(fp, box(0.014, 0.12, 0.014), skin, 0, -0.06, 0);
      const f2 = new THREE.Group(); f2.position.y = -0.12; fp.add(f2);
      put(f2, sph(0.0105, 5, 4), bone, 0, 0, 0, true);
      put(f2, box(0.012, 0.115, 0.012), skin, 0, -0.0575, 0);
      const cl = put(f2, cone(0.0075, 0.055, 4), bone, 0, -0.14, 0, true); cl.rotation.x = Math.PI;
      hand.add(fp); fingers.push(fp); fingers2.push(f2);
    }
    upper.add(piv); arms.push(piv); elbows.push(el); hands.push({ fingers, fingers2 });
  });

  /* ---- neck + head: skull, brow, cheeks, sockets, hinged jaw with teeth, wide blade on top, hair strands ---- */
  put(upper, cyl(0.042, 0.062, 0.46, 8), skin, 0, 1.14, -0.02);
  if (hi) [-1, 1].forEach((sx) => { const t = put(upper, cyl(0.009, 0.009, 0.4, 4), bone, sx * 0.034, 1.15, 0.03, true); t.rotation.z = sx * 0.05; });
  const head = new THREE.Group(); head.position.y = 1.38; upper.add(head);
  const skull = put(head, sph(0.15, 12, 10), skin, 0, 0, 0); skull.scale.set(0.9, 1.2, 0.95);
  const back = put(head, sph(0.11, 8, 6), skin, 0, 0.05, -0.08); back.scale.set(0.85, 1.0, 1.25);
  const brow = put(head, box(0.2, 0.03, 0.06), skin, 0, 0.088, 0.1); brow.rotation.x = 0.15;
  [-1, 1].forEach((sx) => {
    const ck = put(head, sph(0.04, 7, 5), skin, sx * 0.075, -0.035, 0.092); ck.scale.set(0.8, 1.2, 0.6);
    const so = put(head, sph(0.047, 9, 7), pit, sx * 0.085, 0.045, 0.098); so.scale.set(1, 1, 0.6);
    if (hi) { const zy = put(head, box(0.05, 0.016, 0.05), bone, sx * 0.102, 0.0, 0.088, true); zy.rotation.y = sx * 0.5; }
  });
  if (hi) { const nz = put(head, cone(0.018, 0.045, 4), bone, 0, -0.01, 0.12, true); nz.rotation.x = Math.PI / 2; }
  put(head, sph(0.06, 8, 6), pit, 0, -0.1, 0.07).scale.set(1, 0.7, 1.1);
  for (let i = -3; i <= 3; i++) {                                                                                      // upper teeth (the outer two are fangs)
    const fang = Math.abs(i) === 2, c = put(head, cone(0.0085, fang ? 0.07 : 0.04, 4), tooth, i * 0.02, fang ? -0.12 : -0.108, 0.118 - 0.0022 * i * i, true); c.rotation.x = Math.PI;
  }
  const jaw = new THREE.Group(); jaw.position.set(0, -0.09, 0.0); head.add(jaw);
  put(jaw, box(0.13, 0.026, 0.14), skin, 0, -0.025, 0.07).rotation.x = 0.05;
  const chin = put(jaw, sph(0.04, 7, 5), skin, 0, -0.04, 0.125); chin.scale.set(1.1, 0.6, 1);
  for (let i = -2; i <= 2; i++) put(jaw, cone(0.0075, 0.034, 4), tooth, i * 0.02, -0.004, 0.118 - 0.0022 * i * i, true);
  const blade = put(head, new THREE.OctahedronGeometry(1, 0), blk, 0, 0.12, 0); blade.scale.set(1.0, 0.055, 0.2);
  if (hi) for (let i = 0; i < 6; i++) {
    const wg = new THREE.Group(); wg.position.set((i - 2.5) * 0.034, 0.1, -0.12 - (i % 2) * 0.02);
    put(wg, box(0.012, 0.55 + (i % 3) * 0.1, 0.004), cloth, 0, -0.28, 0, true); head.add(wg); wisps.push(wg);
  }

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
  g.traverse((o) => { if (o.isMesh) o.castShadow = !o.userData.fine; });
  scene.add(g);
  return { group: g, legs, arms, upper, head, eyes, glows, hands, knees, ankles, elbows, jaw, chest, rags, wisps, blade, k: 0, tw: 0, twD: 1, twT: 2, prevLeg: [0, 0], detailOff: false };
}

/* extra life on top of the walk cycle: breathing, knee lift, torso twist, body bob, head twitches, a jaw that chatters when it hunts,
   twitching fingers, bending elbows, swaying rags and hair */
function monsterDetail(dt) {
  const mm = monMesh, m = mon, ov = m.ov;
  if (!mm || mm.detailOff || m.away || dt <= 0 || DBG.noDetail) return;
  try {
    const t = S.time, chase = m.state === 'CHASE', hunt = chase || m.state === 'INVESTIGATE' || m.state === 'STARE';
    const scene3 = ov.armL != null || ov.armR != null || ov.legL != null || ov.legR != null;                      // a jumpscare is driving the limbs
    const mv = clamp(m.speedNow / 3, 0, 1.4), cr = m.crouch || 0;
    mm.k = approach(mm.k, chase ? 1 : (hunt ? 0.45 : 0), dt * 2.2); const k = mm.k;
    const br = Math.sin(t * (1.5 + 2.6 * k + 1.2 * mv)), amp = 0.018 + 0.03 * k + 0.012 * mv;                      // breathing
    mm.chest.scale.set(1 + br * amp, 1 + br * amp * 0.5, 1 + br * amp * 1.3);
    for (let i = 0; i < 2; i++) {                                                                                  // knee lift follows the swing of each leg
      const leg = mm.legs[i], d = (leg.rotation.x - mm.prevLeg[i]) / dt; mm.prevLeg[i] = leg.rotation.x;
      const want = scene3 ? 0 : clamp(-d * 0.2, 0, 0.85) * (1 - cr);
      mm.knees[i].rotation.x = approach(mm.knees[i].rotation.x, want, dt * 9); mm.ankles[i].rotation.x = -mm.knees[i].rotation.x * 0.7;
    }
    mm.upper.rotation.y = scene3 ? 0 : Math.sin(m.anim) * 0.07 * mv + (chase ? (Math.random() - 0.5) * 0.03 : 0);   // torso twists against the hips
    mm.upper.rotation.x += 0.1 * k * (1 - cr);
    mm.group.position.y += Math.abs(Math.sin(m.anim)) * 0.035 * mv * (1 + k) * (1 - cr);                         // body bob per stride
    mm.twT -= dt;
    if (mm.twT <= 0) { mm.twT = 1.4 + Math.random() * 3.6; mm.tw = 1; mm.twD = Math.random() < 0.5 ? -1 : 1; }
    mm.tw = approach(mm.tw, 0, dt * 6);
    mm.head.position.set(0, 1.38 - 0.05 * k, 0.02 + 0.09 * k);                                                    // neck thrusts forward when hunting
    mm.head.rotation.x += 0.16 * k; mm.head.rotation.z += Math.sin(t * 55) * 0.1 * mm.tw + Math.sin(t * 0.9) * 0.1 * hunt;
    mm.head.rotation.y = mm.twD * 0.22 * mm.tw + Math.sin(t * 0.4) * 0.08 + (hunt ? Math.sin(t * 1.3) * 0.12 : 0);
    let jw = 0.05 + 0.05 * (0.5 + 0.5 * Math.sin(t * 1.3));                                                       // jaw
    if (scene3 || S.mode === 'dead') jw = 0.85 + 0.06 * Math.sin(t * 40);
    else if (chase && m.dist < 14) jw = 0.5 + 0.25 * Math.sin(t * 17);
    else if (hunt) jw = 0.16 + 0.08 * Math.sin(t * 3);
    if (DBG.lab.on && DBG.lab.jaw != null) jw = DBG.lab.jaw;
    mm.jaw.rotation.x = approach(mm.jaw.rotation.x, jw, dt * 10);
    const grip = clamp(ov.curl || 0, 0, 1);
    for (let h = 0; h < mm.hands.length; h++) for (let f = 0; f < 4; f++) {                                       // fingers twitch, second joints curl further
      const fr = mm.hands[h].fingers[f], off = Math.sin(t * (2.6 + f * 1.1 + h * 0.7) + f) * (0.07 + 0.06 * k) * (1 - grip);
      fr.rotation.x += off; mm.hands[h].fingers2[f].rotation.x = fr.rotation.x * 0.9 - 0.12 - 0.3 * grip;
    }
    for (let i = 0; i < 2; i++) {                                                                                  // elbows bend with the swing, straighten to reach
      const ar = mm.arms[i].rotation.x, fac = 1 - clamp((-ar - 0.5) / 0.6, 0, 1);
      mm.elbows[i].rotation.x = scene3 ? -0.05 : -(0.12 + 0.45 * Math.max(0, -ar) * fac);
    }
    for (let i = 0; i < mm.rags.length; i++) {
      const r = mm.rags[i]; r.rotation.x = -0.1 * mv - 0.12 * k + Math.sin(t * 2.1 + i * 1.3) * 0.05 - mm.upper.rotation.x * 0.6; r.rotation.z = Math.sin(t * 1.6 + i * 2.1) * 0.06;
    }
    for (let i = 0; i < mm.wisps.length; i++) {
      const w = mm.wisps[i]; w.rotation.x = 0.05 + Math.sin(t * 1.9 + i) * 0.07 + 0.25 * mv + 0.2 * k; w.rotation.z = Math.sin(t * 1.3 + i * 2) * 0.06;
    }
  } catch (e) { mm.detailOff = true; window.__monsterDetailError = e; }
}

function syncMonster(dt) {
  const mm = monMesh, m = mon, ov = m.ov;
  const cr = m.crouch || 0;
  mm.group.visible = !m.away && !DBG.hideMon;
  mm.group.position.set(m.x, -0.3 * m.duck - 0.95 * cr + (m.gy || 0), m.z);
  mm.group.rotation.y = m.yaw;
  const mv = clamp(m.speedNow / 3, 0, 1.4);
  m.anim += dt * (2 + m.speedNow * 1.6);
  const s = Math.sin(m.anim), dk = 1 - 0.245 * m.duck, swing = s * 0.3 * mv;
  mm.legs[0].rotation.x = ov.legL != null ? ov.legL : s * 0.55 * mv;
  mm.legs[1].rotation.x = ov.legR != null ? ov.legR : -s * 0.55 * mv;
  mm.legs[0].scale.y = dk - 0.42 * cr; mm.legs[1].scale.y = dk - 0.42 * cr;
  mm.arms[0].rotation.x = ov.armL != null ? ov.armL : -swing - 0.15 * m.duck - 1.0 * cr;
  mm.arms[1].rotation.x = ov.armR != null ? ov.armR : swing - 1.15 * m.reach - 0.15 * m.duck - 1.0 * cr;     // reaches out for doors
  const curl = -(0.12 + ov.curl * 1.3);
  for (let h = 0; h < mm.hands.length; h++) for (let f = 0; f < 4; f++) mm.hands[h].fingers[f].rotation.x = curl - f * 0.03;
  mm.upper.rotation.x = m.lean + 0.75 * m.duck + 1.1 * cr;                                                      // ducks under door frames
  mm.upper.rotation.z = Math.sin(m.anim * 0.5) * 0.03;
  mm.head.rotation.z = Math.sin(S.time * 0.7) * 0.05; mm.head.rotation.x = Math.sin(S.time * 0.5) * 0.04;
  mm.head.scale.set(m.headScale, m.headScale, m.headScale);
  for (let i = 0; i < mm.eyes.length; i++) { const es = m.eyeScale; mm.eyes[i].scale.set(es, es, es); mm.glows[i].scale.set(0.13 * es, 0.13 * es, 1); }
  monsterDetail(dt);
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
  if (DBG.god && !DBG.forceDie) return;                                   // (debug) god mode
  if (MP.active && MP.swapId && MP.swapId !== MP.me) { mpCatchRemote(MP.swapId); return; }          // the monster caught a teammate, not the host
  const hiding = !!(P.hiding && P.closet);
  setMode('dead'); S.deathT = 0; S.deathPhase = 'scare'; S.deathChoice = 0; S.searching = null; P.anim = null;
  mon.state = 'KILL'; mon.sees = false; mon.doorWork = null; mon.reach = 0; mon.duck = 0; clearOverrides();
  S.deathType = hiding ? 'drag' : ((DBG.deathType && DBG.deathType !== 'drag') ? DBG.deathType : pick(['stare', 'grab', 'push']));
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
  if (MP.active) mpLocalDied();
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
  if (MP.active) { if (pk === 'retry') mpSpectateStart(); else mpLeave(); return; }          // multiplayer: no retry, watch the others or leave
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
  if (c.style === 'hole') {                                                    // the long arm shoots straight through the opening, grabs you, drags you out
    const reach = ease3(t / 0.35), pull = ease3((t - 0.45) / 1.0), end = ease3((t - 1.3) / 0.5), back = 1.7 * pull;
    mon.crouch = 1 - 0.7 * end; mon.duck = 0; mon.lean = 0.1;
    mon.x = c.front.x + f.x * back; mon.z = c.front.z + f.z * back;
    mon.yaw = Math.atan2(-f.x, -f.z); mon.wantYaw = mon.yaw; mon.speedNow = 2.2 * pull * (1 - end);
    mon.ov.armR = -(1.57 + mon.lean + 1.1 * mon.crouch) * reach; mon.ov.curl = reach;
    mon.headScale = lerp(1, 1.8, end); mon.eyeScale = lerp(1, 2.3, end) + Math.sin(t * 40) * 0.1 * end;
    S.dcam = {
      x: lerp(c.inside.x, c.mouth.x + f.x * (1.0 + back), pull), y: lerp(c.camY, 0.45, pull), z: lerp(c.inside.z, c.mouth.z + f.z * (1.0 + back), pull),
      yaw: c.yaw + Math.sin(t * 10) * 0.05, pitch: lerp(0.08, 0.85, pull), roll: lerp(0, 0.4, pull) + Math.sin(t * 8) * 0.06 * pull,
    };
    if (!S.impact && t > 0.3) { S.impact = true; Snd.door(); }
    return;
  }
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
    if (t >= S.scareT) { S.deathPhase = 'black'; el.death.classList.add('black'); Snd.duck(true); S.flashT = 0; S.choke = 0; if (MP.active) mpAfterDeath(); }   // hard cut to pitch black
  } else if (S.deathPhase === 'black') {
    if (t >= S.scareT + BLACK_T) {                      // two seconds of nothing, then…
      S.deathPhase = 'card'; Snd.duck(false); Snd.staticBurst(); S.staticT = 2.2;
      el['death-stats'].textContent = S.act === 2 ? 'Objectives Completed: ' + objectivesDone() + ' / ' + OBJ2.length : 'Keys Collected: ' + S.keys + ' / ' + TOTAL_KEYS;
      el['btn-retry'].textContent = MP.active ? 'SPECTATE' : 'TRY AGAIN'; el['btn-menu'].textContent = MP.active ? 'LEAVE GAME' : 'MAIN MENU';
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
  if (VR.active) return vrCameraY();                                        // the headset owns the camera
  if (S.mode === 'laptop') {                       // glide down to the 3D laptop screen
    const z = S.lz, e = z * z * (3 - 2 * z), pz = laptopScreen.pose, f = S.lzFrom;
    camera.position.set(lerp(f.x, pz.x, e), lerp(EYE_H, pz.y, e), lerp(f.z, pz.z, e));
    camera.rotation.set(lerp(f.pitch, pz.pitch, e), f.yaw + angDiff(f.yaw, pz.yaw) * e, 0);
    P.fov = lerp(72, pz.fov, e); camera.fov = P.fov; camera.updateProjectionMatrix();
    return EYE_H;
  }
  if ((S.mode === 'dead' || S.mode === 'cutscene' || S.mode === 'spectate') && S.dcam) {               // scripted jumpscare camera
    const sh = S.mode === 'dead' ? 0.025 * (1 - Math.min(1, S.deathT / Math.max(0.5, S.scareT))) : 0;
    camera.position.set(S.dcam.x + (Math.random() - 0.5) * sh, S.dcam.y + (S.mode === 'dead' ? (P.gy || 0) : 0) + (Math.random() - 0.5) * sh, S.dcam.z + (Math.random() - 0.5) * sh);
    camera.rotation.set(S.dcam.pitch, S.dcam.yaw, S.dcam.roll || 0);
    return S.dcam.y;
  }
  let ty = EYE_H;
  if (P.hiding) ty = (P.closet && P.closet.style === 'hole') ? P.closet.camY : 1.45;
  else if (P.moving) ty += Math.sin(P.bob) * (P.running ? 0.055 : 0.03);
  else ty += Math.sin(S.time * 1.3) * 0.006;
  if (P.anim) ty -= 0.1 * Math.sin(Math.PI * clamp(P.anim.t / P.anim.dur, 0, 1));
  if (P.anim && P.anim.type === 'wake') ty = lerp(0.3, EYE_H, ease3(P.anim.t / P.anim.dur));      // you wake up lying in the water
  if (!P.hiding && !P.anim) ty += P.gy || 0;                                                      // stairs, platforms, catwalks
  if (P.anim && P.anim.c && P.anim.c.style === 'hole') {                                           // crouch down into the pipe / stand up out of it
    const hk = ease3(P.anim.t / P.anim.dur);
    if (P.anim.type === 'in') ty = lerp(EYE_H + (P.gy || 0), P.anim.c.camY, hk); else if (P.anim.type === 'out') ty = lerp(P.anim.c.camY, EYE_H, hk);
  }
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
  tabletBuild();
  vm.built = true;
}

function updateViewmodel(dt) {
  if (VR.active) return;                                                    // the controllers are the hands
  if (!vm.built) return;
  const playing = S.mode === 'play', inGame = playing || S.mode === 'paused';
  vm.radarT = 0; vm.mapT = 0;                                                  // (the tablet replaces the tracker and the clipboard map)
  vm.idleT = approach(vm.idleT, playing && (!P.hiding || P.anim) ? 1 : 0, dt * 4);
  const eR = easeOut(vm.radarT), eM = easeOut(vm.mapT), eHide = Math.max(eR, eM, easeOut(TAB.t)), k = Math.min(1, dt * 7);

  // closet slats fade in once you are inside, out as you leave
  const slatOn = inGame && P.hiding && !(P.closet && P.closet.style === 'hole') && (!P.anim || (P.anim.type === 'in' && P.anim.t / P.anim.dur > 0.7));
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
  updateTablet(dt, bx, by);
}
function renderViewmodel() {
  if (!vm.built || S.mode !== 'play' || (vm.idleT < 0.02 && vm.radarT < 0.02 && vm.mapT < 0.02 && TAB.t < 0.02)) return;
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
  updateSafeProps(dt);
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
  if (!cams.length) return;                                            // (a world without CCTV cameras, e.g. upstairs, has no title feed)
  if (S.mode !== 'menu' && S.mode !== 'lore' && S.mode !== 'acts' && S.mode !== 'mp' && S.mode !== 'lobby') return;       // only the title screens run the CCTV feed
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
  if (m3Active()) { try { m3Render(); return; } catch (e) { console.error('3D menu failed - using the flat menu', e); M3.built = false; document.body.classList.remove('m3d'); } }
  // the title screen shows live, slowly panning CCTV feeds; in-game the laptop shows them on its own screen
  const feed = (!VR.active && (S.mode === 'menu' || S.mode === 'lore')) ? cams[Math.max(0, S.menuCam)] : null;
  if (feed) {
    const a = camAim(feed, S.time);
    cctv.position.set(feed.x, feed.y, feed.z); cctv.lookAt(a.x, a.y, a.z);
    const a0 = ambient.intensity, f0 = scene.fog.density;
    ambient.intensity = 0.9; scene.fog.density = 0.012; flash.intensity = 0;
    renderer.render(scene, cctv);
    ambient.intensity = a0; scene.fog.density = f0; flash.intensity = S.flashI;
  } else { renderer.render(scene, camera); if (!VR.active && !DBG.hideVM && !DBG.cam.on) renderViewmodel(); }
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
  if (VR.active) return;
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
  if (MP.phase !== 'off') mpLeaveLobby();
  if (S.act !== 1 || S.floor !== 1) { S.act = 1; S.floor = 1; buildWorld(newSeed(), 1); }                 // back to the house
  resetGame(); mon.grace = 999; S.menuCamT = 0; setMode('menu'); m3Intro(2.6); M3.lore = null;
  try { document.exitPointerLock(); } catch (e) { /* ignore */ }
}
function toLore() { Snd.init(); setMode('lore'); if (m3On()) m3LoreStart(); else typeLore(); }
function finishBegin() {
  S.worldUsed = true; resetGame(); setMode('play'); lockPointer();
  toast(S.act === 2 ? 'FIND A WAY OUT' : 'FIND ALL ' + TOTAL_KEYS + ' KEYS', 2600);
}
// every new game builds a brand-new layout (maze, doors, decor, keys, items) from a fresh seed
function wakeUp(ms) { if (!(ms >= 1500)) return; document.body.classList.add('wake'); setTimeout(() => document.body.classList.remove('wake'), ms + 700); }
function beginGame(instant, fadeMs) {
  S.floor = 1;
  Snd.init(); clearInterval(typeTimer);
  const fm = fadeMs || 1100;
  if (!S.worldUsed || !worldBuilt) { finishBegin(); if (fadeMs) { fadeFromBlack(fm); wakeUp(fm); } return; }
  if (instant === true) { buildWorld(newSeed()); finishBegin(); return; }
  el.cut.style.transition = 'none'; el.cut.style.opacity = '1';          // black while the new layout is generated
  setTimeout(() => { buildWorld(newSeed()); finishBegin(); fadeFromBlack(fm); wakeUp(fm); }, 90);
}
function setPause(on) {
  if (on) {
    if (ACTIVE.indexOf(S.mode) < 0) return;
    S.prevMode = S.mode; setMode('paused'); refreshSettingsUI(); renderObjectives();
    el['btn-leave-mp'].style.display = MP.active ? '' : 'none';
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
  if (renderer.xr && renderer.xr.isPresenting) return;                       // the headset sets its own size
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  cctv.aspect = w / h; cctv.updateProjectionMatrix();
  vmCam.aspect = w / h; vmCam.updateProjectionMatrix();
}

function simulate(dt, inp) {
  if (inp.pause) { setPause(true); return; }
  updatePlayer(dt, inp);
  if (!MP.active && !DBG.freezeMon) updateMonster(dt * DBG.monSpeed);                                    // in a match mpTick() runs / mirrors the monster
  updateBreath(dt, inp);
  discover();
}
function handleMode(dt, inp) {
  const padNav = inp.pad || UINav.padUsed;
  switch (S.mode) {
    case 'menu':
      if (padNav && (!m3Active() || modalOpen)) uiNavStep(inp);
      if (modalOpen) { if (inp.back && !inp.pad) closeModals(); } else if (m3Active()) m3Nav(inp); else if (inp.confirm) toActSelect();
      menuFeed(dt); break;
    case 'acts': if (padNav && !m3Active()) uiNavStep(inp); if (inp.back && !inp.pad) setMode('menu'); else if (m3Active()) m3Nav(inp); menuFeed(dt); break;
    case 'lore':
      if (m3Active() && M3.lore) { if (inp.back && !inp.pad) { M3.lore = null; setMode('menu'); } else m3LoreKey(inp); menuFeed(dt); break; }
      if (padNav) uiNavStep(inp); if (inp.confirm) { beginGame(); break; } menuFeed(dt); break;
    case 'mp': case 'lobby': if (padNav) uiNavStep(inp); if (inp.back && !inp.pad) mpBack(); menuFeed(dt); break;
    case 'spectate': mpSpectateInput(dt, inp); break;
    case 'play': case 'laptop': case 'journal': case 'note': case 'terminal': case 'keypad': simulate(dt, inp); break;
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
    case 'won': if (padNav) uiNavStep(inp); if (inp.confirm) { if (MP.active) mpAfterWin(); else { S.act = 1; beginGame(); } } break;
    case 'cutscene': updateFall(dt); break;
    case 'act2lore': if (padNav) uiNavStep(inp); if (inp.confirm) startAct2(); if (inp.back && !inp.pad && S.act2FromMenu) { clearInterval(type2Timer); setMode('acts'); } break;
    default: break;
  }
}

let lastT = performance.now();
function frame(now) {
  rafPending = false;
  if (VR.active && !VR.inLoop) return;                                    // a stray window frame while the headset loop is running
  if (!VR.active) { rafPending = true; requestAnimationFrame(frame); }
  const raw = Math.max(0.001, (now - lastT) / 1000);
  let dt = Math.min(0.05, raw) * DBG.timeScale; if (DBG.freeze) dt = 1e-5; lastT = now;
  S.time += dt; S.frame++;
  if (VR.active) vrBeginFrame(dt);                                          // your body follows your head
  const inp = Input.poll(dt, raw);
  dbgInput(inp);
  handleMode(dt, inp);
  mpTick(dt);
  updateDoors(dt); updateClosetDoors(dt); updateFlares(dt); updatePickups(dt); updateLaptop(dt); updateCamMeshes();
  updateExitDoor(dt); updateAct2(dt); updateConsoleRadar(dt); updateSewer(dt);
  updateLightEvents(dt); syncLampMeshes();
  let camY = updateCamera(dt);
  camY = dbgCamera(raw, camY);
  updateWorldVisuals(dt, camY);
  dbgWorld(dt);
  syncMonster(dt);
  updateDust(dt);
  updateAudio(dt);
  updateRadar(dt);
  updateRumble();
  updateLightbar();
  updateUI(dt);
  updateViewmodel(dt);
  try { m3Frame(dt); } catch (e) { console.error('3D menu failed - using the flat menu', e); M3.built = false; document.body.classList.remove('m3d'); }
  if (VR.active) vrEndFrame(dt);                                            // the rig, hands, light and panels follow the game's decisions
  renderFrame();
  dbgAfterRender(raw);
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
const QD = () => (MP.active ? QUALITY.medium.decor : Q().decor);          // decor density shapes the random stream: in a match everybody uses the same one
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
  ensureAssets(); if (act === 2) initSewerAssets(); if (!skyDome) buildSky();          // one-off set-up happens BEFORE seeding, so a seed always means the same house
  const prev = Math.random;
  Math.random = mulberry32(seed);              // everything below is deterministic for this seed
  try {
    resetWorldData();
    if (act === 2) generateSewer(); else generateMaze(act, S.floor);
    useMaterials(act);
    if (act === 1) rooms.forEach((r, i) => { r.name = (S.floor === 2 ? UP_NAMES : ACT1_NAMES)[i]; });
    if (act === 1 && S.floor === 2) {                                   // UPSTAIRS
      buildStructure(); buildLanding(); buildRooms(); buildCorridorItems(); buildDoors();
      buildDecor(); buildPickups(); placePhotoFrames(); flushDeco(); finalizeShadows();
      assignKeys(floorKeys(2)); buildLampMeshes();
    } else if (act === 1) {                                              // DOWNSTAIRS
      reserveStairs();
      buildStructure(); buildSafeRoom(); buildRooms(); buildCorridorItems(); buildDoors(); buildYard(); buildNotes();
      buildDecor(); buildYardDecor(); buildStairsUp();
      buildPickups(); placePhotoFrames(); flushDeco(); finalizeShadows();
      assignKeys(floorKeys(1)); buildCameras(); buildLampMeshes();
    } else {
      buildSewerStructure(); buildSewerSafeRoom(); buildSewerGates(); buildSewerHall(); buildSewerProps();
      buildSewerLampsAndDecor(); buildSewerPickups(); flushDeco(); finalizeShadows();
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
  { const xr = renderer.xr, was = xr && xr.isPresenting, prevRT = renderer.getRenderTarget ? renderer.getRenderTarget() : null; if (was) xr.isPresenting = false;
    renderer.setRenderTarget(feedRT); renderer.render(scene, feedCam); renderer.setRenderTarget(was ? prevRT : null); if (was) xr.isPresenting = true; }
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
  if (MP.active && !MP.isHost) { mpSend({ k: 'noise', x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 }); return true; }
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
    if (MP.active) mpSend({ k: 'pick', i: pickups.indexOf(it) });
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
  const NL = Math.max(5, TOTAL_KEYS), cols = Math.ceil(NL / 5);                   // one padlock per key the team needs (5 per column on the door)
  for (let c = 0; c < cols; c++) addBox(hinge, 0.05, 2.1, 0.12, 0.09, 1.3, OW + (cols === 1 ? 0 : (c - (cols - 1) / 2) * 0.46), M.dark);   // hasps
  for (let k = 0; k < NL; k++) {                                                     // padlock slots
    const col = Math.floor(k / 5), y0 = 0.6 + (k % 5) * 0.4, lg = new THREE.Group();
    lg.position.set(0.14, y0, OW + (cols === 1 ? 0 : (col - (cols - 1) / 2) * 0.46)); hinge.add(lg);
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
  if (MP.active) mpSend({ k: 'lock', n: S.locks, by: MP.me });
}
function useExitDoor() {
  if (S.locks >= exitDoor.locks.length) return;
  if (S.keys > S.locks) unlockNextLock();
  else { Snd.locked(); toast('SEALED BY ' + exitDoor.locks.length + ' PADLOCKS.   ' + S.locks + ' / ' + exitDoor.locks.length + ' OPEN\nFIND THE KEYS.', 2400); }
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
  if (t >= 4.0) { if (MP.active) mpEscape(); else if (VR.active) vrEscape(); else showAct2Lore(); }                                    // …for two seconds, then the story card
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
   ACT 2 GENERATOR  —  its own procedural sewer (nothing of the house is reused)
   · wide, sweeping, slowly curving pipe tunnels (smooth spline paths, not 90-degree maze turns)
   · side rooms off the main tunnels, each behind a rusty iron gate (the tunnel connectors stay open)
   · pit halls: the floor is a deep flooded pit crossed by a narrow catwalk bridge
   · elevated dry rooms: stairs up to a raised concrete platform (consoles, terminals, broken chairs)
   ====================================================================== */
const pitMask = new Uint8Array(MW * MH);          // 1 = deep flooded pit (nobody can walk here)
const blockedEdges = new Set();                   // tile-to-tile moves that a platform face / stair rail forbids
const platforms = [], ramps = [];                 // raised floors the camera has to follow
let guardNav = false;                             // true when pits/platforms exist: the watcher must follow the path field
const PLAT_H = 0.9;
const sewerInfo = { code: [0, 0, 0, 0], monRoom: 5, commsId: 0, pitHalls: [], termRooms: [] };

function initRoomsAct1() {
  rooms.length = 0;
  ROOM_DEFS.forEach((r, i) => rooms.push({ id: i, name: r.name, x0: 2 * r.cx + 1, x1: 2 * (r.cx + r.w - 1) + 1, z0: 2 * r.cy + 1, z1: 2 * (r.cy + r.h - 1) + 1 }));
  rooms.forEach((r) => { r.cxw = (r.x0 + r.x1 + 1) / 2 * TILE; r.czw = (r.z0 + r.z1 + 1) / 2 * TILE; });
}

function floorH(x, z) {
  let h = 0;
  for (let i = 0; i < ramps.length; i++) {
    const r = ramps[i];
    if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
    const t = r.ax === 'x' ? (x - r.x0) / (r.x1 - r.x0) : (z - r.z0) / (r.z1 - r.z0);
    return r.h * clamp(r.sgn > 0 ? t : 1 - t, 0, 1);                  // (a ramp may climb or descend)
  }
  for (let i = 0; i < platforms.length; i++) { const p = platforms[i]; if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1) h = Math.max(h, p.h); }
  return h;
}

/* a room's own frame: dep = tiles inward from the door-side wall, lat = tiles along that wall */
function roomLocal(r, x, z) {
  const fx = DX[r.fi], fz = DZ[r.fi];
  const dep = fx > 0 ? r.x1 - x : fx < 0 ? x - r.x0 : fz > 0 ? r.z1 - z : z - r.z0;
  const lat = fx !== 0 ? z - r.z0 : x - r.x0;
  return { dep, lat };
}
function roomPos(r, dep, lat) {                   // continuous tile units -> world x,z
  const fx = DX[r.fi], fz = DZ[r.fi];
  if (fx !== 0) return { x: (fx > 0 ? r.x1 + 1 - dep : r.x0 + dep) * TILE, z: (r.z0 + lat) * TILE };
  return { x: (r.x0 + lat) * TILE, z: (fz > 0 ? r.z1 + 1 - dep : r.z0 + dep) * TILE };
}

const SEWER_ROOMS = [
  { name: 'COMMUNICATIONS ROOM', lat: 5, dep: 4, elev: true, role: 'comms' },
  { name: 'UTILITY ROOM', lat: 5, dep: 4, elev: true, role: 'util' },
  { name: 'MAINTENANCE OFFICE', lat: 5, dep: 4, elev: true, role: 'office' },
  { name: 'PUMP ROOM', lat: 4, dep: 3, elev: false, role: 'pump' },
  { name: 'STORAGE VAULT', lat: 4, dep: 3, elev: false, role: 'store' },
  { name: 'VALVE ROOM', lat: 4, dep: 3, elev: false, role: 'valve' },
  { name: 'FILTER ROOM', lat: 5, dep: 3, elev: false, role: 'filter' },
];

function sewerAttempt() {
  grid.fill(1); zone.fill(0); roomId.fill(-1); pitMask.fill(0);
  blockedEdges.clear(); platforms.length = 0; ramps.length = 0; rooms.length = 0; sewerInfo.pitHalls.length = 0;
  sewerInfo.doorTiles = new Set();

  /* ---- 1. the main tunnels: smooth Catmull-Rom curves stamped with a round brush (2-3 tiles wide) ---- */
  const canCarve = (x, z) => x >= 7 && x <= HOUSE_W - 1 && z >= 1 && z <= MH - 2;
  const disc = (cx, cz, R) => {
    for (let z = Math.floor(cz - R); z <= Math.ceil(cz + R); z++) for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      if (!canCarve(x, z)) continue;
      const dx = x + 0.5 - cx, dz = z + 0.5 - cz;
      if (dx * dx + dz * dz <= R * R) grid[idx(x, z)] = 0;
    }
  };
  const cl = (p) => [clamp(p[0], 7.5, 30.5), clamp(p[1], 2.3, 28.7)];
  const path = (pts, R) => {
    pts = pts.map(cl);
    for (let s = 0; s < pts.length - 1; s++) {
      const p0 = pts[Math.max(0, s - 1)], p1 = pts[s], p2 = pts[s + 1], p3 = pts[Math.min(pts.length - 1, s + 2)];
      const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 4));
      for (let k = 0; k <= steps; k++) {
        const t = k / steps, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        disc(f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), R);
      }
    }
  };
  const edge = (P, Q, bend) => {                  // an S-shaped sweep between two nodes
    const dx = Q[0] - P[0], dz = Q[1] - P[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L;
    const b = bend != null ? bend : rnd(1.8, 3.6) * (Math.random() < 0.5 ? -1 : 1);
    path([P, [P[0] + dx / 3 + nx * b, P[1] + dz / 3 + nz * b], [P[0] + dx * 2 / 3 - nx * b * 0.6, P[1] + dz * 2 / 3 - nz * b * 0.6], Q], 1.2);
  };
  const J = (v, a) => v + rnd(-a, a);
  const A = [7.5, 3.5], B = [J(16, 1.5), J(6.5, 1)], C = [J(22, 1.5), J(12, 1.5)], D = [J(13, 1.5), J(17, 1.5)];
  const E = [J(9, 1), J(24, 1.5)], F = [J(18, 2), J(27, 1)], G = [J(21.5, 1), 19.5];
  edge(A, B); edge(B, C); edge(C, D); edge(D, E); edge(E, F);
  edge(C, [30.5, 9.5], 0.8);                      // out to the outfall hall (north entrance)
  path([[G[0], 19.5], [25, 19.5], [30.5, 19.5]], 1.2);       // a long straight connector: room for a pit hall
  edge(D, [G[0], 19.5], 1.2);
  edge(F, [21, 27.5], 1.0); path([[21, 27.5], [25.5, 27.5], [30.5, 27.5]], 1.2);          // a second straight connector

  /* ---- 2. the safe room, its doorway, and the outfall hall ---- */
  for (let z = SAFE.z0; z <= SAFE.z1; z++) for (let x = SAFE.x0; x <= SAFE.x1; x++) { grid[idx(x, z)] = 0; zone[idx(x, z)] = 1; }
  grid[idx(DOOR.x, DOOR.z)] = 0;
  for (let z = 1; z < MH - 1; z++) for (let x = HOUSE_W; x < MW - 1; x++) { grid[idx(x, z)] = 0; zone[idx(x, z)] = 3; }

  /* ---- 3. pit halls: aligned 2-3 wide tunnel stretches become a flooded pit with a catwalk through it ---- */
  const tun = (x, z) => inB(x, z) && x >= 7 && x <= 28 && grid[idx(x, z)] === 0 && zone[idx(x, z)] === 0 && !pitMask[idx(x, z)];
  const stretches = [];
  [true, false].forEach((horiz) => {
    const AX = horiz ? HOUSE_W : MH, BX = horiz ? MH : HOUSE_W;
    const get = (a, b) => (horiz ? tun(a, b) : tun(b, a));
    const run = (a, b) => { if (!get(a, b)) return null; let s = b, e = b; while (get(a, s - 1)) s--; while (get(a, e + 1)) e++; return [s, e]; };
    for (let b = 1; b < BX - 1; b++) for (let a = 7; a < AX - 5; a++) {
      const r0 = run(a, b);
      if (!r0 || r0[0] !== b || r0[1] - r0[0] + 1 < 2 || r0[1] - r0[0] + 1 > 3) continue;
      const prev = a > 7 ? run(a - 1, b) : null;
      if (prev && prev[0] === r0[0] && prev[1] === r0[1]) continue;                    // only start at the beginning of a stretch
      let len = 1;
      while (a + len < AX) { const rr = run(a + len, b); if (rr && rr[0] === r0[0] && rr[1] === r0[1]) len++; else break; }
      if (len >= 5) stretches.push({ horiz, a0: a, len, s: r0[0], e: r0[1] });
    }
  });
  shuffle(stretches);
  const used2 = [];
  for (const st of stretches) {
    if (sewerInfo.pitHalls.length >= 2) break;
    const L = Math.min(st.len, rndi(5, 7)), a0 = st.a0 + Math.floor((st.len - L) / 2), a1 = a0 + L - 1;
    const mid = [st.horiz ? (a0 + a1) / 2 : (st.s + st.e) / 2, st.horiz ? (st.s + st.e) / 2 : (a0 + a1) / 2];
    if (used2.some((u) => Math.hypot(u[0] - mid[0], u[1] - mid[1]) < 7)) continue;
    used2.push(mid);
    const n = st.e - st.s + 1, cat = n === 3 ? st.s + 1 : (Math.random() < 0.5 ? st.s : st.e);
    const hall = { horiz: st.horiz, a0, a1, cat, s: st.s, e: st.e };
    for (let a = a0; a <= a1; a++) for (let b = st.s; b <= st.e; b++) { if (b !== cat) pitMask[idx(st.horiz ? a : b, st.horiz ? b : a)] = 1; }
    sewerInfo.pitHalls.push(hall);
  }
  const nearPit = (x, z) => { for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (inB(x + dx, z + dz) && pitMask[idx(x + dx, z + dz)]) return true; return false; };

  /* ---- 4. side rooms: a short straight connector off a tunnel, ending in a doorway (the iron gate sits there) ---- */
  SEWER_ROOMS.forEach((def) => {
    const tt = [];
    for (let z = 2; z < MH - 2; z++) for (let x = 7; x <= HOUSE_W - 3; x++) if (grid[idx(x, z)] === 0 && zone[idx(x, z)] === 0 && !pitMask[idx(x, z)] && !nearPit(x, z)) tt.push({ x, z });
    shuffle(tt);
    for (let k = 0; k < tt.length; k++) {
      const T = tt[k];
      for (const i of shuffle([0, 1, 2, 3])) {
        const c = rndi(1, 3);                                                          // connector length: 1-3 tiles, the last one is the doorway
        const wx = T.x + DX[i] * c, wz = T.z + DZ[i] * c;
        const off = rndi(1, def.lat - 2);
        let x0, x1, z0, z1;
        if (DX[i] !== 0) { if (DX[i] > 0) { x0 = wx + 1; x1 = wx + def.dep; } else { x1 = wx - 1; x0 = wx - def.dep; } z0 = wz - off; z1 = z0 + def.lat - 1; }
        else { if (DZ[i] > 0) { z0 = wz + 1; z1 = wz + def.dep; } else { z1 = wz - 1; z0 = wz - def.dep; } x0 = wx - off; x1 = x0 + def.lat - 1; }
        if (x0 < 2 || z0 < 2 || x1 > HOUSE_W - 3 || z1 > MH - 3) continue;
        let ok = true;
        const conn = [];
        for (let q = 1; q <= c; q++) conn.push([T.x + DX[i] * q, T.z + DZ[i] * q]);
        const isConn = (x, z) => conn.some((p) => p[0] === x && p[1] === z);
        for (let z = z0 - 1; z <= z1 + 1 && ok; z++) for (let x = x0 - 1; x <= x1 + 1; x++) {
          if (isConn(x, z)) continue;
          if (grid[idx(x, z)] !== 1 || (x <= 6 && z <= 4)) { ok = false; break; }
        }
        for (let q = 0; q < conn.length && ok; q++) {                                  // the connector itself: solid ground, solid sides
          const p = conn[q];
          if (!inB(p[0], p[1]) || grid[idx(p[0], p[1])] !== 1 || (p[0] <= 6 && p[1] <= 4)) { ok = false; break; }
          if (q < conn.length - 1) for (const sd of [-1, 1]) { const sx = p[0] + (DX[i] !== 0 ? 0 : sd), sz = p[1] + (DZ[i] !== 0 ? 0 : sd); if (!inB(sx, sz) || grid[idx(sx, sz)] !== 1) { ok = false; break; } }
        }
        if (!ok) continue;
        const id = rooms.length;
        for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { grid[idx(x, z)] = 0; zone[idx(x, z)] = 2; roomId[idx(x, z)] = id; }
        conn.forEach((p) => { grid[idx(p[0], p[1])] = 0; zone[idx(p[0], p[1])] = 0; });
        sewerInfo.doorTiles.add(idx(wx, wz));
        const r = { id, name: def.name, role: def.role, elev: def.elev, x0, x1, z0, z1, fi: (i + 2) % 4, D: def.dep, W: def.lat, door: { x: wx, z: wz }, doorLat: off };
        r.cxw = (x0 + x1 + 1) / 2 * TILE; r.czw = (z0 + z1 + 1) / 2 * TILE;
        rooms.push(r);
        return;
      }
    }
  });

  /* ---- 5. platforms inside the elevated rooms, and the path rules that go with them ---- */
  rooms.forEach((r) => {
    if (!r.elev) return;
    r.platStart = r.D - 2;
    r.stairLat = Math.random() < 0.5 ? 0 : r.W - 1;
    let px0 = 1e9, px1 = -1e9, pz0 = 1e9, pz1 = -1e9;
    for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) {
      const l = roomLocal(r, x, z);
      if (l.dep >= r.platStart) { px0 = Math.min(px0, x); px1 = Math.max(px1, x); pz0 = Math.min(pz0, z); pz1 = Math.max(pz1, z); }
    }
    r.plat = { x0: px0 * TILE, z0: pz0 * TILE, x1: (px1 + 1) * TILE, z1: (pz1 + 1) * TILE, h: PLAT_H };
    platforms.push(r.plat);
    // the stair tile: one tile in the row just in front of the platform, at one end of that row
    let sx = 0, sz = 0;
    for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) { const l = roomLocal(r, x, z); if (l.dep === r.platStart - 1 && l.lat === r.stairLat) { sx = x; sz = z; } }
    const bx = -DX[r.fi], bz = -DZ[r.fi];                                    // direction the stairs climb
    r.stair = { x: sx, z: sz, ax: bx !== 0 ? 'x' : 'z', sgn: (bx + bz) > 0 ? 1 : -1 };
    r.ramp = { x0: sx * TILE, z0: sz * TILE, x1: (sx + 1) * TILE, z1: (sz + 1) * TILE, h: PLAT_H, ax: r.stair.ax, sgn: r.stair.sgn };
    ramps.push(r.ramp);
    const block = (ax, az, bx2, bz2) => { blockedEdges.add(idx(ax, az) * 4096 + idx(bx2, bz2)); blockedEdges.add(idx(bx2, bz2) * 4096 + idx(ax, az)); };
    for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) {
      const l = roomLocal(r, x, z);
      if (l.dep !== r.platStart - 1) continue;
      const nx = x + bx, nz = z + bz;                                         // the platform tile behind this one
      if (l.lat !== r.stairLat) block(x, z, nx, nz);                          // the platform's front face
      else for (const sd of [[bz !== 0 ? 1 : 0, bx !== 0 ? 1 : 0], [bz !== 0 ? -1 : 0, bx !== 0 ? -1 : 0]]) {   // stair rails: no stepping off the sides
        const qx = x + sd[0], qz = z + sd[1];
        if (inB(qx, qz) && roomId[idx(qx, qz)] === r.id) block(x, z, qx, qz);
      }
    }
  });

  /* ---- 6. bookkeeping ---- */
  openTiles.length = 0; deadEnds.length = 0;
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    if (grid[idx(x, z)] !== 0 || zone[idx(x, z)] === 1 || pitMask[idx(x, z)]) continue;
    openTiles.push({ x, z });
    if (zone[idx(x, z)] === 0 && x < HOUSE_W) {
      let n = 0, dir = -1;
      for (let k = 0; k < 4; k++) if (!solid(x + DX[k], z + DZ[k]) && !pitMask[idx(x + DX[k], z + DZ[k])]) { n++; dir = k; }
      if (n === 1 && !sewerInfo.doorTiles.has(idx(x, z))) deadEnds.push({ x, z, dir });
    }
  }
  guardNav = blockedEdges.size > 0 || sewerInfo.pitHalls.length > 0;
  // validity: every room, the platforms and the hall must be reachable from the safe-room door
  const seen = new Uint8Array(MW * MH), q = [idx(DOOR.x, DOOR.z)];
  seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % MW, z = (i / MW) | 0;
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k], nz = z + DZ[k];
      if (!inB(nx, nz)) continue;
      const n = idx(nx, nz);
      if (seen[n] || grid[n] === 1 || zone[n] === 1 || pitMask[n] || blockedEdges.has(i * 4096 + n)) continue;
      seen[n] = 1; q.push(n);
    }
  }
  if (rooms.length < SEWER_ROOMS.length) return false;
  if (!sewerInfo.pitHalls.length) return false;
  if (!openTiles.every((t) => seen[idx(t.x, t.z)])) return false;
  return true;
}

function generateSewer() {
  let ok = false;
  for (let a = 0; a < 24 && !ok; a++) ok = sewerAttempt();
  rooms.forEach((r, i) => { r.id = i; });
  // where the watcher starts: the plain room farthest from the safe room
  let best = -1, bd = -1;
  rooms.forEach((r, i) => { if (r.role === 'comms') return; const d = Math.hypot(r.cxw - DOOR_W.x, r.czw - DOOR_W.z); if (d > bd) { bd = d; best = i; } });
  sewerInfo.monRoom = best; sewerInfo.commsId = rooms.findIndex((r) => r.role === 'comms');
  sewerInfo.code = [rndi(0, 9), rndi(0, 9), rndi(0, 9), rndi(0, 9)];           // a fresh 4-digit passcode every run
  return ok;
}

/* can the watcher walk straight from (x0,z0) to (x1,z1)? false when the line crosses a pit or a platform face / stair rail */
function navLineClear(x0, z0, x1, z1) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.7));
  let px = Math.floor(x0 / TILE), pz = Math.floor(z0 / TILE);
  const blocked = (ax, az, bx, bz) => blockedEdges.has((az * MW + ax) * 4096 + bz * MW + bx);
  for (let i = 1; i <= n; i++) {
    const nx = Math.floor((x0 + (x1 - x0) * i / n) / TILE), nz = Math.floor((z0 + (z1 - z0) * i / n) / TILE);
    if (nx === px && nz === pz) continue;
    if (!inB(nx, nz) || pitMask[nz * MW + nx]) return false;
    if (nx !== px && nz !== pz) {                                           // a diagonal step: both L-shaped routes must be free
      if (blocked(px, pz, nx, pz) || blocked(nx, pz, nx, nz) || blocked(px, pz, px, nz) || blocked(px, nz, nx, nz)) return false;
      if (pitMask[pz * MW + nx] || pitMask[nz * MW + px]) return false;
    } else if (blocked(px, pz, nx, nz)) return false;
    px = nx; pz = nz;
  }
  return true;
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
  M.pit = new THREE.MeshPhongMaterial({ color: 0x020303, specular: 0x777777, shininess: 140 });                 // deep, black, glossy water
  M.holeIn = new THREE.MeshBasicMaterial({ color: 0x040404, side: THREE.BackSide });                           // the inside of a pipe hole
}
// furniture makers use M.wood / M.drawer / M.wall / M.pillar: in the sewers those become rusted metal and wet concrete
function useMaterials(act) {
  if (!M0.wood) { M0.wood = M.wood; M0.drawer = M.drawer; M0.wall = M.wall; M0.pillar = M.pillar; }
  if (act === 2) { M.wood = M.rustDark; M.drawer = M.rust; M.wall = M.sWall; M.pillar = M.sWall; }
  else { M.wood = M0.wood; M.drawer = M0.drawer; M.wall = M0.wall; M.pillar = M0.pillar; }
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

const questSpots = [];
function rectFree(x0, z0, x1, z1) {
  for (let i = 0; i < colliders.length; i++) { const c = colliders[i]; if (c.off) continue; if (x1 > c.minX && x0 < c.maxX && z1 > c.minZ && z0 < c.maxZ) return false; }
  return true;
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
  sChair(8.6, 5.3, Math.PI, 0, true); sChair(13.2, 5.2, Math.PI * 0.9, 0, false);
  sBarrel(16.6, 4.1, 0); sCrate(4.3, 10.4, 0.2, 0); sBarrel(4.6, 5.0, 0);
}

function updateSewer(dt) {
  if (S.act !== 2) return;
  T.water.offset.x += dt * 0.012; T.water.offset.y += dt * 0.007;
  if (S.frame % 3 === 0) { drawNoise(sideStatic); drawAudioScreen(); }
}

/* ======================================================================
   ACT 2 BUILD  —  everything here is sewer-only (no house furniture, no closets, no drawers, no backyard)
   ====================================================================== */
const shellCache = {};
const shellGeo = (R) => shellCache[R] || (shellCache[R] = new THREE.CylinderGeometry(R, R, 3.0, 16, 1, true, -Math.PI / 2, Math.PI));
const CEIL_Q = new THREE.PlaneGeometry(3, 3);
const tubeCache = {};
const tubeGeo = (r, L) => { const k = r + '|' + L; return tubeCache[k] || (tubeCache[k] = new THREE.CylinderGeometry(r, r, L, 16, 1, true)); };
const sref = { containers: [], holes: [], terms: [], locker: null, cterm: null, radio: null, spots: [] };
const yawOf = (v) => Math.atan2(v.x, v.z);

function blockAt(x, z, w, d, ry, jamb) {
  const c = Math.abs(Math.cos(ry || 0)), s = Math.abs(Math.sin(ry || 0)), ex = (c * w + s * d) / 2, ez = (s * w + c * d) / 2;
  return addCollider(x - ex, z - ez, x + ex, z + ez, jamb ? { jamb: true } : undefined);
}

/* ---------- tunnels: low walls, half-pipe vaults sized to each tunnel's width, flooded floor ---------- */
function buildSewerStructure() {
  const W = MW * TILE, D = MH * TILE;
  addFloorPlane(0, 0, W, D, 0, M.sFloor, 3);                                       // concrete…
  sewer.water = addFloorPlane(0, 0, W, D, 0.1, M.water, 5);                        // …under a skin of standing water
  sewer.water.receiveShadow = false;
  const lists = { 2: [], 3.4: [], 4.4: [], 5: [] };
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    if (grid[idx(x, z)] !== 1) continue;
    let adj = false, h = 2;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (inB(x + dx, z + dz) && grid[idx(x + dx, z + dz)] === 0) adj = true;
    if (!adj) continue;
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k], nz = z + DZ[k];
      if (inB(nx, nz) && grid[idx(nx, nz)] === 0) { const zn = zone[idx(nx, nz)]; h = Math.max(h, zn === 3 ? 5 : zn === 2 ? 4.4 : zn === 1 ? 3.4 : 2); }
    }
    lists[h].push([x, z]);
  }
  [2, 3.4, 4.4, 5].forEach((h) => {
    const list = lists[h];
    if (!list.length) return;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE, h, TILE), M.sWall, list.length), d = new THREE.Object3D();
    list.forEach((p, i) => { d.position.set((p[0] + 0.5) * TILE, h / 2, (p[1] + 0.5) * TILE); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; world.add(im);
  });
  // ceilings: flat over the safe room, the chambers and the hall …
  addCeilPlane(SAFE.x0 * TILE, SAFE.z0 * TILE, (SAFE.x1 + 1) * TILE, (SAFE.z1 + 1) * TILE, 3.4, M.sCeil, 3);
  rooms.forEach((r) => addCeilPlane(r.x0 * TILE, r.z0 * TILE, (r.x1 + 1) * TILE, (r.z1 + 1) * TILE, 4.4, M.sCeil, 3));
  addCeilPlane(HOUSE_W * TILE, TILE, (MW - 1) * TILE, (MH - 1) * TILE, 5.0, M.sCeil, 3);
  // … and a half-pipe vault over every tunnel: its radius follows the tunnel's width, so wide tunnels get a wide sweeping arch
  const isT = (x, z) => inB(x, z) && grid[idx(x, z)] === 0 && zone[idx(x, z)] === 0 && !sewerInfo.doorTiles.has(idx(x, z));
  const seen = new Set();
  for (let z = 0; z < MH; z++) for (let x = 0; x < HOUSE_W; x++) {
    if (!isT(x, z)) continue;
    let hs = x, he = x, vs = z, ve = z;
    while (isT(hs - 1, z)) hs--; while (isT(he + 1, z)) he++;
    while (isT(x, vs - 1)) vs--; while (isT(x, ve + 1)) ve++;
    const hl = he - hs + 1, vl = ve - vs + 1, cx = (x + 0.5) * TILE, cz = (z + 0.5) * TILE;
    if (Math.min(hl, vl) > 4) { decoPart(baseM(cx, 4.0, cz, 0, Math.PI / 2, 0), CEIL_Q, M.sCeil, 0, 0, 0, 0, 0, 0, 1, 1, 1, true); continue; }
    if (vl <= hl) {                                                                  // the tunnel runs east-west: shell axis along x
      const key = 'x' + x + ':' + vs;
      if (seen.has(key)) continue; seen.add(key);
      decoPart(baseM(cx, 2.0, (vs + ve + 1) / 2 * TILE, Math.PI / 2, -Math.PI / 2, 0), shellGeo(vl * 1.5), M.sArch, 0, 0, 0, 0, 0, 0, 1, 1, vl <= 1 ? 1 : 0.62, true);
    } else {                                                                         // north-south: shell axis along z
      const key = 'z' + z + ':' + hs;
      if (seen.has(key)) continue; seen.add(key);
      decoPart(baseM((hs + he + 1) / 2 * TILE, 2.0, cz, 0, -Math.PI / 2, 0), shellGeo(hl * 1.5), M.sArch, 0, 0, 0, 0, 0, 0, 1, 1, hl <= 1 ? 1 : 0.62, true);
    }
  }
  rooms.forEach((r) => {                                                           // the short 1-tile doorway in front of each gate
    const cx = (r.door.x + 0.5) * TILE, cz = (r.door.z + 0.5) * TILE;
    if (DX[r.fi] !== 0) decoPart(baseM(cx, 2.0, cz, Math.PI / 2, -Math.PI / 2, 0), shellGeo(1.5), M.sArch, 0, 0, 0, 0, 0, 0, 1, 1, 1, true);
    else decoPart(baseM(cx, 2.0, cz, 0, -Math.PI / 2, 0), shellGeo(1.5), M.sArch, 0, 0, 0, 0, 0, 0, 1, 1, 1, true);
  });
  sewerInfo.pitHalls.forEach(buildPitHall);
}

/* ---------- pit halls: a deep flooded pit with a narrow catwalk bridge ---------- */
function buildPitHall(h) {
  const T = TILE, hz = h.horiz;
  const tiles = [];
  for (let a = h.a0; a <= h.a1; a++) {                                              // every tile of the stretch is black water…
    for (let b = 0; b < (hz ? MH : HOUSE_W); b++) {
      const x = hz ? a : b, z = hz ? b : a;
      if (!inB(x, z) || (!pitMask[idx(x, z)] && b !== h.cat)) continue;
      if (b === h.cat) { let ok = false; for (let k = -1; k <= 1; k += 2) { const q = hz ? [x, z + k] : [x + k, z]; if (inB(q[0], q[1]) && pitMask[idx(q[0], q[1])]) ok = true; } if (!ok) continue; }
      tiles.push([x, z]);
    }
  }
  tiles.forEach((p) => decoPart(baseM((p[0] + 0.5) * T, 0.13, (p[1] + 0.5) * T, 0, -Math.PI / 2, 0), UP, M.pit, 0, 0, 0, 0, 0, 0, T, T, 1, true));
  const L0 = h.a0 * T, L1 = (h.a1 + 1) * T, mid = (h.cat + 0.5) * T, len = L1 - L0, DECK = 0.42;
  const place = (along, across, y, w, hgt, d, mat) => {                              // one box, in (along, across) hall coordinates
    const g = newGroup(hz ? along : across, hz ? across : along, 0);
    return addBox(g, hz ? w : d, hgt, hz ? d : w, 0, y, 0, mat);
  };
  place((L0 + L1) / 2, mid, DECK - 0.06, len, 0.12, 1.5, M.rust);                    // the deck
  for (let a = L0 + 1.2; a < L1; a += 3) for (const s of [-1, 1]) place(a, mid + s * 0.62, 0.2, 0.16, 0.4, 0.16, M.rustDark);   // trestle legs
  for (const s of [-1, 1]) {
    place((L0 + L1) / 2, mid + s * 0.74, 1.12, len, 0.06, 0.06, M.rust);             // handrails
    place((L0 + L1) / 2, mid + s * 0.74, 0.78, len, 0.03, 0.03, M.rustDark);         // sagging chain
    for (let a = L0 + 0.3; a < L1; a += 1.6) place(a, mid + s * 0.74, 0.78, 0.07, 0.72, 0.07, M.rust);   // posts
    if (hz) addCollider(L0, mid + s * 0.74 - 0.08, L1, mid + s * 0.74 + 0.08, { jamb: true });
    else addCollider(mid + s * 0.74 - 0.08, L0, mid + s * 0.74 + 0.08, L1, { jamb: true });
  }
  platforms.push(hz ? { x0: L0, x1: L1, z0: mid - 0.74, z1: mid + 0.74, h: DECK } : { x0: mid - 0.74, x1: mid + 0.74, z0: L0, z1: L1, h: DECK });
  const lx = hz ? (L0 + L1) / 2 : mid, lz = hz ? mid : (L0 + L1) / 2;
  addLamp(lx, lz, 3.3, 1.5, true);
}

/* ---------- gates: every side room is closed off by a rusty iron gate (tunnel connectors stay open) ---------- */
function buildSewerGates() {
  rooms.forEach((r) => {
    for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) for (let i = 0; i < 4; i++) {
      const nx = x + DX[i], nz = z + DZ[i];
      if (!inB(nx, nz) || grid[idx(nx, nz)] !== 0 || zone[idx(nx, nz)] !== 0 || pitMask[idx(nx, nz)]) continue;
      makeDoor(x, z, i, nx, nz);
    }
  });
}

/* ---------- little sewer props (all new; nothing from the house) ---------- */
function sChair(x, z, ry, y, broken) {
  const g = newGroup(x, z, ry); g.position.y = y || 0;
  if (!broken) {
    addBox(g, 0.5, 0.06, 0.5, 0, 0.5, 0, M.rustDark); addBox(g, 0.5, 0.5, 0.05, 0, 0.82, -0.23, M.rustDark);
    addBox(g, 0.07, 0.46, 0.07, 0, 0.24, 0, M.rust); addBox(g, 0.6, 0.05, 0.06, 0, 0.04, 0, M.rust, { ry: 0.8 }); addBox(g, 0.6, 0.05, 0.06, 0, 0.04, 0, M.rust, { ry: -0.8 });
    blockAt(x, z, 0.55, 0.55, ry);
  } else {                                                                           // a snapped chair lying on its side
    addBox(g, 0.5, 0.06, 0.5, 0, 0.3, 0, M.rustDark, { rz: 1.1 }); addBox(g, 0.5, 0.5, 0.05, 0.28, 0.12, 0, M.rustDark, { rz: 0.4 });
    addBox(g, 0.07, 0.46, 0.07, -0.1, 0.35, 0.1, M.rust, { rz: 0.7 }); addBox(g, 0.6, 0.05, 0.06, 0.1, 0.1, -0.15, M.rust, { ry: 0.5 });
  }
  return g;
}
function sBarrel(x, z, y) {
  const g = newGroup(x, z, 0); g.position.y = y || 0;
  const b = new THREE.Mesh(cgeo(0.42, 0.42, 1.0, 12), M.rustDark); b.position.y = 0.5; b.castShadow = true; g.add(b);
  addBox(g, 0.9, 0.05, 0.9, 0, 0.3, 0, M.rust, { ry: 0.78 }); addBox(g, 0.9, 0.05, 0.9, 0, 0.7, 0, M.rust, { ry: 0.78 });
  blockAt(x, z, 0.9, 0.9, 0);
}
function sCrate(x, z, ry, y) {
  const g = newGroup(x, z, ry); g.position.y = y || 0;
  addBox(g, 1.0, 0.9, 1.0, 0, 0.45, 0, M.plank); addBox(g, 1.04, 0.08, 1.04, 0, 0.1, 0, M.rustDark); addBox(g, 1.04, 0.08, 1.04, 0, 0.8, 0, M.rustDark);
  blockAt(x, z, 1.0, 1.0, ry);
}
function sValve(x, z, y) {
  const g = newGroup(x, z, rnd(0, TAU)); g.position.y = y || 0;
  const p = new THREE.Mesh(cgeo(0.12, 0.12, 1.2, 8), M.rust); p.position.y = 0.6; g.add(p);
  const w = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 6, 14), M.rustDark); w.position.y = 1.25; w.rotation.x = Math.PI / 2; g.add(w);
  addBox(g, 0.5, 0.04, 0.04, 0, 1.25, 0, M.rustDark); blockAt(x, z, 0.4, 0.4, 0);
}
function sDesk(x, z, ry, y, w) {
  const g = newGroup(x, z, ry); g.position.y = y || 0; w = w || 1.5;
  addBox(g, w, 0.08, 0.8, 0, 0.78, 0, M.rustDark); addBox(g, 0.08, 0.76, 0.7, -w / 2 + 0.07, 0.38, 0, M.rustDark); addBox(g, 0.08, 0.76, 0.7, w / 2 - 0.07, 0.38, 0, M.rustDark);
  addBox(g, w - 0.1, 0.5, 0.04, 0, 0.45, -0.34, M.rust);
  blockAt(x, z, w, 0.8, ry);
  return g;
}
function sMonitor(parent, x, y, z, w, h, ry) {                                       // a bulky old terminal with a static-filled screen
  const m = new THREE.Group(); m.position.set(x, y, z); m.rotation.y = ry || 0; parent.add(m);
  addBox(m, w, h, 0.4, 0, h / 2, 0, M.dark);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.82, h * 0.78), sideStatic.mat); s.position.set(0, h / 2, 0.205); m.add(s);
  return m;
}
function sConsole(x, z, ry, y) {                                                     // a low control console with an angled panel
  const g = newGroup(x, z, ry); g.position.y = y || 0;
  addBox(g, 2.2, 0.8, 0.8, 0, 0.4, 0, M.rustDark); addBox(g, 2.2, 0.05, 0.7, 0, 0.82, -0.02, M.metal);
  addBox(g, 2.1, 0.5, 0.06, 0, 1.12, -0.3, M.dark, { rx: -0.35 });
  for (let k = 0; k < 6; k++) addBox(g, 0.1, 0.04, 0.1, -0.8 + k * 0.32, 0.87, 0.12, M.shadeOn);
  sMonitor(g, -0.55, 0.82, -0.22, 0.55, 0.45, 0.2); sMonitor(g, 0.55, 0.82, -0.22, 0.55, 0.45, -0.2);
  blockAt(x, z, 2.2, 0.8, ry);
}
function sToolbox(x, z, ry, y) {                                                    // a searchable container (rusty tool chest)
  const g = newGroup(x, z, ry); g.position.y = y || 0;
  addBox(g, 0.9, 0.35, 0.45, 0, 0.175, 0, M.rust); addBox(g, 0.94, 0.08, 0.49, 0, 0.39, 0, M.rustDark); addBox(g, 0.3, 0.04, 0.05, 0, 0.47, 0, M.metal);
  blockAt(x, z, 0.9, 0.45, ry);
  const s = { kind: 'alcove', style: 'toolbox', x, z, range: 2.1, minDot: 0.1, dur: 2.0, searched: false, contains: null, lid: g.children[1] };
  interactables.push(s); searchSpots.push(s); sref.containers.push(s);
  return s;
}

/* ---------- the pipe-hole hiding places (they replace the closets) ---------- */
function makeHole(tx, tz, i, floor) {
  const it = wallItem(tx, tz, i), g = it.g, L = 1.9, r = floor ? 0.55 : 0.72, cy = floor ? 0.2 : 0.8;
  addBox(g, r * 2 + 0.7, floor ? 1.05 : r * 2 + 0.6, 0.22, 0, floor ? 0.52 : cy, 0.11, M.sWall);       // concrete collar against the wall
  const tube = new THREE.Mesh(tubeGeo(r, L), M.sWall); tube.rotation.x = Math.PI / 2; tube.position.set(0, cy, L / 2 + 0.1); tube.castShadow = true; g.add(tube);
  const inner = new THREE.Mesh(tubeGeo(r - 0.05, L), M.holeIn); inner.rotation.x = Math.PI / 2; inner.position.copy(tube.position); g.add(inner);   // pitch black inside
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 6, 18), M.sWall); rim.position.set(0, cy, L + 0.1); g.add(rim);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(r - 0.04, 16), M.black); cap.position.set(0, cy, 0.24); g.add(cap);
  const ox = it.ox, oz = it.oz, fx = it.fx, fz = it.fz;
  const ex = Math.abs(fx) > 0 ? L / 2 + 0.2 : r + 0.3, ez = Math.abs(fz) > 0 ? L / 2 + 0.2 : r + 0.3, cx = ox + fx * (L / 2 + 0.1), cz = oz + fz * (L / 2 + 0.1);
  addCollider(cx - ex, cz - ez, cx + ex, cz + ez, { jamb: true });
  const mouth = { x: ox + fx * (L + 0.1), z: oz + fz * (L + 0.1) };
  const c = {
    kind: 'closet', style: 'hole', floorHole: !!floor, id: closets.length, x: cx, z: cz, range: 3.0, minDot: 0.3, group: g, tx, tz,
    face: { x: fx, z: fz }, yaw: Math.atan2(-fx, -fz),
    inside: { x: ox + fx * 0.95, z: oz + fz * 0.95 }, mouth,
    front: { x: mouth.x + fx * 1.7, z: mouth.z + fz * 1.7 },                         // where the watcher crouches to look in
    exit: { x: mouth.x + fx * 1.15, z: mouth.z + fz * 1.15 },
    camY: floor ? 0.5 : 0.85, doorL: new THREE.Group(), doorR: new THREE.Group(), doorOpen: 0, doorTarget: 0, doorFast: false,
  };
  closets.push(c); interactables.push(c); sref.holes.push(c);
  return c;
}
/* ---------- small wall alcoves / pipe openings you can search ---------- */
function makeAlcove(tx, tz, i) {
  const it = wallItem(tx, tz, i), g = it.g;
  addBox(g, 1.3, 1.1, 0.2, 0, 1.0, 0.1, M.sWall);
  const rec = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), M.black); rec.position.set(0, 1.0, 0.205); g.add(rec);
  addBox(g, 1.0, 0.06, 0.1, 0, 1.38, 0.24, M.rustDark); addBox(g, 1.0, 0.06, 0.1, 0, 0.62, 0.24, M.rustDark); addBox(g, 0.06, 0.8, 0.1, -0.5, 1.0, 0.24, M.rustDark); addBox(g, 0.06, 0.8, 0.1, 0.5, 1.0, 0.24, M.rustDark);
  const stub = new THREE.Mesh(cgeo(0.14, 0.14, 0.5, 10), M.rust); stub.rotation.x = Math.PI / 2; stub.position.set(-0.45, 0.35, 0.3); g.add(stub);
  const ox = it.ox, oz = it.oz, fx = it.fx, fz = it.fz;
  const ex = Math.abs(fx) > 0 ? 0.2 : 0.7, ez = Math.abs(fz) > 0 ? 0.2 : 0.7;
  addCollider(ox + fx * 0.2 - ex, oz + fz * 0.2 - ez, ox + fx * 0.2 + ex, oz + fz * 0.2 + ez);
  const s = { kind: 'alcove', style: 'niche', x: ox + fx * 0.5, z: oz + fz * 0.5, range: 2.1, minDot: 0.35, dur: 2.0, searched: false, contains: null };
  interactables.push(s); searchSpots.push(s); sref.containers.push(s);
  return s;
}

/* ---------- terminals (code fragments + lore), the central terminal, locker, radio ---------- */
function makeTermProp(x, z, ry, y, kind, idx) {
  const g = sDesk(x, z, ry, y, 1.5);
  sMonitor(g, 0, 0.82, -0.12, 0.62, 0.5, 0);
  addBox(g, 0.5, 0.03, 0.18, 0, 0.84, 0.25, M.dark);
  const t = { kind, idx, x, z, range: 2.4, minDot: 0.2 };
  interactables.push(t);
  return t;
}
function makeLocker(x, z, ry, y) {
  const g = newGroup(x, z, ry); g.position.y = y || 0;
  addBox(g, 0.82, 1.9, 0.04, 0, 0.95, -0.26, M.rust); addBox(g, 0.04, 1.9, 0.56, -0.39, 0.95, 0, M.rust); addBox(g, 0.04, 1.9, 0.56, 0.39, 0.95, 0, M.rust);
  addBox(g, 0.82, 0.04, 0.56, 0, 1.9, 0, M.rust); addBox(g, 0.82, 0.04, 0.56, 0, 0.03, 0, M.rust); addBox(g, 0.74, 0.03, 0.5, 0, 0.5, 0, M.rustDark);
  const hinge = new THREE.Group(); hinge.position.set(-0.4, 0, 0.29); g.add(hinge);
  addBox(hinge, 0.78, 1.82, 0.04, 0.39, 0.95, 0, M.rustDark); addBox(hinge, 0.1, 0.22, 0.05, 0.62, 0.95, 0.04, M.metal);
  const bar = addBox(g, 0.7, 0.035, 0.035, 0, 0.55, 0.05, M.metal, { rz: 0.0, ry: 0.4 });   // the crowbar waiting inside
  blockAt(x, z, 0.82, 0.56, ry);
  const fx = Math.sin(ry), fz = Math.cos(ry);
  const l = { kind: 'locker', x: x + fx * 0.3, z: z + fz * 0.3, range: 2.3, minDot: 0.15, open: false, angle: 0, hinge, bar };
  bar.visible = false;
  interactables.push(l); sref.locker = l;
  return l;
}
function makeRadioProp(x, z, ry, y) {
  const g = sDesk(x, z, ry, y, 1.3), r = new THREE.Group(); r.position.set(0, 0.86, 0); g.add(r);
  addBox(r, 0.5, 0.3, 0.25, 0, 0.15, 0, M.dark); addBox(r, 0.4, 0.2, 0.01, 0, 0.16, 0.13, M.shade); addBox(r, 0.02, 0.5, 0.02, 0.2, 0.55, 0, M.metal);
  const dial = new THREE.Mesh(cgeo(0.04, 0.04, 0.02, 12), M.metal); dial.rotation.x = Math.PI / 2; dial.position.set(-0.12, 0.16, 0.14); r.add(dial);
  const o = { kind: 'radio', x, z, range: 2.3, minDot: 0.15, dur: 7, noiseT: 0, group: g };
  interactables.push(o); sref.radio = o;
  return o;
}

/* ---------- rooms: elevated platforms + stairs, props, lamps ---------- */
function buildPlatform(r) {
  const p = r.plat, H = p.h, rp = r.ramp, n = 6;
  addBox(world, p.x1 - p.x0, H, p.z1 - p.z0, (p.x0 + p.x1) / 2, H / 2, (p.z0 + p.z1) / 2, M.sWall);               // the raised concrete platform
  addBox(world, p.x1 - p.x0 + 0.06, 0.05, p.z1 - p.z0 + 0.06, (p.x0 + p.x1) / 2, H + 0.02, (p.z0 + p.z1) / 2, M.sFloor);
  for (let k = 0; k < n; k++) {                                                                                   // stairs
    const h = H * (k + 1) / n;
    if (rp.ax === 'x') { const w = (rp.x1 - rp.x0) / n, xx = rp.sgn > 0 ? rp.x0 + (k + 0.5) * w : rp.x1 - (k + 0.5) * w; addBox(world, w, h, rp.z1 - rp.z0 - 0.3, xx, h / 2, (rp.z0 + rp.z1) / 2, M.sWall); }
    else { const w = (rp.z1 - rp.z0) / n, zz = rp.sgn > 0 ? rp.z0 + (k + 0.5) * w : rp.z1 - (k + 0.5) * w; addBox(world, rp.x1 - rp.x0 - 0.3, h, w, (rp.x0 + rp.x1) / 2, h / 2, zz, M.sWall); }
  }
  const bx = -DX[r.fi], bz = -DZ[r.fi];
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) {                                         // the platform's front face is solid (even to the watcher); only the stairs lead up
    const l = roomLocal(r, x, z);
    if (l.dep !== r.platStart - 1) continue;
    if (l.lat !== r.stairLat) {
      if (bx !== 0) { const e = (bx > 0 ? x + 1 : x) * TILE; addCollider(e - 0.18, z * TILE, e + 0.18, (z + 1) * TILE, { jamb: true }); }
      else { const e = (bz > 0 ? z + 1 : z) * TILE; addCollider(x * TILE, e - 0.18, (x + 1) * TILE, e + 0.18, { jamb: true }); }
    } else {
      for (const sd of [-1, 1]) {                                                                                 // stair rails
        const qx = x + (bx !== 0 ? 0 : sd), qz = z + (bz !== 0 ? 0 : sd);
        if (!inB(qx, qz) || roomId[idx(qx, qz)] !== r.id) continue;
        if (bx !== 0) { const e = (sd > 0 ? z + 1 : z) * TILE; addCollider(x * TILE, e - 0.13, (x + 1) * TILE, e + 0.13, { jamb: true }); addBox(world, TILE, 0.06, 0.06, (x + 0.5) * TILE, 1.0, e, M.rust); }
        else { const e = (sd > 0 ? x + 1 : x) * TILE; addCollider(e - 0.13, z * TILE, e + 0.13, (z + 1) * TILE, { jamb: true }); addBox(world, 0.06, 0.06, TILE, e, 1.0, (z + 0.5) * TILE, M.rust); }
      }
    }
  }
}
function buildSewerRoom(r) {
  addLamp(r.cxw, r.czw, 4.2, 1.4, Math.random() < 0.35);
  if (r.elev) {
    buildPlatform(r);
    const q = roomPos(r, r.D - 1.2, r.W / 2); addLamp(q.x, q.z, 4.2, 1.0, Math.random() < 0.5);
  }
  const fd = { x: DX[r.fi], z: DZ[r.fi] }, ld = fd.x !== 0 ? { x: 0, z: 1 } : { x: 1, z: 0 };
  const Hp = r.elev ? PLAT_H : 0, fyaw = yawOf(fd);
  const at = (dep, lat) => roomPos(r, dep, lat), toward = (k) => yawOf({ x: ld.x * k, z: ld.z * k });
  if (r.elev) {                                                                                  // consoles, terminals and broken chairs on the platform
    [0.5, r.W - 0.5].forEach((lat, k) => {
      const q = at(r.D - 1.05, lat);
      sConsole(q.x, q.z, toward(k ? -1 : 1), Hp);
      const c = at(r.D - 1.05, k ? lat - 1.15 : lat + 1.15); sChair(c.x, c.z, rnd(0, TAU), Hp, k === 0);
    });
    const t = at(r.D - 1.9, r.W / 2 + rnd(-0.5, 0.5)); sChair(t.x, t.z, rnd(0, TAU), Hp, true);
    const lo = r.stairLat === 0 ? rnd(2.0, r.W - 0.7) : rnd(0.7, r.W - 2.0), tb = at(1.2, lo);   // toolbox in the low front area, clear of the stairs
    sToolbox(tb.x, tb.z, fyaw, 0);
    const bb = at(0.55, r.stairLat === 0 ? r.W - 0.5 : 0.5); sBarrel(bb.x, bb.z, 0);
  } else {
    const a = at(1.2, 0.5); sCrate(a.x, a.z, toward(1), 0);
    const b = at(1.3, r.W - 0.5); sBarrel(b.x, b.z, 0);
    const v = at(r.D - 0.7, r.W - 0.5); sValve(v.x, v.z, 0);
    const c = at(1.9, r.W / 2 + rnd(-0.8, 0.8)); sChair(c.x, c.z, rnd(0, TAU), 0, true);
    const tb = at(r.D - 0.7, 0.55); sToolbox(tb.x, tb.z, toward(1), 0);
  }
}

/* ---------- which spots on the walls are free for holes / alcoves / culverts ---------- */
function wallCandidates() {
  const out = [], doorPts = doors.map((d) => [d.cx, d.cz]);
  openTiles.forEach((t) => {
    if (t.x >= HOUSE_W - 1 || sewerInfo.doorTiles.has(idx(t.x, t.z))) return;
    const rid = roomId[idx(t.x, t.z)], r = rid >= 0 ? rooms[rid] : null;
    if (r && r.elev && roomLocal(r, t.x, t.z).dep >= r.platStart - 1) return;                       // not on / below the platform
    for (let i = 0; i < 4; i++) {
      if (!solid(t.x + DX[i], t.z + DZ[i])) continue;
      let bad = false;
      for (let k = 0; k < 4 && !bad; k++) { const q = idx(t.x + DX[k], t.z + DZ[k]); if (inB(t.x + DX[k], t.z + DZ[k]) && pitMask[q]) bad = true; }
      const wp = wallPoint(t.x, t.z, i);
      if (bad || doorPts.some((p) => Math.hypot(p[0] - wp[0], p[1] - wp[1]) < 4.2) || Math.hypot(DOOR_W.x - wp[0], DOOR_W.z - wp[1]) < 5) continue;
      out.push({ x: t.x, z: t.z, i, wp, room: rid });
    }
  });
  return shuffle(out);
}
function placeSpots(cands, n, minGap, test, make) {
  let c = 0;
  for (let k = 0; k < cands.length && c < n; k++) {
    const s = cands[k];
    if (sref.spots.some((p) => Math.hypot(p[0] - s.wp[0], p[1] - s.wp[1]) < minGap)) continue;
    if (test && !test(s)) continue;
    sref.spots.push(s.wp); make(s); c++;
  }
  return c;
}
const freeAlong = (s, n) => {                                                                       // n open tiles in front of a wall spot
  const f = [-DX[s.i], -DZ[s.i]];
  for (let k = 1; k <= n; k++) { const x = s.x + f[0] * (k - 1), z = s.z + f[1] * (k - 1); if (!inB(x, z) || solid(x, z) || pitMask[idx(x, z)]) return false; }
  return true;
};

/* ---------- assigning the story items to random containers (side rooms + wall alcoves only) ---------- */
function assignQuestItems() {
  const types = ['screen', 'battery', 'lockerKey'], chosen = [];
  const pool = sref.containers.filter((c) => !c.contains);
  types.forEach((t) => {
    let best = null, bs = -1;
    for (let k = 0; k < 12; k++) {                                                                  // random, but spread out
      const c = pick(pool);
      if (chosen.includes(c)) continue;
      const d = Math.min(Math.hypot(c.x - DOOR_W.x, c.z - DOOR_W.z), ...chosen.map((o) => Math.hypot(c.x - o.x, c.z - o.z)));
      if (d > bs) { bs = d; best = c; }
    }
    if (!best) best = pool.find((c) => !chosen.includes(c));
    best.contains = t; chosen.push(best);
  });
}

function buildSewerProps() {
  sref.containers.length = 0; sref.holes.length = 0; sref.terms.length = 0; sref.spots.length = 0; sref.locker = null; sref.cterm = null; sref.radio = null;
  rooms.forEach(buildSewerRoom);
  // ---- the Communications Room: central terminal, emergency radio and the crowbar locker on the back of the platform ----
  const cr = rooms[sewerInfo.commsId], fd = { x: DX[cr.fi], z: DZ[cr.fi] }, fy = yawOf(fd), at = (d, l) => roomPos(cr, d, l);
  const a = at(cr.D - 0.55, cr.W / 2), b = at(cr.D - 0.55, cr.W / 2 + 1.55), c = at(cr.D - 0.45, cr.W / 2 - 1.5);
  sref.cterm = makeTermProp(a.x, a.z, fy, PLAT_H, 'cterm', 4);
  makeRadioProp(b.x, b.z, fy, PLAT_H);
  makeLocker(c.x, c.z, fy, PLAT_H);
  // ---- four old terminals, one in each of four other side rooms, each holding one digit of the code ----
  const others = shuffle(rooms.filter((r) => r.role !== 'comms')).slice(0, 4);
  sewerInfo.termRooms = others.map((r) => r.id);
  others.forEach((r, k) => {
    const p = roomPos(r, r.D - 0.55, rnd(1.0, r.W - 1.0));
    sref.terms.push(makeTermProp(p.x, p.z, yawOf({ x: DX[r.fi], z: DZ[r.fi] }), r.elev ? PLAT_H : 0, 'terminal', k));
  });
  // ---- wall holes (hiding), small alcoves (search), decorative culvert mouths ----
  const cands = wallCandidates();
  const nHoles = placeSpots(cands, 13, 7, (s) => freeAlong(s, 3), (s) => makeHole(s.x, s.z, s.i, Math.random() < 0.35));
  const nAlc = placeSpots(cands, 15, 5, (s) => true, (s) => makeAlcove(s.x, s.z, s.i));
  placeSpots(cands, 9, 4.5, null, (s) => {
    const w0 = wallLocal(s.x, s.z, s.i, 0, 0.03);
    decoPart(baseM(w0.x, 1.0, w0.z, w0.ry), SEWER_DISC, M.black, 0, 0, 0, 0, 0, 0, 1, 1, 1, true);
    decoPart(baseM(w0.x, 1.0, w0.z, w0.ry), SEWER_RING, M.sWall, 0, 0, 0.02, 0, 0, 0, 1, 1, 1, true);
  });
  assignQuestItems();
  return { nHoles, nAlc };
}

/* ---------- lamps, pipes, rubble ---------- */
function buildSewerLampsAndDecor() {
  const tiles = shuffle(openTiles.filter((t) => zone[idx(t.x, t.z)] === 0 && t.x < HOUSE_W - 1 && !sewerInfo.doorTiles.has(idx(t.x, t.z))));
  tiles.forEach((t) => {
    const wx = (t.x + 0.5) * TILE, wz = (t.z + 0.5) * TILE;
    if (lamps.some((L) => Math.hypot(L.x - wx, L.z - wz) < 8.5)) return;
    addLamp(wx, wz, 3.3, 1.2, Math.random() < 0.3);
  });
  const dcn = QD();
  openTiles.forEach((t) => {
    if (zone[idx(t.x, t.z)] !== 0) return;
    for (let i = 0; i < 4; i++) {                                                    // drain pipes hugging the tunnel walls
      if (!solid(t.x + DX[i], t.z + DZ[i]) || Math.random() > 0.3 * dcn + 0.05) continue;
      const p = sidePos(t.x, t.z, i, 0.2), y = rnd(0.5, 1.25), r = rnd(0.08, 0.18), alongX = DX[i] === 0;
      decoPart(baseM(p[0], y, p[1], 0, alongX ? 0 : Math.PI / 2, alongX ? Math.PI / 2 : 0), cgeo(r, r, 3.0, 10), M.rust, 0, 0, 0);
      dBox(baseM(p[0], y, p[1], 0), M.dark, 0, 0, 0, 0.14, r * 2 + 0.1, 0.14);
    }
  });
  for (let k = 0, n = Math.round(60 * dcn); k < n; k++) { const t = pick(openTiles); dBox(baseM((t.x + rnd(0.1, 0.9)) * TILE, 0.04, (t.z + rnd(0.1, 0.9)) * TILE, rnd(0, 3)), M.rubble, 0, 0, 0, rnd(0.1, 0.4), 0.08, rnd(0.1, 0.3), 0, 0, 0, true); }
}

function buildSewerHall() {
  GATE_POS = { x: (MW - 1) * TILE, z: (GATE_TZ + 0.5) * TILE };
  const XH = HOUSE_W * TILE, XE = (MW - 1) * TILE;
  for (let tx = HOUSE_W + 3; tx < MW - 3; tx += 4) for (let tz = 4; tz < MH - 3; tz += 4) {       // columns on a loose grid
    const x = (tx + 0.5) * TILE, z = (tz + 0.5) * TILE;
    if (Math.hypot(x - GATE_POS.x, z - GATE_POS.z) < 9) continue;
    if (Math.abs(z - 28.5) < 3.6 || Math.abs(z - 58.5) < 3.6 || Math.abs(z - 82.5) < 3.6) { if (x < XH + 12) continue; }
    decoPart(baseM(x, 0, z, 0), cgeo(0.5, 0.55, 5.0, 12), M.sWall, 0, 2.5, 0);
    decoPart(baseM(x, 0, z, 0), cgeo(0.8, 0.8, 0.3, 12), M.sWall, 0, 0.15, 0);
    addCollider(x - 0.55, z - 0.55, x + 0.55, z + 0.55);
  }
  for (let k = 0; k < 5; k++) decoPart(baseM(XH + (XE - XH) / 2, 4.3, rnd(8, MH * TILE - 8), 0, 0, Math.PI / 2), cgeo(0.35, 0.35, XE - XH, 12), M.rust, 0, 0, 0, 0, 0, 0, 1, 1, 1, true);
  for (let tx = HOUSE_W + 2; tx < MW - 2; tx += 6) for (let tz = 3; tz < MH - 2; tz += 6) addLamp((tx + 0.5) * TILE, (tz + 0.5) * TILE, 4.8, 1.5, Math.random() < 0.4);
  // a few drums and crates in the hall (no house furniture)
  for (let k = 0; k < 10; k++) {
    const x = rnd(XH + 4, XE - 6), z = rnd(6, MH * TILE - 6);
    if (Math.hypot(x - GATE_POS.x, z - GATE_POS.z) < 8 || !rectFree(x - 1, z - 1, x + 1, z + 1)) continue;
    if (Math.random() < 0.5) sBarrel(x, z, 0); else sCrate(x, z, rnd(0, TAU), 0);
  }
  buildExitHatch();
}

function buildSewerPickups() {
  pickupGlow = null;
  [['flare', 13.4, 5.0], ['bottle', 14.3, 5.5], ['bottle', 7.2, 4.7], ['energy', 8.3, 10.6]].forEach((p) => makePickup(p[0], p[1], p[2]));
}

/* ---------- ten audio-only channels ---------- */
function buildChannels() {
  cams.length = 0;
  const add = (name, x, z, tx, tz) => cams.push({ name, x, y: 2.4, z, tx, ty: 1.0, tz, amp: 0.4, spd: 0.3, ph: 0, mesh: null, hum: rnd(48, 110), drip: rnd(0.5, 2.2), rattle: rnd(7, 18) });
  rooms.forEach((r) => add(r.name, r.cxw, r.czw, r.cxw + 3, r.czw));
  const tun = openTiles.filter((t) => zone[idx(t.x, t.z)] === 0 && t.x < 28 && !pitMask[idx(t.x, t.z)]);
  const near = (px, pz) => tun.reduce((b, t) => (Math.hypot(t.x - px, t.z - pz) < Math.hypot(b.x - px, b.z - pz) ? t : b), tun[0]);
  const n1 = near(15, 7), n2 = near(15, 24);
  add('NORTH TUNNEL', (n1.x + 0.5) * TILE, (n1.z + 0.5) * TILE, (n1.x + 3.5) * TILE, (n1.z + 0.5) * TILE);
  add('SOUTH TUNNEL', (n2.x + 0.5) * TILE, (n2.z + 0.5) * TILE, (n2.x + 3.5) * TILE, (n2.z + 0.5) * TILE);
  add('OUTFALL HALL', 120, 46.5, 140, 46.5);
}

/* ======================================================================
   OBJECTIVES  ·  ACT 2 STORY LOGIC
   ====================================================================== */
const OBJ2 = [
  { key: 'explore', text: 'Explore the flooded sewers.' },
  { key: 'screen', text: 'Find a replacement screen to repair the Motion Tracker.' },
  { key: 'radio', text: 'Find the Communications Room, a fresh battery and the 4-digit security code (fragments are stored on old terminals) to power the emergency radio and broadcast for help.' },
  { key: 'exit', text: 'Locate the sewer exit door.' },
  { key: 'crowbar', text: 'Find the Locker Key, open the metal locker in the Communications Room, and use the heavy crowbar to pry the planks off the final exit hatch.' },
];
function objectiveList() {
  if (S.act === 1) {
    return [
      { text: 'Find the ' + TOTAL_KEYS + ' keys hidden in the house' + (floorsOn() ? ', on both floors.  (' : '.  (') + S.keys + '/' + TOTAL_KEYS + ')', done: S.keys >= TOTAL_KEYS },
      { text: 'Unlock the ' + TOTAL_KEYS + ' padlocks on the safe room door.  (' + S.locks + '/' + TOTAL_KEYS + ')', done: S.locks >= TOTAL_KEYS },
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
    if (S.quest.battery) have.push('Fresh battery'); if (S.quest.lockerKey) have.push('Locker key'); if (S.quest.crowbar && !S.obj.crowbar) have.push('Crowbar');
    if (have.length) carry = '<div class="o carry">Carrying: ' + have.join(', ') + '</div>';
    if (S.codeSeen.some(Boolean) && !S.radioDone) carry += '<div class="o carry">Code: ' + S.codeSeen.map((v, i) => (v ? sewerInfo.code[i] : '#')).join(' ') + (S.codeOk ? '  (entered)' : '') + '</div>';
    if (S.radarBroken) carry += '<div class="o carry">Motion Tracker: BROKEN</div>';
  }
  el.objectives.innerHTML = html + carry;
  if (el['pause-objectives']) el['pause-objectives'].innerHTML = '<h3>Objectives</h3>' + pauseHtml + carry;
}
const updateObjectives = renderObjectives;

function resetAct2State() {
  S.quest = { screen: false, battery: false, lockerKey: false, crowbar: false };
  S.obj = { explore: false, screen: false, radio: false, exit: false, crowbar: false };
  S.radarBroken = S.act === 2; S.radioDone = false; S.visited = new Set(); S.monitorOn = false; S.codeSeen = [false, false, false, false]; S.codeOk = false;
  S.controlLocked = false;
  if (S.act === 2) {
    sref.containers.forEach((c) => { c.searched = false; if (c.lid) { c.lid.position.y = 0.39; c.lid.rotation.x = 0; } });
    if (sref.locker) { sref.locker.open = false; sref.locker.angle = 0; sref.locker.hinge.rotation.y = 0; sref.locker.bar.visible = false; }
    if (exitHatch.hinge) {
      exitHatch.planks.forEach((p) => { p.fall = 0; p.mesh.position.y = p.y0; p.mesh.rotation.z = 0; p.mesh.visible = true; });
      exitHatch.open = false; exitHatch.angle = 0; exitHatch.hinge.rotation.y = 0; exitHatch.t = 0; exitHatch.pried = false;
    }
  }
  renderObjectives();
}

/* ---------- picking things up (story items only ever sit in side-room containers and wall alcoves) ---------- */
function giveQuest(type) {
  if (type === 'screen') {                                                          // swapping the spare screen repairs the tracker
    S.quest.screen = true; S.obj.screen = true; S.radarBroken = false;
    Snd.laptop(); toast('YOU SWAP THE SHATTERED SCREEN.\nMOTION TRACKER REPAIRED', 3400);
  } else if (type === 'battery') { S.quest.battery = true; toast('FRESH BATTERY', 2200); }
  else if (type === 'lockerKey') { S.quest.lockerKey = true; toast('A SMALL LOCKER KEY', 2400); }
  renderObjectives();
}
function finishAlcove(it) {
  it.searched = true;
  if (it.lid) { it.lid.position.y += 0.1; it.lid.rotation.x = -0.35; }              // toolbox lid left ajar
  if (it.contains) { Snd.key(); triggerReach('pick', 0.7); giveQuest(it.contains); return; }
  const drop = Math.random() < 0.4 ? pick(DROP_TABLE) : null;
  if (drop && invAdd(drop)) { Snd.key(); triggerReach('pick', 0.6); toast('FOUND: ' + ITEM_DEFS[drop].name.toUpperCase(), 2200); }
  else toast(it.style === 'toolbox' ? 'NOTHING BUT RUSTED TOOLS.' : 'JUST DUST AND DRIPPING WATER.');
}

/* ---------- old terminals: one digit of the passcode each, plus the story of this place ---------- */
const TERM_LOGS = [
  { head: 'STATION 9  //  MAINTENANCE LOG 0412', body: ['DAY 1. THE LOW CISTERN FLOODED.', 'PUMPS RAN ALL NIGHT. THE WATER', 'WOULD NOT DROP. NO RAIN IN NINE', 'DAYS.', '', 'DAY 2. KNOCKING IN PIPE 7. THREE', 'TAPS, A PAUSE, THREE TAPS.', 'FOREMAN SAYS WATER HAMMER.', 'IT IS NOT WATER HAMMER.', '', 'DAY 3. THE KNOCKING ANSWERS', 'WHEN WE KNOCK BACK.'] },
  { head: 'STATION 9  //  INCIDENT REPORT 17-B', body: ['THREE MEN WENT INTO PIPE 7 TO', 'CLEAR THE BLOCKAGE. TWO CAME OUT.', '', 'THE THIRD, M. HALLORAN, STAYED', 'BEHIND. HE SAID HE WANTED TO', 'LISTEN. WE HEARD HIM THROUGH THE', 'WALL FOR SIX HOURS.', 'HE WAS COUNTING OUR FOOTSTEPS.', '', 'NOBODY HAS GONE BACK IN.'] },
  { head: 'CITY SEWER AUTHORITY  //  MEMO', body: ['STATION 9 IS TO BE SEALED.', 'DO NOT RETRIEVE EQUIPMENT.', 'DO NOT RUN. IT HEARS RUNNING.', '', 'THE BROADCAST CODE IS SPLIT', 'ACROSS FOUR TERMINALS SO NO ONE', 'WORKER CAN SEND A FALSE ALARM.', 'THE RADIO NEEDS A FRESH BATTERY.', 'THE STORES ARE STILL STOCKED.'] },
  { head: 'OPERATOR NOTES  //  COMMS ROOM', body: ['THE LIGHTS FLICKER WHEN IT PASSES', 'THE GATES. I HEAR THE SLOSHING', 'NOW. SLOW. PATIENT.', '', 'I HID IN THE WALL PIPES TWICE.', 'IT BENDS DOWN AND LOOKS IN WITH', 'THOSE WHITE EYES. HOLD YOUR', "BREATH. DON'T MOVE.", '', 'THE CROWBAR IS IN THE LOCKER.', 'I HID THE KEY SOMEWHERE SMALL.', 'IF YOU ARE READING THIS: GO.'] },
];
function showTerminalText(text) {
  el['term-text'].textContent = text;
  setMode('terminal'); setPrompt(''); Snd.note();
}
function openTerminal(t) {
  const L = TERM_LOGS[t.idx], bar = '-'.repeat(34), frag = ['#', '#', '#', '#'];
  S.codeSeen[t.idx] = true; frag[t.idx] = String(sewerInfo.code[t.idx]);
  showTerminalText(L.head + '\n' + bar + '\n\n' + L.body.join('\n') + '\n\n' + bar + '\nACCESS FRAGMENT ' + (t.idx + 1) + ' OF 4\n   >>  ' + frag.join(' ') + '  <<');
  renderObjectives();
}

/* ---------- the central terminal: enter the 4-digit passcode ---------- */
const kp = { d: ['', '', '', ''], pos: 0, msg: '' };
function drawKeypad() {
  el['kp-code'].innerHTML = kp.d.map((v, i) => '<span class="kd' + (i === kp.pos ? ' cur' : '') + '">' + (v === '' ? '_' : v) + '</span>').join('');
  el['kp-msg'].textContent = kp.msg;
}
function openKeypad() {
  if (S.codeOk) { showTerminalText('STATION 9  //  BROADCAST CONSOLE\n' + '-'.repeat(34) + '\n\nAUTHORISATION: ACCEPTED\nRADIO LINK: ' + (S.radioDone ? 'TRANSMITTED' : 'AWAITING POWER') + '\n\nTHE EMERGENCY RADIO NEEDS A FRESH\nBATTERY. THEN HOLD STILL AND WAIT\nFOR THE CALL TO GO OUT.'); return; }
  kp.d = ['', '', '', '']; kp.pos = 0;
  kp.msg = S.codeSeen.some(Boolean) ? 'ENTER THE 4-DIGIT AUTHORISATION CODE' : 'ENTER 4-DIGIT CODE (FRAGMENTS ARE ON THE OLD TERMINALS)';
  setMode('keypad'); setPrompt(''); drawKeypad(); Snd.note();
}
function kpDigit(ch) { if (S.mode !== 'keypad') return; kp.d[kp.pos] = String(ch); kp.pos = Math.min(3, kp.pos + 1); kp.msg = ''; Snd.kp(500 + ch * 60); drawKeypad(); }
function kpClear() { if (S.mode !== 'keypad') return; if (kp.d[kp.pos] === '' && kp.pos > 0) kp.pos--; kp.d[kp.pos] = ''; kp.msg = ''; Snd.kp(300); drawKeypad(); }
function kpMove(dx) { if (S.mode !== 'keypad') return; kp.pos = clamp(kp.pos + dx, 0, 3); Snd.kp(420); drawKeypad(); }
function kpStep(dir) { if (S.mode !== 'keypad') return; const v = kp.d[kp.pos] === '' ? (dir > 0 ? 0 : 9) : (parseInt(kp.d[kp.pos], 10) + dir + 10) % 10; kp.d[kp.pos] = String(v); kp.msg = ''; Snd.kp(500 + v * 60); drawKeypad(); }
function kpSubmit() {
  if (S.mode !== 'keypad') return;
  if (kp.d.some((v) => v === '')) { kp.msg = 'INCOMPLETE CODE'; Snd.locked(); drawKeypad(); return; }
  if (kp.d.join('') === sewerInfo.code.join('')) {
    S.codeOk = true; Snd.lockOpen(); setMode('play'); toast('ACCESS GRANTED.\nEMERGENCY BROADCAST ENABLED.', 3200); renderObjectives();
  } else {
    kp.msg = 'ACCESS DENIED'; kp.d = ['', '', '', '']; kp.pos = 0; Snd.locked(); drawKeypad();
    if (sref.cterm) monHearNoise(sref.cterm.x, sref.cterm.z);                     // the alarm buzz carries
    el.keypad.classList.remove('bad'); void el.keypad.offsetWidth; el.keypad.classList.add('bad');
  }
}
function initKeypadUI() {
  const host = el['kp-keys'];
  if (!host) return;
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'OK'].forEach((k) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = k;
    b.addEventListener('click', () => { if (k === 'CLR') kpClear(); else if (k === 'OK') kpSubmit(); else kpDigit(parseInt(k, 10)); });
    host.appendChild(b);
  });
  el['kp-close'].addEventListener('click', () => { if (S.mode === 'keypad') setMode('play'); });
  window.addEventListener('keydown', (e) => {
    if (S.mode !== 'keypad') return;
    if (e.key >= '0' && e.key <= '9') kpDigit(parseInt(e.key, 10));
    else if (e.key === 'Backspace') kpClear();
    else if (e.key === 'Enter') kpSubmit();
    else if (e.key === 'ArrowLeft') kpMove(-1); else if (e.key === 'ArrowRight') kpMove(1);
    else if (e.key === 'ArrowUp') kpStep(1); else if (e.key === 'ArrowDown') kpStep(-1);
    else return;
    e.preventDefault();
  });
}

/* ---------- the metal locker (needs the single Locker Key; the crowbar is inside) ---------- */
function useLocker(it) {
  if (it.open) return;
  if (!S.quest.lockerKey) { Snd.locked(); toast('THE LOCKER IS LOCKED.\nYOU NEED THE LOCKER KEY.', 2800); return; }
  S.quest.lockerKey = false; it.open = true; it.bar.visible = true; S.quest.crowbar = true;
  Snd.lockOpen(); Snd.gateCreak(0.7, false); triggerReach('pick', 0.8); toast('HEAVY CROWBAR', 2600); renderObjectives();
}

/* ---------- the emergency radio: needs the passcode AND a fresh battery ---------- */
function startRadio(it) {
  if (S.radioDone) { toast('THE RADIO IS STILL CRACKLING...', 1600); return; }
  if (!S.codeOk) { Snd.locked(); toast('RADIO LOCKED.\nENTER THE 4-DIGIT CODE AT THE CENTRAL TERMINAL.', 3400); return; }
  if (!S.quest.battery) { Snd.locked(); toast('THE EMERGENCY RADIO HAS NO POWER.\nIT NEEDS A FRESH BATTERY.', 3000); return; }
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
    if (!S.obj.explore && (S.visited.size >= 3 || S.obj.screen || S.quest.lockerKey || S.quest.battery || S.quest.crowbar)) { S.obj.explore = true; renderObjectives(); }
    if (!S.obj.exit && Math.hypot(P.x - GATE_POS.x, P.z - GATE_POS.z) < 14 && hasLOS(P.x, P.z, GATE_POS.x - 1.2, GATE_POS.z)) { S.obj.exit = true; renderObjectives(); }
  }
  if (sref.locker && sref.locker.open) { const L = sref.locker; L.angle = approach(L.angle, 1.8, dt * 2.2); L.hinge.rotation.y = -L.angle; if (L.angle > 1.0) L.bar.visible = false; }
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
   MULTIPLAYER  ·  Act 1 co-op  ·  Supabase Realtime (broadcast + presence, no database tables needed)
   · a player creates a lobby (public = listed in the browser, private = join by code only; the host can flip it any time)
   · the host runs the monster for everyone; everybody else mirrors it
   · keys are shared by the whole team, and the team needs more of them for every extra player
   · other players appear as clean black silhouettes with a faint rim and a flashlight beam
   ====================================================================== */
const MP_URL = 'https://pwmrebdtodcnpmdtpvxf.supabase.co';
const MP_KEY = 'sb_publishable_SAqNw0xZrsLnSXER15Cw_A_wuT3hgCy';
const MP_MAX = 4, MP_HZ = 10, MP_DIR = 'monochrome-directory-v1', MP_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MON_STATES = ['PATROL', 'INVESTIGATE', 'SEARCH', 'CHASE', 'LOITER', 'CLOSET_CHECK', 'STARE', 'LEAVE', 'KILL'];
const MP = {
  sb: null, phase: 'off', active: false, isHost: false, me: '', name: '', code: '', vis: 'public',
  chan: null, dir: null, members: [], lobbies: [], busy: false, msg: '', joinT: 0,
  roster: [], idx: 0, remotes: {}, clock: 0, sendT: 0, hudT: 0, endT: 0, status: 'alive',
  swapId: null, tgt: null, tgtT: 0, deadSince: null, hz: 10, delay: 0.14, mBuf: [], prevMonState: 'PATROL', onSync: null, hostGoneT: 0, spec: null, keys: 5, resultText: '',
};
const mpClean = (s) => String(s == null ? '' : s).replace(/[^A-Za-z0-9 _\-]/g, '').trim().slice(0, 14);
const mpEsc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mpKeysFor = (n) => Math.min(5 + 3 * (Math.max(1, n) - 1), 14);                    // 1 player: 5 keys, 2: 8, 3: 11, 4: 14
function setKeysNeeded(n) { TOTAL_KEYS = n; }
function withSeed(sd, fn) { const prev = Math.random; Math.random = mulberry32(sd >>> 0); try { return fn(); } finally { Math.random = prev; } }

/* ---------- connection helpers ---------- */
function mpSb() {
  if (MP.sb) return MP.sb;
  const lib = window.supabase;
  if (!lib || !lib.createClient) throw new Error('The multiplayer library did not load. Check your connection and reload.');
  MP.sb = lib.createClient(MP_URL, MP_KEY, { realtime: { params: { eventsPerSecond: 20 } }, auth: { persistSession: false, autoRefreshToken: false } });
  return MP.sb;
}
function mpInitIdentity() {
  if (!MP.me) MP.me = 'p' + Math.floor(realRandom() * 4294967296).toString(36) + Math.floor(realRandom() * 1296).toString(36);
  if (!MP.name) {
    let n = '';
    try { n = localStorage.getItem('monochrome.mpname') || ''; } catch (e) { /* ignore */ }
    MP.name = mpClean(n) || ('Survivor' + (100 + Math.floor(realRandom() * 900)));
  }
}
function mpSetName(v) {
  const n = mpClean(v) || MP.name || 'Survivor';
  MP.name = n;
  try { localStorage.setItem('monochrome.mpname', n); } catch (e) { /* ignore */ }
}
const mpRandCode = () => { let c = ''; for (let i = 0; i < 5; i++) c += MP_CODE_CHARS[Math.floor(realRandom() * MP_CODE_CHARS.length)]; return c; };
function mpSubscribe(ch, ms) {
  return new Promise((resolve, reject) => {
    let done = false;
    const to = setTimeout(() => { if (!done) { done = true; reject(new Error("Couldn't reach the multiplayer server. If this page runs inside a sandboxed preview, download the game and open it from your own computer or host.")); } }, ms || 9000);
    ch.subscribe((status) => {
      if (done) return;
      if (status === 'SUBSCRIBED') { done = true; clearTimeout(to); resolve(); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { done = true; clearTimeout(to); reject(new Error('Could not connect to the multiplayer server (' + status + '). In Supabase: Realtime > Settings > turn on "Allow public access".')); }
    });
  });
}
function mpPresenceList(ch) {
  const out = [], st = ch && ch.presenceState ? ch.presenceState() : {};
  Object.keys(st).forEach((k) => (st[k] || []).forEach((m) => { if (m && m.id) out.push({ id: String(m.id), name: mpClean(m.name) || 'Player', host: !!m.host, vis: m.vis === 'private' ? 'private' : 'public', phase: m.phase === 'game' ? 'game' : 'lobby', t: +m.t || 0 }); }));
  out.sort((a, b) => (b.host - a.host) || (a.t - b.t) || (a.id < b.id ? -1 : 1));
  return out;
}
const mpMeta = () => ({ id: MP.me, name: MP.name, host: MP.isHost, vis: MP.vis, phase: MP.phase === 'game' ? 'game' : 'lobby', t: MP.joinT });
function mpSend(payload) { if (MP.chan) { try { MP.chan.send({ type: 'broadcast', event: 'm', payload }); } catch (e) { /* ignore */ } } }
function mpNewLobbyChannel(code) {
  const ch = mpSb().channel('monochrome-lobby-' + code, { config: { broadcast: { self: false, ack: false }, presence: { key: MP.me } } });
  ch.on('broadcast', { event: 'm' }, (e) => mpOnMessage(e && e.payload));
  ch.on('presence', { event: 'sync' }, () => mpOnPresence());
  return ch;
}
function mpWaitPresence(ms) {
  return new Promise((resolve) => {
    let done = false;
    const fin = () => { if (!done) { done = true; MP.onSync = null; resolve(); } };
    setTimeout(fin, ms || 2500);
    MP.onSync = fin;
    if (mpPresenceList(MP.pendingChan).length) fin();
  });
}

/* ---------- screens ---------- */
function mpSetMsg(t, bad) { MP.msg = t || ''; ['mp-msg', 'lb-msg'].forEach((id) => { if (el[id]) { el[id].textContent = MP.msg; el[id].classList.toggle('bad', !!bad); } }); }
function mpFail(e) { MP.busy = false; mpSetMsg(String((e && e.message) || e || 'Something went wrong.'), true); }
function mpOpenMenu() {
  Snd.init(); mpInitIdentity();
  if (el['mp-name']) el['mp-name'].value = MP.name;
  setMode('mp'); mpSetMsg(''); mpRenderList();
  mpBrowse();
}
async function mpBrowse() {
  try { mpSb(); await mpDirectoryJoin(); mpDirSync(); } catch (e) { mpFail(e); }
}
function mpBack() {                                   // Esc / Circle / Back button
  if (S.mode === 'lobby') { mpLeaveLobby(); mpOpenMenu(); }
  else if (S.mode === 'mp') { if (!MP.chan) mpDirectoryLeave(); setMode('menu'); }
}
function mpRenderList() {
  const box = el['mp-list'];
  if (!box) return;
  if (!MP.lobbies.length) { box.innerHTML = '<div class="mp-empty">No public lobbies right now. Create one!</div>'; return; }
  box.innerHTML = MP.lobbies.map((l) => '<button type="button" class="mp-item" data-code="' + mpEsc(l.code) + '"><b>' + mpEsc(l.code) + '</b><span>' + mpEsc(l.host) + '</span><i>' + l.n + ' / ' + l.max + '</i></button>').join('');
}
function mpRenderLobby() {
  if (!el.lobby) return;
  const list = MP.members;
  el['lb-code'].textContent = MP.code;
  el['lb-public'].classList.toggle('on', MP.vis === 'public'); el['lb-private'].classList.toggle('on', MP.vis === 'private');
  el['lb-public'].disabled = el['lb-private'].disabled = !MP.isHost;
  el['lb-players'].innerHTML = list.map((m) => '<div class="lb-p' + (m.id === MP.me ? ' me' : '') + '">' + (m.host ? '<em>HOST</em>' : '<em></em>') + '<span>' + mpEsc(m.name) + '</span></div>').join('');
  const n = Math.max(1, list.length);
  el['lb-keys'].textContent = 'Players ' + n + ' / ' + MP_MAX + '   ·   Keys needed: ' + mpKeysFor(n) + '  (5 + 3 for each extra player)';
  el['lb-start'].style.display = MP.isHost ? '' : 'none';
  el['lb-wait'].style.display = MP.isHost ? 'none' : '';
  el['lb-vis-note'].textContent = MP.vis === 'public' ? 'Public: listed in the lobby browser.' : 'Private: only people with the code can join.';
}

/* ---------- the public-lobby directory (a presence-only channel: no tables to set up) ---------- */
async function mpDirectoryJoin() {
  if (MP.dir) return;
  const ch = mpSb().channel(MP_DIR, { config: { presence: { key: MP.me } } });
  ch.on('presence', { event: 'sync' }, () => mpDirSync());
  MP.dir = ch;
  try { await mpSubscribe(ch); } catch (e) { MP.dir = null; try { mpSb().removeChannel(ch); } catch (e2) { /* ignore */ } throw e; }
}
function mpDirSync() {
  if (!MP.dir) return;
  const st = MP.dir.presenceState(), out = [];
  Object.keys(st).forEach((k) => (st[k] || []).forEach((m) => { if (m && m.code && m.vis === 'public' && m.phase === 'lobby' && !(MP.chan && m.code === MP.code && MP.isHost)) out.push({ code: String(m.code).slice(0, 5), host: mpClean(m.host) || 'Host', n: Math.max(1, +m.n || 1), max: +m.max || MP_MAX, t: +m.t || 0 }); }));
  out.sort((a, b) => a.t - b.t);
  MP.lobbies = out;
  if (S.mode === 'mp') mpRenderList();
}
function mpDirectoryPublish() {
  if (!MP.dir) return;
  try {
    if (MP.isHost && MP.phase === 'lobby' && MP.vis === 'public') MP.dir.track({ code: MP.code, host: MP.name, n: Math.max(1, MP.members.length), max: MP_MAX, vis: 'public', phase: 'lobby', t: MP.joinT });
    else MP.dir.untrack();
  } catch (e) { /* ignore */ }
}
function mpDirectoryLeave() {
  if (!MP.dir) return;
  try { MP.dir.untrack(); mpSb().removeChannel(MP.dir); } catch (e) { /* ignore */ }
  MP.dir = null; MP.lobbies = [];
}

/* ---------- lobby: create / join / visibility / leave ---------- */
async function mpCreateLobby() {
  if (MP.busy) return;
  MP.busy = true; mpSetMsg('Creating lobby…');
  try {
    mpInitIdentity(); mpSetName(el['mp-name'] ? el['mp-name'].value : MP.name);
    const sb = mpSb();
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = mpRandCode(), ch = mpNewLobbyChannel(code);
      MP.pendingChan = ch;
      await mpSubscribe(ch);
      if (mpPresenceList(ch).some((m) => m.host)) { try { await sb.removeChannel(ch); } catch (e) { /* ignore */ } continue; }   // code already in use
      MP.chan = ch; MP.code = code; MP.isHost = true; MP.vis = 'public'; MP.phase = 'lobby'; MP.joinT = Date.now();
      await ch.track(mpMeta());
      mpOnPresence();
      await mpDirectoryJoin();
      mpDirectoryPublish();
      MP.busy = false; mpSetMsg(''); setMode('lobby'); mpRenderLobby();
      return;
    }
    throw new Error('Could not find a free lobby code. Try again.');
  } catch (e) { mpFail(e); }
}
async function mpJoinLobby(code) {
  if (MP.busy) return;
  code = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 4) { mpSetMsg('Type the 5-letter lobby code first.', true); return; }
  MP.busy = true; mpSetMsg('Joining ' + code + '…');
  let ch = null;
  try {
    mpInitIdentity(); mpSetName(el['mp-name'] ? el['mp-name'].value : MP.name);
    ch = mpNewLobbyChannel(code); MP.pendingChan = ch;
    await mpSubscribe(ch);
    await mpWaitPresence(2500);
    const list = mpPresenceList(ch), host = list.find((m) => m.host);
    if (!host) throw new Error('No lobby with the code ' + code + '.');
    if (host.phase !== 'lobby') throw new Error('That game has already started.');
    if (list.length >= MP_MAX) throw new Error('That lobby is full (' + MP_MAX + ' players).');
    MP.chan = ch; MP.code = code; MP.isHost = false; MP.vis = host.vis; MP.phase = 'lobby'; MP.joinT = Date.now();
    await ch.track(mpMeta());
    mpDirectoryLeave();
    mpOnPresence();
    MP.busy = false; mpSetMsg(''); setMode('lobby'); mpRenderLobby();
  } catch (e) {
    if (ch) { try { mpSb().removeChannel(ch); } catch (e2) { /* ignore */ } }
    MP.chan = null; mpFail(e);
  }
}
function mpOnPresence() {
  if (MP.onSync) MP.onSync();
  if (!MP.chan) return;
  MP.members = mpPresenceList(MP.chan);
  const host = MP.members.find((m) => m.host);
  if (!MP.isHost) {
    if (host) { MP.hostGoneT = 0; if (MP.vis !== host.vis) MP.vis = host.vis; }
    else if (MP.phase === 'lobby' || MP.phase === 'game') { MP.hostGoneT = MP.hostGoneT || 1; setTimeout(() => { if (MP.chan && !MP.isHost && !mpPresenceList(MP.chan).some((m) => m.host)) mpHostLeft(); }, 2000); }
  } else { mpDirectoryPublish(); }
  if (MP.active) mpSyncRoster();
  if (S.mode === 'lobby') mpRenderLobby();
}
function mpSetVisibility(v) {
  if (!MP.isHost || MP.phase !== 'lobby') return;
  MP.vis = v === 'private' ? 'private' : 'public';
  try { MP.chan.track(mpMeta()); } catch (e) { /* ignore */ }
  mpDirectoryPublish(); mpRenderLobby(); Snd.click();
}
function mpLeaveLobby() {
  const ch = MP.chan;
  MP.chan = null;
  if (ch) { try { ch.untrack(); mpSb().removeChannel(ch); } catch (e) { /* ignore */ } }
  mpDirectoryLeave();
  document.body.removeAttribute('data-mp');
  MP.phase = 'off'; MP.active = false; MP.isHost = false; MP.members = []; MP.code = ''; MP.busy = false; MP.pendingChan = null; MP.onSync = null;
  mpClearRemotes(); setKeysNeeded(5);
}
function mpHostLeft() {
  if (!MP.chan) return;
  const wasGame = MP.active;
  mpLeaveLobby();
  if (wasGame) { mpRebuildMenuWorld(); }
  mpOpenMenu(); mpSetMsg('The host left the lobby.', true);
}
function mpRebuildMenuWorld() {
  S.act = 1; closeModals(); setKeysNeeded(5);
  buildWorld(newSeed(), 1); resetGame(); mon.grace = 999;
  el.cut.style.transition = 'none'; el.cut.style.opacity = '0';
}
function mpLeave() {                                  // leave a running game (pause menu / death card)
  mpLeaveLobby(); mpRebuildMenuWorld(); S.menuCamT = 0; setMode('menu');
  try { document.exitPointerLock(); } catch (e) { /* ignore */ }
}

/* ---------- starting + ending a match ---------- */
function mpStartGame() {
  if (!MP.isHost || MP.phase !== 'lobby' || MP.busy) return;
  MP.members = mpPresenceList(MP.chan);
  const roster = MP.members.map((m, i) => ({ id: m.id, name: m.name, i }));
  const keys = mpKeysFor(roster.length), seed = newSeed();
  mpSend({ k: 'start', seed, keys, roster });
  mpBeginGame(seed, keys, roster);
}
function mpBeginGame(seed, keys, roster) {
  MP.phase = 'game'; MP.active = true; MP.roster = roster; MP.keys = keys; MP.status = 'alive'; MP.resultText = '';
  MP.idx = Math.max(0, roster.findIndex((r) => r.id === MP.me));
  MP.hz = roster.length <= 2 ? 12 : roster.length === 3 ? 9 : 7;           // fewer packets per player as the team grows (keeps a free Supabase project under its message cap)
  MP.delay = Math.max(0.12, 1.7 / MP.hz);
  if (MP.chan) { try { MP.chan.track(mpMeta()); } catch (e) { /* ignore */ } }
  mpDirectoryPublish();
  Snd.init(); closeModals(); clearInterval(typeTimer);
  S.act = 1; setKeysNeeded(keys); document.body.setAttribute('data-mp', '1');
  el.cut.style.transition = 'none'; el.cut.style.opacity = '1';
  setTimeout(() => {
    buildWorld(seed, 1); finishBegin();
    const o = [[-1.3, 0.2], [1.3, 0.2], [-0.4, 1.7], [0.4, -1.3]][MP.idx % 4];          // everybody wakes up in the safe room, side by side
    P.x = 10.5 + o[0]; P.z = 8 + o[1];
    mpMakeRemotes(); mpResetNet();
    toast('CO-OP  ·  FIND ' + keys + ' KEYS', 3200);
    fadeFromBlack(1100);
  }, 90);
}
function mpReturnToLobby(text) {
  document.body.removeAttribute('data-mp'); MP.active = false; MP.phase = 'lobby'; MP.status = 'alive'; MP.resultText = text || '';
  mpClearRemotes();
  mpRebuildMenuWorld();
  if (MP.chan) { try { MP.chan.track(mpMeta()); } catch (e) { /* ignore */ } }
  mpOnPresence(); mpDirectoryPublish();
  S.menuCamT = 0; setMode('lobby'); mpRenderLobby(); mpSetMsg(MP.resultText);
  try { document.exitPointerLock(); } catch (e) { /* ignore */ }
}
function mpResetNet() {
  MP.clock = 0; MP.sendT = 0; MP.mBuf = []; MP.tgt = null; MP.tgtT = 0; MP.swapId = null; MP.endT = 0; MP.deadSince = null; MP.hudT = 0; MP.spec = null; MP.prevMonState = 'PATROL';
  doors.forEach((d) => { d._net = d.target; });
}
function mpSyncRoster() {                              // somebody dropped out mid-match
  const here = {}; MP.members.forEach((m) => { here[m.id] = true; });
  Object.keys(MP.remotes).forEach((id) => {
    const r = MP.remotes[id];
    if (!here[id] && r.status !== 'gone') { r.status = 'gone'; if (r.mesh) r.mesh.group.visible = false; mpAnnounce(r.name + ' LEFT'); if (MP.tgt === id) MP.tgt = null; }
  });
}
const mpAnnounce = (t) => { if (ACTIVE.indexOf(S.mode) >= 0 || S.mode === 'paused') toast(t, 2400); };

/* ---------- messages ---------- */
function mpOnMessage(m) {
  if (!m || typeof m !== 'object') return;
  switch (m.k) {
    case 'start': if (!MP.isHost && MP.phase === 'lobby' && Array.isArray(m.roster)) mpBeginGame(m.seed >>> 0, Math.max(5, Math.min(14, +m.keys || 5)), m.roster.map((r, i) => ({ id: String(r.id), name: mpClean(r.name) || 'Player', i }))); break;
    case 'pos': if (MP.active) mpOnPos(m); break;
    case 'door': { const d = doors[m.i | 0]; if (MP.active && d) { d.target = m.t ? 1 : 0; d._net = d.target; } break; }
    case 'search': if (MP.active) mpApplySearch(m.i | 0, m.by); break;
    case 'pick': { const it = pickups[m.i | 0]; if (MP.active && it && !it.taken) { it.taken = true; it.group.visible = false; it.sprite.visible = false; } break; }
    case 'lock': if (MP.active) mpApplyLocks(m.n | 0, m.by); break;
    case 'noise': if (MP.active && MP.isHost) monHearNoise(+m.x, +m.z); break;
    case 'caught': if (MP.active && m.id === MP.me) mpGotCaught(); break;
    case 'spotted': if (MP.active && m.id === MP.me && S.mode !== 'dead') onSpotted(); break;
    case 'leave': if (MP.active && MP.isHost) mpHostLeaveRequest(m.id); break;
    case 'dead': if (MP.active) mpOnStatus(m.id, 'dead'); break;
    case 'escaped': if (MP.active) mpOnStatus(m.id, 'escaped'); break;
    case 'end': if (MP.active && !MP.isHost) mpReturnToLobby(String(m.text || '')); break;
    default: break;
  }
}
function mpOnPos(m) {
  const r = MP.remotes[m.i];
  if (!r) return;
  r.last = m; r.status = m.s === 2 ? 'escaped' : m.s === 1 ? 'dead' : (r.status === 'gone' ? 'gone' : 'alive');
  r.buf.push({ t: MP.clock, x: m.x, z: m.z, y: m.y, p: m.p, f: m.f | 0, c: m.c == null ? -1 : m.c });
  if (r.buf.length > 14) r.buf.shift();
  if (m.m && !MP.isHost) { MP.mBuf.push({ t: MP.clock, a: m.m }); if (MP.mBuf.length > 14) MP.mBuf.shift(); }
}
function mpOnStatus(id, st) {
  const r = MP.remotes[id];
  if (!r || r.status === st) return;
  r.status = st; if (r.mesh) r.mesh.group.visible = false;
  mpAnnounce(r.name + (st === 'dead' ? ' WAS CAUGHT' : ' ESCAPED'));
  if (MP.isHost && st === 'dead' && mon.state !== 'KILL' && (MP.tgt === id || (mon.state === 'STARE' || mon.state === 'CLOSET_CHECK'))) {
    const c = r.last && r.last.c >= 0 ? closets[r.last.c] : null;
    if (MP.tgt === id || (c && mon.closet === c)) { mon.state = 'LEAVE'; mon.timer = 6; mon.wp = null; mon.wpKey = -1; mon.closet = null; mon.ignoreT = 5; }
  }
}
function mpApplySearch(i, by) {
  const s = searchSpots[i];
  if (!s || s.searched) return;
  s.searched = true;
  if (s.fronts) s.fronts[1].position.z = s.frontZ + 0.08;
  if (s.hasKey) {
    S.keys++; Snd.key(); updateKeyUI();
    const r = MP.remotes[by]; toast((r ? r.name : 'A TEAMMATE') + ' FOUND A KEY   ' + S.keys + ' / ' + TOTAL_KEYS, 2600);
    if (S.keys >= TOTAL_KEYS) setTimeout(() => { if (ACTIVE.indexOf(S.mode) >= 0) toast('ALL KEYS FOUND. OPEN THE SAFE ROOM DOOR.', 3400); }, 2700);
  }
}
function mpApplyLocks(n, by) {
  let opened = 0;
  while (S.locks < n && exitDoor.locks[S.locks]) { exitDoor.locks[S.locks].state = 1; S.locks++; opened++; }
  if (!opened) return;
  Snd.lockOpen(); const r = MP.remotes[by];
  toast((r ? r.name : 'A TEAMMATE') + ' OPENED PADLOCK ' + S.locks + ' / ' + exitDoor.locks.length, 2000);
  if (S.locks >= exitDoor.locks.length) setTimeout(() => { exitDoor.target = 1; Snd.door(); toast('THE DOOR GROANS OPEN...', 2400); }, 700);
  updateObjectives();
}
function mpHostLeaveRequest(id) {                      // a hiding player held their breath long enough: the monster gives up
  const r = MP.remotes[id];
  if (!r || !r.last || r.last.c < 0 || mon.state !== 'STARE') return;
  if (mon.closet === closets[r.last.c]) { MP.swapId = id; monsterLeave(); MP.swapId = null; }
}
function mpCatchRemote(id) {                            // host: the monster reached somebody who isn't the host
  const r = MP.remotes[id];
  mpSend({ k: 'caught', id });
  if (r) { r.status = 'dead'; if (r.mesh) r.mesh.group.visible = false; }
  mpAnnounce((r ? r.name : 'A TEAMMATE') + ' WAS CAUGHT');
  mon.state = 'LEAVE'; mon.timer = 6; mon.wp = null; mon.wpKey = -1; mon.closet = null; mon.ignoreT = 5; mon.doorWork = null;
}
function mpGotCaught() {
  if (MP.status !== 'alive' || S.mode === 'dead' || S.mode === 'cutscene' || S.mode === 'won') return;
  dieNow();
}
function mpLocalDied() {                                // called at the end of dieNow() in a match
  MP.status = 'dead';
  mpSend({ k: 'dead', id: MP.me });
}
function mpAfterDeath() {                               // the scare is over: if I'm the host the monster has to carry on hunting everyone else
  if (MP.isHost) { clearOverrides(); mon.state = 'LEAVE'; mon.timer = 7; mon.wp = null; mon.wpKey = -1; mon.closet = null; mon.headScale = 1; mon.eyeScale = 1; mon.lean = 0; mon.duck = 0; mon.crouch = 0; mon.reach = 0; mon.ignoreT = 6; mon.grace = 0; }
}
function mpEscape() {                                   // walked down the stairs (Act 2 is not in multiplayer yet)
  S.cs = null; S.dcam = null; Snd.duck(false);
  el.cut.style.transition = 'none'; el.cut.style.opacity = '0';
  MP.status = 'escaped'; mpSend({ k: 'escaped', id: MP.me });
  setMode('won'); radar.up = false; setPrompt('');
  el['win-title'].textContent = 'You escaped.';
  el['win-text'].textContent = 'You made it down the stairs. Act 2 isn\'t available in multiplayer yet, so this is where your run ends. Watch your team, or leave.';
  el['btn-again'].textContent = 'WATCH TEAM';
  try { document.exitPointerLock(); } catch (e) { /* ignore */ }
}
function mpAfterWin() { mpSpectateStart(); }

/* ---------- the host runs the monster for everyone ---------- */
const MP_PKEYS = ['x', 'z', 'yaw', 'pitch', 'flashOn', 'running', 'moving', 'safe', 'hiding', 'closet', 'quietT', 'gy'];
function mpViews() {
  const v = [];
  if (MP.status === 'alive' && S.mode !== 'dead' && S.mode !== 'cutscene' && S.mode !== 'won' && S.mode !== 'spectate') v.push({ id: MP.me, local: true });
  Object.keys(MP.remotes).forEach((id) => {
    const r = MP.remotes[id], m = r.last;
    if (r.status !== 'alive' || !m) return;
    const f = m.f | 0;
    v.push({ id, x: m.x, z: m.z, yaw: m.y, pitch: m.p, flashOn: !!(f & 1), running: !!(f & 2), moving: !!(f & 4), safe: !!(f & 8), hiding: m.c >= 0, closet: m.c >= 0 ? (closets[m.c] || null) : null, quietT: 0, gy: 0 });
  });
  return v;
}
function mpPickTarget(views) {
  const lock = mon.state === 'CHASE' || mon.state === 'CLOSET_CHECK' || mon.state === 'STARE' || mon.state === 'KILL';
  const cur = views.find((v) => v.id === MP.tgt);
  const px = (v) => (v.local ? P.x : v.x), pz = (v) => (v.local ? P.z : v.z);
  const score = (v) => { const run = v.local ? (P.running && P.moving) : (v.running && v.moving); const safe = v.local ? P.safe : v.safe; return Math.hypot(px(v) - mon.x, pz(v) - mon.z) - (run && !safe ? 8 : 0) + (safe ? 25 : 0); };
  if (cur && (lock || MP.tgtT > 0)) return cur;
  let best = null;
  views.forEach((v) => { if (!best || score(v) < score(best) - (cur && v.id !== cur.id ? 0 : 0)) best = v; });
  if (cur && best && best.id !== cur.id && score(best) > score(cur) * 0.75) best = cur;       // a little hysteresis
  MP.tgtT = 0.7;
  return best;
}
function mpHostMonster(dt) {
  MP.tgtT -= dt;
  const views = mpViews();
  if (!views.length) { MP.tgt = null; return; }
  const t = mpPickTarget(views);
  MP.tgt = t.id;
  if (t.local) { MP.swapId = MP.me; updateMonster(dt); MP.swapId = null; return; }
  const saved = {}, savedBreath = Object.assign({}, breath), savedMode = S.mode;
  MP_PKEYS.forEach((k) => { saved[k] = P[k]; P[k] = t[k]; });
  S.mode = 'play'; MP.swapId = t.id;
  try { updateMonster(dt); } finally {
    MP_PKEYS.forEach((k) => { P[k] = saved[k]; });
    Object.assign(breath, savedBreath); S.mode = savedMode; MP.swapId = null;
  }
}
/* the monster as seen from a non-host client: interpolated from the host's snapshots */
function mpPackMonster() {
  const m = mon, ti = MP.roster.findIndex((r) => r.id === MP.tgt), q = (v) => Math.round(v * 100) / 100;
  return [q(m.x), q(m.z), q(m.yaw), Math.max(0, MON_STATES.indexOf(m.state)), m.closet ? closets.indexOf(m.closet) : -1, q(m.lean), q(m.duck), q(m.crouch || 0), q(m.reach), q(m.speedNow), ti, m.sees ? 1 : 0, q(m.headScale), q(m.eyeScale)];
}
function mpClientMonster(dt) {
  if (S.mode === 'dead' || !MP.mBuf.length) return;
  const b = MP.mBuf, rt = MP.clock - MP.delay;
  let a = b[0], c = b[b.length - 1];
  for (let i = 0; i < b.length - 1; i++) if (b[i].t <= rt && b[i + 1].t >= rt) { a = b[i]; c = b[i + 1]; break; }
  const k = c.t > a.t ? clamp((rt - a.t) / (c.t - a.t), 0, 1) : 1, A = a.a, C = c.a, L = C;
  const ox = mon.x, oz = mon.z;
  mon.x = lerp(A[0], C[0], k); mon.z = lerp(A[1], C[1], k);
  mon.yaw = A[2] + angDiff(A[2], C[2]) * k; mon.wantYaw = mon.yaw;
  const st = MON_STATES[L[3]] || 'PATROL';
  if (st !== MP.prevMonState) {
    if (st === 'CLOSET_CHECK' || st === 'STARE' || st === 'LEAVE') { if (Math.hypot(P.x - mon.x, P.z - mon.z) < 32) Snd.growl(); }
    if (st === 'STARE' && L[4] >= 0 && closets[L[4]] === P.closet) { breath.air = 1; breath.hold = 0; breath.noise = 0; breath.grace = 1.4; breath.gasp = 0; }
    MP.prevMonState = st;
  }
  mon.state = st; mon.closet = L[4] >= 0 ? (closets[L[4]] || null) : null;
  mon.lean = L[5]; mon.duck = L[6]; mon.crouch = L[7]; mon.reach = L[8]; mon.headScale = L[12]; mon.eyeScale = L[13];
  mon.grace = 0; mon.dist = Math.hypot(P.x - mon.x, P.z - mon.z);
  mon.sees = L[11] === 1 && L[10] === MP.idx;
  mon.gy = approach(mon.gy || 0, floorH(mon.x, mon.z), 4.5 * dt);
  const moved = Math.hypot(mon.x - ox, mon.z - oz);
  mon.speedNow = lerp(mon.speedNow, moved / Math.max(dt, 1e-4), Math.min(1, dt * 8));
  mon.stepAcc += moved;
  if (mon.stepAcc >= 1.75) { mon.stepAcc -= 1.75; Snd.stepMonster(); }
  updateDuck(dt);
}

/* ---------- per-frame network tick ---------- */
function mpSendState() {
  const f = (P.flashOn ? 1 : 0) | (P.running ? 2 : 0) | (P.moving ? 4 : 0) | (P.safe ? 8 : 0) | (S.searching ? 16 : 0) | (radar.up ? 32 : 0) | (S.mapUp ? 64 : 0);
  const q = (v) => Math.round(v * 100) / 100;
  const msg = { k: 'pos', i: MP.me, x: q(P.x), z: q(P.z), y: q(P.yaw), p: q(P.pitch), f, c: (P.hiding && P.closet) ? closets.indexOf(P.closet) : -1, s: MP.status === 'escaped' ? 2 : MP.status === 'dead' ? 1 : 0 };
  if (MP.isHost) msg.m = mpPackMonster();
  mpSend(msg);
}
function mpSyncDoors() {
  doors.forEach((d, i) => {
    if (d._net === undefined) { d._net = d.target; return; }
    if (d.target !== d._net) { d._net = d.target; mpSend({ k: 'door', i, t: d.target ? 1 : 0 }); }
  });
}
function mpTick(dt) {
  if (!MP.active) return;
  MP.clock += dt;
  if (MP.isHost) mpHostMonster(dt); else mpClientMonster(dt);
  mpUpdateRemotes(dt);
  MP.sendT -= dt;
  if (MP.sendT <= 0) { MP.sendT = 1 / MP.hz; mpSendState(); }
  mpSyncDoors();
  if (S.mode === 'spectate') mpSpectateCam();
  MP.hudT -= dt;
  if (MP.hudT <= 0) { MP.hudT = 0.4; mpRenderHud(); }
  if (MP.isHost) {                                       // the match ends when nobody is left in the house (after the last scare has played out)
    MP.endT -= dt;
    if (MP.endT <= 0) {
      MP.endT = 0.5;
      const all = [MP.status].concat(Object.keys(MP.remotes).map((id) => MP.remotes[id].status).filter((s) => s !== 'gone'));
      if (all.some((s) => s === 'alive')) MP.deadSince = null;
      else if (MP.clock > 3) {
        if (MP.deadSince == null) MP.deadSince = MP.clock;
        if (MP.clock - MP.deadSince > 6) {
          const esc = all.filter((s) => s === 'escaped').length, text = esc ? ('Match over.  ' + esc + ' of ' + all.length + ' escaped.') : 'Match over.  Nobody made it out.';
          mpSend({ k: 'end', text }); mpReturnToLobby(text);
        }
      }
    }
  }
}
function mpRenderHud() {
  const box = el['mp-hud'];
  if (!box) return;
  const rows = [{ name: MP.name, st: MP.status === 'alive' ? (P.hiding ? 'hiding' : 'alive') : MP.status, me: true }];
  Object.keys(MP.remotes).forEach((id) => { const r = MP.remotes[id]; if (r.status === 'gone') return; rows.push({ name: r.name, st: r.status === 'alive' && r.last && r.last.c >= 0 ? 'hiding' : r.status, me: false }); });
  box.innerHTML = rows.map((r) => '<div class="' + r.st + (r.me ? ' me' : '') + '"><b>' + mpEsc(r.name) + '</b> ' + ({ alive: '', hiding: '· hiding', dead: '· caught', escaped: '· escaped' }[r.st] || '') + '</div>').join('') + (S.mode === 'spectate' ? '<div class="spec">SPECTATING ' + mpEsc((MP.remotes[MP.spec] || {}).name || '') + '  ·  [E] next  ·  Esc menu</div>' : '');
}

/* ---------- spectating (after being caught, or after escaping) ---------- */
function mpAliveRemotes() { return Object.keys(MP.remotes).map((id) => MP.remotes[id]).filter((r) => r.status === 'alive'); }
function mpSpectateStart() {
  const alive = mpAliveRemotes();
  S.dcam = null; S.deathPhase = null; S.flashT = 0; S.choke = 0; Snd.duck(false);
  el.death.classList.remove('black', 'show', 'fade', 'sel-retry', 'sel-menu'); el.cut.style.opacity = '0'; document.body.classList.remove('static');
  if (!alive.length) { MP.spec = null; setMode('lobby'); mpSetMsg('Waiting for the match to end…'); return; }
  MP.spec = alive[0].id; setMode('spectate'); mpSpectateCam();
}
function mpSpectateCam() {
  let r = MP.remotes[MP.spec];
  if (!r || r.status !== 'alive') { const a = mpAliveRemotes(); r = a[0] || null; MP.spec = r ? r.id : null; }
  if (!r) return;
  S.dcam = { x: r.x, y: (r.hidden ? 1.0 : EYE_H) + (r.gy || 0), z: r.z, yaw: r.yaw, pitch: r.pitch, roll: 0 };
}
function mpSpectateInput(dt, inp) {
  if (inp.pause) { setPause(true); return; }
  if (inp.interact || inp.next || inp.prev) {
    const a = mpAliveRemotes();
    if (a.length) { const i = a.findIndex((r) => r.id === MP.spec); MP.spec = a[(i + 1) % a.length].id; Snd.camSwitch(); }
  }
}

/* ---------- remote players: clean silhouettes ---------- */
let mpGroup = null;
function mpClearRemotes() {
  Object.keys(MP.remotes).forEach((id) => { const r = MP.remotes[id]; if (r.mesh) { r.mesh.group.visible = false; if (r.mesh.light) r.mesh.light.intensity = 0; } });
  MP.remotes = {};
  if (mpGroup) { mpGroup.visible = false; }
}
function mpMakeRemotes() {
  mpClearRemotes();
  if (mpGroup) scene.remove(mpGroup);                       // a fresh group (and fresh silhouettes) for every match
  mpGroup = new THREE.Group(); scene.add(mpGroup);
  MP.roster.forEach((p) => {
    if (p.id === MP.me) return;
    const mesh = mpBuildSilhouette(p.name);
    mpGroup.add(mesh.group);
    MP.remotes[p.id] = { id: p.id, name: p.name, i: p.i, mesh, buf: [], last: null, status: 'alive', x: 10.5, z: 8, yaw: 0, pitch: 0, hidden: false, gy: 0, ph: 0, vel: 0, flash: false, tagT: 0, tag: 0 };
  });
}
function mpBuildSilhouette(name) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const fill = new THREE.MeshBasicMaterial({ color: 0x040404 });
  const rim = new THREE.MeshBasicMaterial({ color: 0xb4b4b4, side: THREE.BackSide, transparent: true, opacity: 0.42 });   // the faint grey outline that keeps the figure readable in the dark
  const shape = (geo, parent, x, y, z, sx, sy, sz) => {
    const g = new THREE.Group(), a = new THREE.Mesh(geo, fill), b = new THREE.Mesh(geo, rim);
    b.scale.set(1.1, 1.06, 1.1); g.add(b); g.add(a); g.position.set(x, y, z);
    if (sx) g.scale.set(sx, sy, sz);
    parent.add(g); return g;
  };
  const cyl = (r0, r1, h) => new THREE.CylinderGeometry(r0, r1, h, 20, 1, false), sph = (r) => new THREE.SphereGeometry(r, 22, 16);
  shape(cyl(0.17, 0.15, 0.22), body, 0, 0.96, 0);                      // hips
  shape(cyl(0.215, 0.165, 0.56), body, 0, 1.3, 0);                      // torso
  shape(sph(0.215), body, 0, 1.56, 0, 1, 0.42, 0.72);                    // rounded shoulders
  shape(cyl(0.055, 0.065, 0.12), body, 0, 1.64, 0);                      // neck
  const head = new THREE.Group(); head.position.set(0, 1.66, 0.01); body.add(head);
  shape(sph(0.118), head, 0, 0.11, 0.01, 0.92, 1.1, 1.0);                // head
  const limb = (parent, px, py, pz, r, len, joint) => {                  // a hanging limb: pivot group + upper segment + elbow/knee + lower segment
    const pivot = new THREE.Group(); pivot.position.set(px, py, pz); parent.add(pivot);
    shape(cyl(r, r * 0.9, len), pivot, 0, -len / 2, 0);
    shape(sph(r * 0.95), pivot, 0, -len, 0);
    const low = new THREE.Group(); low.position.set(0, -len, 0); pivot.add(low);
    shape(cyl(r * 0.88, r * 0.7, len * 0.95), low, 0, -len * 0.475, 0);
    return { pivot, low };
  };
  const armL = limb(body, -0.285, 1.5, 0, 0.052, 0.3), armR = limb(body, 0.285, 1.5, 0, 0.052, 0.3);
  const legL = limb(body, -0.1, 0.92, 0, 0.078, 0.45), legR = limb(body, 0.1, 0.92, 0, 0.078, 0.45);
  shape(new THREE.BoxGeometry(0.1, 0.06, 0.24), legL.low, 0, -0.44, 0.06);     // feet
  shape(new THREE.BoxGeometry(0.1, 0.06, 0.24), legR.low, 0, -0.44, 0.06);
  shape(sph(0.05), armL.low, 0, -0.29, 0); shape(sph(0.05), armR.low, 0, -0.29, 0);   // hands
  // the flashlight: a small torch in the right hand, a faint beam and a real spotlight so it lights the walls it points at
  const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.17, 10), new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
  torch.position.set(0, -0.3, 0); armR.low.add(torch);
  const beamGeo = new THREE.CylinderGeometry(0.03, 0.85, 7, 18, 1, true); beamGeo.translate(0, -3.9, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  armR.low.add(beam); beam.visible = false;
  const light = new THREE.SpotLight(0xffffff, 0, 26, 0.45, 0.7, 1.5);
  light.position.set(0, -0.32, 0); armR.low.add(light);
  const tgt = new THREE.Object3D(); tgt.position.set(0, -6, 0); armR.low.add(tgt); light.target = tgt;
  // name tag
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const c2 = cv.getContext('2d');
  c2.font = 'bold 30px "Courier New", monospace'; c2.textAlign = 'center'; c2.fillStyle = '#fff'; c2.shadowColor = '#000'; c2.shadowBlur = 6; c2.fillText(String(name).toUpperCase(), 128, 40);
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0, depthWrite: false }));
  tag.scale.set(1.1, 0.28, 1); tag.position.set(0, 2.05, 0); root.add(tag);
  return { group: root, body, head, armL, armR, legL, legR, beam, light, tag, torch };
}
function mpUpdateRemotes(dt) {
  const rt = MP.clock - MP.delay;
  Object.keys(MP.remotes).forEach((id) => {
    const r = MP.remotes[id], b = r.buf;
    if (b.length) {
      let a = b[0], c = b[b.length - 1];
      for (let i = 0; i < b.length - 1; i++) if (b[i].t <= rt && b[i + 1].t >= rt) { a = b[i]; c = b[i + 1]; break; }
      const k = c.t > a.t ? clamp((rt - a.t) / (c.t - a.t), 0, 1) : 1;
      const nx = lerp(a.x, c.x, k), nz = lerp(a.z, c.z, k);
      r.vel = lerp(r.vel, Math.hypot(nx - r.x, nz - r.z) / Math.max(dt, 1e-4), Math.min(1, dt * 10));
      r.x = nx; r.z = nz; r.yaw = a.y + angDiff(a.y, c.y) * k; r.pitch = lerp(a.p, c.p, k);
      r.flags = c.f; r.hidden = c.c >= 0; r.gy = approach(r.gy, floorH(r.x, r.z), 4.5 * dt);
    }
    mpPose(r, dt);
  });
}
function mpPose(r, dt) {
  const m = r.mesh, f = r.flags | 0, flash = !!(f & 1), run = !!(f & 2), search = !!(f & 16);
  const show = r.status === 'alive' && !r.hidden && !!r.last;
  m.group.visible = show;
  if (!show) { m.light.intensity = 0; return; }
  m.group.position.set(r.x, r.gy, r.z);
  m.group.rotation.y = r.yaw + Math.PI;
  const sp = clamp(r.vel / 2.6, 0, 1.6), moving = r.vel > 0.25;
  r.ph += dt * (moving ? (run ? 11 : 7.5) : 0);
  const sw = moving ? Math.sin(r.ph) * (run ? 0.85 : 0.55) : 0, sw2 = moving ? Math.sin(r.ph + Math.PI) * (run ? 0.85 : 0.55) : 0;
  const crouch = search ? 1 : 0;
  m.legL.pivot.rotation.x = sw - 0.7 * crouch; m.legR.pivot.rotation.x = sw2 - 0.7 * crouch;
  m.legL.low.rotation.x = Math.max(0, -sw) * 0.9 + 1.2 * crouch; m.legR.low.rotation.x = Math.max(0, -sw2) * 0.9 + 1.2 * crouch;
  m.body.position.y = -0.36 * crouch + (moving ? Math.abs(Math.sin(r.ph)) * 0.025 : 0);
  m.body.rotation.x = (run ? 0.22 : 0.04) * sp + 0.5 * crouch;
  m.armL.pivot.rotation.x = sw2 * 0.7 - 0.25 * crouch; m.armL.low.rotation.x = -0.25 - 0.8 * crouch;
  if (flash) { m.armR.pivot.rotation.x = -(Math.PI / 2 + r.pitch * 0.9) + 0.1; m.armR.low.rotation.x = -0.1; }       // arm raised, torch pointing where they look
  else { m.armR.pivot.rotation.x = sw * 0.7 - 0.25 * crouch; m.armR.low.rotation.x = -0.25 - 0.8 * crouch; }
  m.head.rotation.x = -r.pitch * 0.6;
  m.beam.visible = flash; m.light.intensity = flash ? 1.15 : 0;
  r.tagT -= dt;                                                                       // name tag: only when close and in plain sight
  if (r.tagT <= 0) { r.tagT = 0.3; const d = Math.hypot(r.x - P.x, r.z - P.z); r.tag = (d < 10 && hasLOS(P.x, P.z, r.x, r.z)) ? 0.85 : 0; }
  m.tag.material.opacity = lerp(m.tag.material.opacity, r.tag, Math.min(1, dt * 6));
}

/* ---------- UI wiring ---------- */
function initMultiplayerUI() {
  mpInitIdentity();
  el['btn-multi'].addEventListener('click', mpOpenMenu);
  if (!el['mp-create']) return;
  el['mp-create'].addEventListener('click', mpCreateLobby);
  el['mp-join'].addEventListener('click', () => mpJoinLobby(el['mp-code-in'].value));
  el['mp-code-in'].addEventListener('keydown', (e) => { if (e.key === 'Enter') mpJoinLobby(el['mp-code-in'].value); });
  el['mp-back'].addEventListener('click', mpBack);
  el['mp-list'].addEventListener('click', (e) => { const b = e.target && e.target.closest ? e.target.closest('.mp-item') : null; if (b) mpJoinLobby(b.getAttribute('data-code')); });
  el['lb-public'].addEventListener('click', () => mpSetVisibility('public'));
  el['lb-private'].addEventListener('click', () => mpSetVisibility('private'));
  el['lb-start'].addEventListener('click', mpStartGame);
  el['lb-leave'].addEventListener('click', mpBack);
  el['btn-leave-mp'].addEventListener('click', () => { if (MP.active) mpLeave(); });
}

/* ======================================================================
   VR MODE  ·  WebXR  ·  headset + two controllers  (Act 1)
   · pressing VR MODE puts you in the main menu INSIDE the headset: point either controller at a button (laser) and pull the trigger
   · the motion tracker lives in your LEFT hand, the flashlight in your RIGHT hand (no hand models, just the props)
   · press A on the right controller: the flashlight turns into the map; press A again: back to the flashlight
   ====================================================================== */
const VR_SNAP = Math.PI / 6, VR_SW = 1.6, VR_SH = 1.0;
const VR = {
  supported: false, active: false, busy: false, inLoop: false, session: null, floor: true,
  rig: null, ray: [], kits: null, hud: null, screen: null, black: null, lasers: null,
  rigState: { x: 0, y: 0, z: 0, yaw: 0 }, head: { x: 0, y: 1.6, z: 0, yaw: 0, pitch: 0 }, headAdopt: { x: 0, z: 0 },
  align: true, snapArmed: true, snapPending: 0, snapAngle: VR_SNAP, itemArmed: true, camArmed: true, runOn: false, radarOn: false, crouch: 0,
  deadAligned: false, prevBtn: { left: [], right: [] }, toastText: '', toastT: 0, promptText: '', promptProg: null,
  hudKey: '', screenKey: '', screenSig: '', screenPose: null, mapDraw: -9, readHead: null, readRay: null, haptics: 0,
  page: 'main', pd: null, rects: [], hover: { left: -1, right: -1 }, hit: { left: null, right: null },
};
let rafPending = false;
const VR_HELP = ['LEFT STICK   walk', 'RIGHT STICK   snap turn   (up / down: items)', 'LEFT STICK CLICK   run on / off', 'RIGHT TRIGGER   use / open / pick up', 'LEFT TRIGGER   hold your breath', 'LEFT GRIP   tracker on / off', 'RIGHT GRIP   use the selected item', 'A   map <-> flashlight       B   flashlight on / off', 'X   pause       Y   back / close'];

function vrReadHead() {
  VR.rig.updateMatrixWorld(true);
  renderer.xr.getCamera(camera);
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler();
  camera.matrixWorld.decompose(p, q, s); e.setFromQuaternion(q, 'YXZ');
  return { x: p.x, y: p.y, z: p.z, yaw: e.y, pitch: e.x };
}
function vrReadRay(side) {
  const g = VR.ray.find((r) => r && r.userData && r.userData.hand === side);
  if (!g || g.visible === false) return null;
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), d = new THREE.Vector3(0, 0, -1);
  g.getWorldPosition(p); g.getWorldQuaternion(q); d.applyQuaternion(q);
  return { x: p.x, y: p.y, z: p.z, dx: d.x, dy: d.y, dz: d.z };
}
function vrApplyRig() {
  const r = VR.rigState;
  if (!VR.rig) return;
  VR.rig.position.set(r.x, r.y, r.z); VR.rig.rotation.y = r.yaw; VR.rig.updateMatrixWorld(true);
}
function vrGamepads() {
  const out = { left: null, right: null }, src = VR.session && VR.session.inputSources ? VR.session.inputSources : [];
  for (let i = 0; i < src.length; i++) { const s = src[i]; if (s && s.gamepad && (s.handedness === 'left' || s.handedness === 'right')) out[s.handedness] = s.gamepad; }
  return out;
}
function vrHaptic(strong, weak, ms, side) {
  const gps = vrGamepads(), amp = clamp(Math.max(strong || 0, (weak || 0) * 0.7), 0, 1), dur = clamp(ms || 100, 15, 600);
  ['left', 'right'].forEach((s) => {
    const g = gps[s];
    if (!g || (side && side !== s)) return;
    try {
      const a = g.hapticActuators && g.hapticActuators[0];
      if (a && a.pulse) a.pulse(amp, dur);
      else if (g.vibrationActuator && g.vibrationActuator.playEffect) g.vibrationActuator.playEffect('dual-rumble', { duration: dur, strongMagnitude: amp, weakMagnitude: amp * 0.6 });
    } catch (e) { /* ignore */ }
  });
  VR.haptics++;
}
function vrSyncButton() {
  const b = el['btn-vr'];
  if (!b) return;
  b.classList.toggle('soon', !VR.supported);
  b.title = VR.supported ? 'Play in a VR headset' : 'VR needs a WebXR browser (e.g. Meta Quest Browser) opened over https';
}
function vrMenuNote(msg) {
  const b = el['soon-banner'];
  if (b) { b.textContent = msg; b.classList.add('on'); clearTimeout(VR.noteTimer); VR.noteTimer = setTimeout(() => b.classList.remove('on'), 4200); }
}
function vrInit() {
  VR.readHead = vrReadHead; VR.readRay = vrReadRay;
  try {
    renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
    VR.rig = new THREE.Group(); scene.add(VR.rig); VR.rig.add(camera);
    for (let i = 0; i < 2; i++) {
      const c = renderer.xr.getController(i); c.userData.hand = '';
      c.addEventListener('connected', (e) => { c.userData.hand = (e.data && e.data.handedness) || ''; });
      c.addEventListener('disconnected', () => { c.userData.hand = ''; });
      VR.rig.add(c); VR.ray.push(c);
    }
  } catch (e) { VR.err = e; }
  if (el['btn-vr']) el['btn-vr'].addEventListener('click', vrStart);
  try {
    if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then((ok) => { VR.supported = !!ok; vrSyncButton(); }, () => {});
  } catch (e) { /* ignore */ }
  vrSyncButton();
}

async function vrStart() {
  if (VR.active || VR.busy) return;
  if (!navigator.xr || !navigator.xr.requestSession) { vrMenuNote('VR needs a WebXR browser (e.g. Meta Quest Browser) opened over https.'); return; }
  VR.busy = true;
  let session = null;
  try {
    Snd.init();
    session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
    VR.session = session;
    session.addEventListener('end', vrOnEnd); session.addEventListener('visibilitychange', vrOnVisibility);
    VR.floor = true;
    try { renderer.xr.setReferenceSpaceType('local-floor'); await renderer.xr.setSession(session); }
    catch (e) { VR.floor = false; renderer.xr.setReferenceSpaceType('local'); await renderer.xr.setSession(session); }
    try { if (renderer.xr.setFoveation) renderer.xr.setFoveation(1); } catch (e) { /* ignore */ }
    vrBuildKits();
    if (MP.phase !== 'off') mpLeaveLobby();
    VR.active = true; VR.busy = false; VR.align = true; VR.runOn = false; VR.radarOn = false; VR.page = 'main'; VR.screenKey = '';
    closeModals(); S.act = 1; setKeysNeeded(5); radar.up = false; S.mapUp = false;
    setMode('menu');
    renderer.setAnimationLoop(vrLoop);
  } catch (e) {
    VR.busy = false; VR.active = false;
    if (session) { try { session.end(); } catch (e2) { /* ignore */ } }
    VR.session = null;
    vrMenuNote("Couldn't start VR: " + String((e && e.message) || e));
  }
}
function vrLoop(t) { VR.inLoop = true; try { frame(t); } finally { VR.inLoop = false; } }
function vrExit() { if (VR.session) { try { VR.session.end(); } catch (e) { vrOnEnd(); } } else if (VR.active) vrOnEnd(); }
function vrOnVisibility() {
  if (VR.session && VR.session.visibilityState && VR.session.visibilityState !== 'visible' && S.mode === 'play') setPause(true);
}
function vrOnEnd() {
  if (!VR.active && !VR.session) return;
  VR.active = false; VR.session = null; VR.runOn = false; VR.radarOn = false;
  try { renderer.setAnimationLoop(null); } catch (e) { /* ignore */ }
  VR.rigState = { x: 0, y: 0, z: 0, yaw: 0 }; vrApplyRig();
  if (VR.hud) VR.hud.mesh.visible = false;
  if (VR.screen) VR.screen.mesh.visible = false;
  if (VR.black) VR.black.visible = false;
  if (VR.lasers) VR.lasers.forEach((l) => { l.beam.visible = false; l.dot.visible = false; });
  radar.up = false; S.mapUp = false;
  toMenu();
  try { onResize(); } catch (e) { /* ignore */ }
  if (!rafPending) { rafPending = true; requestAnimationFrame(frame); }
}
function vrOnReset() { VR.align = true; VR.deadAligned = false; VR.radarOn = false; VR.runOn = false; VR.crouch = 0; }

function vrBuildKits() {
  if (VR.kits) return;
  const bas = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {}));
  const tex = vm.tex || (vm.tex = new THREE.CanvasTexture(el['radar-canvas']));
  const radarKit = new THREE.Group(), plate = new THREE.Group();
  plate.position.set(0, 0.035, 0.035); plate.rotation.x = -0.85; radarKit.add(plate);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.028), bas(0x1c1c1c)); plate.add(body);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.15, 0.02), bas(0x3c3c3c)); rim.position.z = -0.005; plate.add(rim);
  const screenMat = bas(0xffffff, { map: tex });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.1125), screenMat); screen.position.z = 0.0146; plate.add(screen);
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.0065, 10), bas(0x7dff9a)); led.position.set(0.078, 0.064, 0.0148); plate.add(led);
  radarKit.userData = { screenMat, led };
  const flashKit = new THREE.Group();
  const bodyG = new THREE.CylinderGeometry(0.028, 0.034, 0.17, 16); bodyG.rotateX(Math.PI / 2);
  const tube = new THREE.Mesh(bodyG, bas(0x262626)); tube.position.z = 0.02; flashKit.add(tube);
  const headG = new THREE.CylinderGeometry(0.046, 0.03, 0.05, 16); headG.rotateX(Math.PI / 2);
  const head = new THREE.Mesh(headG, bas(0x3a3a3a)); head.position.z = -0.085; flashKit.add(head);
  const lensMat = bas(0xffffff), lens = new THREE.Mesh(new THREE.CircleGeometry(0.04, 18), lensMat); lens.rotation.y = Math.PI; lens.position.z = -0.1111; flashKit.add(lens);
  const beamG = new THREE.CylinderGeometry(0.04, 0.9, 7, 18, 1, true); beamG.translate(0, -3.5, 0); beamG.rotateX(Math.PI / 2);
  const beam = new THREE.Mesh(beamG, bas(0xffffff, { transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); beam.position.z = -0.11; flashKit.add(beam);
  const mapKit = new THREE.Group(), mplate = new THREE.Group(); mplate.position.set(0, 0.09, 0.03); mplate.rotation.x = -0.85; mapKit.add(mplate);
  const jc = el['journal-canvas'], asp = jc && jc.width ? jc.height / jc.width : 1.1;
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3 * asp + 0.04, 0.012), bas(0x2a2a2a)); mplate.add(board);
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.27 * asp), bas(0xffffff, { map: vm.mapTex || null })); paper.position.z = 0.0066; mplate.add(paper);
  mapKit.visible = false;
  flashKit.userData = { lensMat, beam, tube, head, lens }; mapKit.userData = { paper };
  VR.kits = { radar: radarKit, flash: flashKit, map: mapKit, attached: { left: null, right: null } };
  const mkTex = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const t = new THREE.CanvasTexture(cv); t.minFilter = THREE.LinearFilter; return { cv, tex: t, ctx: cv.getContext('2d') }; };
  VR.hud = { ...mkTex(768, 384), mesh: null }; VR.screen = { ...mkTex(1024, 640), mesh: null }; VR.black = null;
  const panel = (tex, w, h, order) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false })); m.renderOrder = order; m.frustumCulled = false; return m; };
  VR.hud.mesh = panel(VR.hud.tex, 0.62, 0.31, 999); VR.hud.mesh.position.set(0, -0.16, -0.95); camera.add(VR.hud.mesh);
  VR.screen.mesh = panel(VR.screen.tex, VR_SW, VR_SH, 1000); VR.screen.mesh.visible = false; scene.add(VR.screen.mesh);
  VR.black = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }));
  VR.black.renderOrder = 900; VR.black.position.set(0, 0, -0.3); VR.black.frustumCulled = false; camera.add(VR.black);
  const lm = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthTest: false, depthWrite: false, fog: false });
  VR.lasers = [0, 1].map(() => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 1, 6), lm()); b.renderOrder = 1001; b.visible = false; b.frustumCulled = false; scene.add(b);
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.018, 14), lm()); d.renderOrder = 1002; d.visible = false; d.frustumCulled = false; scene.add(d);
    return { beam: b, dot: d };
  });
}
function vrAttachKits() {
  const K = VR.kits;
  if (!K) return;
  ['left', 'right'].forEach((side) => {
    const g = VR.ray.find((r) => r && r.userData && r.userData.hand === side);
    if (!g) return;
    if (K.attached[side] !== g) {
      if (side === 'left') g.add(K.radar); else { g.add(K.flash); g.add(K.map); }
      K.attached[side] = g;
    }
  });
}

function vrBtn(label, act, enabled) { return { label, act, enabled: enabled !== false }; }
function vrPage() {
  const m = S.mode, exit = vrBtn('EXIT VR', vrExit), back = vrBtn('BACK', () => { VR.page = 'main'; });
  if (m === 'menu') {
    if (VR.page === 'settings') {
      const q = ['low', 'medium', 'high'], sh = ['hard', 'soft', 'off'], sn = [30, 45, 60];
      return { title: 'SETTINGS', lines: ['Tip: Quality LOW and Shadows OFF run best on a standalone headset.'], buttons: [
        vrBtn('QUALITY:   ' + String(Settings.quality).toUpperCase(), () => { Settings.quality = q[(q.indexOf(Settings.quality) + 1) % q.length]; Settings.save(); applyQuality(); }),
        vrBtn('SHADOWS:   ' + String(Settings.shadows).toUpperCase(), () => { Settings.shadows = sh[(sh.indexOf(Settings.shadows) + 1) % sh.length]; Settings.save(); applyShadowMode(Settings.shadows); }),
        vrBtn('SNAP TURN:   ' + Math.round(VR.snapAngle * 180 / Math.PI) + ' DEG', () => { const i = sn.indexOf(Math.round(VR.snapAngle * 180 / Math.PI)); VR.snapAngle = sn[(i + 1) % sn.length] * Math.PI / 180; }),
        back] };
    }
    if (VR.page === 'help') return { title: 'HOW TO PLAY IN VR', help: VR_HELP, buttons: [back] };
    return { title: 'MONOCHROME', lines: ['Point a controller at a button.', 'Pull the trigger to select.'], buttons: [
      vrBtn('PLAY', () => toLore()), vrBtn('SETTINGS', () => { VR.page = 'settings'; }), vrBtn('HOW TO PLAY', () => { VR.page = 'help'; }),
      vrBtn('MULTIPLAYER   (flat screen only)', null, false), exit] };
  }
  if (m === 'lore') return { title: '', text: el['lore-text'] ? el['lore-text'].textContent : '', buttons: [vrBtn('BEGIN', () => beginGame()), vrBtn('BACK', () => { clearInterval(typeTimer); setMode('menu'); VR.page = 'main'; })] };
  if (m === 'paused') return { title: 'PAUSED', help: VR_HELP, buttons: [vrBtn('RESUME', () => setPause(false)), exit] };
  if (m === 'dead' && S.deathPhase === 'card') return { title: 'YOU WERE CAUGHT', text: el['death-stats'] ? el['death-stats'].textContent : '', buttons: [vrBtn('TRY AGAIN', () => chooseDeath('retry')), exit] };
  if (m === 'won') return { title: el['win-title'] ? el['win-title'].textContent : '', text: el['win-text'] ? el['win-text'].textContent : '', buttons: [vrBtn('PLAY AGAIN', () => { S.act = 1; beginGame(); }), exit] };
  if (m === 'note') return { note: true, buttons: [vrBtn('CLOSE', () => setMode('play'))] };
  return null;
}
function vrLayout(pd) {
  const W = 1024, H = 640, bw = 600, bh = 60, gap = 12, n = pd.buttons.length, y0 = H - 28 - n * (bh + gap) + gap;
  return pd.buttons.map((b, i) => ({ x: (W - bw) / 2, y: y0 + i * (bh + gap), w: bw, h: bh }));
}
function vrHit(ray) {
  const p = VR.screenPose;
  if (!p || !ray) return null;
  const nx = Math.sin(p.yaw), nz = Math.cos(p.yaw), den = ray.dx * nx + ray.dz * nz;
  if (Math.abs(den) < 1e-4) return null;
  const t = ((p.x - ray.x) * nx + (p.z - ray.z) * nz) / den;
  if (t < 0.05 || t > 12) return null;
  const hx = ray.x + ray.dx * t, hy = ray.y + ray.dy * t, hz = ray.z + ray.dz * t;
  const lx = (hx - p.x) * Math.cos(p.yaw) + (hz - p.z) * -Math.sin(p.yaw), ly = hy - p.y;
  const inside = Math.abs(lx) <= VR_SW / 2 && Math.abs(ly) <= VR_SH / 2;
  return { t, x: hx, y: hy, z: hz, inside, cx: (lx / VR_SW + 0.5) * 1024, cy: (0.5 - ly / VR_SH) * 640 };
}
function vrButtonAt(hit) {
  if (!hit || !hit.inside) return -1;
  for (let i = 0; i < VR.rects.length; i++) { const r = VR.rects[i]; if (hit.cx >= r.x && hit.cx <= r.x + r.w && hit.cy >= r.y && hit.cy <= r.y + r.h && VR.pd.buttons[i].enabled) return i; }
  return -1;
}
function vrUiPress(side) {
  const i = VR.hover[side], pd = VR.pd;
  if (!pd || i < 0 || !pd.buttons[i] || !pd.buttons[i].enabled || !pd.buttons[i].act) return;
  Snd.click(); vrHaptic(0.55, 0, 45, side);
  pd.buttons[i].act();
  VR.screenSig = '';
}
function vrUiBack() {
  if (S.mode === 'menu' && VR.page !== 'main') VR.page = 'main';
  else if (S.mode === 'lore') { clearInterval(typeTimer); setMode('menu'); VR.page = 'main'; }
  else if (S.mode === 'paused') setPause(false);
  else if (S.mode === 'note') setMode('play');
}

function vrFillInput(o, dt) {
  const gps = vrGamepads(), L = gps.left, R = gps.right, mode = S.mode;
  VR.pd = vrPage();
  const ui = !!VR.pd;
  const ax = (g) => (g && g.axes ? (g.axes.length >= 4 ? [g.axes[2] || 0, g.axes[3] || 0] : [g.axes[0] || 0, g.axes[1] || 0]) : [0, 0]);
  const down = (g, i) => !!(g && g.buttons && g.buttons[i] && g.buttons[i].pressed);
  const edge = (side, g, i) => { const was = !!VR.prevBtn[side][i], now = down(g, i); VR.prevBtn[side][i] = now; return now && !was; };
  const dz = (v) => (Math.abs(v) < 0.2 ? 0 : v);
  const [lx, ly] = ax(L), [rx, ry] = ax(R);
  const lTrig = down(L, 0), lTrigE = edge('left', L, 0), rTrigE = edge('right', R, 0), lGripE = edge('left', L, 1), rGripE = edge('right', R, 1);
  const lStickE = edge('left', L, 3), aE = edge('right', R, 4), bE = edge('right', R, 5), xE = edge('left', L, 4), yE = edge('left', L, 5);
  o.lx = 0; o.ly = 0; o.pad = true;
  o.mx = dz(lx); o.mz = -dz(ly);
  if (lStickE && !ui) { VR.runOn = !VR.runOn; toast(VR.runOn ? 'RUN ON' : 'RUN OFF', 1000); }
  o.run = VR.runOn; o.breath = lTrig;
  o.interact = rTrigE; o.confirm = rTrigE; o.select = rTrigE; o.use = rGripE;
  if (lGripE && (mode === 'play' || mode === 'laptop')) { VR.radarOn = !VR.radarOn; Snd.radarToggle(); }
  if (aE) o.journal = true;
  if (bE) { if (S.mapUp) o.journal = true; else o.flash = true; }
  if (xE) o.pause = true;
  if (yE) o.back = true;
  if (Math.abs(rx) < 0.35) VR.snapArmed = true;
  else if (VR.snapArmed && Math.abs(rx) > 0.75) { VR.snapArmed = false; VR.snapPending += rx > 0 ? -VR.snapAngle : VR.snapAngle; }
  if (Math.abs(ry) < 0.35) VR.itemArmed = true;
  else if (VR.itemArmed && Math.abs(ry) > 0.75) { VR.itemArmed = false; if (ry < 0) o.itemPrev = true; else o.itemNext = true; }
  if (mode === 'laptop') {
    if (Math.abs(lx) < 0.35) VR.camArmed = true;
    else if (VR.camArmed && Math.abs(lx) > 0.75) { VR.camArmed = false; if (lx < 0) o.prev = true; else o.next = true; }
    o.mx = 0; o.mz = 0;
  }
  if (ui) {
    if (lTrigE) vrUiPress('left');
    if (rTrigE) vrUiPress('right');
    if (yE) vrUiBack();
    if (xE && mode === 'paused') setPause(false);
    o.pause = false; o.back = false; o.interact = o.confirm = o.select = false; o.use = false; o.journal = false; o.flash = false; o.breath = false;
  }
  if (mode !== 'play' && mode !== 'laptop') { o.mx = 0; o.mz = 0; }
}

function vrBeginFrame(dt) {
  const h = VR.readHead();
  VR.head = h; VR.headAdopt = { x: h.x, z: h.z };
  const free = (S.mode === 'play' || S.mode === 'laptop' || S.mode === 'journal' || S.mode === 'note') && !P.hiding && !P.anim;
  if (free) {
    const pos = { x: h.x, z: h.z };
    resolveCollisions(pos, PLAYER_R, true);
    P.x = pos.x; P.z = pos.z;
  }
  if (!VR.align) { P.yaw = h.yaw; P.pitch = h.pitch; }
  radar.up = VR.radarOn;
}
function vrRotateRig(theta, cx, cz) {
  const r = VR.rigState, dx = r.x - cx, dz = r.z - cz, c = Math.cos(theta), s = Math.sin(theta);
  r.x = cx + dx * c + dz * s; r.z = cz - dx * s + dz * c; r.yaw += theta; VR.head.yaw += theta;
}
function vrCameraY() { return VR.head.y; }
function vrEndFrame(dt) {
  const h = VR.head, r = VR.rigState, dead = (S.mode === 'dead' || S.mode === 'cutscene') && S.dcam;
  let tx = P.x, tz = P.z;
  if (dead) { tx = S.dcam.x; tz = S.dcam.z; }
  const oy = r.y;
  r.x += tx - h.x; r.z += tz - h.z; h.x = tx; h.z = tz;
  if (dead) r.y += S.dcam.y - h.y;
  else {
    VR.crouch = approach(VR.crouch, P.hiding ? 0.22 : 0, dt * 0.7);
    r.y = (VR.floor ? 0 : EYE_H) + (P.gy || 0) - VR.crouch;
  }
  h.y += r.y - oy;
  if (VR.snapPending) { vrRotateRig(VR.snapPending, tx, tz); VR.snapPending = 0; }
  let want = null;
  if (VR.align) { want = P.yaw; VR.align = false; }
  else if (P.anim) want = P.yaw;
  else if (dead) { if (!VR.deadAligned) { want = S.dcam.yaw; VR.deadAligned = true; } }
  else VR.deadAligned = false;
  if (want != null) vrRotateRig(angDiff(h.yaw, want), tx, tz);
  vrApplyRig();
  vrAttachKits();
  vrUpdateKits(dt);
  vrUpdatePanels(dt);
}
function vrUpdateKits(dt) {
  const K = VR.kits;
  if (!K) return;
  const ray = VR.readRay('right') || { x: VR.head.x, y: VR.head.y - 0.3, z: VR.head.z, dx: -Math.sin(VR.head.yaw), dy: 0, dz: -Math.cos(VR.head.yaw) };
  const holdMap = !!S.mapUp;
  K.flash.visible = !holdMap; K.map.visible = holdMap;
  K.radar.userData.screenMat.color.setHex(VR.radarOn ? 0xffffff : 0x050505);
  K.radar.userData.led.visible = VR.radarOn;
  const on = P.flashOn && !holdMap;
  K.flash.userData.lensMat.color.setHex(on ? 0xffffff : 0x303030); K.flash.userData.beam.visible = on;
  const tx = ray.x + ray.dx * 0.12, ty = ray.y + ray.dy * 0.12, tz = ray.z + ray.dz * 0.12;
  flash.position.set(tx, ty, tz); flash.target.position.set(tx + ray.dx * 6, ty + ray.dy * 6, tz + ray.dz * 6);
  if (flash.target.updateMatrixWorld) flash.target.updateMatrixWorld();
  if (holdMap) flash.intensity = 0;
  if (holdMap && S.time - VR.mapDraw > 0.25) { VR.mapDraw = S.time; drawJournal(); if (vm.mapTex) { vm.mapTex.needsUpdate = true; K.map.userData.paper.material.map = vm.mapTex; K.map.userData.paper.material.needsUpdate = true; } }
}

function vrWrap(ctx, text, maxW) {
  const out = [];
  String(text || '').split('\n').forEach((para) => {
    let line = '';
    para.split(' ').forEach((w) => { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
    out.push(line);
  });
  return out;
}
function vrUpdatePanels(dt) {
  const K = VR.kits;
  if (!K || !VR.hud) return;
  VR.toastT -= dt;
  const cut = parseFloat(el.cut && el.cut.style ? el.cut.style.opacity : 0) || 0;
  const blk = Math.max(cut, (S.mode === 'dead' && (S.deathPhase === 'black' || S.deathPhase === 'card' || S.deathPhase === 'out')) ? 1 : 0);
  VR.black.material.opacity = blk; VR.black.visible = blk > 0.01;
  const pd = VR.pd || vrPage(), key = pd ? S.mode + ':' + VR.page : '';
  if (pd && VR.screenKey !== key) {
    const h = VR.head, d = 1.6;
    VR.screenPose = { x: h.x - Math.sin(h.yaw) * d, y: h.y - 0.05, z: h.z - Math.cos(h.yaw) * d, yaw: h.yaw };
    VR.screen.mesh.position.set(VR.screenPose.x, VR.screenPose.y, VR.screenPose.z); VR.screen.mesh.rotation.y = h.yaw;
    if (VR.screen.mesh.updateMatrixWorld) VR.screen.mesh.updateMatrixWorld();
    VR.screenSig = '';
  }
  VR.screenKey = key; VR.screen.mesh.visible = !!pd;
  VR.hud.mesh.visible = !pd || !!pd.note;
  if (pd) { VR.pd = pd; VR.rects = vrLayout(pd); vrUpdateLasers(); vrDrawScreen(pd); } else { VR.hover.left = VR.hover.right = -1; if (VR.lasers) VR.lasers.forEach((l) => { l.beam.visible = false; l.dot.visible = false; }); }
  vrDrawHud();
}
function vrUpdateLasers() {
  ['left', 'right'].forEach((side, i) => {
    const ray = VR.readRay(side), hit = ray ? vrHit(ray) : null, L = VR.lasers[i], idx2 = hit ? vrButtonAt(hit) : -1;
    if (idx2 !== VR.hover[side] && idx2 >= 0) vrHaptic(0.2, 0, 18, side);
    VR.hover[side] = idx2; VR.hit[side] = hit;
    if (!ray) { L.beam.visible = false; L.dot.visible = false; return; }
    const len = hit && hit.inside ? hit.t : (hit ? Math.min(hit.t, 3) : 3);
    L.beam.visible = true; L.beam.position.set(ray.x + ray.dx * len / 2, ray.y + ray.dy * len / 2, ray.z + ray.dz * len / 2); L.beam.scale.set(1, len, 1);
    L.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(ray.dx, ray.dy, ray.dz));
    L.beam.material.opacity = idx2 >= 0 ? 0.95 : 0.5;
    L.dot.visible = !!(hit && hit.inside); if (hit && hit.inside) { L.dot.position.set(hit.x, hit.y, hit.z); L.dot.rotation.y = VR.screenPose.yaw; L.dot.material.opacity = idx2 >= 0 ? 1 : 0.7; }
  });
}
function vrDrawScreen(pd) {
  const S2 = VR.screen, c = S2.ctx, W = 1024, H = 640;
  const sig = [S.mode, VR.page, pd.title, pd.text, VR.hover.left, VR.hover.right, pd.buttons.map((b) => b.label + b.enabled).join('/'), pd.note ? S.time | 0 : ''].join('|');
  if (VR.screenSig === sig) return;
  VR.screenSig = sig;
  c.clearRect(0, 0, W, H); c.fillStyle = 'rgba(0,0,0,0.9)'; c.fillRect(0, 0, W, H); c.strokeStyle = '#bbb'; c.lineWidth = 4; c.strokeRect(10, 10, W - 20, H - 20);
  c.textAlign = 'center'; c.fillStyle = '#fff'; c.textBaseline = 'alphabetic';
  let y = 84;
  if (pd.note) { const nc = el['note-canvas']; if (nc && nc.width) c.drawImage(nc, 40, 26, W - 80, H - 150); }
  else {
    if (pd.title) { c.font = '58px "Courier New", monospace'; c.fillText(pd.title, W / 2, y); y += 64; }
    if (pd.lines) { c.font = '26px "Courier New", monospace'; c.fillStyle = '#cfcfcf'; pd.lines.forEach((ln) => { vrWrap(c, ln, W - 140).forEach((l2) => { c.fillText(l2, W / 2, y); y += 34; }); }); c.fillStyle = '#fff'; }
    if (pd.text) { c.font = '30px "Courier New", monospace'; vrWrap(c, pd.text, W - 140).forEach((ln) => { c.fillText(ln, W / 2, y); y += 40; }); y += 8; }
    if (pd.help) { c.font = '22px "Courier New", monospace'; c.textAlign = 'left'; c.fillStyle = '#cfcfcf'; pd.help.forEach((ln) => { c.fillText(ln, 110, y); y += 29; }); c.textAlign = 'center'; c.fillStyle = '#fff'; }
  }
  pd.buttons.forEach((b, i) => {
    const r = VR.rects[i], hot = i === VR.hover.left || i === VR.hover.right;
    c.fillStyle = hot ? '#fff' : (b.enabled ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'); c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = b.enabled ? '#fff' : '#666'; c.lineWidth = 3; c.strokeRect(r.x, r.y, r.w, r.h);
    c.font = '32px "Courier New", monospace'; c.textAlign = 'center'; c.fillStyle = hot ? '#000' : (b.enabled ? '#fff' : '#777'); c.fillText(b.label, r.x + r.w / 2, r.y + r.h / 2 + 11);
  });
  S2.tex.needsUpdate = true;
}
function vrDrawHud() {
  const Hd = VR.hud, c = Hd.ctx, W = 768, H = 384;
  const names = inv.slots.map((s, i) => (i === inv.sel ? '[' : ' ') + (ITEM_DEFS[s.type] ? ITEM_DEFS[s.type].name.split(' ').pop().toUpperCase() : '?') + (s.n > 1 ? 'x' + s.n : '') + (i === inv.sel ? ']' : ' ')).join(' ');
  const toastTxt = VR.toastT > 0 ? VR.toastText : '';
  const keys = el['hud-keys'] ? el['hud-keys'].textContent : '';
  const lap = S.mode === 'laptop' ? (el['cam-label'] ? el['cam-label'].textContent : '') : '';
  const prompt = VR.promptText || '';
  const key = [keys, toastTxt, prompt, VR.promptProg == null ? '' : Math.round(VR.promptProg * 20), names, lap, P.hiding ? Math.round(breath.air * 20) : '', VR.runOn ? 'R' : '', VR.radarOn ? 'T' : ''].join('|');
  if (key === VR.hudKey) return;
  VR.hudKey = key;
  c.clearRect(0, 0, W, H); c.textBaseline = 'middle'; c.lineJoin = 'round';
  const text = (t, x, y, size, align, alpha) => { c.font = 'bold ' + size + 'px "Courier New", monospace'; c.textAlign = align; c.lineWidth = 7; c.strokeStyle = 'rgba(0,0,0,0.9)'; c.strokeText(t, x, y); c.fillStyle = 'rgba(255,255,255,' + (alpha || 0.92) + ')'; c.fillText(t, x, y); };
  text(keys, 26, 30, 30, 'left'); if (VR.runOn) text('RUN', W - 26, 30, 26, 'right', 0.7);
  if (VR.radarOn) text('TRACKER ON', W - 26, 62, 20, 'right', 0.6);
  if (toastTxt) { vrWrap(c, toastTxt, W - 80).forEach((ln, i) => text(ln, W / 2, 140 + i * 40, 34, 'center')); }
  if (lap) text(lap + '   (stick: switch   trigger: close)', W / 2, 250, 22, 'center', 0.85);
  if (prompt) {
    text(prompt, W / 2, 292, 32, 'center');
    if (VR.promptProg != null) { c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(W / 2 - 160, 322, 320, 12); c.fillStyle = '#fff'; c.fillRect(W / 2 - 160, 322, 320 * clamp(VR.promptProg, 0, 1), 12); }
  }
  if (P.hiding) { c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(W / 2 - 120, 362, 240, 9); c.fillStyle = '#fff'; c.fillRect(W / 2 - 120, 362, 240 * clamp(breath.air, 0, 1), 9); }
  if (names.trim()) text(names, W - 20, H - 18, 20, 'right', 0.7);
  Hd.tex.needsUpdate = true;
}
function vrEscape() {
  S.cs = null; S.dcam = null; Snd.duck(false);
  el.cut.style.transition = 'none'; el.cut.style.opacity = '0';
  setMode('won'); radar.up = false; setPrompt('');
  el['win-title'].textContent = 'You made it down.';
  el['win-text'].textContent = "Act 2 isn't available in VR yet, so this is where your run ends. Play it on a flat screen from the main menu.";
}

/* ======================================================================
   SECOND FLOOR  ·  Act 1 now has two storeys joined by a staircase
   · ground floor: a staircase in one of the rooms rises into a dark opening
   · upstairs: its own rooms, furniture, items and keys, and a stairwell that drops back down into the dark
   · keys are spread over both floors, everything you did on a floor is remembered, and the watcher follows you up and down
   ====================================================================== */
const FLOORS = { seed: 0, saved: {}, stair: null, entry: null, climbYaw: 0, entryYaw: 0, landing: { x: 8.2, z: 7.5 }, name: ['', 'DOWNSTAIRS', 'UPSTAIRS'] };
const UP_NAMES = ['MASTER BEDROOM', 'STUDY', 'BATHROOM', 'NURSERY', 'ATTIC STORAGE', 'GUEST ROOM'];
const floorsOn = () => !MP.active;                                           // (multiplayer keeps the single floor for now)
const floor2Seed = (b) => (Math.imul(b >>> 0, 0x9E3779B1) ^ 0x2F2F2F2F) >>> 0;
function floorKeys(n) { const up = floorsOn() ? Math.max(1, Math.floor(TOTAL_KEYS * 0.4)) : 0; return n === 2 ? up : TOTAL_KEYS - up; }
function floorsReset() { FLOORS.seed = S.seed; FLOORS.saved = {}; S.floor = 1; S.floorGo = null; mon.away = false; mon.awayT = 0; }

/* ---------- ground floor: choose where the stairs go (before the furniture is placed) and build them ---------- */
function stairCands(r) {                                                // a run of 3 tiles along any wall of the room, either end may be the high end
  const out = [];
  if (r.x1 - r.x0 >= 3) for (const z of [r.z0, r.z1]) for (const xs of [r.x0, r.x1 - 2]) out.push({ ax: 'x', tiles: [[xs, z], [xs + 1, z], [xs + 2, z]], sgn: xs === r.x0 ? -1 : 1, wall: [0, z === r.z0 ? -1 : 1] });
  if (r.z1 - r.z0 >= 3) for (const x of [r.x0, r.x1]) for (const zs of [r.z0, r.z1 - 2]) out.push({ ax: 'z', tiles: [[x, zs], [x, zs + 1], [x, zs + 2]], sgn: zs === r.z0 ? -1 : 1, wall: [x === r.x0 ? -1 : 1, 0] });
  return out;
}
function reserveStairs() {
  FLOORS.stair = null; FLOORS.entry = null;
  if (!floorsOn() || S.floor === 2) return;
  const cands = [];
  rooms.forEach((r) => stairCands(r).forEach((c) => { c.r = r; cands.push(c); }));
  const order = shuffle(cands), pass = [];
  order.forEach((c) => pass.push([c, true])); order.forEach((c) => pass.push([c, false]));       // strict placements first, then relaxed ones
  for (const [c, strict] of pass) {
    const t = c.tiles, a = c.ax === 'x' ? 0 : 1, hi = c.sgn < 0 ? t[0] : t[2], lo = c.sgn < 0 ? t[2] : t[0];
    const d = [a === 0 ? c.sgn : 0, a === 1 ? c.sgn : 0];                      // the direction you climb
    const end = [hi[0] + d[0], hi[1] + d[1]], entry = [lo[0] - d[0], lo[1] - d[1]];
    let ok = !solid(entry[0], entry[1]) && (!strict || (solid(end[0], end[1]) && roomId[idx(entry[0], entry[1])] === c.r.id));
    for (const q of t) { if (solid(q[0], q[1]) || (strict && (!solid(q[0] + c.wall[0], q[1] + c.wall[1]) || solid(q[0] - c.wall[0], q[1] - c.wall[1]))) || roomId[idx(q[0], q[1])] !== c.r.id) ok = false; }
    if (!ok) continue;
    FLOORS.stair = { r: c.r, ax: c.ax, tiles: t, sgn: c.sgn, wall: c.wall, entry };
    FLOORS.entry = { x: (entry[0] + 0.5) * TILE, z: (entry[1] + 0.5) * TILE };
    FLOORS.climbYaw = Math.atan2(-d[0], -d[1]); FLOORS.entryYaw = Math.atan2(d[0], d[1]);          // up the stairs / away from them
    t.concat([entry]).forEach((q) => { used.add(keyOf(q[0], q[1])); used.add(keyOf(q[0] - c.wall[0], q[1] - c.wall[1])); });
    return;
  }
}
function buildStairsUp() {
  const st = FLOORS.stair;
  if (!st) return;
  const t = st.tiles, X = st.ax === 'x', H = 1.95, n = 13;
  const x0 = Math.min(t[0][0], t[2][0]) * TILE, x1 = (Math.max(t[0][0], t[2][0]) + 1) * TILE, z0 = Math.min(t[0][1], t[2][1]) * TILE, z1 = (Math.max(t[0][1], t[2][1]) + 1) * TILE;
  const len = X ? x1 - x0 : z1 - z0, w = len / n, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  for (let k = 0; k < n; k++) {                                                                  // the steps: low end at the entry, high end against the wall
    const h = H * (k + 1) / n, off = st.sgn > 0 ? (X ? x0 : z0) + (k + 0.5) * w : (X ? x1 : z1) - (k + 0.5) * w;
    if (X) addBox(world, w, h, TILE - 0.3, off, h / 2, cz, M.wood); else addBox(world, TILE - 0.3, h, w, cx, h / 2, off, M.wood);
  }
  ramps.push({ x0, z0, x1, z1, h: H, ax: st.ax, sgn: st.sgn });
  const railX = X ? null : (st.wall[0] < 0 ? x1 : x0), railZ = X ? (st.wall[1] < 0 ? z1 : z0) : null;           // the open side is opposite the wall
  if (X) addCollider(x0, railZ - 0.13, x1, railZ + 0.13, { jamb: true }); else addCollider(railX - 0.13, z0, railX + 0.13, z1, { jamb: true });
  const th = Math.atan2(H, len), rail = Math.hypot(len, H), rc = 0.95 + H / 2;
  if (X) addBox(world, rail, 0.06, 0.06, cx, rc, railZ + (st.wall[1] < 0 ? -0.1 : 0.1), M.wood, { rz: st.sgn > 0 ? th : -th });
  else addBox(world, 0.06, 0.06, rail, railX + (st.wall[0] < 0 ? -0.1 : 0.1), rc, cz, M.wood, { rx: st.sgn > 0 ? -th : th });
  t.forEach((q) => { const a = idx(q[0], q[1]), b = idx(q[0] - st.wall[0], q[1] - st.wall[1]); blockedEdges.add(a * 4096 + b); blockedEdges.add(b * 4096 + a); });
  const seal = (qx, qz, dx, dz) => {                                                              // a wall panel on one edge of the stair run (when the room's own wall isn't there)
    if (solid(qx + dx, qz + dz)) return;
    const ex = (qx + 0.5) * TILE + dx * TILE / 2, ez = (qz + 0.5) * TILE + dz * TILE / 2, tx = dx !== 0 ? 0.3 : TILE, tz = dz !== 0 ? 0.3 : TILE;
    addBox(world, tx, WALL_H, tz, ex, WALL_H / 2, ez, M.wall); addCollider(ex - tx / 2, ez - tz / 2, ex + tx / 2, ez + tz / 2, { jamb: true });
    const a = idx(qx, qz), b = idx(qx + dx, qz + dz); blockedEdges.add(a * 4096 + b); blockedEdges.add(b * 4096 + a);
  };
  t.forEach((q) => seal(q[0], q[1], st.wall[0], st.wall[1]));
  const hiT = st.sgn < 0 ? t[0] : t[2]; seal(hiT[0], hiT[1], X ? st.sgn : 0, X ? 0 : st.sgn);
  guardNav = true;
  const shw = 4.5, hx = X ? (st.sgn > 0 ? x1 - shw / 2 : x0 + shw / 2) : cx, hz = X ? cz : (st.sgn > 0 ? z1 - shw / 2 : z0 + shw / 2);     // the top vanishes into a dark opening overhead
  addBox(world, X ? shw : TILE - 0.05, 1.0, X ? TILE - 0.05 : shw, hx, 2.9, hz, M.black);
}

/* ---------- upstairs: the landing with the stairwell that drops back down ---------- */
function buildLanding() {
  addLamp(10.5, 7.8, WALL_H - 0.05, 1.5, false); addLamp(14.5, 4.6, WALL_H - 0.05, 0.9, true);
  const X = 6, Z0 = 6, Z1 = 9, ZC = 7.5;
  addBox(world, 3.0, 2.6, 0.6, 4.5, -1.3, Z0 + 0.3, M.wall); addBox(world, 3.0, 2.6, 0.6, 4.5, -1.3, Z1 - 0.3, M.wall);          // the stairwell: flanks flush with the floor…
  for (let k = 0; k < 6; k++) { const h = 2.6 - 0.4 * (k + 1); addBox(world, 0.5, h, 1.8, X - 0.5 * (k + 0.5), -2.6 + h / 2, ZC, M.pillar); }   // …steps going down…
  addBox(world, 3.0, 0.2, 1.8, 4.5, -2.7, ZC, M.black);                                                                           // …into black
  addCollider(3, Z0, X, Z0 + 0.6, { jamb: true }); addCollider(3, Z1 - 0.6, X, Z1, { jamb: true });
  ramps.push({ x0: 3, z0: Z0 + 0.6, x1: X, z1: Z1 - 0.6, h: -2.4, ax: 'x', sgn: -1 });
  addLamp(4.5, ZC, 1.2, 0.5, false);
  makeTable(11.0, 4.2, 0); makeChair(10.0, 5.2, Math.PI); makeChair(12.0, 5.2, Math.PI * 0.95);
  makeChair(16.0, 10.2, -1.2); makeChair(9.4, 11.0, 2.9);
}

/* ---------- moving between floors ---------- */
function snapshotFloor() {
  return { spots: searchSpots.map((s) => !!s.searched), taken: pickups.map((p) => !!p.taken), doors: doors.map((d) => (d.target ? 1 : 0)), disc: discovered.slice() };
}
function restoreFloor(sv) {
  if (!sv) { discovered.fill(0); return; }
  sv.spots.forEach((v, i) => { const s = searchSpots[i]; if (s && v) { s.searched = true; if (s.fronts) s.fronts[1].position.z = s.frontZ + 0.08; } });
  sv.taken.forEach((v, i) => { const p = pickups[i]; if (p && v) { p.taken = true; p.group.visible = false; p.sprite.visible = false; } });
  sv.doors.forEach((v, i) => { const d = doors[i]; if (d) { d.target = v; d.angle = v ? 1.55 : 0; d.hinge.rotation.y = d.angle; if (d.collider) d.collider.off = v === 1; } });
  discovered.set(sv.disc);
}
function restoreExitDoor() {                                                                       // padlocks you already opened stay open
  if (!exitDoor.hinge) return;
  exitDoor.locks.forEach((L, i) => { if (i < S.locks) { L.state = 1; L.t = 5; L.group.visible = false; } });
  if (S.locks >= exitDoor.locks.length && exitDoor.locks.length) { exitDoor.target = 1; exitDoor.angle = 1.7; exitDoor.hinge.rotation.y = 1.7; if (exitDoor.collider) exitDoor.collider.off = true; S.stairsOpen = true; }
}
function floorsTick(dt, inp) {
  if (S.floorGo) {
    inp.mx = 0; inp.mz = 0; inp.interact = false; inp.use = false; inp.run = false;
    S.floorGo.t -= dt;
    if (S.floorGo.t <= 0) { const n = S.floorGo.to; S.floorGo = null; doChangeFloor(n); }
    return;
  }
  if (!floorsOn() || P.hiding || P.anim || S.mode !== 'play' || S.act !== 1 || DBG.noclip) return;
  if (S.floor === 1 && FLOORS.stair && P.gy > 1.45) startFloorChange(2);
  else if (S.floor === 2 && P.gy < -1.95) startFloorChange(1);
}
function startFloorChange(n) {
  S.floorGo = { to: n, t: 0.7 };
  el.cut.style.transition = 'opacity .5s'; el.cut.style.opacity = '1';
  Snd.stomp();
}
function doChangeFloor(n) {
  FLOORS.saved[S.floor] = snapshotFloor();
  const chasing = !mon.away && (mon.state === 'CHASE' || mon.state === 'INVESTIGATE' || mon.state === 'CLOSET_CHECK' || mon.state === 'STARE' || mon.dist < 12);
  S.floor = n; S.searching = null; radar.up = false;
  buildWorld(n === 1 ? FLOORS.seed : floor2Seed(FLOORS.seed), 1);
  S.seed = FLOORS.seed; S.worldUsed = true;
  restoreFloor(FLOORS.saved[n]);
  if (n === 1) restoreExitDoor();
  if (n === 2) { P.x = FLOORS.landing.x; P.z = FLOORS.landing.z; P.yaw = -Math.PI / 2; } else { P.x = FLOORS.entry.x; P.z = FLOORS.entry.z; P.yaw = FLOORS.entryYaw; }       // the other end of the stairs
  P.pitch = 0; P.gy = 0; P.hiding = false; P.closet = null; P.anim = null; P.moving = false; P.running = false;
  P.safe = zoneAt(P.x, P.z) === 1;
  mon.closet = null; mon.closetCool = {}; mon.wp = null; mon.wpKey = -1; mon.doorWork = null; mon.passDoor = null; mon.ignoreT = 0; fieldPKey = -1;
  mon.away = true; mon.awayT = chasing ? 6 + Math.random() * 3 : 28 + Math.random() * 40; mon.arrive = chasing ? 'INVESTIGATE' : 'PATROL';       // it needs a moment to come after you
  mon.state = 'LEAVE'; mon.x = -60; mon.z = -60; mon.dist = 999; mon.sees = false;
  toast(FLOORS.name[n], 1800); updateKeyUI();
  fadeFromBlack(900);
}
function monsterArrive() {
  const a = S.floor === 2 ? { x: 7.0, z: 7.5 } : (FLOORS.entry || { x: 20, z: 8 });
  if (Math.hypot(P.x - a.x, P.z - a.z) < 9) { mon.awayT = 0.8; return; }                      // never right on top of you
  mon.away = false; mon.x = a.x; mon.z = a.z; mon.state = 'PATROL'; mon.wp = null; mon.wpKey = -1; mon.timer = 0; mon.grace = 0;
  if (mon.arrive === 'INVESTIGATE') startInvestigate(P.x, P.z);
  Snd.growl();
}

/* ======================================================================
   DEBUG TOOLS  ·  PC keyboard
   F3 debug menu · F4 free camera · F2 hide the UI · F9 screenshot · ` (backtick) console
   Free camera: WASD move, Space up, C down, Shift fast, mouse / arrow keys look, mouse wheel = speed, [ ] = field of view
   ====================================================================== */
const dbgX = { built: false, root: null, tab: 'info', refreshers: [], logEl: null, inEl: null, infoEl: null, tabs: {}, last: 0, shotPending: 0, gz: null, gzSig: '', wireMat: null, frames: 0, fpsT: 0, bodies: {} };
const dbgh = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
function dbgLog(msg, cls) {
  if (!dbgX.logEl) return;
  const d = dbgh('div', 'dl ' + (cls || ''), String(msg)); dbgX.logEl.appendChild(d);
  while (dbgX.logEl.childNodes && dbgX.logEl.childNodes.length > 300) dbgX.logEl.removeChild(dbgX.logEl.firstChild);
  dbgX.logEl.scrollTop = 1e9;
}
function dbgFmt(v) {
  if (v === undefined) return 'undefined';
  if (typeof v === 'function') return '[function ' + (v.name || '') + ']';
  if (typeof v === 'number') return String(Math.round(v * 10000) / 10000);
  if (typeof v === 'object' && v !== null) { try { const s = JSON.stringify(v, (k, x) => (typeof x === 'number' ? Math.round(x * 1000) / 1000 : (x && x.isObject3D ? '[Object3D]' : x))); return s.length > 600 ? s.slice(0, 600) + '…' : s; } catch (e) { return '[object]'; } }
  return String(v);
}
function dbgEval(code) { return (0, eval)(code); }                                       // indirect: global scope (not enough for the game's closure)
function dbgInner(code) { return eval(code); }                                          // direct eval: sees everything inside the game

/* ---------- helpers the buttons and the console share ---------- */
function dbgTeleport(x, z) { P.x = x; P.z = z; P.gy = DBG.noclip ? DBG.flyY : floorH(x, z); fieldPKey = -1; P.hiding = false; P.closet = null; P.anim = null; dbgLog('teleported to ' + dbgFmt([x, z])); }
function dbgFwd(d) { const cx = DBG.cam.on ? DBG.cam.x : P.x, cz = DBG.cam.on ? DBG.cam.z : P.z, yaw = DBG.cam.on ? DBG.cam.yaw : P.yaw; return { x: cx - Math.sin(yaw) * d, z: cz - Math.cos(yaw) * d }; }
function dbgBring(d) { const f = dbgFwd(d == null ? 4 : d); mon.x = f.x; mon.z = f.z; mon.away = false; mon.yaw = Math.atan2(-(P.x - f.x), -(P.z - f.z)); mon.wantYaw = mon.yaw; mon.wp = null; mon.wpKey = -1; mon.gy = floorH(f.x, f.z); }
function dbgRoomCenter(i) { const r = rooms[i]; return r ? { x: (r.x0 + r.x1 + 1) / 2 * TILE, z: (r.z0 + r.z1 + 1) / 2 * TILE } : null; }
function dbgDeath(type) {
  if (S.mode === 'dead') { dbgLog('already dead', 'err'); return; }
  if (S.mode !== 'play') { dbgLog('only while playing', 'err'); return; }
  if (type === 'drag' && !(P.hiding && P.closet)) { dbgLog("'drag' needs you hiding in a closet (use the HIDE button first)", 'err'); return; }
  DBG.deathType = type || null; DBG.forceDie = true; try { dieNow(); } finally { DBG.forceDie = false; DBG.deathType = null; }
}
function dbgAllKeys() { S.keys = TOTAL_KEYS; updateKeyUI(); }
function dbgUnlock() {
  if (S.act !== 1 || !exitDoor.hinge) { dbgLog('no exit door on this floor/act', 'err'); return; }
  S.keys = TOTAL_KEYS; S.locks = exitDoor.locks.length; restoreExitDoor(); updateKeyUI(); dbgLog('all padlocks open');
}
function dbgNearestCloset() {
  let best = null, bd = 1e9;
  closets.forEach((c) => { const p = c.group && c.group.position ? c.group.position : c; const d = Math.hypot((p.x || 0) - P.x, (p.z || 0) - P.z); if (d < bd) { bd = d; best = c; } });
  return best;
}
function dbgHide() { const c = dbgNearestCloset(); if (!c) { dbgLog('no closets here', 'err'); return; } if (S.mode !== 'play') return; if (P.hiding) return; const p = c.group.position; dbgTeleport(p.x, p.z); enterCloset(c); }
function dbgFloor(n) { if (!floorsOn() || S.act !== 1) { dbgLog('floors only exist in single-player Act 1', 'err'); return; } if (S.floor === n) { dbgLog('already on floor ' + n); return; } doChangeFloor(n); }
function dbgGoto(where) {
  if (where === 'safe') { const t = openTiles.find((q) => zone[idx(q.x, q.z)] === 1); if (t) dbgTeleport((t.x + 0.5) * TILE, (t.z + 0.5) * TILE); else dbgLog('no safe room on this floor', 'err'); }
  else if (where === 'stairs' && FLOORS.entry) dbgTeleport(FLOORS.entry.x, FLOORS.entry.z);
  else if (where === 'landing') dbgTeleport(FLOORS.landing.x, FLOORS.landing.z);
  else if (where === 'mon') dbgTeleport(mon.x, mon.z);
  else if (where === 'exit' && exitDoor.hinge) dbgTeleport(exitDoor.hinge.position.x + 2, exitDoor.hinge.position.z);
  else if (where === 'key') { const ks = searchSpots.filter((s) => s.hasKey && !s.searched); if (!ks.length) dbgLog('no unsearched key spots on this floor', 'err'); else { const k = ks[(dbgX.keyI = ((dbgX.keyI || 0) + 1) % ks.length)]; dbgTeleport(k.x + 1, k.z + 1); } }
  else dbgLog('unknown place: ' + where, 'err');
}
function dbgPlaceInFront(d) { const f = dbgFwd(d || 3); mon.x = f.x; mon.z = f.z; mon.away = false; const px = DBG.cam.on ? DBG.cam.x : P.x, pz = DBG.cam.on ? DBG.cam.z : P.z; mon.yaw = Math.atan2(-(px - f.x), -(pz - f.z)); mon.wantYaw = mon.yaw; mon.gy = floorH(f.x, f.z); }
function dbgLabOn(on) {
  DBG.lab.on = on;
  if (on) { DBG.freezeMon = true; DBG.noDetail = false; mon.away = false; mon.grace = 999; }
  else { clearOverrides(); mon.lean = 0; mon.headScale = 1; mon.eyeScale = 1; mon.duck = 0; mon.crouch = 0; mon.reach = 0; mon.speedNow = 0; mon.state = 'PATROL'; DBG.freezeMon = false; }
}
const DBG_POSES = {
  idle: { armL: null, armR: null, legL: 0, legR: 0, curl: 0, lean: 0, duck: 0, crouch: 0, reach: 0, speed: 0, jaw: null, state: 'PATROL' },
  walk: { armL: null, armR: null, legL: null, legR: null, curl: 0, lean: 0.05, duck: 0, crouch: 0, reach: 0, speed: 2.1, jaw: null, state: 'PATROL' },
  run: { armL: null, armR: null, legL: null, legR: null, curl: 0, lean: 0.35, duck: 0, crouch: 0, reach: 0, speed: 5.6, jaw: 0.6, state: 'CHASE' },
  crouch: { armL: null, armR: null, legL: 0, legR: 0, curl: 0, lean: 0, duck: 0, crouch: 1, reach: 0, speed: 0, jaw: null, state: 'CLOSET_CHECK' },
  reach: { armL: null, armR: null, legL: 0, legR: 0, curl: 0.2, lean: 0.1, duck: 0, crouch: 0, reach: 1, speed: 0, jaw: null, state: 'PATROL' },
  grab: { armL: -1.45, armR: -1.45, legL: 0, legR: 0, curl: 1, lean: 0.6, duck: 0, crouch: 0, reach: 0, speed: 0, jaw: 0.85, state: 'KILL' },
  scream: { armL: -0.3, armR: -0.3, legL: 0, legR: 0, curl: 0.6, lean: 0.75, duck: 0, crouch: 0, reach: 0, speed: 0, jaw: 0.9, state: 'KILL', headScale: 2, eyeScale: 2.4 },
  stare: { armL: null, armR: null, legL: 0, legR: 0, curl: 0, lean: 0.4, duck: 0, crouch: 0.5, reach: 0, speed: 0, jaw: 0.2, state: 'STARE' },
};
function dbgPose(name) { const p = DBG_POSES[name]; if (!p) return; dbgLabOn(true); Object.assign(DBG.lab, { headScale: 1, eyeScale: 1 }, p); }

/* ---------- frame hooks ---------- */
function dbgInput(inp) {
  DBG.lookX = inp.lx; DBG.lookY = inp.ly;
  if (DBG.cam.on) { inp.mx = 0; inp.mz = 0; inp.lx = 0; inp.ly = 0; inp.run = false; inp.interact = false; inp.use = false; inp.flash = false; inp.radar = false; inp.journal = false; inp.select = false; inp.confirm = false; inp.itemPrev = false; inp.itemNext = false; inp.cam = -1; }
}
function dbgCamOn(on) {
  const C = DBG.cam;
  if (on === C.on) return;
  C.on = on;
  if (on) { C.x = camera.position.x; C.y = camera.position.y; C.z = camera.position.z; C.yaw = camera.rotation.y; C.pitch = camera.rotation.x; C.fov = camera.fov; DBG.hideVM = true; dbgX.vmWas = true; }
  else { camera.fov = P.fov || 72; camera.updateProjectionMatrix(); if (dbgX.vmWas) DBG.hideVM = false; }
  dbgLog('free camera ' + (on ? 'ON  (WASD, Space/C, Shift, mouse, wheel=speed, [ ] fov)' : 'OFF'));
}
function dbgCamera(raw, camY) {
  const C = DBG.cam, k = DBG.keys;
  if (DBG.noclip && !C.on) DBG.flyY = clamp(DBG.flyY + ((k.Space ? 1 : 0) - (k.KeyC ? 1 : 0)) * 3 * raw, -1.5, 6);
  if (!C.on) return camY;
  C.yaw -= DBG.lookX; C.pitch = clamp(C.pitch - DBG.lookY, -1.55, 1.55);
  const turn = 1.7 * raw;
  if (k.ArrowLeft) C.yaw += turn; if (k.ArrowRight) C.yaw -= turn; if (k.ArrowUp) C.pitch = clamp(C.pitch + turn, -1.55, 1.55); if (k.ArrowDown) C.pitch = clamp(C.pitch - turn, -1.55, 1.55);
  if (k.BracketLeft) C.fov = clamp(C.fov - 30 * raw, 15, 120); if (k.BracketRight) C.fov = clamp(C.fov + 30 * raw, 15, 120);
  const sp = C.speed * (k.ShiftLeft || k.ShiftRight ? 3 : 1) * raw, cp = Math.cos(C.pitch);
  const fx = -Math.sin(C.yaw) * cp, fy = Math.sin(C.pitch), fz = -Math.cos(C.yaw) * cp, rx = Math.cos(C.yaw), rz = -Math.sin(C.yaw);
  const mx = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), mz = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), my = (k.Space ? 1 : 0) - (k.KeyC ? 1 : 0);
  C.x += (fx * mz + rx * mx) * sp; C.y += (fy * mz + my) * sp; C.z += (fz * mz + rz * mx) * sp;
  camera.position.set(C.x, C.y, C.z); camera.rotation.set(C.pitch, C.yaw, 0);
  if (camera.fov !== C.fov) { camera.fov = C.fov; camera.updateProjectionMatrix(); }
  return C.y;
}
function dbgWorld(dt) {
  if (!DBG.cam.on && DBG.fov > 0 && camera.fov !== DBG.fov) { camera.fov = DBG.fov; camera.updateProjectionMatrix(); }
  if (DBG.fullbright) ambient.intensity = Math.max(ambient.intensity, 1.1);
  if (DBG.amb >= 0) ambient.intensity = DBG.amb;
  if (DBG.fog >= 0) scene.fog.density = DBG.fog;
  if (DBG.cam.on && DBG.cam.lamp) {
    const C = DBG.cam, cp = Math.cos(C.pitch);
    flash.position.set(C.x, C.y, C.z); flash.target.position.set(C.x - Math.sin(C.yaw) * cp * 6, C.y + Math.sin(C.pitch) * 6, C.z - Math.cos(C.yaw) * cp * 6); flash.intensity = 2.2;
  }
  if (DBG.wire && !scene.overrideMaterial) { dbgX.wireMat = dbgX.wireMat || new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }); scene.overrideMaterial = dbgX.wireMat; }
  else if (!DBG.wire && scene.overrideMaterial === dbgX.wireMat && dbgX.wireMat) scene.overrideMaterial = null;
  if (DBG.infBreath) { breath.air = 1; breath.noise = 0; }
  if (DBG.lab.on) {                                                                                  // the animation lab drives the monster's pose
    const L = DBG.lab, o = mon.ov;
    DBG.freezeMon = true; mon.away = false; mon.grace = 999;
    o.armL = L.armL; o.armR = L.armR; o.legL = L.legL; o.legR = L.legR; o.curl = L.curl;
    mon.lean = L.lean; mon.headScale = L.headScale; mon.eyeScale = L.eyeScale; mon.duck = L.duck; mon.crouch = L.crouch; mon.reach = L.reach; mon.speedNow = L.speed; mon.state = L.state;
    if (L.spin) { mon.yaw += L.spin * dt; mon.wantYaw = mon.yaw; }
  }
  dbgGizmos();
}
function dbgGizmos() {
  const G = DBG.gizmos, any = G.colliders || G.monster || G.player || G.path;
  if (!dbgX.gz) {
    if (!any) return;
    dbgX.gz = { group: new THREE.Group(), col: null, mon: null, ply: null, link: null, path: null };
    const mk = (c) => new THREE.LineBasicMaterial({ color: c, depthTest: false, transparent: true });
    const lineGeo = (n) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); return g; };
    dbgX.gz.link = new THREE.Line(lineGeo(2), mk(0xff3030)); dbgX.gz.path = new THREE.Line(lineGeo(4), mk(0xffd000));
    const ring = (r, c) => { const pts = []; for (let i = 0; i <= 24; i++) pts.push(Math.cos(i / 24 * 6.2832) * r, 0, Math.sin(i / 24 * 6.2832) * r); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3)); return new THREE.Line(g, mk(c)); };
    dbgX.gz.mon = new THREE.Group(); dbgX.gz.mon.add(ring(0.55, 0xff3030)); const mr2 = ring(0.55, 0xff3030); mr2.position.y = 2.9; dbgX.gz.mon.add(mr2);
    dbgX.gz.ply = new THREE.Group(); dbgX.gz.ply.add(ring(0.3, 0x30ff60)); const pr2 = ring(0.3, 0x30ff60); pr2.position.y = 1.7; dbgX.gz.ply.add(pr2);
    [dbgX.gz.link, dbgX.gz.path, dbgX.gz.mon, dbgX.gz.ply].forEach((o) => { o.renderOrder = 9999; o.frustumCulled = false; dbgX.gz.group.add(o); });
    scene.add(dbgX.gz.group);
  }
  const Z = dbgX.gz;
  if (!Z) return;
  if (!any) { Z.group.visible = false; return; }                                                  // nothing enabled: draw nothing
  const sig = colliders.length + ':' + (G.colliders ? 1 : 0) + ':' + S.floor + ':' + S.seed;
  if (G.colliders && dbgX.gzSig !== sig) {                                                            // every collision box, as wireframe
    if (Z.col) { Z.group.remove(Z.col); }
    const pos = []; const add = (a, b) => pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    colliders.forEach((c) => { if (c.off) return; const y0 = 0.02, y1 = 2.2, p = [[c.minX, c.minZ], [c.maxX, c.minZ], [c.maxX, c.maxZ], [c.minX, c.maxZ]]; for (let i = 0; i < 4; i++) { const a = p[i], b = p[(i + 1) % 4]; add([a[0], y0, a[1]], [b[0], y0, b[1]]); add([a[0], y1, a[1]], [b[0], y1, b[1]]); add([a[0], y0, a[1]], [a[0], y1, a[1]]); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    Z.col = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x40a0ff, depthTest: false, transparent: true, opacity: 0.55 })); Z.col.renderOrder = 9998; Z.col.frustumCulled = false; Z.group.add(Z.col); dbgX.gzSig = sig;
  }
  if (Z.col) Z.col.visible = G.colliders;
  Z.mon.visible = G.monster && !mon.away; Z.mon.position.set(mon.x, (mon.gy || 0), mon.z);
  Z.ply.visible = G.player; Z.ply.position.set(P.x, (P.gy || 0), P.z);
  Z.link.visible = G.monster && !mon.away;
  if (Z.link.visible) { const a = Z.link.geometry.attributes.position.array; a[0] = mon.x; a[1] = 1.6; a[2] = mon.z; a[3] = P.x; a[4] = 1.6 + (P.gy || 0); a[5] = P.z; Z.link.geometry.attributes.position.needsUpdate = true; }
  Z.path.visible = G.path && !mon.away;
  if (Z.path.visible) { const a = Z.path.geometry.attributes.position.array, w = mon.wp || mon.src || mon.lastSeen; const wx = w && w.x != null ? w.x : mon.x, wz = w && w.z != null ? w.z : mon.z; a[0] = mon.x; a[1] = 0.3; a[2] = mon.z; a[3] = wx; a[4] = 0.3; a[5] = wz; a[6] = wx; a[7] = 0.3; a[8] = wz; a[9] = wx; a[10] = 3; a[11] = wz; Z.path.geometry.attributes.position.needsUpdate = true; }
  Z.group.visible = true;
}
function dbgCapture(scale) {
  const cv = renderer.domElement, sz = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio();
  let s = Math.max(1, scale | 0); while (s > 1 && Math.max(sz.x, sz.y) * pr * s > 8192) s--;
  const hideGz = dbgX.gz && dbgX.gz.group && !DBG.gizmos.inShots;
  if (hideGz) dbgX.gz.group.visible = false;
  if (s !== 1) { renderer.setPixelRatio(pr * s); renderer.setSize(sz.x, sz.y, false); }
  renderer.render(scene, camera); if (!DBG.hideVM && !DBG.cam.on) renderViewmodel();
  let url = '';
  try { url = cv.toDataURL('image/png'); } catch (e) { dbgLog('screenshot failed: ' + e.message, 'err'); }
  if (s !== 1) { renderer.setPixelRatio(pr); renderer.setSize(sz.x, sz.y, false); }
  if (hideGz) dbgX.gz.group.visible = true;
  if (!url) return;
  const d = new Date(), p2 = (n) => String(n).padStart(2, '0'), name = 'monochrome_' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '_' + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds()) + '.png';
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); if (a.remove) a.remove();
  dbgLog('screenshot saved: ' + name + ' (' + Math.round(sz.x * pr * s) + 'x' + Math.round(sz.y * pr * s) + ')', 'ok');
}
function dbgShot(scale) { dbgX.shotPending = 1; dbgX.shotScale = scale || DBG.shotScale; }
function dbgAfterRender(raw) {
  dbgX.frames++; dbgX.fpsT += raw;
  if (dbgX.fpsT >= 0.5) { DBG.fpsNow = dbgX.frames / dbgX.fpsT; dbgX.frames = 0; dbgX.fpsT = 0; if (dbgX.fpsEl) dbgX.fpsEl.textContent = DBG.fpsNow.toFixed(0) + ' FPS'; }
  if (dbgX.shotPending) { dbgX.shotPending = 0; dbgCapture(dbgX.shotScale); }
  if (DBG.panel) { const now = performance.now(); if (now - dbgX.last > 250) { dbgX.last = now; dbgRefresh(); } }
}
function dbgHideUI(on) {
  DBG.hideUI = on == null ? !DBG.hideUI : on;
  document.body.classList.toggle('dbg-hideui', DBG.hideUI); document.body.classList.toggle('dbg-keepfx', DBG.keepFx);
  dbgLog('UI ' + (DBG.hideUI ? 'hidden  (F2 to show)' : 'shown'));
}
function dbgPhoto(on) {
  if (on == null) on = !(DBG.hideUI && DBG.freeze && DBG.cam.on);
  dbgHideUI(on); DBG.freeze = on; dbgCamOn(on); DBG.hideVM = on; DBG.keepFx = on ? DBG.keepFx : false;
  if (on) { DBG.gizmos.player = false; if (DBG.panel) dbgPanel(false); }
}
function dbgPanel(on) {
  DBG.panel = on == null ? !DBG.panel : on;
  if (!dbgX.built) dbgBuild();
  dbgX.root.style.display = DBG.panel ? 'flex' : 'none';
  if (DBG.panel) { try { if (document.exitPointerLock) document.exitPointerLock(); } catch (e) { /* ignore */ } dbgRefresh(); }
}
function dbgSetTab(t) {
  dbgX.tab = t;
  Object.keys(dbgX.tabs).forEach((k) => { dbgX.tabs[k].btn.classList.toggle('on', k === t); dbgX.tabs[k].body.style.display = k === t ? 'block' : 'none'; });
  if (t === 'console' && dbgX.inEl) dbgX.inEl.focus();
}

/* ---------- console ---------- */
const dbgCmds = {
  help: { h: 'list the commands', f: () => { Object.keys(dbgCmds).forEach((k) => dbgLog(k.padEnd(10) + ' ' + dbgCmds[k].h, 'dim')); dbgLog('anything else you type is run as JavaScript inside the game (e.g.  S.keys = 3   or   mon.state)', 'dim'); } },
  god: { h: 'god [on|off]  monster cannot kill you', f: (a) => { DBG.god = a[0] ? a[0] === 'on' : !DBG.god; dbgLog('god mode ' + DBG.god); } },
  noclip: { h: 'noclip [on|off]  walk through walls (Space/C = up/down)', f: (a) => { DBG.noclip = a[0] ? a[0] === 'on' : !DBG.noclip; if (!DBG.noclip) DBG.flyY = 0; dbgLog('noclip ' + DBG.noclip); } },
  cam: { h: 'cam [on|off]  free camera', f: (a) => dbgCamOn(a[0] ? a[0] === 'on' : !DBG.cam.on) },
  hideui: { h: 'hideui  toggle the UI', f: () => dbgHideUI() },
  photo: { h: 'photo  hide UI + freeze + free camera', f: () => dbgPhoto() },
  shot: { h: 'shot [scale 1-4]  save a PNG', f: (a) => dbgShot(parseInt(a[0], 10) || DBG.shotScale) },
  freeze: { h: 'freeze  stop the game clock', f: () => { DBG.freeze = !DBG.freeze; dbgLog('freeze ' + DBG.freeze); } },
  timescale: { h: 'timescale <n>  0.05 .. 4', f: (a) => { DBG.timeScale = clamp(parseFloat(a[0]) || 1, 0.02, 6); dbgLog('timescale ' + DBG.timeScale); } },
  speed: { h: 'speed <n>  player speed multiplier', f: (a) => { DBG.speed = clamp(parseFloat(a[0]) || 1, 0.1, 10); dbgLog('player speed x' + DBG.speed); } },
  monspeed: { h: 'monspeed <n>  monster time multiplier', f: (a) => { DBG.monSpeed = clamp(parseFloat(a[0]) || 1, 0, 6); dbgLog('monster speed x' + DBG.monSpeed); } },
  tp: { h: 'tp <x> <z> | tp room <i> | tp safe|stairs|landing|mon|exit|key', f: (a) => { if (a[0] === 'room') { const c = dbgRoomCenter(parseInt(a[1], 10)); if (c) dbgTeleport(c.x, c.z); else dbgLog('no such room', 'err'); } else if (a.length === 2 && !isNaN(parseFloat(a[0]))) dbgTeleport(parseFloat(a[0]), parseFloat(a[1])); else dbgGoto(a[0]); } },
  bring: { h: 'bring [dist]  put the monster in front of you', f: (a) => dbgBring(a[0] ? parseFloat(a[0]) : 4) },
  floor: { h: 'floor <1|2>  change floor', f: (a) => dbgFloor(parseInt(a[0], 10) === 2 ? 2 : 1) },
  keys: { h: 'keys <n>  set keys', f: (a) => { S.keys = clamp(parseInt(a[0], 10) || 0, 0, 99); updateKeyUI(); } },
  allkeys: { h: 'allkeys', f: () => dbgAllKeys() },
  unlock: { h: 'unlock  open every padlock on the exit door', f: () => dbgUnlock() },
  give: { h: 'give <item> [n]  (items: see the PLAYER tab)', f: (a) => { if (!ITEM_DEFS[a[0]]) { dbgLog('items: ' + Object.keys(ITEM_DEFS).join(', '), 'err'); return; } const n = clamp(parseInt(a[1], 10) || 1, 1, 5); for (let i = 0; i < n; i++) invAdd(a[0]); } },
  reveal: { h: 'reveal  discover the whole map', f: () => { discovered.fill(1); dbgLog('map revealed'); } },
  doors: { h: 'doors open|close', f: (a) => { doors.forEach((d) => { d.target = a[0] === 'close' ? 0 : 1; }); } },
  mon: { h: 'mon state <S> | hide | freeze | grace <n> | away | tp | pose <name>', f: (a) => {
    const c = a[0];
    if (c === 'state') { mon.state = String(a[1] || 'PATROL').toUpperCase(); mon.wp = null; dbgLog('state ' + mon.state); }
    else if (c === 'hide') { DBG.hideMon = !DBG.hideMon; dbgLog('monster hidden ' + DBG.hideMon); }
    else if (c === 'freeze') { DBG.freezeMon = !DBG.freezeMon; dbgLog('monster frozen ' + DBG.freezeMon); }
    else if (c === 'grace') { mon.grace = parseFloat(a[1]) || 0; }
    else if (c === 'away') { mon.away = !mon.away; mon.awayT = 5; }
    else if (c === 'tp') dbgBring(4);
    else if (c === 'pose') { if (DBG_POSES[a[1]]) dbgPose(a[1]); else dbgLog('poses: ' + Object.keys(DBG_POSES).join(', '), 'err'); }
    else dbgLog('mon state <S> | hide | freeze | grace <n> | away | tp | pose <' + Object.keys(DBG_POSES).join('|') + '>', 'err');
  } },
  die: { h: 'die [stare|grab|push|drag]  play a jumpscare', f: (a) => dbgDeath(a[0]) },
  fall: { h: 'fall  the stairwell fall cutscene', f: () => { if (S.mode === 'play') startFall(); } },
  hide: { h: 'hide  hide in the nearest closet', f: () => dbgHide() },
  unhide: { h: 'unhide  leave the closet', f: () => { if (P.hiding) exitCloset(); } },
  fov: { h: 'fov <n>  (0 = game default)', f: (a) => { DBG.fov = clamp(parseFloat(a[0]) || 0, 0, 140); if (!DBG.fov) { camera.fov = P.fov || 72; camera.updateProjectionMatrix(); } } },
  fog: { h: 'fog <density>  (-1 = game default)', f: (a) => { DBG.fog = parseFloat(a[0]); if (isNaN(DBG.fog)) DBG.fog = -1; } },
  amb: { h: 'amb <level>  ambient light (-1 = game default)', f: (a) => { DBG.amb = parseFloat(a[0]); if (isNaN(DBG.amb)) DBG.amb = -1; } },
  bright: { h: 'bright  fullbright on/off', f: () => { DBG.fullbright = !DBG.fullbright; } },
  wire: { h: 'wire  wireframe world on/off', f: () => { DBG.wire = !DBG.wire; } },
  quality: { h: 'quality low|medium|high', f: (a) => { if (['low', 'medium', 'high'].indexOf(a[0]) < 0) { dbgLog('low | medium | high', 'err'); return; } Settings.quality = a[0]; Settings.save(); applyQuality(); } },
  shadows: { h: 'shadows hard|soft|off', f: (a) => { if (['hard', 'soft', 'off'].indexOf(a[0]) < 0) { dbgLog('hard | soft | off', 'err'); return; } Settings.shadows = a[0]; Settings.save(); applyShadowMode(a[0]); } },
  get: { h: 'get <expr>  print a value', f: (a) => dbgLog(a.join(' ') + ' = ' + dbgFmt(dbgInner(a.join(' '))), 'ok') },
  set: { h: 'set <expr> <value>   e.g.  set S.keys 3', f: (a) => { const v = a.pop(); dbgInner(a.join(' ') + ' = ' + v); dbgLog(a.join(' ') + ' = ' + dbgFmt(dbgInner(a.join(' '))), 'ok'); } },
  watch: { h: 'watch <expr>  show it live in the INFO tab', f: (a) => { DBG.watches.push(a.join(' ')); dbgLog('watching ' + a.join(' ')); } },
  unwatch: { h: 'unwatch  clear the watches', f: () => { DBG.watches.length = 0; } },
  clear: { h: 'clear  clear this console', f: () => { if (dbgX.logEl) dbgX.logEl.textContent = ''; } },
  restart: { h: 'restart  start a new game', f: () => beginGame() },
  menu: { h: 'menu  back to the main menu', f: () => toMenu() },
};
function dbgRun(line) {
  line = String(line || '').trim();
  if (!line) return;
  dbgLog('> ' + line, 'in');
  DBG.history.push(line); if (DBG.history.length > 80) DBG.history.shift(); DBG.hpos = DBG.history.length;
  const parts = line.split(/\s+/), c = parts[0].toLowerCase(), cmd = dbgCmds[c];
  try {
    if (cmd && (c === 'get' || c === 'set' || c === 'watch' || !/[=;(]/.test(line))) cmd.f(parts.slice(1));
    else { const r = dbgInner(line); dbgLog(dbgFmt(r), 'ok'); }
  } catch (e) { dbgLog('ERR ' + (e && e.message ? e.message : e), 'err'); }
}

/* ---------- the panel ---------- */
function dbgBuild() {
  dbgX.built = true;
  const css = document.createElement('style');
  css.textContent = '#dbg-root{position:fixed;top:0;right:0;bottom:0;width:372px;z-index:100000;display:none;flex-direction:column;background:rgba(8,8,8,.88);color:#ddd;font:12px/1.35 "Courier New",monospace;border-left:1px solid #666;user-select:none;-webkit-user-select:none}' +
    '#dbg-root.left{right:auto;left:0;border-left:0;border-right:1px solid #666}' +
    '#dbg-root .dh{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid #444;background:#111}#dbg-root .dh b{flex:1;letter-spacing:2px;color:#fff}' +
    '#dbg-root .tabs{display:flex;flex-wrap:wrap;border-bottom:1px solid #444}#dbg-root .tabs button{flex:1;background:#151515;color:#aaa;border:0;border-right:1px solid #333;padding:6px 2px;font:inherit;cursor:pointer}#dbg-root .tabs button.on{background:#333;color:#fff}' +
    '#dbg-root .body{flex:1;overflow:auto;padding:8px}#dbg-root .sec{margin:10px 0 4px;color:#fff;border-bottom:1px solid #444;letter-spacing:1px}#dbg-root .sec:first-child{margin-top:0}' +
    '#dbg-root .row{display:flex;align-items:center;gap:6px;margin:3px 0}#dbg-root .row label{flex:0 0 112px;color:#aaa}#dbg-root .row input[type=range]{flex:1;min-width:0}#dbg-root .row .v{flex:0 0 50px;text-align:right;color:#fff}' +
    '#dbg-root button.b{background:#222;color:#ddd;border:1px solid #555;padding:4px 8px;font:inherit;cursor:pointer;margin:2px 2px 2px 0}#dbg-root button.b:hover{background:#3a3a3a}#dbg-root button.b.on{background:#d8d8d8;color:#000}' +
    '#dbg-root select,#dbg-root input[type=text]{background:#111;color:#ddd;border:1px solid #555;font:inherit;padding:3px}#dbg-root pre{margin:0;white-space:pre-wrap;color:#cfcfcf}' +
    '#dbg-root .log{height:100%;min-height:200px;overflow:auto;background:#050505;border:1px solid #333;padding:4px;user-select:text;-webkit-user-select:text}#dbg-root .dl{white-space:pre-wrap;word-break:break-all}#dbg-root .dl.in{color:#fff}#dbg-root .dl.err{color:#ff7070}#dbg-root .dl.ok{color:#9fe69f}#dbg-root .dl.dim{color:#888}' +
    '#dbg-fps{position:fixed;top:4px;left:6px;z-index:100001;color:#9f9;font:12px "Courier New",monospace;background:rgba(0,0,0,.5);padding:1px 5px;display:none}' +
    'body.dbg-hideui>*:not(#viewport):not(#cut):not(#dbg-root):not(#dbg-fps){visibility:hidden!important}body.dbg-hideui.dbg-keepfx>#fx{visibility:visible!important}';
  document.head.appendChild(css);
  const root = dbgh('div'); root.id = 'dbg-root'; dbgX.root = root;
  const head = dbgh('div', 'dh'); head.appendChild(dbgh('b', '', 'DEBUG  ·  F3'));
  const dock = dbgh('button', 'b', 'DOCK'); dock.onclick = () => { root.classList.toggle('left'); dock.blur(); }; head.appendChild(dock);
  const close = dbgh('button', 'b', 'X'); close.onclick = () => dbgPanel(false); head.appendChild(close);
  root.appendChild(head);
  const tabs = dbgh('div', 'tabs'); root.appendChild(tabs);
  const defs = [['info', 'INFO'], ['player', 'PLAYER'], ['monster', 'MONSTER'], ['world', 'WORLD'], ['camera', 'CAMERA'], ['console', 'CONSOLE']];
  defs.forEach(([k, label]) => { const btn = dbgh('button', '', label), body = dbgh('div', 'body'); body.style.display = 'none'; btn.onclick = () => { dbgSetTab(k); btn.blur(); }; tabs.appendChild(btn); root.appendChild(body); dbgX.tabs[k] = { btn, body }; });
  const R = dbgX.refreshers;
  const sec = (body, t) => body.appendChild(dbgh('div', 'sec', t));
  const btn = (body, label, fn) => { const b = dbgh('button', 'b', label); b.onclick = () => { try { fn(); } catch (e) { dbgLog('ERR ' + e.message, 'err'); } b.blur(); }; body.appendChild(b); return b; };
  const tog = (body, label, get, set) => { const b = dbgh('button', 'b', label); b.onclick = () => { set(!get()); b.blur(); R.forEach((f) => f()); }; R.push(() => b.classList.toggle('on', !!get())); body.appendChild(b); return b; };
  const sld = (body, label, min, max, step, get, set, nullable) => {
    const row = dbgh('div', 'row'); row.appendChild(dbgh('label', '', label));
    const inp = document.createElement('input'); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; const v = dbgh('span', 'v', '');
    inp.oninput = () => { set(parseFloat(inp.value)); v.textContent = dbgFmt(parseFloat(inp.value)); inp.dragging = true; }; inp.onchange = () => { inp.dragging = false; inp.blur(); }; inp.onpointerup = () => { inp.blur(); };
    row.appendChild(inp); row.appendChild(v);
    if (nullable) { const a = dbgh('button', 'b', 'AUTO'); a.onclick = () => { set(null); a.blur(); }; row.appendChild(a); }
    R.push(() => { const cur = get(); if (!inp.dragging) inp.value = cur == null ? 0 : cur; v.textContent = cur == null ? 'auto' : dbgFmt(cur); });
    body.appendChild(row);
  };
  const sel = (body, label, opts, get, set) => {
    const row = dbgh('div', 'row'); row.appendChild(dbgh('label', '', label));
    const s = document.createElement('select'); opts.forEach((o) => { const op = document.createElement('option'); op.value = o; op.textContent = o; s.appendChild(op); });
    s.onchange = () => { set(s.value); s.blur(); }; row.appendChild(s); R.push(() => { if (document.activeElement !== s) s.value = get(); }); body.appendChild(row);
  };
  // ---- INFO
  let B = dbgX.tabs.info.body; dbgX.infoEl = dbgh('pre'); B.appendChild(dbgX.infoEl);
  sec(B, 'WATCHES  (console: watch <expr>)'); dbgX.watchEl = dbgh('pre'); B.appendChild(dbgX.watchEl);
  sec(B, 'OVERLAYS'); tog(B, 'FPS counter', () => DBG.fps, (v) => { DBG.fps = v; dbgX.fpsEl.style.display = v ? 'block' : 'none'; });
  tog(B, 'colliders', () => DBG.gizmos.colliders, (v) => { DBG.gizmos.colliders = v; }); tog(B, 'monster marker', () => DBG.gizmos.monster, (v) => { DBG.gizmos.monster = v; }); tog(B, 'monster path', () => DBG.gizmos.path, (v) => { DBG.gizmos.path = v; }); tog(B, 'player marker', () => DBG.gizmos.player, (v) => { DBG.gizmos.player = v; });
  // ---- PLAYER
  B = dbgX.tabs.player.body;
  sec(B, 'CHEATS'); tog(B, 'god mode', () => DBG.god, (v) => { DBG.god = v; }); tog(B, 'noclip + fly', () => DBG.noclip, (v) => { DBG.noclip = v; if (!v) DBG.flyY = 0; }); tog(B, 'infinite breath', () => DBG.infBreath, (v) => { DBG.infBreath = v; });
  tog(B, 'flashlight', () => P.flashOn, (v) => { P.flashOn = v; });
  sld(B, 'walk speed x', 0.2, 6, 0.1, () => DBG.speed, (v) => { DBG.speed = v; }); sld(B, 'time scale', 0.05, 3, 0.05, () => DBG.timeScale, (v) => { DBG.timeScale = v; }); tog(B, 'freeze time', () => DBG.freeze, (v) => { DBG.freeze = v; });
  sld(B, 'keys', 0, 14, 1, () => S.keys, (v) => { S.keys = v; updateKeyUI(); });
  btn(B, 'ALL KEYS', dbgAllKeys); btn(B, 'OPEN PADLOCKS', dbgUnlock); btn(B, 'REVEAL MAP', () => discovered.fill(1));
  sec(B, 'ITEMS'); Object.keys(ITEM_DEFS).forEach((k) => btn(B, '+ ' + ITEM_DEFS[k].name, () => invAdd(k))); btn(B, 'CLEAR', () => { inv.slots.length = 0; refreshHotbar(); });
  sec(B, 'TELEPORT'); btn(B, 'SAFE ROOM', () => dbgGoto('safe')); btn(B, 'STAIRS', () => dbgGoto('stairs')); btn(B, 'LANDING', () => dbgGoto('landing')); btn(B, 'NEXT KEY', () => dbgGoto('key')); btn(B, 'EXIT DOOR', () => dbgGoto('exit')); btn(B, 'TO MONSTER', () => dbgGoto('mon'));
  btn(B, 'FLOOR 1', () => dbgFloor(1)); btn(B, 'FLOOR 2', () => dbgFloor(2));
  const roomRow = dbgh('div', 'row'); roomRow.appendChild(dbgh('label', '', 'room')); const rs = document.createElement('select'); rs.onchange = () => { const c = dbgRoomCenter(parseInt(rs.value, 10)); if (c) dbgTeleport(c.x, c.z); rs.selectedIndex = 0; rs.blur(); };
  dbgX.roomSel = rs; roomRow.appendChild(rs); B.appendChild(roomRow);
  sec(B, 'PLAYER ANIMATIONS / SCENES'); btn(B, 'HIDE IN CLOSET', dbgHide); btn(B, 'LEAVE CLOSET', () => { if (P.hiding) exitCloset(); }); btn(B, 'FALL CUTSCENE', () => { if (S.mode === 'play') startFall(); }); btn(B, 'SCREEN FLASH', () => { S.flashT = 1; }); btn(B, 'GASP', () => Snd.gasp());
  ['stare', 'grab', 'push', 'drag'].forEach((t) => btn(B, 'DEATH: ' + t.toUpperCase(), () => dbgDeath(t))); btn(B, 'DEATH: RANDOM', () => dbgDeath(null));
  btn(B, 'NEW GAME', () => beginGame()); btn(B, 'MAIN MENU', () => toMenu());
  // ---- MONSTER
  B = dbgX.tabs.monster.body;
  sec(B, 'AI'); tog(B, 'freeze AI', () => DBG.freezeMon, (v) => { DBG.freezeMon = v; }); tog(B, 'hide monster', () => DBG.hideMon, (v) => { DBG.hideMon = v; }); tog(B, 'no detail anim', () => DBG.noDetail, (v) => { DBG.noDetail = v; });
  sld(B, 'AI speed x', 0, 4, 0.1, () => DBG.monSpeed, (v) => { DBG.monSpeed = v; });
  sel(B, 'state', ['PATROL', 'INVESTIGATE', 'CHASE', 'SEARCH', 'STARE', 'CLOSET_CHECK', 'LEAVE'], () => (DBG.lab.on ? DBG.lab.state : mon.state), (v) => { mon.state = v; DBG.lab.state = v; mon.wp = null; });
  btn(B, 'BRING (4m)', () => dbgBring(4)); btn(B, 'FRONT (2m)', () => dbgPlaceInFront(2)); btn(B, 'NO GRACE', () => { mon.grace = 0; }); btn(B, 'GRACE 12s', () => { mon.grace = 12; }); btn(B, 'SEND AWAY', () => { mon.away = true; mon.awayT = 15; mon.arrive = 'PATROL'; }); btn(B, 'RECALL', () => { mon.away = false; });
  sec(B, 'ANIMATION LAB  (pose the monster by hand)'); tog(B, 'LAB ON', () => DBG.lab.on, (v) => dbgLabOn(v));
  Object.keys(DBG_POSES).forEach((p) => btn(B, p.toUpperCase(), () => dbgPose(p)));
  btn(B, 'PLACE IN FRONT OF CAMERA', () => dbgPlaceInFront(3));
  const L = DBG.lab;
  sld(B, 'left arm', -2.6, 1.2, 0.02, () => L.armL, (v) => { dbgLabOn(true); L.armL = v; }, true); sld(B, 'right arm', -2.6, 1.2, 0.02, () => L.armR, (v) => { dbgLabOn(true); L.armR = v; }, true);
  sld(B, 'left leg', -1, 1, 0.02, () => L.legL, (v) => { dbgLabOn(true); L.legL = v; }, true); sld(B, 'right leg', -1, 1, 0.02, () => L.legR, (v) => { dbgLabOn(true); L.legR = v; }, true);
  sld(B, 'finger curl', 0, 1.2, 0.02, () => L.curl, (v) => { dbgLabOn(true); L.curl = v; }); sld(B, 'lean', -0.3, 1.2, 0.01, () => L.lean, (v) => { dbgLabOn(true); L.lean = v; });
  sld(B, 'crouch', 0, 1, 0.01, () => L.crouch, (v) => { dbgLabOn(true); L.crouch = v; }); sld(B, 'duck', 0, 1, 0.01, () => L.duck, (v) => { dbgLabOn(true); L.duck = v; }); sld(B, 'reach', 0, 1, 0.01, () => L.reach, (v) => { dbgLabOn(true); L.reach = v; });
  sld(B, 'head size', 0.5, 3, 0.02, () => L.headScale, (v) => { dbgLabOn(true); L.headScale = v; }); sld(B, 'eye size', 0.3, 3, 0.02, () => L.eyeScale, (v) => { dbgLabOn(true); L.eyeScale = v; });
  sld(B, 'jaw', 0, 1.1, 0.01, () => L.jaw, (v) => { dbgLabOn(true); L.jaw = v; }, true); sld(B, 'walk speed', 0, 7, 0.1, () => L.speed, (v) => { dbgLabOn(true); L.speed = v; }); sld(B, 'turntable', -2, 2, 0.05, () => L.spin, (v) => { dbgLabOn(true); L.spin = v; });
  sec(B, 'JUMPSCARES'); ['stare', 'grab', 'push'].forEach((t) => btn(B, t.toUpperCase(), () => dbgDeath(t))); btn(B, 'DRAG (hide first)', () => dbgDeath('drag'));
  // ---- WORLD
  B = dbgX.tabs.world.body;
  sec(B, 'LIGHT & LOOK'); tog(B, 'fullbright', () => DBG.fullbright, (v) => { DBG.fullbright = v; }); tog(B, 'wireframe', () => DBG.wire, (v) => { DBG.wire = v; });
  sld(B, 'ambient', 0, 2, 0.02, () => (DBG.amb < 0 ? ambient.intensity : DBG.amb), (v) => { DBG.amb = v; }); btn(B, 'AMBIENT AUTO', () => { DBG.amb = -1; });
  sld(B, 'fog density', 0, 0.12, 0.002, () => (DBG.fog < 0 ? scene.fog.density : DBG.fog), (v) => { DBG.fog = v; }); btn(B, 'FOG AUTO', () => { DBG.fog = -1; });
  sld(B, 'field of view', 30, 120, 1, () => (DBG.fov || camera.fov), (v) => { DBG.fov = v; }); btn(B, 'FOV AUTO', () => { DBG.fov = 0; camera.fov = P.fov || 72; camera.updateProjectionMatrix(); });
  sec(B, 'QUALITY'); sel(B, 'quality', ['low', 'medium', 'high'], () => Settings.quality, (v) => { Settings.quality = v; Settings.save(); applyQuality(); }); sel(B, 'shadows', ['hard', 'soft', 'off'], () => Settings.shadows, (v) => { Settings.shadows = v; Settings.save(); applyShadowMode(v); });
  sec(B, 'WORLD'); btn(B, 'OPEN ALL DOORS', () => doors.forEach((d) => { d.target = 1; })); btn(B, 'CLOSE ALL DOORS', () => doors.forEach((d) => { d.target = 0; })); btn(B, 'REVEAL MAP', () => discovered.fill(1)); btn(B, 'NEW GAME / NEW SEED', () => beginGame());
  // ---- CAMERA
  B = dbgX.tabs.camera.body;
  sec(B, 'FREE CAMERA  (F4)'); tog(B, 'free camera', () => DBG.cam.on, (v) => dbgCamOn(v)); tog(B, 'lamp on camera', () => DBG.cam.lamp, (v) => { DBG.cam.lamp = v; });
  sld(B, 'speed', 0.5, 40, 0.5, () => DBG.cam.speed, (v) => { DBG.cam.speed = v; }); sld(B, 'field of view', 15, 120, 1, () => DBG.cam.fov, (v) => { DBG.cam.fov = v; });
  btn(B, 'LOOK AT MONSTER', () => { const C = DBG.cam; if (!C.on) dbgCamOn(true); const dx = mon.x - C.x, dz = mon.z - C.z, dy = 1.8 - C.y; C.yaw = Math.atan2(-dx, -dz); C.pitch = Math.atan2(dy, Math.hypot(dx, dz)); });
  btn(B, 'CAMERA TO MONSTER FACE', () => { const C = DBG.cam; if (!C.on) dbgCamOn(true); C.x = mon.x - Math.sin(mon.yaw) * 1.5; C.z = mon.z - Math.cos(mon.yaw) * 1.5; C.y = 2.7; C.yaw = mon.yaw + Math.PI; C.pitch = -0.05; });
  btn(B, 'SNAP TO PLAYER', () => { const C = DBG.cam; C.x = P.x; C.y = EYE_H + (P.gy || 0); C.z = P.z; C.yaw = P.yaw; C.pitch = P.pitch; });
  sec(B, 'SCREENSHOTS  (F9)'); sel(B, 'resolution', ['x1', 'x2', 'x3', 'x4'], () => 'x' + DBG.shotScale, (v) => { DBG.shotScale = parseInt(v.slice(1), 10); });
  btn(B, 'TAKE SCREENSHOT', () => dbgShot()); tog(B, 'markers in shots', () => DBG.gizmos.inShots, (v) => { DBG.gizmos.inShots = v; });
  sec(B, 'UI  (F2)'); tog(B, 'hide UI', () => DBG.hideUI, (v) => dbgHideUI(v)); tog(B, 'keep film grain', () => DBG.keepFx, (v) => { DBG.keepFx = v; document.body.classList.toggle('dbg-keepfx', v); }); tog(B, 'hide held items', () => DBG.hideVM, (v) => { DBG.hideVM = v; });
  btn(B, 'PHOTO MODE (all of it)', () => dbgPhoto());
  B.appendChild(dbgh('pre', '', '\nPhoto mode: hides the UI and the panel, freezes the game and opens the free camera.\nF3 brings the panel back.  Screenshots are the 3D view only (film grain / vignette overlays are not in the PNG).'));
  // ---- CONSOLE
  B = dbgX.tabs.console.body; B.style.display = 'none'; B.style.padding = '6px';
  dbgX.logEl = dbgh('div', 'log'); dbgX.logEl.style.height = 'calc(100vh - 150px)'; B.appendChild(dbgX.logEl);
  const inp = document.createElement('input'); inp.type = 'text'; inp.placeholder = 'command or JavaScript — help'; inp.style.cssText = 'width:100%;box-sizing:border-box;margin-top:6px'; inp.autocomplete = 'off'; inp.spellcheck = false; dbgX.inEl = inp;
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { dbgRun(inp.value); inp.value = ''; e.preventDefault(); }
    else if (e.key === 'ArrowUp') { if (DBG.hpos > 0) { DBG.hpos--; inp.value = DBG.history[DBG.hpos] || ''; } e.preventDefault(); }
    else if (e.key === 'ArrowDown') { if (DBG.hpos < DBG.history.length) { DBG.hpos++; inp.value = DBG.history[DBG.hpos] || ''; } e.preventDefault(); }
    else if (e.key === 'Escape') { inp.blur(); }
    e.stopPropagation();
  });
  B.appendChild(inp);
  document.body.appendChild(root);
  const fps = dbgh('div'); fps.id = 'dbg-fps'; document.body.appendChild(fps); dbgX.fpsEl = fps;
  dbgLog('Monochrome debug console.  Type help.  Anything that is not a command runs as JavaScript inside the game.', 'dim');
  dbgSetTab('info');
}
function dbgRefresh() {
  if (!dbgX.built) return;
  if (dbgX.roomSel && dbgX.roomSel.childNodes && dbgX.roomSel.childNodes.length !== rooms.length + 1) {
    dbgX.roomSel.textContent = ''; const o0 = document.createElement('option'); o0.textContent = '(go to…)'; dbgX.roomSel.appendChild(o0);
    rooms.forEach((r, i) => { const o = document.createElement('option'); o.value = i; o.textContent = i + ': ' + (r.name || 'room'); dbgX.roomSel.appendChild(o); });
  }
  dbgX.refreshers.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
  if (dbgX.tab !== 'info') return;
  const f2 = (n) => (typeof n === 'number' ? n.toFixed(2) : String(n)), ri = renderer.info && renderer.info.render ? renderer.info.render : { calls: 0, triangles: 0 }, mi = renderer.info && renderer.info.memory ? renderer.info.memory : { geometries: 0, textures: 0 };
  const rm = rooms.find((r) => P.x >= r.x0 * TILE && P.x < (r.x1 + 1) * TILE && P.z >= r.z0 * TILE && P.z < (r.z1 + 1) * TILE);
  const lines = [
    'FPS ' + DBG.fpsNow.toFixed(0) + '   frame ' + (1000 / Math.max(1, DBG.fpsNow)).toFixed(1) + ' ms   draw calls ' + ri.calls + '   tris ' + ri.triangles,
    'geometries ' + mi.geometries + '   textures ' + mi.textures + '   colliders ' + colliders.length + '   lamps ' + lamps.length,
    'mode ' + S.mode + '   act ' + S.act + '   floor ' + S.floor + '   seed ' + S.seed + '   time ' + S.time.toFixed(1),
    'quality ' + Settings.quality + '   shadows ' + Settings.shadows + '   xr ' + (VR.active ? 'on' : 'off'),
    '',
    'PLAYER  x ' + f2(P.x) + '  z ' + f2(P.z) + '  y ' + f2(P.gy || 0),
    '  yaw ' + f2(P.yaw) + '  pitch ' + f2(P.pitch) + '  fov ' + f2(camera.fov),
    '  tile ' + tileOf(P.x) + ',' + tileOf(P.z) + '  zone ' + zoneAt(P.x, P.z) + '  room ' + (rm ? rm.name : '-') + '  safe ' + !!P.safe,
    '  moving ' + !!P.moving + '  running ' + !!P.running + '  hiding ' + !!P.hiding + '  flash ' + !!P.flashOn,
    '  keys ' + S.keys + '/' + TOTAL_KEYS + '  locks ' + S.locks + '  air ' + f2(breath.air) + '  noise ' + f2(breath.noise) + '  tension ' + f2(S.tension || 0),
    '',
    'MONSTER  state ' + mon.state + '  away ' + !!mon.away + (mon.away ? ' (' + f2(mon.awayT) + 's)' : ''),
    '  x ' + f2(mon.x) + '  z ' + f2(mon.z) + '  yaw ' + f2(mon.yaw) + '  dist ' + f2(mon.dist),
    '  sees ' + !!mon.sees + '  grace ' + f2(mon.grace) + '  speed ' + f2(mon.speedNow) + '  lean ' + f2(mon.lean),
    '  reach ' + f2(mon.reach) + '  duck ' + f2(mon.duck) + '  crouch ' + f2(mon.crouch || 0) + '  jaw ' + (monMesh ? f2(monMesh.jaw.rotation.x) : '-') + '  hunt ' + (monMesh ? f2(monMesh.k) : '-'),
    '',
    'CAMERA  free ' + DBG.cam.on + '  x ' + f2(camera.position.x) + ' y ' + f2(camera.position.y) + ' z ' + f2(camera.position.z),
    'flags  god ' + DBG.god + '  noclip ' + DBG.noclip + '  freeze ' + DBG.freeze + '  timescale ' + DBG.timeScale + '  lab ' + DBG.lab.on,
  ];
  dbgX.infoEl.textContent = lines.join('\n');
  dbgX.watchEl.textContent = DBG.watches.map((w) => { let v; try { v = dbgFmt(dbgInner(w)); } catch (e) { v = 'ERR ' + e.message; } return w + ' = ' + v; }).join('\n') || '(none)';
}
function dbgInit() {
  window.addEventListener('keydown', (e) => {
    const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') && t.type !== 'range';
    DBG.keys[e.code] = true;
    if (e.code === 'F3') { dbgPanel(); e.preventDefault(); }
    else if (e.code === 'F4') { dbgCamOn(!DBG.cam.on); e.preventDefault(); }
    else if (e.code === 'F2') { dbgHideUI(); e.preventDefault(); }
    else if (e.code === 'F9') { dbgShot(); e.preventDefault(); }
    else if (e.code === 'Backquote' && !typing) { if (!DBG.panel) dbgPanel(true); dbgSetTab('console'); e.preventDefault(); }
  }, true);
  window.addEventListener('keyup', (e) => { DBG.keys[e.code] = false; }, true);
  window.addEventListener('blur', () => { DBG.keys = {}; });
  window.addEventListener('wheel', (e) => { if (DBG.cam.on && !(e.target && e.target.closest && e.target.closest('#dbg-root'))) { DBG.cam.speed = clamp(DBG.cam.speed * (e.deltaY < 0 ? 1.2 : 1 / 1.2), 0.3, 80); e.preventDefault(); } }, { passive: false });
}

/* ======================================================================
   CONTROLS  ·  rebindable keyboard   (Settings -> Controls)
   ====================================================================== */
const BIND_DEFS = [
  ['moveF', 'Move forward', 'KeyW'], ['moveB', 'Move back', 'KeyS'], ['moveL', 'Move left', 'KeyA'], ['moveR', 'Move right', 'KeyD'],
  ['run', 'Run', 'ShiftLeft'], ['breath', 'Hold breath', 'Space'],
  ['interact', 'Interact  /  hold to zoom the tablet', 'KeyF'], ['flash', 'Flashlight', 'KeyG'],
  ['tablet', 'Tablet: take out / put away', 'KeyR'], ['screenPrev', 'Tablet: previous screen / camera', 'KeyQ'], ['screenNext', 'Tablet: next screen / camera', 'KeyE'],
  ['journal', 'Tablet: open the map', 'KeyJ'], ['use', 'Use the selected item', 'KeyV'],
  ['itemPrev', 'Previous item', 'KeyZ'], ['itemNext', 'Next item', 'KeyX'], ['pause', 'Pause', 'KeyP'],
];
const BIND = {};
const BIND_BLOCKED = ['Escape', 'Tab', 'Enter', 'NumpadEnter', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'Backspace', 'Delete', 'MetaLeft', 'MetaRight', 'ContextMenu'];
function bindLoad() { BIND_DEFS.forEach((d) => { const v = Settings.binds && Settings.binds[d[0]]; BIND[d[0]] = typeof v === 'string' ? v : d[2]; }); }
const bindCode = (a) => BIND[a];
function codeLabel(c) {
  if (!c) return 'NONE';
  const m = /^Key([A-Z])$/.exec(c); if (m) return m[1];
  const d = /^Digit(\d)$/.exec(c); if (d) return d[1];
  const map = { Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT', ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\' };
  return map[c] || c.replace(/^Numpad/, 'NUM ').toUpperCase();
}
function bindSet(action, code) {
  if (code && BIND_BLOCKED.indexOf(code) >= 0) return false;
  if (!Settings.binds) Settings.binds = {};
  if (code) for (const k in BIND) if (k !== action && BIND[k] === code) { BIND[k] = BIND[action]; Settings.binds[k] = BIND[k]; }       // a key that is taken: swap
  BIND[action] = code; Settings.binds[action] = code; Settings.save();
  return true;
}
function bindReset() { Settings.binds = {}; bindLoad(); Settings.save(); }
let ctlWait = null;
function ctlBuild() {
  const host = el['ctl-list']; if (!host) return;
  host.textContent = '';
  BIND_DEFS.forEach((d) => {
    const lb = document.createElement('label'); lb.textContent = d[1];
    const b = document.createElement('button'); b.type = 'button'; b.className = 'key'; b.dataset.action = d[0];
    b.addEventListener('click', () => { if (ctlWait) ctlWait.btn.classList.remove('wait'); ctlWait = { action: d[0], btn: b }; b.classList.add('wait'); b.textContent = 'PRESS A KEY…'; Snd.click(); });
    host.appendChild(lb); host.appendChild(b);
  });
  ctlRefresh();
}
function ctlRefresh() {
  const host = el['ctl-list']; if (!host || !host.children) return;
  for (let i = 0; i < host.children.length; i++) {
    const b = host.children[i];
    if (!b.dataset || !b.dataset.action) continue;
    const code = BIND[b.dataset.action];
    b.textContent = codeLabel(code); b.classList.remove('wait'); b.classList.toggle('none', !code);
  }
  keyHintsRefresh();
}
function ctlKey(e) {
  if (!ctlWait) return false;
  e.preventDefault(); e.stopPropagation();
  const w = ctlWait; ctlWait = null;
  if (e.code === 'Escape') { ctlRefresh(); return true; }
  if (e.code === 'Backspace' || e.code === 'Delete') { bindSet(w.action, ''); ctlRefresh(); Snd.click(); return true; }
  if (!bindSet(w.action, e.code)) { toast('THAT KEY IS RESERVED', 1400); }
  ctlRefresh(); Snd.key();
  return true;
}
function ctlInit() {
  bindLoad(); ctlBuild();
  window.addEventListener('keydown', ctlKey, true);
  if (el['btn-ctl-back']) el['btn-ctl-back'].addEventListener('click', () => { ctlWait = null; closeModals(); if (S.mode === 'menu') openModal('settings'); });
  if (el['btn-ctl-reset']) el['btn-ctl-reset'].addEventListener('click', () => { bindReset(); ctlRefresh(); Snd.click(); });
}
const bindHint = (a) => '[' + codeLabel(bindCode(a)) + ']';

/* ======================================================================
   THE TABLET  ·  replaces the big radar, the clipboard map and the remote camera view
   R takes it out / puts it away · Q / E switch screens (MAP · RADAR · CAMERAS) · hold the interact key to zoom in
   Cameras screen: press the interact key to zoom in (it stays locked), Q / E then switch cameras
   ====================================================================== */
const TAB_W = 960, TAB_H = 720, TAB_HDR = 64, TAB_NAMES = ['MAP', 'RADAR', 'CAMERAS'];
const TAB = {
  built: false, open: false, t: 0, zoom: 0, lock: false, hold: false, screen: 1, from: 1, sT: 1, dir: 1, boot: 1, kick: 0, drawAcc: 9, force: true,
  cv: null, g: null, tex: null, root: null, dev: null, uiPlane: null, camPlane: null, camMat: null, led: null, glare: null,
  mapCv: null, mapSig: '', scan: null, camT: 0, shown: -1,
};
const TAB_COL = [0xbfd8ff, 0x4dff88, 0xffffff];
const tabFont = (px) => px + 'px VT323, "Courier New", monospace';

function tabletBuild() {
  const T = TAB;
  T.cv = document.createElement('canvas'); T.cv.width = TAB_W; T.cv.height = TAB_H; T.g = T.cv.getContext('2d');
  T.tex = new THREE.CanvasTexture(T.cv); T.tex.minFilter = THREE.LinearFilter; T.tex.generateMipmaps = false;
  T.mapCv = document.createElement('canvas'); T.mapCv.width = TAB_W; T.mapCv.height = TAB_H - TAB_HDR;
  T.scan = document.createElement('canvas'); T.scan.width = 4; T.scan.height = 4;
  { const sg = T.scan.getContext('2d'); sg.fillStyle = 'rgba(0,0,0,0.5)'; sg.fillRect(0, 0, 4, 1); }
  const ph = (c, o) => new THREE.MeshPhongMaterial(Object.assign({ color: c, shininess: 55, specular: 0x555555 }, o || {}));
  const bas = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {}));
  T.root = new THREE.Group(); vmScene.add(T.root);
  const dev = new THREE.Group(); T.root.add(dev); T.dev = dev;
  const part = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); dev.add(m); return m; };
  const rim = ph(0x303030, { shininess: 90, specular: 0x888888 }), body = ph(0x121212);
  part(new THREE.BoxGeometry(0.456, 0.346, 0.011), rim, 0, 0, -0.0045);                       // aluminium shell
  part(new THREE.BoxGeometry(0.444, 0.334, 0.021), body, 0, 0, 0.0005);                       // front body
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) part(new THREE.CylinderGeometry(0.009, 0.009, 0.022, 10), rim, sx * 0.219, sy * 0.164, 0.0005).rotation.x = Math.PI / 2;   // rounded corners
  part(new THREE.PlaneGeometry(0.43, 0.32), bas(0x020202), 0, 0, 0.0112);                      // glass bezel
  T.camMat = bas(0xffffff, { map: feedRT.texture });
  T.camPlane = part(new THREE.PlaneGeometry(0.38, 0.285), T.camMat, 0, 0, 0.0114); T.camPlane.visible = false;
  T.uiPlane = part(new THREE.PlaneGeometry(0.38, 0.285), bas(0xffffff, { map: T.tex, transparent: true }), 0, 0, 0.0118);
  const gl = document.createElement('canvas'); gl.width = 64; gl.height = 64; { const q = gl.getContext('2d'), gr = q.createLinearGradient(0, 0, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.42, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.09)'); gr.addColorStop(0.62, 'rgba(255,255,255,0.0)'); q.fillStyle = gr; q.fillRect(0, 0, 64, 64); }
  T.glare = part(new THREE.PlaneGeometry(0.38, 0.285), bas(0xffffff, { map: new THREE.CanvasTexture(gl), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 0, 0.0122);
  part(new THREE.CircleGeometry(0.0042, 12), bas(0x1a2330), 0, 0.1535, 0.0113);                // front camera
  part(new THREE.RingGeometry(0.0042, 0.0058, 12), bas(0x444444), 0, 0.1535, 0.0114);
  part(new THREE.BoxGeometry(0.034, 0.007, 0.008), rim, 0.12, 0.1735, 0.0);                    // power button
  part(new THREE.BoxGeometry(0.007, 0.03, 0.008), rim, 0.2265, 0.07, 0.0); part(new THREE.BoxGeometry(0.007, 0.03, 0.008), rim, 0.2265, 0.03, 0.0);   // volume
  T.led = part(new THREE.BoxGeometry(0.1, 0.0035, 0.002), bas(0x4dff88), 0, -0.1535, 0.0114);  // status strip
  const hl = buildHand(false, 0.016, 0.17, true); hl.position.set(-0.234, -0.03, 0); attachArm(hl, new THREE.Vector3(-0.3, -0.5, 0.8)); dev.add(hl);
  const hr = buildHand(true, 0.016, 0.17, true); hr.position.set(0.234, -0.03, 0); attachArm(hr, new THREE.Vector3(0.3, -0.55, 0.75)); dev.add(hr);
  T.root.visible = false; T.built = true;
}

/* ---------- opening, closing, switching ---------- */
function tabletOpen(screen) {
  const T = TAB;
  if (!T.built || VR.active) return;
  if (screen != null && screen !== T.screen) { T.from = T.screen; T.screen = screen; T.sT = 1; T.dir = 1; }
  if (!T.open) { T.open = true; T.boot = 0; T.force = true; Snd.tabOn(); if (T.screen === 1) radar.pingT = 0.25; if (T.screen === 2) S.camStatic = 0.7; }
  else if (screen != null) { T.force = true; Snd.tabSwitch(); }
  T.lock = false; tabletFlags();
}
function tabletClose(silent) {
  const T = TAB;
  if (!T.open) return;
  T.open = false; T.lock = false; T.hold = false; if (!silent) Snd.tabOff();
  tabletCamAudio(false); tabletFlags();
}
function tabletFlags() { const T = TAB; if (VR.active) return; radar.up = T.open && T.screen === 1; S.mapUp = T.open && T.screen === 0; if (document.body && document.body.classList) document.body.classList.toggle('tablet-up', T.open); }
function tabletGo(dir) {
  const T = TAB, n = TAB_NAMES.length;
  T.from = T.screen; T.screen = (T.screen + dir + n) % n; T.sT = 0; T.dir = dir; T.kick = 1; T.force = true; T.lock = false;
  Snd.tabSwitch(); if (T.screen === 1) radar.pingT = 0.25; if (T.screen === 2) S.camStatic = 0.7;
  tabletCamAudio(false); tabletFlags();
}
function tabletCamAudio(on) {
  if (S.act !== 2) return;
  if (on && !S.monitorOn) { S.monitorOn = true; Snd.monitor(true, cams[S.camSel]); }
  else if (!on && S.monitorOn && S.mode !== 'laptop') { S.monitorOn = false; Snd.monitor(false); }
}
// called from updatePlayer (play mode): keys, zoom, camera switching. Eats the keys so the world does not react to them.
function tabletInput(inp) {
  const T = TAB;
  if (VR.active || !T.built) return;
  if (inp.radar) { if (T.open) tabletClose(); else tabletOpen(T.screen); }
  if (inp.journal) { if (T.open && T.screen === 0) tabletClose(); else tabletOpen(0); }
  if (!T.open) { T.hold = false; return; }
  const camsZoomed = T.screen === 2 && T.lock;
  if (camsZoomed) {
    const n = cams.length;
    if (inp.sPrev && n) selectCam((S.camSel + n - 1) % n);
    if (inp.sNext && n) selectCam((S.camSel + 1) % n);
    if (inp.cam >= 0 && inp.cam < n) selectCam(inp.cam);
  } else { if (inp.sPrev) tabletGo(-1); if (inp.sNext) tabletGo(1); }
  if (T.screen === 2) {
    T.hold = false;
    if (inp.interact) { T.lock = !T.lock; Snd.tabSwitch(); tabletCamAudio(T.lock); T.force = true; }
    else if (T.lock && inp.back) { T.lock = false; tabletCamAudio(false); }
  } else T.hold = !!inp.hold;
  inp.interact = false; inp.sPrev = false; inp.sNext = false; if (camsZoomed) inp.cam = -1;
}

/* ---------- per-frame: animation, flags, the live camera ---------- */
function updateTablet(dt, bx, by) {
  const T = TAB;
  if (!T.built) return;
  const playing = S.mode === 'play' || S.mode === 'paused';
  if (!playing && T.open) tabletClose(true);
  T.t = approach(T.t, T.open ? 1 : 0, dt * (T.open ? 2.4 : 3.2));
  const zt = T.open && (T.screen === 2 ? T.lock : T.hold) ? 1 : 0;
  T.zoom = approach(T.zoom, zt, dt * 3.3);
  if (T.sT < 1) T.sT = Math.min(1, T.sT + dt / 0.4);
  if (T.boot < 1) T.boot = Math.min(1, T.boot + dt / 0.7);
  T.kick = Math.max(0, T.kick - dt * 4.2);
  if (T.open !== (document.body.classList && document.body.classList.contains('tablet-up'))) tabletFlags();
  if (T.open && !VR.active) { radar.up = T.screen === 1 && T.t > 0.3; S.mapUp = T.screen === 0 && T.t > 0.3; }
  T.root.visible = T.t > 0.012;
  if (!T.root.visible) return;
  const eR = easeOut(T.t), zz = T.zoom * T.zoom * (3 - 2 * T.zoom), zoomZ = -0.322;
  const halfW = Math.abs(zoomZ) * Math.tan(29 * Math.PI / 180) * vmCam.aspect, s = clamp(2 * halfW * 0.9 / 0.456, 0.3, 1);
  const hx = vm.sx * 1.2 + bx * 1.2, hy = -0.125 + vm.sy + by * 1.2;
  const x = lerp(hx, 0, zz) + T.kick * T.dir * 0.016, y = lerp(hy, -0.004, zz) - (1 - eR) * 0.66, z = lerp(-0.5, zoomZ, zz) + (1 - eR) * 0.08;
  const rx = lerp(-0.46 + vm.sy * 2, 0, zz) + (1 - eR) * 0.8 + T.kick * 0.05, ry = lerp(-vm.sx * 2 + Math.sin(S.time * 0.7) * 0.012, 0, zz) + T.kick * T.dir * 0.16, rz = lerp(bx * 1.5, 0, zz);
  T.root.position.set(x, y, z); T.root.rotation.set(rx, ry, rz);
  const sc = lerp(0.84, s, zz) * (0.92 + 0.08 * eR); T.root.scale.set(sc, sc, sc);
  vmGlow.color.setHex(TAB_COL[T.screen]);
  vmGlow.position.set(x, y + 0.08, z + 0.22); vmGlow.intensity = 0.5 * eR * (T.screen === 1 ? 0.8 + 0.2 * radar.flash : 1);
  T.led.material.color.setHex(TAB_COL[T.screen]);
  tabletCam(dt);
  tabletDraw(dt);
}
function tabletCam(dt) {
  const T = TAB, onCams = T.screen === 2 && T.sT >= 1 && T.boot >= 1;
  T.camPlane.visible = onCams;
  if (!onCams) { T.shown = -1; return; }
  if (S.camStatic > 0) S.camStatic -= dt;
  if (S.act === 2) { drawAudioScreen(); T.camMat.map = audioScreen.tex; tabletCamAudio(T.lock); }
  else if (S.camStatic > 0) { drawStaticNoise(); T.camMat.map = staticTex; }
  else { renderFeed(); T.camMat.map = feedRT.texture; }
  T.camMat.needsUpdate = true;
}

/* ---------- drawing the screen ---------- */
function tabletDraw(dt) {
  const T = TAB, zoomCam = T.screen === 2 && T.lock && T.zoom > 0.5;
  T.drawAcc += dt;
  const iv = (T.sT < 1 || T.boot < 1) ? 0 : (T.screen === 1 ? 1 / 30 : (T.screen === 0 ? 1 / 14 : 1 / 15));
  if (T.drawAcc < iv && !T.force && zoomCam === T.hdrOff) return;
  T.drawAcc = 0; T.force = false; T.hdrOff = zoomCam;
  const g = T.g, W = TAB_W, H = TAB_H, y0 = zoomCam ? 0 : TAB_HDR;
  g.clearRect(0, 0, W, H);
  if (T.boot < 1) tabBoot(g, W, H, T.boot);
  else if (T.sT < 1) {
    const e = T.sT * T.sT * (3 - 2 * T.sT), wipe = Math.round(W * e);
    tabScreen(g, T.from, W, H, y0, true);
    g.save(); g.beginPath(); if (T.dir > 0) g.rect(W - wipe, 0, wipe, H); else g.rect(0, 0, wipe, H); g.clip();
    tabScreen(g, T.screen, W, H, y0, true); g.restore();
    const lx = T.dir > 0 ? W - wipe : wipe;                                                               // the bright scan edge
    const gr = g.createLinearGradient(lx - 30, 0, lx + 30, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(lx - 30, 0, 60, H);
  } else tabScreen(g, T.screen, W, H, y0, false);
  if (!zoomCam) tabHeader(g, W);
  // glass: scanlines + vignette + tiny flicker
  g.globalAlpha = 0.16; g.fillStyle = g.createPattern(T.scan, 'repeat'); g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  T.tex.needsUpdate = true;
}
function tabBoot(g, W, H, k) {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const a = clamp(k * 1.6, 0, 1);
  g.fillStyle = 'rgba(235,235,235,' + a.toFixed(2) + ')'; g.font = tabFont(54); g.textAlign = 'center'; g.fillText('MONOCHROME', W / 2, H / 2 - 20);
  g.font = tabFont(26); g.fillStyle = 'rgba(180,180,180,' + a.toFixed(2) + ')'; g.fillText('FIELD TABLET  ·  SYSTEM ONLINE', W / 2, H / 2 + 22);
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(W / 2 - 150, H / 2 + 60, 300, 4); g.fillStyle = '#fff'; g.fillRect(W / 2 - 150, H / 2 + 60, 300 * k, 4);
  g.textAlign = 'left';
  if (k < 0.2) { g.fillStyle = 'rgba(255,255,255,' + (0.4 * (1 - k * 5)).toFixed(2) + ')'; g.fillRect(0, 0, W, H); }
}
function tabHeader(g, W) {
  g.fillStyle = 'rgba(7,9,11,0.97)'; g.fillRect(0, 0, W, TAB_HDR);
  g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(0, TAB_HDR - 2, W, 2);
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.fillStyle = '#8a8a8a'; g.font = tabFont(22); g.fillText('KEYS', 22, 26);
  g.fillStyle = '#f4f4f4'; g.font = tabFont(50); g.fillText(S.keys + ' / ' + TOTAL_KEYS, 22, 58);
  const floor = S.act === 2 ? 'THE SEWERS' : (floorsOn() ? FLOORS.name[S.floor || 1] : 'THE HOUSE');
  g.fillStyle = '#aaa'; g.font = tabFont(24); g.fillText(floor, 132, 58);
  const tw = 128, x0 = W - 3 * tw - 58;
  for (let i = 0; i < 3; i++) {
    const on = i === TAB.screen, x = x0 + i * tw;
    if (on) { g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, 8, tw - 6, TAB_HDR - 14); g.fillStyle = '#fff'; g.fillRect(x, TAB_HDR - 7, tw - 6, 3); }
    g.fillStyle = on ? '#fff' : '#777'; g.font = tabFont(30); g.textAlign = 'center'; g.fillText(TAB_NAMES[i], x + (tw - 6) / 2, 42);
  }
  g.fillStyle = '#9a9a9a'; g.font = tabFont(26); g.fillText('‹' + codeLabel(bindCode('screenPrev')), x0 - 24, 41); g.fillText(codeLabel(bindCode('screenNext')) + '›', W - 26, 41);
  g.textAlign = 'left';
}
function tabScreen(g, s, W, H, y0, opaque) {
  if (s === 0) tabMap(g, W, H, y0);
  else if (s === 1) tabRadar(g, W, H, y0);
  else tabCams(g, W, H, y0, opaque);
}
function tabRadar(g, W, H, y0) {
  g.fillStyle = '#021208'; g.fillRect(0, y0, W, H - y0);
  const rc = el['radar-canvas'], ah = H - y0;
  const w = Math.min(W, ah * 4 / 3), h = w * 3 / 4;                                                          // the very same screen the old tracker had
  if (rc) g.drawImage(rc, (W - w) / 2, y0 + (ah - h) / 2, w, h);
  g.strokeStyle = 'rgba(70,255,130,0.5)'; g.lineWidth = 3; g.strokeRect((W - w) / 2 + 1.5, y0 + (ah - h) / 2 + 1.5, w - 3, h - 3);
}
function tabCams(g, W, H, y0, opaque) {
  const zoomed = TAB.lock, cam = cams[S.camSel];
  if (opaque) { g.fillStyle = '#050505'; g.fillRect(0, y0, W, H - y0); g.fillStyle = '#777'; g.font = tabFont(34); g.textAlign = 'center'; g.fillText('LINKING TO CAMERAS…', W / 2, H / 2 + 8); g.textAlign = 'left'; return; }
  const top = y0, bot = H;
  g.strokeStyle = 'rgba(255,255,255,0.65)'; g.lineWidth = 3;                                                // viewfinder corners
  for (const [cx, cy, sx, sy] of [[16, top + 14, 1, 1], [W - 16, top + 14, -1, 1], [16, bot - 14, 1, -1], [W - 16, bot - 14, -1, -1]]) { g.beginPath(); g.moveTo(cx, cy + sy * 40); g.lineTo(cx, cy); g.lineTo(cx + sx * 40, cy); g.stroke(); }
  g.textAlign = 'left'; g.font = tabFont(34); g.fillStyle = '#fff'; g.shadowColor = '#000'; g.shadowBlur = 6;
  const blink = Math.floor(S.time * 1.6) % 2 === 0;
  if (blink) { g.beginPath(); g.fillStyle = '#fff'; g.arc(36, top + 48, 8, 0, TAU); g.fill(); }
  g.fillStyle = '#fff'; g.fillText((S.act === 2 ? 'CH ' : 'CAM ') + pad2(S.camSel + 1) + '  ' + (cam ? cam.name : '') + (S.act === 2 ? '  *AUDIO ONLY*' : ''), 56, top + 58);
  const t = Math.floor(S.time); g.textAlign = 'right'; g.fillText('02:' + pad2(Math.floor(t / 60) % 60) + ':' + pad2(t % 60), W - 30, top + 58);
  g.textAlign = 'center';
  if (zoomed) {
    const n = cams.length, bw = 54, gap = 8, x0 = (W - (n * bw + (n - 1) * gap)) / 2, y = bot - 78;
    for (let i = 0; i < n; i++) {
      const on = i === S.camSel; g.fillStyle = on ? '#fff' : 'rgba(0,0,0,0.6)'; g.fillRect(x0 + i * (bw + gap), y, bw, 40); g.strokeStyle = on ? '#fff' : '#888'; g.lineWidth = 2; g.strokeRect(x0 + i * (bw + gap), y, bw, 40);
      g.fillStyle = on ? '#000' : '#ddd'; g.font = tabFont(30); g.fillText(String((i + 1) % 10), x0 + i * (bw + gap) + bw / 2, y + 30);
    }
    g.font = tabFont(26); g.fillStyle = '#ddd'; g.fillText('‹ ' + codeLabel(bindCode('screenPrev')) + '     SWITCH CAMERA     ' + codeLabel(bindCode('screenNext')) + ' ›      ' + bindHint('interact') + ' ZOOM OUT', W / 2, bot - 22);
  } else { g.font = tabFont(28); g.fillStyle = '#e8e8e8'; g.fillText('PRESS ' + bindHint('interact') + ' TO ZOOM IN AND SWITCH CAMERAS', W / 2, bot - 26); }
  g.shadowBlur = 0; g.textAlign = 'left';
}
function tabMapBase() {
  const T = TAB, g = T.mapCv.getContext('2d'), W = T.mapCv.width, H = T.mapCv.height, pad = 16, legend = 34;
  let n = 0; for (let i = 0; i < discovered.length; i++) if (discovered[i]) n++;
  const sig = n + ':' + S.floor + ':' + S.act + ':' + S.seed + ':' + S.keys;
  if (sig === T.mapSig) return;
  T.mapSig = sig;
  const sc = Math.min((W - pad * 2) / MW, (H - pad * 2 - legend) / MH), ox = (W - sc * MW) / 2, oy = pad + (H - pad * 2 - legend - sc * MH) / 2;
  T.mx = ox; T.my = oy; T.ms = sc;
  g.fillStyle = '#05090c'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(150,190,220,0.07)'; g.lineWidth = 1;                                                // blueprint grid
  for (let x = 0; x < W; x += 32) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); }
  for (let y = 0; y < H; y += 32) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    const i = idx(x, z);
    if (!discovered[i] || grid[i] !== 0) continue;
    const zn = zone[i];
    g.fillStyle = zn === 1 ? 'rgba(210,240,255,0.26)' : (zn === 3 ? 'rgba(160,200,170,0.10)' : (zn === 2 ? 'rgba(190,215,240,0.16)' : 'rgba(170,200,230,0.09)'));
    g.fillRect(ox + x * sc, oy + z * sc, sc + 0.6, sc + 0.6);
  }
  g.beginPath();                                                                                              // every wall edge in one glowing path
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    const i = idx(x, z);
    if (!discovered[i] || grid[i] !== 0) continue;
    for (let k = 0; k < 4; k++) {
      if (!solid(x + DX[k], z + DZ[k])) continue;
      const x0 = ox + (x + (k === 1 ? 1 : 0)) * sc, z0 = oy + (z + (k === 2 ? 1 : 0)) * sc, x1 = (k === 0 || k === 2) ? x0 + sc : x0, z1 = (k === 1 || k === 3) ? z0 + sc : z0;
      g.moveTo(x0, z0); g.lineTo(x1, z1);
    }
  }
  g.lineCap = 'round'; g.strokeStyle = 'rgba(235,245,255,0.95)'; g.lineWidth = 2.4; g.shadowColor = 'rgba(150,200,255,0.9)'; g.shadowBlur = 7; g.stroke(); g.shadowBlur = 0;
  g.fillStyle = 'rgba(225,235,245,0.78)'; g.font = tabFont(21); g.textAlign = 'center';                      // labels
  const lab = (txt, tx, tz) => g.fillText(txt, ox + tx * sc, oy + tz * sc);
  if (S.act === 1 && S.floor !== 2 && discovered[idx(3, 2)]) lab('SAFE ROOM', 3.5, 2.2);
  rooms.forEach((r) => { if (discovered[idx(Math.floor((r.x0 + r.x1) / 2), Math.floor((r.z0 + r.z1) / 2))]) lab(r.name, (r.x0 + r.x1 + 1) / 2, (r.z0 + r.z1 + 1) / 2 + 0.1); });
  if (S.act === 1 && floorsOn()) {                                                                            // the staircase
    if (S.floor === 1 && FLOORS.stair && discovered[idx(FLOORS.stair.tiles[1][0], FLOORS.stair.tiles[1][1])]) {
      const q = FLOORS.stair.tiles; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.5;
      for (const t of q) for (let k = 1; k < 4; k++) { const sx = ox + (t[0] + k / 4) * sc, sz = oy + t[1] * sc; g.beginPath(); if (FLOORS.stair.ax === 'x') { g.moveTo(sx, sz + 2); g.lineTo(sx, sz + sc - 2); } else { const zz = oy + (t[1] + k / 4) * sc, xx = ox + t[0] * sc; g.moveTo(xx + 2, zz); g.lineTo(xx + sc - 2, zz); } g.stroke(); }
      g.fillStyle = '#fff'; g.font = tabFont(20); g.fillText('▲ UP', ox + (q[1][0] + 0.5) * sc, oy + (q[1][1] - 0.35) * sc);
    } else if (S.floor === 2) { g.fillStyle = '#fff'; g.font = tabFont(20); g.fillText('▼ DOWN', ox + 4.5 * sc, oy + 5.6 * sc); }
  }
  if (S.act === 1 && S.floor !== 2 && discovered[idx(MW - 2, GATE_TZ)]) {                                     // the locked gate
    const gx = ox + (MW - 1) * sc, gz = oy + (GATE_TZ + 0.5) * sc;
    g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.strokeRect(gx - 7, gz - 12, 12, 24); g.beginPath(); g.moveTo(gx - 7, gz - 12); g.lineTo(gx + 5, gz + 12); g.moveTo(gx + 5, gz - 12); g.lineTo(gx - 7, gz + 12); g.stroke();
    g.fillStyle = '#fff'; g.font = tabFont(19); g.textAlign = 'right'; g.fillText('GATE · LOCKED', gx - 12, gz - 16);
  }
  g.textAlign = 'left'; g.fillStyle = 'rgba(190,205,220,0.7)'; g.font = tabFont(20);                           // legend + compass
  g.fillText('◉ YOU      ▮ WALL      ▲ STAIRS', 18, H - 12);
  g.textAlign = 'right'; g.fillText('N ↑', W - 20, H - 12); g.textAlign = 'left';
}
function tabMap(g, W, H, y0) {
  tabMapBase();
  const T = TAB;
  g.drawImage(T.mapCv, 0, y0, W, T.mapCv.height);
  const sc = T.ms || 10, ox = T.mx || 0, oy = (T.my || 0) + y0, px = ox + (P.x / TILE) * sc, pz = oy + (P.z / TILE) * sc;
  const fa = Math.atan2(-Math.sin(P.yaw), -Math.cos(P.yaw)), pulse = 0.5 + 0.5 * Math.sin(S.time * 4);
  g.save(); g.translate(px, pz);
  const cone = g.createRadialGradient(0, 0, 2, 0, 0, sc * 5); cone.addColorStop(0, 'rgba(255,255,255,0.35)'); cone.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = cone; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, sc * 5, fa - 0.62, fa + 0.62); g.closePath(); g.fill();         // where you are looking
  g.strokeStyle = 'rgba(255,255,255,' + (0.7 - pulse * 0.5).toFixed(2) + ')'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 8 + pulse * 10, 0, TAU); g.stroke();
  g.rotate(fa); g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 10; g.beginPath(); g.moveTo(11, 0); g.lineTo(-7, 7); g.lineTo(-3, 0); g.lineTo(-7, -7); g.closePath(); g.fill();
  g.restore(); g.shadowBlur = 0;
  const sw = ((S.time * 0.18) % 1) * (W + 200) - 100;                                                          // a slow scan sweep
  const sg = g.createLinearGradient(sw - 60, 0, sw + 60, 0); sg.addColorStop(0, 'rgba(160,210,255,0)'); sg.addColorStop(0.5, 'rgba(160,210,255,0.07)'); sg.addColorStop(1, 'rgba(160,210,255,0)');
  g.fillStyle = sg; g.fillRect(sw - 60, y0, 120, H - y0);
}

/* ======================================================================
   THE 3D DESK MENU  ·  the title screen is a dark room with a desk
   · the laptop shows the live CCTV feeds and carries the main menu; click (or Up/Down + Enter) and the camera glides to the next screen
   · PLAY -> the old CRT monitor (SELECT AN ACT) · SETTINGS -> the tablet · ABOUT -> the corkboard · MULTIPLAYER -> the radio
   · the story is typed on the laptop terminal, the camera pushes into the screen, black, and the game fades in
   ====================================================================== */
const M3_MODES = ['menu', 'acts', 'lore', 'mp', 'lobby', 'act2lore'];
const M3_WP = {
  intro: { p: [0.7, 1.9, 2.9], l: [0, 0.9, -0.5], fov: 46, fitW: 0 },
  laptop: { p: [0, 1.0, 0.18], l: [0, 0.975, -0.708], fov: 38, fitW: 0.82 },
  lore: { p: [0, 0.99, -0.05], l: [0, 0.98, -0.708], fov: 32, fitW: 0.68 },
  loreIn: { p: [0, 0.98, -0.45], l: [0, 0.98, -0.708], fov: 36, fitW: 0 },
  crt: { p: [-0.70, 1.045, 0.382], l: [-1.039, 1.04, -0.32], fov: 38, fitW: 0.64 },
  tablet: { p: [0.80, 1.28, 0.30], l: [0.80, 0.82, -0.2], fov: 38, fitW: 0.54 },
  board: { p: [1.12, 1.52, 0.02], l: [1.25, 1.55, -0.94], fov: 38, fitW: 1.12 },
  radio: { p: [1.45, 1.0, 0.0], l: [1.62, 0.9, -0.55], fov: 38, fitW: 0.56 },
};
const M3 = {
  built: false, scene: null, cam: null, rt: null, ray: null, mouse: null, tgt: 'laptop', from: null, cur: null, t: 1, dur: 1.8,
  screens: {}, active: null, sel: 0, glitch: 0, lore: null, mx: 0, my: 0, tmx: 0, tmy: 0, dust: null, bulb: null, lampL: null, glow: null, hot: false, wasOn: false, drawAcc: 9, fadeCut: false,
};
const m3On = () => M3.built && !VR.active;
const m3Active = () => m3On() && M3_MODES.indexOf(S.mode) >= 0;
const m3Font = (px) => px + 'px VT323, "Courier New", monospace';

/* ---------- camera ---------- */
function m3Wp(name) {
  const w = M3_WP[name], aspect = Math.max(0.3, window.innerWidth / Math.max(1, window.innerHeight));
  const d = Math.hypot(w.p[0] - w.l[0], w.p[1] - w.l[1], w.p[2] - w.l[2]);
  let fov = w.fov;
  if (w.fitW) fov = Math.max(fov, 2 * Math.atan((w.fitW / 2) / (d * aspect)) * 180 / Math.PI);
  return { x: w.p[0], y: w.p[1], z: w.p[2], lx: w.l[0], ly: w.l[1], lz: w.l[2], fov: Math.min(fov, 85) };
}
function m3Go(name, dur) {
  if (name === M3.tgt && M3.t >= 1) return;
  M3.from = Object.assign({}, M3.cur); M3.tgt = name; M3.t = 0; M3.dur = dur || 1.8;
  Snd.whoosh(0.8);
}
function m3Want() {
  if (S.mode === 'lore') return (M3.lore && M3.lore.entering) ? 'loreIn' : 'lore';
  if (S.mode === 'acts' || S.mode === 'act2lore') return 'crt';
  if (S.mode === 'mp' || S.mode === 'lobby') return 'radio';
  if (modalOpen === 'settings' || modalOpen === 'controls') return 'tablet';
  if (modalOpen === 'about') return 'board';
  return 'laptop';
}
function m3Intro(dur) { if (!M3.built) return; M3.cur = m3Wp('intro'); M3.from = Object.assign({}, M3.cur); M3.tgt = 'laptop'; M3.t = 0; M3.dur = dur || 3.4; }
function m3Frame(dt) {
  const on = m3Active();
  document.body.classList.toggle('m3d', on);
  if (!M3.built) return;
  M3.feedPlane.visible = S.mode !== 'lore';
  if (!on) { M3.wasOn = false; return; }
  if (!M3.wasOn) { M3.wasOn = true; if (!M3.cur) M3.cur = m3Wp('laptop'); }
  const want = m3Want();
  if (want !== M3.tgt) m3Go(want, want === 'loreIn' ? 1.7 : (want === 'lore' ? 2.0 : 1.7));
  if (M3.t < 1) M3.t = Math.min(1, M3.t + dt / M3.dur);
  const e = M3.t * M3.t * M3.t * (M3.t * (M3.t * 6 - 15) + 10), a = M3.from || m3Wp(M3.tgt), b = m3Wp(M3.tgt);       // smootherstep
  const c = M3.cur = M3.cur || {}, arc = Math.sin(Math.PI * e) * 0.05;
  for (const k of ['x', 'y', 'z', 'lx', 'ly', 'lz', 'fov']) c[k] = a[k] + (b[k] - a[k]) * e;
  M3.mx += (M3.tmx - M3.mx) * Math.min(1, dt * 3); M3.my += (M3.tmy - M3.my) * Math.min(1, dt * 3);
  const sway = M3.t >= 1 ? 1 : 0.4, t = S.time;
  M3.cam.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  M3.cam.position.set(c.x + M3.mx * 0.035 + Math.sin(t * 0.37) * 0.006 * sway, c.y + arc - M3.my * 0.018 + Math.sin(t * 0.53) * 0.004 * sway, c.z + Math.sin(t * 0.29) * 0.005 * sway);
  M3.cam.lookAt(c.lx + M3.mx * 0.015, c.ly - M3.my * 0.008, c.lz);
  if (Math.abs(M3.cam.fov - c.fov) > 0.01) { M3.cam.fov = c.fov; }
  M3.cam.updateProjectionMatrix();
  M3.glitch = Math.max(0, M3.glitch - dt * 2.4);
  // lights: the bulb flickers, the lamp hums, the laptop glows with whatever it shows
  const fl = Math.sin(t * 61) + Math.sin(t * 23.7) + Math.sin(t * 9.1);
  M3.bulb.intensity = 0.42 + (fl > 2.1 ? -0.3 : 0) + Math.sin(t * 1.7) * 0.03;
  M3.lampL.intensity = 1.5 + Math.sin(t * 7.3) * 0.03;
  M3.glow.intensity = 0.55 + Math.sin(t * 2.3) * 0.05 + M3.glitch * 0.4;
  for (let i = 0; i < M3.dustN; i++) {                                                                      // dust motes drift through the lamp light
    const p = M3.dustPos; p[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.01; p[i * 3 + 1] += (0.012 + (i % 5) * 0.003) * dt; p[i * 3 + 2] += Math.cos(t * 0.27 + i * 1.7) * dt * 0.01;
    if (p[i * 3 + 1] > 1.9) p[i * 3 + 1] = 0.8;
  }
  M3.dust.geometry.attributes.position.needsUpdate = true;
  // which screen takes clicks (only once the camera has nearly arrived)
  M3.active = M3.t > 0.78 ? (M3.tgt === 'laptop' && S.mode === 'menu' && !modalOpen ? M3.screens.laptop : (M3.tgt === 'crt' && S.mode === 'acts' ? M3.screens.crt : null)) : null;
  if (S.mode === 'lore') m3LoreUpdate(dt);
  M3.drawAcc += dt;
  m3DrawScreens(dt);
}

/* ---------- the screens (canvas textures) ---------- */
function m3Screen(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const tex = new THREE.CanvasTexture(cv); tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; return { w, h, cv, g: cv.getContext('2d'), tex, mesh: null, btns: [], hov: -1, press: null, sig: '' }; }
function m3MainButtons() {
  return [
    { label: 'PLAY', sub: 'choose an act', act: () => toActSelect() },
    { label: 'MULTIPLAYER', sub: 'co-op, up to 4', act: () => el['btn-multi'].click() },
    { label: 'VR MODE', sub: VR.supported ? 'headset detected' : 'needs a WebXR browser', act: () => vrStart(), dim: !VR.supported },
    { label: 'SETTINGS', sub: 'graphics, controls', act: () => openModal('settings') },
    { label: 'FULLSCREEN', sub: '', act: () => toggleFull() },
    { label: 'ABOUT', sub: '', act: () => openModal('about') },
  ];
}
function m3ActButtons() {
  return [
    { label: 'ACT 1  ·  THE HOUSE', sub: 'Find the keys. Unlock the safe room door. Go down the stairs.', act: () => pickAct(1), big: true },
    { label: 'ACT 2  ·  THE SEWERS', sub: 'Flooded tunnels. A shattered tracker. Listen for the thing in the water.', act: () => pickAct(2), big: true },
    { label: 'BACK', sub: '', act: () => setMode('menu') },
  ];
}
function m3Layout(scr, list, x, y, w, h, gap) { scr.btns = list.map((b, i) => Object.assign({ x, y: y + i * (h + gap), w, h }, b)); if (M3.sel >= scr.btns.length) M3.sel = 0; }
function m3Press(i) {                                                                                       // click / Enter on a button of the active screen
  const scr = M3.active; if (!scr || !scr.btns[i] || scr.press) return false;
  const b = scr.btns[i]; if (b.dim && !b.always) { Snd.locked(); M3.glitch = 0.5; return false; }
  scr.press = { i, t: 0 }; Snd.menuClick(); M3.glitch = 0.7; M3.sel = i;
  setTimeout(() => { scr.press = null; b.act(); }, 170);
  return true;
}
function m3Nav(inp) {
  const scr = M3.active; if (!scr || !scr.btns.length) return;
  const d = inp.mnavY || inp.navY || 0;
  if (d) { const n = scr.btns.length; M3.sel = (M3.sel + d + n) % n; Snd.tabSwitch(); }
  if (inp.confirm || inp.select) m3Press(M3.sel);
}
function m3Ray(clientX, clientY) {
  const scr = M3.active; if (!scr || !scr.mesh) return null;
  const r = renderer.domElement.getBoundingClientRect();
  M3.mouse.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  M3.ray.setFromCamera(M3.mouse, M3.cam);
  const hits = M3.ray.intersectObject(scr.mesh, false);
  if (!hits || !hits.length || !hits[0].uv) return null;
  return { x: hits[0].uv.x * scr.w, y: (1 - hits[0].uv.y) * scr.h };
}
function m3Hit(scr, p) { if (!p) return -1; for (let i = 0; i < scr.btns.length; i++) { const b = scr.btns[i]; if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return i; } return -1; }
function m3Pointer(e, click) {
  if (!m3Active()) return;
  M3.tmx = (e.clientX / window.innerWidth - 0.5) * 2; M3.tmy = (e.clientY / window.innerHeight - 0.5) * 2;
  const scr = M3.active;
  if (S.mode === 'lore') { if (click && M3.lore) m3LoreAdvance(); return; }
  if (!scr) { document.body.classList.remove('m3-hot'); return; }
  const i = m3Hit(scr, m3Ray(e.clientX, e.clientY));
  if (i >= 0 && i !== M3.sel) { M3.sel = i; Snd.tabSwitch(); }
  M3.hot = i >= 0; document.body.classList.toggle('m3-hot', M3.hot);
  if (click && i >= 0) m3Press(i);
}

/* ---------- drawing the screens ---------- */
function m3Tick(g, W, H, time) {                                                                            // shared CRT finish: scanlines, vignette, flicker
  g.globalAlpha = 0.18; g.fillStyle = 'rgba(0,0,0,1)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1); g.globalAlpha = 1;
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  if (Math.sin(time * 47) + Math.sin(time * 13) > 1.85) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, 0, W, H); }
}
function m3Button(g, b, hot, press, big) {
  const p = press ? 1 - press.t / 0.17 : 0, off = press ? 3 : 0;
  g.save(); g.translate(b.x + (press ? 2 : 0), b.y + off);
  g.fillStyle = hot ? 'rgba(244,244,244,0.96)' : (b.dim ? 'rgba(20,20,20,0.5)' : 'rgba(10,10,10,0.62)'); g.fillRect(0, 0, b.w, b.h);
  g.strokeStyle = hot ? '#fff' : (b.dim ? '#555' : '#bdbdbd'); g.lineWidth = 2; g.strokeRect(1, 1, b.w - 2, b.h - 2);
  if (hot) { g.fillStyle = '#000'; g.beginPath(); g.moveTo(14, b.h / 2 - 9); g.lineTo(14, b.h / 2 + 9); g.lineTo(28, b.h / 2); g.closePath(); g.fill(); }
  g.fillStyle = hot ? '#000' : (b.dim ? '#666' : '#eee'); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  if (big) { g.font = m3Font(46); g.fillText(b.label, hot ? 42 : 24, 54); g.font = m3Font(24); g.fillStyle = hot ? '#222' : '#aaa'; wrapText(g, b.sub, hot ? 42 : 24, 92, b.w - 60, 26); }
  else { g.font = m3Font(34); g.fillText(b.label, hot ? 42 : 24, b.sub ? 30 : b.h / 2 + 10); if (b.sub) { g.font = m3Font(19); g.fillStyle = hot ? '#333' : '#888'; g.fillText(b.sub, hot ? 42 : 24, b.h - 11); } }
  if (press) { g.fillStyle = 'rgba(255,255,255,' + (0.7 * p).toFixed(2) + ')'; g.fillRect(0, 0, b.w, b.h); }
  g.restore();
}
function wrapText(g, text, x, y, maxW, lh) {
  const words = String(text).split(' '); let line = '', yy = y;
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t; }
  if (line) g.fillText(line, x, yy);
}
function m3GlitchBars(g, W, H, k) {
  if (k <= 0.02) return;
  for (let i = 0; i < 5; i++) { const y = Math.random() * H, h = 4 + Math.random() * 22, dx = (Math.random() - 0.5) * 60 * k; g.drawImage(g.canvas, 0, y, W, h, dx, y, W, h); }
  g.fillStyle = 'rgba(255,255,255,' + (0.08 * k).toFixed(3) + ')'; g.fillRect(0, 0, W, H);
}
function m3DrawLaptop(scr, dt) {
  const g = scr.g, W = scr.w, H = scr.h, t = S.time;
  g.clearRect(0, 0, W, H);
  if (S.mode === 'lore') { m3DrawTerminal(g, W, H); m3Tick(g, W, H, t); return; }
  // the page is the main menu
  const grd = g.createLinearGradient(0, 0, W, 0); grd.addColorStop(0, 'rgba(0,0,0,0.78)'); grd.addColorStop(0.5, 'rgba(0,0,0,0.5)'); grd.addColorStop(1, 'rgba(0,0,0,0.8)'); g.fillStyle = grd; g.fillRect(0, 0, W, H);
  const cam = cams[Math.max(0, S.menuCam)];
  g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#e8e8e8'; g.font = m3Font(30);
  g.fillText('CAM ' + pad2(Math.max(0, S.menuCam) + 1) + '   ' + (cam ? cam.name : ''), 26, 40);
  const ts = Math.floor(S.time); g.textAlign = 'right'; g.fillText('02:' + pad2(Math.floor(ts / 60) % 60) + ':' + pad2(ts % 60), W - 26, 40); g.textAlign = 'left';
  if (Math.floor(S.time * 1.5) % 2 === 0) { g.fillStyle = '#fff'; g.beginPath(); g.arc(34, H - 34, 8, 0, TAU); g.fill(); } g.fillStyle = '#ddd'; g.font = m3Font(26); g.fillText('REC', 52, H - 26);
  const jx = (Math.random() < 0.04 + M3.glitch * 0.5) ? (Math.random() - 0.5) * 16 : 0;                   // the title: stacked, glitching
  g.font = m3Font(112); g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillText('MONOCHROME', 40 + jx - 4, 214); g.fillStyle = 'rgba(120,120,120,0.45)'; g.fillText('MONOCHROME', 40 - jx + 4, 218);
  g.fillStyle = '#f4f4f4'; g.fillText('MONOCHROME', 40, 216);
  g.font = m3Font(25); g.fillStyle = '#b8b8b8'; wrapText(g, 'There is no colour here. Only the light, and what it shows you.', 44, 256, 480, 28);
  g.font = m3Font(22); g.fillStyle = '#777'; g.fillText('BUILD ' + BUILD + '    ' + (Input.padConnected() ? 'CONTROLLER CONNECTED' : 'W/S + ENTER, OR CLICK'), 44, H - 28);
  m3Layout(scr, m3MainButtons(), 590, 92, 394, 62, 10);
  scr.btns.forEach((b, i) => m3Button(g, b, scr === M3.active && i === M3.sel && !(M3.t < 0.78), scr.press && scr.press.i === i ? scr.press : null, false));
  m3GlitchBars(g, W, H, M3.glitch); m3Tick(g, W, H, t);
}
function m3DrawCRT(scr, dt) {
  const g = scr.g, W = scr.w, H = scr.h, t = S.time, live = S.mode === 'acts';
  g.fillStyle = '#060606'; g.fillRect(0, 0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  if (!live) {                                                                                               // standby: slow noise and a blinking prompt
    for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.12).toFixed(2) + ')'; g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 30, 1); }
    g.fillStyle = '#9a9a9a'; g.font = m3Font(40); g.fillText(Math.floor(t * 1.2) % 2 ? 'STANDBY' : '', W / 2, H / 2); m3Tick(g, W, H, t); return;
  }
  g.fillStyle = '#f0f0f0'; g.font = m3Font(64); g.fillText('SELECT AN ACT', W / 2, 76);
  g.fillStyle = '#8a8a8a'; g.font = m3Font(24); g.fillText('SUBJECT 07  ·  CHOOSE A SCENARIO', W / 2, 104);
  g.strokeStyle = '#555'; g.lineWidth = 2; g.beginPath(); g.moveTo(60, 120); g.lineTo(W - 60, 120); g.stroke();
  const list = m3ActButtons();
  scr.btns = [];
  const bw = W - 120, bh = 148;
  list.forEach((b, i) => { const r = i < 2 ? { x: 60, y: 140 + i * (bh + 14), w: bw, h: bh } : { x: W / 2 - 110, y: 140 + 2 * (bh + 14) + 8, w: 220, h: 52 }; scr.btns.push(Object.assign(r, b)); });
  if (M3.sel >= scr.btns.length) M3.sel = 0;
  scr.btns.forEach((b, i) => m3Button(g, b, scr === M3.active && i === M3.sel && M3.t >= 0.78, scr.press && scr.press.i === i ? scr.press : null, !!b.big));
  m3GlitchBars(g, W, H, M3.glitch); m3Tick(g, W, H, t);
}
function m3DrawTablet(scr) {
  const g = scr.g, W = scr.w, H = scr.h, t = S.time;
  g.fillStyle = '#05090c'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(150,190,220,0.08)'; for (let x = 0; x < W; x += 32) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); } for (let y = 0; y < H; y += 32) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
  g.textAlign = 'left'; g.fillStyle = '#f2f2f2'; g.font = m3Font(56); g.fillText(modalOpen === 'controls' ? 'CONTROLS' : 'SETTINGS', 36, 78);
  g.fillStyle = '#8a8a8a'; g.font = m3Font(24); g.fillText('FIELD TABLET  ·  PREFERENCES', 38, 108);
  const rows = [['QUALITY', String(Settings.quality).toUpperCase()], ['SHADOWS', String(Settings.shadows).toUpperCase()], ['LOOK SENSITIVITY', Settings.look.toFixed(2) + 'x'], ['FILM GRAIN / CRT', Settings.fx ? 'ON' : 'OFF'], ['TABLET', codeLabel(bindCode('tablet')) + '   (Q / E: SCREENS)'], ['INTERACT', codeLabel(bindCode('interact'))]];
  rows.forEach((r, i) => { const y = 170 + i * 52; g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(30, y - 32, W - 60, 42); g.fillStyle = '#cfcfcf'; g.font = m3Font(28); g.fillText(r[0], 46, y); g.fillStyle = '#fff'; g.textAlign = 'right'; g.fillText(r[1], W - 46, y); g.textAlign = 'left'; });
  m3Tick(g, W, H, t);
}
function m3DrawBoard(scr) {
  const g = scr.g, W = scr.w, H = scr.h;
  g.fillStyle = '#4a4a46'; g.fillRect(0, 0, W, H); for (let i = 0; i < 2600; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0' : '255,255,255') + ',' + (Math.random() * 0.1).toFixed(2) + ')'; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  g.strokeStyle = '#1c1c1a'; g.lineWidth = 14; g.strokeRect(7, 7, W - 14, H - 14);
  const note = (x, y, w, h, rot, lines, shade) => { g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(rot); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-w / 2 + 6, -h / 2 + 8, w, h); g.fillStyle = shade || '#d8d8d2'; g.fillRect(-w / 2, -h / 2, w, h); g.fillStyle = '#e6e6e6'; g.beginPath(); g.arc(0, -h / 2 + 10, 5, 0, TAU); g.fill(); g.fillStyle = '#1a1a1a'; g.textAlign = 'left'; lines.forEach((l, i) => { g.font = (i === 0 ? 'bold 26px ' : '22px ') + '"Special Elite", "Courier New", monospace'; g.fillText(l, -w / 2 + 14, -h / 2 + 44 + i * 28); }); g.restore(); };
  note(60, 54, 330, 250, -0.05, ['MONOCHROME', '', 'by Victor "Enrvy"', 'with Team Claude  <3']);
  note(430, 40, 250, 170, 0.04, ['BUILT WITH', 'HTML5 · THREE.JS', 'WEB AUDIO · CSS3'], '#c9c9c3');
  note(700, 70, 270, 190, -0.03, ['THANK YOU', 'for playing.', 'Please keep the', 'lights on.'], '#dcdcd6');
  note(80, 360, 300, 190, 0.03, ['ROOMS', 'safe room · east room', 'west room · hall', 'service · south'], '#cfcfc9');
  note(430, 300, 250, 270, -0.02, ['KEYS?', '', 'five. maybe more.', 'it hears you run.'], '#d4d4ce');
  note(720, 330, 240, 200, 0.05, ['DON\'T OPEN', 'THE GATE', 'THE WAY DOWN IS', 'THE SAFE ROOM.'], '#c6c6c0');
  g.strokeStyle = 'rgba(20,20,20,0.85)'; g.lineWidth = 3; [[225, 60, 560, 50], [560, 50, 835, 80], [225, 60, 230, 380], [560, 210, 555, 310], [835, 80, 840, 340], [230, 380, 555, 310]].forEach((s) => { g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); g.stroke(); });
}
function m3DrawRadio(scr) {
  const g = scr.g, W = scr.w, H = scr.h, t = S.time, live = S.mode === 'mp' || S.mode === 'lobby';
  g.fillStyle = '#071109'; g.fillRect(0, 0, W, H);
  g.fillStyle = live ? '#b8ffc4' : '#4f7a58'; g.textAlign = 'left'; g.font = m3Font(34); g.fillText(live ? 'SCANNING…' : 'RADIO  OFF', 14, 40);
  g.font = m3Font(24); g.fillText(live ? (88.1 + (Math.sin(t * 0.8) * 0.5 + 0.5) * 18).toFixed(1) + ' MHZ' : '--.- MHZ', 14, 72);
  for (let i = 0; i < 24; i++) { const h = live ? 4 + (Math.sin(t * 6 + i * 1.7) * 0.5 + 0.5) * 34 + Math.random() * 6 : 3; g.fillRect(12 + i * 10, H - 8 - h, 7, h); }
  m3Tick(g, W, H, t);
}
function m3DrawScreens(dt) {
  const sc = M3.screens, t = S.time;
  for (const k of ['laptop', 'crt']) { const s = sc[k]; if (s.press) s.press.t += dt; }
  const lore = S.mode === 'lore';
  const every = lore ? 1 / 20 : 1 / 24;
  if (M3.drawAcc < every) return;
  M3.drawAcc = 0;
  m3DrawLaptop(sc.laptop, dt); sc.laptop.tex.needsUpdate = true;
  m3DrawCRT(sc.crt, dt); sc.crt.tex.needsUpdate = true;
  const tabNow = M3.tgt === 'tablet', brdNow = M3.tgt === 'board', radNow = M3.tgt === 'radio';
  if (tabNow || sc.tab.sig !== 'idle') { m3DrawTablet(sc.tab); sc.tab.tex.needsUpdate = true; sc.tab.sig = tabNow ? 'live' : 'idle'; }
  if (brdNow || !sc.board.sig) { m3DrawBoard(sc.board); sc.board.tex.needsUpdate = true; sc.board.sig = brdNow ? 'live' : 'idle0'; }
  if (radNow || M3.t < 1 || !sc.radio.sig) { m3DrawRadio(sc.radio); sc.radio.tex.needsUpdate = true; sc.radio.sig = 'x'; }
}

/* ---------- the story, typed on the laptop terminal ---------- */
function m3LorePages() {
  return [
    { cps: 70, hold: 1.0, lines: ['> SECURITY TERMINAL v1.3', '> LINK ................ OK', '> 10 FEEDS ............ ONLINE', '> SUBJECT 07 .......... AWAKE', '> POWER ............... FAILING'] },
    { cps: 26, hold: 2.2, lines: ['You awaken in an endless monochrome', 'labyrinth, stripped of light and life.'] },
    { cps: 26, hold: 2.4, lines: ['A silent watcher prowls the halls.', 'It does not sleep. It does not tire.', 'It hears every hurried footstep.'] },
    { cps: 26, hold: 2.4, lines: ['Somewhere in this house, ' + TOTAL_KEYS + ' keys are hidden.', 'Find them all. Unlock the door in the safe room.', 'Then go down the stairs.'] },
    { cps: 18, hold: 0, last: true, lines: ['Tread carefully.', '', '> PRESS ANY KEY TO BEGIN'] },
  ];
}
function m3LoreStart() {
  M3.lore = { pages: m3LorePages(), pi: 0, shown: 0, timer: -0.8, done: false, holdT: 0, entering: false, flare: 0, began: false, tick: 0 };
  M3.screens.laptop.sig = '';
}
function m3LorePage() { return M3.lore.pages[M3.lore.pi]; }
function m3LoreChars(p) { return p.lines.reduce((a, l) => a + l.length, 0); }
function m3LoreUpdate(dt) {
  const L = M3.lore; if (!L) return;
  if (L.entering) {                                                                                           // the camera pushes into the screen, white, then black
    L.flare = Math.min(1, L.flare + dt / 1.5);
    if (L.flare > 0.62 && !L.cut) { L.cut = true; const c = el.cut; c.style.transition = 'opacity 850ms ease-in'; c.style.opacity = '1'; Snd.whoosh(1.4); }
    if (L.flare >= 1 && !L.began) { L.began = true; setTimeout(() => { M3.lore = null; beginGame(false, 2800); }, 900); }
    return;
  }
  const p = m3LorePage(), total = m3LoreChars(p);
  if (L.timer < 0) { L.timer += dt; return; }
  if (L.shown < total) {
    const before = Math.floor(L.shown); L.shown = Math.min(total, L.shown + dt * p.cps);
    if (Math.floor(L.shown) !== before && (Math.floor(L.shown) % 3 === 0)) Snd.key();
    if (L.shown >= total) { L.done = true; L.holdT = 0; }
  } else if (!p.last) { L.holdT += dt; if (L.holdT >= p.hold) m3LoreAdvance(true); }
}
function m3LoreAdvance(auto) {                                                                               // Enter / click / any key
  const L = M3.lore; if (!L || L.entering) return;
  const p = m3LorePage(), total = m3LoreChars(p);
  if (L.timer < 0) { L.timer = 0; return; }
  if (L.shown < total) { L.shown = total; L.done = true; L.holdT = 0; return; }                              // finish the page
  if (p.last) { if (auto) return; L.entering = true; L.flare = 0; Snd.menuClick(); return; }                 // begin
  L.pi++; L.shown = 0; L.timer = 0.25; L.done = false; M3.glitch = 0.8; Snd.tabSwitch();
}
function m3LoreKey(inp) {
  if (!M3.lore) return;
  if (inp.confirm || inp.select || inp.interact || inp.next || inp.sNext || inp.mnavY || inp.hold || inp.any) m3LoreAdvance();
}
function m3DrawTerminal(g, W, H) {
  const L = M3.lore, t = S.time;
  g.fillStyle = '#040506'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#9a9a9a'; g.font = m3Font(24); g.textAlign = 'left'; g.fillText('SECURITY TERMINAL  ·  SUBJECT LOG', 28, 36);
  g.strokeStyle = '#3a3a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(24, 50); g.lineTo(W - 24, 50); g.stroke();
  if (L) {
    const p = m3LorePage(), narr = p.cps < 40 ? 44 : 36, line = p.cps < 40 ? 56 : 44;
    let left = L.shown, y = 130;
    g.font = m3Font(narr); g.fillStyle = '#ececec';
    for (let i = 0; i < p.lines.length; i++) {
      const s = p.lines[i], n = Math.max(0, Math.min(s.length, Math.floor(left)));
      g.fillStyle = (s[0] === '>' ? '#bdbdbd' : '#f2f2f2'); g.fillText(s.slice(0, n), 36, y); left -= s.length;
      if (left < 0 && L.shown > 0 && !L.done) { const w = g.measureText(s.slice(0, n)).width; if (Math.floor(t * 3) % 2 === 0) g.fillRect(38 + w, y - narr * 0.72, narr * 0.46, narr * 0.8); break; }
      y += line;
    }
    if (L.done && !p.last && Math.floor(t * 2) % 2 === 0) { g.fillStyle = '#8a8a8a'; g.font = m3Font(22); g.textAlign = 'right'; g.fillText('ENTER ▸', W - 30, H - 24); g.textAlign = 'left'; }
    if (p.last && L.done && Math.floor(t * 2) % 2 === 0) { g.fillStyle = '#fff'; g.fillRect(36, y - narr * 0.72, narr * 0.46, narr * 0.8); }
    g.fillStyle = '#4a4a4a'; for (let i = 0; i < L.pages.length; i++) g.fillRect(W / 2 - L.pages.length * 14 + i * 28, H - 26, 20, 4); g.fillStyle = '#e6e6e6'; g.fillRect(W / 2 - L.pages.length * 14 + L.pi * 28, H - 26, 20, 4);
    if (L.entering) { g.fillStyle = 'rgba(255,255,255,' + Math.min(1, L.flare * 1.25).toFixed(2) + ')'; g.fillRect(0, 0, W, H); }
  }
  m3GlitchBars(g, W, H, M3.glitch);
}

/* ---------- rendering ---------- */
function m3Render() {
  if (S.menuCam < 0 || !cams.length) { /* the feed starts with camera 1 */ }
  const feed = cams[Math.max(0, S.menuCam)];
  if (feed && M3.feedPlane.visible) {
    const a = camAim(feed, S.time);
    cctv.position.set(feed.x, feed.y, feed.z); cctv.lookAt(a.x, a.y, a.z);
    const a0 = ambient.intensity, f0 = scene.fog.density, fi = flash.intensity;
    ambient.intensity = 0.9; scene.fog.density = 0.012; flash.intensity = 0;
    renderer.setRenderTarget(M3.rt); renderer.render(scene, cctv); renderer.setRenderTarget(null);
    ambient.intensity = a0; scene.fog.density = f0; flash.intensity = fi;
  }
  renderer.render(M3.scene, M3.cam);
}

/* ---------- building the room ---------- */
function m3Build() {
  const sc = M3.scene = new THREE.Scene(); sc.background = new THREE.Color(0x020202); sc.fog = new THREE.FogExp2(0x020202, 0.22);
  M3.cam = new THREE.PerspectiveCamera(38, window.innerWidth / Math.max(1, window.innerHeight), 0.03, 30);
  M3.rt = new THREE.WebGLRenderTarget(640, 400, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  M3.ray = new THREE.Raycaster(); M3.mouse = new THREE.Vector2();
  const ph = (c, o) => new THREE.MeshPhongMaterial(Object.assign({ color: c, shininess: 22, specular: 0x2a2a2a }, o || {}));
  const bas = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {}));
  const mk = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (parent || sc).add(m); return m; };
  const noise = (g, w, h, n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0' : '255,255,255') + ',' + (Math.random() * a).toFixed(3) + ')'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } };
  const wallT = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#3c3c3a'; g.fillRect(0, 0, w, h); noise(g, w, h, 5000, 0.12); for (let i = 0; i < 9; i++) { const x = Math.random() * w, gr = g.createLinearGradient(x, 0, x + 18, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x, 0, 18, h); } }, 3, 1.4);
  const floorT = canvasTex(256, 256, (g, w, h) => { for (let i = 0; i < 8; i++) { const v = 30 + Math.random() * 20; g.fillStyle = 'rgb(' + v + ',' + v + ',' + (v - 2) + ')'; g.fillRect(0, i * 32, w, 31); g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, i * 32 + 31, w, 1); g.fillRect((Math.random() * w) | 0, i * 32, 2, 31); } noise(g, w, h, 2500, 0.1); }, 4, 4);
  const woodT = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#2b2a28'; g.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { g.strokeStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0,' : '255,255,255,') + (Math.random() * 0.12).toFixed(3) + ')'; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (Math.random() - 0.5) * 8, w * 0.6, y + (Math.random() - 0.5) * 8, w, y + (Math.random() - 0.5) * 6); g.stroke(); } }, 2.2, 1);
  sc.add(new THREE.AmbientLight(0x707070, 0.5));
  // the room
  mk(new THREE.PlaneGeometry(14, 10), ph(0x777777, { map: floorT }), 0, 0, 0, sc).rotation.x = -Math.PI / 2;
  mk(new THREE.PlaneGeometry(14, 3.2), ph(0x8a8a88, { map: wallT }), 0, 1.6, -0.95, sc);
  const wl = mk(new THREE.PlaneGeometry(6, 3.2), ph(0x8a8a88, { map: wallT }), -3.0, 1.6, 1.8, sc); wl.rotation.y = Math.PI / 2;
  const wr = mk(new THREE.PlaneGeometry(6, 3.2), ph(0x8a8a88, { map: wallT }), 3.0, 1.6, 1.8, sc); wr.rotation.y = -Math.PI / 2;
  mk(new THREE.PlaneGeometry(14, 10), ph(0x101010), 0, 3.2, 0, sc).rotation.x = Math.PI / 2;
  // the desk
  const deskM = ph(0x888888, { map: woodT, shininess: 35 }), dark = ph(0x151515, { shininess: 30 }), metal = ph(0x4a4a4a, { shininess: 70, specular: 0x777777 });
  mk(bgeo(4.1, 0.06, 1.15), deskM, 0, 0.72, -0.35); mk(bgeo(4.0, 0.12, 0.05), dark, 0, 0.63, 0.2);
  for (const x of [-1.9, 1.9]) for (const z of [-0.85, 0.12]) mk(bgeo(0.07, 0.72, 0.07), dark, x, 0.36, z);
  mk(bgeo(0.9, 0.55, 0.5), dark, 1.3, 0.37, -0.35); mk(bgeo(0.86, 0.015, 0.02), metal, 1.3, 0.55, -0.095); mk(bgeo(0.86, 0.015, 0.02), metal, 1.3, 0.35, -0.095);     // a drawer unit
  // the laptop: base, keyboard, hinge, lid, two stacked screens (live feed under, interface over)
  const lap = new THREE.Group(); lap.position.set(0, 0.75, -0.46); sc.add(lap);
  mk(bgeo(0.64, 0.02, 0.42), ph(0x262626, { shininess: 60, specular: 0x666666 }), 0, 0.01, 0, lap);
  const kb = m3Screen(512, 320); { const g = kb.g; g.fillStyle = '#0c0c0c'; g.fillRect(0, 0, 512, 320); g.fillStyle = '#242424'; for (let r = 0; r < 5; r++) for (let c = 0; c < 14; c++) g.fillRect(14 + c * 35, 14 + r * 33, 31, 28); g.fillRect(96, 184, 250, 28); g.fillStyle = '#1b1b1b'; g.fillRect(190, 232, 132, 70); kb.tex.needsUpdate = true; }
  const kbm = mk(new THREE.PlaneGeometry(0.58, 0.3), bas(0xffffff, { map: kb.tex }), 0, 0.0215, -0.04, lap); kbm.rotation.x = -Math.PI / 2;
  const lid = new THREE.Group(); lid.position.set(0, 0.02, -0.21); lid.rotation.x = -0.22; lap.add(lid);
  mk(bgeo(0.64, 0.42, 0.016), ph(0x1d1d1d, { shininess: 60, specular: 0x777777 }), 0, 0.21, 0, lid);
  mk(bgeo(0.62, 0.40, 0.004), bas(0x040404), 0, 0.213, 0.0085, lid);
  M3.screens.laptop = m3Screen(1024, 640);
  M3.feedPlane = mk(new THREE.PlaneGeometry(0.6, 0.375), bas(0xffffff, { map: M3.rt.texture }), 0, 0.215, 0.0105, lid);
  const lui = mk(new THREE.PlaneGeometry(0.6, 0.375), bas(0xffffff, { map: M3.screens.laptop.tex, transparent: true }), 0, 0.215, 0.0112, lid); M3.screens.laptop.mesh = lui;
  mk(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 6), metal, 0, 0.02, -0.21, lap).rotation.z = Math.PI / 2;
  // the old CRT monitor (act select)
  const crt = new THREE.Group(); crt.position.set(-1.15, 0.75, -0.55); crt.rotation.y = 0.45; sc.add(crt);
  mk(bgeo(0.3, 0.04, 0.3), dark, 0, 0.02, 0, crt); mk(bgeo(0.62, 0.52, 0.5), ph(0x3a3a38, { shininess: 25 }), 0, 0.3, 0, crt); mk(bgeo(0.42, 0.36, 0.34), ph(0x32322f), 0, 0.3, -0.38, crt);
  mk(bgeo(0.54, 0.42, 0.012), bas(0x050505), 0, 0.31, 0.2555, crt);
  M3.screens.crt = m3Screen(800, 600); M3.screens.crt.mesh = mk(new THREE.PlaneGeometry(0.46, 0.345), bas(0xffffff, { map: M3.screens.crt.tex }), 0, 0.31, 0.2625, crt);
  for (let i = 0; i < 3; i++) mk(new THREE.CylinderGeometry(0.012, 0.012, 0.016, 10), ph(0x151515), -0.2 + i * 0.045, 0.045, 0.255, crt).rotation.x = Math.PI / 2;
  mk(new THREE.CircleGeometry(0.006, 8), bas(0xdddddd), 0.23, 0.05, 0.2625, crt);
  // the tablet leaning against a book
  const tb = new THREE.Group(); tb.position.set(0.8, 0.82, -0.2); tb.rotation.x = -1.0; sc.add(tb);
  mk(bgeo(0.46, 0.35, 0.014), ph(0x1b1b1b, { shininess: 60, specular: 0x777777 }), 0, 0, 0, tb); mk(new THREE.PlaneGeometry(0.43, 0.32), bas(0x020202), 0, 0, 0.0075, tb);
  M3.screens.tab = m3Screen(640, 480); mk(new THREE.PlaneGeometry(0.4, 0.3), bas(0xffffff, { map: M3.screens.tab.tex }), 0, 0, 0.0082, tb);
  mk(bgeo(0.5, 0.06, 0.34), ph(0x252525), 0.8, 0.78, -0.25).rotation.y = 0.15;
  // the corkboard + papers on the wall
  mk(bgeo(1.12, 0.78, 0.03), ph(0x2a2018), 1.25, 1.55, -0.935);
  M3.screens.board = m3Screen(1024, 680); mk(new THREE.PlaneGeometry(1.04, 0.69), bas(0xffffff, { map: M3.screens.board.tex }), 1.25, 1.55, -0.917);
  // the radio
  const rd = new THREE.Group(); rd.position.set(1.62, 0.75, -0.55); rd.rotation.y = -0.3; sc.add(rd);
  mk(bgeo(0.46, 0.28, 0.2), ph(0x2c2c2a), 0, 0.14, 0, rd); mk(bgeo(0.44, 0.26, 0.01), ph(0x141414), 0, 0.14, 0.101, rd);
  const spk = m3Screen(128, 128); { const g = spk.g; g.fillStyle = '#080808'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#2a2a2a'; for (let y = 6; y < 128; y += 9) for (let x = 6; x < 128; x += 9) { g.beginPath(); g.arc(x, y, 2.2, 0, TAU); g.fill(); } spk.tex.needsUpdate = true; }
  mk(new THREE.PlaneGeometry(0.15, 0.2), bas(0xffffff, { map: spk.tex }), -0.13, 0.14, 0.1065, rd);
  M3.screens.radio = m3Screen(256, 96); mk(new THREE.PlaneGeometry(0.2, 0.075), bas(0xffffff, { map: M3.screens.radio.tex }), 0.1, 0.19, 0.1065, rd);
  for (let i = 0; i < 2; i++) mk(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 14), ph(0x555555, { shininess: 60 }), 0.06 + i * 0.07, 0.07, 0.108, rd).rotation.x = Math.PI / 2;
  const ant = mk(new THREE.CylinderGeometry(0.004, 0.003, 0.55, 6), metal, 0.18, 0.5, -0.06, rd); ant.rotation.z = -0.25;
  // the lamp, a mug, papers, a photo frame, tapes
  const lamp = new THREE.Group(); lamp.position.set(-0.62, 0.75, -0.72); sc.add(lamp);
  mk(new THREE.CylinderGeometry(0.1, 0.12, 0.03, 18), metal, 0, 0.015, 0, lamp); const arm1 = mk(new THREE.CylinderGeometry(0.008, 0.008, 0.46, 6), metal, 0.05, 0.25, 0, lamp); arm1.rotation.z = -0.28;
  const arm2 = mk(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 6), metal, 0.16, 0.57, 0.02, lamp); arm2.rotation.z = 0.75;
  const shade = mk(new THREE.ConeGeometry(0.11, 0.14, 18, 1, true), ph(0x3a3a38, { side: THREE.DoubleSide }), 0.3, 0.72, 0.03, lamp); shade.rotation.z = -0.4;
  M3.lampL = new THREE.SpotLight(0xffffff, 1.5, 7, 0.9, 0.7, 1.4); M3.lampL.position.set(-0.32, 1.46, -0.7); M3.lampL.target.position.set(-0.1, 0.75, -0.3); sc.add(M3.lampL); sc.add(M3.lampL.target);
  const bulbS = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7, fog: false })); bulbS.scale.set(0.3, 0.3, 1); bulbS.position.set(-0.34, 1.4, -0.66); sc.add(bulbS);
  M3.glow = new THREE.PointLight(0xdfeaff, 0.55, 3.2, 1.6); M3.glow.position.set(0, 1.0, -0.1); sc.add(M3.glow);
  M3.bulb = new THREE.PointLight(0xffffff, 0.42, 7, 1.4); M3.bulb.position.set(0.2, 2.5, 0.3); sc.add(M3.bulb);
  const rim = new THREE.DirectionalLight(0x9aa6b4, 0.16); rim.position.set(-1, 1.5, 2); sc.add(rim);
  mk(new THREE.CylinderGeometry(0.04, 0.034, 0.09, 14), ph(0xbdbdbd, { shininess: 60 }), 0.48, 0.795, -0.2);
  mk(bgeo(0.22, 0.012, 0.3), ph(0xb8b8b2), -0.5, 0.757, -0.08).rotation.y = 0.2; mk(bgeo(0.2, 0.01, 0.28), ph(0xc9c9c3), -0.46, 0.768, -0.1).rotation.y = -0.12;
  mk(bgeo(0.14, 0.17, 0.012), ph(0x1a1a1a), -0.78, 0.835, -0.32).rotation.y = 0.5; mk(bgeo(0.11, 0.14, 0.004), ph(0x777777), -0.78, 0.835, -0.313).rotation.y = 0.5;
  for (let i = 0; i < 3; i++) mk(bgeo(0.1, 0.016, 0.065), ph(0x222222), 0.95 - i * 0.012, 0.76 + i * 0.016, 0.0).rotation.y = 0.2 * i;
  mk(new THREE.CylinderGeometry(0.003, 0.003, 0.14, 5), ph(0x111111), 0.12, 0.762, 0.0).rotation.z = Math.PI / 2;
  // dust in the lamp light
  M3.dustN = 140; M3.dustPos = new Float32Array(M3.dustN * 3);
  for (let i = 0; i < M3.dustN; i++) { M3.dustPos[i * 3] = -0.9 + Math.random() * 1.8; M3.dustPos[i * 3 + 1] = 0.8 + Math.random() * 1.1; M3.dustPos[i * 3 + 2] = -0.8 + Math.random() * 1.2; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(M3.dustPos, 3));
  M3.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.006, transparent: true, opacity: 0.35, depthWrite: false })); sc.add(M3.dust);
  M3.cur = m3Wp('laptop');
  // pointer
  const cvs = renderer.domElement;
  cvs.addEventListener('mousemove', (e) => m3Pointer(e, false));
  cvs.addEventListener('mousedown', (e) => { if (e.button === 0) m3Pointer(e, true); });
  M3.built = true;
}

/* ======================================================================
   THE SAFE ROOM, FURNISHED  ·  cot, whiteboard, shelves, generator, radio table, lockers, couch, fridge, pinboard, clock, pipes, a turning vent
   ====================================================================== */
const safeAnim = { fan: null, led: [] };
function buildSafeExtras() {
  safeAnim.fan = null; safeAnim.led = [];
  const gm = (c, o) => new THREE.MeshPhongMaterial(Object.assign({ color: c, shininess: 18 }, o || {}));
  const steel = gm(0x6d6d6d, { shininess: 55, specular: 0x666666 }), steelD = gm(0x3b3b3b, { shininess: 40, specular: 0x444444 }), canvasM = gm(0x8a8a82), foam = gm(0x2a2a2a), cloth = gm(0x555552);
  const plane = (parent, w, h, x, y, z, mat, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); if (ry) m.rotation.y = ry; parent.add(m); return m; };
  const cylM = (parent, rt, rb, h, x, y, z, mat, seg) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat); m.position.set(x, y, z); parent.add(m); return m; };
  const tex = (w, h, paint) => { const t = canvasTex(w, h, paint); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(1, 1); return new THREE.MeshBasicMaterial({ map: t }); };
  const led = (parent, x, y, z, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.012), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); parent.add(m); safeAnim.led.push(m); return m; };

  // ---- a second cot against the west wall, a whiteboard above it with the days scratched off
  const cot = newGroup(4.3, 4.6, 0);
  addBox(cot, 0.9, 0.05, 2.0, 0, 0.36, 0, steelD); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((s) => addBox(cot, 0.05, 0.36, 0.05, s[0] * 0.42, 0.18, s[1] * 0.95, steel));
  addBox(cot, 0.82, 0.09, 1.9, 0, 0.43, 0, canvasM); addBox(cot, 0.5, 0.1, 0.34, 0, 0.52, -0.7, M.sheet); addBox(cot, 0.84, 0.05, 1.0, 0, 0.5, 0.35, cloth);
  addCollider(3.8, 3.55, 4.8, 5.65);
  const wb = newGroup(3.04, 4.6, Math.PI / 2);
  addBox(wb, 1.7, 1.05, 0.03, 0, 1.75, 0, M.frame);
  plane(wb, 1.62, 0.97, 0, 1.75, 0.017, tex(512, 308, (c, w, h) => {
    c.fillStyle = '#d9d9d3'; c.fillRect(0, 0, w, h); c.fillStyle = '#222'; c.font = 'bold 34px "Courier New", monospace'; c.fillText('DAYS', 24, 52);
    c.strokeStyle = '#222'; c.lineWidth = 4; for (let g = 0; g < 4; g++) for (let i = 0; i < 4; i++) { const x = 28 + g * 62 + i * 11; c.beginPath(); c.moveTo(x, 80 + (g % 2) * 70); c.lineTo(x, 130 + (g % 2) * 70); c.stroke(); } for (let g = 0; g < 4; g++) { c.beginPath(); c.moveTo(22 + g * 62, 135 + (g % 2) * 70); c.lineTo(78 + g * 62, 80 + (g % 2) * 70); c.stroke(); }
    c.font = '22px "Courier New", monospace'; c.fillText('KEYS: 5   (it hears running)', 280, 98); c.fillText('DON\'T USE THE GATE', 280, 138); c.fillText('LISTEN FIRST.', 280, 178); c.font = 'bold 30px "Courier New", monospace'; c.fillText('?', 420, 260);
    c.strokeStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 40; i++) { c.beginPath(); c.moveTo(Math.random() * w, Math.random() * h); c.lineTo(Math.random() * w, Math.random() * h); c.stroke(); }
  }));
  // ---- metal shelving full of supplies against the north wall
  const sh = newGroup(6.3, 3.18, 0);
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => addBox(sh, 0.05, 1.9, 0.05, sx * 1.0, 0.95, sz * 0.2, steel)));
  [0.2, 0.7, 1.2, 1.7].forEach((y) => addBox(sh, 2.05, 0.04, 0.46, 0, y, 0, steelD));
  for (let i = 0; i < 6; i++) cylM(sh, 0.04, 0.04, 0.11, -0.85 + i * 0.1, 0.27, -0.02, M.drawer, 10);
  for (let i = 0; i < 5; i++) cylM(sh, 0.05, 0.05, 0.28, 0.1 + i * 0.13, 0.36, 0.02, M.glass, 10);
  addBox(sh, 0.5, 0.28, 0.34, -0.55, 0.88, 0, M.cardboard); addBox(sh, 0.36, 0.22, 0.3, 0.05, 0.85, 0.02, M.cardboard); addBox(sh, 0.4, 0.2, 0.3, 0.6, 0.84, 0, M.cardboard);
  addBox(sh, 0.34, 0.26, 0.22, -0.7, 1.35, 0.02, M.pillar); addBox(sh, 0.12, 0.012, 0.12, -0.7, 1.485, 0.02, M.dark);                      // a first-aid kit (a pale box with a cross)
  addBox(sh, 0.05, 0.16, 0.012, -0.7, 1.35, 0.135, M.dark); addBox(sh, 0.16, 0.05, 0.012, -0.7, 1.35, 0.135, M.dark);
  for (let i = 0; i < 4; i++) addBox(sh, 0.16, 0.08, 0.12, -0.1 + i * 0.22, 1.78, 0, i % 2 ? M.books : M.paper);
  addBox(sh, 0.3, 0.18, 0.2, 0.7, 1.31, 0, M.dark);
  addCollider(5.25, 3.0, 7.35, 3.62);
  // ---- an old pinboard and a barred window on the north wall
  const pb = newGroup(14.1, 3.03, 0);
  addBox(pb, 2.1, 1.15, 0.04, 0, 1.6, 0, M.frame);
  plane(pb, 2.0, 1.05, 0, 1.6, 0.024, tex(512, 270, (c, w, h) => {
    c.fillStyle = '#56564f'; c.fillRect(0, 0, w, h); for (let i = 0; i < 1800; i++) { c.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0' : '255,255,255') + ',' + (Math.random() * 0.1).toFixed(2) + ')'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    const note = (x, y, ww, hh, r, t) => { c.save(); c.translate(x + ww / 2, y + hh / 2); c.rotate(r); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-ww / 2 + 3, -hh / 2 + 4, ww, hh); c.fillStyle = '#dcdcd6'; c.fillRect(-ww / 2, -hh / 2, ww, hh); c.fillStyle = '#222'; c.font = '15px "Courier New", monospace'; t.forEach((l, i) => c.fillText(l, -ww / 2 + 8, -hh / 2 + 24 + i * 17)); c.restore(); };
    note(24, 24, 120, 90, -0.05, ['EXIT KEYS', 'x5  hidden', 'in the house']); note(170, 18, 110, 100, 0.04, ['IT HEARS', 'the breath', 'the steps']); note(300, 30, 100, 80, -0.03, ['STAIRS', 'SAFE ROOM', 'ONLY.']);
    note(40, 150, 130, 90, 0.04, ['CAM 01-10', 'check them', 'before you go']); note(210, 140, 120, 100, -0.05, ['UPSTAIRS?', 'two floors.', 'be careful.']); note(370, 140, 110, 100, 0.03, ['DONT', 'RUN', 'IN THE DARK']);
    c.strokeStyle = 'rgba(20,20,20,0.8)'; c.lineWidth = 2; [[84, 24, 225, 18], [225, 18, 350, 30], [100, 150, 270, 140], [270, 140, 425, 140], [84, 24, 100, 150]].forEach((s) => { c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); c.stroke(); });
  }));
  const wn = newGroup(16.6, 3.03, 0);
  addBox(wn, 1.1, 1.3, 0.04, 0, 1.75, 0, M.frame); plane(wn, 0.96, 1.16, 0, 1.75, 0.025, new THREE.MeshBasicMaterial({ color: 0x8c8c8c }));
  for (let i = 0; i < 5; i++) addBox(wn, 0.03, 1.16, 0.03, -0.4 + i * 0.2, 1.75, 0.04, M.dark); addBox(wn, 0.96, 0.03, 0.03, 0, 1.75, 0.04, M.dark);
  // ---- east wall: generator, radio table, a clock, a vent that turns
  const gen = newGroup(17.25, 8.0, -Math.PI / 2);
  addBox(gen, 1.0, 0.7, 0.6, 0, 0.45, 0, steelD); addBox(gen, 1.02, 0.06, 0.62, 0, 0.8, 0, steel); cylM(gen, 0.04, 0.04, 0.5, 0.35, 1.05, -0.2, steel, 8); addBox(gen, 0.9, 0.14, 0.04, 0, 0.1, 0.18, M.dark);
  addBox(gen, 0.3, 0.18, 0.012, -0.25, 0.55, 0.306, M.dark); led(gen, -0.15, 0.58, 0.31, 0x9cffa8); led(gen, -0.3, 0.58, 0.31, 0xdddddd);
  const fuel = newGroup(17.3, 9.0, 0.3); addBox(fuel, 0.34, 0.45, 0.2, 0, 0.23, 0, M.drawer); addBox(fuel, 0.12, 0.06, 0.1, 0.08, 0.5, 0, M.dark);
  addCollider(16.6, 7.45, 17.95, 8.55); addCollider(17.1, 8.8, 17.5, 9.2);
  const rt = newGroup(17.3, 6.4, -Math.PI / 2);
  addBox(rt, 0.95, 0.05, 0.5, 0, 0.8, 0, M.wood); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((s) => addBox(rt, 0.05, 0.78, 0.05, s[0] * 0.43, 0.39, s[1] * 0.2, M.dark));
  addBox(rt, 0.55, 0.28, 0.3, -0.12, 0.97, 0, steelD); plane(rt, 0.2, 0.1, -0.12 + 0.12, 1.0, 0.153, tex(128, 64, (c, w, h) => { c.fillStyle = '#0b1a0d'; c.fillRect(0, 0, w, h); c.fillStyle = '#9cffa8'; c.font = '28px "Courier New", monospace'; c.fillText('92.4', 18, 40); }));
  cylM(rt, 0.025, 0.025, 0.025, -0.34, 0.96, 0.155, steel, 12).rotation.x = Math.PI / 2; cylM(rt, 0.025, 0.025, 0.025, -0.24, 0.96, 0.155, steel, 12).rotation.x = Math.PI / 2;
  const ant = cylM(rt, 0.006, 0.006, 0.8, 0.1, 1.4, -0.1, steel, 6); ant.rotation.z = -0.18; addBox(rt, 0.16, 0.07, 0.2, 0.3, 0.865, 0.0, M.books); addBox(rt, 0.22, 0.01, 0.15, 0.3, 0.9, 0.0, M.paper);
  addCollider(16.95, 5.9, 17.9, 6.9);
  const clock = newGroup(17.97, 5.2, -Math.PI / 2);
  const ck = new THREE.Mesh(new THREE.CircleGeometry(0.24, 28), tex(128, 128, (c, w, h) => { c.fillStyle = '#e6e6e0'; c.fillRect(0, 0, w, h); c.strokeStyle = '#111'; c.lineWidth = 5; c.beginPath(); c.arc(64, 64, 58, 0, TAU); c.stroke(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.beginPath(); c.moveTo(64 + Math.sin(a) * 50, 64 - Math.cos(a) * 50); c.lineTo(64 + Math.sin(a) * 58, 64 - Math.cos(a) * 58); c.stroke(); } c.lineWidth = 6; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + Math.sin(TAU * 2 / 12) * 32, 64 - Math.cos(TAU * 2 / 12) * 32); c.stroke(); c.lineWidth = 4; c.beginPath(); c.moveTo(64, 64); c.lineTo(64, 14); c.stroke(); })); ck.position.set(0, 2.1, 0.02); clock.add(ck);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.015, 8, 28), M.dark); rim.position.set(0, 2.1, 0.02); clock.add(rim);
  const vent = newGroup(17.97, 10.5, -Math.PI / 2);
  addBox(vent, 0.8, 0.8, 0.05, 0, 2.95, 0, M.dark); const fan = new THREE.Group(); fan.position.set(0, 2.95, 0.035); vent.add(fan);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.008), steel); b.position.set(Math.cos(i * Math.PI / 2) * 0.17, Math.sin(i * Math.PI / 2) * 0.17, 0); b.rotation.z = i * Math.PI / 2; fan.add(b); }
  for (let i = 0; i < 5; i++) addBox(vent, 0.74, 0.02, 0.03, 0, 2.7 + i * 0.12, 0.05, steelD);
  safeAnim.fan = fan;
  // ---- south wall: lockers, a couch facing the rug, a coffee table, a fridge and a water cooler
  const lk = newGroup(7.5, 11.62, Math.PI);
  for (let i = 0; i < 3; i++) {
    const x = -0.8 + i * 0.8; addBox(lk, 0.78, 1.95, 0.5, x, 0.98, 0, steel); addBox(lk, 0.7, 1.85, 0.02, x, 0.98, 0.26, steelD);
    for (let v = 0; v < 4; v++) addBox(lk, 0.4, 0.015, 0.012, x, 1.7 - v * 0.05, 0.272, M.dark); addBox(lk, 0.05, 0.14, 0.03, x + 0.26, 1.0, 0.285, M.dark);
  }
  addCollider(6.05, 11.3, 8.95, 12.0);
  const sofa = newGroup(10.5, 11.3, Math.PI);
  addBox(sofa, 2.3, 0.4, 0.95, 0, 0.3, 0, foam); addBox(sofa, 2.3, 0.62, 0.22, 0, 0.7, -0.36, foam); [-1, 1].forEach((s) => addBox(sofa, 0.2, 0.58, 0.95, s * 1.05, 0.5, 0, cloth));
  addBox(sofa, 1.0, 0.14, 0.7, -0.5, 0.57, 0.05, cloth); addBox(sofa, 1.0, 0.14, 0.7, 0.5, 0.57, 0.05, cloth); addBox(sofa, 0.5, 0.35, 0.12, -0.8, 0.82, -0.18, M.drawer).rotation.z = 0.25;
  addCollider(9.3, 10.78, 11.7, 11.85);
  const ct = newGroup(10.5, 9.55, 0.06);
  addBox(ct, 1.05, 0.05, 0.55, 0, 0.42, 0, M.wood); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((s) => addBox(ct, 0.05, 0.4, 0.05, s[0] * 0.48, 0.2, s[1] * 0.23, M.dark));
  cylM(ct, 0.04, 0.034, 0.09, 0.3, 0.495, 0.05, M.pillar, 12); addBox(ct, 0.28, 0.012, 0.2, -0.25, 0.455, 0.02, M.paper).rotation.y = 0.3; addBox(ct, 0.2, 0.03, 0.14, -0.3, 0.48, 0.0, M.books);
  addCollider(9.95, 9.25, 11.05, 9.85);
  const fr = newGroup(13.9, 11.6, Math.PI);
  addBox(fr, 0.72, 1.05, 0.66, 0, 0.53, 0, M.pillar); addBox(fr, 0.7, 0.012, 0.01, 0, 0.74, 0.335, M.dark); addBox(fr, 0.04, 0.3, 0.04, 0.28, 0.9, 0.35, steelD); addBox(fr, 0.04, 0.4, 0.04, 0.28, 0.45, 0.35, steelD); led(fr, -0.28, 0.98, 0.335, 0xdddddd);
  addCollider(13.5, 11.2, 14.3, 11.95);
  const wc = newGroup(15.2, 11.65, Math.PI);
  addBox(wc, 0.42, 0.9, 0.4, 0, 0.45, 0, M.pillar); cylM(wc, 0.17, 0.17, 0.42, 0, 1.12, 0, M.glass, 16); addBox(wc, 0.12, 0.05, 0.06, 0, 0.8, 0.21, M.dark);
  addCollider(14.95, 11.4, 15.45, 11.95);
  // ---- floor: a hazard strip in front of the steel door, papers, cans, boots, a bin
  const hz = tex(128, 128, (c, w, h) => { c.fillStyle = '#c9c9c3'; c.fillRect(0, 0, w, h); c.fillStyle = '#161616'; for (let i = -4; i < 8; i++) { c.beginPath(); c.moveTo(i * 24, 0); c.lineTo(i * 24 + 12, 0); c.lineTo(i * 24 + 12 + h, h); c.lineTo(i * 24 + h, h); c.closePath(); c.fill(); } c.globalAlpha = 0.35; for (let i = 0; i < 500; i++) { c.fillStyle = Math.random() < 0.5 ? '#000' : '#fff'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
  hz.polygonOffset = true; hz.polygonOffsetFactor = -2; hz.polygonOffsetUnits = -2;
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.0), hz); strip.rotation.x = -Math.PI / 2; strip.position.set(4.05, 0.014, 7.5); world.add(strip);
  [[7.6, 6.7, 0.5], [12.8, 8.4, -0.3], [9.0, 8.9, 1.2], [14.2, 6.6, 0.1]].forEach((p) => { const pp = newGroup(p[0], p[1], p[2]); addBox(pp, 0.28, 0.006, 0.2, 0, 0.012, 0, M.paper); addBox(pp, 0.22, 0.006, 0.28, 0.1, 0.018, 0.05, M.sheet); });
  [[8.4, 4.3], [8.55, 4.4], [12.9, 4.0]].forEach((p) => { const cn = newGroup(p[0], p[1], 0); cylM(cn, 0.035, 0.035, 0.1, 0, 0.05, 0, M.drawer, 10); });
  const bt = newGroup(5.6, 8.2, 0.7); addBox(bt, 0.12, 0.2, 0.3, -0.08, 0.1, 0, M.dark); addBox(bt, 0.12, 0.2, 0.3, 0.1, 0.1, 0.05, M.dark);
  const bin = newGroup(12.5, 3.55, 0); cylM(bin, 0.2, 0.17, 0.42, 0, 0.21, 0, steelD, 14); addCollider(12.28, 3.33, 12.72, 3.77);
  // ---- pipes under the ceiling
  const p1 = cylM(world, 0.06, 0.06, 15, 10.5, WALL_H - 0.25, 3.14, steel, 10); p1.rotation.z = Math.PI / 2; const p2 = cylM(world, 0.045, 0.045, 15, 10.5, WALL_H - 0.45, 3.1, steelD, 8); p2.rotation.z = Math.PI / 2;
  cylM(world, 0.06, 0.06, WALL_H, 17.9, WALL_H / 2, 3.15, steel, 10);
  addLamp(14.6, 10.0, WALL_H - 0.05, 1.3, true); addLamp(5.4, 4.8, WALL_H - 0.05, 0.9, false);
}
function updateSafeProps(dt) {
  if (safeAnim.fan) safeAnim.fan.rotation.z += dt * 3.2;
  if (safeAnim.led.length) { const on = (Math.sin(S.time * 3) > -0.3); safeAnim.led.forEach((l, i) => { l.visible = i % 2 ? true : on; }); }
}

/* ======================================================================
   SPLASH SCREEN + LOADING  ·  key hints that follow the key bindings  ·  button click animation
   ====================================================================== */
function keyHintsRefresh() {
  const set = (sel, txt) => { const e = document.querySelector(sel); if (e) e.innerHTML = txt; };
  set('#cam-hint', '[1-9, 0] / D-Pad: switch camera &nbsp;&nbsp; ' + bindHint('interact') + ' / [Circle]: close laptop');
  set('#term-view p', bindHint('interact') + ' / [Square] to close');
  set('#note-view p', bindHint('interact') + ' / [Square] to put it back');
}
function initButtonFx() {
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!b || b.id === 'sp-press') return;
    b.classList.remove('clicked'); void b.offsetWidth; b.classList.add('clicked');
    setTimeout(() => b.classList.remove('clicked'), 340);
  }, true);
}
function splashBoot() {
  const sp = document.getElementById('splash');
  if (window.__noSplash || !sp || !sp.classList) { init(); return; }
  const dummy = { classList: { add() {}, remove() {} }, style: {}, textContent: '' };
  const $ = (id) => document.getElementById(id) || dummy;
  const fill = $('sp-fill'), status = $('sp-status'), tag = $('sp-tag');
  const stages = [['WAKING THE WATCHER', initA], ['COUNTING THE KEYS', initB], ['SETTING UP THE DESK', initC], ['CONNECTING THE CAMERAS', initD]];
  let next = 0, finished = false, tt = 0;
  const runRest = () => { while (next < stages.length) { const f = stages[next++][1]; try { f(); } catch (e) { console.error(e); } } };      // whatever the splash did not get to
  const dismiss = () => { sp.classList.add('out'); setTimeout(() => sp.classList.add('gone'), 1100); };
  const fail = (e) => { console.error('splash problem - starting the game directly', e); try { runRest(); } catch (e2) { console.error(e2); } finished = true; try { Snd.init(); m3Intro(2.4); } catch (e3) { /* ignore */ } dismiss(); };
  try { if (document.fonts && document.fonts.load) { document.fonts.load('40px VT323'); document.fonts.load('20px "Special Elite"'); } } catch (e) { /* ignore */ }
  $('sp-s1').classList.add('show');
  const line = 'There is no colour here. Only the light, and what it shows you.';
  let ti = 0;
  const ready = () => {
    try {
      finished = true; $('sp-load').classList.remove('show'); $('sp-press').classList.add('show');
      const go = () => {
        window.removeEventListener('keydown', go); window.removeEventListener('pointerdown', go);
        try { Snd.init(); m3Intro(3.8); Snd.whoosh(1.2); } catch (e) { console.error(e); }
        dismiss();
      };
      window.addEventListener('keydown', go); window.addEventListener('pointerdown', go);
    } catch (e) { fail(e); }
  };
  const step = (i) => {
    try {
      if (i >= stages.length) { fill.style.width = '100%'; status.textContent = 'READY'; setTimeout(ready, 500); return; }
      status.textContent = stages[i][0]; fill.style.width = (8 + i * 22) + '%';
      setTimeout(() => {
        try { next = i + 1; stages[i][1](); } catch (e) { fail(e); return; }
        fill.style.width = (8 + (i + 1) * 22) + '%'; setTimeout(() => step(i + 1), 280);
      }, 140);
    } catch (e) { fail(e); }
  };
  setTimeout(() => {
    try {
      $('sp-s2').classList.add('show'); $('sp-load').classList.add('show');
      tt = setInterval(() => { tag.textContent = line.slice(0, ++ti); if (ti >= line.length) clearInterval(tt); }, 38);
      step(0);
    } catch (e) { fail(e); }
  }, 2100);
  setTimeout(() => { if (!finished) fail(new Error('the loading screen took too long')); }, 20000);                                              // safety net
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
  const rC = row('Controls');
  const cb = document.createElement('button'); cb.type = 'button'; cb.className = 'tog'; cb.textContent = 'CUSTOMIZE KEYS…';
  cb.addEventListener('click', () => openModal('controls'));
  rC.appendChild(cb);
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
function openModal(id) { closeModals(); el[id].classList.add('open'); modalOpen = id; if (id === 'settings') refreshSettingsUI(); if (id === 'controls') ctlRefresh(); }
function closeModals() { el.settings.classList.remove('open'); el.about.classList.remove('open'); if (el.controls) el.controls.classList.remove('open'); modalOpen = null; if (typeof ctlWait !== 'undefined') ctlWait = null; }
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
    case 'mp': return el.mp;
    case 'lobby': return el.lobby;
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
  else if (S.mode === 'mp' || S.mode === 'lobby') mpBack();
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
  ctlInit();
  buildSettingsUI(el['set-host-menu']); buildSettingsUI(el['set-host-pause']);
  refreshSettingsUI(); applyFx(); applyQuality(); applyShadowMode(Settings.shadows);
  el['btn-settings'].addEventListener('click', () => openModal('settings'));
  el['btn-set-back'].addEventListener('click', closeModals);
  el['btn-about'].addEventListener('click', () => openModal('about'));
  el['btn-about-close'].addEventListener('click', closeModals);
  // (the multiplayer button is wired in initMultiplayerUI)
  el['photo-input'].addEventListener('change', () => {
    const files = el['photo-input'].files;
    if (files && files.length) pickPhotos(files).then((n) => { refreshSettingsUI(); toast(n ? n + ' PHOTO' + (n > 1 ? 'S' : '') + ' ADDED' : 'COULD NOT READ THOSE IMAGES', 2200); });
  });
  window.addEventListener('mousemove', () => { if (UINav.padUsed) { UINav.padUsed = false; clearNavFocus(); } });   // mouse takes over: hide the controller outline
}

function initA() {
  buildWorld(newSeed());
  monMesh = buildMonsterMesh();
}
function initB() {
  buildViewmodel(); buildHotbar(); initMenuExtras(); initDust(); keyHintsRefresh(); initButtonFx();
}
function initC() {
  try { m3Build(); } catch (e) { console.error('3D menu could not be built - using the flat menu', e); M3.built = false; }
}
function initD() {
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
  initKeypadUI();
  initMultiplayerUI();
  vrInit();
  el['btn-begin'].addEventListener('click', beginGame);
  el['btn-retry'].addEventListener('click', () => chooseDeath('retry'));
  el['btn-menu'].addEventListener('click', () => chooseDeath('menu'));
  el['btn-again'].addEventListener('click', () => { if (MP.active) mpAfterWin(); else { S.act = 1; beginGame(); } });
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
    if (!S.locked && S.mode === 'play' && !Input.isPad() && !Input.isTouch() && !DBG.panel) setPause(true);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && !VR.active) setPause(true); });
  renderer.domElement.addEventListener('click', () => { if (S.mode === 'play' && !document.pointerLockElement) lockPointer(); });
  window.addEventListener('gamepadconnected', () => { el['menu-hint'].textContent = 'CONTROLLER CONNECTED'; toast('CONTROLLER CONNECTED', 1800); });
  window.addEventListener('resize', onResize);
  const firstGesture = () => { Snd.init(); };
  window.addEventListener('pointerdown', firstGesture); window.addEventListener('keydown', firstGesture);

  dbgInit();
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
    setMode, roomId, discovered, corridorRuns, Snd, exitDoor, exitHatch, questSpots, consoleRadar, audioScreen, sideStatic, startFall, updateFall, startAct2, showAct2Lore, giveQuest, startRadio, sewerInfo, sref, platforms, ramps, pitMask, blockedEdges, floorH, roomLocal, roomPos, enterCloset, exitCloset, openTerminal, openKeypad, kpDigit, kpClear, kpSubmit, kp, useLocker, TERM_LOGS, generateSewer,
    objectiveList, renderObjectives, objectivesDone, drawBrokenRadar, monitorHook, unlockNextLock, useExitDoor, resetAct2State, OBJ2, toActSelect, pickAct, uiBack,
    colliders, M3, m3Press, m3Nav, m3Want, m3Frame, m3LoreStart, m3LoreAdvance, m3On, m3Active, m3Go, m3Intro, wakeUp, TAB, tabletOpen, tabletClose, tabletGo, bindSet, bindCode, bindReset, BIND, codeLabel, DBG, dbgRun, dbgPanel, dbgCamOn, dbgHideUI, dbgLabOn, dbgPose, dbgShot, dbgInner, dbgCapture, dbgBring, dbgFloor, FLOORS, floorsOn, floorKeys, doChangeFloor, startFloorChange, snapshotFloor, restoreFloor, reserveStairs, monsterArrive, floorH, ramps, platforms, VR, vrStart, vrExit, vrFillInput, vrBeginFrame, vrEndFrame, vrRotateRig, vrDrawHud, vrPage, vrHit, vrLayout, vrUiPress, vrUiBack, Settings, vrBuildKits, vrOnEnd, vrHaptic, getRaf: () => rafPending, vrLoop, MP, mpKeysFor, setKeysNeeded, withSeed, QD, mpOpenMenu, mpCreateLobby, mpJoinLobby, mpSetVisibility, mpStartGame, mpLeave, mpLeaveLobby, mpBack, mpTick, mpOnMessage, mpMeta, mpViews, mpSpectateStart, mpPresenceList, mpBuildSilhouette, mpSetName, mpDirSync, mpClientMonster, mpSendState, TOTAL_KEYS_GET: () => TOTAL_KEYS, pickups, doors, dieNow, breath, startFall, updateFall, chooseDeath, finishDeath,
  };
  rafPending = true; requestAnimationFrame(frame);
}
function init() { initA(); initB(); initC(); initD(); }
splashBoot();
})();
