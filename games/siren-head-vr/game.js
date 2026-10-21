/**
 * Siren Head VR — WebXR forest horror
 * Sounds: ../Siren Head/SirenSounds/
 */
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

const statusEl = document.getElementById('status');
const btnEnter = document.getElementById('btnEnter');

const SOUND_BASE = '../Siren%20Head/SirenSounds/';
const clips = {};
async function loadSounds() {
  const names = ['siren', 'siren1', 'step', 'death', 'kill', 'impact'];
  await Promise.all(names.map(async (n) => {
    try {
      const a = new Audio(SOUND_BASE + n + '.mp3');
      a.preload = 'auto';
      a.crossOrigin = 'anonymous';
      clips[n] = a;
    } catch (_) {}
  }));
}
function play(name, { vol = 0.5, loop = false, rate = 1 } = {}) {
  const src = clips[name];
  if (!src) return null;
  const a = src.cloneNode();
  a.volume = vol;
  a.loop = loop;
  a.playbackRate = rate;
  a.play().catch(() => {});
  return a;
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06080c);
scene.fog = new THREE.FogExp2(0x0a1018, 0.045);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 200);
camera.position.set(0, 1.6, 8);

const stage = new THREE.Group();
scene.add(stage);

scene.add(new THREE.HemisphereLight(0x2a3040, 0x080a0c, 0.35));
const moon = new THREE.DirectionalLight(0x8899bb, 0.25);
moon.position.set(-20, 40, -10);
moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024);
moon.shadow.camera.near = 1;
moon.shadow.camera.far = 80;
moon.shadow.camera.left = moon.shadow.camera.bottom = -40;
moon.shadow.camera.right = moon.shadow.camera.top = 40;
scene.add(moon);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(80, 48),
  new THREE.MeshStandardMaterial({ color: 0x1a2218, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
stage.add(ground);

function addTree(x, z, h) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.2, h * 0.55, 6),
    new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.95 })
  );
  trunk.position.y = h * 0.275;
  trunk.castShadow = true;
  g.add(trunk);
  const top = new THREE.Mesh(
    new THREE.ConeGeometry(0.9 + Math.random() * 0.5, h * 0.55, 7),
    new THREE.MeshStandardMaterial({ color: 0x0e1a12, roughness: 1 })
  );
  top.position.y = h * 0.7;
  top.castShadow = true;
  g.add(top);
  g.position.set(x, 0, z);
  stage.add(g);
}

for (let i = 0; i < 90; i++) {
  const a = Math.random() * Math.PI * 2;
  const r = 6 + Math.random() * 55;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (Math.hypot(x, z) < 5) continue;
  addTree(x, z, 4 + Math.random() * 7);
}

const cabin = new THREE.Group();
const cabinMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 });
const cabinBox = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), cabinMat);
cabinBox.position.y = 1.5;
cabinBox.castShadow = true;
cabin.add(cabinBox);
const roof = new THREE.Mesh(
  new THREE.ConeGeometry(4.2, 1.5, 4),
  new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 1 })
);
roof.position.y = 3.6;
roof.rotation.y = Math.PI / 4;
cabin.add(roof);
cabin.position.set(12, 0, -8);
stage.add(cabin);

const player = {
  height: 1.6, speed: 3.2, sprintMul: 1.7, stamina: 1,
  flashlightOn: false, alive: true, noise: 0
};

const flashLight = new THREE.SpotLight(0xffe8c0, 0, 22, Math.PI / 7, 0.45, 1.2);
flashLight.castShadow = true;
const flashTarget = new THREE.Object3D();
scene.add(flashTarget);
flashLight.target = flashTarget;
scene.add(flashLight);

function makeSirenHead() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.85, metalness: 0.05 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.4, metalness: 0.7 });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 4.5, 8), bodyMat);
  torso.position.y = 5.5; torso.castShadow = true; g.add(torso);
  for (const lx of [-0.25, 0.25]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3.2, 6), bodyMat);
    leg.position.set(lx, 1.6, 0); leg.castShadow = true; g.add(leg);
  }
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.8, 6), bodyMat);
    arm.position.set(side * 0.7, 5.2, 0.2); arm.rotation.z = side * 0.35; arm.castShadow = true; g.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), bodyMat);
    hand.position.set(side * 1.35, 3.4, 0.4); g.add(hand);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), metal);
  pole.position.y = 8.7; g.add(pole);
  for (const side of [-1, 1]) {
    const siren = new THREE.Group();
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.15, 0.9, 10, 1, true), metal);
    horn.rotation.z = Math.PI / 2; siren.add(horn);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 6, 16), metal);
    rim.rotation.y = Math.PI / 2; rim.position.x = 0.45; siren.add(rim);
    siren.position.set(side * 0.55, 9.5, 0); siren.rotation.y = side * 0.4; g.add(siren);
  }
  g.scale.setScalar(1.15);
  return g;
}

