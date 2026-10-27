import * as THREE from 'three';

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const CHUNK_SIZE = 56;
const VIEW_DIST = 2;
const BUILDING_MIN_H = 10;
const BUILDING_MAX_H = 55;
const STREET_W = 10;
const BLOCK = 22;

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let scene, camera, renderer;
let playerMesh, player = {
  pos: new THREE.Vector3(0, 0, 0),
  velocity: new THREE.Vector3(),
  onGround: true,
  yaw: 0,
  height: 1.75
};
let keys = {};
let clock = new THREE.Clock();
let chunks = new Map();
let totalDist = 0;
let lastPos = new THREE.Vector3();
let isMobile = false;
let dayTime = 0.38;
let sun, ambient, hemi;
let cars = [];
let npcs = [];
let camYaw = 0, camPitch = 0.35;
let camDist = 7.5;
let targetCamDist = 7.5;

// Mobile
let joy = { active: false, x: 0, y: 0, id: null };
let lookTouch = { id: null, lastX: 0, lastY: 0 };
let sprintHeld = false;
let jumpPressed = false;

// Simple audio context for ambience
let audioCtx = null;
let ambGain = null;

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
function init() {
  isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
             (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
  if (isMobile) document.body.classList.add('is-mobile');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b8e8);
  scene.fog = new THREE.FogExp2(0x87b8e8, 0.014);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.15, 350);

  renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.4 : 2));
  renderer.shadowMap.enabled = !isMobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  document.getElementById('canvas-wrap').appendChild(renderer.domElement);

  // Lights
  ambient = new THREE.AmbientLight(0x6688aa, 0.4);
  scene.add(ambient);
  hemi = new THREE.HemisphereLight(0x87c0f0, 0x3a5a2a, 0.5);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff2d9, 1.15);
  sun.position.set(50, 90, 40);
  sun.castShadow = !isMobile;
  if (!isMobile) {
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 220;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -90;
    sun.shadow.camera.right = sun.shadow.camera.top = 90;
  }
  scene.add(sun);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.MeshStandardMaterial({ color: 0x2f6b35, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Player character (simple low-poly person)
  playerMesh = createPerson(0x3a7bd5, 0x222233);
  playerMesh.position.set(0, 0, 0);
  scene.add(playerMesh);
  player.pos.set(0, 0, 0);

  // Input
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  // Mouse orbit (desktop)
  let dragging = false;
  renderer.domElement.addEventListener('mousedown', e => {
    if (e.button === 0 || e.button === 2) dragging = true;
  });
  window.addEventListener('mouseup', () => dragging = false);
  window.addEventListener('mousemove', e => {
    if (!dragging && !isMobile) return;
    if (dragging) {
      camYaw -= e.movementX * 0.005;
      camPitch += e.movementY * 0.004;
      camPitch = Math.max(0.12, Math.min(1.15, camPitch));
    }
  });
  renderer.domElement.addEventListener('wheel', e => {
    targetCamDist = THREE.MathUtils.clamp(targetCamDist + e.deltaY * 0.008, 4, 16);
  }, { passive: true });
  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

  if (isMobile) setupMobileControls();

  window.addEventListener('resize', onResize);
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = '../';
  });

  // Start audio on first interaction
  const startAudio = () => {
    if (!audioCtx) initAudio();
    document.body.removeEventListener('click', startAudio);
    document.body.removeEventListener('touchstart', startAudio);
  };
  document.body.addEventListener('click', startAudio);
  document.body.addEventListener('touchstart', startAudio);

  lastPos.copy(player.pos);
  updateChunks();
  setTimeout(() => document.getElementById('loading').classList.add('hidden'), 700);
  animate();
}

// ─────────────────────────────────────────────
// AUDIO (simple procedural city hum)
// ─────────────────────────────────────────────
function initAudio() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    ambGain = audioCtx.createGain();
    ambGain.gain.value = 0.035;
    ambGain.connect(audioCtx.destination);

    // Soft city drone
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55;
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 180;
    osc.connect(filt);
    filt.connect(ambGain);
    osc.start();

    // Subtle noise layer
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuf = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const nGain = audioCtx.createGain();
    nGain.gain.value = 0.012;
    noise.connect(nGain);
    nGain.connect(ambGain);
    noise.start();
  } catch (e) {}
}

