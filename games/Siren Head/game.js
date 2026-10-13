/* =====================================================================
   SIREN HEAD: THE FOREST ESCAPE
   Single-scope game script. Three.js r128 (CDN) + Web Audio + Gamepad.
   Sections:
     1. helpers & settings      6. interactables, items, game state
     2. procedural audio        7. player controller
     3. renderer, sky, lights   8. Siren Head (model, AI, kill scene)
     4. textures & builders     9. cutscenes (truck / radio)
     5. world & buildings      10. UI, map, input, main loop
   ===================================================================== */
(function () {
'use strict';

if (typeof THREE === 'undefined') {
  var ld = document.getElementById('loading');
  if (ld) ld.innerHTML = '<div class="loading-inner"><div class="loading-title">Offline</div><div class="loading-sub">Three.js could not be loaded from the CDN.<br>Connect to the internet and reload.</div></div>';
  return;
}
window.addEventListener('error', function (e) {
  var l = document.getElementById('loading');
  if (l && !l.classList.contains('done')) {
    var sub = l.querySelector('.loading-sub');
    if (sub) sub.textContent = 'Startup error: ' + (e.message || 'unknown') + (e.lineno ? ' (game.js line ' + e.lineno + ')' : '');
  }
});

/* ------------------------------------------------------------------
   1. HELPERS & SETTINGS
------------------------------------------------------------------ */
const V3 = THREE.Vector3;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const wrng = mulberry32(20261012);            // world seed: the forest is always the same forest
const wr = (a, b) => a + wrng() * (b - a);

const isTouch = (('ontouchstart' in window) || navigator.maxTouchPoints > 0) &&
  window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

const settings = { sens: 1.0, master: 0.8, sfx: 1.0, amb: 0.8, quality: 'auto' };
try { Object.assign(settings, JSON.parse(localStorage.getItem('sirenhead_settings_v1') || '{}')); } catch (e) { /* private mode */ }
function saveSettings() { try { localStorage.setItem('sirenhead_settings_v1', JSON.stringify(settings)); } catch (e) { /* ignore */ } }

const QUALITY = {
  low:    { trees: 650,  pr: 1.0, far: 200 },
  medium: { trees: 1250, pr: 1.5, far: 260 },
  high:   { trees: 2000, pr: 2.0, far: 320 }
};
function currentQuality() {
  const q = settings.quality === 'auto' ? (isTouch ? 'low' : 'high') : settings.quality;
  return QUALITY[q] || QUALITY.medium;
}

/* ------------------------------------------------------------------
   2. PROCEDURAL AUDIO (no audio files at all)
------------------------------------------------------------------ */
const SFX = (function () {
  let ctx = null, master, sfxBus, ambBus, ambLP, revIn, noiseBuf, mPan, mWet, crush, tensionG, tensionO1, tensionO2;
  const loops = [];

  const setPos = (p, x, y, z) => {
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; }
    else if (p.setPosition) p.setPosition(x, y, z);
  };
  function makeNoise(sec) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function makeImpulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  function envGain(t, atk, hold, rel, peak, dest) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + atk);
    g.gain.setValueAtTime(peak, t + atk + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + atk + hold + rel);
    g.connect(dest || sfxBus);
    return g;
  }
  function osc(type, f, t, dur, dest) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    o.connect(dest); o.start(t); o.stop(t + dur); return o;
  }
  function noise(t, dur, dest, rate) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    if (rate) s.playbackRate.value = rate;
    s.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur); return s;
  }
  function filt(type, f, q, dest) {
    const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; if (dest) b.connect(dest); return b;
  }
  function panner(ref, roll) {
    const p = ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
    p.refDistance = ref; p.maxDistance = 20000; p.rolloffFactor = roll;
    return p;
  }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    master = ctx.createGain(); master.gain.value = settings.master;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = settings.sfx; sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = settings.amb;
    ambLP = filt('lowpass', 16000, 0.7, master); ambBus.connect(ambLP);
    noiseBuf = makeNoise(2);
    const rev = ctx.createConvolver(); rev.buffer = makeImpulse(3.2, 2.4);
    revIn = ctx.createGain(); revIn.gain.value = 1; revIn.connect(rev);
    const revOut = ctx.createGain(); revOut.gain.value = 0.55; rev.connect(revOut); revOut.connect(sfxBus);
    // monster voice bus: one persistent 3D panner that follows the creature's head
    mPan = panner(34, 0.85); mPan.connect(sfxBus);
    mWet = ctx.createGain(); mWet.gain.value = 0.5; mPan.connect(mWet); mWet.connect(revIn);
    // bit-crusher for the garbled mimic voices
    crush = ctx.createWaveShaper();
    const c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 127.5 - 1; c[i] = Math.round(x * 6) / 6; }
    crush.curve = c;
    const crushOut = ctx.createGain(); crushOut.gain.value = 0.5; crush.connect(crushOut); crushOut.connect(mPan);
    // tension drone (rises as the creature gets close)
    tensionG = ctx.createGain(); tensionG.gain.value = 0; tensionG.connect(sfxBus);
    const lp = filt('lowpass', 220, 0.7, tensionG);
    tensionO1 = ctx.createOscillator(); tensionO1.type = 'sawtooth'; tensionO1.frequency.value = 41; tensionO1.connect(lp); tensionO1.start();
    tensionO2 = ctx.createOscillator(); tensionO2.type = 'sawtooth'; tensionO2.frequency.value = 43.6; tensionO2.connect(lp); tensionO2.start();
    startAmbient();
  }

  /* ---------- ambience: wind, crickets, owls, creaks ---------- */
  function startAmbient() {
    const w = ctx.createBufferSource(); w.buffer = noiseBuf; w.loop = true;
    const wf = filt('lowpass', 360, 0.8), wg = ctx.createGain(); wg.gain.value = 0.2;
    w.connect(wf); wf.connect(wg); wg.connect(ambBus); w.start();
    const l1 = ctx.createOscillator(); l1.frequency.value = 0.11; const g1 = ctx.createGain(); g1.gain.value = 170; l1.connect(g1); g1.connect(wf.frequency); l1.start();
    const l2 = ctx.createOscillator(); l2.frequency.value = 0.07; const g2 = ctx.createGain(); g2.gain.value = 0.09; l2.connect(g2); g2.connect(wg.gain); l2.start();
    // leaf hiss
    const h = ctx.createBufferSource(); h.buffer = noiseBuf; h.loop = true; h.playbackRate.value = 0.7;
    const hf = filt('highpass', 4200, 0.5), hg = ctx.createGain(); hg.gain.value = 0.012;
    h.connect(hf); hf.connect(hg); hg.connect(ambBus); h.start();
    // crickets: two detuned gated sines
    [4380, 4710].forEach((fr, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
      const g = ctx.createGain(); g.gain.value = 0.007;
      const gate = ctx.createOscillator(); gate.type = 'square'; gate.frequency.value = 15 + i * 2.3;
      const gg = ctx.createGain(); gg.gain.value = 0.007; gate.connect(gg); gg.connect(g.gain);
      const slow = ctx.createOscillator(); slow.frequency.value = 0.33 + i * 0.1; const sg = ctx.createGain(); sg.gain.value = 0.006; slow.connect(sg); sg.connect(g.gain);
      o.connect(g); g.connect(ambBus); o.start(); gate.start(); slow.start();
    });
    scheduleAmbientEvent();
  }
  function scheduleAmbientEvent() {
    setTimeout(() => { ambientEvent(); scheduleAmbientEvent(); }, rand(5000, 13000));
  }
  function ambientEvent() {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime, r = Math.random();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = rand(-0.9, 0.9); pan.connect(ambBus); }
    const dest = pan || ambBus;
    if (r < 0.35) {            // owl
      for (let i = 0; i < 3; i++) {
        const g = envGain(t + i * 0.55, 0.05, 0.18, 0.3, 0.05, dest);
        const f = filt('lowpass', 700, 1, g);
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(i === 2 ? 340 : 400, t + i * 0.55);
        o.frequency.linearRampToValueAtTime(i === 2 ? 290 : 360, t + i * 0.55 + 0.4);
        o.connect(f); o.start(t + i * 0.55); o.stop(t + i * 0.55 + 0.6);
      }
    } else if (r < 0.7) {      // old tree creak
      const g = envGain(t, 0.4, 0.6, 0.9, 0.05, dest);
      const f = filt('bandpass', 260, 7, g);
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(rand(50, 70), t); o.frequency.linearRampToValueAtTime(rand(80, 120), t + 1.7);
      o.connect(f); o.start(t); o.stop(t + 2);
    } else {                   // twig snap close by
      const g = envGain(t, 0.001, 0.004, 0.08, 0.16, dest);
      const f = filt('bandpass', rand(1800, 3200), 3, g);
      noise(t, 0.12, f);
    }
  }

  /* ---------- UI / world sounds ---------- */
  const A = {
    init, ready: () => !!ctx && ctx.state === 'running',
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    applySettings() {
      if (!ctx) return;
      master.gain.value = settings.master; sfxBus.gain.value = settings.sfx; ambBus.gain.value = settings.amb;
    },
    listener(p, f) {
      if (!ctx) return;
      const L = ctx.listener;
      if (L.positionX) {
        L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
        L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z;
        L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
      } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
    },
    monsterPos(x, y, z) { if (ctx) setPos(mPan, x, y, z); },
    setIndoor(b) { if (ctx) ambLP.frequency.setTargetAtTime(b ? 650 : 16000, ctx.currentTime, 0.25); },
    setTension(v) {
      if (!ctx) return;
      tensionG.gain.setTargetAtTime(clamp(v, 0, 1) * 0.28, ctx.currentTime, 0.4);
      tensionO1.frequency.setTargetAtTime(41 + v * 10, ctx.currentTime, 0.5);
    },
    click(v) {
      if (!ctx) return; const t = ctx.currentTime;
      const g = envGain(t, 0.001, 0.004, 0.05, v || 0.3); noise(t, 0.08, filt('bandpass', 2400, 1.2, g));
      osc('square', 180, t, 0.03, envGain(t, 0.001, 0.01, 0.03, 0.05));
    },
    step(surface, v) {
      if (!ctx) return; const t = ctx.currentTime;
      const fr = { road: 1900, wood: 1000, concrete: 1500, dirt: 600, grass: 480 }[surface] || 600;
      const g = envGain(t, 0.004, 0.01, 0.1, v || 0.16);
      noise(t, 0.16, filt('lowpass', fr, 0.7, g), 0.8 + Math.random() * 0.4);
      if (surface === 'wood' || surface === 'concrete') osc('sine', 100 + Math.random() * 30, t, 0.14, g);
    },
    pickup() {
      if (!ctx) return; const t = ctx.currentTime;
      osc('triangle', 660, t, 0.2, envGain(t, 0.005, 0.04, 0.12, 0.13));
      osc('triangle', 990, t + 0.08, 0.25, envGain(t + 0.08, 0.005, 0.05, 0.16, 0.12));
    },
    error() { if (!ctx) return; const t = ctx.currentTime; osc('sawtooth', 95, t, 0.22, filt('lowpass', 500, 1, envGain(t, 0.01, 0.1, 0.1, 0.16))); },
    door(open) {
      if (!ctx) return; const t = ctx.currentTime;
      const g = envGain(t, 0.06, 0.45, 0.25, 0.1);
      const f = filt('bandpass', 380, 6, g);
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(open ? 80 : 130, t); o.frequency.linearRampToValueAtTime(open ? 130 : 78, t + 0.7);
      o.connect(f); o.start(t); o.stop(t + 0.8);
      if (!open) { const t2 = t + 0.62; osc('sine', 70, t2, 0.18, envGain(t2, 0.003, 0.02, 0.12, 0.25)); }
    },
    thump(v) { if (!ctx) return; const t = ctx.currentTime; const o = osc('sine', 120, t, 0.4, envGain(t, 0.003, 0.03, 0.3, v || 0.3)); o.frequency.exponentialRampToValueAtTime(40, t + 0.3); },
    zap() {
      if (!ctx) return; const t = ctx.currentTime;
      noise(t, 0.3, filt('highpass', 2500, 0.7, envGain(t, 0.002, 0.04, 0.22, 0.16)));
      const o = osc('square', 900, t, 0.4, envGain(t, 0.002, 0.05, 0.3, 0.1)); o.frequency.exponentialRampToValueAtTime(60, t + 0.35);
    },
    powerUp() {
      if (!ctx) return; const t = ctx.currentTime;
      A.thump(0.5);
      const g = envGain(t, 3, 3, 3, 0.12);
      const o = osc('sawtooth', 38, t, 9, filt('lowpass', 260, 1, g)); o.frequency.exponentialRampToValueAtTime(52, t + 4);
      for (let i = 0; i < 9; i++) { const tt = t + 0.3 + i * rand(0.25, 0.7); noise(tt, 0.05, filt('bandpass', 3200, 2, envGain(tt, 0.001, 0.005, 0.04, 0.12))); }
    },
    beep(f, d, v) { if (!ctx) return; const t = ctx.currentTime; osc('sine', f || 880, t, (d || 0.12) + 0.05, envGain(t, 0.004, d || 0.12, 0.03, v || 0.1)); },
    morse() { if (!ctx) return; const t = ctx.currentTime; [0, 0.14, 0.28, 0.6, 0.88, 1.02].forEach((o, i) => osc('sine', 760, t + o, 0.2, envGain(t + o, 0.003, i === 3 ? 0.22 : 0.07, 0.02, 0.09))); },
    crank() {
      if (!ctx) return; const t = ctx.currentTime;
      const o = osc('sawtooth', 70, t, 0.45, filt('lowpass', 420, 1, envGain(t, 0.02, 0.28, 0.15, 0.2))); o.frequency.exponentialRampToValueAtTime(34, t + 0.4);
      noise(t, 0.3, filt('lowpass', 300, 1, envGain(t, 0.02, 0.2, 0.1, 0.1)));
    },
    engine() {
      if (!ctx) return null;
      const g = ctx.createGain(); g.gain.value = 0; g.connect(sfxBus);
      const lp = filt('lowpass', 420, 0.8, g);
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 36; o1.connect(lp); o1.start();
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 18; const g2 = ctx.createGain(); g2.gain.value = 0.5; o2.connect(g2); g2.connect(lp); o2.start();
      const lfo = ctx.createOscillator(); lfo.frequency.value = 14; const lg = ctx.createGain(); lg.gain.value = 0.05; lfo.connect(lg); lg.connect(g.gain); lfo.start();
      const h = { set(rpm, vol) { const t = ctx.currentTime; o1.frequency.setTargetAtTime(32 + rpm * 90, t, 0.12); o2.frequency.setTargetAtTime(16 + rpm * 45, t, 0.12); lp.frequency.setTargetAtTime(380 + rpm * 900, t, 0.12); g.gain.setTargetAtTime(vol, t, 0.1); },
        stop() { const t = ctx.currentTime; g.gain.setTargetAtTime(0, t, 0.25); setTimeout(() => { try { o1.stop(); o2.stop(); lfo.stop(); } catch (e) { /* ok */ } }, 1500); } };
      loops.push(h); return h;
    },
    police() {
      if (!ctx) return null;
      const g = ctx.createGain(); g.gain.value = 0; g.connect(sfxBus);
      const rv = ctx.createGain(); rv.gain.value = 0.4; g.connect(rv); rv.connect(revIn);
      const lp = filt('lowpass', 2600, 0.6, g);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 900;
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 903; const g2 = ctx.createGain(); g2.gain.value = 0.3;
      const lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 0.55; const lg = ctx.createGain(); lg.gain.value = 330;
      lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
      o.connect(lp); o2.connect(g2); g2.connect(lp); o.start(); o2.start(); lfo.start();
      const h = { vol(v) { g.gain.setTargetAtTime(v, ctx.currentTime, 0.3); }, stop() { g.gain.setTargetAtTime(0, ctx.currentTime, 0.4); setTimeout(() => { try { o.stop(); o2.stop(); lfo.stop(); } catch (e) { /* ok */ } }, 2000); } };
      loops.push(h); return h;
    },
    hum(x, y, z) {
      if (!ctx) return null;
      const p = panner(3, 1.6); setPos(p, x, y, z); p.connect(sfxBus);
      const lp = filt('lowpass', 240, 1, p); const g = ctx.createGain(); g.gain.value = 0.22; g.connect(lp);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 50; o.connect(g); o.start();
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 100.4; const g2 = ctx.createGain(); g2.gain.value = 0.06; o2.connect(g2); g2.connect(lp); o2.start();
      const h = { stop() { try { o.stop(); o2.stop(); } catch (e) { /* ok */ } } }; loops.push(h); return h;
    },
    radioLoop(x, y, z) {
      if (!ctx) return null;
      const p = panner(2.5, 1.5); setPos(p, x, y, z); p.connect(sfxBus);
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const bp = filt('bandpass', 1700, 0.8);
      const gain = ctx.createGain(); gain.gain.value = 0.05; s.connect(bp); bp.connect(gain); gain.connect(p); s.start();
      const iv = setInterval(() => { if (ctx) gain.gain.setTargetAtTime(rand(0.02, 0.09), ctx.currentTime, 0.05); }, 140);
      const h = { stop() { clearInterval(iv); try { s.stop(); } catch (e) { /* ok */ } } }; loops.push(h); return h;
    },
    stopLoops() { loops.splice(0).forEach(l => { try { l.stop(); } catch (e) { /* ok */ } }); },

    /* ---------- the creature ---------- */
    sirenCall(strength) {
      if (!ctx) return 0; const t = ctx.currentTime, dur = 5.2 + Math.random() * 2.2, pk = 0.8 * (strength || 1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + 1.1);
      g.gain.setValueAtTime(pk, t + dur - 1.9); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const pk2 = ctx.createBiquadFilter(); pk2.type = 'peaking'; pk2.frequency.value = 760; pk2.gain.value = 9; pk2.Q.value = 0.8;
      const hp = filt('highpass', 130, 0.7, pk2); pk2.connect(g); g.connect(mPan);
      const base = 180 + Math.random() * 40;
      [['sawtooth', 1], ['square', 1.005]].forEach(([ty, m], i) => {
        const o = ctx.createOscillator(); o.type = ty;
        o.frequency.setValueAtTime(base * m, t);
        o.frequency.linearRampToValueAtTime(base * 2.9 * m, t + dur * 0.38);
        o.frequency.linearRampToValueAtTime(base * 2.75 * m, t + dur * 0.62);
        o.frequency.linearRampToValueAtTime(base * 0.9 * m, t + dur);
        const vib = ctx.createOscillator(); vib.frequency.value = 5.3 + i; const vg = ctx.createGain(); vg.gain.value = 7; vib.connect(vg); vg.connect(o.frequency);
        const og = ctx.createGain(); og.gain.value = i ? 0.35 : 0.6; o.connect(og); og.connect(hp);
        o.start(t); vib.start(t); o.stop(t + dur + 0.1); vib.stop(t + dur + 0.1);
      });
      noise(t, dur, filt('bandpass', 950, 0.9, envGain(t, 1.2, dur - 3, 1.8, 0.1, mPan)));
      return dur;
    },
    mimic() {
      if (!ctx) return; let t = ctx.currentTime + 0.05;
      const base = rand(120, 260), n = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const d = rand(0.14, 0.34), f0 = base * rand(0.85, 1.4);
        const g = envGain(t, 0.02, d * 0.6, d * 0.4, 0.4, crush);
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * rand(0.8, 1.25), t + d);
        const f1 = filt('bandpass', rand(400, 900), 5, g), f2 = filt('bandpass', rand(1100, 2400), 6, g);
        o.connect(f1); o.connect(f2); o.start(t); o.stop(t + d + 0.1);
        t += d + rand(0.03, 0.18);
      }
      A.staticBurst(0.5, 0.35, t - ctx.currentTime);
    },
    staticBurst(dur, vol, delay) {
      if (!ctx) return; const t = ctx.currentTime + (delay || 0);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
      for (let i = 0; i < dur / 0.04; i++) g.gain.setValueAtTime((vol || 0.4) * Math.random(), t + i * 0.04);
      g.gain.setValueAtTime(0.0001, t + dur); g.connect(mPan);
      noise(t, dur, filt('bandpass', rand(1400, 3400), 0.7, g));
    },
    footThud(v) {
      if (!ctx) return; const t = ctx.currentTime;
      const g = envGain(t, 0.004, 0.05, 0.5, v || 1, mPan);
      const o = osc('sine', 78, t, 0.7, g); o.frequency.exponentialRampToValueAtTime(26, t + 0.45);
      noise(t, 0.4, filt('lowpass', 170, 0.8, envGain(t, 0.003, 0.04, 0.3, (v || 1) * 0.9, mPan)));
    },
    screech(vol) {
      if (!ctx) return; const t = ctx.currentTime, d = 3.4;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol || 0.7, t + 0.5); g.gain.setValueAtTime(vol || 0.7, t + d - 0.6); g.gain.linearRampToValueAtTime(0.0001, t + d);
      g.connect(sfxBus); const rv = ctx.createGain(); rv.gain.value = 0.5; g.connect(rv); rv.connect(revIn);
      [220, 330, 553].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = i === 1 ? 'square' : 'sawtooth';
        o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 3.1, t + d * 0.7); o.frequency.linearRampToValueAtTime(f * 2.4, t + d);
        const og = ctx.createGain(); og.gain.value = 0.35; o.connect(og); og.connect(g); o.start(t); o.stop(t + d + 0.1);
      });
      noise(t, d, filt('bandpass', 2400, 0.6, envGain(t, 0.4, d - 1, 0.6, 0.25)));
    },
    crunch() {
      if (!ctx) return; const t = ctx.currentTime;
      noise(t, 0.6, filt('lowpass', 3000, 0.8, envGain(t, 0.001, 0.06, 0.5, 0.9)));
      const o = osc('square', 220, t, 0.8, envGain(t, 0.001, 0.05, 0.6, 0.6)); o.frequency.exponentialRampToValueAtTime(30, t + 0.6);
      A.thump(0.9);
    },
    heartbeat(v) {
      if (!ctx) return; const t = ctx.currentTime;
      osc('sine', 58, t, 0.2, envGain(t, 0.005, 0.03, 0.12, v || 0.4));
      osc('sine', 52, t + 0.2, 0.2, envGain(t + 0.2, 0.005, 0.03, 0.12, (v || 0.4) * 0.8));
    }
  };
  return A;
})();

/* ------------------------------------------------------------------
   3. RENDERER, SKY, LIGHTS
------------------------------------------------------------------ */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, currentQuality().pr));
renderer.setSize(window.innerWidth, window.innerHeight);

const FOG_COLOR = 0x222a38;
const scene = new THREE.Scene();
scene.background = new THREE.Color(FOG_COLOR);
scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0088);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 900);
camera.rotation.order = 'YXZ';
scene.add(camera);

scene.add(new THREE.AmbientLight(0x6a7ca4, 1.0));
scene.add(new THREE.HemisphereLight(0x7088b8, 0x1d2018, 0.32));
const moon = new THREE.DirectionalLight(0x95aadb, 0.38);
moon.position.set(-60, 100, 40);
scene.add(moon);

// flashlight: a spotlight riding on the camera
const flashlight = new THREE.SpotLight(0xfff0d2, 0, 85, 0.44, 0.55, 1.25);
flashlight.position.set(0.18, -0.12, 0);
camera.add(flashlight);
camera.add(flashlight.target);
flashlight.target.position.set(0, 0, -10);

// pool of dynamic point lights (assigned to the nearest lit lamps)
const POOL = [];
for (let i = 0; i < 4; i++) {
  const l = new THREE.PointLight(0xffe2b0, 0, 18, 2);
  scene.add(l);
  POOL.push({ light: l, lamp: null, fade: 0 });
}
// cinematic lights (headlights / police bar), always present so shader light counts never change
const truckLight = new THREE.SpotLight(0xfff4d8, 0, 120, 0.5, 0.45, 1.1);
scene.add(truckLight); scene.add(truckLight.target);
const policeLight = new THREE.PointLight(0xff2020, 0, 40, 2);
scene.add(policeLight);

