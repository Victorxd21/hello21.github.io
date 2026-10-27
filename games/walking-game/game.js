import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const CHUNK_SIZE = 48;
const VIEW_DIST = 3;          // chunks in each direction
const BUILDING_MIN_H = 8;
const BUILDING_MAX_H = 42;
const TREE_DENSITY = 0.55;
const STREET_W = 8;
const BLOCK_SIZE = 20;

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let scene, camera, renderer, controls;
let player = { velocity: new THREE.Vector3(), onGround: true, height: 1.7 };
let keys = {};
let clock = new THREE.Clock();
let chunks = new Map();
let totalDist = 0;
let lastPos = new THREE.Vector3();
let isMobile = false;
let dayTime = 0.35; // 0-1 cycle
let sun, ambient, hemi;
let fogColor = new THREE.Color();

// Mobile joystick
let joy = { active: false, x: 0, y: 0, id: null };
let lookTouch = { id: null, lastX: 0, lastY: 0 };
let sprintHeld = false;
let jumpPressed = false;

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
function init() {
  isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
             (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
  if (isMobile) document.body.classList.add('is-mobile');

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b8e8);
  scene.fog = new THREE.FogExp2(0x87b8e8, 0.012);

  // Camera
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, player.height, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.shadowMap.enabled = !isMobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.getElementById('canvas-wrap').appendChild(renderer.domElement);

  // Lights
  ambient = new THREE.AmbientLight(0x6688aa, 0.35);
  scene.add(ambient);

  hemi = new THREE.HemisphereLight(0x87b8e8, 0x3a5a2a, 0.45);
  scene.add(hemi);

  sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
  sun.position.set(40, 80, 30);
  sun.castShadow = !isMobile;
  if (!isMobile) {
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
  }
  scene.add(sun);

  // Ground plane (infinite feel)
  const groundGeo = new THREE.PlaneGeometry(2000, 2000);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x3a7a3a,
    roughness: 0.95,
    metalness: 0.05
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);

  // Controls
  if (!isMobile) {
    controls = new PointerLockControls(camera, document.body);
    scene.add(controls.getObject());

    document.body.addEventListener('click', () => {
      if (!controls.isLocked) controls.lock();
    });

    controls.addEventListener('lock', () => {
      document.getElementById('hintPanel').style.opacity = '0.35';
    });
    controls.addEventListener('unlock', () => {
      document.getElementById('hintPanel').style.opacity = '1';
    });
  } else {
    // Mobile: free camera attached to player group
    const playerObj = new THREE.Object3D();
    playerObj.position.set(0, player.height, 0);
    playerObj.add(camera);
    scene.add(playerObj);
    controls = { getObject: () => playerObj, isLocked: true };
    setupMobileControls();
  }

  // Keyboard
  window.addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Space') e.preventDefault(); });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  // Resize
  window.addEventListener('resize', onResize);

  // Back button
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = '../';
  });

  // Crosshair (desktop)
  if (!isMobile) {
    const ch = document.createElement('div');
    ch.id = 'crosshair';
    document.body.appendChild(ch);
  }

  lastPos.copy(controls.getObject().position);

  // Generate initial chunks
  updateChunks();

  // Hide loading
  setTimeout(() => {
    document.getElementById('loading').classList.add('hidden');
  }, 600);

  animate();
}