// ─────────────────────────────────────────────
// CHARACTER + PROPS
// ─────────────────────────────────────────────
function createPerson(shirtColor, pantsColor) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.85 });
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.85 });

  // Body
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.28), shirt);
  torso.position.y = 1.15;
  torso.castShadow = true;
  g.add(torso);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.3), skin);
  head.position.y = 1.6;
  head.castShadow = true;
  g.add(head);

  // Legs
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.18), pants);
  legL.position.set(-0.12, 0.4, 0);
  legL.castShadow = true;
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.12;
  g.add(legR);

  // Arms
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.45, 0.13), shirt);
  armL.position.set(-0.32, 1.15, 0);
  armL.castShadow = true;
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.32;
  g.add(armR);

  g.userData = { legL, legR, armL, armR, phase: Math.random() * Math.PI * 2 };
  return g;
}

function createCar(color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.2), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), bodyMat);
  cabin.position.set(0, 1.05, -0.2);
  cabin.castShadow = true;
  g.add(cabin);

  // Windows
  const glass = new THREE.MeshBasicMaterial({ color: 0x88aacc });
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.4, 1.9), glass);
  win.position.set(0, 1.1, -0.15);
  g.add(win);

  // Wheels
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const positions = [[-0.85, 0.28, 1.3], [0.85, 0.28, 1.3], [-0.85, 0.28, -1.3], [0.85, 0.28, -1.3]];
  for (const [x, y, z] of positions) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 10), wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, y, z);
    g.add(w);
  }

  // Headlights
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffeebb });
  const hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.08), lightMat);
  hl1.position.set(-0.55, 0.55, 2.12);
  g.add(hl1);
  const hl2 = hl1.clone();
  hl2.position.x = 0.55;
  g.add(hl2);

  return g;
}

function createBuilding(w, d, h, color, seed) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0.12
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.y = h / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);

  // Windows grid
  const winOn = new THREE.MeshBasicMaterial({ color: 0xffe6a0 });
  const winOff = new THREE.MeshBasicMaterial({ color: 0x1a2230 });
  const floors = Math.floor(h / 3.1);
  const colsX = Math.max(2, Math.floor(w / 2.4));
  const colsZ = Math.max(2, Math.floor(d / 2.4));

  for (let f = 1; f < floors; f++) {
    for (let c = 0; c < colsX; c++) {
      const lit = hash(seed + f * 17 + c * 3, 1) > 0.55;
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(0.85, 1.15),
        lit ? winOn : winOff
      );
      const x = -w / 2 + 1.2 + c * ((w - 2.4) / Math.max(1, colsX - 1));
      win.position.set(x, f * 3.1 + 0.9, d / 2 + 0.02);
      g.add(win);
      const win2 = win.clone();
      win2.position.z = -d / 2 - 0.02;
      win2.rotation.y = Math.PI;
      g.add(win2);
    }
    for (let c = 0; c < colsZ; c++) {
      const lit = hash(seed + f * 19 + c * 5, 2) > 0.55;
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(0.85, 1.15),
        lit ? winOn : winOff
      );
      const z = -d / 2 + 1.2 + c * ((d - 2.4) / Math.max(1, colsZ - 1));
      win.position.set(w / 2 + 0.02, f * 3.1 + 0.9, z);
      win.rotation.y = Math.PI / 2;
      g.add(win);
      const win2 = win.clone();
      win2.position.x = -w / 2 - 0.02;
      win2.rotation.y = -Math.PI / 2;
      g.add(win2);
    }
  }

  // Simple roof ledge
  const ledge = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.4, 0.35, d + 0.4),
    new THREE.MeshStandardMaterial({ color: 0x333340, roughness: 0.7 })
  );
  ledge.position.y = h + 0.1;
  g.add(ledge);

  // Occasional storefront awning on ground floor
  if (hash(seed, 9) > 0.6 && h > 12) {
    const awn = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.7, 0.12, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xcc4433, roughness: 0.7 })
    );
    awn.position.set(0, 3.2, d / 2 + 0.7);
    g.add(awn);
  }

  return g;
}

