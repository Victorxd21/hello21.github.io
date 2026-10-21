/**
 * testVR — minimal WebXR playground
 * - Immersive VR with controllers + laser pointers
 * - Trigger / click shoots a ball
 * - Grip grabs nearby cubes (when in VR)
 * - Desktop fallback: drag look + click shoot
 */
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

const statusEl = document.getElementById('status');
const btnEnter = document.getElementById('btnEnter');
const desktopNote = document.getElementById('desktopNote');

// ─── renderer / scene ───────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1020);
scene.fog = new THREE.Fog(0x0b1020, 12, 45);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(0, 1.6, 3);

// ─── lights ─────────────────────────────────────────────────
const hemi = new THREE.HemisphereLight(0xa5b4fc, 0x1e1b4b, 0.7);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 1.1);
dir.position.set(4, 10, 6);
dir.castShadow = true;
dir.shadow.mapSize.set(1024, 1024);
dir.shadow.camera.near = 0.5;
dir.shadow.camera.far = 30;
dir.shadow.camera.left = -10;
dir.shadow.camera.right = 10;
dir.shadow.camera.top = 10;
dir.shadow.camera.bottom = -10;
scene.add(dir);

// ─── floor ──────────────────────────────────────────────────
const floorGeo = new THREE.CircleGeometry(18, 64);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  roughness: 0.85,
  metalness: 0.1
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// grid helper for orientation
const grid = new THREE.GridHelper(20, 20, 0x6366f1, 0x312e81);
grid.position.y = 0.01;
scene.add(grid);

// ─── floating cubes (grabbable targets) ─────────────────────
const cubes = [];
const cubeColors = [0xef4444, 0x22c55e, 0x3b82f6, 0xf59e0b, 0xa855f7, 0xec4899];

function makeCube(x, y, z, color) {
  const geo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.25,
    emissive: color,
    emissiveIntensity: 0.15
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    isCube: true,
    grabbed: false,
    velocity: new THREE.Vector3(),
    angular: new THREE.Vector3(
      (Math.random() - 0.5) * 0.02,
      (Math.random() - 0.5) * 0.02,
      (Math.random() - 0.5) * 0.02
    )
  };
  scene.add(mesh);
  cubes.push(mesh);
  return mesh;
}

for (let i = 0; i < 8; i++) {
  const angle = (i / 8) * Math.PI * 2;
  const r = 1.8 + Math.random() * 1.2;
  makeCube(
    Math.cos(angle) * r,
    0.9 + Math.random() * 1.4,
    Math.sin(angle) * r - 1,
    cubeColors[i % cubeColors.length]
  );
}

// ─── balls (projectiles) ────────────────────────────────────
const balls = [];
const ballGeo = new THREE.SphereGeometry(0.08, 16, 16);
const ballMat = new THREE.MeshStandardMaterial({
  color: 0xf8fafc,
  emissive: 0x38bdf8,
  emissiveIntensity: 0.6,
  roughness: 0.3
});

function shootBall(origin, direction, speed = 8) {
  const mesh = new THREE.Mesh(ballGeo, ballMat.clone());
  mesh.position.copy(origin);
  mesh.castShadow = true;
  mesh.userData = {
    velocity: direction.clone().normalize().multiplyScalar(speed),
    life: 4 // seconds
  };
  scene.add(mesh);
  balls.push(mesh);
}

// ─── XR controllers ─────────────────────────────────────────
const controllerModelFactory = new XRControllerModelFactory();

function setupController(index) {
  const controller = renderer.xr.getController(index);
  controller.addEventListener('selectstart', onSelectStart);
  controller.addEventListener('selectend', onSelectEnd);
  controller.addEventListener('squeezestart', onSqueezeStart);
  controller.addEventListener('squeezeend', onSqueezeEnd);
  scene.add(controller);

  // laser ray
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1)
  ]);
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.7 }));
  line.scale.z = 5;
  line.name = 'ray';
  controller.add(line);

  // grip / hand model
  const grip = renderer.xr.getControllerGrip(index);
  grip.add(controllerModelFactory.createControllerModel(grip));
  scene.add(grip);

  controller.userData = { index, grabbing: null, ray: line };
  return controller;
}

const controller0 = setupController(0);
const controller1 = setupController(1);

const tempMatrix = new THREE.Matrix4();
const raycaster = new THREE.Raycaster();

function getControllerRay(controller) {
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  return raycaster;
}

function onSelectStart(e) {
  const controller = e.target;
  // shoot from controller tip
  const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(controller.quaternion);
  shootBall(origin, dir, 9);
}

function onSelectEnd() {}

function onSqueezeStart(e) {
  const controller = e.target;
  const rc = getControllerRay(controller);
  const hits = rc.intersectObjects(cubes, false);
  if (hits.length && hits[0].distance < 3) {
    const cube = hits[0].object;
    if (!cube.userData.grabbed) {
      cube.userData.grabbed = true;
      cube.userData.velocity.set(0, 0, 0);
      controller.attach(cube);
      controller.userData.grabbing = cube;
    }
  }
}

function onSqueezeEnd(e) {
  const controller = e.target;
  const cube = controller.userData.grabbing;
  if (cube) {
    scene.attach(cube); // world space again
    // give a little throw based on controller motion (approx)
    const pos = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    const prev = controller.userData.prevPos || pos.clone();
    cube.userData.velocity.copy(pos).sub(prev).multiplyScalar(40);
    cube.userData.grabbed = false;
    controller.userData.grabbing = null;
  }
}

// track controller position for throw velocity
function updateControllerPrev() {
  for (const c of [controller0, controller1]) {
    const pos = new THREE.Vector3().setFromMatrixPosition(c.matrixWorld);
    c.userData.prevPos = pos;
  }
}