// sky dome
(function buildSky() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#04060b'); gr.addColorStop(0.3, '#0a0f1c'); gr.addColorStop(0.46, '#1e2636');
  gr.addColorStop(0.5, '#2c3445'); gr.addColorStop(1, '#222a38');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  const warm = g.createRadialGradient(780, 256, 5, 780, 256, 260);
  warm.addColorStop(0, 'rgba(120,70,62,0.5)'); warm.addColorStop(1, 'rgba(120,70,62,0)');
  g.fillStyle = warm; g.fillRect(0, 100, 1024, 160);
  const r = mulberry32(77);
  for (let i = 0; i < 520; i++) { const y = r() * 230; g.fillStyle = 'rgba(255,255,255,' + (0.15 + r() * 0.6) + ')'; g.fillRect(r() * 1024, y, r() < 0.1 ? 2 : 1, r() < 0.1 ? 2 : 1); }
  const mg = g.createRadialGradient(250, 105, 4, 250, 105, 70);
  mg.addColorStop(0, 'rgba(255,252,235,0.5)'); mg.addColorStop(1, 'rgba(255,252,235,0)');
  g.fillStyle = mg; g.beginPath(); g.arc(250, 105, 70, 0, TAU); g.fill();
  g.fillStyle = '#e9e5d2'; g.beginPath(); g.arc(250, 105, 17, 0, TAU); g.fill();
  g.fillStyle = 'rgba(160,160,150,0.4)'; g.beginPath(); g.arc(244, 100, 5, 0, TAU); g.arc(257, 111, 4, 0, TAU); g.fill();
  const tex = new THREE.CanvasTexture(c);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -10; dome.frustumCulled = false;
  scene.add(dome);
  scene.userData.dome = dome;
})();

window.addEventListener('resize', () => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, currentQuality().pr));
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  staticCanvas.width = 160; staticCanvas.height = 90;
});

/* ------------------------------------------------------------------
   4. TEXTURES & GEOMETRY BUILDERS
------------------------------------------------------------------ */
function ctex(w, h, fn, rx, ry) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); fn(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (rx) t.repeat.set(rx, ry || rx);
  t.anisotropy = 4;
  return t;
}
function speckle(g, w, h, n, amp, sMax) {
  for (let i = 0; i < n; i++) {
    const v = (wrng() - 0.5) * 2 * amp;
    g.fillStyle = v > 0 ? 'rgba(255,255,255,' + v + ')' : 'rgba(0,0,0,' + (-v) + ')';
    g.fillRect(wrng() * w, wrng() * h, 1 + wrng() * (sMax || 2), 1 + wrng() * (sMax || 2));
  }
}
const TEX = {};
TEX.ground = ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#3c4832'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { g.fillStyle = wrng() < 0.5 ? 'rgba(78,64,44,0.35)' : 'rgba(30,40,24,0.4)'; g.beginPath(); g.arc(wrng() * w, wrng() * h, 6 + wrng() * 26, 0, TAU); g.fill(); }
  for (let i = 0; i < 1800; i++) { g.strokeStyle = wrng() < 0.5 ? 'rgba(96,120,68,0.55)' : 'rgba(24,32,20,0.55)'; g.beginPath(); const x = wrng() * w, y = wrng() * h; g.moveTo(x, y); g.lineTo(x + (wrng() - 0.5) * 3, y - 2 - wrng() * 4); g.stroke(); }
  speckle(g, w, h, 600, 0.25, 2);
}, 150, 150);
TEX.dirt = ctex(128, 128, (g, w, h) => { g.fillStyle = '#51432f'; g.fillRect(0, 0, w, h); speckle(g, w, h, 900, 0.3, 2); for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(120,108,90,0.45)'; g.fillRect(wrng() * w, wrng() * h, 1 + wrng() * 3, 1 + wrng() * 2); } }, 1, 1);
TEX.asphalt = ctex(256, 128, (g, w, h) => {
  g.fillStyle = '#2b2e33'; g.fillRect(0, 0, w, h); speckle(g, w, h, 1500, 0.22, 2);
  g.fillStyle = '#b6a136'; g.fillRect(0, h / 2 - 5, 150, 3); g.fillRect(0, h / 2 + 2, 150, 3);
  g.fillStyle = '#c9c9c0'; g.fillRect(0, 7, w, 3); g.fillRect(0, h - 10, w, 3);
}, 1, 1);
TEX.concrete = ctex(128, 128, (g, w, h) => { g.fillStyle = '#585a59'; g.fillRect(0, 0, w, h); speckle(g, w, h, 900, 0.2, 2); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, w - 1, h - 1); }, 1, 1);
function planks(base, line, vertical, n) {
  return ctex(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h); speckle(g, w, h, 500, 0.22, 3);
    g.fillStyle = line;
    for (let i = 0; i < n; i++) { const p = Math.round(i * (vertical ? w : h) / n); if (vertical) g.fillRect(p, 0, 2, h); else g.fillRect(0, p, w, 2); }
  }, 1, 1);
}
TEX.sidingFarm = planks('#6e6b61', '#2b2924', false, 8);
TEX.woodDark = planks('#4b392a', '#1e150d', true, 6);
TEX.woodFloor = planks('#5a4533', '#21170e', true, 8);
TEX.woodCabin = planks('#4a3a2b', '#1b130b', false, 7);
TEX.metal = ctex(128, 128, (g, w, h) => { g.fillStyle = '#505c62'; g.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.18)'; g.fillRect(i * 8, 0, 8, h); } speckle(g, w, h, 300, 0.25, 3); for (let i = 0; i < 16; i++) { g.fillStyle = 'rgba(120,64,34,0.28)'; g.fillRect(wrng() * w, wrng() * h, 3 + wrng() * 10, 2 + wrng() * 18); } }, 1, 1);
TEX.brick = ctex(128, 128, (g, w, h) => {
  g.fillStyle = '#5c4038'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { const o = (y % 2) * 16; g.fillStyle = 'rgba(' + (60 + wrng() * 40) + ',' + (30 + wrng() * 20) + ',28,0.5)'; g.fillRect(x * 32 + o + 1, y * 16 + 1, 30, 14); }
  g.fillStyle = 'rgba(0,0,0,0.5)'; for (let y = 0; y < 8; y++) g.fillRect(0, y * 16, w, 1); speckle(g, w, h, 500, 0.2, 2);
}, 1, 1);
TEX.roof = ctex(128, 128, (g, w, h) => { g.fillStyle = '#3a302d'; g.fillRect(0, 0, w, h); speckle(g, w, h, 700, 0.2, 3); g.fillStyle = 'rgba(0,0,0,0.4)'; for (let i = 0; i < 8; i++) g.fillRect(0, i * 16, w, 2); }, 2, 2);
TEX.flesh = ctex(128, 256, (g, w, h) => {
  g.fillStyle = '#4c3427'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(' + (30 + wrng() * 50) + ',' + (14 + wrng() * 20) + ',' + (10 + wrng() * 12) + ',0.35)'; g.beginPath(); g.arc(wrng() * w, wrng() * h, 3 + wrng() * 14, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(25,8,8,0.55)'; g.lineWidth = 1; for (let i = 0; i < 30; i++) { g.beginPath(); let x = wrng() * w, y = wrng() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (wrng() - 0.5) * 16; y += wrng() * 14; g.lineTo(x, y); } g.stroke(); }
  speckle(g, w, h, 700, 0.25, 2);
}, 1, 2);
TEX.rustMetal = ctex(128, 128, (g, w, h) => {
  g.fillStyle = '#3d4247'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(' + (95 + wrng() * 40) + ',' + (48 + wrng() * 20) + ',24,0.4)'; g.beginPath(); g.arc(wrng() * w, wrng() * h, 3 + wrng() * 16, 0, TAU); g.fill(); }
  speckle(g, w, h, 600, 0.3, 2);
}, 1, 1);
TEX.fabric = ctex(64, 64, (g, w, h) => { g.fillStyle = '#5a4a4a'; g.fillRect(0, 0, w, h); speckle(g, w, h, 300, 0.2, 2); }, 1, 1);
TEX.water = ctex(128, 128, (g, w, h) => { g.fillStyle = '#16222e'; g.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { g.strokeStyle = 'rgba(120,150,180,' + (0.08 + wrng() * 0.15) + ')'; g.beginPath(); const y = wrng() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 4, w * 0.6, y - 4, w, y + 2); g.stroke(); } }, 3, 40);

function labelTex(lines, o) {
  o = o || {};
  const w = o.w || 256, h = o.h || 128;
  const t = ctex(w, h, (g) => {
    g.fillStyle = o.bg || '#1a1d1f'; g.fillRect(0, 0, w, h);
    if (o.border) { g.strokeStyle = o.border; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8); }
    g.fillStyle = o.fg || '#ddd'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const arr = Array.isArray(lines) ? lines : [lines];
    const fs = o.size || Math.floor(h / (arr.length + 0.6));
    g.font = (o.weight || '700') + ' ' + fs + 'px ' + (o.font || 'Oswald, Impact, Arial Narrow, sans-serif');
    arr.forEach((ln, i) => g.fillText(ln, w / 2, h * (i + 1) / (arr.length + 1)));
    if (o.wear) speckle(g, w, h, 600, 0.35, 3);
  }, 1, 1);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function M(color, tex, extra) {
  const o = Object.assign({ color: color, shininess: 6, specular: 0x0c0c0c }, extra || {});
  if (tex) o.map = tex;
  return new THREE.MeshPhongMaterial(o);
}
const MAT = {
  siding: M(0xffffff, TEX.sidingFarm), woodDark: M(0xffffff, TEX.woodDark), woodFloor: M(0xffffff, TEX.woodFloor), woodCabin: M(0xffffff, TEX.woodCabin),
  metal: M(0xffffff, TEX.metal), brick: M(0xffffff, TEX.brick), concrete: M(0xffffff, TEX.concrete), roof: M(0xffffff, TEX.roof, { side: THREE.DoubleSide }),
  rust: M(0xffffff, TEX.rustMetal), fabric: M(0xffffff, TEX.fabric), plain: M(0x6a6a66), dark: M(0x1c1d20), black: M(0x0c0c0e), white: M(0xb8b8b0),
  wood: M(0x5a4430), woodLight: M(0x8a6c4a), red: M(0x7d2a22), green: M(0x35503a), blue: M(0x2f4560), yellow: M(0xb59a2a), glass: new THREE.MeshPhongMaterial({ color: 0x8fa5b3, transparent: true, opacity: 0.14, shininess: 80, specular: 0x88aacc, depthWrite: false }),
  paper: M(0xd6c9a3), chrome: M(0x8b9096, null, { shininess: 70, specular: 0x666666 })
};

/* --- collision world --------------------------------------------------- */
const boxes = [];            // axis-aligned solids: {x0,x1,z0,z1,y0,y1,on}
const zones = [];            // indoor volumes
const treeGrid = new Map();  // spatial hash of round obstacles
const GRID = 16;
function addBox(x0, z0, x1, z1, y0, y1) {
  const b = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0: y0, y1: y1, on: true };
  boxes.push(b); return b;
}
function addCircle(x, z, r) {
  const k = Math.floor(x / GRID) * 4096 + Math.floor(z / GRID);
  let a = treeGrid.get(k); if (!a) { a = []; treeGrid.set(k, a); }
  a.push({ x: x, z: z, r: r });
}
function addZone(x0, z0, x1, z1, y0, y1) { zones.push({ x0: x0, x1: x1, z0: z0, z1: z1, y0: y0, y1: y1 }); }

const geoCache = new Map();
function gBox(w, h, d) {
  const k = w.toFixed(3) + '|' + h.toFixed(3) + '|' + d.toFixed(3);
  let g = geoCache.get(k); if (!g) { g = new THREE.BoxGeometry(w, h, d); geoCache.set(k, g); } return g;
}
function stat(m) { m.updateMatrix(); m.matrixAutoUpdate = false; return m; }

// centred box mesh (+ optional collider)
function B(cx, cy, cz, w, h, d, mat, solid, parent) {
  const m = new THREE.Mesh(gBox(w, h, d), mat);
  m.position.set(cx, cy, cz); stat(m); (parent || scene).add(m);
  if (solid) addBox(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, cy - h / 2, cy + h / 2);
  return m;
}
function CYL(x, y, z, rt, rb, h, seg, mat, parent) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10), mat);
  m.position.set(x, y, z); stat(m); (parent || scene).add(m); return m;
}

/* wall with optional openings; coordinates are absolute. Openings: {c, w, y0, y1, glass} */
function wallRun(x0, z0, x1, z1, y0, h, mat, openings, T) {
  T = T || 0.3;
  const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const a = alongX ? Math.min(x0, x1) : Math.min(z0, z1);
  const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const fixed = alongX ? (z0 + z1) / 2 : (x0 + x1) / 2;
  const ops = (openings || []).map(o => ({ s: o.c - o.w / 2 - a, e: o.c + o.w / 2 - a, y0: o.y0 || 0, y1: o.y1 === undefined ? h : o.y1, glass: o.glass })).sort((p, q) => p.s - q.s);
  const piece = (s, e, ya, yb) => {
    if (e - s < 0.02 || yb - ya < 0.02) return;
    const L = e - s, mid = a + s + L / 2, cy = y0 + (ya + yb) / 2;
    if (alongX) B(mid, cy, fixed, L, yb - ya, T, mat, true); else B(fixed, cy, mid, T, yb - ya, L, mat, true);
  };
  let cur = 0;
  ops.forEach(o => {
    piece(cur, o.s, 0, h);
    piece(o.s, o.e, 0, o.y0);
    piece(o.s, o.e, o.y1, h);
    if (o.glass) {
      const L = o.e - o.s, mid = a + o.s + L / 2, cy = y0 + (o.y0 + o.y1) / 2;
      if (alongX) { B(mid, cy, fixed, L, o.y1 - o.y0, 0.04, MAT.glass, false); addBox(mid - L / 2, fixed - 0.1, mid + L / 2, fixed + 0.1, y0 + o.y0, y0 + o.y1); }
      else { B(fixed, cy, mid, 0.04, o.y1 - o.y0, L, MAT.glass, false); addBox(fixed - 0.1, mid - L / 2, fixed + 0.1, mid + L / 2, y0 + o.y0, y0 + o.y1); }
    }
    cur = o.e;
  });
  piece(cur, len, 0, h);
}
// four walls around a rectangle; openings per side: {n:[], s:[], w:[], e:[]}
function perimeter(x0, z0, x1, z1, y0, h, mat, op, T) {
  T = T || 0.3; op = op || {};
  wallRun(x0 - T / 2, z0, x1 + T / 2, z0, y0, h, mat, op.n, T);
  wallRun(x0 - T / 2, z1, x1 + T / 2, z1, y0, h, mat, op.s, T);
  wallRun(x0, z0 + T / 2, x0, z1 - T / 2, y0, h, mat, op.w, T);
  wallRun(x1, z0 + T / 2, x1, z1 - T / 2, y0, h, mat, op.e, T);
}

// triangular-prism gable roof (ridge along X; rotate for Z)
function prismGeo(w, d, rise) {
  const hw = w / 2, hd = d / 2, v = [];
  const tri = (a, b, c) => { v.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); };
  const A = [-hw, 0, -hd], Bq = [hw, 0, -hd], C = [hw, 0, hd], D = [-hw, 0, hd], R1 = [-hw, rise, 0], R2 = [hw, rise, 0];
  tri(A, Bq, R2); tri(A, R2, R1);        // slope -z
  tri(D, R1, R2); tri(D, R2, C);         // slope +z
  tri(A, R1, D); tri(Bq, C, R2);         // gable ends
  tri(A, D, C); tri(A, C, Bq);           // underside
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  const uv = []; for (let i = 0; i < v.length; i += 3) uv.push(v[i] * 0.5, v[i + 1] * 0.5 + v[i + 2] * 0.5);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
function gableRoof(cx, y, cz, w, d, rise, mat, rotated) {
  const m = new THREE.Mesh(prismGeo(rotated ? d : w, rotated ? w : d, rise), mat);
  m.position.set(cx, y, cz); if (rotated) m.rotation.y = Math.PI / 2; stat(m); scene.add(m); return m;
}

// merge helper (used for trees, towers)
function mergeParts(parts) {
  const pos = [], nor = [], col = [];
  parts.forEach(p => {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    if (p.m) g.applyMatrix4(p.m);
    const pa = g.attributes.position.array, na = g.attributes.normal.array;
    for (let i = 0; i < pa.length; i++) { pos.push(pa[i]); nor.push(na[i]); }
    for (let i = 0; i < pa.length / 3; i++) col.push(p.c.r, p.c.g, p.c.b);
  });
  const G = new THREE.BufferGeometry();
  G.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  G.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  G.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return G;
}
const _mt = new THREE.Matrix4();
function T(x, y, z) { return _mt.clone().makeTranslation(x, y, z); }

/* --- door system --------------------------------------------------- */
const doors = [];
function makeDoor(o) {
  // o: axis ('x'|'z'), hx/hz hinge point on the wall line, y0, w, h, mat, dir (+1/-1 swing side), locked (bool|fn), lockMsg, name, startOpen
  const y0 = o.y0 || 0, w = o.w || 1.1, h = o.h || 2.1, ax = o.axis === 'x';
  const pivot = new THREE.Group(); pivot.position.set(o.hx, y0, o.hz); scene.add(pivot);
  const panel = new THREE.Mesh(gBox(ax ? w : 0.07, h, ax ? 0.07 : w), o.mat || MAT.woodDark);
  panel.position.set(ax ? w / 2 : 0, h / 2, ax ? 0 : w / 2); pivot.add(panel);
  [-1, 1].forEach(sd => {
    const k = new THREE.Mesh(gBox(0.08, 0.08, 0.08), MAT.chrome);
    k.position.set(ax ? w - 0.15 : sd * 0.07, 1.0, ax ? sd * 0.07 : w - 0.15); pivot.add(k);
  });
  const col = ax ? addBox(o.hx, o.hz - 0.1, o.hx + w, o.hz + 0.1, y0, y0 + h) : addBox(o.hx - 0.1, o.hz, o.hx + 0.1, o.hz + w, y0, y0 + h);
  const d = { pivot: pivot, col: col, open: false, ang: 0, axis: o.axis, dir: o.dir || 1, locked: o.locked || false, lockMsg: o.lockMsg || 'It is locked.',
    name: o.name || 'door', w: w, startOpen: !!o.startOpen,
    pos: new V3(ax ? o.hx + w / 2 : o.hx, y0 + 1.1, ax ? o.hz : o.hz + w / 2) };
  d.apply = function () { pivot.rotation.y = d.ang * 1.45 * d.dir; };
  if (d.startOpen) { d.open = true; d.ang = 1; col.on = false; }
  d.apply();
  doors.push(d);
  return d;
}
function toggleDoor(d, silent) {
  d.open = !d.open;
  if (d.open) d.col.on = false;           // collider opens at once, closes again once fully shut
  if (!silent) SFX.door(d.open);
}

/* ------------------------------------------------------------------
   6. GAME STATE, LAMPS, INTERACTABLES
------------------------------------------------------------------ */
const resetFns = [];
function onReset(fn) { resetFns.push(fn); }

const G = {
  inv: { map: false, key: false, gas: false, battery: false, simple: false, fuses: 0 },
  fusesFound: 0, fusesInstalled: 0,
  powerOn: false, powerT: 0,
  truck: { gas: false, battery: false },
  radio: { unlocked: false, battery: false, called: false },
  flags: { leftHouse: false, wokeUp: false }
};
function resetState() {
  G.inv = { map: false, key: false, gas: false, battery: false, simple: false, fuses: 0 };
  G.fusesFound = 0; G.fusesInstalled = 0; G.powerOn = false; G.powerT = 0;
  G.truck = { gas: false, battery: false }; G.radio = { unlocked: false, battery: false, called: false };
  G.flags = { leftHouse: false, wokeUp: false };
}

/* lamps: logical light sources, drawn by a small pool of real lights */
const lamps = [];
function addLamp(x, y, z, o) {
  o = o || {};
  const L = { pos: new V3(x, y, z), color: o.color || 0xffe3b5, inten: o.inten || 1.3, dist: o.dist || 16, on: !!o.on, init: !!o.on, level: o.on ? 1 : 0, flicker: o.flicker || 0, eff: 0, bulb: null, tint: new THREE.Color(o.color || 0xffe3b5) };
  if (o.bulb !== false) {
    L.bulb = new THREE.Mesh(new THREE.SphereGeometry(o.size || 0.11, 8, 6), new THREE.MeshBasicMaterial({ color: 0x222222 }));
    L.bulb.position.set(x, y, z); stat(L.bulb); scene.add(L.bulb);
  }
  lamps.push(L);
  onReset(() => { L.on = L.init; L.level = L.init ? 1 : 0; });
  return L;
}
function updateLamps(dt, px, py, pz) {
  const cand = [];
  for (const L of lamps) {
    const k = 1 - Math.exp(-dt * 9);
    L.level += ((L.on ? 1 : 0) - L.level) * k;
    let mod = 1;
    if (L.flicker && L.level > 0.05) mod = 1 - L.flicker * (Math.random() < 0.14 ? Math.random() : 0) - L.flicker * 0.1 * Math.sin(performance.now() * 0.013 + L.pos.x);
    L.eff = L.level * mod;
    if (L.bulb) L.bulb.material.color.setRGB(0.1 + L.tint.r * L.eff * 0.95, 0.1 + L.tint.g * L.eff * 0.95, 0.1 + L.tint.b * L.eff * 0.95);
    if (L.eff > 0.02) {
      const dx = L.pos.x - px, dz = L.pos.z - pz, dy = L.pos.y - py;
      const d = Math.sqrt(dx * dx + dz * dz + dy * dy * 0.5);
      if (d < 70) cand.push({ L: L, d: d });
    }
  }
  cand.sort((a, b) => a.d - b.d);
  const want = new Set(); for (let i = 0; i < Math.min(POOL.length, cand.length); i++) want.add(cand[i].L);
  const held = new Set(POOL.map(p => p.lamp).filter(Boolean));
  for (const p of POOL) {
    if (p.lamp && !want.has(p.lamp)) { p.fade -= dt * 5; if (p.fade <= 0) { p.fade = 0; held.delete(p.lamp); p.lamp = null; } }
    if (!p.lamp) {
      for (const L of want) if (!held.has(L)) { p.lamp = L; p.fade = 0; held.add(L); p.light.position.copy(L.pos); p.light.color.copy(L.tint); p.light.distance = L.dist; break; }
    }
    if (p.lamp) {
      if (want.has(p.lamp)) p.fade = Math.min(1, p.fade + dt * 4);
      p.light.position.copy(p.lamp.pos);
      p.light.intensity = p.lamp.inten * p.lamp.eff * p.fade;
    } else p.light.intensity = 0;
  }
}

/* items you can carry */
const items = {};
function addItem(id, mesh, pos, label, onTake, opt) {
  opt = opt || {};
  const it = { id: id, mesh: mesh, taken: false };
  items[id] = it;
  addInter(pos, opt.range || 2.4, () => it.taken ? null : label, () => {
    it.taken = true; mesh.visible = false; SFX.pickup(); onTake();
  }, { cone: opt.cone || 0.72 });
  onReset(() => { it.taken = false; mesh.visible = true; });
  return it;
}

/* interactables */
const interactables = [];
function addInter(pos, range, prompt, act, opt) {
  const o = Object.assign({ pos: pos, range: range, prompt: prompt, act: act, cone: 0.8 }, opt || {});
  interactables.push(o); return o;
}
function addDoorInter(d, label) {
  addInter(d.pos, 2.7, () => {
    if (typeof d.locked === 'function' ? d.locked() : d.locked) return (label && label.locked) ? label.locked() : 'Locked door';
    return d.open ? 'Close door' : 'Open door';
  }, () => {
    const lk = typeof d.locked === 'function' ? d.locked() : d.locked;
    if (lk) {
      if (label && label.tryUnlock && label.tryUnlock()) return;
      SFX.error(); ui.toast(d.lockMsg, 2600); return;
    }
    toggleDoor(d);
  }, { cone: 0.6 });
}
function addSwitch(x, y, z, facing, lampList, label) {
  // wall plate + lever; 'facing' is the direction the plate faces: 'n','s','e','w'
  const plate = new THREE.Mesh(gBox(0.12, 0.2, 0.03), MAT.white);
  const lever = new THREE.Mesh(gBox(0.03, 0.08, 0.04), MAT.dark);
  const g = new THREE.Group(); g.position.set(x, y, z);
  g.rotation.y = { n: Math.PI, s: 0, e: Math.PI / 2, w: -Math.PI / 2 }[facing] || 0;
  g.add(plate); lever.position.set(0, 0.04, 0.03); g.add(lever); scene.add(g);
  const sw = { on: lampList[0].on };
  const apply = () => { lever.position.y = sw.on ? 0.04 : -0.04; lampList.forEach(L => { L.on = sw.on; }); };
  apply();
  addInter(new V3(x, y, z), 2.4, () => (sw.on ? 'Switch light off' : 'Switch light on'), () => {
    sw.on = !sw.on; SFX.click(0.35); apply();
  }, { cone: 0.6 });
  onReset(() => { sw.on = lampList[0].init; apply(); });
  return sw;
}

/* note reader */
let noteOpen = false;
function addNote(pos, title, body, label) {
  addInter(pos, 2.2, () => label || 'Read note', () => { ui.note(title, body); SFX.click(0.2); }, { cone: 0.7 });
}

