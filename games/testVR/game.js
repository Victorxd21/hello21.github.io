/**
 * testVR — physics playground
 * Grip = grab · Trigger = shoot / menu · Thumbstick = move · Spawn menu
 */
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import * as CANNON from 'cannon-es';

const statusEl = document.getElementById('status');
const btnEnter = document.getElementById('btnEnter');
const desktopNote = document.getElementById('desktopNote');

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

// Player rig: we move this for locomotion (world stays, rig shifts)
const rig = new THREE.Group();
rig.add(camera);
scene.add(rig);

// ─── lights ─────────────────────────────────────────────────
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
  new THREE.CircleGeometry(20, 64),
  new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9, metalness: 0.05 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
scene.add(new THREE.GridHelper(24, 24, 0x6366f1, 0x312e81).translateY(0.01));

// ─── objects ────────────────────────────────────────────────
const objects = [];
const menuButtons = []; // { mesh, action }
const GRAB_RANGE = 9;
const PULL_SPEED = 14;
const MOVE_SPEED = 3.2;
const cubeColors = [0xef4444, 0x22c55e, 0x3b82f6, 0xf59e0b, 0xa855f7, 0xec4899, 0x14b8a6, 0xf97316];

function syncMeshToBody(mesh, body) {
  mesh.position.copy(body.position);
  mesh.quaternion.copy(body.quaternion);
}

function setBodyKinematic(body, on) {
  if (on) {
    body.type = CANNON.Body.KINEMATIC;
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
  } else {
    body.type = CANNON.Body.DYNAMIC;
    body.wakeUp();
  }
}

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
  scene.add(mesh);

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
  scene.add(mesh);

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

// initial cubes
for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2;
  const r = 1.5 + Math.random() * 2;
  addCube(Math.cos(a) * r, 0.5 + Math.random() * 1.5, Math.sin(a) * r - 0.3,
    0.28 + Math.random() * 0.16, cubeColors[i % cubeColors.length]);
}
for (let i = 0; i < 4; i++) {
  addCube(-1.5, 0.2 + i * 0.36, -1.2, 0.34, cubeColors[i % cubeColors.length]);
}

// ─── gun ────────────────────────────────────────────────────
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
  scene.add(mesh);
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

// ─── balls ──────────────────────────────────────────────────
const ballGeo = new THREE.SphereGeometry(0.07, 14, 14);
const ballMat = new THREE.MeshStandardMaterial({
  color: 0xf8fafc, emissive: 0x38bdf8, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.15
});

function shootBall(origin, direction, speed = 14) {
  const mesh = new THREE.Mesh(ballGeo, ballMat.clone());
  mesh.castShadow = true;
  mesh.position.copy(origin);
  scene.add(mesh);
  const body = new CANNON.Body({
    mass: 0.35,
    shape: new CANNON.Sphere(0.07),
    position: new CANNON.Vec3(origin.x, origin.y, origin.z),
    linearDamping: 0.05, angularDamping: 0.1
  });
  const dir = direction.clone().normalize().multiplyScalar(speed);
  body.velocity.set(dir.x, dir.y, dir.z);
  world.addBody(body);
  const obj = { mesh, body, kind: 'ball', grabbedBy: null, life: 8, size: 0.14 };
  mesh.userData.obj = obj;
  objects.push(obj);
}

// ─── spawn helpers (menu actions) ───────────────────────────
function spawnInFront(kind) {
  // spawn a few meters in front of player head
  const origin = new THREE.Vector3();
  const look = new THREE.Vector3();
  if (renderer.xr.isPresenting) {
    const xrCam = renderer.xr.getCamera();
    xrCam.getWorldPosition(origin);
    xrCam.getWorldDirection(look);
  } else {
    camera.getWorldPosition(origin);
    camera.getWorldDirection(look);
  }
  const pos = origin.clone().addScaledVector(look, 2.2);
  pos.y = Math.max(0.5, pos.y);

  if (kind === 'cube') {
    const c = cubeColors[(Math.random() * cubeColors.length) | 0];
    const s = 0.28 + Math.random() * 0.2;
    addCube(pos.x + (Math.random() - 0.5) * 0.3, pos.y, pos.z + (Math.random() - 0.5) * 0.3, s, c);
  } else if (kind === 'sphere') {
    addSphere(pos.x, pos.y, pos.z, 0.18 + Math.random() * 0.12, cubeColors[(Math.random() * cubeColors.length) | 0]);
  } else if (kind === 'stack') {
    for (let i = 0; i < 5; i++) {
      addCube(pos.x, 0.2 + i * 0.38, pos.z, 0.34, cubeColors[i % cubeColors.length]);
    }
  } else if (kind === 'rain') {
    for (let i = 0; i < 8; i++) {
      addCube(
        pos.x + (Math.random() - 0.5) * 2,
        2.5 + Math.random() * 2,
        pos.z + (Math.random() - 0.5) * 2,
        0.25 + Math.random() * 0.15,
        cubeColors[i % cubeColors.length]
      );
    }
  }
}