function createTree(scale = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22 * scale, 0.32 * scale, 2.6 * scale, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 })
  );
  trunk.position.y = 1.3 * scale;
  trunk.castShadow = true;
  g.add(trunk);
  const fol = new THREE.MeshStandardMaterial({ color: 0x2a6a2a, roughness: 0.85 });
  [[3.0, 1.9, 2.2], [4.3, 1.4, 1.7], [5.3, 0.85, 1.2]].forEach(([y, r, h], i) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(r * scale, h * scale, 7), fol);
    c.position.y = y * scale;
    c.castShadow = true;
    g.add(c);
  });
  return g;
}

function createLamp() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 5.8, 6),
    new THREE.MeshStandardMaterial({ color: 0x2a2a33, metalness: 0.6, roughness: 0.35 })
  );
  pole.position.y = 2.9;
  g.add(pole);
  const light = new THREE.PointLight(0xffcc88, 1.1, 22, 2);
  light.position.y = 5.7;
  g.add(light);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe8a8 })
  );
  bulb.position.y = 5.7;
  g.add(bulb);
  return g;
}

function createBench() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.85 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.45), wood);
  seat.position.y = 0.45;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.1), wood);
  back.position.set(0, 0.75, -0.18);
  g.add(back);
  return g;
}

// ─────────────────────────────────────────────
// HASH + BIOME
// ─────────────────────────────────────────────
function hash(x, z) {
  let n = x * 374761393 + z * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967296;
}

function getBiome(cx, cz) {
  const n = hash(cx * 2.7, cz * 2.7);
  if (n < 0.48) return 'city';
  if (n < 0.78) return 'forest';
  return 'mixed';
}

