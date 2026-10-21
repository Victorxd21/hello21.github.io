/* ======================================================================
   VR MODE  ·  WebXR  ·  headset + two controllers  (Act 1)
   · the motion tracker lives in your LEFT hand, the flashlight in your RIGHT hand (no hand models, just the props)
   · press A on the right controller: the flashlight turns into the map; press A again: back to the flashlight
   · your head is the camera, the thumbstick walks, the world is the same game
   ====================================================================== */
const VR_SNAP = Math.PI / 6;
const VR = {
  supported: false, active: false, busy: false, inLoop: false, session: null, floor: true,
  rig: null, ray: [], kits: null, hud: null, screen: null, black: null,
  rigState: { x: 0, y: 0, z: 0, yaw: 0 }, head: { x: 0, y: 1.6, z: 0, yaw: 0, pitch: 0 }, headAdopt: { x: 0, z: 0 },
  align: true, snapArmed: true, snapPending: 0, itemArmed: true, camArmed: true, runOn: false, radarOn: false, crouch: 0,
  deadAligned: false, prevBtn: { left: [], right: [] }, toastText: '', toastT: 0, promptText: '', promptProg: null,
  hudKey: '', screenKey: '', screenMode: '', mapDraw: -9, readHead: null, readRay: null, haptics: 0,
};
let rafPending = false;
const VR_HELP = ['LEFT STICK   walk', 'RIGHT STICK   snap turn   (up / down: items)', 'LEFT STICK CLICK   run on / off', 'RIGHT TRIGGER   use / open / pick up', 'LEFT TRIGGER   hold your breath', 'LEFT GRIP   tracker on / off', 'RIGHT GRIP   use the selected item', 'A   map <-> flashlight       B   flashlight on / off', 'X   pause       Y   back / close'];

/* ---------- reading the real world (kept in two tiny functions so the rest is plain maths) ---------- */
function vrReadHead() {
  VR.rig.updateMatrixWorld(true);
  renderer.xr.getCamera(camera);                                   // refresh the camera from the headset pose + the rig
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
function vrHaptic(strong, weak, ms) {
  const gps = vrGamepads(), amp = clamp(Math.max(strong || 0, (weak || 0) * 0.7), 0, 1), dur = clamp(ms || 100, 20, 600);
  ['left', 'right'].forEach((s) => {
    const g = gps[s];
    if (!g) return;
    try {
      const a = g.hapticActuators && g.hapticActuators[0];
      if (a && a.pulse) a.pulse(amp, dur);
      else if (g.vibrationActuator && g.vibrationActuator.playEffect) g.vibrationActuator.playEffect('dual-rumble', { duration: dur, strongMagnitude: amp, weakMagnitude: amp * 0.6 });
    } catch (e) { /* ignore */ }
  });
  VR.haptics++;
}

/* ---------- setup ---------- */
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
    VR.rig = new THREE.Group(); scene.add(VR.rig); VR.rig.add(camera);        // the "dolly": moving the rig moves the player through the world
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

/* ---------- starting / ending VR ---------- */
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
    catch (e) { VR.floor = false; renderer.xr.setReferenceSpaceType('local'); await renderer.xr.setSession(session); }    // seated / eye-level headsets
    try { if (renderer.xr.setFoveation) renderer.xr.setFoveation(1); } catch (e) { /* ignore */ }
    vrBuildKits();
    if (MP.phase !== 'off') mpLeaveLobby();
    VR.active = true; VR.busy = false; VR.align = true; VR.runOn = false; VR.radarOn = false;
    closeModals(); S.act = 1; setKeysNeeded(5); radar.up = false; S.mapUp = false;
    toLore();                                                   // the story card first, with the VR controls listed next to it
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
  if (VR.session && VR.session.visibilityState && VR.session.visibilityState !== 'visible' && S.mode === 'play') setPause(true);       // headset taken off
}
function vrOnEnd() {
  if (!VR.active && !VR.session) return;
  VR.active = false; VR.session = null; VR.runOn = false; VR.radarOn = false;
  try { renderer.setAnimationLoop(null); } catch (e) { /* ignore */ }
  VR.rigState = { x: 0, y: 0, z: 0, yaw: 0 }; vrApplyRig();
  if (VR.hud) VR.hud.visible = false;
  if (VR.screen) VR.screen.visible = false;
  if (VR.black) VR.black.visible = false;
  radar.up = false; S.mapUp = false;
  toMenu();
  try { onResize(); } catch (e) { /* ignore */ }
  if (!rafPending) { rafPending = true; requestAnimationFrame(frame); }
}
function vrOnReset() { VR.align = true; VR.deadAligned = false; VR.radarOn = false; VR.runOn = false; VR.crouch = 0; }