// ─────────────────────────────────────────────
// MOBILE CONTROLS
// ─────────────────────────────────────────────
function setupMobileControls() {
  const base = document.getElementById('joystick-base');
  const stick = document.getElementById('joystick-stick');
  const zone = document.getElementById('joystick-zone');
  const maxR = 40;

  function setStick(dx, dy) {
    const len = Math.hypot(dx, dy);
    if (len > maxR) {
      dx = (dx / len) * maxR;
      dy = (dy / len) * maxR;
    }
    stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    joy.x = dx / maxR;
    joy.y = dy / maxR;
  }

  zone.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joy.id = t.identifier;
    joy.active = true;
    stick.classList.add('active');
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    setStick(t.clientX - cx, t.clientY - cy);
  }, { passive: false });

  window.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) {
        e.preventDefault();
        const rect = base.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        setStick(t.clientX - cx, t.clientY - cy);
      }
      if (t.identifier === lookTouch.id) {
        const dx = t.clientX - lookTouch.lastX;
        const dy = t.clientY - lookTouch.lastY;
        lookTouch.lastX = t.clientX;
        lookTouch.lastY = t.clientY;
        // yaw / pitch
        const obj = controls.getObject();
        obj.rotation.y -= dx * 0.005;
        camera.rotation.x -= dy * 0.004;
        camera.rotation.x = Math.max(-1.2, Math.min(1.2, camera.rotation.x));
      }
    }
  }, { passive: false });

  window.addEventListener('touchend', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) {
        joy.active = false;
        joy.id = null;
        joy.x = 0;
        joy.y = 0;
        stick.style.transform = 'translate(-50%, -50%)';
        stick.classList.remove('active');
      }
      if (t.identifier === lookTouch.id) {
        lookTouch.id = null;
      }
    }
  });

  // Look area (right half of screen)
  renderer.domElement.addEventListener('touchstart', e => {
    for (const t of e.changedTouches) {
      if (t.clientX > window.innerWidth * 0.4 && lookTouch.id === null) {
        lookTouch.id = t.identifier;
        lookTouch.lastX = t.clientX;
        lookTouch.lastY = t.clientY;
      }
    }
  }, { passive: true });

  // Buttons
  const sprintBtn = document.getElementById('sprintBtn');
  const jumpBtn = document.getElementById('jumpBtn');

  const hold = (btn, flag) => {
    const start = e => { e.preventDefault(); flag(true); btn.classList.add('active'); };
    const end = e => { e.preventDefault(); flag(false); btn.classList.remove('active'); };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
    btn.addEventListener('touchcancel', end, { passive: false });
  };

  hold(sprintBtn, v => sprintHeld = v);
  hold(jumpBtn, v => { if (v) jumpPressed = true; });
}

// ─────────────────────────────────────────────
// PROCEDURAL GENERATION
// ─────────────────────────────────────────────
function hash(x, z) {
  let n = x * 374761393 + z * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967296;
}

function getBiome(cx, cz) {
  // Simple noise-based biome: city vs forest
  const n = hash(cx * 3, cz * 3);
  if (n < 0.42) return 'city';
  if (n < 0.78) return 'forest';
  return 'mixed';
}

function createBuilding(w, d, h, color) {
  const group = new THREE.Group();
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.75,
    metalness: 0.15
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = h / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  // Simple windows
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffe8a0 });
  const floors = Math.floor(h / 3.2);
  for (let f = 1; f < floors; f++) {
    for (let side = 0; side < 2; side++) {
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 1.1),
        winMat
      );
      const xOff = side === 0 ? w / 2 + 0.01 : -w / 2 - 0.01;
      win.position.set(xOff, f * 3.2 + 0.8, 0);
      win.rotation.y = side === 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(win);
    }
  }
  return group;
}

function createTree(scale = 1) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25 * scale, 0.35 * scale, 2.8 * scale, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 })
  );
  trunk.position.y = 1.4 * scale;
  trunk.castShadow = true;
  group.add(trunk);

  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0x2d6a2d,
    roughness: 0.85
  });
  const layers = [
    { y: 3.2 * scale, r: 2.1 * scale, h: 2.4 * scale },
    { y: 4.6 * scale, r: 1.5 * scale, h: 1.9 * scale },
    { y: 5.7 * scale, r: 0.9 * scale, h: 1.3 * scale }
  ];
  for (const l of layers) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(l.r, l.h, 7),
      foliageMat
    );
    cone.position.y = l.y;
    cone.castShadow = true;
    group.add(cone);
  }
  return group;
}

function createStreetLamp() {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 5.5, 6),
    new THREE.MeshStandardMaterial({ color: 0x333340, metalness: 0.6, roughness: 0.4 })
  );
  pole.position.y = 2.75;
  group.add(pole);

  const light = new THREE.PointLight(0xffcc77, 0.9, 18, 2);
  light.position.y = 5.4;
  group.add(light);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe8a0 })
  );
  bulb.position.y = 5.4;
  group.add(bulb);
  return group;
}

