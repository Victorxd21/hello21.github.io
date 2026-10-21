/**
 * testVR — physics playground
 * Fixed: grip grab (squeeze + gamepad), thumbstick move (world offset)
 * Added: outlines, trails, sounds
 */
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import * as CANNON from 'cannon-es';

const statusEl = document.getElementById('status');
const btnEnter = document.getElementById('btnEnter');
const desktopNote = document.getElementById('desktopNote');

// ─── audio (simple Web Audio beeps) ─────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let actx = null;
function ensureAudio() {
  if (!actx) actx = new AudioCtx();
  if (actx.state === 'suspended') actx.resume();
}
function beep(freq, dur = 0.06, type = 'square', vol = 0.08) {
  try {
    ensureAudio();
    const t = actx.currentTime;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(actx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch (_) {}
}
const SFX = {
  grab: () => beep(320, 0.07, 'sine', 0.1),
  release: () => beep(180, 0.08, 'triangle', 0.07),
  shoot: () => { beep(120, 0.05, 'sawtooth', 0.09); setTimeout(() => beep(80, 0.08, 'square', 0.05), 30); },
  hit: () => beep(90, 0.05, 'square', 0.06),
  menu: () => beep(520, 0.05, 'sine', 0.08),
  spawn: () => beep(440, 0.06, 'triangle', 0.07)
};

// ─── renderer ───────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1020);
scene.fog = new THREE.Fog(0x0b1020, 16, 55);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(0, 1.6, 3.5);
scene.add(camera);

// World stage — we move THIS for VR locomotion (keeps XR poses correct)
const stage = new THREE.Group();
scene.add(stage);

scene.add(new THREE.HemisphereLight(0xa5b4fc, 0x1e1b4b, 0.75));
const dir = new THREE.DirectionalLight(0xffffff, 1.05);
dir.position.set(5, 12, 6);
dir.castShadow = true;
dir.shadow.mapSize.set(1024, 1024);
dir.shadow.camera.near = 0.5;
dir.shadow.camera.far = 40;
dir.shadow.camera.left = dir.shadow.camera.bottom = -14;
dir.shadow.camera.right = dir.shadow.camera.top = 14;
scene.add(dir);

// ─── physics ────────────────────────────────────────────────
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.2, 0) });
world.broadphase = new CANNON.NaiveBroadphase();
world.allowSleep = true;
world.defaultContactMaterial.friction = 0.45;
world.defaultContactMaterial.restitution = 0.25;

const groundBody = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(22, 64),
  new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9, metalness: 0.05 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
stage.add(floor);
stage.add(new THREE.GridHelper(24, 24, 0x6366f1, 0x312e81).translateY(0.01));

// ─── state ──────────────────────────────────────────────────
const objects = [];
const menuButtons = [];
const trails = []; // { mesh, points, life }
const GRAB_RANGE = 9;
const PULL_SPEED = 14;
const MOVE_SPEED = 3.5;
const cubeColors = [0xef4444, 0x22c55e, 0x3b82f6, 0xf59e0b, 0xa855f7, 0xec4899, 0x14b8a6, 0xf97316];

// player offset for desktop (camera moves); VR uses stage
const playerPos = new THREE.Vector3(0, 0, 0);

function syncMeshToBody(mesh, body) {
  mesh.position.copy(body.position);
  mesh.quaternion.copy(body.quaternion);
}

function setBodyKinematic(body, on) {
  if (on) {
    body.type = CANNON.Body.KINEMATIC;
    body.velocity.setZero();
    body.angularVelocity.setZero();
  } else {
    body.type = CANNON.Body.DYNAMIC;
    body.wakeUp();
  }
}

// ─── outlines ───────────────────────────────────────────────
const outlineMat = new THREE.MeshBasicMaterial({
  color: 0x38bdf8,
  side: THREE.BackSide,
  transparent: true,
  opacity: 0.85
});
let outlineMesh = null;

function showOutline(obj) {
  clearOutline();
  if (!obj || !obj.mesh) return;
  // clone geometry from primary mesh
  let geo = null;
  obj.mesh.traverse((c) => {
    if (!geo && c.isMesh && c.geometry) geo = c.geometry;
  });
  if (!geo) return;
  outlineMesh = new THREE.Mesh(geo, outlineMat);
  outlineMesh.scale.multiplyScalar(1.12);
  outlineMesh.renderOrder = 9;
  // attach as child so it follows
  const host = obj.mesh.isMesh ? obj.mesh : obj.mesh;
  host.add(outlineMesh);
  // if group, center outline roughly
  if (!obj.mesh.isMesh) {
    outlineMesh.position.set(0, 0, 0);
  }
}