const siren = makeSirenHead();
siren.position.set(25, 0, -30);
stage.add(siren);

const monster = {
  mesh: siren, state: 'patrol', speed: 2.4, huntSpeed: 5.5,
  target: new THREE.Vector3(25, 0, -30), awareness: 0,
  sirenAudio: null, stepT: 0, patrolT: 0
};

function startSirenLoop() {
  if (monster.sirenAudio) return;
  monster.sirenAudio = play('siren1', { vol: 0.25, loop: true });
  if (!monster.sirenAudio) monster.sirenAudio = play('siren', { vol: 0.3, loop: true });
}
function stopSirenLoop() {
  if (monster.sirenAudio) {
    try { monster.sirenAudio.pause(); } catch (_) {}
    monster.sirenAudio = null;
  }
}

const controllerModelFactory = new XRControllerModelFactory();
const controllers = [];
function setupController(index) {
  const controller = renderer.xr.getController(index);
  scene.add(controller);
  const grip = renderer.xr.getControllerGrip(index);
  grip.add(controllerModelFactory.createControllerModel(grip));
  scene.add(grip);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0xaaccff, transparent: true, opacity: 0.25 })
  );
  line.scale.z = 2;
  controller.add(line);
  controller.userData = { index, prevTrigger: false, prevA: false };
  controllers.push(controller);
  return controller;
}
setupController(0);
setupController(1);

const clock = new THREE.Clock();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _tmp = new THREE.Vector3();

function getPlayerWorldPos(out = new THREE.Vector3()) {
  if (renderer.xr.isPresenting) renderer.xr.getCamera().getWorldPosition(out);
  else out.copy(camera.position);
  return out;
}

function updateLocomotion(dt) {
  if (!player.alive || !renderer.xr.isPresenting) return;
  const session = renderer.xr.getSession();
  if (!session) return;
  let lx = 0, ly = 0, sprint = false;
  for (const src of session.inputSources) {
    if (!src.gamepad || !src.gamepad.axes) continue;
    const ax = src.gamepad.axes;
    const x = ax[2] || ax[0] || 0;
    const y = ax[3] || ax[1] || 0;
    if (Math.abs(x) > Math.abs(lx)) lx = x;
    if (Math.abs(y) > Math.abs(ly)) ly = y;
    if (src.gamepad.buttons[1]?.pressed) sprint = true;
  }
  if (Math.abs(lx) < 0.15) lx = 0;
  if (Math.abs(ly) < 0.15) ly = 0;
  const xrCam = renderer.xr.getCamera();
  const q = new THREE.Quaternion();
  xrCam.getWorldQuaternion(q);
  _fwd.set(0, 0, -1).applyQuaternion(q); _fwd.y = 0; _fwd.normalize();
  _right.set(1, 0, 0).applyQuaternion(q); _right.y = 0; _right.normalize();
  let spd = player.speed;
  if (sprint && player.stamina > 0.05) {
    spd *= player.sprintMul;
    player.stamina = Math.max(0, player.stamina - dt * 0.35);
    player.noise = Math.min(1, player.noise + dt * 0.8);
  } else {
    player.stamina = Math.min(1, player.stamina + dt * 0.15);
    if (lx || ly) player.noise = Math.min(1, player.noise + dt * 0.25);
    else player.noise = Math.max(0, player.noise - dt * 0.4);
  }
  const move = dt * spd;
  stage.position.addScaledVector(_fwd, ly * move);
  stage.position.addScaledVector(_right, -lx * move);
  const r = Math.hypot(stage.position.x, stage.position.z);
  if (r > 70) { stage.position.x *= 70 / r; stage.position.z *= 70 / r; }
}

function updateFlashlight() {
  const c = controllers[1] || controllers[0];
  if (!c) return;
  c.getWorldPosition(_tmp);
  flashLight.position.copy(_tmp);
  const q = new THREE.Quaternion();
  c.getWorldQuaternion(q);
  _fwd.set(0, 0, -1).applyQuaternion(q);
  flashTarget.position.copy(_tmp).addScaledVector(_fwd, 8);
  flashLight.intensity = player.flashlightOn ? 2.8 : 0;
}

function pollButtons() {
  const session = renderer.xr.getSession();
  if (!session) return;
  for (const src of session.inputSources) {
    if (!src.gamepad) continue;
    const gp = src.gamepad;
    const trigger = !!(gp.buttons[0] && gp.buttons[0].pressed);
    if (src.handedness === 'right' || (!src.handedness && src === session.inputSources[1])) {
      const c = controllers[1] || controllers[0];
      if (c && trigger && !c.userData.prevTrigger) {
        player.flashlightOn = !player.flashlightOn;
        play('impact', { vol: 0.15, rate: 1.4 });
      }
      if (c) c.userData.prevTrigger = trigger;
    }
  }
}