function clearToys() {
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (o.kind === 'gun') continue;
    if (o.grabbedBy) continue;
    world.removeBody(o.body);
    scene.remove(o.mesh);
    objects.splice(i, 1);
  }
}

// ─── in-world menu panel ────────────────────────────────────
const menuGroup = new THREE.Group();
menuGroup.position.set(-2.2, 1.4, 0.5);
scene.add(menuGroup);

// panel background
const panel = new THREE.Mesh(
  new THREE.PlaneGeometry(1.1, 1.35),
  new THREE.MeshStandardMaterial({
    color: 0x0f172a, roughness: 0.6, metalness: 0.2,
    transparent: true, opacity: 0.92, side: THREE.DoubleSide
  })
);
panel.position.z = -0.02;
menuGroup.add(panel);

// title
function makeLabel(text, y, size = 0.08, color = 0xe2e8f0) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size * 8, size * 2), mat);
  mesh.position.set(0, y, 0.01);
  menuGroup.add(mesh);
  return mesh;
}
makeLabel('PLAYGROUND', 0.55, 0.07);

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

  // text on button
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 256, 48);
  const tex = new THREE.CanvasTexture(canvas);
  const textMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.92, h * 0.75),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
  );
  textMesh.position.set(0, y, 0.03);
  menuGroup.add(textMesh);

  mesh.userData.isMenuButton = true;
  mesh.userData.action = action;
  mesh.userData.baseColor = color;
  menuButtons.push(mesh);
  return mesh;
}

makeButton('+ Cube', 0.32, () => spawnInFront('cube'), 0x4f46e5);
makeButton('+ Sphere', 0.12, () => spawnInFront('sphere'), 0x7c3aed);
makeButton('+ Stack', -0.08, () => spawnInFront('stack'), 0x2563eb);
makeButton('Cube Rain', -0.28, () => spawnInFront('rain'), 0x0891b2);
makeButton('Clear toys', -0.48, () => clearToys(), 0xb91c1c);

// ─── blue grab ring ─────────────────────────────────────────
const ringMat = new THREE.MeshBasicMaterial({
  color: 0x38bdf8, transparent: true, opacity: 0.9,
  side: THREE.DoubleSide, depthWrite: false
});
const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.28, 32), ringMat);
ring.visible = false;
ring.renderOrder = 10;
scene.add(ring);
ring.add(new THREE.Mesh(
  new THREE.RingGeometry(0.08, 0.1, 24),
  new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
));

// menu hover highlight
let hoveredButton = null;

// ─── controllers ────────────────────────────────────────────
const controllerModelFactory = new XRControllerModelFactory();
const tempMatrix = new THREE.Matrix4();
const raycaster = new THREE.Raycaster();
raycaster.far = GRAB_RANGE;

function setupController(index) {
  const controller = renderer.xr.getController(index);
  rig.add(controller); // move with player rig

  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.65 })
  );
  line.scale.z = GRAB_RANGE;
  controller.add(line);

  const gripCtrl = renderer.xr.getControllerGrip(index);
  gripCtrl.add(controllerModelFactory.createControllerModel(gripCtrl));
  rig.add(gripCtrl);

  controller.userData = {
    index,
    ray: line,
    holding: null,
    pulling: null,
    gripHeld: false,
    prevPos: new THREE.Vector3(),
    velocity: new THREE.Vector3()
  };

  // SIDE button (grip) = grab
  controller.addEventListener('squeezestart', () => onGripStart(controller));
  controller.addEventListener('squeezeend', () => onGripEnd(controller));
  // FRONT trigger = shoot / menu
  controller.addEventListener('selectstart', () => onTriggerStart(controller));

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
  let o = object.userData.obj;
  if (o) return o;
  let p = object.parent;
  while (p) {
    if (p.userData.obj) return p.userData.obj;
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
  if (hits.length) return hits[0].object;
  return null;
}