/* ------------------------------------------------------------------
   5. WORLD  (ground, roads, forest, props)
------------------------------------------------------------------ */
const PATHS = [];
const dirtMat = M(0xffffff, TEX.dirt, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, shininess: 1 });
function strip(x0, z0, x1, z1, w, mat, y, tile) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.sqrt(dx * dx + dz * dz);
  const g = new THREE.PlaneGeometry(len + 0.02, w);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / tile, uv.getY(i) * w / tile);
  const m = new THREE.Mesh(g, mat);
  m.rotation.x = -Math.PI / 2;
  const grp = new THREE.Group(); grp.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); grp.rotation.y = -Math.atan2(dz, dx); grp.add(m);
  grp.updateMatrix(); grp.matrixAutoUpdate = false; m.updateMatrix(); scene.add(grp);
}
function addPath(pts, w) {
  PATHS.push({ pts: pts, w: w });
  for (let i = 0; i < pts.length - 1; i++) strip(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, dirtMat, 0.03, 4);
  pts.forEach(p => { const c = new THREE.Mesh(new THREE.CircleGeometry(w / 2, 14), dirtMat); c.rotation.x = -Math.PI / 2; c.position.set(p[0], 0.031, p[1]); stat(c); scene.add(c); });
}
function distToPaths(x, z) {
  let best = 1e9;
  for (const P of PATHS) for (let i = 0; i < P.pts.length - 1; i++) {
    const ax = P.pts[i][0], az = P.pts[i][1], bx = P.pts[i + 1][0], bz = P.pts[i + 1][1];
    const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
    let t = l2 ? ((x - ax) * vx + (z - az) * vz) / l2 : 0; t = clamp(t, 0, 1);
    const d = Math.hypot(x - (ax + vx * t), z - (az + vz * t)) - P.w / 2;
    if (d < best) best = d;
  }
  return best;
}

(function buildGround() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshPhongMaterial({ map: TEX.ground, shininess: 1, specular: 0x040404 }));
  ground.rotation.x = -Math.PI / 2; stat(ground); scene.add(ground);
  // highway
  const g = new THREE.PlaneGeometry(700, 9.6); const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 700 / 12, uv.getY(i));
  const rm = new THREE.Mesh(g, M(0xffffff, TEX.asphalt, { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, shininess: 14, specular: 0x222833 }));
  rm.rotation.x = -Math.PI / 2; rm.position.set(0, 0.04, 0); stat(rm); scene.add(rm);
  // gravel shoulders
  [[-5.6], [5.6]].forEach(a => { const s = new THREE.Mesh(new THREE.PlaneGeometry(700, 1.6), dirtMat); s.rotation.x = -Math.PI / 2; s.position.set(0, 0.035, a[0]); stat(s); scene.add(s); });

  // dirt tracks
  addPath([[0, 5], [-6, 35], [-20, 70], [-14, 105], [-4, 130], [0, 150]], 4);
  addPath([[-14, 105], [-45, 112], [-90, 120], [-130, 118], [-166, 128]], 3.4);
  addPath([[4, 150], [40, 148], [80, 140], [120, 150], [150, 155], [164, 158]], 3.4);
  addPath([[0, -5], [8, -45], [-8, -90], [6, -135], [-4, -175], [0, -200]], 3.6);
  addPath([[140, 4], [140, 17]], 5);
  addPath([[-85, -5], [-85, -17]], 4);
  addPath([[76, -4], [76, -9]], 5);

  // river with a bridge for the river-house track
  const wm = new THREE.MeshPhongMaterial({ map: TEX.water, color: 0xffffff, shininess: 90, specular: 0x5577aa, transparent: true, opacity: 0.92 });
  const river = new THREE.Mesh(new THREE.PlaneGeometry(14, 700), wm);
  river.rotation.x = -Math.PI / 2; river.position.set(197, 0.06, 0); scene.add(river);
  scene.userData.water = TEX.water;
  addBox(190.2, -400, 203.8, 144.2, 0, 5); addBox(190.2, 155.8, 203.8, 400, 0, 5);
  B(197, 0.25, 150, 15, 0.3, 11.5, MAT.woodDark, true);
  [145.1, 154.9].forEach(zz => { B(197, 0.95, zz, 15, 0.12, 0.12, MAT.woodDark, true); [190.4, 194.5, 197, 199.5, 203.6].forEach(xx => B(xx, 0.65, zz, 0.14, 1.0, 0.14, MAT.woodDark, false)); });
})();

/* ---- forest: thousands of trees, drawn only near the player ---- */
const CLEAR = [
  { x: 0, z: 160, r: 24 }, { x: 11, z: 150, r: 8 }, { x: 76, z: -16, r: 32 }, { x: 140, z: 25, r: 26 }, { x: -85, z: -24, r: 22 },
  { x: -175, z: 130, r: 17 }, { x: 172, z: 160, r: 19 }, { x: 0, z: -222, r: 58 }, { x: -150, z: -4, r: 8 }
];
const forest = { trees: [], variants: [], lastX: 1e9, lastZ: 1e9, R: 200 };
(function buildForest() {
  const col = (h) => new THREE.Color(h);
  const trunk = col(0x3b2d21), g1 = col(0x1e2e22), g2 = col(0x25382a), g3 = col(0x1a2822), gray = col(0x4b4742), grayD = col(0x38352f);
  const cone = (r, h, y, c, seg) => ({ geo: new THREE.ConeGeometry(r, h, seg || 7), m: T(0, y, 0), c: c });
  const pineA = mergeParts([{ geo: new THREE.CylinderGeometry(0.18, 0.34, 5.5, 6), m: T(0, 2.75, 0), c: trunk }, cone(2.5, 3.6, 3.6, g1), cone(1.95, 3.3, 5.6, g2), cone(1.35, 3.0, 7.5, g1), cone(0.8, 2.2, 9.1, g2)]);
  const pineB = mergeParts([{ geo: new THREE.CylinderGeometry(0.14, 0.28, 9, 6), m: T(0, 4.5, 0), c: trunk }, cone(1.7, 3.2, 4.8, g3, 6), cone(1.35, 3.0, 7.2, g1, 6), cone(0.95, 2.6, 9.4, g3, 6), cone(0.5, 2.0, 11.2, g1, 6)]);
  const branch = (y, yaw, tilt, len, r) => ({ geo: new THREE.CylinderGeometry(r * 0.35, r, len, 4), m: new THREE.Matrix4().makeTranslation(0, y, 0).multiply(new THREE.Matrix4().makeRotationY(yaw)).multiply(new THREE.Matrix4().makeRotationZ(tilt)).multiply(new THREE.Matrix4().makeTranslation(0, len / 2, 0)), c: gray });
  const dead = mergeParts([{ geo: new THREE.CylinderGeometry(0.1, 0.34, 10.5, 5), m: T(0, 5.25, 0), c: gray },
    branch(4.5, 0.3, 0.9, 2.6, 0.1), branch(5.8, 2.2, 1.0, 2.2, 0.09), branch(7.0, 4.0, 0.8, 2.4, 0.08), branch(8.2, 1.2, 1.1, 1.8, 0.07), branch(9.0, 3.3, 0.7, 1.6, 0.06), branch(3.2, 5.3, 1.1, 1.9, 0.09)]);
  const pole = mergeParts([{ geo: new THREE.CylinderGeometry(0.07, 0.24, 14, 5), m: T(0, 7, 0), c: grayD }, branch(11.5, 0.4, 1.2, 1.1, 0.05), branch(12.6, 3.4, 1.2, 0.9, 0.04)]);
  const mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 2, specular: 0x050505 });
  [pineA, pineB, dead, pole].forEach(geo => forest.variants.push({ geo: geo, mesh: null }));
  const sp = { low: 10.5, medium: 8.2, high: 6.6 }[settings.quality === 'auto' ? (isTouch ? 'low' : 'high') : settings.quality] || 8;
  const px = (v) => (v.x + 'x'), counts = [0, 0, 0, 0];
  for (let gx = -390; gx < 390; gx += sp) for (let gz = -390; gz < 390; gz += sp) {
    const x = gx + wr(-sp * 0.5, sp * 0.5), z = gz + wr(-sp * 0.5, sp * 0.5);
    if (Math.abs(z) < 8.5 || (x > 186 && x < 208)) continue;
    if (Math.abs(x) > 300 || Math.abs(z) > 300) { if (wrng() < 0.35) continue; }
    let bad = false;
    for (let i = 0; i < CLEAR.length; i++) { const c = CLEAR[i]; if ((x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) < c.r * c.r) { bad = true; break; } }
    if (bad || distToPaths(x, z) < 3.4 || wrng() < 0.1) continue;
    const r = wrng(); const v = r < 0.46 ? 0 : r < 0.68 ? 1 : r < 0.88 ? 2 : 3;
    const s = wr(0.8, 1.45);
    forest.trees.push({ x: x, z: z, v: v, s: s, r: wr(0, TAU) });
    addCircle(x, z, (v === 3 ? 0.22 : 0.36) * s + 0.1);
    counts[v]++;
  }
  forest.variants.forEach((v, i) => {
    v.mesh = new THREE.InstancedMesh(v.geo, mat, Math.max(1, counts[i]));
    v.mesh.frustumCulled = false; v.mesh.count = 0; scene.add(v.mesh);
  });
  forest.R = { low: 150, medium: 205, high: 250 }[settings.quality === 'auto' ? (isTouch ? 'low' : 'high') : settings.quality] || 200;
})();
const _dummy = new THREE.Object3D();
function refreshForest(px, pz, force) {
  if (!force && Math.abs(px - forest.lastX) < 22 && Math.abs(pz - forest.lastZ) < 22) return;
  forest.lastX = px; forest.lastZ = pz;
  const R2 = forest.R * forest.R, n = [0, 0, 0, 0];
  for (const t of forest.trees) {
    const dx = t.x - px, dz = t.z - pz;
    if (dx * dx + dz * dz > R2) continue;
    _dummy.position.set(t.x, 0, t.z); _dummy.rotation.set(0, t.r, 0); _dummy.scale.set(t.s, t.s, t.s); _dummy.updateMatrix();
    const m = forest.variants[t.v].mesh;
    if (n[t.v] < m.instanceMatrix.count) m.setMatrixAt(n[t.v]++, _dummy.matrix);
  }
  forest.variants.forEach((v, i) => { v.mesh.count = n[i]; v.mesh.instanceMatrix.needsUpdate = true; });
}

/* ---- cars (wreck, police cruisers) ---- */
function makeCar(color, police) {
  const g = new THREE.Group();
  const bodyM = M(color), dk = MAT.black;
  const add = (w, h, d, x, y, z, m) => { const o = new THREE.Mesh(gBox(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
  add(1.9, 0.62, 4.7, 0, 0.62, 0, bodyM);
  add(1.65, 0.55, 2.3, 0, 1.18, 0.15, police ? MAT.white : bodyM);
  add(1.55, 0.45, 2.1, 0, 1.2, 0.15, M(0x0e1319));
  if (police) { add(0.06, 0.55, 2.4, 0.96, 0.62, 0, MAT.white); add(0.06, 0.55, 2.4, -0.96, 0.62, 0, MAT.white); }
  [[-0.95, -1.45], [0.95, -1.45], [-0.95, 1.45], [0.95, 1.45]].forEach(p => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12), dk); w.rotation.z = Math.PI / 2; w.position.set(p[0], 0.36, p[1]); g.add(w); });
  const hl = M(0xfff2c8, null, { emissive: 0x887755 });
  add(0.35, 0.16, 0.06, 0.65, 0.7, -2.36, hl); add(0.35, 0.16, 0.06, -0.65, 0.7, -2.36, hl);
  add(0.35, 0.14, 0.06, 0.65, 0.7, 2.36, M(0x771111, null, { emissive: 0x330000 })); add(0.35, 0.14, 0.06, -0.65, 0.7, 2.36, M(0x771111, null, { emissive: 0x330000 }));
  if (police) {
    g.userData.red = add(0.5, 0.16, 0.3, 0.3, 1.56, 0.15, new THREE.MeshBasicMaterial({ color: 0x300000 }));
    g.userData.blue = add(0.5, 0.16, 0.3, -0.3, 1.56, 0.15, new THREE.MeshBasicMaterial({ color: 0x000030 }));
  }
  return g;
}

/* ---- props: poles & wires, wreck, fences, rocks ---- */
(function buildProps() {
  const pm = M(0x2c2218), wire = [];
  for (let x = -300; x <= 300; x += 42) {
    const z = -6.8;
    CYL(x, 4.6, z, 0.13, 0.19, 9.2, 6, pm); B(x, 8.5, z, 0.14, 0.14, 2.6, pm, false);
    addCircle(x, z, 0.28);
    if (x > -300) { const px0 = x - 42; for (const oz of [-1.1, 0, 1.1]) for (let i = 0; i < 6; i++) { const t0 = i / 6, t1 = (i + 1) / 6; wire.push(px0 + 42 * t0, 8.45 - 0.7 * Math.sin(Math.PI * t0), z + oz, px0 + 42 * t1, 8.45 - 0.7 * Math.sin(Math.PI * t1), z + oz); } }
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
  scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x07080a })));
  // rocks
  const rm = M(0x4a4b4b, null, { flatShading: true });
  for (let i = 0; i < 46; i++) {
    const x = wr(-280, 280), z = wr(-280, 280);
    if (Math.abs(z) < 9 || distToPaths(x, z) < 3 || CLEAR.some(c => (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) || (x > 184 && x < 210)) continue;
    const s = wr(0.5, 1.6), m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rm);
    m.position.set(x, s * 0.4, z); m.rotation.set(wr(0, 3), wr(0, 3), wr(0, 3)); m.scale.y = 0.65; stat(m); scene.add(m); addCircle(x, z, s * 0.8);
  }
  // wrecked car on the shoulder with a fuse in the glovebox
  const wreck = makeCar(0x6b5030, false); wreck.position.set(-150, 0.05, -6.2); wreck.rotation.set(0, 0.5, 0.06); scene.add(wreck);
  addBox(-152.4, -8.4, -147.6, -4.0, 0, 1.5);
  const fuseMesh = makeFuseMesh(); fuseMesh.position.set(-149.6, 0.98, -6.3); fuseMesh.visible = true; scene.add(fuseMesh);
  addItem('fuse4', fuseMesh, new V3(-149.6, 1.0, -6.3), 'Search the glovebox: take fuse', () => { G.inv.fuses++; G.fusesFound++; ui.toast('You found a fuse in the glovebox.', 2400); });
  // farm fence + scarecrow + hay
  for (let i = -9; i <= 9; i++) { if (Math.abs(i) < 2) continue; const x = i * 2.2; B(x, 0.55, 146.5, 0.1, 1.1, 0.1, MAT.woodDark, false); }
  B(-21, 0.6, 146.5, 40, 0.08, 0.06, MAT.woodDark, false);
  const sc = new THREE.Group(); sc.position.set(-16, 0, 145); scene.add(sc);
  const sm = M(0x3a3224); const post = new THREE.Mesh(gBox(0.1, 2.2, 0.1), sm); post.position.y = 1.1; sc.add(post);
  const arm = new THREE.Mesh(gBox(1.8, 0.08, 0.08), sm); arm.position.y = 1.7; sc.add(arm);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), M(0x5b5033)); head.position.y = 2.3; sc.add(head);
  sc.rotation.y = 0.4; addCircle(-16, 145, 0.4);
  [[-24, 152], [-27, 154]].forEach(p => { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.1, 10), M(0x6e5e32)); h.rotation.z = Math.PI / 2; h.position.set(p[0], 0.55, p[1]); stat(h); scene.add(h); addBox(p[0] - 0.9, p[1] - 0.8, p[0] + 0.9, p[1] + 0.8, 0, 1.1); });
})();
function makeFuseMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8), M(0xd7d1c3, null, { emissive: 0x2a2a28 })); body.rotation.z = Math.PI / 2; g.add(body);
  [-0.12, 0.12].forEach(x => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 8), M(0xb89a58, null, { shininess: 60 })); c.rotation.z = Math.PI / 2; c.position.x = x; g.add(c); });
  return g;
}

/* ------------------------------------------------------------------
   FARMHOUSE (spawn)  centre (0,160), footprint x -6..6  z 155.5..164.5
------------------------------------------------------------------ */
const SPAWN = { x: -3.3, y: 3.0, z: 159.6, yaw: Math.PI };
let dormLamp, dormSwitch, farmDownLamp;
(function buildFarmhouse() {
  const x0 = -6, x1 = 6, z0 = 155.5, z1 = 164.5;
  B(0, 0.08, 160, 12.4, 0.16, 9.4, MAT.woodFloor, true);
  perimeter(x0, z0, x1, z1, 0, 3.0, MAT.siding, {
    n: [{ c: 0, w: 1.5, y0: 0, y1: 2.2 }, { c: -3.6, w: 1.4, y0: 1.0, y1: 2.2, glass: true }, { c: 3.6, w: 1.4, y0: 1.0, y1: 2.2, glass: true }],
    s: [{ c: -3.4, w: 1.4, y0: 1.0, y1: 2.2, glass: true }, { c: 0.5, w: 1.4, y0: 1.0, y1: 2.2, glass: true }, { c: 3.4, w: 1.4, y0: 1.0, y1: 2.2, glass: true }],
    w: [{ c: 158.4, w: 1.3, y0: 1.0, y1: 2.2, glass: true }, { c: 162.2, w: 1.3, y0: 1.0, y1: 2.2, glass: true }],
    e: [{ c: 159, w: 1.3, y0: 1.0, y1: 2.2, glass: true }]
  });
  // upper floor slabs (with the stairwell cut out)
  B(-1.45, 2.9, 160, 9.1, 0.2, 9.3, MAT.woodFloor, true);      // x -6..3.1
  B(4.65, 2.9, 163.8, 3.1, 0.2, 1.7, MAT.woodFloor, true);     // landing
  B(4.65, 2.9, 156.2, 3.1, 0.2, 1.4, MAT.woodFloor, true);     // north strip
  perimeter(x0, z0, x1, z1, 3.0, 3.0, MAT.siding, {
    n: [{ c: -3.6, w: 1.4, y0: 0.9, y1: 2.2, glass: true }, { c: 0, w: 1.4, y0: 0.9, y1: 2.2, glass: true }, { c: 3.6, w: 1.4, y0: 0.9, y1: 2.2, glass: true }],
    s: [{ c: -3.0, w: 2.0, y0: 0.85, y1: 2.3, glass: true }, { c: 1.5, w: 1.4, y0: 0.9, y1: 2.2, glass: true }],
    w: [{ c: 160.2, w: 2.0, y0: 0.9, y1: 2.3, glass: true }],
    e: [{ c: 158, w: 1.3, y0: 0.9, y1: 2.2, glass: true }]
  });
  B(0, 6.1, 160, 12.4, 0.2, 9.4, MAT.woodDark, false);
  gableRoof(0, 6.2, 160, 13.0, 10.6, 2.7, MAT.roof, false);
  // front door
  const fd = makeDoor({ axis: 'x', hx: -0.75, hz: z0, y0: 0, w: 1.5, h: 2.2, dir: -1, name: 'front door', mat: MAT.woodDark });
  addDoorInter(fd);
  // stairs
  for (let i = 0; i < 12; i++) { const top = 0.25 * (i + 1); B(4.575, top / 2, 157.25 + 0.5 * i, 2.55, top, 0.5, MAT.woodFloor, true); }
  B(3.2, 3.5, 160, 0.08, 1.0, 6.0, MAT.woodDark, true); B(4.5, 3.5, 157.0, 2.7, 1.0, 0.08, MAT.woodDark, true);
  addZone(x0, z0, x1, z1, 0, 6.2);

  /* ---- ground floor furniture ---- */
  B(-3.4, 0.55, 163.9, 4.4, 1.0, 0.7, MAT.wood, true); B(-3.4, 1.06, 163.9, 4.4, 0.06, 0.74, MAT.dark, false);
  B(-0.9, 1.0, 163.9, 0.85, 1.9, 0.7, MAT.white, true);
  B(-2.2, 0.55, 159.4, 2.0, 0.08, 1.1, MAT.woodLight, true); [[-3, 158.9], [-1.4, 158.9], [-3, 159.9], [-1.4, 159.9]].forEach(p => B(p[0], 0.28, p[1], 0.08, 0.5, 0.08, MAT.woodLight, false));
  B(-2.2, 0.28, 159.4, 1.8, 0.5, 0.9, MAT.woodDark, true);
  B(-5.3, 0.4, 161.5, 1.0, 0.8, 2.5, MAT.fabric, true); B(-5.65, 0.95, 161.5, 0.3, 0.7, 2.5, MAT.fabric, true);
  B(-5.7, 1.1, 157.2, 0.5, 2.0, 1.8, MAT.wood, true);
  B(2.2, 0.35, 158.5, 1.4, 0.4, 0.7, MAT.woodDark, true);
  farmDownLamp = addLamp(-0.2, 2.65, 160, { inten: 1.3, dist: 15 });
  addSwitch(0.95, 1.3, z0 + 0.2, 's', [farmDownLamp]);
  addNote(new V3(-2.2, 0.7, 159.4), 'Kitchen table', 'A cold cup of coffee. A scrawl on a napkin:\n\n"Upstairs desk has the map. Siren Head hunts by light and by noise. Keep the flashlight low, and do not run in the open unless you must."', 'Read the napkin');

  /* ---- the second-floor dorm ---- */
  const bed = (z) => { B(-5.1, 3.28, z, 1.95, 0.56, 1.05, MAT.woodDark, true); B(-5.05, 3.62, z, 1.8, 0.18, 0.95, MAT.fabric, false); B(-5.8, 3.78, z, 0.35, 0.14, 0.7, MAT.white, false); };
  bed(157.2); bed(159.6); bed(162.0);
  B(-5.8, 3.9, 160.8, 0.3, 0.6, 0.5, MAT.wood, true);   // nightstand
  B(-3.0, 3.38, 163.9, 1.9, 0.08, 0.8, MAT.woodLight, true);  // desk top
  B(-3.8, 3.2, 163.9, 0.08, 0.4, 0.7, MAT.woodDark, true); B(-2.2, 3.2, 163.9, 0.08, 0.4, 0.7, MAT.woodDark, true);
  B(-3.0, 3.25, 163.4, 0.5, 0.5, 0.5, MAT.woodDark, false);
  B(-0.8, 4.15, 163.9, 1.3, 2.3, 0.7, MAT.wood, true);   // wardrobe
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), M(0x5a2f2a, TEX.fabric)); rug.rotation.x = -Math.PI / 2; rug.position.set(-2.4, 3.012, 159.6); stat(rug); scene.add(rug);
  B(1.8, 3.4, 156.3, 1.1, 0.8, 0.7, MAT.woodDark, true); B(0.2, 3.4, 156.2, 1.0, 0.8, 0.8, MAT.woodDark, true);
  dormLamp = addLamp(-1.2, 5.65, 160, { inten: 1.55, dist: 17 });
  dormSwitch = addSwitch(-1.9, 4.35, z1 - 0.2, 'n', [dormLamp]);
  dormLamp.on = false; dormLamp.init = false; dormLamp.level = 0; dormSwitch.on = false; // wake up in the dark
  onReset(() => { dormSwitch.on = false; });

  // the paper map on the desk
  const mapMesh = new THREE.Group();
  const sheet = new THREE.Mesh(gBox(0.5, 0.012, 0.36), M(0xcbbd92)); mapMesh.add(sheet);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), M(0xb7a778)); roll.rotation.z = Math.PI / 2; roll.position.set(0, 0.03, 0.2); mapMesh.add(roll);
  mapMesh.position.set(-3.0, 3.44, 163.9); mapMesh.rotation.y = 0.35; scene.add(mapMesh);
  addItem('map', mapMesh, new V3(-3.0, 3.5, 163.9), 'Take the paper map', () => { G.inv.map = true; ui.toast('Paper map: press M (or tap Map) to open it.', 3200); });
  const diary = new THREE.Mesh(gBox(0.18, 0.03, 0.24), M(0x2d2a33)); diary.position.set(-5.8, 4.22, 160.8); scene.add(diary);
  addNote(new V3(-5.7, 4.2, 160.8), "Walt's notebook",
    'Day 9.\n\nThe siren started again at dusk. It does not sound like a machine anymore. Last night it called my name in Ellie\'s voice.\n\nThe truck out front is dead. It needs gas and a battery. The station on the highway has a can, but its power box is missing every fuse. I counted four slots.\n\nThere is also the radio cabin up north. Key is at the river house, I think.\n\nIt sees a flashlight from a mile away. If it hears you running, it comes.', 'Read the notebook');
})();