/* ---------- the things you hold ---------- */
function vrBuildKits() {
  if (VR.kits) return;
  const bas = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {}));
  const tex = vm.tex || (vm.tex = new THREE.CanvasTexture(el['radar-canvas']));
  // --- left hand: the motion tracker, screen tilted up towards your face ---
  const radarKit = new THREE.Group(), plate = new THREE.Group();
  plate.position.set(0, 0.035, 0.035); plate.rotation.x = -0.85; radarKit.add(plate);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.028), bas(0x1c1c1c)); plate.add(body);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.15, 0.02), bas(0x3c3c3c)); rim.position.z = -0.005; plate.add(rim);
  const screenMat = bas(0xffffff, { map: tex });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.1125), screenMat); screen.position.z = 0.0146; plate.add(screen);
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.0065, 10), bas(0x7dff9a)); led.position.set(0.078, 0.064, 0.0148); plate.add(led);
  radarKit.userData = { screenMat, led };
  // --- right hand: the flashlight (and the map that replaces it) ---
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
  // the head-locked status panel, the big message panel, and the black fade
  const mkTex = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const t = new THREE.CanvasTexture(cv); t.minFilter = THREE.LinearFilter; return { cv, tex: t, ctx: cv.getContext('2d') }; };
  VR.hud = { ...mkTex(768, 384), mesh: null }; VR.screen = { ...mkTex(1024, 640), mesh: null }; VR.black = null;
  const panel = (tex, w, h, order) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false })); m.renderOrder = order; m.frustumCulled = false; return m; };
  VR.hud.mesh = panel(VR.hud.tex, 0.62, 0.31, 999); VR.hud.mesh.position.set(0, -0.16, -0.95); camera.add(VR.hud.mesh);
  VR.screen.mesh = panel(VR.screen.tex, 1.6, 1.0, 1000); VR.screen.mesh.visible = false; scene.add(VR.screen.mesh);
  VR.black = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }));
  VR.black.renderOrder = 900; VR.black.position.set(0, 0, -0.3); VR.black.frustumCulled = false; camera.add(VR.black);
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

/* ---------- input: the controllers become the game's input ---------- */
function vrFillInput(o, dt) {
  const gps = vrGamepads(), L = gps.left, R = gps.right, mode = S.mode;
  const ax = (g) => (g && g.axes ? (g.axes.length >= 4 ? [g.axes[2] || 0, g.axes[3] || 0] : [g.axes[0] || 0, g.axes[1] || 0]) : [0, 0]);
  const down = (g, i) => !!(g && g.buttons && g.buttons[i] && g.buttons[i].pressed);
  const edge = (side, g, i) => { const was = !!VR.prevBtn[side][i], now = down(g, i); VR.prevBtn[side][i] = now; return now && !was; };
  const dz = (v) => (Math.abs(v) < 0.2 ? 0 : v);
  const [lx, ly] = ax(L), [rx, ry] = ax(R);
  const lTrig = down(L, 0), lTrigE = edge('left', L, 0), rTrigE = edge('right', R, 0), lGripE = edge('left', L, 1), rGripE = edge('right', R, 1);
  const lStickE = edge('left', L, 3), aE = edge('right', R, 4), bE = edge('right', R, 5), xE = edge('left', L, 4), yE = edge('left', L, 5);
  o.lx = 0; o.ly = 0; o.pad = true;                                 // the headset does the looking
  o.mx = dz(lx); o.mz = -dz(ly);
  if (lStickE) { VR.runOn = !VR.runOn; toast(VR.runOn ? 'RUN ON' : 'RUN OFF', 1000); }
  o.run = VR.runOn; o.breath = lTrig;
  o.interact = rTrigE; o.confirm = rTrigE; o.select = rTrigE; o.use = rGripE;
  if (lGripE && (mode === 'play' || mode === 'laptop')) { VR.radarOn = !VR.radarOn; Snd.radarToggle(); }
  if (aE) o.journal = true;                                          // A: flashlight <-> map
  if (bE) { if (S.mapUp) o.journal = true; else o.flash = true; }    // B: flashlight on/off (closes the map while it is up)
  if (xE) o.pause = true;
  if (yE) o.back = true;
  // snap turn with the right stick, items with its up / down
  if (Math.abs(rx) < 0.35) VR.snapArmed = true;
  else if (VR.snapArmed && Math.abs(rx) > 0.75) { VR.snapArmed = false; VR.snapPending += rx > 0 ? -VR_SNAP : VR_SNAP; }
  if (Math.abs(ry) < 0.35) VR.itemArmed = true;
  else if (VR.itemArmed && Math.abs(ry) > 0.75) { VR.itemArmed = false; if (ry < 0) o.itemPrev = true; else o.itemNext = true; }
  if (mode === 'laptop') {                                          // switch the security camera with the left stick
    if (Math.abs(lx) < 0.35) VR.camArmed = true;
    else if (VR.camArmed && Math.abs(lx) > 0.75) { VR.camArmed = false; if (lx < 0) o.prev = true; else o.next = true; }
    o.mx = 0; o.mz = 0;
  }
  // the message screens: right trigger = the main choice, left trigger = leave VR
  if (mode === 'paused') { if (rTrigE) setPause(false); else if (lTrigE) vrExit(); o.pause = false; }
  else if (mode === 'dead' && S.deathPhase === 'card') { if (rTrigE) chooseDeath('retry'); else if (lTrigE) vrExit(); }
  else if (mode === 'won') { if (lTrigE) vrExit(); }
  if (mode !== 'play' && mode !== 'laptop') { o.mx = 0; o.mz = 0; }
}