function clearOutline() {
  if (outlineMesh) {
    if (outlineMesh.parent) outlineMesh.parent.remove(outlineMesh);
    outlineMesh = null;
  }
}

// ─── trails ─────────────────────────────────────────────────
function addTrailPoint(obj) {
  if (!obj.trail) {
    obj.trail = {
      positions: [],
      mesh: null,
      life: 0.6
    };
  }
  const p = obj.mesh.position;
  obj.trail.positions.push(p.x, p.y, p.z);
  // keep last N points
  const maxPts = 12;
  while (obj.trail.positions.length > maxPts * 3) {
    obj.trail.positions.splice(0, 3);
  }
  obj.trail.life = 0.7;

  const arr = obj.trail.positions;
  if (arr.length < 6) return;

  if (!obj.trail.mesh) {
    const geo = new THREE.BufferGeometry();
    const mat = new THREE.LineBasicMaterial({
      color: obj.kind === 'ball' ? 0x38bdf8 : 0xa78bfa,
      transparent: true,
      opacity: 0.7
    });
    obj.trail.mesh = new THREE.Line(geo, mat);
    scene.add(obj.trail.mesh);
  }
  obj.trail.mesh.geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(arr.slice(), 3)
  );
  obj.trail.mesh.geometry.attributes.position.needsUpdate = true;
  obj.trail.mesh.material.opacity = 0.75;
}

function updateTrails(dt) {
  for (const o of objects) {
    if (!o.trail) continue;
    const spd = o.body ? o.body.velocity.length() : 0;
    if (spd > 2.5 || o.kind === 'ball') {
      addTrailPoint(o);
    }
    o.trail.life -= dt;
    if (o.trail.mesh) {
      o.trail.mesh.material.opacity = Math.max(0, o.trail.life) * 1.1;
      if (o.trail.life <= 0) {
        scene.remove(o.trail.mesh);
        o.trail.mesh.geometry.dispose();
        o.trail = null;
      }
    }
  }
}

// ─── create objects ─────────────────────────────────────────
function addCube(x, y, z, size = 0.35, color = 0xef4444) {
  const half = size / 2;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshStandardMaterial({
      color, roughness: 0.35, metalness: 0.2,
      emissive: color, emissiveIntensity: 0.12
    })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(x, y, z);
  stage.add(mesh);

  const body = new CANNON.Body({
    mass: 1.2 * (size / 0.35),
    shape: new CANNON.Box(new CANNON.Vec3(half, half, half)),
    position: new CANNON.Vec3(x, y, z),
    linearDamping: 0.15,
    angularDamping: 0.2
  });
  world.addBody(body);

  const obj = { mesh, body, kind: 'cube', grabbedBy: null, size };
  mesh.userData.obj = obj;
  objects.push(obj);
  return obj;
}

function addSphere(x, y, z, r = 0.2, color = 0xf472b6) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(r, 20, 20),
    new THREE.MeshStandardMaterial({
      color, roughness: 0.3, metalness: 0.15,
      emissive: color, emissiveIntensity: 0.1
    })
  );
  mesh.castShadow = true;
  mesh.position.set(x, y, z);
  stage.add(mesh);

  const body = new CANNON.Body({
    mass: 0.9,
    shape: new CANNON.Sphere(r),
    position: new CANNON.Vec3(x, y, z),
    linearDamping: 0.12,
    angularDamping: 0.15
  });
  world.addBody(body);

  const obj = { mesh, body, kind: 'sphere', grabbedBy: null, size: r * 2 };
  mesh.userData.obj = obj;
  objects.push(obj);
  return obj;
}

for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2;
  const r = 1.5 + Math.random() * 2;
  addCube(Math.cos(a) * r, 0.5 + Math.random() * 1.5, Math.sin(a) * r - 0.3,
    0.28 + Math.random() * 0.16, cubeColors[i % cubeColors.length]);
}
for (let i = 0; i < 4; i++) {
  addCube(-1.5, 0.2 + i * 0.36, -1.2, 0.34, cubeColors[i % cubeColors.length]);
}

function createGunMesh() {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.35 });
  const accent = new THREE.MeshStandardMaterial({
    color: 0x38bdf8, metalness: 0.4, roughness: 0.3, emissive: 0x0ea5e9, emissiveIntensity: 0.25
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.28), dark);
  body.castShadow = true; g.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.32, 12), dark);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, -0.28); barrel.castShadow = true; g.add(barrel);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.04, 12), accent);
  tip.rotation.x = Math.PI / 2; tip.position.set(0, 0.02, -0.44); g.add(tip);
  const gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.08), dark);
  gripMesh.position.set(0, -0.1, 0.06); gripMesh.rotation.x = 0.25; gripMesh.castShadow = true; g.add(gripMesh);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.02, -0.48); g.add(muzzle);
  g.userData.muzzle = muzzle;
  return g;
}