/* ---- the truck ---- */
const truck = { group: null, gasMark: null, batMark: null };
const TRUCK_HOME = { x: 11, z: 150 };
(function buildTruck() {
  const g = new THREE.Group(); g.position.set(TRUCK_HOME.x, 0, TRUCK_HOME.z); scene.add(g);
  const add = (w, h, d, x, y, z, m) => { const o = new THREE.Mesh(gBox(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
  const body = M(0x3a5753), rustM = M(0x5b3b27);
  add(2.0, 0.5, 5.4, 0, 0.78, 0, body);                       // chassis
  add(1.9, 0.78, 1.5, 0, 1.28, -1.9, body);                   // hood
  add(1.9, 1.15, 1.9, 0, 1.75, -0.35, body);                  // cab
  add(1.7, 0.6, 1.6, 0, 1.95, -0.35, M(0x0d1217));            // glass band
  add(2.0, 0.6, 2.3, 0, 1.0, 1.45, body);                     // bed
  add(1.8, 0.1, 2.1, 0, 1.31, 1.45, rustM);                   // bed floor
  [[-0.95, -1.8], [0.95, -1.8], [-0.95, 1.7], [0.95, 1.7]].forEach(p => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.3, 14), MAT.black); w.rotation.z = Math.PI / 2; w.position.set(p[0], 0.44, p[1]); g.add(w); });
  const hl = new THREE.MeshBasicMaterial({ color: 0x3a3830 }); g.userData.hl = hl;
  [-0.7, 0.7].forEach(x => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), hl); l.position.set(x, 1.15, -2.68); g.add(l); });
  add(2.1, 0.18, 0.2, 0, 0.55, -2.75, MAT.chrome); add(2.1, 0.18, 0.2, 0, 0.55, 2.75, MAT.chrome);
  [-0.8, 0.8].forEach(x => add(0.3, 0.16, 0.05, x, 1.1, 2.72, M(0x771111, null, { emissive: 0x330000 })));
  g.add(truckLight); truckLight.position.set(0, 1.2, -2.8); truckLight.target.position.set(0, 0.2, -16); g.add(truckLight.target);
  truck.group = g;
  addBox(TRUCK_HOME.x - 1.1, TRUCK_HOME.z - 2.8, TRUCK_HOME.x + 1.1, TRUCK_HOME.z + 2.8, 0, 1.6);
  const gasMark = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), M(0x9d2f22)); gasMark.rotation.z = Math.PI / 2; gasMark.position.set(1.02, 1.15, 1.2); g.add(gasMark);
  const T0 = (lx, ly, lz) => new V3(TRUCK_HOME.x + lx, ly, TRUCK_HOME.z + lz);
  addInter(T0(1.3, 1.15, 1.2), 2.6, () => G.truck.gas ? null : (G.inv.gas ? 'Pour in the gas' : 'Fuel cap (the tank is empty)'), () => {
    if (!G.inv.gas) { SFX.error(); ui.toast('The tank is empty. You need a gas can.', 2600); return; }
    G.inv.gas = false; G.truck.gas = true; SFX.pickup(); SFX.thump(0.15); ui.toast('You empty the gas can into the tank.', 2600); ui.refreshInv(); }, { cone: 0.65 });
  addInter(T0(0, 1.35, -3.1), 2.8, () => G.truck.battery ? null : (G.inv.battery ? 'Install the car battery' : 'Battery tray (empty)'), () => {
    if (!G.inv.battery) { SFX.error(); ui.toast('The battery tray is empty. You need a car battery.', 2600); return; }
    G.inv.battery = false; G.truck.battery = true; SFX.zap(); ui.toast('The battery clamps on with a heavy clunk.', 2600); ui.refreshInv(); }, { cone: 0.6 });
  addInter(T0(-1.35, 1.5, -0.35), 2.6, () => (G.truck.gas && G.truck.battery) ? 'Start the truck' : 'Driver door (not ready: needs gas and a battery)', () => {
    if (!(G.truck.gas && G.truck.battery)) { SFX.error(); ui.toast('It will not turn over. ' + (G.truck.gas ? '' : 'It needs gas. ') + (G.truck.battery ? '' : 'It needs a battery.'), 2800); return; }
    Cut.startTruck(); }, { cone: 0.6 });
  onReset(() => { g.position.set(TRUCK_HOME.x, 0, TRUCK_HOME.z); g.rotation.set(0, 0, 0); hl.color.setHex(0x3a3830); truckLight.intensity = 0; });
})();

/* ------------------------------------------------------------------
   GAS STATION (power box behind, 4 fuses)
------------------------------------------------------------------ */
const Station = { lamps: [], hum: null, slots: [], signMat: null, textMat: null, update: function () {} };
(function buildGasStation() {
  const x0 = 68, x1 = 84, z0 = -28, z1 = -20, H = 3.6;
  B(76, 0.03, -10, 36, 0.06, 24, MAT.concrete, false);
  B(76, 0.1, -24, 16.4, 0.2, 8.4, MAT.concrete, true);
  perimeter(x0, z0, x1, z1, 0, H, MAT.brick, {
    s: [{ c: 76, w: 1.6, y0: 0, y1: 2.3 }, { c: 71, w: 3.2, y0: 0.9, y1: 2.6, glass: true }, { c: 81.2, w: 3.2, y0: 0.9, y1: 2.6, glass: true }],
    w: [{ c: -24, w: 1.4, y0: 1.0, y1: 2.4, glass: true }], e: [{ c: -24, w: 1.4, y0: 1.0, y1: 2.4, glass: true }]
  });
  B(76, 3.75, -24, 17, 0.3, 9, MAT.concrete, false);
  addZone(x0, z0, x1, z1, 0, H);
  const door = makeDoor({ axis: 'x', hx: 75.2, hz: z1, w: 1.6, h: 2.3, dir: 1, name: 'glass door', mat: M(0x39484f), locked: () => !G.powerOn, lockMsg: 'The electric lock is dead. The station has no power.' });
  addDoorInter(door, { locked: () => 'Locked (no power)' });
  // glowing price sign + roof sign
  Station.signMat = new THREE.MeshBasicMaterial({ map: labelTex(['GAS & GROCERY'], { w: 512, h: 128, bg: '#0f1a14', fg: '#e8e0b8', border: '#e8e0b8', size: 64 }), color: 0x222222 });
  const roofSign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.5), Station.signMat); roofSign.position.set(76, 4.7, -19.8); stat(roofSign); scene.add(roofSign);
  Station.textMat = new THREE.MeshBasicMaterial({ map: labelTex(['REG   3.89', 'DSL   4.19'], { w: 256, h: 256, bg: '#101010', fg: '#f0b838', border: '#f0b838', size: 52 }), color: 0x222222 });
  CYL(90, 3.4, -4.5, 0.12, 0.14, 6.8, 8, MAT.metal); addCircle(90, -4.5, 0.3);
  const ps = new THREE.Mesh(gBox(0.3, 2.4, 2.2), Station.textMat); ps.position.set(90, 6.3, -4.5); stat(ps); scene.add(ps);
  // canopy + pumps
  [[66.5, -16], [85.5, -16], [66.5, -6], [85.5, -6]].forEach(p => B(p[0], 2.5, p[1], 0.4, 5, 0.4, MAT.white, true));
  B(76, 5.15, -11, 21, 0.3, 12, MAT.metal, false);
  [71, 81].forEach(x => { B(x, 0.95, -11, 0.9, 1.9, 0.55, MAT.red, true); B(x, 1.45, -11.29, 0.5, 0.3, 0.03, MAT.black, false); B(x, 0.12, -11, 1.8, 0.24, 1.3, MAT.concrete, false); });
  // interior
  B(72, 0.55, -22.4, 5, 1.1, 0.8, MAT.wood, true); B(72, 1.15, -22.4, 0.5, 0.3, 0.4, MAT.dark, false);
  B(72, 1.0, -27.5, 5, 2, 0.6, MAT.metal, true); B(80.5, 1.0, -27.5, 4.4, 2, 0.6, MAT.metal, true);
  B(83.2, 1.0, -23.6, 0.9, 2, 3.2, MAT.chrome, true); B(78, 0.5, -22.2, 0.9, 1.0, 0.9, MAT.wood, true);
  B(76, 0.5, -24.8, 1.0, 1.0, 1.0, MAT.fabric, true);
  Station.lamps = [addLamp(73, 3.4, -24, { color: 0xdbe6ff, inten: 1.25, dist: 13, flicker: 0.6 }), addLamp(79, 3.4, -24, { color: 0xdbe6ff, inten: 1.25, dist: 13, flicker: 0.6 }),
    addLamp(71, 4.9, -11, { color: 0xfff0c8, inten: 1.4, dist: 20, flicker: 0.3 }), addLamp(81, 4.9, -11, { color: 0xfff0c8, inten: 1.4, dist: 20, flicker: 0.3 })];
  // gas can
  const can = new THREE.Group();
  const cb = new THREE.Mesh(gBox(0.36, 0.46, 0.17), M(0xa02a20)); can.add(cb);
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.2, 6), M(0xc7b020)); sp.position.set(0.1, 0.32, 0); sp.rotation.z = -0.7; can.add(sp);
  const hd = new THREE.Mesh(gBox(0.2, 0.05, 0.04), MAT.dark); hd.position.y = 0.26; can.add(hd);
  can.position.set(80.5, 0.25, -26.6); scene.add(can);
  B(80.5, 0.1, -26.6, 0.6, 0.2, 0.5, MAT.wood, false);
  addItem('gas', can, new V3(80.5, 0.5, -26.6), 'Take the gas can', () => { G.inv.gas = true; ui.toast('Gas can: it sloshes. Take it to the truck.', 2800); ui.refreshInv(); });
  addNote(new V3(72, 1.3, -22.0), 'Notice (taped to the register)', 'DOORS AND PUMPS ARE ON THE BACKUP CIRCUIT.\n\nBreaker box is behind the building. It takes 4 fuses.\nSpares were kept at the general store, the old cabin, the river house... and Dale left one in his car.\n\nGas can for the generator is on the back shelf.', 'Read the notice');
  // power box (behind)
  const pb = new THREE.Group(); pb.position.set(76, 1.4, -28.3); scene.add(pb);
  const pbody = new THREE.Mesh(gBox(1.0, 1.3, 0.28), M(0x46564f)); pb.add(pbody);
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(gBox(0.12, 0.34, 0.06), new THREE.MeshBasicMaterial({ color: 0x050505 }));
    s.position.set(-0.33 + i * 0.22, 0, -0.16); pb.add(s); Station.slots.push(s);
  }
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.2), new THREE.MeshBasicMaterial({ map: labelTex(['MAIN BREAKER'], { w: 256, h: 64, bg: '#c9b32a', fg: '#1a1a14', size: 30 }) }));
  pl.position.set(0, 0.5, -0.145); pl.rotation.y = Math.PI; pb.add(pl);
  const gen = B(80, 0.5, -29.6, 1.4, 1.0, 0.8, M(0x555e3a), true);
  const slotsOn = (n) => Station.slots.forEach((s, i) => s.material.color.setHex(i < n ? 0xd7b25a : 0x050505));
  addInter(new V3(76, 1.4, -28.6), 2.8, () => {
    if (G.powerOn) return 'Breaker box: power restored';
    if (G.inv.fuses > 0) return 'Insert ' + G.inv.fuses + ' fuse' + (G.inv.fuses > 1 ? 's' : '') + ' (' + G.fusesInstalled + '/4 installed)';
    return 'Breaker box: ' + G.fusesInstalled + '/4 fuses installed';
  }, () => {
    if (G.powerOn) return;
    if (G.inv.fuses <= 0) { SFX.error(); ui.toast('The box needs fuses. ' + G.fusesInstalled + ' of 4 are in.', 2600); return; }
    G.fusesInstalled = Math.min(4, G.fusesInstalled + G.inv.fuses); G.inv.fuses = 0; slotsOn(G.fusesInstalled); SFX.zap(); ui.refreshInv();
    if (G.fusesInstalled >= 4) {
      G.powerOn = true; G.powerT = 0; SFX.powerUp();
      ui.toast('All four fuses are in. The station shudders awake.', 3600);
      setTimeout(() => { if (G.powerOn && !Station.hum) Station.hum = SFX.hum(80, 0.5, -29.6); }, 1800);
      MonsterHook.noise(76, -28, 120);
    } else ui.toast(G.fusesInstalled + ' of 4 fuses installed.', 2400);
  }, { cone: 0.7 });
  Station.update = function (dt) {
    if (!G.powerOn) return;
    G.powerT += dt;
    Station.lamps.forEach((L, i) => { const f = G.powerT - (1.2 + i * 0.9); L.on = f > 0 && (f > 3 || Math.random() < 0.35 + f * 0.2); });
    const k = clamp((G.powerT - 3.2) / 2.5, 0, 1), v = 0.13 + 0.87 * k * (Math.random() < 0.06 && k < 1 ? 0.3 : 1);
    Station.signMat.color.setRGB(v, v, v * 0.9); Station.textMat.color.setRGB(v, v * 0.95, v * 0.8);
  };
  onReset(() => {
    slotsOn(0); Station.signMat.color.setHex(0x222222); Station.textMat.color.setHex(0x222222);
    if (Station.hum) { Station.hum.stop(); Station.hum = null; }
  });
})();

/* ------------------------------------------------------------------
   WORKSHOP (car battery in storage, simple battery on the shelves)
------------------------------------------------------------------ */
(function buildWorkshop() {
  const x0 = 128, x1 = 152, z0 = 17, z1 = 33, H = 4.2;
  B(140, 0.1, 25, 24.4, 0.2, 16.4, MAT.concrete, true);
  perimeter(x0, z0, x1, z1, 0, H, MAT.metal, {
    n: [{ c: 134, w: 1.1, y0: 0, y1: 2.2 }, { c: 138.3, w: 1.4, y0: 2.0, y1: 3.2, glass: true }],
    s: [{ c: 134, w: 1.4, y0: 2.0, y1: 3.2, glass: true }, { c: 142, w: 1.4, y0: 2.0, y1: 3.2, glass: true }],
    w: [{ c: 25, w: 1.4, y0: 2.0, y1: 3.2, glass: true }]
  });
  B(140, H + 0.05, 25, 24.4, 0.2, 16.4, MAT.metal, false);
  gableRoof(140, H + 0.1, 25, 25.4, 18, 1.6, MAT.roof, false);
  B(144, 1.7, 16.76, 5, 3.4, 0.1, M(0x3d4a50, TEX.metal), false);       // big roller door (does not open)
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 0.9), new THREE.MeshBasicMaterial({ map: labelTex(['KESSLER AUTO & ELECTRIC'], { w: 512, h: 72, bg: '#2a2f33', fg: '#d9d2b8', size: 38, wear: true }), color: 0x777777 }));
  sg.position.set(137.5, 3.8, 16.68); sg.rotation.y = Math.PI; stat(sg); scene.add(sg);
  addZone(x0, z0, x1, z1, 0, H);
  const d = makeDoor({ axis: 'x', hx: 133.45, hz: z0, w: 1.1, h: 2.2, dir: -1, name: 'side door', mat: M(0x3c474c) });
  addDoorInter(d);
  // storage room
  wallRun(146, 17.15, 146, 32.85, 0, H - 0.05, MAT.metal, [{ c: 26, w: 1.1, y0: 0, y1: 2.2 }], 0.2);
  const sd = makeDoor({ axis: 'z', hx: 146, hz: 25.45, w: 1.1, h: 2.2, dir: 1, name: 'storage door', mat: M(0x3c474c) });
  addDoorInter(sd);
  B(151.4, 1.0, 21, 0.8, 2.0, 5.5, MAT.metal, true); B(151.4, 0.8, 30, 0.8, 1.6, 4, MAT.metal, true);
  B(149, 0.4, 28, 0.8, 0.8, 0.8, MAT.wood, true); B(148.4, 0.3, 21.5, 1.0, 0.6, 1.0, MAT.wood, true); B(147.8, 0.9, 31.6, 1.4, 1.8, 0.8, MAT.rust, true);
  // lights + switch
  const wl = [addLamp(134, 3.9, 22, { inten: 1.4, dist: 15, color: 0xe8efff, flicker: 0.15 }), addLamp(142, 3.9, 28, { inten: 1.4, dist: 15, color: 0xe8efff, flicker: 0.15 }), addLamp(149, 3.9, 25, { inten: 1.1, dist: 11, color: 0xe8efff })];
  addSwitch(135.6, 1.4, z0 + 0.2, 's', wl);
  // car on a lift
  const car = makeCar(0x34424a, false); car.position.set(138, 1.3, 27.5); car.rotation.y = Math.PI / 2; scene.add(car);
  [[136.2, 25.6], [139.8, 25.6], [136.2, 29.4], [139.8, 29.4]].forEach(p => B(p[0], 0.65, p[1], 0.2, 1.3, 0.2, MAT.rust, true));
  addBox(136, 25.2, 140, 29.8, 0, 2.3);
  // bench, shelves, boards
  B(129.5, 0.5, 21.5, 1.0, 1.0, 3.2, MAT.wood, true); B(129.5, 1.04, 21.5, 1.1, 0.08, 3.3, MAT.woodLight, false);
  B(136, 0.75, 32.4, 5, 1.5, 0.6, MAT.metal, true);
  B(131, 0.5, 31.5, 1.6, 1.0, 1.6, MAT.rust, true);
  [[130.2, 29.2], [130.9, 29.0], [149.5, 18.5]].forEach(p => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.17, 8, 14), MAT.black); t.rotation.x = Math.PI / 2; t.position.set(p[0], 0.2, p[1]); stat(t); scene.add(t); addCircle(p[0], p[1], 0.55); });
  [[125.5, 20], [125.6, 21], [126.6, 20.4]].forEach(p => { CYL(p[0], 0.5, p[1], 0.3, 0.3, 1.0, 10, MAT.red); addCircle(p[0], p[1], 0.35); });
  addNote(new V3(128.5, 1.6, 27), 'Parts board', 'STORAGE ROOM: car batteries (heavy, bottom of the crates).\nSHELF BY THE BENCH: D-cells for the radio.\n\nLights: switch beside the side door.\nLock up when you leave, Walt.', 'Read the board');
  const wb = new THREE.Mesh(gBox(0.1, 1.3, 0.04), M(0x1a1a1a)); wb.position.set(128.2, 1.6, 27); scene.add(wb);
  // car battery
  const bat = new THREE.Group();
  const bb = new THREE.Mesh(gBox(0.5, 0.3, 0.26), M(0x14181a)); bat.add(bb);
  [-0.15, 0.15].forEach(x => { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.07, 6), M(0xb0a090)); t.position.set(x, 0.18, 0); bat.add(t); });
  const lb = new THREE.Mesh(gBox(0.3, 0.12, 0.01), M(0xc8a020)); lb.position.set(0, 0.02, 0.135); bat.add(lb);
  bat.position.set(149, 0.95, 28); scene.add(bat);
  addItem('carbattery', bat, new V3(149, 1.0, 28), 'Take the car battery', () => { G.inv.battery = true; ui.toast('Car battery: heavy. The truck is waiting.', 2800); ui.refreshInv(); });
  // simple battery
  const sb = new THREE.Group();
  const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.17, 10), M(0x9a6a22, null, { shininess: 50 })); sb.add(cb);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 8), MAT.chrome); cap.position.y = 0.1; sb.add(cap);
  sb.position.set(134.6, 1.59, 32.25); scene.add(sb);
  addItem('simple', sb, new V3(134.6, 1.6, 32.2), 'Take the small battery', () => { G.inv.simple = true; ui.toast('A fresh D-cell. It might just power a radio.', 2800); ui.refreshInv(); });
})();

/* ------------------------------------------------------------------
   ABANDONED STORE
------------------------------------------------------------------ */
(function buildStore() {
  const x0 = -95, x1 = -75, z0 = -30, z1 = -18, H = 3.6;
  B(-85, 0.1, -24, 20.4, 0.2, 12.4, MAT.woodFloor, true);
  perimeter(x0, z0, x1, z1, 0, H, MAT.brick, {
    s: [{ c: -85, w: 1.6, y0: 0, y1: 2.2 }, { c: -91, w: 2.2, y0: 0.9, y1: 2.4 }, { c: -79, w: 2.2, y0: 0.9, y1: 2.4 }],
    w: [{ c: -24, w: 1.4, y0: 1.0, y1: 2.2 }], e: [{ c: -26, w: 1.4, y0: 1.0, y1: 2.2 }]
  });
  B(-85, 3.7, -24, 20.6, 0.25, 12.6, MAT.concrete, false);
  B(-85, 4.5, -17.95, 20.6, 1.8, 0.3, MAT.brick, false);
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.3), new THREE.MeshBasicMaterial({ map: labelTex(['GENERAL STORE'], { w: 512, h: 80, bg: '#4a3a2a', fg: '#b8a888', size: 52, wear: true }), color: 0x888888 }));
  sg.position.set(-85, 4.45, -17.78); stat(sg); scene.add(sg);
  addZone(x0, z0, x1, z1, 0, H);
  const d = makeDoor({ axis: 'x', hx: -85.8, hz: z1, w: 1.6, h: 2.2, dir: 1, name: 'store door', mat: MAT.woodDark, startOpen: true });
  addDoorInter(d);
  // clutter
  B(-80, 0.55, -21.2, 6, 1.1, 0.8, MAT.wood, true);
  B(-91, 1.0, -26.5, 0.6, 2.0, 5, MAT.woodDark, true); B(-88, 1.0, -24.2, 0.6, 2.0, 5, MAT.woodDark, true);
  const tilt = new THREE.Mesh(gBox(0.6, 2.0, 4), MAT.woodDark); tilt.position.set(-84, 1.0, -22); tilt.rotation.set(0, 0.25, 0.9); stat(tilt); scene.add(tilt);
  B(-82.5, 0.3, -26, 1, 0.6, 1, MAT.wood, true); B(-80.5, 0.3, -27.4, 1, 0.6, 1, MAT.wood, true); B(-78.2, 0.25, -23.4, 0.9, 0.5, 0.9, MAT.wood, true);
  B(-88, 0.9, -29.4, 6, 1.8, 0.6, MAT.woodDark, true);
  const f = makeFuseMesh(); f.position.set(-86, 1.86, -29.4); scene.add(f);
  addItem('fuse1', f, new V3(-86, 1.85, -29.4), 'Take the fuse from the back shelf', () => { G.inv.fuses++; G.fusesFound++; ui.toast('A fuse. ' + G.fusesFound + ' of 4 found.', 2400); ui.refreshInv(); });
  addNote(new V3(-80, 1.2, -21.2), 'Crumpled receipt', 'Fuse stock: SOLD OUT.\nLast one is on the back shelf, behind the cans.\n\nWe close at 6. If you hear the horn, lock the door and kill the lights.', 'Read the receipt');
})();

/* ------------------------------------------------------------------
   OLD CABIN (fuse #2)
------------------------------------------------------------------ */
(function buildCabin() {
  const x0 = -179, x1 = -171, z0 = 127, z1 = 133;
  B(-175, 0.08, 130, 8.4, 0.16, 6.4, MAT.woodFloor, true);
  perimeter(x0, z0, x1, z1, 0, 2.8, MAT.woodCabin, {
    e: [{ c: 130, w: 1.0, y0: 0, y1: 2.1 }], n: [{ c: -175, w: 1.2, y0: 1.0, y1: 2.0, glass: true }], s: [{ c: -175, w: 1.2, y0: 1.0, y1: 2.0, glass: true }]
  });
  B(-175, 2.9, 130, 8.4, 0.2, 6.4, MAT.woodDark, false);
  gableRoof(-175, 3.0, 130, 9.4, 7.6, 1.9, MAT.roof, false);
  addZone(x0, z0, x1, z1, 0, 3.0);
  const d = makeDoor({ axis: 'z', hx: x1, hz: 129.5, w: 1.0, h: 2.1, dir: -1, name: 'cabin door', mat: MAT.woodDark });
  addDoorInter(d);
  B(-177.4, 0.4, 128.3, 2.0, 0.5, 1.1, MAT.woodDark, true); B(-177.4, 0.72, 128.3, 1.9, 0.14, 1.0, MAT.fabric, false);
  B(-174.4, 0.75, 131.6, 1.5, 0.08, 0.9, MAT.woodLight, true); [[-175, 131.3], [-173.8, 131.3], [-175, 131.9], [-173.8, 131.9]].forEach(p => B(p[0], 0.37, p[1], 0.07, 0.74, 0.07, MAT.woodLight, false));
  B(-177.5, 0.6, 131.8, 0.9, 1.2, 0.9, MAT.black, true); CYL(-177.5, 2.3, 131.8, 0.07, 0.07, 2.2, 6, MAT.black);
  B(-178.4, 1.1, 129.9, 0.4, 0.08, 2.4, MAT.woodDark, true); B(-178.6, 0.55, 129.9, 0.1, 1.1, 2.4, MAT.woodDark, true);
  addLamp(-174.4, 0.95, 131.6, { color: 0xffa860, inten: 1.0, dist: 8, on: true, flicker: 0.5, size: 0.06 });
  const f = makeFuseMesh(); f.position.set(-178.3, 1.18, 129.4); scene.add(f);
  addItem('fuse2', f, new V3(-178.3, 1.2, 129.4), 'Take the fuse from the mantle', () => { G.inv.fuses++; G.fusesFound++; ui.toast('A fuse. ' + G.fusesFound + ' of 4 found.', 2400); ui.refreshInv(); });
  addNote(new V3(-174.4, 0.9, 131.3), 'Torn diary page', 'It stood at the window all night.\nI never saw it move. I only heard the horn breathe in.\n\nIt had my brother\'s voice by morning.\n\nI left a fuse on the mantle. Maybe somebody needs it more than I do.', 'Read the page');
})();