// ─────────────────────────────────────────────
// CHUNK GENERATION
// ─────────────────────────────────────────────
function generateChunk(cx, cz) {
  const key = `${cx},${cz}`;
  if (chunks.has(key)) return;

  const group = new THREE.Group();
  group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
  const biome = getBiome(cx, cz);
  const rng = (a, b) => hash(cx * 131 + a, cz * 137 + b);

  // Roads (simple asphalt strips)
  if (biome !== 'forest') {
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.9 });
    // Horizontal roads
    for (let iz = 0; iz < CHUNK_SIZE; iz += BLOCK + STREET_W) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CHUNK_SIZE, STREET_W), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(CHUNK_SIZE / 2, 0.02, iz + STREET_W / 2);
      road.receiveShadow = true;
      group.add(road);
    }
    // Vertical roads
    for (let ix = 0; ix < CHUNK_SIZE; ix += BLOCK + STREET_W) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(STREET_W, CHUNK_SIZE), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(ix + STREET_W / 2, 0.025, CHUNK_SIZE / 2);
      road.receiveShadow = true;
      group.add(road);
    }
  }

  // Buildings
  if (biome === 'city' || biome === 'mixed') {
    const step = BLOCK + STREET_W;
    for (let ix = 0; ix < CHUNK_SIZE - 2; ix += step) {
      for (let iz = 0; iz < CHUNK_SIZE - 2; iz += step) {
        if (rng(ix, iz) > (biome === 'mixed' ? 0.5 : 0.18)) continue;

        const bw = 7 + rng(ix + 1, iz) * 11;
        const bd = 7 + rng(ix, iz + 1) * 11;
        const bh = BUILDING_MIN_H + rng(ix + 2, iz + 2) * (BUILDING_MAX_H - BUILDING_MIN_H);
        const hue = 0.08 + rng(ix + 3, iz) * 0.55;
        const sat = 0.08 + rng(ix, iz + 3) * 0.18;
        const light = 0.28 + rng(ix + 4, iz + 4) * 0.25;
        const col = new THREE.Color().setHSL(hue, sat, light);

        const b = createBuilding(bw, bd, bh, col, Math.floor(rng(ix, iz) * 10000));
        b.position.set(
          ix + STREET_W + bw / 2 + (rng(ix + 5, iz) - 0.5) * 1.5,
          0,
          iz + STREET_W + bd / 2 + (rng(ix, iz + 5) - 0.5) * 1.5
        );
        group.add(b);

        // Street furniture
        if (rng(ix + 8, iz + 8) > 0.55) {
          const lamp = createLamp();
          lamp.position.set(ix + 2.5, 0, iz + 2.5);
          group.add(lamp);
        }
        if (rng(ix + 9, iz + 9) > 0.72) {
          const bench = createBench();
          bench.position.set(ix + STREET_W + 1.5, 0, iz + 3);
          bench.rotation.y = Math.PI / 2;
          group.add(bench);
        }
      }
    }
  }

  // Trees
  if (biome === 'forest' || biome === 'mixed') {
    const dens = biome === 'forest' ? 0.018 : 0.007;
    const count = Math.floor(CHUNK_SIZE * CHUNK_SIZE * dens);
    for (let i = 0; i < count; i++) {
      const x = rng(i * 11, 3) * CHUNK_SIZE;
      const z = rng(i * 17, 7) * CHUNK_SIZE;
      if (biome !== 'forest' && (x % (BLOCK + STREET_W) < STREET_W + 2)) continue;
      const scale = 0.8 + rng(i, 19) * 0.7;
      const tree = createTree(scale);
      tree.position.set(x, 0, z);
      tree.rotation.y = rng(i, 23) * Math.PI * 2;
      group.add(tree);
    }
  }

  // Spawn local cars + NPCs for this chunk (only in city/mixed)
  if (biome !== 'forest') {
    const carCount = 2 + Math.floor(rng(50, 50) * 3);
    for (let i = 0; i < carCount; i++) {
      const colors = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0x2c3e50, 0xecf0f1];
      const car = createCar(colors[Math.floor(rng(i + 60, 1) * colors.length)]);
      const alongX = rng(i + 70, 2) > 0.5;
      const roadIdx = Math.floor(rng(i + 80, 3) * 2);
      const base = roadIdx * (BLOCK + STREET_W) + STREET_W / 2;
      if (alongX) {
        car.position.set(rng(i, 4) * CHUNK_SIZE, 0, base);
        car.rotation.y = rng(i, 5) > 0.5 ? 0 : Math.PI;
      } else {
        car.position.set(base, 0, rng(i, 6) * CHUNK_SIZE);
        car.rotation.y = rng(i, 7) > 0.5 ? Math.PI / 2 : -Math.PI / 2;
      }
      car.position.x += cx * CHUNK_SIZE;
      car.position.z += cz * CHUNK_SIZE;
      car.userData = {
        speed: 4 + rng(i, 8) * 6,
        dir: car.rotation.y,
        life: 40 + rng(i, 9) * 40
      };
      scene.add(car);
      cars.push(car);
    }

    const npcCount = 3 + Math.floor(rng(90, 90) * 5);
    for (let i = 0; i < npcCount; i++) {
      const shirts = [0xe74c3c, 0x3498db, 0x2ecc71, 0x9b59b6, 0xf1c40f, 0x1abc9c, 0xe67e22, 0x34495e];
      const pants = [0x2c3e50, 0x34495e, 0x1a1a2e, 0x4a3728];
      const person = createPerson(
        shirts[Math.floor(rng(i + 100, 1) * shirts.length)],
        pants[Math.floor(rng(i + 110, 2) * pants.length)]
      );
      person.position.set(
        cx * CHUNK_SIZE + rng(i + 120, 3) * CHUNK_SIZE,
        0,
        cz * CHUNK_SIZE + rng(i + 130, 4) * CHUNK_SIZE
      );
      person.rotation.y = rng(i, 15) * Math.PI * 2;
      person.userData.speed = 1.1 + rng(i, 16) * 1.4;
      person.userData.dir = person.rotation.y;
      person.userData.turnTimer = 2 + rng(i, 17) * 6;
      scene.add(person);
      npcs.push(person);
    }
  }

  scene.add(group);
  chunks.set(key, { group, biome, cx, cz });
}