function addGun(x, y, z) {
  const mesh = createGunMesh();
  mesh.position.set(x, y, z);
  stage.add(mesh);
  const body = new CANNON.Body({
    mass: 1.5,
    shape: new CANNON.Box(new CANNON.Vec3(0.06, 0.1, 0.22)),
    position: new CANNON.Vec3(x, y, z),
    linearDamping: 0.2, angularDamping: 0.35
  });
  world.addBody(body);
  const obj = { mesh, body, kind: 'gun', grabbedBy: null, size: 0.4 };
  mesh.userData.obj = obj;
  mesh.traverse((c) => { c.userData.obj = obj; });
  objects.push(obj);
  return obj;
}
addGun(0.9, 1.1, 1.3);

const ballGeo = new THREE.SphereGeometry(0.07, 14, 14);
const ballMat = new THREE.MeshStandardMaterial({
  color: 0xf8fafc, emissive: 0x38bdf8, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.15
});

function shootBall(origin, direction, speed = 14) {
  SFX.shoot();
  // origin is world space; convert to stage-local
  const local = stage.worldToLocal(origin.clone());
  const mesh = new THREE.Mesh(ballGeo, ballMat.clone());
  mesh.castShadow = true;
  mesh.position.copy(local);
  stage.add(mesh);

  const body = new CANNON.Body({
    mass: 0.35,
    shape: new CANNON.Sphere(0.07),
    position: new CANNON.Vec3(local.x, local.y, local.z),
    linearDamping: 0.05, angularDamping: 0.1
  });
  // direction is world; velocity in physics is stage/world aligned since stage only translates
  const dir = direction.clone().normalize().multiplyScalar(speed);
  body.velocity.set(dir.x, dir.y, dir.z);
  world.addBody(body);

  const obj = { mesh, body, kind: 'ball', grabbedBy: null, life: 8, size: 0.14 };
  mesh.userData.obj = obj;
  objects.push(obj);
}

function spawnInFront(kind) {
  SFX.spawn();
  const origin = new THREE.Vector3();
  const look = new THREE.Vector3();
  if (renderer.xr.isPresenting) {
    renderer.xr.getCamera().getWorldPosition(origin);
    renderer.xr.getCamera().getWorldDirection(look);
  } else {
    camera.getWorldPosition(origin);
    camera.getWorldDirection(look);
  }
  const worldPos = origin.clone().addScaledVector(look, 2.2);
  worldPos.y = Math.max(0.5, worldPos.y);
  const local = stage.worldToLocal(worldPos.clone());

  if (kind === 'cube') {
    addCube(local.x, local.y, local.z, 0.28 + Math.random() * 0.2, cubeColors[(Math.random() * cubeColors.length) | 0]);
  } else if (kind === 'sphere') {
    addSphere(local.x, local.y, local.z, 0.18 + Math.random() * 0.12, cubeColors[(Math.random() * cubeColors.length) | 0]);
  } else if (kind === 'stack') {
    for (let i = 0; i < 5; i++) addCube(local.x, 0.2 + i * 0.38, local.z, 0.34, cubeColors[i % cubeColors.length]);
  } else if (kind === 'rain') {
    for (let i = 0; i < 8; i++) {
      addCube(local.x + (Math.random() - 0.5) * 2, 2.5 + Math.random() * 2, local.z + (Math.random() - 0.5) * 2,
        0.25 + Math.random() * 0.15, cubeColors[i % cubeColors.length]);
    }
  }
}

function clearToys() {
  SFX.menu();
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (o.kind === 'gun' || o.grabbedBy) continue;
    if (o.trail && o.trail.mesh) {
      scene.remove(o.trail.mesh);
      o.trail.mesh.geometry.dispose();
    }
    world.removeBody(o.body);
    stage.remove(o.mesh);
    objects.splice(i, 1);
  }
  clearOutline();
}

// ─── menu ───────────────────────────────────────────────────
const menuGroup = new THREE.Group();
menuGroup.position.set(-2.2, 1.4, 0.5);
stage.add(menuGroup);