/* ---------- per frame ---------- */
function vrBeginFrame(dt) {
  const h = VR.readHead();
  VR.head = h; VR.headAdopt = { x: h.x, z: h.z };
  P.x = h.x; P.z = h.z;                                              // your body is where your head is (room-scale walking)
  if (!VR.align) { P.yaw = h.yaw; P.pitch = h.pitch; }
  radar.up = VR.radarOn;                                             // the tracker in your left hand is independent of the map
}
function vrRotateRig(theta, cx, cz) {                                // spin the rig around a world point (your head), so you turn on the spot
  const r = VR.rigState, dx = r.x - cx, dz = r.z - cz, c = Math.cos(theta), s = Math.sin(theta);
  r.x = cx + dx * c + dz * s; r.z = cz - dx * s + dz * c; r.yaw += theta;
}
function vrCameraY() { return VR.head.y; }
function vrEndFrame(dt) {
  const h = VR.head, r = VR.rigState, dead = (S.mode === 'dead' || S.mode === 'cutscene') && S.dcam;
  // where the game wants your head to be this frame
  let tx = P.x, tz = P.z;
  if (dead) { tx = S.dcam.x; tz = S.dcam.z; }
  r.x += tx - h.x; r.z += tz - h.z;
  if (dead) r.y += S.dcam.y - h.y;
  else {
    VR.crouch = approach(VR.crouch, P.hiding ? 0.22 : 0, dt * 0.7);                // you sink a little while hiding
    r.y = (VR.floor ? 0 : EYE_H) + (P.gy || 0) - VR.crouch;
  }
  // snap turn, then any turn the game itself asks for (the start position, crawling into a closet, a jumpscare)
  if (VR.snapPending) { vrRotateRig(VR.snapPending, tx, tz); VR.snapPending = 0; }
  let want = null;
  if (VR.align) { want = P.yaw; VR.align = false; }
  else if (P.anim) want = P.yaw;
  else if (dead) { if (!VR.deadAligned) { want = S.dcam.yaw; VR.deadAligned = true; } }
  else VR.deadAligned = false;
  if (want != null) vrRotateRig(angDiff(h.yaw + (VR.snapPending ? 0 : 0), want), tx, tz);
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
  // the real light: out of the torch, along the controller
  const tx = ray.x + ray.dx * 0.12, ty = ray.y + ray.dy * 0.12, tz = ray.z + ray.dz * 0.12;
  flash.position.set(tx, ty, tz); flash.target.position.set(tx + ray.dx * 6, ty + ray.dy * 6, tz + ray.dz * 6);
  if (flash.target.updateMatrixWorld) flash.target.updateMatrixWorld();
  if (holdMap) flash.intensity = 0;
  if (holdMap && S.time - VR.mapDraw > 0.25) { VR.mapDraw = S.time; drawJournal(); if (vm.mapTex) { vm.mapTex.needsUpdate = true; K.map.userData.paper.material.map = vm.mapTex; K.map.userData.paper.material.needsUpdate = true; } }
}