/* ------------------------------------------------------------------
   RIVER HOUSE (fuse #3 + radio cabin key)
------------------------------------------------------------------ */
(function buildRiverHouse() {
  const x0 = 166, x1 = 175, z0 = 156.5, z1 = 163.5;
  B(170.5, 0.08, 160, 9.4, 0.16, 7.4, MAT.woodFloor, true);
  perimeter(x0, z0, x1, z1, 0, 2.8, MAT.woodCabin, {
    w: [{ c: 158.5, w: 1.0, y0: 0, y1: 2.1 }], e: [{ c: 160.5, w: 1.4, y0: 1.0, y1: 2.0, glass: true }], n: [{ c: 170.5, w: 1.4, y0: 1.0, y1: 2.0, glass: true }], s: [{ c: 170.5, w: 1.4, y0: 1.0, y1: 2.0, glass: true }]
  });
  B(170.5, 2.9, 160, 9.4, 0.2, 7.4, MAT.woodDark, false);
  gableRoof(170.5, 3.0, 160, 10.4, 8.4, 2.0, MAT.roof, false);
  addZone(x0, z0, x1, z1, 0, 3.0);
  const d = makeDoor({ axis: 'z', hx: x0, hz: 158.0, w: 1.0, h: 2.1, dir: 1, name: 'river house door', mat: MAT.woodDark });
  addDoorInter(d);
  B(173.8, 0.6, 157.5, 0.9, 1.2, 0.9, MAT.black, true);
  B(168.1, 0.5, 162.9, 1.4, 1.0, 0.7, MAT.wood, true);
  B(173.0, 0.4, 161.8, 2.0, 0.5, 1.0, MAT.woodDark, true); B(173.0, 0.72, 161.8, 1.9, 0.14, 0.9, MAT.fabric, false);
  B(170.4, 0.75, 159.2, 1.4, 0.08, 0.9, MAT.woodLight, true); [[169.8, 158.9], [171.0, 158.9], [169.8, 159.6], [171.0, 159.6]].forEach(p => B(p[0], 0.37, p[1], 0.07, 0.74, 0.07, MAT.woodLight, false));
  addLamp(170.4, 0.95, 159.2, { color: 0xffb870, inten: 1.0, dist: 9, on: true, flicker: 0.35, size: 0.06 });
  // key on a nail by the stove
  const key = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12), M(0xb8962e, null, { shininess: 60 })); key.add(ring);
  const shaft = new THREE.Mesh(gBox(0.015, 0.14, 0.012), M(0xb8962e, null, { shininess: 60 })); shaft.position.y = -0.1; key.add(shaft);
  key.position.set(172.4, 1.6, 156.75); scene.add(key);
  addItem('key', key, new V3(172.4, 1.6, 156.8), 'Take the key from the nail', () => { G.inv.key = true; ui.toast('Radio cabin key. The note was right.', 2800); ui.refreshInv(); });
  // fuse in the cabinet
  const f = makeFuseMesh(); f.position.set(168.1, 1.07, 162.9); scene.add(f);
  addItem('fuse3', f, new V3(168.1, 1.1, 162.9), 'Take the fuse from the cabinet', () => { G.inv.fuses++; G.fusesFound++; ui.toast('A fuse. ' + G.fusesFound + ' of 4 found.', 2400); ui.refreshInv(); });
  // pier + boat
  B(182.5, 0.33, 164.5, 15, 0.16, 2.0, MAT.woodDark, true);
  [[176, 163.6], [180, 163.6], [184, 163.6], [188, 163.6]].forEach(p => B(p[0], 0.15, p[1], 0.18, 0.3, 0.18, MAT.woodDark, false));
  const boat = new THREE.Mesh(gBox(3.2, 0.5, 1.3), M(0x3b3f36)); boat.position.set(185, 0.18, 166.8); boat.rotation.y = 0.12; stat(boat); scene.add(boat);
})();

/* ------------------------------------------------------------------
   RADIO TOWER & LOCKED CABIN
------------------------------------------------------------------ */
const towerLights = [];
const RadioCabin = { door: null, lamp: null, led: [] };
function towerGeo(H, b0, b1) {
  const parts = [], c = new THREE.Color(0x3d4043), segs = 9;
  const hw = (y) => b0 + (b1 - b0) * (y / H);
  const bar = (p, q, t) => {
    const a = new V3(p[0], p[1], p[2]), b = new V3(q[0], q[1], q[2]), dir = b.clone().sub(a), len = dir.length();
    const quat = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), dir.normalize());
    return { geo: new THREE.BoxGeometry(t, len, t), m: new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), quat, new V3(1, 1, 1)), c: c };
  };
  const cr = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  for (let s = 0; s < segs; s++) {
    const y0 = H * s / segs, y1 = H * (s + 1) / segs, w0 = hw(y0), w1 = hw(y1);
    cr.forEach(k => parts.push(bar([k[0] * w0, y0, k[1] * w0], [k[0] * w1, y1, k[1] * w1], 0.22)));
    for (let k = 0; k < 4; k++) {
      const a = cr[k], q = cr[(k + 1) % 4];
      parts.push(bar([a[0] * w1, y1, a[1] * w1], [q[0] * w1, y1, q[1] * w1], 0.12));
      parts.push(bar([a[0] * w0, y0, a[1] * w0], [q[0] * w1, y1, q[1] * w1], 0.08));
    }
  }
  return mergeParts(parts);
}
(function buildRadio() {
  const cz = -222;
  B(0, 0.1, cz, 6.4, 0.2, 5.4, MAT.concrete, true);
  perimeter(-3, -224.5, 3, -219.5, 0, 2.8, MAT.metal, { s: [{ c: 0, w: 1.0, y0: 0, y1: 2.1 }], w: [{ c: cz, w: 1.2, y0: 1.0, y1: 2.0, glass: true }], e: [{ c: cz, w: 1.2, y0: 1.0, y1: 2.0, glass: true }] });
  B(0, 2.95, cz, 6.6, 0.3, 5.6, MAT.metal, false);
  addZone(-3, -224.5, 3, -219.5, 0, 3.0);
  const door = makeDoor({ axis: 'x', hx: -0.5, hz: -219.5, w: 1.0, h: 2.1, dir: 1, name: 'cabin door', mat: M(0x3c474c), locked: () => !G.radio.unlocked, lockMsg: 'Locked. A note is pinned beside the door.' });
  RadioCabin.door = door;
  addDoorInter(door, {
    locked: () => G.inv.key ? 'Unlock with the key' : 'Locked door',
    tryUnlock: () => { if (!G.inv.key) return false; G.radio.unlocked = true; G.inv.key = false; SFX.click(0.5); SFX.pickup(); ui.toast('The key turns. The lock gives way.', 2400); ui.refreshInv(); toggleDoor(door); return true; }
  });
  onReset(() => { G.radio.unlocked = false; });
  const noteBoard = new THREE.Mesh(gBox(0.5, 0.65, 0.02), M(0xcfc3a1)); noteBoard.position.set(1.8, 1.5, -219.32); scene.add(noteBoard);
  addNote(new V3(1.8, 1.5, -219.3), 'Note pinned to the door', 'GONE FISHING AT THE RIVER. KEY\'S ON THE NAIL BY THE STOVE. DON\'T LEAVE IT FOR THE SCAVENGERS.\n\nThe transmitter has no battery. Kessler\'s shop on Route 9 keeps D-cells on a shelf by the bench.\n\nSend the call, then keep your head down until they come.\n\n  W.', 'Read the note');
  // interior
  B(0, 0.5, -223.7, 3.4, 1.0, 0.8, MAT.wood, true);
  B(0, 1.5, -224.1, 2.8, 1.0, 0.4, MAT.black, false);
  for (let i = 0; i < 5; i++) {
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: 0x220000 })); led.position.set(-1.0 + i * 0.5, 1.8, -223.88); scene.add(led); RadioCabin.led.push(led);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 10), MAT.chrome); dial.rotation.x = Math.PI / 2; dial.position.set(-1.0 + i * 0.5, 1.45, -223.88); scene.add(dial);
  }
  const sock = new THREE.Mesh(gBox(0.22, 0.22, 0.08), M(0x1c2320)); sock.position.set(1.0, 1.1, -223.3); scene.add(sock);
  B(-2.0, 0.35, -221.9, 0.9, 0.5, 2.2, MAT.woodDark, true); B(-2.0, 0.65, -221.9, 0.85, 0.14, 2.1, MAT.fabric, false);
  B(1.8, 0.4, -223.4, 0.5, 0.8, 0.5, MAT.rust, true);
  RadioCabin.lamp = addLamp(0, 2.55, cz, { color: 0xffe0a0, inten: 1.1, dist: 9 });
  const radioPos = new V3(0, 1.2, -223.3);
  addInter(radioPos, 2.8, () => {
    if (G.radio.called) return null;
    if (!G.radio.battery) return G.inv.simple ? 'Put the battery in the transmitter' : 'Transmitter (it needs a battery)';
    return 'Send the distress call';
  }, () => {
    if (!G.radio.battery) {
      if (!G.inv.simple) { SFX.error(); ui.toast('The battery socket is empty. A small battery would do.', 2800); return; }
      G.inv.simple = false; G.radio.battery = true; RadioCabin.lamp.on = true; SFX.zap(); SFX.beep(660, 0.1, 0.1);
      RadioCabin.led.forEach((l, i) => l.material.color.setHex(i % 2 ? 0x22ff55 : 0xff3322));
      G.radioLoop = SFX.radioLoop(0, 1.4, -223.7);
      ui.toast('Lights wake up on the transmitter. Static crackles.', 3000); ui.refreshInv();
    } else { Cut.startRadio(); }
  }, { cone: 0.65 });
  onReset(() => { G.radio.battery = false; G.radio.called = false; RadioCabin.led.forEach(l => l.material.color.setHex(0x220000)); if (G.radioLoop) { G.radioLoop.stop(); G.radioLoop = null; } });
  // antenna mast + lattice towers
  CYL(2.2, 14, -223.5, 0.1, 0.18, 22, 6, MAT.metal); CYL(2.2, 25.5, -223.5, 0.04, 0.05, 6, 4, MAT.metal);
  const tg = towerGeo(46, 4.4, 1.0), tm = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 8 });
  [[-38, cz - 38], [38, cz - 38], [-38, cz + 38], [38, cz + 38]].forEach(p => {
    const m = new THREE.Mesh(tg, tm); m.position.set(p[0], 0, p[1]); stat(m); scene.add(m); addCircle(p[0], p[1], 5.0);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2200 })); l.position.set(p[0], 47, p[1]); scene.add(l); towerLights.push(l);
  });
  const ml = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2200 })); ml.position.set(2.2, 28.7, -223.5); scene.add(ml); towerLights.push(ml);
})();

/* ------------------------------------------------------------------
   per-frame world updates and full reset
------------------------------------------------------------------ */
const MonsterHook = { noise: function () {} };
const waterTex = TEX.water;
function updateWorld(dt, t) {
  Station.update(dt);
  const on = Math.sin(t * 2.2) > 0.2;
  towerLights.forEach((l, i) => l.material.color.setHex(on && ((i + Math.floor(t * 0.6)) % 2 === 0) ? 0xff3010 : 0x330800));
  waterTex.offset.y -= dt * 0.012;
  for (const d of doors) {
    const target = d.open ? 1 : 0;
    if (d.ang !== target) {
      d.ang += clamp(target - d.ang, -dt * 2.2, dt * 2.2); d.apply();
      if (!d.open && d.ang <= 0.001) { d.ang = 0; d.apply(); d.col.on = true; }
    }
  }
}
onReset(() => {
  doors.forEach(d => { d.open = d.startOpen; d.ang = d.startOpen ? 1 : 0; d.col.on = !d.startOpen; d.apply(); });
});

/* ------------------------------------------------------------------
   7. PLAYER
------------------------------------------------------------------ */
const PR = 0.32, STEP = 0.5, EYE = 1.62, GRAV = 18;
const player = {
  pos: new V3(SPAWN.x, SPAWN.y, SPAWN.z), vy: 0, yaw: SPAWN.yaw, pitch: 0, grounded: true, crouch: 0,
  stamina: 100, exhausted: false, stepDist: 0, indoors: false, sprinting: false, moving: false, noise: 0,
  bob: 0, flashOn: false, dead: false, flashLevel: 0
};
let gameState = 'menu';       // menu | playing | paused | cutscene | dying | over | ended
let shake = 0;
let elapsed = 0;               // seconds of real play
const _fwd = new V3(), _tmpV = new V3();

function resolveXZ(p, h) {
  for (let it = 0; it < 3; it++) {
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (!b.on || b.y1 <= p.y + STEP + 0.001 || b.y0 >= p.y + h) continue;
      const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1);
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < PR * PR) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (PR - d) / d; p.x += dx * k; p.z += dz * k; }
        else {
          const l = p.x - b.x0, r = b.x1 - p.x, t = p.z - b.z0, bt = b.z1 - p.z, m = Math.min(l, r, t, bt);
          if (m === l) p.x = b.x0 - PR; else if (m === r) p.x = b.x1 + PR; else if (m === t) p.z = b.z0 - PR; else p.z = b.z1 + PR;
        }
      }
    }
    const gx = Math.floor(p.x / GRID), gz = Math.floor(p.z / GRID);
    for (let ix = gx - 1; ix <= gx + 1; ix++) for (let iz = gz - 1; iz <= gz + 1; iz++) {
      const a = treeGrid.get(ix * 4096 + iz); if (!a) continue;
      for (let k = 0; k < a.length; k++) {
        const c = a[k], dx = p.x - c.x, dz = p.z - c.z, rr = PR + c.r, d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2), s = (rr - d) / d; p.x += dx * s; p.z += dz * s; }
      }
    }
  }
}
function groundAt(x, z, feetY) {
  let g = 0;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (!b.on || b.y1 > feetY + STEP + 0.001 || b.y1 <= g) continue;
    if (x < b.x0 - 0.02 || x > b.x1 + 0.02 || z < b.z0 - 0.02 || z > b.z1 + 0.02) continue;
    g = b.y1;
  }
  return g;
}
function isIndoors(p) {
  for (let i = 0; i < zones.length; i++) { const z = zones[i]; if (p.x > z.x0 && p.x < z.x1 && p.z > z.z0 && p.z < z.z1 && p.y > z.y0 - 0.6 && p.y < z.y1) return true; }
  return false;
}
function surfaceAt(x, z) {
  if (player.indoors) return 'wood';
  if (Math.abs(z) < 5.4) return 'road';
  if (x > 58 && x < 94 && z > -22 && z < 2) return 'concrete';
  return distToPaths(x, z) < 0 ? 'dirt' : 'grass';
}
function resetPlayer() {
  player.pos.set(SPAWN.x, SPAWN.y, SPAWN.z); player.vy = 0; player.yaw = SPAWN.yaw; player.pitch = 0.05; player.grounded = true;
  player.crouch = 0; player.stamina = 100; player.exhausted = false; player.stepDist = 0; player.flashOn = false; player.flashLevel = 0;
  player.dead = false; player.indoors = true; shake = 0; elapsed = 0;
}

function updatePlayer(dt) {
  const p = player.pos;
  let mx = input.moveX, mz = input.moveZ;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const crouching = input.crouchHeld || input.crouchToggle;
  player.crouch += ((crouching ? 1 : 0) - player.crouch) * (1 - Math.exp(-dt * 10));
  const moving = len > 0.08;
  player.moving = moving;
  const wantSprint = input.sprint && moving && !crouching && !player.exhausted && player.stamina > 0 && mz > -0.3;
  player.sprinting = wantSprint;
  if (wantSprint) { player.stamina -= dt * 11; if (player.stamina <= 0) { player.stamina = 0; player.exhausted = true; } }
  else { player.stamina = Math.min(100, player.stamina + dt * (moving ? 7 : 14)); if (player.exhausted && player.stamina > 28) player.exhausted = false; }
  const speed = (crouching ? 1.9 : wantSprint ? 6.8 : 3.6) * Math.min(1, len);
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  const vx = (-sy * mz + cy * mx) * speed, vz = (-cy * mz - sy * mx) * speed;
  const h = 1.75 - 0.65 * player.crouch;
  const steps = Math.max(1, Math.ceil(Math.hypot(vx, vz) * dt / 0.2));
  for (let i = 0; i < steps; i++) { p.x += vx * dt / steps; p.z += vz * dt / steps; resolveXZ(p, h); }
  p.x = clamp(p.x, -292, 292); p.z = clamp(p.z, -292, 292);
  // vertical
  const g = groundAt(p.x, p.z, p.y);
  if (input.jump) { if (player.grounded && !crouching) { player.vy = 5.2; player.grounded = false; } input.jump = false; }
  player.vy -= GRAV * dt; p.y += player.vy * dt;
  if (p.y <= g + 0.001 && player.vy <= 0) { p.y = g; player.vy = 0; player.grounded = true; }
  else if (player.grounded && player.vy <= 0 && p.y - g <= STEP + 0.01) { p.y = g; player.vy = 0; }
  else player.grounded = false;
  if (p.y < -5) { p.y = 0; player.vy = 0; }
  // footsteps + noise
  player.noise = !moving ? 0 : (wantSprint ? 1 : crouching ? 0.2 : 0.5);
  if (moving && player.grounded) {
    player.stepDist += speed * dt;
    const stride = wantSprint ? 2.5 : crouching ? 1.5 : 2.0;
    if (player.stepDist > stride) {
      player.stepDist = 0; SFX.step(surfaceAt(p.x, p.z), wantSprint ? 0.26 : crouching ? 0.07 : 0.15);
      if (wantSprint) MonsterHook.noise(p.x, p.z, 38);
    }
    player.bob += dt * (wantSprint ? 11 : crouching ? 6 : 7.5);
  }
  const ind = isIndoors(p);
  if (ind !== player.indoors) { player.indoors = ind; SFX.setIndoor(ind); }
  if (p.y > 0.5 || ind) { if (!G.flags.wokeUp) G.flags.wokeUp = true; }
  if (!G.flags.leftHouse && Math.hypot(p.x, p.z - 160) > 14) G.flags.leftHouse = true;
  elapsed += dt;
}

function applyCamera(dt) {
  const p = player.pos;
  const eyeH = EYE - 0.62 * player.crouch;
  const bob = player.moving && player.grounded ? Math.sin(player.bob) * (player.sprinting ? 0.055 : 0.03) : 0;
  const s = shake;
  camera.position.set(p.x + (Math.random() - 0.5) * s * 0.1, p.y + eyeH + bob + (Math.random() - 0.5) * s * 0.1, p.z + (Math.random() - 0.5) * s * 0.1);
  camera.rotation.set(player.pitch + (Math.random() - 0.5) * s * 0.025, player.yaw, (Math.random() - 0.5) * s * 0.05 + (player.moving ? Math.sin(player.bob * 0.5) * 0.004 : 0));
  shake = Math.max(0, shake - dt * 1.8);
  // flashlight
  const want = player.flashOn ? 1 : 0;
  player.flashLevel += (want - player.flashLevel) * (1 - Math.exp(-dt * 25));
  let fl = player.flashLevel * 2.5;
  if (player.flashOn && mon.state !== 'cutscene' && mon.dist < 48) fl *= (Math.random() < (1 - mon.dist / 48) * 0.35 ? 0.15 : 1);
  flashlight.intensity = fl;
}

/* interaction */
let target = null;
function updateInteract() {
  const cp = camera.position; camera.getWorldDirection(_fwd);
  let best = null, bs = -9;
  for (let i = 0; i < interactables.length; i++) {
    const it = interactables[i];
    const dx = it.pos.x - cp.x, dy = it.pos.y - cp.y, dz = it.pos.z - cp.z;
    if (Math.abs(dy) > 2.3) continue;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > it.range) continue;
    const dot = (dx * _fwd.x + dy * _fwd.y + dz * _fwd.z) / (d || 1);
    if (dot < it.cone && d > 0.9) continue;
    const label = it.prompt(); if (!label) continue;
    const sc = dot - d * 0.07;
    if (sc > bs) { bs = sc; best = it; best.label = label; }
  }
  target = best;
  ui.setPrompt(best ? best.label : null);
}
function doInteract() {
  if (noteOpen) { ui.closeNote(); return; }
  if (gameState !== 'playing') return;
  if (target) { target.act(); updateInteract(); ui.refreshInv(); }
}
function toggleFlash() {
  if (gameState !== 'playing') return;
  player.flashOn = !player.flashOn; SFX.click(0.35);
}

/* ------------------------------------------------------------------
   8. SIREN HEAD  (model, AI, kill sequence)
------------------------------------------------------------------ */
function buildMonster() {
  const root = new THREE.Group();
  const skin = new THREE.MeshPhongMaterial({ map: TEX.flesh, color: 0xd9c2b0, shininess: 10, specular: 0x2a1a14, emissive: 0x1a0d08 });
  const metal = new THREE.MeshPhongMaterial({ map: TEX.rustMetal, shininess: 45, specular: 0x666666, side: THREE.DoubleSide, emissive: 0x100c0a });
  const dark = new THREE.MeshPhongMaterial({ color: 0x0b0908, shininess: 6, side: THREE.DoubleSide });
  const cyl = (r0, r1, len, seg, mat, y) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, seg), mat); m.position.y = y; return m; };
  const S = { root: root };
  const leg = (sx) => {
    const hip = new THREE.Group(); hip.position.set(sx * 0.7, 6.8, 0); root.add(hip);
    hip.add(cyl(0.26, 0.17, 3.35, 8, skin, -1.675));
    const knee = new THREE.Group(); knee.position.y = -3.35; hip.add(knee);
    knee.add(cyl(0.17, 0.12, 3.35, 8, skin, -1.675));
    knee.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), skin));
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 1.25), skin); foot.position.set(0, -3.4, 0.4); knee.add(foot);
    return { hip: hip, knee: knee };
  };
  S.legL = leg(-1); S.legR = leg(1);
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.7), skin); pelvis.position.y = 6.9; root.add(pelvis);
  const upper = new THREE.Group(); upper.position.set(0, 6.9, 0); root.add(upper); S.upper = upper;
  const torso = cyl(0.92, 0.55, 3.7, 12, skin, 2.0); torso.scale.z = 0.55; upper.add(torso);
  for (let i = 0; i < 6; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.66 - i * 0.015, 0.04, 5, 14), skin); rib.rotation.x = Math.PI / 2; rib.position.y = 1.3 + i * 0.3; rib.scale.y = 0.62; upper.add(rib); }
  const sh = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.28, 0.45), skin); sh.position.y = 3.6; upper.add(sh);
  const arm = (sx) => {
    const pivot = new THREE.Group(); pivot.position.set(sx * 1.3, 3.5, 0); upper.add(pivot);
    pivot.add(cyl(0.18, 0.12, 3.6, 8, skin, -1.8));
    const elbow = new THREE.Group(); elbow.position.y = -3.6; pivot.add(elbow);
    elbow.add(cyl(0.12, 0.09, 3.6, 8, skin, -1.8));
    elbow.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), skin));
    const hand = new THREE.Group(); hand.position.y = -3.6; hand.scale.setScalar(1.25); elbow.add(hand);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.14), skin); palm.position.y = -0.4; hand.add(palm);
    const fingers = [];
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Group(); f.position.set(-0.2 + i * 0.13, -0.8, 0); hand.add(f);
      f.add(cyl(0.035, 0.028, 0.9, 5, skin, -0.45));
      const j = new THREE.Group(); j.position.y = -0.9; f.add(j);
      j.add(cyl(0.028, 0.012, 0.8, 5, skin, -0.4));
      fingers.push({ f: f, j: j });
    }
    const th = new THREE.Group(); th.position.set(-sx * 0.3, -0.3, 0.04); th.rotation.z = -sx * 0.7; hand.add(th);
    th.add(cyl(0.04, 0.025, 0.6, 5, skin, -0.3));
    const palmA = new THREE.Object3D(); palmA.position.set(0, -0.45, 0.12); hand.add(palmA);
    return { pivot: pivot, elbow: elbow, hand: hand, fingers: fingers, palm: palmA };
  };
  S.armL = arm(-1); S.armR = arm(1);
  const neck = cyl(0.1, 0.14, 2.6, 6, skin, 5.05); upper.add(neck);
  const head = new THREE.Group(); head.position.y = 6.35; upper.add(head); S.head = head;
  head.add(cyl(0.22, 0.22, 0.7, 10, dark, 0.15));
  head.add(new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.1, 0.1), dark));
  [1, -1].forEach(sx => {
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.22, 1.8, 24, 1, true), metal); horn.rotation.z = -sx * Math.PI / 2; horn.position.set(sx * 1.25, 0, 0); head.add(horn);
    const drv = cyl(0.3, 0.3, 0.45, 12, dark, 0); drv.rotation.z = Math.PI / 2; drv.position.x = sx * 0.4; head.add(drv);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.05, 6, 24), metal); rim.rotation.y = Math.PI / 2; rim.position.x = sx * 2.15; head.add(rim);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.86, 20), dark); disc.rotation.y = sx * Math.PI / 2; disc.position.x = sx * 1.55; head.add(disc);
  });
  const wireM = new THREE.MeshBasicMaterial({ color: 0x050505 });
  [[0.25, 0.1], [-0.2, -0.05], [0.05, 0.2]].forEach((o, i) => {
    const pts = [new V3(o[0], 6.3, o[1]), new V3(o[0] + 0.3, 5.2, o[1] + 0.2), new V3(o[0] - 0.25, 4.3, o[1] + 0.1), new V3(o[0] + 0.1, 3.5 - i * 0.2, o[1] + 0.3)];
    upper.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.02, 4), wireM));
  });
  root.traverse(o => { o.frustumCulled = false; });
  return S;
}
const SH = buildMonster(); scene.add(SH.root);