function updateChunks() {
  const pcx = Math.floor(player.pos.x / CHUNK_SIZE);
  const pcz = Math.floor(player.pos.z / CHUNK_SIZE);

  for (let dx = -VIEW_DIST; dx <= VIEW_DIST; dx++) {
    for (let dz = -VIEW_DIST; dz <= VIEW_DIST; dz++) {
      generateChunk(pcx + dx, pcz + dz);
    }
  }

  // Cleanup far chunks + their dynamic objects
  for (const [key, ch] of chunks) {
    if (Math.abs(ch.cx - pcx) > VIEW_DIST + 1 || Math.abs(ch.cz - pcz) > VIEW_DIST + 1) {
      scene.remove(ch.group);
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

  // Cull distant cars / npcs
  const maxD = (VIEW_DIST + 1.5) * CHUNK_SIZE;
  cars = cars.filter(c => {
    if (c.position.distanceTo(player.pos) > maxD) {
      scene.remove(c);
      return false;
    }
    return true;
  });
  npcs = npcs.filter(n => {
    if (n.position.distanceTo(player.pos) > maxD) {
      scene.remove(n);
      return false;
    }
    return true;
  });
}

// ─────────────────────────────────────────────
// MOBILE
// ─────────────────────────────────────────────
function setupMobileControls() {
  const base = document.getElementById('joystick-base');
  const stick = document.getElementById('joystick-stick');
  const zone = document.getElementById('joystick-zone');
  const maxR = 42;

  function setStick(dx, dy) {
    const len = Math.hypot(dx, dy);
    if (len > maxR) { dx = dx / len * maxR; dy = dy / len * maxR; }
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
    setStick(t.clientX - (rect.left + rect.width / 2), t.clientY - (rect.top + rect.height / 2));
  }, { passive: false });

  window.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) {
        e.preventDefault();
        const rect = base.getBoundingClientRect();
        setStick(t.clientX - (rect.left + rect.width / 2), t.clientY - (rect.top + rect.height / 2));
      }
      if (t.identifier === lookTouch.id) {
        const dx = t.clientX - lookTouch.lastX;
        const dy = t.clientY - lookTouch.lastY;
        lookTouch.lastX = t.clientX;
        lookTouch.lastY = t.clientY;
        camYaw -= dx * 0.006;
        camPitch += dy * 0.005;
        camPitch = Math.max(0.12, Math.min(1.15, camPitch));
      }
    }
  }, { passive: false });

  window.addEventListener('touchend', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) {
        joy.active = false; joy.id = null; joy.x = 0; joy.y = 0;
        stick.style.transform = 'translate(-50%, -50%)';
        stick.classList.remove('active');
      }
      if (t.identifier === lookTouch.id) lookTouch.id = null;
    }
  });

  renderer.domElement.addEventListener('touchstart', e => {
    for (const t of e.changedTouches) {
      if (t.clientX > window.innerWidth * 0.38 && lookTouch.id === null) {
        lookTouch.id = t.identifier;
        lookTouch.lastX = t.clientX;
        lookTouch.lastY = t.clientY;
      }
    }
  }, { passive: true });

  const hold = (btn, setter) => {
    btn.addEventListener('touchstart', e => { e.preventDefault(); setter(true); btn.classList.add('active'); }, { passive: false });
    btn.addEventListener('touchend', e => { e.preventDefault(); setter(false); btn.classList.remove('active'); }, { passive: false });
    btn.addEventListener('touchcancel', e => { setter(false); btn.classList.remove('active'); }, { passive: false });
  };
  hold(document.getElementById('sprintBtn'), v => sprintHeld = v);
  hold(document.getElementById('jumpBtn'), v => { if (v) jumpPressed = true; });
}