/* ---------- on-screen information, since the page itself isn't visible in a headset ---------- */
function vrWrap(ctx, text, maxW) {
  const out = [];
  String(text || '').split('\n').forEach((para) => {
    let line = '';
    para.split(' ').forEach((w) => { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
    out.push(line);
  });
  return out;
}
function vrScreenInfo() {
  const m = S.mode;
  if (m === 'lore') return { title: '', text: el['lore-text'] ? el['lore-text'].textContent : '', help: VR_HELP, hint: 'RIGHT TRIGGER: BEGIN' };
  if (m === 'paused') return { title: 'PAUSED', text: '', help: VR_HELP, hint: 'RIGHT TRIGGER: RESUME     LEFT TRIGGER: EXIT VR' };
  if (m === 'dead' && S.deathPhase === 'card') return { title: 'YOU WERE CAUGHT', text: el['death-stats'] ? el['death-stats'].textContent : '', hint: 'RIGHT TRIGGER: TRY AGAIN     LEFT TRIGGER: EXIT VR' };
  if (m === 'won') return { title: el['win-title'] ? el['win-title'].textContent : '', text: el['win-text'] ? el['win-text'].textContent : '', hint: 'RIGHT TRIGGER: PLAY AGAIN     LEFT TRIGGER: EXIT VR' };
  if (m === 'note') return { note: true, hint: 'RIGHT TRIGGER: CLOSE' };
  return null;
}
function vrUpdatePanels(dt) {
  const K = VR.kits;
  if (!K || !VR.hud) return;
  VR.toastT -= dt;
  // black fade: scares, cuts and the death card sit on black
  const cut = parseFloat(el.cut && el.cut.style ? el.cut.style.opacity : 0) || 0;
  const blk = Math.max(cut, (S.mode === 'dead' && (S.deathPhase === 'black' || S.deathPhase === 'card' || S.deathPhase === 'out')) ? 1 : 0);
  VR.black.material.opacity = blk; VR.black.visible = blk > 0.01;
  // the big message screen, placed in front of you when it first appears
  const info = vrScreenInfo(), key = info ? S.mode : '';
  if (info && VR.screenKey !== key) {
    const h = VR.head, d = 1.5;
    VR.screen.mesh.position.set(h.x - Math.sin(h.yaw) * d, h.y - 0.05, h.z - Math.cos(h.yaw) * d); VR.screen.mesh.rotation.y = h.yaw; VR.screen.mesh.updateMatrixWorld && VR.screen.mesh.updateMatrixWorld();
  }
  VR.screenKey = key; VR.screen.mesh.visible = !!info;
  if (info) vrDrawScreen(info);
  // the small status panel
  VR.hud.mesh.visible = !info || !!info.note ? true : false;
  vrDrawHud();
}
function vrDrawScreen(info) {
  const S2 = VR.screen, c = S2.ctx, W = 1024, H = 640;
  const sig = [S.mode, info.title, info.text, info.hint, info.note ? 'n' : ''].join('|');
  if (VR.screenSig === sig && !info.note) return;
  VR.screenSig = sig;
  c.clearRect(0, 0, W, H); c.fillStyle = 'rgba(0,0,0,0.88)'; c.fillRect(0, 0, W, H); c.strokeStyle = '#bbb'; c.lineWidth = 4; c.strokeRect(10, 10, W - 20, H - 20);
  c.textAlign = 'center'; c.fillStyle = '#fff';
  let y = 90;
  if (info.note) {                                                  // a note you picked up: show its own page
    const nc = el['note-canvas'];
    if (nc && nc.width) c.drawImage(nc, 40, 30, W - 80, H - 130);
  } else {
    if (info.title) { c.font = '56px "Courier New", monospace'; c.fillText(info.title, W / 2, y); y += 70; }
    if (info.text) { c.font = '30px "Courier New", monospace'; c.textAlign = 'center'; vrWrap(c, info.text, W - 140).forEach((ln) => { c.fillText(ln, W / 2, y); y += 40; }); y += 10; }
    if (info.help) { c.font = '23px "Courier New", monospace'; c.textAlign = 'left'; c.fillStyle = '#cfcfcf'; info.help.forEach((ln) => { c.fillText(ln, 90, y); y += 31; }); c.textAlign = 'center'; c.fillStyle = '#fff'; }
  }
  c.font = '30px "Courier New", monospace'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText(info.hint || '', W / 2, H - 38);
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