const mon = { pos: new V3(-20, 0, 272), yaw: Math.PI, state: 'patrol', speed: 0, tx: -135, tz: 262, aware: 0, lost: 0, search: 0, last: new V3(), siren: 9, mimic: 55, stat: 20,
  phase: 0, lastHalf: 0, grace: 25, headYaw: 0, dist: 999, range: 0, heart: 0, cutSpeed: 0, rumbleT: 0 };
function resetMonster() {
  mon.pos.set(-20, 0, 272); mon.yaw = Math.PI; mon.state = 'patrol'; mon.speed = 0; mon.tx = -135; mon.tz = 262; mon.aware = 0; mon.lost = 0; mon.search = 0;
  mon.siren = 9; mon.mimic = 55; mon.stat = 20; mon.grace = 25; mon.phase = 0; mon.headYaw = 0; mon.dist = 999; mon.cutSpeed = 0;
  SH.upper.rotation.set(0, 0, 0); SH.head.rotation.set(0, 0, 0);
  applyMonsterPose(0, 0); curlHand(SH.armR, 0); curlHand(SH.armL, 0);
  SH.root.position.copy(mon.pos); SH.root.rotation.y = mon.yaw;
}
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function applyMonsterPose(phase, speed) {
  const amp = clamp(speed / 3.2, 0, 1) * 0.5, s = Math.sin(phase), c = Math.cos(phase);
  SH.legL.hip.rotation.x = -s * amp; SH.legR.hip.rotation.x = s * amp;
  SH.legL.knee.rotation.x = Math.max(0, c) * 0.8 * (amp / 0.5); SH.legR.knee.rotation.x = Math.max(0, -c) * 0.8 * (amp / 0.5);
  const sw = clamp(speed / 3.2, 0, 1);
  SH.armL.pivot.rotation.set(0.16 + s * 0.22 * sw, 0, 0.05); SH.armR.pivot.rotation.set(0.16 - s * 0.22 * sw, 0, -0.05);
  SH.armL.pivot.quaternion.setFromEuler(SH.armL.pivot.rotation); SH.armR.pivot.quaternion.setFromEuler(SH.armR.pivot.rotation);
  SH.armL.elbow.rotation.set(-0.5 - s * 0.15 * sw, 0, 0); SH.armR.elbow.rotation.set(-0.5 + s * 0.15 * sw, 0, 0);
  SH.armL.elbow.quaternion.setFromEuler(SH.armL.elbow.rotation); SH.armR.elbow.quaternion.setFromEuler(SH.armR.elbow.rotation);
  SH.root.position.y = Math.abs(s) * 0.12 * sw;
  SH.upper.rotation.z = s * 0.03 * sw;
}
function pickWaypoint() {
  let x, z;
  if (mon.grace > 0 || Math.random() < 0.4) { x = rand(-270, 270); z = rand(-270, 270); }
  else { const a = rand(0, TAU), r = rand(60, 150); x = clamp(player.pos.x + Math.cos(a) * r, -285, 285); z = clamp(player.pos.z + Math.sin(a) * r, -285, 285); }
  if (mon.grace > 0 && Math.hypot(x - player.pos.x, z - player.pos.z) < 150) { x = -x; z = -Math.abs(z) - 40; }
  mon.tx = x; mon.tz = z;
}
MonsterHook.noise = function (x, z, r) {
  if (mon.grace > 0 || mon.state === 'cutscene' || mon.state === 'dying' || mon.state === 'chase') return;
  if (Math.hypot(x - mon.pos.x, z - mon.pos.z) < r) { mon.state = 'investigate'; mon.last.set(x, 0, z); mon.aware = Math.max(mon.aware, 0.45); }
};
function monsterFootfall(side) {
  const near = clamp(1 - mon.dist / 95, 0, 1);
  SFX.footThud(0.6 + 0.7 * near);
  shake = Math.max(shake, near * near * 1.1);
  if (mon.dist < 80) input.rumble(near, near * 0.5, 240);
}

function updateMonster(dt) {
  const px = player.pos.x, pz = player.pos.z;
  const dx = px - mon.pos.x, dz = pz - mon.pos.z, dist = Math.hypot(dx, dz);
  mon.dist = dist;
  if (mon.grace > 0) mon.grace -= dt;
  // how far away can it perceive you right now?
  let range = player.flashOn ? 80 : 20;
  range *= player.sprinting ? 1.6 : (player.moving ? (player.crouch > 0.5 ? 0.55 : 1) : 0.55);
  if (player.indoors) range *= player.flashOn ? 0.45 : 0.5;
  mon.range = range;
  if (mon.grace <= 0) {
    if (dist < range) { mon.aware += dt * (0.4 + 2.0 * (1 - dist / range)); if (dist < 10) mon.aware = 1; }
    else mon.aware = Math.max(0, mon.aware - dt * 0.3);
    if (mon.aware >= 1 && mon.state !== 'chase') {
      mon.state = 'chase'; mon.lost = 0; mon.aware = 1; SFX.sirenCall(1.2); mon.siren = rand(6, 10); ui.flashDanger();
    } else if (mon.aware > 0.4 && (mon.state === 'patrol' || mon.state === 'search')) { mon.state = 'investigate'; mon.last.set(px, 0, pz); }
    if (mon.state === 'investigate' && dist < range) mon.last.set(px, 0, pz);
  }
  // state -> target & speed
  let spd = 0, tx = mon.tx, tz = mon.tz;
  switch (mon.state) {
    case 'patrol':
      spd = 2.8; if (Math.hypot(tx - mon.pos.x, tz - mon.pos.z) < 10) pickWaypoint(); tx = mon.tx; tz = mon.tz; break;
    case 'investigate':
      spd = 4.6; tx = mon.last.x; tz = mon.last.z;
      if (Math.hypot(tx - mon.pos.x, tz - mon.pos.z) < 8) { mon.state = 'search'; mon.search = rand(8, 13); mon.tx = tx; mon.tz = tz; }
      break;
    case 'chase': {
      spd = 6.3; tx = px; tz = pz;
      const hidden = player.indoors && dist > 16 && !player.flashOn;
      if (dist > range * 1.15 + 8 || hidden) mon.lost += dt; else mon.lost = Math.max(0, mon.lost - dt * 2);
      if (mon.lost > 4.5) { mon.state = 'search'; mon.search = rand(10, 15); mon.last.set(px, 0, pz); mon.tx = px; mon.tz = pz; mon.aware = 0.3; }
      break; }
    case 'search':
      spd = 2.2; mon.search -= dt;
      if (Math.hypot(mon.tx - mon.pos.x, mon.tz - mon.pos.z) < 6) { mon.tx = mon.last.x + rand(-28, 28); mon.tz = mon.last.z + rand(-28, 28); }
      tx = mon.tx; tz = mon.tz;
      if (mon.search <= 0) { mon.state = 'patrol'; mon.aware = 0; pickWaypoint(); }
      break;
  }
  // kill check
  if (mon.grace <= 0 && dist < 6.6 && !player.dead && gameState === 'playing') { Kill.start(); return; }
  // turn and walk
  const want = Math.atan2(tx - mon.pos.x, tz - mon.pos.z), diff = angDiff(mon.yaw, want);
  const turn = (mon.state === 'chase' ? 2.2 : 1.1) * dt;
  mon.yaw += clamp(diff, -turn, turn);
  const go = Math.abs(diff) < 1.0 ? 1 : 0.25;
  mon.speed += (spd * go - mon.speed) * (1 - Math.exp(-dt * 2));
  mon.pos.x += Math.sin(mon.yaw) * mon.speed * dt; mon.pos.z += Math.cos(mon.yaw) * mon.speed * dt;
  mon.pos.x = clamp(mon.pos.x, -310, 310); mon.pos.z = clamp(mon.pos.z, -310, 310);
  // animation + footfalls
  mon.phase += Math.PI * mon.speed / 6.2 * dt;
  const half = Math.floor(mon.phase / Math.PI);
  if (half !== mon.lastHalf && mon.speed > 0.6) monsterFootfall(half % 2); mon.lastHalf = half;
  applyMonsterPose(mon.phase, mon.speed);
  const wantHead = dist < 120 ? clamp(angDiff(mon.yaw, Math.atan2(dx, dz)), -1.1, 1.1) : 0;
  mon.headYaw += (wantHead - mon.headYaw) * (1 - Math.exp(-dt * 1.5));
  SH.head.rotation.y = mon.headYaw + Math.sin(performance.now() * 0.0009) * 0.12;
  SH.head.rotation.x = (mon.state === 'chase' ? 0.35 : 0.08) + Math.sin(performance.now() * 0.0006) * 0.05;
  SH.root.position.x = mon.pos.x; SH.root.position.z = mon.pos.z; SH.root.rotation.y = mon.yaw;
  // sound
  SFX.monsterPos(mon.pos.x, 12.5, mon.pos.z);
  mon.siren -= dt;
  if (mon.siren <= 0) { SFX.sirenCall(mon.state === 'chase' ? 1.2 : 1); mon.siren = mon.state === 'chase' ? rand(7, 12) : mon.state === 'patrol' ? rand(17, 32) : rand(9, 18); }
  mon.mimic -= dt; if (mon.mimic <= 0) { if (dist < 190) SFX.mimic(); mon.mimic = rand(35, 70); }
  mon.stat -= dt; if (mon.stat <= 0) { SFX.staticBurst(rand(0.4, 1.1), 0.4); mon.stat = rand(10, 24); }
  const prox = clamp(1 - dist / 95, 0, 1);
  SFX.setTension(mon.state === 'chase' ? Math.max(prox, 0.55) : prox * 0.55);
  if (mon.state === 'chase') { mon.heart -= dt; if (mon.heart <= 0) { SFX.heartbeat(0.3 + 0.5 * prox); mon.heart = 0.85 - 0.4 * prox; } }
  ui.setDanger(prox, mon.state === 'chase');
}

/* --- two-bone IK for the grab --- */
const _ikS = new V3(), _ikD = new V3(), _ikN = new V3(), _ikP = new V3(), _ikE = new V3(), _ikW = new V3(), _ikF = new V3(), _ikDown = new V3(0, -1, 0);
const _qU = new THREE.Quaternion(), _qF = new THREE.Quaternion(), _qP = new THREE.Quaternion(), _qL = new THREE.Quaternion(), _qM = new THREE.Quaternion();
function ikArm(A, target, pole, blend) {
  A.pivot.getWorldPosition(_ikS);
  _ikD.copy(target).sub(_ikS);
  const a = 3.6, b = 3.6;
  let dist = clamp(_ikD.length(), 0.4, a + b - 0.03);
  _ikN.copy(_ikD).normalize();
  const ang = Math.acos(clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1));
  _ikP.copy(pole).addScaledVector(_ikN, -pole.dot(_ikN));
  if (_ikP.lengthSq() < 1e-4) _ikP.set(0, 1, 0);
  _ikP.normalize();
  _ikE.copy(_ikN).multiplyScalar(Math.cos(ang)).addScaledVector(_ikP, Math.sin(ang)).normalize();   // upper-arm direction
  const dirU = _ikE.clone();
  _ikE.multiplyScalar(a).add(_ikS);                                                                  // elbow position
  _ikW.copy(_ikN).multiplyScalar(dist).add(_ikS);                                                    // wrist position
  _ikF.copy(_ikW).sub(_ikE).normalize();
  _qU.setFromUnitVectors(_ikDown, dirU);
  _qF.setFromUnitVectors(_ikDown, _ikF);
  A.pivot.parent.getWorldQuaternion(_qP);
  _qL.copy(_qP).invert().multiply(_qU);
  _qM.copy(_qU).invert().multiply(_qF);
  A.pivot.quaternion.slerp(_qL, blend);
  A.elbow.quaternion.slerp(_qM, blend);
}
function curlHand(A, k) {
  A.fingers.forEach((fg, i) => { fg.f.rotation.x = -k * (1.15 + i * 0.05); fg.j.rotation.x = -k * 1.35; });
}

/* --- the kill sequence --- */
const _tmpCam = new THREE.PerspectiveCamera();
const _hp = new V3(), _pp = new V3(), _tg = new V3(), _pole = new V3();
const Kill = {
  active: false, t: 0, eye: new V3(), p0: new V3(), stand: new V3(), y0: 0, yaw: 0, dir: new V3(),
  start() {
    if (Kill.active) return;
    Kill.active = true; Kill.t = 0; gameState = 'dying'; mon.state = 'dying'; player.dead = true;
    ui.enterCinematic();
    Kill.eye.copy(camera.position); Kill.p0.copy(mon.pos); Kill.y0 = mon.yaw;
    const dx = player.pos.x - mon.pos.x, dz = player.pos.z - mon.pos.z, d = Math.hypot(dx, dz) || 1;
    Kill.dir.set(dx / d, 0, dz / d); Kill.yaw = Math.atan2(dx, dz);
    Kill.stand.set(player.pos.x - dx / d * 4.4, 0, player.pos.z - dz / d * 4.4);
    SFX.screech(0.85); SFX.setTension(1); input.rumble(1, 1, 900);
    Kill.grabbed = false; Kill.crunched = false; Kill.hornSound = false;
    flashlight.intensity = 0;
  },
  update(dt) {
    const t = (Kill.t += dt);
    const bend = lerp(0, 1.15, smooth((t - 0.2) / 1.6)) - lerp(0, 0.7, smooth((t - 3.6) / 3.6));
    mon.speed = 0;
    // phase 0: step into place and turn
    const k0 = smooth(t / 1.4);
    mon.pos.lerpVectors(Kill.p0, Kill.stand, k0);
    mon.yaw = Kill.y0 + angDiff(Kill.y0, Kill.yaw) * k0;
    SH.root.position.set(mon.pos.x, 0, mon.pos.z); SH.root.rotation.y = mon.yaw;
    SH.upper.rotation.x = bend;
    SH.legL.hip.rotation.x = -0.5 * bend; SH.legR.hip.rotation.x = -0.5 * bend; SH.legL.knee.rotation.x = 0.8 * bend; SH.legR.knee.rotation.x = 0.8 * bend;
    SH.head.rotation.x = 0.5 + 0.3 * Math.sin(t * 5) * smooth((t - 6) / 1.5);
    const faceK = smooth((t - 5.4) / 1.6);
    SH.head.rotation.y = -Math.PI / 2 * faceK + (t > 6.8 ? Math.sin(t * 40) * 0.05 : 0);
    SH.root.position.y = 0;
    SH.root.updateMatrixWorld(true);
    // arm
    const reach = smooth((t - 1.1) / 1.6);
    if (t > 1.1) {
      let tgt;
      if (t < 3.4) tgt = _tg.copy(Kill.eye).add(_tmpV.set(0, -0.25, 0));
      else { const k = smooth((t - 3.5) / 3.6); SH.root.localToWorld(_tg.set(0, 9.1, 2.5)); _tg.lerpVectors(Kill.eye, _tg, k); }
      const sy = Math.sin(mon.yaw), cy = Math.cos(mon.yaw);
      _pole.set(-0.9 * sy + 0.6 * cy, 0.4, -0.9 * cy - 0.6 * sy);
      ikArm(SH.armR, _tg, _pole, t < 3.4 ? 0.08 + reach * 0.2 : 0.35);
      SH.root.updateMatrixWorld(true);
    }
    // left arm raised menacingly
    { const sy2 = Math.sin(mon.yaw), cy2 = Math.cos(mon.yaw);
      ikArm(SH.armL, _tg.set(mon.pos.x - cy2 * 2.6, 8.8 + 1.2 * Math.sin(t * 2), mon.pos.z + sy2 * 2.6), _pole.set(-0.9 * sy2 - 0.6 * cy2, 0.4, -0.9 * cy2 + 0.6 * sy2), 0.05); }
    curlHand(SH.armR, t < 3.0 ? 0.05 : smooth((t - 3.0) / 0.45));
    curlHand(SH.armL, 0.2 + 0.1 * Math.sin(t * 3));
    SH.root.updateMatrixWorld(true);
    if (t > 3.2 && !Kill.grabbed) { Kill.grabbed = true; SFX.thump(0.8); input.rumble(1, 0.8, 500); ui.redPulse(0.8); }
    // camera
    SH.head.getWorldPosition(_hp);
    if (t < 3.4) {
      camera.position.copy(Kill.eye);
      _tmpCam.position.copy(Kill.eye); _tmpCam.lookAt(t < 2.0 ? _hp : SH.armR.palm.getWorldPosition(_pp));
      camera.quaternion.slerp(_tmpCam.quaternion, 1 - Math.exp(-dt * 4));
    } else {
      SH.armR.palm.getWorldPosition(_pp);
      camera.position.copy(_pp).add(_tmpV.set(0, 0.12, 0));
      _tmpCam.position.copy(camera.position); _tmpCam.lookAt(_hp.set(_hp.x, _hp.y, _hp.z));
      camera.quaternion.slerp(_tmpCam.quaternion, 1 - Math.exp(-dt * 2.2));
    }
    const ss = t < 3 ? 0.35 : 0.55 + 0.45 * smooth((t - 5) / 3);
    camera.position.x += (Math.random() - 0.5) * ss * 0.08; camera.position.y += (Math.random() - 0.5) * ss * 0.08; camera.position.z += (Math.random() - 0.5) * ss * 0.08;
    camera.rotateZ((Math.random() - 0.5) * ss * 0.05);
    ui.setDanger(1, true);
    if (t > 6.1 && !Kill.hornSound) { Kill.hornSound = true; SFX.screech(1.0); input.rumble(1, 1, 1500); }
    if (t > 8.6 && !Kill.crunched) {
      Kill.crunched = true; SFX.crunch(); ui.smashToBlack();
      setTimeout(() => { Kill.active = false; ui.showOver(); }, 1700);
      gameState = 'over';
    }
  }
};