menuGroup.add(new THREE.Mesh(
  new THREE.PlaneGeometry(1.1, 1.35),
  new THREE.MeshStandardMaterial({
    color: 0x0f172a, roughness: 0.6, metalness: 0.2,
    transparent: true, opacity: 0.92, side: THREE.DoubleSide
  })
).translateZ(-0.02));

function makeLabel(text, y) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 64px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.56, 0.14),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, side: THREE.DoubleSide })
  );
  mesh.position.set(0, y, 0.01);
  menuGroup.add(mesh);
}
makeLabel('PLAYGROUND', 0.55);

function makeButton(label, y, action, color = 0x4f46e5) {
  const w = 0.85, h = 0.16;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({
      color, roughness: 0.4, metalness: 0.2,
      emissive: color, emissiveIntensity: 0.25, side: THREE.DoubleSide
    })
  );
  mesh.position.set(0, y, 0.02);
  menuGroup.add(mesh);

  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 52px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 256, 48);
  const textMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.92, h * 0.75),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, side: THREE.DoubleSide })
  );
  textMesh.position.set(0, y, 0.03);
  menuGroup.add(textMesh);

  mesh.userData.isMenuButton = true;
  mesh.userData.action = action;
  menuButtons.push(mesh);
  return mesh;
}

makeButton('+ Cube', 0.32, () => spawnInFront('cube'), 0x4f46e5);
makeButton('+ Sphere', 0.12, () => spawnInFront('sphere'), 0x7c3aed);
makeButton('+ Stack', -0.08, () => spawnInFront('stack'), 0x2563eb);
makeButton('Cube Rain', -0.28, () => spawnInFront('rain'), 0x0891b2);
makeButton('Clear toys', -0.48, () => clearToys(), 0xb91c1c);

// ─── blue ring (extra target marker) ────────────────────────
const ringMat = new THREE.MeshBasicMaterial({
  color: 0x38bdf8, transparent: true, opacity: 0.85,
  side: THREE.DoubleSide, depthWrite: false
});
const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.28, 32), ringMat);
ring.visible = false;
ring.renderOrder = 10;
scene.add(ring);

let hoveredButton = null;
let highlightedObj = null;

// ─── controllers (stay in SCENE root — critical for XR poses) ─
const controllerModelFactory = new XRControllerModelFactory();
const tempMatrix = new THREE.Matrix4();
const raycaster = new THREE.Raycaster();
raycaster.far = GRAB_RANGE;

function setupController(index) {
  const controller = renderer.xr.getController(index);
  scene.add(controller);

  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.65 })
  );
  line.scale.z = GRAB_RANGE;
  controller.add(line);

  const gripCtrl = renderer.xr.getControllerGrip(index);
  gripCtrl.add(controllerModelFactory.createControllerModel(gripCtrl));
  scene.add(gripCtrl);

  controller.userData = {
    index,
    holding: null,
    pulling: null,
    gripDown: false,
    prevGripDown: false,
    triggerDown: false,
    prevTriggerDown: false,
    prevPos: new THREE.Vector3(),
    velocity: new THREE.Vector3()
  };

  // Event API (when browser supports it)
  controller.addEventListener('squeezestart', () => startGrab(controller));
  controller.addEventListener('squeezeend', () => endGrab(controller));
  controller.addEventListener('selectstart', () => onTrigger(controller));

  return controller;
}

const controller0 = setupController(0);
const controller1 = setupController(1);
const controllers = [controller0, controller1];

function getControllerRay(controller) {
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  return raycaster;
}

function resolveObj(object) {
  let o = object.userData && object.userData.obj;
  if (o) return o;
  let p = object.parent;
  while (p) {
    if (p.userData && p.userData.obj) return p.userData.obj;
    p = p.parent;
  }
  return null;
}

function pickObject(controller) {
  const rc = getControllerRay(controller);
  const meshes = objects.map((o) => o.mesh);
  const hits = rc.intersectObjects(meshes, true);
  for (const h of hits) {
    const o = resolveObj(h.object);
    if (o && !o.grabbedBy && o.kind !== 'ball') {
      return { obj: o, point: h.point, distance: h.distance };
    }
  }
  return null;
}

function pickMenuButton(controller) {
  const rc = getControllerRay(controller);
  const hits = rc.intersectObjects(menuButtons, false);
  return hits.length ? hits[0].object : null;
}