function generateChunk(cx, cz) {
  const key = `${cx},${cz}`;
  if (chunks.has(key)) return;

  const group = new THREE.Group();
  group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
  const biome = getBiome(cx, cz);
  const rng = (x, z) => hash(cx * 100 + x, cz * 100 + z);

  // City blocks
  if (biome === 'city' || biome === 'mixed') {
    const step = BLOCK_SIZE + STREET_W;
    for (let ix = 0; ix < CHUNK_SIZE; ix += step) {
      for (let iz = 0; iz < CHUNK_SIZE; iz += step) {
        if (rng(ix, iz) > (biome === 'mixed' ? 0.55 : 0.25)) continue;

        const bw = 6 + rng(ix + 1, iz) * 10;
        const bd = 6 + rng(ix, iz + 1) * 10;
        const bh = BUILDING_MIN_H + rng(ix + 2, iz + 2) * (BUILDING_MAX_H - BUILDING_MIN_H);
        const hue = 0.55 + rng(ix + 3, iz) * 0.15;
        const col = new THREE.Color().setHSL(hue, 0.12, 0.35 + rng(ix, iz + 3) * 0.2);

        const b = createBuilding(bw, bd, bh, col);
        b.position.set(
          ix + STREET_W / 2 + bw / 2 + (rng(ix + 4, iz) - 0.5) * 2,
          0,
          iz + STREET_W / 2 + bd / 2 + (rng(ix, iz + 4) - 0.5) * 2
        );
        group.add(b);

        // Occasional lamp
        if (rng(ix + 5, iz + 5) > 0.7) {
          const lamp = createStreetLamp();
          lamp.position.set(ix + 2, 0, iz + 2);
          group.add(lamp);
        }
      }
    }
  }

  // Forest / trees
  if (biome === 'forest' || biome === 'mixed') {
    const density = biome === 'forest' ? TREE_DENSITY : TREE_DENSITY * 0.45;
    const count = Math.floor(CHUNK_SIZE * CHUNK_SIZE * density * 0.012);
    for (let i = 0; i < count; i++) {
      const x = rng(i * 7, 11) * CHUNK_SIZE;
      const z = rng(i * 13, 17) * CHUNK_SIZE;
      // Avoid pure road centers roughly
      if (biome === 'city' && (x % (BLOCK_SIZE + STREET_W) < STREET_W)) continue;

      const scale = 0.75 + rng(i, 23) * 0.7;
      const tree = createTree(scale);
      tree.position.set(x, 0, z);
      tree.rotation.y = rng(i, 29) * Math.PI * 2;
      group.add(tree);
    }
  }

  // Small props: rocks / bushes in forest
  if (biome === 'forest') {
    for (let i = 0; i < 8; i++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.4 + rng(i, 40) * 0.6, 0),
        new THREE.MeshStandardMaterial({ color: 0x666660, roughness: 0.9 })
      );
      rock.position.set(rng(i * 3, 50) * CHUNK_SIZE, 0.3, rng(i * 5, 51) * CHUNK_SIZE);
      rock.rotation.set(rng(i, 52), rng(i, 53), rng(i, 54));
      rock.castShadow = true;
      group.add(rock);
    }
  }

  scene.add(group);
  chunks.set(key, { group, biome, cx, cz });
}

function updateChunks() {
  const pos = controls.getObject().position;
  const pcx = Math.floor(pos.x / CHUNK_SIZE);
  const pcz = Math.floor(pos.z / CHUNK_SIZE);

  // Generate needed
  for (let dx = -VIEW_DIST; dx <= VIEW_DIST; dx++) {
    for (let dz = -VIEW_DIST; dz <= VIEW_DIST; dz++) {
      generateChunk(pcx + dx, pcz + dz);
    }
  }

  // Remove far chunks
  for (const [key, ch] of chunks) {
    if (Math.abs(ch.cx - pcx) > VIEW_DIST + 1 || Math.abs(ch.cz - pcz) > VIEW_DIST + 1) {
      scene.remove(ch.group);
      // dispose
      ch.group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      });
      chunks.delete(key);
    }
  }
}

// ─────────────────────────────────────────────
// PLAYER MOVEMENT + COLLISION (simple)
// ─────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const down = new THREE.Vector3(0, -1, 0);