// Grip (side) = start grab
function onGripStart(controller) {
  const ud = controller.userData;
  ud.gripHeld = true;
  if (ud.holding || ud.pulling) return;
  const hit = pickObject(controller);
  if (!hit) return;
  ud.pulling = hit.obj;
  hit.obj.grabbedBy = controller;
  setBodyKinematic(hit.obj.body, true);
}

function onGripEnd(controller) {
  const ud = controller.userData;
  ud.gripHeld = false;
  const held = ud.holding || ud.pulling;
  if (!held) return;

  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  held.mesh.getWorldPosition(worldPos);
  held.mesh.getWorldQuaternion(worldQuat);

  if (held.mesh.parent === controller) scene.attach(held.mesh);

  held.body.position.set(worldPos.x, worldPos.y, worldPos.z);
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

// Trigger (front) = shoot gun OR click menu
function onTriggerStart(controller) {
  const ud = controller.userData;

  // menu click
  const btn = pickMenuButton(controller);
  if (btn && btn.userData.action) {
    btn.userData.action();
    // flash
    const mat = btn.material;
    const prev = mat.emissiveIntensity;
    mat.emissiveIntensity = 0.9;
    setTimeout(() => { mat.emissiveIntensity = prev; }, 120);
    return;
  }

  // shoot if holding gun
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
    const cur = new THREE.Vector3().copy(obj.mesh.position);
    // when not parented yet, mesh follows body or we set directly
    const to = target.clone().sub(cur);
    const dist = to.length();
    if (dist < 0.18) {
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
      cur.add(to);
      obj.mesh.position.copy(cur);
      obj.body.position.set(cur.x, cur.y, cur.z);
    }
  }

  if (ud.holding) {
    const obj = ud.holding;
    const wp = new THREE.Vector3();
    const wq = new THREE.Quaternion();
    obj.mesh.getWorldPosition(wp);
    obj.mesh.getWorldQuaternion(wq);
    obj.body.position.set(wp.x, wp.y, wp.z);
    obj.body.quaternion.set(wq.x, wq.y, wq.z, wq.w);
    obj.body.velocity.set(0, 0, 0);
    obj.body.angularVelocity.set(0, 0, 0);
  }
}

function updateHighlight() {
  // reset menu hover
  if (hoveredButton) {
    hoveredButton.material.emissiveIntensity = 0.25;
    hoveredButton = null;
  }

  let best = null;
  let bestBtn = null;

  for (const c of controllers) {
    if (!renderer.xr.isPresenting) continue;
    const btn = pickMenuButton(c);
    if (btn) bestBtn = btn;

    if (c.userData.holding || c.userData.pulling) continue;
    const hit = pickObject(c);
    if (hit && (!best || hit.distance < best.distance)) best = hit;
  }

  if (bestBtn) {
    hoveredButton = bestBtn;
    bestBtn.material.emissiveIntensity = 0.55;
  }

  if (best) {
    ring.visible = true;
    const s = (best.obj.size || 0.35) * 1.15 + 0.15;
    ring.scale.setScalar(s / 0.25);
    ring.position.copy(best.obj.mesh.position);
    ring.lookAt(camera.position);
    ringMat.opacity = 0.75 + Math.sin(performance.now() * 0.008) * 0.15;
  } else {
    ring.visible = false;
  }
}

// ─── thumbstick locomotion ──────────────────────────────────
function getThumbstick() {
  const session = renderer.xr.getSession();
  if (!session) return null;
  let x = 0, y = 0;
  for (const src of session.inputSources) {
    if (!src.gamepad || !src.gamepad.axes) continue;
    const axes = src.gamepad.axes;
    // Common layouts: axes[2],axes[3] = right stick / main stick on Quest
    let ax = 0, ay = 0;
    if (axes.length >= 4) {
      ax = axes[2]; ay = axes[3];
    } else if (axes.length >= 2) {
      ax = axes[0]; ay = axes[1];
    }
    if (Math.abs(ax) > Math.abs(x)) x = ax;
    if (Math.abs(ay) > Math.abs(y)) y = ay;
  }
  if (Math.abs(x) < 0.15) x = 0;
  if (Math.abs(y) < 0.15) y = 0;
  if (!x && !y) return null;
  return { x, y };
}