// ─── WebXR button / support check ───────────────────────────
async function checkXR() {
  if (!navigator.xr) {
    statusEl.innerHTML = '<strong>WebXR not available</strong> in this browser';
    btnEnter.disabled = true;
    btnEnter.textContent = 'VR not supported';
    return;
  }
  const supported = await navigator.xr.isSessionSupported('immersive-vr');
  if (supported) {
    statusEl.innerHTML = '<strong>WebXR ready</strong> — headset detected or available';
    btnEnter.disabled = false;
    btnEnter.textContent = 'Enter VR';
  } else {
    statusEl.innerHTML = '<strong>No immersive VR</strong> — use desktop mode';
    btnEnter.disabled = true;
    btnEnter.textContent = 'No VR headset';
  }
}
checkXR();

// Use Three's VRButton under the hood but style our own
btnEnter.addEventListener('click', async () => {
  if (renderer.xr.isPresenting) return;
  try {
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
    });
    await renderer.xr.setSession(session);
    btnEnter.classList.add('hidden');
    desktopNote.style.display = 'none';
    statusEl.innerHTML = '<strong>In VR</strong> — trigger to shoot · grip to grab';
    session.addEventListener('end', () => {
      btnEnter.classList.remove('hidden');
      desktopNote.style.display = '';
      statusEl.innerHTML = '<strong>VR ended</strong> — click Enter VR again';
      checkXR();
    });
  } catch (err) {
    statusEl.innerHTML = '<strong>Failed:</strong> ' + (err.message || err);
    console.error(err);
  }
});

// ─── desktop look / shoot fallback ──────────────────────────
let isPointerDown = false;
let prevX = 0, prevY = 0;
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const lookSpeed = 0.005;

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (renderer.xr.isPresenting) return;
  if (e.button === 0) {
    // left click = shoot from camera
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = camera.position.clone().add(dir.clone().multiplyScalar(0.5));
    shootBall(origin, dir, 10);
  }
  isPointerDown = true;
  prevX = e.clientX;
  prevY = e.clientY;
});
renderer.domElement.addEventListener('pointerup', () => { isPointerDown = false; });
renderer.domElement.addEventListener('pointerleave', () => { isPointerDown = false; });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!isPointerDown || renderer.xr.isPresenting) return;
  // right-drag or always-drag look when holding (simple)
  const dx = e.clientX - prevX;
  const dy = e.clientY - prevY;
  prevX = e.clientX;
  prevY = e.clientY;
  // only look if moved significantly while button held — actually use secondary button feel:
  // for simplicity: Shift+drag or middle = look; free drag after a short hold feels ok for test
});

// Better desktop look: hold right mouse or use pointer lock on double-click
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('pointermove', (e) => {
  if (renderer.xr.isPresenting) return;
  if (e.buttons === 2 || (e.buttons === 1 && e.shiftKey)) {
    euler.setFromQuaternion(camera.quaternion);
    euler.y -= e.movementX * lookSpeed;
    euler.x -= e.movementY * lookSpeed;
    euler.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, euler.x));
    camera.quaternion.setFromEuler(euler);
  }
});

// WASD light movement on desktop
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

function desktopMove(dt) {
  if (renderer.xr.isPresenting) return;
  const speed = 2.5 * dt;
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
  camera.position.y = Math.max(0.4, Math.min(4, camera.position.y));
}

// ─── physics-ish update ─────────────────────────────────────
const clock = new THREE.Clock();
const _hit = new THREE.Vector3();

function update(dt) {
  // cubes float / spin / fall gently when free
  for (const cube of cubes) {
    if (cube.userData.grabbed) continue;
    cube.rotation.x += cube.userData.angular.x;
    cube.rotation.y += cube.userData.angular.y;
    cube.rotation.z += cube.userData.angular.z;

    // simple gravity + bounce on floor
    cube.userData.velocity.y -= 4.5 * dt;
    cube.position.addScaledVector(cube.userData.velocity, dt);
    cube.userData.velocity.multiplyScalar(0.99);

    if (cube.position.y < 0.2) {
      cube.position.y = 0.2;
      cube.userData.velocity.y *= -0.45;
      cube.userData.velocity.x *= 0.8;
      cube.userData.velocity.z *= 0.8;
    }
    // soft keep in arena
    const dist = Math.hypot(cube.position.x, cube.position.z);
    if (dist > 8) {
      cube.userData.velocity.x -= cube.position.x * 0.02;
      cube.userData.velocity.z -= cube.position.z * 0.02;
    }
  }

  // balls
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    b.userData.life -= dt;
    b.userData.velocity.y -= 6 * dt;
    b.position.addScaledVector(b.userData.velocity, dt);

    // hit cubes
    for (const cube of cubes) {
      if (cube.userData.grabbed) continue;
      _hit.copy(b.position).sub(cube.position);
      if (_hit.length() < 0.3) {
        cube.userData.velocity.addScaledVector(b.userData.velocity, 0.4);
        cube.userData.velocity.y += 1.5;
        b.userData.life = 0;
        // flash
        cube.material.emissiveIntensity = 0.8;
        setTimeout(() => { if (cube.material) cube.material.emissiveIntensity = 0.15; }, 120);
        break;
      }
    }

    if (b.position.y < 0.08) {
      b.position.y = 0.08;
      b.userData.velocity.y *= -0.4;
      b.userData.velocity.x *= 0.85;
      b.userData.velocity.z *= 0.85;
    }

    if (b.userData.life <= 0 || b.position.length() > 30) {
      scene.remove(b);
      balls.splice(i, 1);
    }
  }

  updateControllerPrev();
  desktopMove(dt);
}

// ─── resize ─────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── loop ───────────────────────────────────────────────────
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  renderer.render(scene, camera);
});