function updatePlayer(dt) {
  const obj = controls.getObject();
  const speed = (keys['ShiftLeft'] || keys['ShiftRight'] || sprintHeld) ? 12 : 5.5;
  const dir = new THREE.Vector3();

  if (!isMobile) {
    if (keys['KeyW'] || keys['ArrowUp']) dir.z -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) dir.z += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) dir.x -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) dir.x += 1;
  } else {
    dir.x = joy.x;
    dir.z = joy.y;
  }

  if (dir.lengthSq() > 0) {
    dir.normalize();
    // Transform to camera space
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    if (!isMobile) {
      move.addScaledVector(forward, -dir.z);
      move.addScaledVector(right, dir.x);
    } else {
      // joystick: y is forward/back relative to look
      move.addScaledVector(forward, -dir.z);
      move.addScaledVector(right, dir.x);
    }
    move.normalize().multiplyScalar(speed * dt);

    // Simple collision: raycast a few directions
    const tryMove = (mx, mz) => {
      const next = obj.position.clone().add(new THREE.Vector3(mx, 0, mz));
      // Check nearby buildings roughly by sampling height / simple box test against recent chunks
      // Lightweight: just prevent going into very dense areas via height check is weak;
      // we use a few horizontal rays
      raycaster.set(obj.position, new THREE.Vector3(mx, 0, mz).normalize());
      raycaster.far = 1.1;
      const hits = [];
      for (const ch of chunks.values()) {
        const inter = raycaster.intersectObjects(ch.group.children, true);
        if (inter.length) hits.push(...inter);
      }
      return hits.length === 0 || hits[0].distance > 0.9;
    };

    if (tryMove(move.x, 0)) obj.position.x += move.x;
    if (tryMove(0, move.z)) obj.position.z += move.z;
  }

  // Gravity + jump
  if ((keys['Space'] || jumpPressed) && player.onGround) {
    player.velocity.y = 7.5;
    player.onGround = false;
    jumpPressed = false;
  }

  player.velocity.y -= 22 * dt;
  obj.position.y += player.velocity.y * dt;

  if (obj.position.y <= player.height) {
    obj.position.y = player.height;
    player.velocity.y = 0;
    player.onGround = true;
  }

  // Distance walked
  const dx = obj.position.x - lastPos.x;
  const dz = obj.position.z - lastPos.z;
  totalDist += Math.hypot(dx, dz);
  lastPos.copy(obj.position);

  // Keep sun following a bit
  sun.position.x = obj.position.x + 40;
  sun.position.z = obj.position.z + 30;
}

// ─────────────────────────────────────────────
// DAY / NIGHT & AMBIENCE
// ─────────────────────────────────────────────
function updateAtmosphere(dt) {
  dayTime = (dayTime + dt * 0.008) % 1; // slow cycle

  // 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
  const t = dayTime;
  let sunIntensity, ambIntensity, skyCol, fogDens;

  if (t < 0.2 || t > 0.85) {
    // Night
    sunIntensity = 0.05;
    ambIntensity = 0.12;
    skyCol = new THREE.Color(0x0a1020);
    fogDens = 0.018;
    fogColor.set(0x0a1020);
  } else if (t < 0.3) {
    // Sunrise
    const k = (t - 0.2) / 0.1;
    sunIntensity = 0.05 + k * 1.0;
    ambIntensity = 0.12 + k * 0.3;
    skyCol = new THREE.Color().lerpColors(new THREE.Color(0x0a1020), new THREE.Color(0xff9966), k);
    fogDens = 0.018 - k * 0.006;
    fogColor.copy(skyCol);
  } else if (t < 0.7) {
    // Day
    sunIntensity = 1.05;
    ambIntensity = 0.4;
    skyCol = new THREE.Color(0x87b8e8);
    fogDens = 0.011;
    fogColor.set(0x87b8e8);
  } else {
    // Sunset
    const k = (t - 0.7) / 0.15;
    sunIntensity = 1.05 - k * 1.0;
    ambIntensity = 0.4 - k * 0.28;
    skyCol = new THREE.Color().lerpColors(new THREE.Color(0x87b8e8), new THREE.Color(0xff6644), Math.min(1, k * 1.4));
    fogDens = 0.011 + k * 0.007;
    fogColor.copy(skyCol);
  }

  sun.intensity = sunIntensity;
  ambient.intensity = ambIntensity;
  hemi.intensity = ambIntensity * 0.9;
  scene.background.copy(skyCol);
  scene.fog.color.copy(fogColor);
  scene.fog.density = fogDens;

  // Sun angle
  const angle = (t - 0.25) * Math.PI * 2;
  sun.position.y = Math.sin(angle) * 90 + 20;
}

// ─────────────────────────────────────────────
// HUD
// ─────────────────────────────────────────────
function updateHUD() {
  document.getElementById('dist').textContent = totalDist < 1000
    ? `${Math.floor(totalDist)} m`
    : `${(totalDist / 1000).toFixed(2)} km`;

  const pos = controls.getObject().position;
  const cx = Math.floor(pos.x / CHUNK_SIZE);
  const cz = Math.floor(pos.z / CHUNK_SIZE);
  const biome = getBiome(cx, cz);
  document.getElementById('zone').textContent =
    biome === 'city' ? 'City' : biome === 'forest' ? 'Forest' : 'Mixed';

  const h = Math.floor(dayTime * 24);
  const m = Math.floor((dayTime * 24 * 60) % 60);
  document.getElementById('time').textContent =
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// LOOP
// ─────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  updatePlayer(dt);
  updateChunks();
  updateAtmosphere(dt);
  updateHUD();

  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Start
init();
