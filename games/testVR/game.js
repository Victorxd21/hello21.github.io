/**
 * testVR — physics playground
 * Rigid-body cubes + distance grab (blue ring) + grabbable gun
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
scene.fog = new THREE.Fog(0x0b1020, 14, 50);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(0, 1.6, 3.5);

// ─── lights ─────────────────────────────────────────────────
scene.add(new THREE.HemisphereLight(0xa5b4fc, 0x1e1b4b, 0.75));
const dir = new THREE.DirectionalLight(0xffffff, 1.05);
dir.position.set(5, 12, 6);
dir.castShadow = true;
dir.shadow.mapSize.set(1024, 1024);
dir.shadow.camera.near = 0.5;
dir.shadow.camera.far = 35;
dir.shadow.camera.left = dir.shadow.camera.bottom = -12;
dir.shadow.camera.right = dir.shadow.camera.top = 12;
scene.add(dir);

// ─── physics world ──────────────────────────────────────────
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.2, 0) });
world.broadphase = new CANNON.NaiveBroadphase();
world.allowSleep = true;
world.defaultContactMaterial.friction = 0.45;
world.defaultContactMaterial.restitution = 0.25;

const groundBody = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Plane()
});
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// ─── floor visual ───────────────────────────────────────────
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(16, 64),
  new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9, metalness: 0.05 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
scene.add(new THREE.GridHelper(20, 20, 0x6366f1, 0x312e81).translateY(0.01));

// ─── shared helpers ─────────────────────────────────────────
const objects = []; // { mesh, body, kind: 'cube'|'gun'|'ball', grabbedBy }
const GRAB_RANGE = 8;
const PULL_SPEED = 14;

function syncMeshToBody(mesh, body) {
  mesh.position.copy(body.position);
  mesh.quaternion.copy(body.quaternion);
}

function setBodyKinematic(body, on) {
  if (on) {
    body.type = CANNON.Body.KINEMATIC;
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.sleep();
  } else {
    body.type = CANNON.Body.DYNAMIC;
    body.wakeUp();
  }
}

// ─── cubes ──────────────────────────────────────────────────
const cubeColors = [0xef4444, 0x22c55e, 0x3b82f6, 0xf59e0b, 0xa855f7, 0xec4899, 0x14b8a6, 0xf97316];

function addCube(x, y, z, size = 0.35, color = 0xef4444) {
  const half = size / 2;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.35,
      metalness: 0.2,
      emissive: color,
      emissiveIntensity: 0.12
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

// scatter cubes
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
  const r = 1.4 + Math.random() * 2.2;
  addCube(
    Math.cos(a) * r,
    0.4 + Math.random() * 1.8,
    Math.sin(a) * r - 0.5,
    0.28 + Math.random() * 0.18,
    cubeColors[i % cubeColors.length]
  );
}
// small stack
for (let i = 0; i < 4; i++) {
  addCube(-1.5, 0.2 + i * 0.36, -1.2, 0.34, cubeColors[i % cubeColors.length]);
}

// ─── gun ────────────────────────────────────────────────────
function createGunMesh() {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.35 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.4, roughness: 0.3, emissive: 0x0ea5e9, emissiveIntensity: 0.25 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.28), dark);
  body.position.set(0, 0, 0);
  body.castShadow = true;
  g.add(body);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.32, 12), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.28);
  barrel.castShadow = true;
  g.add(barrel);

  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.04, 12), accent);
  tip.rotation.x = Math.PI / 2;
  tip.position.set(0, 0.02, -0.44);
  g.add(tip);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.08), dark);
  grip.position.set(0, -0.1, 0.06);
  grip.rotation.x = 0.25;
  grip.castShadow = true;
  g.add(grip);

  // muzzle flash point
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, -0.48);
  g.add(muzzle);
  g.userData.muzzle = muzzle;

  return g;
}

function addGun(x, y, z) {
  const mesh = createGunMesh();
  mesh.position.set(x, y, z);
  scene.add(mesh);

  // approximate box for physics
  const body = new CANNON.Body({
    mass: 1.5,
    shape: new CANNON.Box(new CANNON.Vec3(0.06, 0.1, 0.22)),
    position: new CANNON.Vec3(x, y, z),
    linearDamping: 0.2,
    angularDamping: 0.35
  });
  world.addBody(body);

  const obj = { mesh, body, kind: 'gun', grabbedBy: null };
  mesh.userData.obj = obj;
  // also mark children for raycast convenience
  mesh.traverse((c) => { c.userData.obj = obj; });
  objects.push(obj);
  return obj;
}

const gun = addGun(0.8, 1.1, 1.2);

// ─── balls ──────────────────────────────────────────────────
const ballGeo = new THREE.SphereGeometry(0.07, 14, 14);
const ballMat = new THREE.MeshStandardMaterial({
  color: 0xf8fafc,
  emissive: 0x38bdf8,
  emissiveIntensity: 0.55,
  roughness: 0.25,
  metalness: 0.15
});

function shootBall(origin, direction, speed = 12) {
  const mesh = new THREE.Mesh(ballGeo, ballMat.clone());
  mesh.castShadow = true;
  mesh.position.copy(origin);
  scene.add(mesh);

  const body = new CANNON.Body({
    mass: 0.35,
    shape: new CANNON.Sphere(0.07),
    position: new CANNON.Vec3(origin.x, origin.y, origin.z),
    linearDamping: 0.05,
    angularDamping: 0.1
  });
  const dir = direction.clone().normalize().multiplyScalar(speed);
  body.velocity.set(dir.x, dir.y, dir.z);
  world.addBody(body);

  const obj = { mesh, body, kind: 'ball', grabbedBy: null, life: 8 };
  mesh.userData.obj = obj;
  objects.push(obj);
  return obj;
}

// ─── blue grab highlight ring ───────────────────────────────
const ringMat = new THREE.MeshBasicMaterial({
  color: 0x38bdf8,
  transparent: true,
  opacity: 0.9,
  side: THREE.DoubleSide,
  depthWrite: false
});
const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.28, 32), ringMat);
ring.visible = false;
ring.renderOrder = 10;
scene.add(ring);

const ringInner = new THREE.Mesh(
  new THREE.RingGeometry(0.08, 0.1, 24),
  new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
);
ring.add(ringInner);

// ─── controllers ────────────────────────────────────────────
const controllerModelFactory = new XRControllerModelFactory();
const tempMatrix = new THREE.Matrix4();
const raycaster = new THREE.Raycaster();
raycaster.far = GRAB_RANGE;

function setupController(index) {
  const controller = renderer.xr.getController(index);
  scene.add(controller);

  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1)
  ]);
  const line = new THREE.Line(
    lineGeo,
    new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.65 })
  );
  line.scale.z = GRAB_RANGE;
  line.name = 'ray';
  controller.add(line);

  const grip = renderer.xr.getControllerGrip(index);
  grip.add(controllerModelFactory.createControllerModel(grip));
  scene.add(grip);

  controller.userData = {
    index,
    ray: line,
    holding: null,      // obj being held
    pulling: null,      // obj being distance-pulled
    selectHeld: false,
    prevPos: new THREE.Vector3(),
    velocity: new THREE.Vector3()
  };

  controller.addEventListener('selectstart', () => onSelectStart(controller));
  controller.addEventListener('selectend', () => onSelectEnd(controller));

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

function pickObject(controller) {
  const rc = getControllerRay(controller);
  // raycast against all object meshes
  const meshes = objects.filter((o) => o.kind !== 'ball' || true).map((o) => o.mesh);
  const hits = rc.intersectObjects(meshes, true);
  for (const h of hits) {
    let o = h.object.userData.obj;
    if (!o) {
      // climb parent
      let p = h.object.parent;
      while (p && !o) {
        o = p.userData.obj;
        p = p.parent;
      }
    }
    if (o && !o.grabbedBy) return { obj: o, point: h.point, distance: h.distance };
  }
  return null;
}

function onSelectStart(controller) {
  const ud = controller.userData;
  ud.selectHeld = true;

  // If already holding the gun → shoot
  if (ud.holding && ud.holding.kind === 'gun') {
    fireGun(ud.holding, controller);
    return;
  }

  // If already holding something else → ignore extra select
  if (ud.holding) return;

  const hit = pickObject(controller);
  if (!hit) return;

  // Start distance grab / pull
  ud.pulling = hit.obj;
  hit.obj.grabbedBy = controller;
  setBodyKinematic(hit.obj.body, true);
}

function onSelectEnd(controller) {
  const ud = controller.userData;
  ud.selectHeld = false;

  const held = ud.holding || ud.pulling;
  if (!held) return;

  // Release into world with controller velocity
  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  held.mesh.getWorldPosition(worldPos);
  held.mesh.getWorldQuaternion(worldQuat);

  // detach from controller if parented
  if (held.mesh.parent === controller) {
    scene.attach(held.mesh);
  }

  held.body.position.set(worldPos.x, worldPos.y, worldPos.z);
  held.body.quaternion.set(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w);
  setBodyKinematic(held.body, false);

  // throw velocity from controller motion
  const v = ud.velocity.clone().multiplyScalar(1.15);
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

function fireGun(gunObj, controller) {
  const muzzle = gunObj.mesh.userData.muzzle;
  const origin = new THREE.Vector3();
  muzzle.getWorldPosition(origin);

  // forward = gun -Z in world
  const dir = new THREE.Vector3(0, 0, -1);
  dir.applyQuaternion(gunObj.mesh.getWorldQuaternion(new THREE.Quaternion()));
  // slight randomness
  dir.x += (Math.random() - 0.5) * 0.03;
  dir.y += (Math.random() - 0.5) * 0.03;
  dir.normalize();

  shootBall(origin, dir, 14);

  // tiny recoil on gun if free (usually held kinematic)
  if (gunObj.body.type === CANNON.Body.DYNAMIC) {
    gunObj.body.velocity.x -= dir.x * 0.8;
    gunObj.body.velocity.y -= dir.y * 0.8;
    gunObj.body.velocity.z -= dir.z * 0.8;
  }
}

// ─── attach object firmly to controller once close enough ───
function updateGrab(controller, dt) {
  const ud = controller.userData;

  // track velocity for throws
  const pos = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
  if (ud.prevPos.lengthSq() > 0) {
    ud.velocity.copy(pos).sub(ud.prevPos).multiplyScalar(1 / Math.max(dt, 0.001));
  }
  ud.prevPos.copy(pos);

  // distance pull → snap to hand
  if (ud.pulling && !ud.holding) {
    const obj = ud.pulling;
    const target = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    // offset slightly in front of hand
    const forward = new THREE.Vector3(0, 0, -0.25).applyQuaternion(controller.quaternion);
    target.add(forward);

    const cur = obj.mesh.position;
    const to = target.clone().sub(cur);
    const dist = to.length();

    if (dist < 0.18) {
      // attach
      controller.attach(obj.mesh);
      obj.mesh.position.set(0, 0, -0.2);
      if (obj.kind === 'gun') {
        obj.mesh.rotation.set(0, 0, 0);
        obj.mesh.position.set(0, -0.02, -0.15);
      } else {
        obj.mesh.rotation.set(0, 0, 0);
      }
      ud.holding = obj;
      ud.pulling = null;
    } else {
      // pull toward hand
      to.normalize().multiplyScalar(Math.min(dist, PULL_SPEED * dt));
      cur.add(to);
      obj.body.position.set(cur.x, cur.y, cur.z);
      // face roughly toward hand while pulling
      obj.mesh.lookAt(target);
      obj.body.quaternion.copy(obj.mesh.quaternion);
    }
  }

  // keep kinematic body under held mesh
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

// ─── highlight ──────────────────────────────────────────────
function updateHighlight() {
  let best = null;
  for (const c of controllers) {
    if (c.userData.holding || c.userData.pulling) continue;
    if (!c.visible && !renderer.xr.isPresenting) continue;
    const hit = pickObject(c);
    if (hit && (!best || hit.distance < best.distance)) best = hit;
  }

  // desktop ray from camera when not in VR
  if (!renderer.xr.isPresenting) {
    // use camera center ray for highlight when idle
  }

  if (best) {
    ring.visible = true;
    const s = (best.obj.size || 0.35) * 1.15 + 0.15;
    ring.scale.setScalar(s / 0.25);
    ring.position.copy(best.obj.mesh.position);
    // face camera-ish
    ring.lookAt(camera.position);
    ringMat.opacity = 0.75 + Math.sin(performance.now() * 0.008) * 0.15;
  } else {
    ring.visible = false;
  }
}

// ─── WebXR enter ────────────────────────────────────────────
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
    statusEl.innerHTML = '<strong>No VR headset</strong> — desktop playground';
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
    statusEl.innerHTML = '<strong>In VR</strong> — point + trigger grab · gun shoots';
    session.addEventListener('end', () => {
      btnEnter.classList.remove('hidden');
      desktopNote.style.display = '';
      // release anything held
      for (const c of controllers) {
        if (c.userData.holding || c.userData.pulling) onSelectEnd(c);
      }
      checkXR();
    });
  } catch (err) {
    statusEl.innerHTML = '<strong>Failed:</strong> ' + (err.message || err);
  }
});

// ─── desktop fallback ───────────────────────────────────────
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const keys = {};
let desktopHolding = null;
let desktopPulling = null;

window.addEventListener('keydown', (e) => { keys[e.code] = true; });
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

function desktopPick() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  raycaster.far = GRAB_RANGE;
  const meshes = objects.map((o) => o.mesh);
  const hits = raycaster.intersectObjects(meshes, true);
  for (const h of hits) {
    let o = h.object.userData.obj;
    if (!o) {
      let p = h.object.parent;
      while (p && !o) { o = p.userData.obj; p = p.parent; }
    }
    if (o && !o.grabbedBy) return { obj: o, point: h.point, distance: h.distance };
  }
  return null;
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (renderer.xr.isPresenting || e.button !== 0 || e.shiftKey) return;

  // holding gun → shoot
  if (desktopHolding && desktopHolding.kind === 'gun') {
    const muzzle = desktopHolding.mesh.userData.muzzle;
    const origin = new THREE.Vector3();
    muzzle.getWorldPosition(origin);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    shootBall(origin, dir, 14);
    return;
  }

  if (desktopHolding || desktopPulling) return;

  const hit = desktopPick();
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

function updateDesktopGrab(dt) {
  if (renderer.xr.isPresenting) return;

  // highlight via camera center
  if (!desktopHolding && !desktopPulling) {
    const hit = desktopPick();
    if (hit) {
      ring.visible = true;
      const s = (hit.obj.size || 0.35) * 1.15 + 0.15;
      ring.scale.setScalar(s / 0.25);
      ring.position.copy(hit.obj.mesh.position);
      ring.lookAt(camera.position);
      ringMat.opacity = 0.75 + Math.sin(performance.now() * 0.008) * 0.15;
    } else {
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

    const cur = obj.mesh.position;
    const to = target.clone().sub(cur);
    const dist = to.length();
    if (dist < 0.25) {
      camera.attach(obj.mesh);
      obj.mesh.position.set(0.25, -0.15, -0.6);
      obj.mesh.rotation.set(0, 0, 0);
      if (obj.kind === 'gun') obj.mesh.position.set(0.3, -0.2, -0.5);
      desktopHolding = obj;
      desktopPulling = null;
    } else {
      to.normalize().multiplyScalar(Math.min(dist, PULL_SPEED * dt));
      cur.add(to);
      obj.body.position.set(cur.x, cur.y, cur.z);
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

  // WASD
  const speed = 2.8 * dt;
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  if (keys['KeyW']) camera.position.addScaledVector(forward, speed);
  if (keys['KeyS']) camera.position.addScaledVector(forward, -speed);
  if (keys['KeyA']) camera.position.addScaledVector(right, -speed);
  if (keys['KeyD']) camera.position.addScaledVector(right, speed);
  if (keys['KeyQ'] || keys['Space']) camera.position.y += speed;
  if (keys['KeyE'] || keys['ControlLeft']) camera.position.y -= speed;
  camera.position.y = Math.max(0.5, Math.min(5, camera.position.y));
}

// ─── main loop ──────────────────────────────────────────────
const clock = new THREE.Clock();

function cleanupBalls(dt) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (o.kind !== 'ball') continue;
    o.life -= dt;
    if (o.life <= 0 || o.body.position.y < -5 || o.body.position.length() > 40) {
      world.removeBody(o.body);
      scene.remove(o.mesh);
      objects.splice(i, 1);
    }
  }
}

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);

  world.step(1 / 60, dt, 3);

  // sync free bodies → meshes
  for (const o of objects) {
    if (o.grabbedBy) continue;
    syncMeshToBody(o.mesh, o.body);
  }

  if (renderer.xr.isPresenting) {
    for (const c of controllers) updateGrab(c, dt);
    updateHighlight();
  } else {
    updateDesktopGrab(dt);
  }

  cleanupBalls(dt);
  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