// ─────────────────────────────────────────────
// UPDATE LOOPS
// ─────────────────────────────────────────────
function updatePlayer(dt) {
  const speed = (keys['ShiftLeft'] || keys['ShiftRight'] || sprintHeld) ? 9.5 : 4.8;
  let mx = 0, mz = 0;

  if (!isMobile) {
    if (keys['KeyW'] || keys['ArrowUp']) mz -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) mz += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
  } else {
    mx = joy.x;
    mz = joy.y;
  }

  if (mx !== 0 || mz !== 0) {
    const len = Math.hypot(mx, mz);
    mx /= len; mz /= len;

    // Move relative to camera yaw
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    const dx = (mx * cos + mz * sin) * speed * dt;
    const dz = (-mx * sin + mz * cos) * speed * dt;

    // Simple collision vs buildings
    const tryPos = player.pos.clone().add(new THREE.Vector3(dx, 0, dz));
    let blocked = false;
    const checkR = 0.55;
    for (const ch of chunks.values()) {
      for (const child of ch.group.children) {
        if (!child.isMesh && !child.isGroup) continue;
        // Rough AABB using building-like objects (height > 4)
        child.traverse(o => {
          if (o.isMesh && o.geometry && o.geometry.type === 'BoxGeometry') {
            const box = new THREE.Box3().setFromObject(o);
            if (box.max.y > 3.5) {
              const cx = (box.min.x + box.max.x) / 2;
              const cz = (box.min.z + box.max.z) / 2;
              const hw = (box.max.x - box.min.x) / 2 + checkR;
              const hd = (box.max.z - box.min.z) / 2 + checkR;
              if (Math.abs(tryPos.x - cx) < hw && Math.abs(tryPos.z - cz) < hd) {
                blocked = true;
              }
            }
          }
        });
        if (blocked) break;
      }
      if (blocked) break;
    }

    if (!blocked) {
      player.pos.x += dx;
      player.pos.z += dz;
    }

    // Face movement direction
    player.yaw = Math.atan2(dx, dz);
  }

  // Jump / gravity
  if ((keys['Space'] || jumpPressed) && player.onGround) {
    player.velocity.y = 7.2;
    player.onGround = false;
    jumpPressed = false;
  }
  player.velocity.y -= 22 * dt;
  player.pos.y += player.velocity.y * dt;
  if (player.pos.y <= 0) {
    player.pos.y = 0;
    player.velocity.y = 0;
    player.onGround = true;
  }

  // Apply to mesh
  playerMesh.position.copy(player.pos);
  playerMesh.rotation.y = player.yaw;

  // Walk animation
  const moving = (mx !== 0 || mz !== 0);
  const phase = performance.now() * 0.012;
  if (playerMesh.userData.legL) {
    const swing = moving ? Math.sin(phase) * 0.55 : 0;
    playerMesh.userData.legL.rotation.x = swing;
    playerMesh.userData.legR.rotation.x = -swing;
    playerMesh.userData.armL.rotation.x = -swing * 0.7;
    playerMesh.userData.armR.rotation.x = swing * 0.7;
  }

  // Distance
  totalDist += player.pos.distanceTo(lastPos);
  lastPos.copy(player.pos);

  // Camera follow (third person orbit)
  camDist += (targetCamDist - camDist) * 0.1;
  const camX = player.pos.x + Math.sin(camYaw) * camDist * Math.cos(camPitch);
  const camZ = player.pos.z + Math.cos(camYaw) * camDist * Math.cos(camPitch);
  const camY = player.pos.y + 1.4 + Math.sin(camPitch) * camDist;
  camera.position.set(camX, camY, camZ);
  camera.lookAt(player.pos.x, player.pos.y + 1.3, player.pos.z);

  sun.position.x = player.pos.x + 50;
  sun.position.z = player.pos.z + 40;
}