function startGrab(controller) {
  const ud = controller.userData;
  if (ud.holding || ud.pulling) return;
  const hit = pickObject(controller);
  if (!hit) return;
  SFX.grab();
  ud.pulling = hit.obj;
  hit.obj.grabbedBy = controller;
  setBodyKinematic(hit.obj.body, true);
  // move mesh from stage to world temporarily for parenting math
  const wp = new THREE.Vector3();
  const wq = new THREE.Quaternion();
  hit.obj.mesh.getWorldPosition(wp);
  hit.obj.mesh.getWorldQuaternion(wq);
  stage.remove(hit.obj.mesh);
  scene.add(hit.obj.mesh);
  hit.obj.mesh.position.copy(wp);
  hit.obj.mesh.quaternion.copy(wq);
}

function endGrab(controller) {
  const ud = controller.userData;
  const held = ud.holding || ud.pulling;
  if (!held) return;

  SFX.release();

  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  held.mesh.getWorldPosition(worldPos);
  held.mesh.getWorldQuaternion(worldQuat);

  if (held.mesh.parent === controller) {
    scene.attach(held.mesh);
  }

  // back into stage space
  scene.remove(held.mesh);
  stage.add(held.mesh);
  const local = stage.worldToLocal(worldPos.clone());
  held.mesh.position.copy(local);
  // quaternion: approx keep world rotation
  held.mesh.quaternion.copy(worldQuat);

  held.body.position.set(local.x, local.y, local.z);
  held.body.quaternion.set(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w);
  setBodyKinematic(held.body, false);

  const v = ud.velocity.clone().multiplyScalar(1.2);
  held.body.velocity.set(v.x, v.y, v.z);
  held.body.angularVelocity.set(
    (Math.random() - 0.5) * 3,
    (Math.random() - 0.5) * 3,
    (Math.random() - 0.5) * 3
  );

  held.grabbedBy = null;
  ud.holding = null;
  ud.pulling = null;
}

function onTrigger(controller) {
  ensureAudio();
  const ud = controller.userData;
  const btn = pickMenuButton(controller);
  if (btn && btn.userData.action) {
    SFX.menu();
    btn.userData.action();
    const mat = btn.material;
    const prev = mat.emissiveIntensity;
    mat.emissiveIntensity = 0.95;
    setTimeout(() => { mat.emissiveIntensity = prev; }, 120);
    return;
  }
  if (ud.holding && ud.holding.kind === 'gun') {
    fireGun(ud.holding);
  }
}

function fireGun(gunObj) {
  const muzzle = gunObj.mesh.userData.muzzle;
  const origin = new THREE.Vector3();
  muzzle.getWorldPosition(origin);
  const dir = new THREE.Vector3(0, 0, -1);
  dir.applyQuaternion(gunObj.mesh.getWorldQuaternion(new THREE.Quaternion()));
  dir.x += (Math.random() - 0.5) * 0.03;
  dir.y += (Math.random() - 0.5) * 0.03;
  dir.normalize();
  shootBall(origin, dir, 14);
}

function updateGrab(controller, dt) {
  const ud = controller.userData;
  const pos = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
  if (ud.prevPos.lengthSq() > 0) {
    ud.velocity.copy(pos).sub(ud.prevPos).multiplyScalar(1 / Math.max(dt, 0.001));
  }
  ud.prevPos.copy(pos);

  if (ud.pulling && !ud.holding) {
    const obj = ud.pulling;
    const target = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    target.add(new THREE.Vector3(0, 0, -0.25).applyQuaternion(controller.quaternion));
    const cur = obj.mesh.position.clone();
    const to = target.sub(cur);
    const dist = to.length();
    if (dist < 0.2) {
      controller.attach(obj.mesh);
      if (obj.kind === 'gun') {
        obj.mesh.position.set(0, -0.02, -0.15);
        obj.mesh.rotation.set(0, 0, 0);
      } else {
        obj.mesh.position.set(0, 0, -0.2);
        obj.mesh.rotation.set(0, 0, 0);
      }
      ud.holding = obj;
      ud.pulling = null;
    } else {
      to.normalize().multiplyScalar(Math.min(dist, PULL_SPEED * dt));
      obj.mesh.position.add(to);
      // kinematic body tracks world pos in stage space for physics sleep
      const loc = stage.worldToLocal(obj.mesh.position.clone());
      obj.body.position.set(loc.x, loc.y, loc.z);
    }
  }

  if (ud.holding) {
    const obj = ud.holding;
    const wp = new THREE.Vector3();
    const wq = new THREE.Quaternion();
    obj.mesh.getWorldPosition(wp);
    obj.mesh.getWorldQuaternion(wq);
    const loc = stage.worldToLocal(wp.clone());
    obj.body.position.set(loc.x, loc.y, loc.z);
    obj.body.quaternion.set(wq.x, wq.y, wq.z, wq.w);
    obj.body.velocity.setZero();
    obj.body.angularVelocity.setZero();
  }
}