/* ------------------------------------------------------------------
   9. CUTSCENES
------------------------------------------------------------------ */
const TRUCK_ROUTE = [[11, 150], [8, 143], [0, 138], [-4, 130], [-14, 105], [-20, 70], [-6, 35], [0, 8], [12, 2], [30, 1.8], [340, 1.8]];
const TR_LEN = [0];
for (let i = 1; i < TRUCK_ROUTE.length; i++) TR_LEN.push(TR_LEN[i - 1] + Math.hypot(TRUCK_ROUTE[i][0] - TRUCK_ROUTE[i - 1][0], TRUCK_ROUTE[i][1] - TRUCK_ROUTE[i - 1][1]));
function routeAt(s, out) {
  s = clamp(s, 0, TR_LEN[TR_LEN.length - 1] - 0.01);
  let i = 1; while (i < TR_LEN.length - 1 && TR_LEN[i] < s) i++;
  const k = (s - TR_LEN[i - 1]) / (TR_LEN[i] - TR_LEN[i - 1]), a = TRUCK_ROUTE[i - 1], b = TRUCK_ROUTE[i];
  out.x = lerp(a[0], b[0], k); out.z = lerp(a[1], b[1], k); out.dx = b[0] - a[0]; out.dz = b[1] - a[1];
  return out;
}
const flareTex = (function () {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 1, 32, 32, 32); gr.addColorStop(0, 'rgba(255,248,220,1)'); gr.addColorStop(0.25, 'rgba(255,240,190,0.6)'); gr.addColorStop(1, 'rgba(255,230,160,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
const flares = [-0.7, 0.7].map(x => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
  s.position.set(x, 1.15, -2.9); s.scale.set(0.01, 0.01, 1); s.visible = false; truck.group.add(s); return s;
});

const Cut = {
  mode: null, t: 0, eng: null, pol: null, cars: [], ev: {}, s: 0, yaw: 0, cam: new V3(), tmp: { x: 0, z: 0, dx: 0, dz: 0 },
  begin(mode) {
    Cut.mode = mode; Cut.t = 0; Cut.ev = {}; gameState = 'cutscene';
    ui.enterCinematic(); player.flashOn = false; flashlight.intensity = 0; player.flashLevel = 0;
    mon.state = 'cutscene'; mon.speed = 0; mon.cutSpeed = 0; SFX.setTension(0.2); ui.setDanger(0, false);
    ui.fadeBlack(false, 0.1);
  },
  placeMonster(x, z, yaw) { mon.pos.set(x, 0, z); mon.yaw = yaw; SH.root.position.set(x, 0, z); SH.root.rotation.y = yaw; },
  once(k, fn) { if (!Cut.ev[k]) { Cut.ev[k] = true; fn(); } },

  /* ---------------- truck escape ---------------- */
  startTruck() {
    Cut.begin('truck');
    G.truck.started = true; Cut.s = 0; Cut.yaw = 0;
    truck.group.position.set(TRUCK_HOME.x, 0, TRUCK_HOME.z); truck.group.rotation.set(0, 0, 0);
    Cut.placeMonster(-37, 92, Math.PI / 2);
    ui.say('', 1);
  },
  updateTruck(dt) {
    const t = Cut.t, g = truck.group;
    if (t > 0.1) Cut.once('c1', () => SFX.crank());
    if (t > 1.2) Cut.once('c2', () => SFX.crank());
    if (t > 2.1) Cut.once('say1', () => ui.say('Come on, come on...', 2200));
    if (t > 2.4) Cut.once('c3', () => SFX.crank());
    if (t > 3.1) Cut.once('start', () => { Cut.eng = SFX.engine(); if (Cut.eng) Cut.eng.set(0.35, 0.26); ui.say('It turns over. The engine catches!', 2200); ui.redPulse(0); });
    if (t > 3.1) {
      const k = smooth((t - 3.1) / 0.8);
      truckLight.intensity = 7 * k; truck.group.userData.hl.color.setHex(0xfff4c8);
      flares.forEach(f => { f.visible = true; const sz = 0.4 + 3.2 * k * (1 + 0.1 * Math.sin(t * 30)); f.scale.set(sz, sz, 1); });
    }
    if (t > 4.0) Cut.once('rev', () => { if (Cut.eng) Cut.eng.set(0.9, 0.3); });
    if (t > 5.4) Cut.once('say2', () => ui.say('Go. Go. Go.', 1800));
    const driveT = t - 6.4;
    if (driveT > 0) {
      Cut.once('drive', () => { if (Cut.eng) Cut.eng.set(0.7, 0.34); SFX.sirenCall(1.4); });
      const v = Math.min(30, 3 + 5 * driveT);
      Cut.s += v * dt; if (Cut.eng) Cut.eng.set(0.45 + Math.min(0.5, driveT * 0.08), 0.34);
      routeAt(Cut.s, Cut.tmp);
      g.position.set(Cut.tmp.x, 0, Cut.tmp.z);
      const want = Math.atan2(-Cut.tmp.dx, -Cut.tmp.dz); Cut.yaw += angDiff(Cut.yaw, want) * (1 - Math.exp(-dt * 6)); g.rotation.y = Cut.yaw;
    }
    // camera
    const c = new V3(TRUCK_HOME.x, 1.1, TRUCK_HOME.z);
    if (driveT <= 0) {
      const a = -0.9 + (t / 6.4) * 2.4, r = 8.2 - 2.6 * smooth(t / 6.4), h = 2.4 - 0.8 * smooth(t / 6.4);
      camera.position.set(c.x + Math.sin(a) * r, h, c.z + Math.cos(a) * r);
      camera.lookAt(c.x, 1.0, c.z);
    } else {
      const dir = new V3(Math.sin(g.rotation.y) * -1, 0, Math.cos(g.rotation.y) * -1);
      const want = new V3(g.position.x - dir.x * 11, 3.8 + Math.min(1.5, driveT * 0.25), g.position.z - dir.z * 11);
      if (!Cut.camInit) { Cut.camInit = true; Cut.cam.copy(camera.position); }
      Cut.cam.lerp(want, 1 - Math.exp(-dt * 2.6)); camera.position.copy(Cut.cam);
      camera.lookAt(g.position.x + dir.x * 6, 1.5, g.position.z + dir.z * 6);
    }
    // the creature watches the truck go by
    SH.head.rotation.y = clamp(angDiff(mon.yaw, Math.atan2(g.position.x - mon.pos.x, g.position.z - mon.pos.z)), -1.4, 1.4);
    SH.head.rotation.x = 0.15; applyMonsterPose(0, 0);
    SH.root.position.set(mon.pos.x, 0, mon.pos.z);
    SFX.monsterPos(mon.pos.x, 12.5, mon.pos.z);
    if (t > 8.0 && !Cut.ev.monCall) { Cut.ev.monCall = true; SFX.sirenCall(1.5); }
    if (t > 14.6) Cut.once('fade', () => ui.fadeBlack(true, 1.8));
    if (t > 16.8) Cut.once('end', () => Cut.finish('You made it out', 'The truck tears onto the highway. Behind you, the horns wail one last time, then fade into the fog. You did not look back.'));
    flashlight.intensity = 0;
    truckLight.position.set(0, 1.2, -2.8);
  },

  /* ---------------- radio escape ---------------- */
  startRadio() {
    Cut.begin('radio'); G.radio.called = true; Cut.camInit = false;
    Cut.cars = []; Cut.pol = null;
    camera.position.set(0.5, 1.5, -221.4); camera.lookAt(0, 1.4, -224);
    Cut.placeMonster(48, -36, 0);
  },
  updateRadio(dt) {
    const t = Cut.t;
    if (t > 0.3) Cut.once('m1', () => SFX.morse());
    if (t > 0.8) Cut.once('s1', () => ui.say('Mayday, mayday. I am a survivor at the Route 9 radio tower. Please, anyone.', 4200));
    if (t > 4.6) Cut.once('st', () => SFX.staticBurst(1.2, 0.5, 0));
    if (t > 5.2) Cut.once('s2', () => ui.say('...survivor, this is County Dispatch. We read you. Units are rolling.', 3800));
    if (t > 9.0) Cut.once('s3', () => ui.say('Stay inside. Kill your lights. We are coming to you.', 3000));
    if (t < 11.0) {
      const k = t / 11; camera.position.set(0.5 - 0.3 * k, 1.5, -221.4 + 0.8 * k); camera.lookAt(0 + 0.2 * k, 1.4, -224);
      RadioCabin.led.forEach((l, i) => l.material.color.setHex(Math.sin(t * 8 + i * 2) > 0 ? 0x33ff66 : 0xff3322));
    }
    if (t > 10.4) Cut.once('fade1', () => ui.fadeBlack(true, 0.7));
    if (t > 11.3) {
      Cut.once('road', () => {
        ui.say('', 1);
        Cut.cars = [250, 270, 292].map((x, i) => { const c = makeCar(0x16191d, true); c.position.set(x, 0.02, 2.4); c.rotation.y = Math.PI / 2; scene.add(c); return { g: c, stop: [-9, 3, 15][i], x: x }; });
        Cut.pol = SFX.police();
        camera.position.set(-36, 2.2, 6.5); camera.lookAt(30, 2.0, 0.5);
        ui.fadeBlack(false, 1.2);
        SH.head.rotation.y = 0.5; Cut.placeMonster(44, -40, 0);
      });
      const td = t - 11.3;
      let lead = 999;
      Cut.cars.forEach(c => {
        const dx = c.x - c.stop, v = clamp(dx * 0.8, 0, 32); c.x -= v * dt; if (dx < 0.05) c.x = c.stop;
        c.g.position.x = c.x; lead = Math.min(lead, c.x);
      });
      const flip = Math.floor(td * 8) % 2 === 0, lc = Cut.cars[0];
      Cut.cars.forEach(c => { c.g.userData.red.material.color.setHex(flip ? 0xff1010 : 0x300000); c.g.userData.blue.material.color.setHex(flip ? 0x000030 : 0x2060ff); });
      if (lc) { policeLight.position.set(lc.x, 2.4, 2.4); policeLight.color.setHex(flip ? 0xff1818 : 0x2a5cff); policeLight.intensity = 9; }
      if (Cut.pol) Cut.pol.vol(clamp(0.05 + 0.3 * (1 - (lead + 40) / 330), 0.05, 0.4));
      camera.position.set(-36 + td * 0.12, 2.2, 6.5); camera.lookAt(30, 2.0 + Math.sin(td * 0.4) * 0.1, 0.5);
      SH.head.rotation.y = clamp(angDiff(mon.yaw, Math.atan2(lead - mon.pos.x, 2.4 - mon.pos.z)), -1.3, 1.3);
      SH.head.rotation.x = 0.2; applyMonsterPose(0, 0); SH.root.position.set(mon.pos.x, 0, mon.pos.z);
      SFX.monsterPos(mon.pos.x, 12.5, mon.pos.z);
      if (td > 6.2) Cut.once('say4', () => ui.say("Sheriff's department! Is anyone out there?", 3200));
      if (td > 7.0) Cut.once('monscreech', () => SFX.sirenCall(1.3));
      if (td > 9.5) {  // it turns and walks away into the fog
        const want = Math.PI; mon.yaw += clamp(angDiff(mon.yaw, want), -dt * 0.8, dt * 0.8);
        mon.speed += (2.6 - mon.speed) * (1 - Math.exp(-dt)); mon.pos.x += Math.sin(mon.yaw) * mon.speed * dt; mon.pos.z += Math.cos(mon.yaw) * mon.speed * dt;
        mon.phase += Math.PI * mon.speed / 6.2 * dt; applyMonsterPose(mon.phase, mon.speed); SH.root.position.set(mon.pos.x, 0, mon.pos.z); SH.root.rotation.y = mon.yaw;
      }
      if (td > 12.6) Cut.once('fade2', () => ui.fadeBlack(true, 1.8));
      if (td > 14.8) Cut.once('end', () => Cut.finish('Help arrived', 'Floodlights sweep the treeline. Somewhere behind them, something very tall turns away and disappears into the fog. You are going home.'));
    }
    flashlight.intensity = 0;
  },
  update(dt) {
    Cut.t += dt;
    if (Cut.mode === 'truck') Cut.updateTruck(dt); else if (Cut.mode === 'radio') Cut.updateRadio(dt);
  },
  finish(title, text) {
    Cut.mode = null; gameState = 'ended';
    if (Cut.eng) { Cut.eng.stop(); Cut.eng = null; }
    if (Cut.pol) { Cut.pol.stop(); Cut.pol = null; }
    ui.showEnd(title, text);
  },
  cleanup() {
    if (Cut.eng) { Cut.eng.stop(); Cut.eng = null; }
    if (Cut.pol) { Cut.pol.stop(); Cut.pol = null; }
    Cut.cars.forEach(c => scene.remove(c.g)); Cut.cars = [];
    flares.forEach(f => { f.visible = false; });
    truckLight.intensity = 0; policeLight.intensity = 0; Cut.camInit = false; Cut.mode = null;
    truck.group.userData.hl.color.setHex(0x3a3830);
  }
};

/* ------------------------------------------------------------------
   10. UI, MAP, INPUT
------------------------------------------------------------------ */
const staticCanvas = $('fx-static'); const sctx = staticCanvas.getContext('2d');
staticCanvas.width = 160; staticCanvas.height = 90;
const el = { hud: $('hud'), prompt: $('prompt'), promptKey: $('prompt-key'), promptText: $('prompt-text'), reticle: $('reticle'), toast: $('toast'), sub: $('subtitle'),
  obj: $('objective'), objText: $('objective-text'), stamina: $('stamina'), staminaFill: $('stamina-fill'), stRun: $('st-run'), stCrouch: $('st-crouch'), stLight: $('st-light'),
  fade: $('fade'), flash: $('flash'), red: $('redpulse'), touch: $('touch'), inv: $('inventory'), invGrid: $('inv-grid'), invRoutes: $('inv-routes'),
  mapO: $('map-overlay'), mapC: $('map-canvas'), note: $('note'), noteT: $('note-title'), noteB: $('note-body') };

const input = {
  moveX: 0, moveZ: 0, sprint: false, jump: false, crouchHeld: false, crouchToggle: false, device: 'kb',
  rumble: function (strong, weak, ms) {
    const now = performance.now(); if (now - (input._rt || 0) < 90) return; input._rt = now;
    const gp = getPad(); if (!gp) return;
    const a = gp.vibrationActuator;
    if (a && a.playEffect) { try { a.playEffect('dual-rumble', { startDelay: 0, duration: ms || 200, weakMagnitude: clamp(weak, 0, 1), strongMagnitude: clamp(strong, 0, 1) }).catch(function () {}); } catch (e) { /* ignore */ } }
  }
};
const src = { kbx: 0, kbz: 0, padx: 0, padz: 0, tx: 0, tz: 0, padSprint: false, touchRun: false };
const keys = {};
let padActive = false, mapOpen = false, invOpen = false, curScreen = 'screen-main', backTo = 'screen-main';
const ui = {
  danger: 0, chase: false, _redKick: 0, _toastT: 0, _subT: 0, _lastPrompt: null, _objT: 0, _staticT: 0, _toastTimer: null, _subTimer: null,
  showHud(on) { el.hud.classList.toggle('hidden', !on); ui.updateTouch(); },
  updateTouch() { el.touch.classList.toggle('hidden', !(isTouch && !padActive && gameState === 'playing' && !noteOpen)); },
  toast(msg, ms) {
    el.toast.textContent = msg; el.toast.classList.add('show');
    clearTimeout(ui._toastTimer); ui._toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, ms || 2600);
  },
  say(msg, ms) {
    clearTimeout(ui._subTimer);
    if (!msg) { el.sub.classList.remove('show'); return; }
    el.sub.textContent = msg; el.sub.classList.add('show');
    ui._subTimer = setTimeout(function () { el.sub.classList.remove('show'); }, ms || 3000);
  },
  keyLabel() { return input.device === 'pad' ? 'R2' : input.device === 'touch' ? 'USE' : 'E'; },
  setPrompt(label) {
    const key = label ? label + '|' + input.device : null;
    if (key === ui._lastPrompt) return; ui._lastPrompt = key;
    if (!label) { el.prompt.classList.add('hidden'); el.reticle.classList.remove('active'); return; }
    el.promptKey.textContent = ui.keyLabel(); el.promptText.textContent = label;
    el.prompt.classList.remove('hidden'); el.reticle.classList.add('active');
  },
  note(title, body) { el.noteT.textContent = title; el.noteB.textContent = body; el.note.classList.remove('hidden'); noteOpen = true; ui.updateTouch(); },
  closeNote() { el.note.classList.add('hidden'); noteOpen = false; ui.updateTouch(); },
  setDanger(p, chase) { ui.danger = p; ui.chase = chase; },
  flashDanger() { ui._redKick = 1; },
  redPulse(v) { ui._redKick = Math.max(ui._redKick, v); },
  fadeBlack(on, secs) { el.fade.style.transition = 'opacity ' + (secs === undefined ? 0.9 : secs) + 's ease'; el.fade.style.opacity = on ? 1 : 0; },
  smashToBlack() {
    el.flash.style.transition = 'none'; el.flash.style.opacity = 1;
    setTimeout(function () { el.flash.style.transition = 'opacity 0.15s'; el.flash.style.opacity = 0; el.fade.style.transition = 'none'; el.fade.style.opacity = 1; }, 70);
  },
  enterCinematic() { ui.showHud(false); ui.closePanels(); ui.setPrompt(null); ui.say('', 1); },
  closePanels() { mapOpen = false; invOpen = false; el.mapO.classList.add('hidden'); el.inv.classList.add('hidden'); ui.closeNote(); },
  showOver() { releaseLock(); showScreen('screen-over'); },
  showEnd(title, text) { releaseLock(); $('end-title').textContent = title; $('end-text').textContent = text; showScreen('screen-end'); },
  tick(dt) {
    el.staminaFill.style.width = player.stamina + '%';
    el.stamina.classList.toggle('show', player.stamina < 99);
    el.stamina.classList.toggle('low', player.exhausted);
    el.stRun.classList.toggle('on', player.sprinting);
    el.stCrouch.classList.toggle('on', player.crouch > 0.5);
    el.stLight.classList.toggle('on', player.flashOn);
    ui._objT -= dt; if (ui._objT <= 0) { ui._objT = 0.5; ui.refreshObjective(); }
    ui._redKick = Math.max(0, ui._redKick - dt * 0.8);
    const pulse = ui.chase ? (0.14 + 0.12 * Math.sin(performance.now() * 0.009)) * (0.4 + ui.danger) : 0;
    el.red.style.opacity = clamp(Math.max(pulse, ui._redKick * 0.6), 0, 0.9);
    // static grain when it is close
    const sOp = clamp(ui.danger * 0.75 - 0.12, 0, 0.55);
    staticCanvas.style.opacity = sOp;
    ui._staticT -= dt;
    if (sOp > 0.02 && ui._staticT <= 0) {
      ui._staticT = 0.06;
      const im = sctx.createImageData(160, 90), d = im.data;
      for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      sctx.putImageData(im, 0, 0);
    }
  },
  refreshObjective() { el.objText.textContent = nextObjective(); },
  refreshInv() { buildInventory(); ui.refreshObjective(); }
};

/* --- inventory + objectives --- */
function routeA() {
  return [
    { text: 'Find all 4 fuses (' + G.fusesFound + '/4)', done: G.fusesFound >= 4 },
    { text: 'Restore power at the gas station (breaker box out back)', done: G.powerOn },
    { text: 'Take the gas can from the station', done: G.inv.gas || G.truck.gas },
    { text: 'Take the car battery from the workshop storage room', done: G.inv.battery || G.truck.battery },
    { text: 'Pour the gas into the truck', done: G.truck.gas },
    { text: 'Install the car battery', done: G.truck.battery },
    { text: 'Start the truck', done: false }
  ];
}
function routeB() {
  return [
    { text: 'Find the radio cabin key (the door note says where)', done: G.inv.key || G.radio.unlocked },
    { text: 'Unlock the radio cabin at the tower', done: G.radio.unlocked },
    { text: 'Take the small battery from the workshop shelves', done: G.inv.simple || G.radio.battery },
    { text: 'Put the battery in the transmitter', done: G.radio.battery },
    { text: 'Send the distress call', done: G.radio.called }
  ];
}
function nextObjective() {
  if (!G.inv.map) return (!dormSwitch.on && player.pos.y > 2.5) ? 'It is dark. Find the light switch by the window wall, then take the map from the desk.' : 'Take the paper map from the desk.';
  const A = routeA(), Bq = routeB();
  const pa = A.filter(s => s.done).length, pb = Bq.filter(s => s.done).length;
  const next = (pa >= pb ? A : Bq).find(s => !s.done);
  return next ? next.text : 'Get out of the forest.';
}
function buildInventory() {
  const I = G.inv;
  const slots = [
    { ico: '\uD83D\uDDFA\uFE0F', name: 'Paper map', have: I.map },
    { ico: '\uD83D\uDDDD\uFE0F', name: 'Radio key', have: I.key || G.radio.unlocked, used: G.radio.unlocked, sub: G.radio.unlocked ? 'used' : '' },
    { ico: '\uD83D\uDD0C', name: 'Fuses [' + G.fusesFound + '/4]', have: G.fusesFound > 0, used: G.fusesInstalled >= 4, sub: G.fusesFound ? G.fusesInstalled + ' installed' : '' },
    { ico: '\u26FD', name: 'Gas can', have: I.gas || G.truck.gas, used: G.truck.gas, sub: G.truck.gas ? 'in the truck' : '' },
    { ico: '\uD83D\uDD0B', name: 'Car battery', have: I.battery || G.truck.battery, used: G.truck.battery, sub: G.truck.battery ? 'installed' : '' },
    { ico: '\u26A1', name: 'Simple battery', have: I.simple || G.radio.battery, used: G.radio.battery, sub: G.radio.battery ? 'in the radio' : '' }
  ];
  el.invGrid.innerHTML = slots.map(s => '<div class="inv-slot' + (s.have ? ' have' : '') + (s.used ? ' used' : '') + '"><span class="ico">' + s.ico + '</span><span>' + s.name + '</span><small>' + (s.sub || '') + '</small></div>').join('');
  const list = (title, arr) => '<div class="route"><b>' + title + '</b><ul>' + arr.map(s => '<li class="' + (s.done ? 'done' : '') + '">' + s.text + '</li>').join('') + '</ul></div>';
  el.invRoutes.innerHTML = list('Route A: fix the truck', routeA()) + list('Route B: call for help from the radio tower', routeB());
}

/* --- paper map (drawn by hand, in code) --- */
const MAPN = 900, MAPM = 70, MAPS = (MAPN - 2 * MAPM) / 600;
const mxy = (x, z) => [MAPM + (x + 300) * MAPS, MAPM + (z + 300) * MAPS];
let mapBase = null;
const HAND = '"Reenie Beanie", "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
function drawMapBase() {
  const c = document.createElement('canvas'); c.width = c.height = MAPN; const g = c.getContext('2d'); const r = mulberry32(4242);
  g.fillStyle = '#cdbb8e'; g.fillRect(0, 0, MAPN, MAPN);
  for (let i = 0; i < 140; i++) { g.fillStyle = 'rgba(' + (110 + r() * 60) + ',' + (80 + r() * 40) + ',' + (30 + r() * 30) + ',' + (r() * 0.06) + ')'; g.beginPath(); g.arc(r() * MAPN, r() * MAPN, 14 + r() * 80, 0, TAU); g.fill(); }
  for (let i = 0; i < 7000; i++) { g.fillStyle = 'rgba(60,40,20,' + (r() * 0.09) + ')'; g.fillRect(r() * MAPN, r() * MAPN, 1, 1 + r() * 3); }
  const ink = '#2a2016', wob = (x0, y0, x1, y1, j, w) => {
    g.strokeStyle = ink; g.lineWidth = w || 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0);
    const n = Math.max(2, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 14));
    for (let i = 1; i <= n; i++) g.lineTo(lerp(x0, x1, i / n) + (r() - 0.5) * j, lerp(y0, y1, i / n) + (r() - 0.5) * j);
    g.stroke();
  };
  const txt = (s, x, y, size, rot, align) => { g.save(); g.translate(x, y); g.rotate(rot || (r() - 0.5) * 0.04); g.font = (size || 30) + 'px ' + HAND; g.fillStyle = ink; g.textAlign = align || 'center'; g.fillText(s, 0, 0); g.restore(); };
  // trees (little ticks)
  for (let i = 0; i < 380; i++) {
    const x = -290 + r() * 580, z = -290 + r() * 580;
    if (Math.abs(z) < 14 || distToPaths(x, z) < 12 || CLEAR.some(cc => (x - cc.x) ** 2 + (z - cc.z) ** 2 < (cc.r + 4) ** 2) || (x > 180 && x < 214)) continue;
    const p = mxy(x, z); g.strokeStyle = 'rgba(42,32,22,0.7)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(p[0], p[1] + 5); g.lineTo(p[0], p[1] - 4); g.moveTo(p[0] - 4, p[1]); g.lineTo(p[0], p[1] - 8); g.lineTo(p[0] + 4, p[1]); g.stroke();
  }
  // border
  wob(MAPM - 24, MAPM - 24, MAPN - MAPM + 24, MAPM - 24, 3, 2.5); wob(MAPN - MAPM + 24, MAPM - 24, MAPN - MAPM + 24, MAPN - MAPM + 24, 3, 2.5);
  wob(MAPN - MAPM + 24, MAPN - MAPM + 24, MAPM - 24, MAPN - MAPM + 24, 3, 2.5); wob(MAPM - 24, MAPN - MAPM + 24, MAPM - 24, MAPM - 24, 3, 2.5);
  // highway
  let a = mxy(-300, -5), b = mxy(300, -5); wob(a[0], a[1], b[0], b[1], 2.5, 2.4);
  a = mxy(-300, 5); b = mxy(300, 5); wob(a[0], a[1], b[0], b[1], 2.5, 2.4);
  a = mxy(-300, 0); b = mxy(300, 0); g.setLineDash([14, 12]); wob(a[0], a[1], b[0], b[1], 1.5, 1.2); g.setLineDash([]);
  txt('ROUTE 9', mxy(-215, 0)[0], mxy(0, -9)[1], 30, 0.0);
  // tracks
  g.setLineDash([9, 7]);
  PATHS.forEach(P => { for (let i = 0; i < P.pts.length - 1; i++) { const p0 = mxy(P.pts[i][0], P.pts[i][1]), p1 = mxy(P.pts[i + 1][0], P.pts[i + 1][1]); wob(p0[0], p0[1], p1[0], p1[1], 3, 2); } });
  g.setLineDash([]);
  // river
  [190, 204].forEach(x => { const p0 = mxy(x, -300), p1 = mxy(x, 300); let px = p0[0], py = p0[1]; g.strokeStyle = '#2a2016'; g.lineWidth = 2; g.beginPath(); g.moveTo(px, py);
    for (let y = p0[1]; y < p1[1]; y += 18) { g.lineTo(p0[0] + Math.sin(y * 0.03 + x) * 6 + (r() - 0.5) * 2, y); } g.stroke(); });
  for (let y = MAPM + 20; y < MAPN - MAPM; y += 46) { const x = mxy(197, 0)[0]; g.strokeStyle = 'rgba(42,32,22,0.6)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - 8, y); g.quadraticCurveTo(x - 3, y - 5, x, y); g.quadraticCurveTo(x + 3, y + 5, x + 8, y); g.stroke(); }
  g.save(); g.translate(mxy(197, 0)[0] + 24, mxy(0, -200)[1]); g.rotate(Math.PI / 2); g.font = '28px ' + HAND; g.fillStyle = ink; g.textAlign = 'center'; g.fillText('RIVER', 0, 0); g.restore();
  // landmarks
  const icon = {
    house(x, y) { wob(x - 13, y + 8, x + 13, y + 8, 2, 2.5); wob(x - 13, y + 8, x - 13, y - 4, 2, 2.5); wob(x + 13, y + 8, x + 13, y - 4, 2, 2.5); wob(x - 16, y - 4, x, y - 16, 2, 2.5); wob(x, y - 16, x + 16, y - 4, 2, 2.5); wob(x - 3, y + 8, x - 3, y + 1, 1, 2); wob(x + 3, y + 8, x + 3, y + 1, 1, 2); },
    pump(x, y) { g.strokeStyle = ink; g.lineWidth = 2.5; g.strokeRect(x - 7, y - 12, 14, 22); g.strokeRect(x - 4, y - 8, 8, 7); wob(x + 7, y - 6, x + 14, y + 2, 1, 2); wob(x - 12, y + 10, x + 12, y + 10, 1, 2.5); },
    gear(x, y) { g.strokeStyle = ink; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.stroke(); for (let i = 0; i < 8; i++) { const an = i * TAU / 8; wob(x + Math.cos(an) * 9, y + Math.sin(an) * 9, x + Math.cos(an) * 15, y + Math.sin(an) * 15, 1, 3); } },
    store(x, y) { g.strokeStyle = ink; g.lineWidth = 2.5; g.strokeRect(x - 15, y - 8, 30, 18); wob(x - 17, y - 8, x + 17, y - 8, 1, 3); wob(x - 17, y - 14, x + 17, y - 14, 1, 3); txt('?', x, y + 7, 22); },
    cabin(x, y) { wob(x - 12, y + 8, x + 12, y + 8, 1, 2.5); wob(x - 12, y + 8, x - 12, y - 3, 1, 2.5); wob(x + 12, y + 8, x + 12, y - 3, 1, 2.5); wob(x - 15, y - 3, x + 15, y - 3, 1, 2.5); wob(x - 15, y - 3, x, y - 12, 1, 2); wob(x, y - 12, x + 15, y - 3, 1, 2); },
    tower(x, y) { wob(x - 10, y + 14, x, y - 22, 1.5, 2.5); wob(x + 10, y + 14, x, y - 22, 1.5, 2.5); wob(x - 7, y + 3, x + 7, y + 3, 1, 2); wob(x - 4, y - 8, x + 4, y - 8, 1, 2); for (let k = 1; k <= 2; k++) { g.beginPath(); g.arc(x, y - 22, 7 * k, -2.4, -0.7); g.stroke(); } },
    bridge(x, y) { wob(x - 20, y - 5, x + 20, y - 5, 1, 2); wob(x - 20, y + 5, x + 20, y + 5, 1, 2); for (let k = -16; k <= 16; k += 8) wob(x + k, y - 5, x + k, y + 5, 1, 1.5); }
  };
  const marks = [
    ['house', 0, 160, 'FARMHOUSE', 'you start here', 0, 40], ['pump', 76, -18, 'GAS STATION', 'breaker box out back', 0, 46], ['gear', 140, 25, "KESSLER'S SHOP", 'batteries inside', 0, 40],
    ['store', -85, -24, 'GENERAL STORE', 'abandoned', 0, 40], ['cabin', -175, 130, 'OLD CABIN', '', 0, 36], ['cabin', 170, 160, 'RIVER HOUSE', '', -30, 36], ['tower', 0, -222, 'RADIO TOWER', 'locked cabin', 0, 40], ['bridge', 197, 150, 'BRIDGE', '', 0, 24]
  ];
  marks.forEach(m => { const p = mxy(m[1], m[2]); icon[m[0]](p[0], p[1]); txt(m[3], p[0] + m[5], p[1] + m[6], 30); if (m[4]) txt('(' + m[4] + ')', p[0] + m[5], p[1] + m[6] + 24, 22); });
  [[-36, -258], [36, -258], [-36, -186], [36, -186]].forEach(q => { const p = mxy(q[0], q[1] + 0); wob(p[0] - 5, p[1] + 6, p[0], p[1] - 8, 1, 2); wob(p[0] + 5, p[1] + 6, p[0], p[1] - 8, 1, 2); });
  // scribbles
  const bp = mxy(76, -28); g.strokeStyle = '#7a1d12'; g.lineWidth = 3; g.beginPath(); g.moveTo(bp[0] - 6, bp[1] - 14); g.lineTo(bp[0] + 6, bp[1] - 2); g.moveTo(bp[0] + 6, bp[1] - 14); g.lineTo(bp[0] - 6, bp[1] - 2); g.stroke();
  g.fillStyle = '#7a1d12'; g.font = '24px ' + HAND; g.textAlign = 'center'; g.fillText('fuses!', bp[0] + 2, bp[1] - 22);
  txt('light = it sees you', mxy(-215, 255)[0], mxy(0, 255)[1], 28, -0.05); txt('never run in the open', mxy(-215, 255)[0], mxy(0, 255)[1] + 26, 24, -0.05);
  txt('it can mimic voices', mxy(215, -250)[0], mxy(0, -250)[1], 26, 0.04);
  txt('Hollow Pine Forest', 262, 52, 46, -0.02); txt('survey copy, hand-drawn', 262, 78, 24, -0.02);
  // compass
  const cp = [MAPN - 120, MAPN - 120]; g.strokeStyle = ink; g.lineWidth = 2.5; g.beginPath(); g.arc(cp[0], cp[1], 30, 0, TAU); g.stroke();
  wob(cp[0], cp[1] + 34, cp[0], cp[1] - 42, 1, 2.5); wob(cp[0] - 34, cp[1], cp[0] + 34, cp[1], 1, 1.5); wob(cp[0], cp[1] - 42, cp[0] - 7, cp[1] - 28, 1, 2.5); wob(cp[0], cp[1] - 42, cp[0] + 7, cp[1] - 28, 1, 2.5);
  txt('N', cp[0], cp[1] - 52, 30);
  // folds + aged edges
  g.strokeStyle = 'rgba(60,40,20,0.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(MAPN / 2, 0); g.lineTo(MAPN / 2 + 3, MAPN); g.moveTo(0, MAPN / 2); g.lineTo(MAPN, MAPN / 2 - 3); g.stroke();
  g.strokeStyle = 'rgba(255,245,220,0.2)'; g.lineWidth = 1; g.beginPath(); g.moveTo(MAPN / 2 + 2, 0); g.lineTo(MAPN / 2 + 5, MAPN); g.moveTo(0, MAPN / 2 + 2); g.lineTo(MAPN, MAPN / 2 - 1); g.stroke();
  const vg = g.createRadialGradient(MAPN / 2, MAPN / 2, MAPN * 0.35, MAPN / 2, MAPN / 2, MAPN * 0.72); vg.addColorStop(0, 'rgba(60,35,10,0)'); vg.addColorStop(1, 'rgba(60,35,10,0.6)');
  g.fillStyle = vg; g.fillRect(0, 0, MAPN, MAPN);
  return c;
}
function drawMapFrame() {
  if (!mapBase) mapBase = drawMapBase();
  const g = el.mapC.getContext('2d'); g.drawImage(mapBase, 0, 0);
  const p = mxy(player.pos.x, player.pos.z), dx = -Math.sin(player.yaw), dy = -Math.cos(player.yaw);
  g.save(); g.translate(p[0], p[1]); g.strokeStyle = '#8a1a10'; g.fillStyle = '#8a1a10'; g.lineWidth = 3;
  g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, 2.5, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(dx * 22, dy * 22); g.lineTo(dx * 12 - dy * 7, dy * 12 + dx * 7); g.lineTo(dx * 12 + dy * 7, dy * 12 - dx * 7); g.closePath(); g.fill();
  g.font = '28px ' + HAND; g.textAlign = 'center'; g.fillText('you', 0, 30); g.restore();
}
function toggleMap() {
  if (gameState !== 'playing') return;
  if (!G.inv.map) { ui.toast('You do not have a map yet. Check the desk upstairs.', 2400); return; }
  mapOpen = !mapOpen; if (mapOpen) { invOpen = false; el.inv.classList.add('hidden'); drawMapFrame(); }
  el.mapO.classList.toggle('hidden', !mapOpen); SFX.click(0.2);
}
function toggleInventory() {
  if (gameState !== 'playing') return;
  invOpen = !invOpen; if (invOpen) { mapOpen = false; el.mapO.classList.add('hidden'); buildInventory(); }
  el.inv.classList.toggle('hidden', !invOpen); SFX.click(0.2);
}
const panelOpen = () => mapOpen || invOpen || noteOpen;