function updateMonster(dt) {
  if (!player.alive) return;
  const p = getPlayerWorldPos();
  const px = p.x - stage.position.x;
  const pz = p.z - stage.position.z;
  const mx = monster.mesh.position.x;
  const mz = monster.mesh.position.z;
  const dist = Math.hypot(px - mx, pz - mz);
  let gain = 0;
  if (player.flashlightOn) gain += 0.55;
  gain += player.noise * 0.5;
  if (dist < 18) gain += (1 - dist / 18) * 0.4;
  if (dist < 8) gain += 0.5;
  monster.awareness = THREE.MathUtils.clamp(monster.awareness + (gain - 0.25) * dt, 0, 1);
  if (monster.state === 'patrol') {
    monster.patrolT -= dt;
    if (monster.patrolT <= 0) {
      const a = Math.random() * Math.PI * 2;
      const r = 10 + Math.random() * 35;
      monster.target.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      monster.patrolT = 4 + Math.random() * 6;
    }
    if (monster.awareness > 0.45 || dist < 12) {
      monster.state = 'hunt';
      startSirenLoop();
      if (statusEl) statusEl.textContent = 'Something heard you…';
    }
  } else if (monster.state === 'hunt' || monster.state === 'chase') {
    monster.target.set(px, 0, pz);
    if (monster.awareness < 0.15 && dist > 22) {
      monster.state = 'patrol';
      stopSirenLoop();
      if (statusEl) statusEl.textContent = 'It lost you. Stay quiet.';
    } else if (dist < 20) {
      monster.state = 'chase';
    }
  }
  const tx = monster.target.x - mx;
  const tz = monster.target.z - mz;
  const td = Math.hypot(tx, tz) || 1;
  const spd = monster.state === 'chase' ? monster.huntSpeed
    : monster.state === 'hunt' ? monster.speed * 1.3 : monster.speed * 0.7;
  monster.mesh.position.x += (tx / td) * spd * dt;
  monster.mesh.position.z += (tz / td) * spd * dt;
  monster.mesh.rotation.y = Math.atan2(tx, tz);
  monster.stepT -= dt;
  if (monster.stepT <= 0 && (monster.state === 'chase' || monster.state === 'hunt')) {
    play('step', { vol: Math.min(0.6, 4 / Math.max(dist, 1)), rate: 0.7 });
    monster.stepT = monster.state === 'chase' ? 0.45 : 0.7;
  }
  if (monster.sirenAudio) monster.sirenAudio.volume = Math.min(0.7, 8 / Math.max(dist, 2));
  if (dist < 2.2 && monster.state !== 'patrol') killPlayer();
}

function killPlayer() {
  if (!player.alive) return;
  player.alive = false;
  player.flashlightOn = false;
  stopSirenLoop();
  play('kill', { vol: 0.8 });
  setTimeout(() => play('death', { vol: 0.7 }), 200);
  if (statusEl) statusEl.innerHTML = '<strong style="color:#f87171">IT HAS YOU</strong> — press Y to restart';
  scene.background = new THREE.Color(0x2a0505);
  setTimeout(() => { scene.background = new THREE.Color(0x06080c); }, 400);
}

function restart() {
  player.alive = true;
  player.stamina = 1;
  player.noise = 0;
  player.flashlightOn = false;
  monster.awareness = 0;
  monster.state = 'patrol';
  monster.mesh.position.set(25, 0, -30);
  stage.position.set(0, 0, 0);
  stopSirenLoop();
  if (statusEl) statusEl.textContent = 'Stay quiet. Light and noise attract it.';
}

btnEnter?.addEventListener('click', async () => {
  await loadSounds();
  try {
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor']
    });
    await renderer.xr.setSession(session);
    if (statusEl) statusEl.textContent = 'Stay quiet. Light and noise attract it.';
    session.addEventListener('end', () => {
      stopSirenLoop();
      if (statusEl) statusEl.textContent = 'VR ended';
    });
  } catch (e) {
    if (statusEl) statusEl.textContent = 'VR error: ' + e.message;
  }
});

function pollRestart() {
  const session = renderer.xr.getSession();
  if (!session) return;
  for (const src of session.inputSources) {
    if (src.handedness !== 'left' || !src.gamepad) continue;
    const y = !!(src.gamepad.buttons[5] && src.gamepad.buttons[5].pressed) ||
      !!(src.gamepad.buttons[4] && src.gamepad.buttons[4].pressed);
    const c = controllers[0];
    if (c && y && !c.userData.prevA) {
      if (!player.alive) restart();
    }
    if (c) c.userData.prevA = y;
  }
}

loadSounds();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (renderer.xr.isPresenting) {
    pollButtons();
    pollRestart();
    updateLocomotion(dt);
    updateFlashlight();
    updateMonster(dt);
  }
  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

if (statusEl) statusEl.innerHTML = '<strong>Siren Head VR</strong> — Enter VR when ready';