function updateDynamics(dt) {
  // Cars
  for (const car of cars) {
    const ud = car.userData;
    car.position.x += Math.sin(ud.dir) * ud.speed * dt;
    car.position.z += Math.cos(ud.dir) * ud.speed * dt;
    ud.life -= dt;
    if (ud.life < 0) {
      // Respawn nearby
      ud.life = 30 + Math.random() * 40;
      const ang = Math.random() * Math.PI * 2;
      car.position.set(
        player.pos.x + Math.cos(ang) * 40,
        0,
        player.pos.z + Math.sin(ang) * 40
      );
      ud.dir = Math.random() * Math.PI * 2;
      car.rotation.y = ud.dir;
    }
  }

  // NPCs wander
  for (const npc of npcs) {
    const ud = npc.userData;
    ud.turnTimer -= dt;
    if (ud.turnTimer <= 0) {
      ud.dir += (Math.random() - 0.5) * 1.8;
      ud.turnTimer = 2 + Math.random() * 5;
      npc.rotation.y = ud.dir;
    }
    npc.position.x += Math.sin(ud.dir) * ud.speed * dt;
    npc.position.z += Math.cos(ud.dir) * ud.speed * dt;

    // Walk cycle
    if (ud.legL) {
      const swing = Math.sin(performance.now() * 0.01 + ud.phase) * 0.5;
      ud.legL.rotation.x = swing;
      ud.legR.rotation.x = -swing;
      ud.armL.rotation.x = -swing * 0.6;
      ud.armR.rotation.x = swing * 0.6;
    }
  }
}

function updateAtmosphere(dt) {
  dayTime = (dayTime + dt * 0.006) % 1;
  const t = dayTime;
  let sunI, ambI, sky, dens;

  if (t < 0.2 || t > 0.88) {
    sunI = 0.04; ambI = 0.1;
    sky = new THREE.Color(0x080e1a);
    dens = 0.02;
  } else if (t < 0.28) {
    const k = (t - 0.2) / 0.08;
    sunI = 0.04 + k * 1.1; ambI = 0.1 + k * 0.35;
    sky = new THREE.Color().lerpColors(new THREE.Color(0x080e1a), new THREE.Color(0xff9966), k);
    dens = 0.02 - k * 0.007;
  } else if (t < 0.72) {
    sunI = 1.15; ambI = 0.45;
    sky = new THREE.Color(0x87b8e8);
    dens = 0.012;
  } else {
    const k = (t - 0.72) / 0.16;
    sunI = 1.15 - k * 1.1; ambI = 0.45 - k * 0.35;
    sky = new THREE.Color().lerpColors(new THREE.Color(0x87b8e8), new THREE.Color(0xff6644), Math.min(1, k * 1.3));
    dens = 0.012 + k * 0.008;
  }

  sun.intensity = sunI;
  ambient.intensity = ambI;
  hemi.intensity = ambI * 0.85;
  scene.background.copy(sky);
  scene.fog.color.copy(sky);
  scene.fog.density = dens;

  const angle = (t - 0.25) * Math.PI * 2;
  sun.position.y = Math.sin(angle) * 95 + 25;
}

function updateHUD() {
  document.getElementById('dist').textContent = totalDist < 1000
    ? `${Math.floor(totalDist)} m` : `${(totalDist / 1000).toFixed(2)} km`;
  const cx = Math.floor(player.pos.x / CHUNK_SIZE);
  const cz = Math.floor(player.pos.z / CHUNK_SIZE);
  const b = getBiome(cx, cz);
  document.getElementById('zone').textContent = b === 'city' ? 'City' : b === 'forest' ? 'Forest' : 'Mixed';
  const h = Math.floor(dayTime * 24);
  const m = Math.floor((dayTime * 24 * 60) % 60);
  document.getElementById('time').textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  document.getElementById('npcCount').textContent = npcs.length;
}

// ─────────────────────────────────────────────
// MAIN LOOP
// ─────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  updatePlayer(dt);
  updateDynamics(dt);
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

init();