/* --- screens & menus --- */
const SCREENS = ['screen-main', 'screen-settings', 'screen-controls', 'screen-pause', 'screen-over', 'screen-end'];
const padNav = { idx: 0, layer: null, rep: 0, dir: 0 };
function showScreen(id) { SCREENS.forEach(s => $(s).classList.toggle('hidden', s !== id)); curScreen = id; padNav.idx = 0; padNav.layer = null; }
function hideScreens() { SCREENS.forEach(s => $(s).classList.add('hidden')); curScreen = null; }
function releaseLock() { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); }
function requestLock() { if (isTouch || padActive) return; try { const p = canvas.requestPointerLock && canvas.requestPointerLock(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ } }
function toggleFullscreen(btn) {
  const d = document, de = d.documentElement;
  const isFs = d.fullscreenElement || d.webkitFullscreenElement;
  try {
    if (!isFs) {
      const f = de.requestFullscreen || de.webkitRequestFullscreen;
      if (!f) throw new Error('none');
      const r = f.call(de); if (r && r.catch) r.catch(function () { flashBtn(btn, 'Fullscreen unavailable'); });
    } else { (d.exitFullscreen || d.webkitExitFullscreen).call(d); }
  } catch (e) { flashBtn(btn, 'Fullscreen unavailable'); }
}
function flashBtn(btn, msg) { if (!btn) return; const o = btn.textContent; btn.textContent = msg; setTimeout(function () { btn.textContent = o; }, 1600); }

function syncSettingsUI() {
  $('set-sens').value = settings.sens; $('set-sens-val').textContent = settings.sens.toFixed(1) + 'x';
  $('pause-sens').value = settings.sens; $('pause-sens-val').textContent = settings.sens.toFixed(1) + 'x';
  [['master', 'set-master'], ['sfx', 'set-sfx'], ['amb', 'set-amb']].forEach(function (k) { $(k[1]).value = Math.round(settings[k[0]] * 100); $(k[1] + '-val').textContent = Math.round(settings[k[0]] * 100) + '%'; });
  $('set-quality').value = settings.quality;
}
function bindSettings() {
  const sens = function (v) { settings.sens = v; $('set-sens').value = v; $('pause-sens').value = v; $('set-sens-val').textContent = v.toFixed(1) + 'x'; $('pause-sens-val').textContent = v.toFixed(1) + 'x'; saveSettings(); };
  $('set-sens').addEventListener('input', function (e) { sens(parseFloat(e.target.value)); });
  $('pause-sens').addEventListener('input', function (e) { sens(parseFloat(e.target.value)); });
  [['master', 'set-master'], ['sfx', 'set-sfx'], ['amb', 'set-amb']].forEach(function (k) {
    $(k[1]).addEventListener('input', function (e) { const v = parseFloat(e.target.value); settings[k[0]] = v / 100; $(k[1] + '-val').textContent = Math.round(v) + '%'; saveSettings(); SFX.applySettings(); });
  });
  $('set-quality').addEventListener('change', function (e) {
    settings.quality = e.target.value; saveSettings(); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, currentQuality().pr)); renderer.setSize(window.innerWidth, window.innerHeight);
  });
  const hint = document.createElement('p'); hint.className = 'hint'; hint.style.gridColumn = '1 / -1'; hint.style.margin = '0';
  hint.textContent = 'Resolution applies now. Tree density updates the next time the page loads.'; $('set-quality').parentNode.appendChild(hint);
}

function fullReset() {
  Cut.cleanup(); SFX.stopLoops();
  resetState(); resetFns.forEach(function (f) { f(); });
  resetPlayer(); resetMonster(); Kill.active = false;
  input.crouchToggle = false; src.touchRun = false; $('tb-run').classList.remove('on'); $('tb-crouch').classList.remove('on');
  ui.closePanels(); ui.setDanger(0, false); ui._redKick = 0; el.red.style.opacity = 0; staticCanvas.style.opacity = 0; ui.say('', 1);
  buildInventory(); refreshForest(SPAWN.x, SPAWN.z, true);
  flashlight.intensity = 0; truckLight.intensity = 0; policeLight.intensity = 0;
  el.flash.style.opacity = 0;
}
function startGame() {
  SFX.init(); SFX.resume(); SFX.applySettings();
  fullReset(); SFX.setIndoor(true); SFX.setTension(0);
  hideScreens(); gameState = 'playing'; ui.showHud(true); ui.refreshObjective();
  el.fade.style.transition = 'none'; el.fade.style.opacity = 1; void el.fade.offsetWidth; ui.fadeBlack(false, 2.6);
  requestLock();
  setTimeout(function () { if (gameState === 'playing') ui.say('You wake up in the dark. Outside, something is wailing.', 4200); }, 1500);
}
function pauseGame() {
  if (gameState !== 'playing') return;
  gameState = 'paused'; ui.closePanels(); ui.setPrompt(null); releaseLock(); SFX.suspend(); showScreen('screen-pause'); ui.updateTouch();
}
function resumeGame() {
  if (gameState !== 'paused') return;
  hideScreens(); gameState = 'playing'; SFX.resume(); requestLock(); ui.updateTouch(); last = performance.now();
}
function quitToMenu() {
  gameState = 'menu'; releaseLock(); fullReset(); SFX.setTension(0); SFX.suspend();
  ui.showHud(false); el.touch.classList.add('hidden'); el.fade.style.transition = 'none'; el.fade.style.opacity = 1; showScreen('screen-main');
}

function bindMenus() {
  $('btn-play').addEventListener('click', startGame);
  $('btn-full').addEventListener('click', function (e) { toggleFullscreen(e.currentTarget); });
  $('btn-pause-full').addEventListener('click', function (e) { toggleFullscreen(e.currentTarget); });
  $('btn-settings').addEventListener('click', function () { backTo = 'screen-main'; syncSettingsUI(); showScreen('screen-settings'); });
  $('btn-controls').addEventListener('click', function () { backTo = 'screen-main'; showScreen('screen-controls'); });
  $('btn-settings-back').addEventListener('click', function () { showScreen(backTo); });
  $('btn-controls-back').addEventListener('click', function () { showScreen(backTo); });
  $('btn-resume').addEventListener('click', resumeGame);
  $('btn-pause-settings').addEventListener('click', function () { backTo = 'screen-pause'; syncSettingsUI(); showScreen('screen-settings'); });
  $('btn-pause-controls').addEventListener('click', function () { backTo = 'screen-pause'; showScreen('screen-controls'); });
  $('btn-quit').addEventListener('click', quitToMenu);
  $('btn-retry').addEventListener('click', startGame);
  $('btn-over-menu').addEventListener('click', quitToMenu);
  $('btn-again').addEventListener('click', startGame);
  $('btn-end-menu').addEventListener('click', quitToMenu);
  $('btn-inv-close').addEventListener('click', function () { if (invOpen) toggleInventory(); });
  $('btn-map-close').addEventListener('click', function () { if (mapOpen) toggleMap(); });
  $('btn-note-close').addEventListener('click', function () { ui.closeNote(); });
  $('note').addEventListener('click', function (e) { if (e.target === $('note')) ui.closeNote(); });
}

/* --- keyboard / mouse --- */
function setDevice(d) { if (input.device !== d) { input.device = d; ui._lastPrompt = null; } }
window.addEventListener('keydown', function (e) {
  if (e.repeat && e.code !== 'ArrowUp') { if (gameState === 'playing') e.preventDefault(); return; }
  keys[e.code] = true; setDevice('kb');
  if (gameState === 'playing') {
    switch (e.code) {
      case 'Escape': if (noteOpen) ui.closeNote(); else if (mapOpen) toggleMap(); else if (invOpen) toggleInventory(); else pauseGame(); break;
      case 'KeyF': if (!panelOpen()) toggleFlash(); break;
      case 'KeyE': doInteract(); break;
      case 'KeyM': if (noteOpen) ui.closeNote(); else toggleMap(); break;
      case 'KeyI': case 'Tab': if (noteOpen) ui.closeNote(); else toggleInventory(); break;
      case 'Space': if (!panelOpen()) input.jump = true; break;
      default: break;
    }
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ControlLeft'].indexOf(e.code) >= 0) e.preventDefault();
  } else if (gameState === 'paused' && e.code === 'Escape') {
    if (curScreen === 'screen-pause') resumeGame(); else if (curScreen === 'screen-settings' || curScreen === 'screen-controls') showScreen(backTo);
  } else if (gameState === 'menu' && e.code === 'Escape' && (curScreen === 'screen-settings' || curScreen === 'screen-controls')) showScreen(backTo);
});
window.addEventListener('keyup', function (e) { keys[e.code] = false; });
window.addEventListener('blur', function () { for (const k in keys) keys[k] = false; if (gameState === 'playing') pauseGame(); });
document.addEventListener('visibilitychange', function () { if (document.hidden && gameState === 'playing') pauseGame(); });
document.addEventListener('mousemove', function (e) {
  if (document.pointerLockElement !== canvas || gameState !== 'playing' || panelOpen()) return;
  setDevice('kb');
  player.yaw -= e.movementX * 0.0022 * settings.sens; player.pitch = clamp(player.pitch - e.movementY * 0.0022 * settings.sens, -1.5, 1.5);
});
document.addEventListener('mousedown', function (e) {
  if (e.button !== 0 || gameState !== 'playing' || isTouch) return;
  if (e.target.closest && e.target.closest('button, .panel, #note, #map-overlay')) return;
  if (document.pointerLockElement !== canvas) { requestLock(); return; }
  doInteract();
});
document.addEventListener('pointerlockchange', function () {
  if (document.pointerLockElement === canvas) return;
  if (gameState === 'playing') { if (panelOpen()) ui.closePanels(); else pauseGame(); }
});
canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

/* --- touch --- */
(function bindTouch() {
  const joy = $('joy'), knob = $('joy-knob');
  let joyId = null, jc = { x: 0, y: 0 }, lookId = null, ll = { x: 0, y: 0 };
  const R = 56;
  const moveJoy = function (t) {
    let dx = t.clientX - jc.x, dy = t.clientY - jc.y; const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; src.tx = dx / R; src.tz = -dy / R;
  };
  joy.addEventListener('touchstart', function (e) {
    e.preventDefault(); setDevice('touch'); const t = e.changedTouches[0]; joyId = t.identifier;
    const r = joy.getBoundingClientRect(); jc.x = r.left + r.width / 2; jc.y = r.top + r.height / 2; moveJoy(t);
  }, { passive: false });
  document.addEventListener('touchstart', function (e) {
    if (gameState !== 'playing' || panelOpen()) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (e.target.closest && e.target.closest('#joy, .tbtn, #touch-top, .panel, #note')) continue;
      if (lookId === null) { lookId = t.identifier; ll.x = t.clientX; ll.y = t.clientY; setDevice('touch'); }
    }
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joyId) { e.preventDefault(); moveJoy(t); }
      else if (t.identifier === lookId && gameState === 'playing' && !panelOpen()) {
        e.preventDefault();
        player.yaw -= (t.clientX - ll.x) * 0.0052 * settings.sens; player.pitch = clamp(player.pitch - (t.clientY - ll.y) * 0.0046 * settings.sens, -1.5, 1.5);
        ll.x = t.clientX; ll.y = t.clientY;
      }
    }
  }, { passive: false });
  const end = function (e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joyId) { joyId = null; src.tx = 0; src.tz = 0; knob.style.transform = 'translate(0,0)'; }
      if (t.identifier === lookId) lookId = null;
    }
  };
  document.addEventListener('touchend', end); document.addEventListener('touchcancel', end);
  document.querySelectorAll('.tbtn').forEach(function (b) {
    b.addEventListener('touchstart', function (e) {
      e.preventDefault(); e.stopPropagation(); setDevice('touch');
      const a = b.getAttribute('data-act');
      if (a === 'jump') { if (!panelOpen()) input.jump = true; }
      else if (a === 'crouch') { input.crouchToggle = !input.crouchToggle; b.classList.toggle('on', input.crouchToggle); }
      else if (a === 'run') { src.touchRun = !src.touchRun; b.classList.toggle('on', src.touchRun); }
      else if (a === 'flash') { if (!panelOpen()) toggleFlash(); }
      else if (a === 'use') doInteract();
      else if (a === 'map') toggleMap();
      else if (a === 'inv') toggleInventory();
      else if (a === 'pause') pauseGame();
    }, { passive: false });
  });
})();

/* --- gamepad (PS4 DualShock via the standard mapping) --- */
function getPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) return pads[i];
  return null;
}
window.addEventListener('gamepadconnected', function () { padActive = true; setDevice('pad'); ui.updateTouch(); });
window.addEventListener('gamepaddisconnected', function () { padActive = !!getPad(); if (!padActive) setDevice(isTouch ? 'touch' : 'kb'); ui.updateTouch(); });
const padPrev = {};
function dz(v) { return Math.abs(v) < 0.17 ? 0 : (v - Math.sign(v) * 0.17) / 0.83; }
function activeLayer() {
  if (noteOpen) return el.note; if (mapOpen) return el.mapO; if (invOpen) return el.inv;
  return curScreen ? $(curScreen) : null;
}
function padMenu(gp, dt, edge, ly, lx) {
  const layer = activeLayer(); if (!layer) return;
  const items = Array.prototype.slice.call(layer.querySelectorAll('button, input[type=range], select')).filter(function (n) { return n.offsetParent !== null; });
  if (!items.length) return;
  if (padNav.layer !== layer) { padNav.layer = layer; padNav.idx = 0; }
  items.forEach(function (n) { n.classList.remove('pad-focus'); if (n.parentNode && n.parentNode.classList) n.parentNode.classList.remove('pad-focus'); });
  let mv = 0;
  if (edge(12) || ly < -0.6 && padNav.dir !== -1) mv = -1; else if (edge(13) || ly > 0.6 && padNav.dir !== 1) mv = 1;
  padNav.dir = ly < -0.6 ? -1 : ly > 0.6 ? 1 : 0;
  if (mv) { padNav.idx = (padNav.idx + mv + items.length) % items.length; SFX.click(0.12); }
  const cur = items[clamp(padNav.idx, 0, items.length - 1)];
  cur.classList.add('pad-focus'); if (cur.type === 'range' && cur.parentNode.classList) cur.parentNode.classList.add('pad-focus');
  const side = (edge(15) ? 1 : 0) - (edge(14) ? 1 : 0) + (Math.abs(lx) > 0.6 ? Math.sign(lx) * dt * 6 : 0);
  if (side && cur.type === 'range') {
    const st = parseFloat(cur.step) || 1; cur.value = clamp(parseFloat(cur.value) + Math.sign(side) * st * (Math.abs(side) < 1 ? 0.5 : 1), parseFloat(cur.min), parseFloat(cur.max));
    cur.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (side && cur.tagName === 'SELECT') {
    cur.selectedIndex = clamp(cur.selectedIndex + (side > 0 ? 1 : -1), 0, cur.options.length - 1); cur.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (edge(0) && cur.tagName === 'BUTTON') cur.click();
  if (edge(1)) {
    const back = { 'screen-settings': 'btn-settings-back', 'screen-controls': 'btn-controls-back', 'screen-pause': 'btn-resume' }[curScreen];
    if (noteOpen) ui.closeNote(); else if (mapOpen) toggleMap(); else if (invOpen) toggleInventory(); else if (back) $(back).click();
  }
}
function pollPad(dt) {
  const gp = getPad();
  if (!gp) { src.padx = src.padz = 0; src.padSprint = false; return; }
  if (!padActive) { padActive = true; ui.updateTouch(); }
  const b = function (i) { const x = gp.buttons[i]; return !!x && (x.pressed || x.value > 0.5); };
  const edge = function (i) { const now = b(i), was = padPrev[i]; padPrev[i] = now; return now && !was; };
  const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0), rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
  if (lx || ly || rx || ry || gp.buttons.some(function (x) { return x && x.pressed; })) setDevice('pad');
  const e = {}; for (let i = 0; i < 18; i++) e[i] = edge(i);
  const E = function (i) { return e[i]; };
  if (gameState === 'playing') {
    if (E(9)) { pauseGame(); return; }
    if (panelOpen()) { src.padx = src.padz = 0; padMenu(gp, dt, E, ly, lx); if (E(17) || E(8)) { if (mapOpen) toggleMap(); } return; }
    src.padx = lx; src.padz = -ly;
    player.yaw -= rx * dt * 2.7 * settings.sens; player.pitch = clamp(player.pitch - ry * dt * 2.2 * settings.sens, -1.5, 1.5);
    src.padSprint = b(10) || (gp.buttons[6] && gp.buttons[6].value > 0.4);
    if (E(0)) input.jump = true;
    if (E(1)) input.crouchToggle = !input.crouchToggle;
    if (E(2) || E(7)) doInteract();
    if (E(12) || E(3)) toggleFlash();
    if (E(17) || E(8)) toggleMap();
    if (E(14)) toggleInventory();
  } else {
    src.padx = src.padz = 0; src.padSprint = false;
    if (gameState === 'paused' && E(9)) { resumeGame(); return; }
    if (gameState === 'menu' || gameState === 'paused' || gameState === 'over' || gameState === 'ended') padMenu(gp, dt, E, ly, lx);
  }
}
function gatherInput() {
  src.kbx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  src.kbz = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  if (gameState !== 'playing' || panelOpen()) { input.moveX = 0; input.moveZ = 0; input.sprint = false; return; }
  input.moveX = clamp(src.kbx + src.padx + src.tx, -1, 1); input.moveZ = clamp(src.kbz + src.padz + src.tz, -1, 1);
  input.sprint = !!(keys.ShiftLeft || keys.ShiftRight || src.padSprint || src.touchRun);
  input.crouchHeld = !!(keys.KeyC || keys.ControlLeft || keys.ControlRight);
}

/* ------------------------------------------------------------------
   MAIN LOOP & BOOT
------------------------------------------------------------------ */
let last = performance.now(), simT = 0;
const _lookDir = new V3();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.0001, (now - last) / 1000)); last = now; simT += dt;
  pollPad(dt); gatherInput();
  if (gameState === 'playing') {
    updatePlayer(dt); applyCamera(dt); updateInteract(); updateMonster(dt);
  } else if (gameState === 'cutscene') { Cut.update(dt); }
  else if (gameState === 'dying') { Kill.update(dt); }
  if (gameState === 'playing' || gameState === 'cutscene' || gameState === 'dying') {
    updateWorld(dt, simT);
    updateLamps(dt, camera.position.x, camera.position.y, camera.position.z);
    refreshForest(camera.position.x, camera.position.z);
    camera.getWorldDirection(_lookDir); SFX.listener(camera.position, _lookDir);
    ui.tick(dt);
    if (mapOpen) drawMapFrame();
  }
  const dome = scene.userData.dome; if (dome) dome.position.copy(camera.position);
  if (gameState !== 'menu') renderer.render(scene, camera);
}

(function boot() {
  bindMenus(); bindSettings(); syncSettingsUI();
  resetPlayer(); resetMonster(); buildInventory(); ui.refreshObjective();
  refreshForest(SPAWN.x, SPAWN.z, true);
  camera.position.set(SPAWN.x, SPAWN.y + 1.6, SPAWN.z);
  try { renderer.compile(scene, camera); } catch (e) { /* older drivers: compile on first frame instead */ }
  showScreen('screen-main');
  const ld = $('loading'); ld.classList.add('done'); setTimeout(function () { ld.style.display = 'none'; }, 900);
  requestAnimationFrame(frame);
})();

})();