// Poll gamepad for grip/trigger (more reliable on some headsets)
function pollGamepads(dt) {
  const session = renderer.xr.getSession();
  if (!session) return;

  const sources = session.inputSources;
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    const controller = src.handedness === 'left' ? controller0 :
      src.handedness === 'right' ? controller1 :
      controllers[i] || null;
    if (!controller || !src.gamepad) continue;

    const gp = src.gamepad;
    const ud = controller.userData;

    // buttons[0] = trigger, buttons[1] = grip (Quest / OpenXR common)
    const triggerPressed = !!(gp.buttons[0] && gp.buttons[0].pressed);
    const gripPressed = !!(gp.buttons[1] && gp.buttons[1].pressed) ||
      !!(gp.buttons[2] && gp.buttons[2].pressed); // some devices

    // Grip edges
    if (gripPressed && !ud.prevGripDown) startGrab(controller);
    if (!gripPressed && ud.prevGripDown) endGrab(controller);
    ud.prevGripDown = gripPressed;
    ud.gripDown = gripPressed;

    // Trigger edge for menu/shoot (select event may also fire — debounce with flag)
    if (triggerPressed && !ud.prevTriggerDown) {
      // only fire if select event might not — call onTrigger; double-fire is mostly ok for shoot
      // skip if we already handled via selectstart this frame: use a light debounce
      if (!ud._triggerEvt) onTrigger(controller);
    }
    ud.prevTriggerDown = triggerPressed;
    ud.triggerDown = triggerPressed;
    ud._triggerEvt = false;
  }
}

// Mark select event so poll doesn't double
for (const c of controllers) {
  c.addEventListener('selectstart', () => { c.userData._triggerEvt = true; });
}

function updateHighlight() {
  if (hoveredButton) {
    hoveredButton.material.emissiveIntensity = 0.25;
    hoveredButton = null;
  }

  let best = null;
  let bestBtn = null;

  if (renderer.xr.isPresenting) {
    for (const c of controllers) {
      const btn = pickMenuButton(c);
      if (btn) bestBtn = btn;
      if (c.userData.holding || c.userData.pulling) continue;
      const hit = pickObject(c);
      if (hit && (!best || hit.distance < best.distance)) best = hit;
    }
  }

  if (bestBtn) {
    hoveredButton = bestBtn;
    bestBtn.material.emissiveIntensity = 0.55;
  }

  if (best) {
    if (highlightedObj !== best.obj) {
      highlightedObj = best.obj;
      showOutline(best.obj);
    }
    ring.visible = true;
    const s = (best.obj.size || 0.35) * 1.15 + 0.15;
    ring.scale.setScalar(s / 0.25);
    best.obj.mesh.getWorldPosition(ring.position);
    ring.lookAt(camera.position);
    ringMat.opacity = 0.7 + Math.sin(performance.now() * 0.008) * 0.2;
  } else {
    if (highlightedObj) {
      highlightedObj = null;
      clearOutline();
    }
    ring.visible = false;
  }
}

// ─── locomotion: move STAGE opposite to stick (XR-safe) ─────
function updateLocomotion(dt) {
  if (!renderer.xr.isPresenting) return;
  const session = renderer.xr.getSession();
  if (!session) return;

  let sx = 0, sy = 0;
  for (const src of session.inputSources) {
    if (!src.gamepad || !src.gamepad.axes) continue;
    const a = src.gamepad.axes;
    let ax = 0, ay = 0;
    if (a.length >= 4) { ax = a[2]; ay = a[3]; }
    else if (a.length >= 2) { ax = a[0]; ay = a[1]; }
    if (Math.abs(ax) > Math.abs(sx)) sx = ax;
    if (Math.abs(ay) > Math.abs(sy)) sy = ay;
  }
  if (Math.abs(sx) < 0.15) sx = 0;
  if (Math.abs(sy) < 0.15) sy = 0;
  if (!sx && !sy) return;

  const xrCam = renderer.xr.getCamera();
  const forward = new THREE.Vector3();
  xrCam.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 1e-6) return;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

  // Move world opposite so player feels like walking forward
  const move = new THREE.Vector3();
  move.addScaledVector(forward, sy * MOVE_SPEED * dt);  // stick forward often -Y on Quest → use +sy with invert:
  // Quest: up on stick = axes[3] negative → want walk forward
  move.set(0, 0, 0);
  move.addScaledVector(forward, -sy * MOVE_SPEED * dt);
  move.addScaledVector(right, sx * MOVE_SPEED * dt);

  // shift stage
  stage.position.sub(move);

  // shift all dynamic bodies the same amount (stage visual moved; physics coords are stage-local,
  // so when we only move stage group, mesh.position is local and stays correct WITHOUT moving bodies).
  // bodies already in stage-local space — good, no body shift needed.
}