function updateLocomotion(dt) {
  if (!renderer.xr.isPresenting) return;
  const stick = getThumbstick();
  if (!stick) return;

  const xrCam = renderer.xr.getCamera();
  const forward = new THREE.Vector3();
  xrCam.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 0.001) return;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

  // stick.y: forward/back (often inverted on Quest: -y = forward)
  const move = new THREE.Vector3();
  move.addScaledVector(forward, -stick.y * MOVE_SPEED * dt);
  move.addScaledVector(right, stick.x * MOVE_SPEED * dt);
  rig.position.add(move);
}

// ─── WebXR ──────────────────────────────────────────────────
async function checkXR() {
  if (!navigator.xr) {
    statusEl.innerHTML = '<strong>WebXR not available</strong>';
    btnEnter.disabled = true;
    btnEnter.textContent = 'VR not supported';
    return;
  }
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
}
checkXR();

btnEnter.addEventListener('click', async () => {
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
        if (c.userData.holding || c.userData.pulling) onGripEnd(c);
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
  if (e.code === 'KeyG') spawnInFront('cube');
  if (e.code === 'KeyB') spawnInFront('sphere');
  if (e.code === 'KeyR') spawnInFront('rain');
  if (e.code === 'KeyX') clearToys();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

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

  const btn = desktopPickMenu();
  if (btn && btn.userData.action) {
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
  desktopPulling = hit.obj;
  hit.obj.grabbedBy = 'desktop';
  setBodyKinematic(hit.obj.body, true);
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (renderer.xr.isPresenting || e.button !== 0) return;
  const held = desktopHolding || desktopPulling;
  if (!held) return;
  if (held.mesh.parent === camera) scene.attach(held.mesh);
  const wp = new THREE.Vector3();
  const wq = new THREE.Quaternion();
  held.mesh.getWorldPosition(wp);
  held.mesh.getWorldQuaternion(wq);
  held.body.position.set(wp.x, wp.y, wp.z);
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

  // highlight
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
      ring.visible = true;
      const s = (hit.obj.size || 0.35) * 1.15 + 0.15;
      ring.scale.setScalar(s / 0.25);
      ring.position.copy(hit.obj.mesh.position);
      ring.lookAt(camera.position);
    } else ring.visible = false;
  }

  if (desktopPulling && !desktopHolding) {
    const obj = desktopPulling;
    const target = new THREE.Vector3();
    camera.getWorldPosition(target);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    target.addScaledVector(dir, 1.0);
    const cur = obj.mesh.position.clone();
    const to = target.sub(cur);
    const dist = to.length();
    if (dist < 0.25) {
      camera.attach(obj.mesh);
      obj.mesh.position.set(obj.kind === 'gun' ? 0.3 : 0.25, -0.15, -0.55);
      obj.mesh.rotation.set(0, 0, 0);
      desktopHolding = obj;
      desktopPulling = null;
    } else {
      to.normalize().multiplyScalar(Math.min(dist, PULL_SPEED * dt));
      obj.mesh.position.add(to);
      obj.body.position.copy(obj.mesh.position);
    }
  }

  if (desktopHolding) {
    const obj = desktopHolding;
    const wp = new THREE.Vector3();
    const wq = new THREE.Quaternion();
    obj.mesh.getWorldPosition(wp);
    obj.mesh.getWorldQuaternion(wq);
    obj.body.position.set(wp.x, wp.y, wp.z);
    obj.body.quaternion.set(wq.x, wq.y, wq.z, wq.w);
  }

  const speed = MOVE_SPEED * dt;
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0; forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  if (keys['KeyW']) rig.position.addScaledVector(forward, speed);
  if (keys['KeyS']) rig.position.addScaledVector(forward, -speed);
  if (keys['KeyA']) rig.position.addScaledVector(right, -speed);
  if (keys['KeyD']) rig.position.addScaledVector(right, speed);
  if (keys['KeyQ'] || keys['Space']) rig.position.y += speed;
  if (keys['KeyE'] || keys['ControlLeft']) rig.position.y -= speed;
  rig.position.y = Math.max(0, Math.min(4, rig.position.y));
}

// ─── loop ───────────────────────────────────────────────────
const clock = new THREE.Clock();

function cleanupBalls(dt) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (o.kind !== 'ball') continue;
    o.life -= dt;
    if (o.life <= 0 || o.body.position.y < -5) {
      world.removeBody(o.body);
      scene.remove(o.mesh);
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
    for (const c of controllers) updateGrab(c, dt);
    updateHighlight();
    updateLocomotion(dt);
  } else {
    updateDesktop(dt);
  }

  cleanupBalls(dt);
  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