// ─── WebXR enter ────────────────────────────────────────────
async function checkXR() {
  if (!navigator.xr) {
    statusEl.innerHTML = '<strong>WebXR not available</strong>';
    btnEnter.disabled = true;
    btnEnter.textContent = 'VR not supported';
    return;
  }
  try {
    const ok = await navigator.xr.isSessionSupported('immersive-vr');
    if (ok) {
      statusEl.innerHTML = '<strong>WebXR ready</strong>';
      btnEnter.disabled = false;
      btnEnter.textContent = 'Enter VR';
    } else {
      statusEl.innerHTML = '<strong>No VR headset</strong> — desktop mode';
      btnEnter.disabled = true;
      btnEnter.textContent = 'No VR headset';
    }
  } catch {
    statusEl.innerHTML = '<strong>WebXR check failed</strong>';
    btnEnter.disabled = true;
  }
}
checkXR();

btnEnter.addEventListener('click', async () => {
  ensureAudio();
  try {
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
    });
    await renderer.xr.setSession(session);
    btnEnter.classList.add('hidden');
    desktopNote.style.display = 'none';
    statusEl.innerHTML = '<strong>In VR</strong> — grip grab · trigger shoot · stick move';
    session.addEventListener('end', () => {
      btnEnter.classList.remove('hidden');
      desktopNote.style.display = '';
      for (const c of controllers) {
        if (c.userData.holding || c.userData.pulling) endGrab(c);
      }
      checkXR();
    });
  } catch (err) {
    statusEl.innerHTML = '<strong>Failed:</strong> ' + (err.message || err);
  }
});

// ─── desktop ────────────────────────────────────────────────
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const keys = {};
let desktopHolding = null;
let desktopPulling = null;

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  ensureAudio();
  if (e.code === 'KeyG') spawnInFront('cube');
  if (e.code === 'KeyB') spawnInFront('sphere');
  if (e.code === 'KeyR') spawnInFront('rain');
  if (e.code === 'KeyX') clearToys();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('pointerdown', () => ensureAudio());

renderer.domElement.addEventListener('pointermove', (e) => {
  if (renderer.xr.isPresenting) return;
  if (e.buttons === 2 || (e.buttons === 1 && e.shiftKey)) {
    euler.setFromQuaternion(camera.quaternion);
    euler.y -= e.movementX * 0.005;
    euler.x -= e.movementY * 0.005;
    euler.x = Math.max(-1.4, Math.min(1.4, euler.x));
    camera.quaternion.setFromEuler(euler);
  }
});

function desktopPickObj() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  raycaster.far = GRAB_RANGE;
  const hits = raycaster.intersectObjects(objects.map((o) => o.mesh), true);
  for (const h of hits) {
    const o = resolveObj(h.object);
    if (o && !o.grabbedBy && o.kind !== 'ball') return { obj: o, distance: h.distance };
  }
  return null;
}

function desktopPickMenu() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(menuButtons, false);
  return hits.length ? hits[0].object : null;
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (renderer.xr.isPresenting || e.button !== 0 || e.shiftKey) return;
  ensureAudio();

  const btn = desktopPickMenu();
  if (btn && btn.userData.action) {
    SFX.menu();
    btn.userData.action();
    return;
  }

  if (desktopHolding && desktopHolding.kind === 'gun') {
    fireGun(desktopHolding);
    return;
  }
  if (desktopHolding || desktopPulling) return;

  const hit = desktopPickObj();
  if (!hit) return;
  SFX.grab();
  desktopPulling = hit.obj;
  hit.obj.grabbedBy = 'desktop';
  setBodyKinematic(hit.obj.body, true);
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (renderer.xr.isPresenting || e.button !== 0) return;
  const held = desktopHolding || desktopPulling;
  if (!held) return;
  SFX.release();

  if (held.mesh.parent === camera) scene.attach(held.mesh);

  // ensure in stage
  const wp = new THREE.Vector3();
  const wq = new THREE.Quaternion();
  held.mesh.getWorldPosition(wp);
  held.mesh.getWorldQuaternion(wq);
  if (held.mesh.parent !== stage) {
    if (held.mesh.parent) held.mesh.parent.remove(held.mesh);
    stage.add(held.mesh);
  }
  const local = stage.worldToLocal(wp.clone());
  held.mesh.position.copy(local);
  held.mesh.quaternion.copy(wq);
  held.body.position.set(local.x, local.y, local.z);
  held.body.quaternion.set(wq.x, wq.y, wq.z, wq.w);
  setBodyKinematic(held.body, false);

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  held.body.velocity.set(dir.x * 3, dir.y * 3 + 1, dir.z * 3);
  held.grabbedBy = null;
  desktopHolding = null;
  desktopPulling = null;
});

function updateDesktop(dt) {
  if (renderer.xr.isPresenting) return;

  if (hoveredButton) {
    hoveredButton.material.emissiveIntensity = 0.25;
    hoveredButton = null;
  }
  const btn = desktopPickMenu();
  if (btn) {
    hoveredButton = btn;
    btn.material.emissiveIntensity = 0.55;
  }

  if (!desktopHolding && !desktopPulling) {
    const hit = desktopPickObj();
    if (hit) {
      if (highlightedObj !== hit.obj) {
        highlightedObj = hit.obj;
        showOutline(hit.obj);
      }
      ring.visible = true;
      const s = (hit.obj.size || 0.35) * 1.15 + 0.15;
      ring.scale.setScalar(s / 0.25);
      hit.obj.mesh.getWorldPosition(ring.position);
      ring.lookAt(camera.position);
    } else {
      if (highlightedObj) { highlightedObj = null; clearOutline(); }
      ring.visible = false;
    }
  }

  if (desktopPulling && !desktopHolding) {
    const obj = desktopPulling;
    const target = new THREE.Vector3();
    camera.getWorldPosition(target);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    target.addScaledVector(dir, 1.0);
    // work in world, then write stage local
    const wp = new THREE.Vector3();
    obj.mesh.getWorldPosition(wp);
    const to = target.sub(wp);
    const dist = to.length();
    if (dist < 0.25) {
      camera.attach(obj.mesh);
      obj.mesh.position.set(obj.kind === 'gun' ? 0.3 : 0.25, -0.15, -0.55);
      obj.mesh.rotation.set(0, 0, 0);
      desktopHolding = obj;
      desktopPulling = null;
    } else {
      to.normalize().multiplyScalar(Math.min(dist, PULL_SPEED * dt));
      wp.add(to);
      const loc = stage.worldToLocal(wp.clone());
      if (obj.mesh.parent !== stage) {
        scene.attach(obj.mesh);
        stage.attach(obj.mesh);
      }
      obj.mesh.position.copy(loc);
      obj.body.position.set(loc.x, loc.y, loc.z);
    }
  }

  if (desktopHolding) {
    const obj = desktopHolding;
    const wp = new THREE.Vector3();
    const wq = new THREE.Quaternion();
    obj.mesh.getWorldPosition(wp);
    obj.mesh.getWorldQuaternion(wq);
    const loc = stage.worldToLocal(wp.clone());
    obj.body.position.set(loc.x, loc.y, loc.z);
    obj.body.quaternion.set(wq.x, wq.y, wq.z, wq.w);
  }

  const speed = MOVE_SPEED * dt;
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0; forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  if (keys['KeyW']) camera.position.addScaledVector(forward, speed);
  if (keys['KeyS']) camera.position.addScaledVector(forward, -speed);
  if (keys['KeyA']) camera.position.addScaledVector(right, -speed);
  if (keys['KeyD']) camera.position.addScaledVector(right, speed);
  if (keys['KeyQ'] || keys['Space']) camera.position.y += speed;
  if (keys['KeyE'] || keys['ControlLeft']) camera.position.y -= speed;
  camera.position.y = Math.max(0.4, Math.min(5, camera.position.y));
}

// ─── loop ───────────────────────────────────────────────────
const clock = new THREE.Clock();

function cleanupBalls(dt) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (o.kind !== 'ball') continue;
    o.life -= dt;
    if (o.life <= 0 || o.body.position.y < -5) {
      if (o.trail && o.trail.mesh) {
        scene.remove(o.trail.mesh);
        o.trail.mesh.geometry.dispose();
      }
      world.removeBody(o.body);
      stage.remove(o.mesh);
      objects.splice(i, 1);
    }
  }
}

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  world.step(1 / 60, dt, 3);

  for (const o of objects) {
    if (o.grabbedBy) continue;
    syncMeshToBody(o.mesh, o.body);
  }

  if (renderer.xr.isPresenting) {
    pollGamepads(dt);
    for (const c of controllers) updateGrab(c, dt);
    updateHighlight();
    updateLocomotion(dt);
  } else {
    updateDesktop(dt);
  }

  updateTrails(dt);
  cleanupBalls(dt);
  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
