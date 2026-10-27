import * as THREE from 'three';

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const CHUNK_SIZE = 56;
const VIEW_DIST = 2;
const BUILDING_MIN_H = 10;
const BUILDING_MAX_H = 52;
const STREET_W = 10;
const BLOCK = 22;
const GRID = BLOCK + STREET_W; // 32

const CYCLE_GREEN = 9;
const CYCLE_YELLOW = 2.8;
const CYCLE_RED = 9;
const CYCLE_TOTAL = CYCLE_GREEN + CYCLE_YELLOW + CYCLE_RED;

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let scene, camera, renderer;
let playerMesh;
let player = {
  pos: new THREE.Vector3(0, 0, 0),
  velocity: new THREE.Vector3(),
  onGround: true,
  yaw: 0,
  stamina: 100,
  sitting: false,
  bumpTimer: 0
};
let keys = {};
let clock = new THREE.Clock();
let chunks = new Map();
let totalDist = 0;
let lastPos = new THREE.Vector3();
let isMobile = false;
let dayTime = 0.4;
let sun, ambient, hemi;
let cars = [];
let npcs = [];
let trafficLights = [];
let parkedCars = [];
let benches = [];
let streetLamps = [];

let camYaw = 0, camPitch = 0.38;
let camDist = 7.8;
let targetCamDist = 7.8;
let firstPerson = false;

// Weather
let weather = 'clear'; // clear | rain | fog
let rainParticles = null;
let weatherTimer = 0;

// Mobile
let joy = { active: false, x: 0, y: 0, id: null };
let lookTouch = { id: null, lastX: 0, lastY: 0 };
let sprintHeld = false;
let jumpPressed = false;

let audioCtx = null;

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
function init() {
  isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
             (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
  if (isMobile) document.body.classList.add('is-mobile');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b8e8);
  scene.fog = new THREE.FogExp2(0x87b8e8, 0.013);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.12, 340);

  renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.35 : 2));
  renderer.shadowMap.enabled = !isMobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  document.getElementById('canvas-wrap').appendChild(renderer.domElement);

  ambient = new THREE.AmbientLight(0x6688aa, 0.4);
  scene.add(ambient);
  hemi = new THREE.HemisphereLight(0x87c0f0, 0x3a5a2a, 0.48);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff2d9, 1.12);
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

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.MeshStandardMaterial({ color: 0x2f6b35, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  playerMesh = createPerson(0x3a7bd5, 0x222233);
  scene.add(playerMesh);

  // Rain system
  createRain();

  // Input
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'KeyC') toggleCamera();
    if (e.code === 'KeyF') trySit();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  let dragging = false;
  renderer.domElement.addEventListener('mousedown', e => {
    if (e.button === 0 || e.button === 2) dragging = true;
  });
  window.addEventListener('mouseup', () => dragging = false);
  window.addEventListener('mousemove', e => {
    if ((!dragging && !isMobile) || firstPerson) {
      if (firstPerson && dragging) {
        camYaw -= e.movementX * 0.004;
        camPitch -= e.movementY * 0.003;
        camPitch = Math.max(-1.2, Math.min(1.2, camPitch));
      }
      return;
    }
    if (dragging) {
      camYaw -= e.movementX * 0.005;
      camPitch += e.movementY * 0.004;
      camPitch = Math.max(0.1, Math.min(1.2, camPitch));
    }
  });
  renderer.domElement.addEventListener('wheel', e => {
    if (!firstPerson) targetCamDist = THREE.MathUtils.clamp(targetCamDist + e.deltaY * 0.008, 4, 16);
  }, { passive: true });
  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

  if (isMobile) setupMobileControls();

  document.getElementById('camToggle')?.addEventListener('click', toggleCamera);
  document.getElementById('camBtn')?.addEventListener('click', toggleCamera);

  window.addEventListener('resize', onResize);
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = '../';
  });

  const startAudio = () => {
    if (!audioCtx) initAudio();
    document.body.removeEventListener('click', startAudio);
    document.body.removeEventListener('touchstart', startAudio);
  };
  document.body.addEventListener('click', startAudio);
  document.body.addEventListener('touchstart', startAudio);

  lastPos.copy(player.pos);
  updateChunks();
  setTimeout(() => document.getElementById('loading').classList.add('hidden'), 800);
  animate();
}

function toggleCamera() {
  firstPerson = !firstPerson;
  document.getElementById('camModeLabel').textContent =
    (firstPerson ? 'First-person' : 'Third-person') + ' · Living city';
  if (firstPerson) {
    camPitch = 0;
  } else {
    camPitch = 0.38;
    targetCamDist = 7.8;
  }
}

function trySit() {
  if (player.sitting) {
    player.sitting = false;
    return;
  }
  for (const b of benches) {
    if (b.position.distanceTo(player.pos) < 2.2) {
      player.sitting = true;
      player.pos.x = b.position.x;
      player.pos.z = b.position.z + 0.3;
      player.yaw = b.rotation.y + Math.PI;
      break;
    }
  }
}

// ─────────────────────────────────────────────
// AUDIO
// ─────────────────────────────────────────────
function initAudio() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ambGain = audioCtx.createGain();
    ambGain.gain.value = 0.03;
    ambGain.connect(audioCtx.destination);

    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 52;
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 160;
    osc.connect(filt);
    filt.connect(ambGain);
    osc.start();

    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuf = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const nGain = audioCtx.createGain();
    nGain.gain.value = 0.01;
    noise.connect(nGain);
    nGain.connect(ambGain);
    noise.start();
  } catch (e) {}
}

// ─────────────────────────────────────────────
// CREATORS
// ─────────────────────────────────────────────
function createPerson(shirtColor, pantsColor, isPlayer = false) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.85 });
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.85 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.28), shirt);
  torso.position.y = 1.15;
  torso.castShadow = true;
  g.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.3), skin);
  head.position.y = 1.6;
  head.castShadow = true;
  g.add(head);

  // Phone for idle
  const phone = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.14, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x111111 })
  );
  phone.position.set(0.28, 1.25, 0.18);
  phone.visible = false;
  g.add(phone);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.18), pants);
  legL.position.set(-0.12, 0.4, 0);
  legL.castShadow = true;
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.12;
  g.add(legR);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.45, 0.13), shirt);
  armL.position.set(-0.32, 1.15, 0);
  armL.castShadow = true;
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.32;
  g.add(armR);

  g.userData = { legL, legR, armL, armR, phone, phase: Math.random() * Math.PI * 2, isPlayer };
  return g;
}

function createCar(color, type = 'normal') {
  const g = new THREE.Group();
  let bodyColor = color;
  let isEmergency = false;

  if (type === 'police') {
    bodyColor = 0x1a1a2e;
    isEmergency = true;
  } else if (type === 'ambulance') {
    bodyColor = 0xf5f5f5;
    isEmergency = true;
  }

  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.2), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), bodyMat);
  cabin.position.set(0, 1.05, -0.2);
  cabin.castShadow = true;
  g.add(cabin);

  if (type === 'ambulance') {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.95, 0.2, 4.25),
      new THREE.MeshBasicMaterial({ color: 0xcc2222 })
    );
    stripe.position.y = 0.7;
    g.add(stripe);
  }

  const glass = new THREE.MeshBasicMaterial({ color: 0x88aacc });
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.4, 1.9), glass);
  win.position.set(0, 1.1, -0.15);
  g.add(win);

  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const [x, y, z] of [[-0.85, 0.28, 1.3], [0.85, 0.28, 1.3], [-0.85, 0.28, -1.3], [0.85, 0.28, -1.3]]) {
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

  // Emergency lights
  if (isEmergency) {
    const sirenMat = new THREE.MeshBasicMaterial({ color: type === 'police' ? 0x2244ff : 0xff2222 });
    const siren = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), sirenMat);
    siren.position.set(0, 1.45, -0.3);
    g.add(siren);
    g.userData.siren = siren;
    g.userData.sirenMat = sirenMat;
    g.userData.sirenType = type;
  }

  g.userData.type = type;
  g.userData.isEmergency = isEmergency;
  return g;
}

function createBuilding(w, d, h, color, seed) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.12 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.y = h / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);

  const winOn = new THREE.MeshBasicMaterial({ color: 0xffe6a0 });
  const winOff = new THREE.MeshBasicMaterial({ color: 0x1a2230 });
  const floors = Math.floor(h / 3.1);
  const colsX = Math.max(2, Math.floor(w / 2.4));
  const colsZ = Math.max(2, Math.floor(d / 2.4));

  for (let f = 1; f < floors; f++) {
    for (let c = 0; c < colsX; c++) {
      const lit = hash(seed + f * 17 + c * 3, 1) > 0.55;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.15), lit ? winOn : winOff);
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
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.15), lit ? winOn : winOff);
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

  const ledge = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.4, 0.35, d + 0.4),
    new THREE.MeshStandardMaterial({ color: 0x333340, roughness: 0.7 })
  );
  ledge.position.y = h + 0.1;
  g.add(ledge);

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
  [[3.0, 1.9, 2.2], [4.3, 1.4, 1.7], [5.3, 0.85, 1.2]].forEach(([y, r, h]) => {
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
  const light = new THREE.PointLight(0xffcc88, 0, 22, 2); // start off
  light.position.y = 5.7;
  g.add(light);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x444433 })
  );
  bulb.position.y = 5.7;
  g.add(bulb);
  g.userData = { light, bulb };
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

function createTrashCan() {
  const g = new THREE.Group();
  const can = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.32, 0.9, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a3a42, metalness: 0.4, roughness: 0.5 })
  );
  can.position.y = 0.45;
  g.add(can);
  return g;
}

function createTrafficLightHead() {
  const g = new THREE.Group();
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 1.05, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x222228, metalness: 0.4, roughness: 0.5 })
  );
  g.add(housing);
  const mats = [0x222222, 0x222222, 0x222222].map(c => new THREE.MeshBasicMaterial({ color: c }));
  const positions = [0.32, 0, -0.32];
  const lights = [];
  for (let i = 0; i < 3; i++) {
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), mats[i]);
    lens.position.set(0, positions[i], 0.15);
    g.add(lens);
    lights.push({ mesh: lens, mat: mats[i] });
  }
  g.userData.lights = lights;
  return g;
}

function createTrafficLightPole(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 4.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x333340, metalness: 0.5, roughness: 0.4 })
  );
  pole.position.y = 2.1;
  g.add(pole);

  const headNS = createTrafficLightHead();
  headNS.position.set(0, 4.0, 0.25);
  g.add(headNS);

  const headEW = createTrafficLightHead();
  headEW.position.set(0.25, 4.0, 0);
  headEW.rotation.y = Math.PI / 2;
  g.add(headEW);

  // Pedestrian signal box
  const pedBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.5, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x222228 })
  );
  pedBox.position.set(-0.4, 1.6, 0.3);
  g.add(pedBox);
  const pedMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const pedLight = new THREE.Mesh(new THREE.CircleGeometry(0.08, 10), pedMat);
  pedLight.position.set(-0.4, 1.7, 0.37);
  g.add(pedLight);

  g.position.set(x, 0, z);
  g.userData = { headNS, headEW, pedLight, pedMat };
  return g;
}

function createCrosswalk(wx, wz, alongX) {
  const g = new THREE.Group();
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
  const num = 6;
  const len = STREET_W * 0.9;
  for (let i = 0; i < num; i++) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(alongX ? 0.45 : len, alongX ? len : 0.45),
      stripeMat
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.y = 0.03;
    if (alongX) {
      stripe.position.x = (i - (num - 1) / 2) * 0.7;
    } else {
      stripe.position.z = (i - (num - 1) / 2) * 0.7;
    }
    g.add(stripe);
  }
  g.position.set(wx, 0, wz);
  return g;
}

function createRain() {
  const count = isMobile ? 400 : 900;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 60;
    positions[i * 3 + 1] = Math.random() * 30;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xaaccff,
    size: 0.08,
    transparent: true,
    opacity: 0.55,
    depthWrite: false
  });
  rainParticles = new THREE.Points(geo, mat);
  rainParticles.visible = false;
  scene.add(rainParticles);
}

// ─────────────────────────────────────────────
// HASH + BIOME + LIGHTS
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

function getLightState(axis, phaseOffset = 0) {
  const t = (performance.now() / 1000 + phaseOffset) % CYCLE_TOTAL;
  let state;
  if (t < CYCLE_GREEN) state = 'green';
  else if (t < CYCLE_GREEN + CYCLE_YELLOW) state = 'yellow';
  else state = 'red';

  if (axis === 'EW') {
    if (state === 'green') state = 'red';
    else if (state === 'red') state = 'green';
    else state = 'red';
  }
  return state;
}

function updateTrafficLightVisuals(tl) {
  const stateNS = getLightState('NS', tl.phaseOffset);
  const stateEW = getLightState('EW', tl.phaseOffset);

  const apply = (head, state) => {
    const lights = head.userData.lights;
    lights[0].mat.color.setHex(state === 'red' ? 0xff2222 : 0x331111);
    lights[1].mat.color.setHex(state === 'yellow' ? 0xffcc00 : 0x332200);
    lights[2].mat.color.setHex(state === 'green' ? 0x22ff44 : 0x113311);
  };
  apply(tl.group.userData.headNS, stateNS);
  apply(tl.group.userData.headEW, stateEW);

  // Pedestrian light: green when cars are red
  const pedSafe = stateNS === 'red';
  tl.group.userData.pedMat.color.setHex(pedSafe ? 0x22ff44 : 0xff2222);
}

function getCarSignal(car) {
  const yaw = car.rotation.y;
  const alongNS = Math.abs(Math.sin(yaw)) < 0.7;
  let nearest = null;
  let nearestDist = 22;

  for (const tl of trafficLights) {
    const dx = tl.x - car.position.x;
    const dz = tl.z - car.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < nearestDist) {
      const fwdX = Math.sin(yaw);
      const fwdZ = Math.cos(yaw);
      const toLight = dx * fwdX + dz * fwdZ;
      if (toLight > -2 && toLight < 16) {
        nearest = tl;
        nearestDist = dist;
      }
    }
  }
  if (!nearest) return { state: 'green', dist: 999 };
  const axis = alongNS ? 'NS' : 'EW';
  return { state: getLightState(axis, nearest.phaseOffset), dist: nearestDist, tl: nearest };
}

function isPedestrianSafe(tl) {
  return getLightState('NS', tl.phaseOffset) === 'red';
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

  if (biome !== 'forest') {
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.9 });
    for (let iz = 0; iz < CHUNK_SIZE; iz += GRID) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CHUNK_SIZE, STREET_W), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(CHUNK_SIZE / 2, 0.02, iz + STREET_W / 2);
      road.receiveShadow = true;
      group.add(road);
    }
    for (let ix = 0; ix < CHUNK_SIZE; ix += GRID) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(STREET_W, CHUNK_SIZE), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(ix + STREET_W / 2, 0.025, CHUNK_SIZE / 2);
      road.receiveShadow = true;
      group.add(road);
    }

    // Intersections
    for (let ix = 0; ix < CHUNK_SIZE; ix += GRID) {
      for (let iz = 0; iz < CHUNK_SIZE; iz += GRID) {
        const wx = cx * CHUNK_SIZE + ix + STREET_W / 2;
        const wz = cz * CHUNK_SIZE + iz + STREET_W / 2;

        const tlGroup = createTrafficLightPole(wx + 4.5, wz + 4.5);
        scene.add(tlGroup);
        const phaseOffset = hash(Math.floor(wx / GRID), Math.floor(wz / GRID)) * CYCLE_TOTAL;
        trafficLights.push({ x: wx, z: wz, group: tlGroup, phaseOffset });

        group.add(
          createCrosswalk(wx, wz - STREET_W * 0.55, true),
          createCrosswalk(wx, wz + STREET_W * 0.55, true),
          createCrosswalk(wx - STREET_W * 0.55, wz, false),
          createCrosswalk(wx + STREET_W * 0.55, wz, false)
        );
      }
    }
  }

  // Buildings + furniture
  if (biome === 'city' || biome === 'mixed') {
    for (let ix = 0; ix < CHUNK_SIZE - 2; ix += GRID) {
      for (let iz = 0; iz < CHUNK_SIZE - 2; iz += GRID) {
        if (rng(ix, iz) > (biome === 'mixed' ? 0.5 : 0.18)) continue;

        const bw = 7 + rng(ix + 1, iz) * 11;
        const bd = 7 + rng(ix, iz + 1) * 11;
        const bh = BUILDING_MIN_H + rng(ix + 2, iz + 2) * (BUILDING_MAX_H - BUILDING_MIN_H);
        const col = new THREE.Color().setHSL(
          0.08 + rng(ix + 3, iz) * 0.55,
          0.08 + rng(ix, iz + 3) * 0.18,
          0.28 + rng(ix + 4, iz + 4) * 0.25
        );

        const b = createBuilding(bw, bd, bh, col, Math.floor(rng(ix, iz) * 10000));
        b.position.set(
          ix + STREET_W + bw / 2 + (rng(ix + 5, iz) - 0.5) * 1.5,
          0,
          iz + STREET_W + bd / 2 + (rng(ix, iz + 5) - 0.5) * 1.5
        );
        group.add(b);

        if (rng(ix + 8, iz + 8) > 0.5) {
          const lamp = createLamp();
          lamp.position.set(ix + 2.5, 0, iz + 2.5);
          group.add(lamp);
          streetLamps.push(lamp);
        }
        if (rng(ix + 9, iz + 9) > 0.68) {
          const bench = createBench();
          bench.position.set(
            cx * CHUNK_SIZE + ix + STREET_W + 1.8,
            0,
            cz * CHUNK_SIZE + iz + 3.5
          );
          bench.rotation.y = Math.PI / 2;
          scene.add(bench);
          benches.push(bench);
          group.add(bench); // also keep reference in chunk for cleanup later if needed
        }
        if (rng(ix + 11, iz + 11) > 0.75) {
          const trash = createTrashCan();
          trash.position.set(ix + STREET_W + 0.8, 0, iz + 1.5);
          group.add(trash);
        }

        // Parked cars along curb
        if (rng(ix + 20, iz + 20) > 0.55) {
          const colors = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x2c3e50, 0xecf0f1, 0x8e44ad, 0xd35400];
          const pc = createCar(colors[Math.floor(rng(ix + 21, iz) * colors.length)]);
          pc.position.set(
            cx * CHUNK_SIZE + ix + STREET_W + 3 + rng(ix, 22) * 4,
            0,
            cz * CHUNK_SIZE + iz + 1.8
          );
          pc.rotation.y = Math.PI / 2 + (rng(ix, 23) - 0.5) * 0.15;
          scene.add(pc);
          parkedCars.push(pc);
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
      if (biome !== 'forest' && (x % GRID < STREET_W + 2)) continue;
      const tree = createTree(0.8 + rng(i, 19) * 0.7);
      tree.position.set(x, 0, z);
      tree.rotation.y = rng(i, 23) * Math.PI * 2;
      group.add(tree);
    }
  }

  // Moving cars + emergency
  if (biome !== 'forest') {
    const carCount = 3 + Math.floor(rng(50, 50) * 3);
    for (let i = 0; i < carCount; i++) {
      const r = rng(i + 60, 1);
      let type = 'normal';
      let color = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0x2c3e50, 0xecf0f1, 0xd35400][Math.floor(r * 8)];
      if (r > 0.92) type = 'police';
      else if (r > 0.85) type = 'ambulance';

      const car = createCar(color, type);
      const alongX = rng(i + 70, 2) > 0.5;
      const roadIdx = Math.floor(rng(i + 80, 3) * 2);
      const base = roadIdx * GRID + STREET_W / 2;
      // slight lane offset
      const laneOff = (rng(i, 11) > 0.5 ? 1.3 : -1.3);

      if (alongX) {
        car.position.set(rng(i, 4) * CHUNK_SIZE, 0, base + laneOff);
        car.rotation.y = rng(i, 5) > 0.5 ? 0 : Math.PI;
      } else {
        car.position.set(base + laneOff, 0, rng(i, 6) * CHUNK_SIZE);
        car.rotation.y = rng(i, 7) > 0.5 ? Math.PI / 2 : -Math.PI / 2;
      }
      car.position.x += cx * CHUNK_SIZE;
      car.position.z += cz * CHUNK_SIZE;

      car.userData.baseSpeed = type === 'normal' ? 5 + rng(i, 8) * 5 : 9 + rng(i, 8) * 4;
      car.userData.speed = car.userData.baseSpeed;
      car.userData.dir = car.rotation.y;
      car.userData.life = 55 + rng(i, 9) * 40;
      car.userData.stopped = false;
      car.userData.pullOver = false;
      scene.add(car);
      cars.push(car);
    }

    // NPCs
    const npcCount = 5 + Math.floor(rng(90, 90) * 5);
    for (let i = 0; i < npcCount; i++) {
      const shirts = [0xe74c3c, 0x3498db, 0x2ecc71, 0x9b59b6, 0xf1c40f, 0x1abc9c, 0xe67e22, 0x34495e];
      const pants = [0x2c3e50, 0x34495e, 0x1a1a2e, 0x4a3728];
      const person = createPerson(
        shirts[Math.floor(rng(i + 100, 1) * shirts.length)],
        pants[Math.floor(rng(i + 110, 2) * pants.length)]
      );
      // Prefer sidewalk-ish positions
      person.position.set(
        cx * CHUNK_SIZE + rng(i + 120, 3) * CHUNK_SIZE,
        0,
        cz * CHUNK_SIZE + rng(i + 130, 4) * CHUNK_SIZE
      );
      person.rotation.y = rng(i, 15) * Math.PI * 2;
      person.userData.speed = 1.0 + rng(i, 16) * 1.5;
      person.userData.dir = person.rotation.y;
      person.userData.turnTimer = 2 + rng(i, 17) * 5;
      person.userData.waiting = false;
      person.userData.idle = rng(i, 18) > 0.7;
      person.userData.sitTarget = null;
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

  const maxD = (VIEW_DIST + 1.8) * CHUNK_SIZE;
  trafficLights = trafficLights.filter(tl => {
    if (Math.hypot(tl.x - player.pos.x, tl.z - player.pos.z) > maxD) {
      scene.remove(tl.group);
      return false;
    }
    return true;
  });

  cars = cars.filter(c => {
    if (c.position.distanceTo(player.pos) > maxD) { scene.remove(c); return false; }
    return true;
  });
  npcs = npcs.filter(n => {
    if (n.position.distanceTo(player.pos) > maxD) { scene.remove(n); return false; }
    return true;
  });
  parkedCars = parkedCars.filter(c => {
    if (c.position.distanceTo(player.pos) > maxD) { scene.remove(c); return false; }
    return true;
  });
  benches = benches.filter(b => b.position.distanceTo(player.pos) < maxD);
  streetLamps = streetLamps.filter(l => l.position.distanceTo(player.pos) < maxD + 20);
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
        if (firstPerson) {
          camPitch -= dy * 0.005;
          camPitch = Math.max(-1.2, Math.min(1.2, camPitch));
        } else {
          camPitch += dy * 0.005;
          camPitch = Math.max(0.1, Math.min(1.2, camPitch));
        }
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
    if (!btn) return;
    btn.addEventListener('touchstart', e => { e.preventDefault(); setter(true); btn.classList.add('active'); }, { passive: false });
    btn.addEventListener('touchend', e => { e.preventDefault(); setter(false); btn.classList.remove('active'); }, { passive: false });
  };
  hold(document.getElementById('sprintBtn'), v => sprintHeld = v);
  hold(document.getElementById('jumpBtn'), v => { if (v) jumpPressed = true; });
}

// ─────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────
function updatePlayer(dt) {
  if (player.bumpTimer > 0) {
    player.bumpTimer -= dt;
    playerMesh.rotation.z = Math.sin(player.bumpTimer * 20) * 0.15;
  } else {
    playerMesh.rotation.z = 0;
  }

  if (player.sitting) {
    playerMesh.position.copy(player.pos);
    playerMesh.rotation.y = player.yaw;
    // Sit pose
    if (playerMesh.userData.legL) {
      playerMesh.userData.legL.rotation.x = -1.2;
      playerMesh.userData.legR.rotation.x = -1.2;
    }
    // Camera still updates below
  } else {
    const wantsSprint = keys['ShiftLeft'] || keys['ShiftRight'] || sprintHeld;
    let speed = 4.6;
    if (wantsSprint && player.stamina > 5) {
      speed = 9.2;
      player.stamina = Math.max(0, player.stamina - 22 * dt);
    } else {
      player.stamina = Math.min(100, player.stamina + 12 * dt);
    }

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
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      const dx = (mx * cos + mz * sin) * speed * dt;
      const dz = (-mx * sin + mz * cos) * speed * dt;

      // Collision vs buildings
      const tryPos = player.pos.clone().add(new THREE.Vector3(dx, 0, dz));
      let blocked = false;
      const checkR = 0.5;
      for (const ch of chunks.values()) {
        ch.group.traverse(o => {
          if (o.isMesh && o.geometry && o.geometry.type === 'BoxGeometry') {
            const box = new THREE.Box3().setFromObject(o);
            if (box.max.y > 3.5) {
              const cx = (box.min.x + box.max.x) / 2;
              const cz = (box.min.z + box.max.z) / 2;
              if (Math.abs(tryPos.x - cx) < (box.max.x - box.min.x) / 2 + checkR &&
                  Math.abs(tryPos.z - cz) < (box.max.z - box.min.z) / 2 + checkR) {
                blocked = true;
              }
            }
          }
        });
        if (blocked) break;
      }
      if (!blocked) {
        player.pos.x += dx;
        player.pos.z += dz;
      }
      player.yaw = Math.atan2(dx, dz);
    }

    // Car bump
    for (const car of cars) {
      if (car.position.distanceTo(player.pos) < 2.4 && car.userData.speed > 2) {
        player.bumpTimer = 0.6;
        const push = new THREE.Vector3().subVectors(player.pos, car.position).normalize();
        player.pos.addScaledVector(push, 0.8);
        break;
      }
    }

    if ((keys['Space'] || jumpPressed) && player.onGround) {
      player.velocity.y = 7.0;
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

    playerMesh.position.copy(player.pos);
    playerMesh.rotation.y = player.yaw;

    const moving = mx !== 0 || mz !== 0;
    const phase = performance.now() * (wantsSprint ? 0.018 : 0.012);
    if (playerMesh.userData.legL) {
      const swing = moving ? Math.sin(phase) * 0.55 : 0;
      playerMesh.userData.legL.rotation.x = swing;
      playerMesh.userData.legR.rotation.x = -swing;
      playerMesh.userData.armL.rotation.x = -swing * 0.7;
      playerMesh.userData.armR.rotation.x = swing * 0.7;
    }
  }

  totalDist += player.pos.distanceTo(lastPos);
  lastPos.copy(player.pos);

  // Camera
  if (firstPerson) {
    camera.position.set(
      player.pos.x,
      player.pos.y + 1.65,
      player.pos.z
    );
    const lookX = camera.position.x - Math.sin(camYaw) * Math.cos(camPitch);
    const lookY = camera.position.y + Math.sin(camPitch);
    const lookZ = camera.position.z - Math.cos(camYaw) * Math.cos(camPitch);
    camera.lookAt(lookX, lookY, lookZ);
    playerMesh.visible = false;
  } else {
    playerMesh.visible = true;
    camDist += (targetCamDist - camDist) * 0.1;
    const camX = player.pos.x + Math.sin(camYaw) * camDist * Math.cos(camPitch);
    const camZ = player.pos.z + Math.cos(camYaw) * camDist * Math.cos(camPitch);
    const camY = player.pos.y + 1.4 + Math.sin(camPitch) * camDist;
    camera.position.set(camX, camY, camZ);
    camera.lookAt(player.pos.x, player.pos.y + 1.3, player.pos.z);
  }

  sun.position.x = player.pos.x + 50;
  sun.position.z = player.pos.z + 40;
}

function updateDynamics(dt) {
  // Traffic lights
  for (const tl of trafficLights) updateTrafficLightVisuals(tl);

  // Detect nearby emergency vehicles
  let emergencyNear = false;
  for (const car of cars) {
    if (car.userData.isEmergency && car.position.distanceTo(player.pos) < 55) {
      emergencyNear = true;
      // Flash siren
      if (car.userData.sirenMat) {
        const flash = Math.sin(performance.now() * 0.015) > 0;
        if (car.userData.sirenType === 'police') {
          car.userData.sirenMat.color.setHex(flash ? 0x2244ff : 0xff2222);
        } else {
          car.userData.sirenMat.color.setHex(flash ? 0xff2222 : 0xffffff);
        }
      }
    }
  }

  // Cars
  for (const car of cars) {
    const ud = car.userData;
    const signal = getCarSignal(car);

    // Pull over for emergency
    if (emergencyNear && !ud.isEmergency) {
      ud.pullOver = true;
      ud.speed = Math.max(0, ud.speed - 10 * dt);
    } else {
      ud.pullOver = false;
      if (signal.state === 'red' && signal.dist < 13) {
        ud.speed = Math.max(0, ud.speed - 14 * dt);
        ud.stopped = true;
      } else if (signal.state === 'yellow' && signal.dist < 15) {
        ud.speed = Math.max(ud.baseSpeed * 0.3, ud.speed - 7 * dt);
        ud.stopped = false;
      } else {
        ud.speed = Math.min(ud.baseSpeed, ud.speed + 6 * dt);
        ud.stopped = false;
      }
    }

    if (ud.speed > 0.08) {
      car.position.x += Math.sin(ud.dir) * ud.speed * dt;
      car.position.z += Math.cos(ud.dir) * ud.speed * dt;
    }

    ud.life -= dt;
    if (ud.life < 0) {
      ud.life = 50 + Math.random() * 50;
      const ang = Math.random() * Math.PI * 2;
      car.position.set(
        player.pos.x + Math.cos(ang) * 48,
        0,
        player.pos.z + Math.sin(ang) * 48
      );
      ud.dir = Math.random() * Math.PI * 2;
      car.rotation.y = ud.dir;
      ud.speed = ud.baseSpeed;
    }
  }

  // NPCs
  for (const npc of npcs) {
    const ud = npc.userData;

    // Sit on nearby bench occasionally
    if (!ud.waiting && !ud.sitting && Math.random() < 0.0008) {
      for (const b of benches) {
        if (b.position.distanceTo(npc.position) < 8) {
          ud.sitTarget = b;
          ud.sitting = true;
          break;
        }
      }
    }
    if (ud.sitting && ud.sitTarget) {
      const b = ud.sitTarget;
      npc.position.x += (b.position.x - npc.position.x) * 0.04;
      npc.position.z += (b.position.z + 0.3 - npc.position.z) * 0.04;
      npc.rotation.y = b.rotation.y + Math.PI;
      if (ud.legL) {
        ud.legL.rotation.x = -1.15;
        ud.legR.rotation.x = -1.15;
      }
      if (Math.random() < 0.002) {
        ud.sitting = false;
        ud.sitTarget = null;
      }
      continue;
    }

    // Crosswalk logic
    let nearestTl = null;
    let nearestD = 12;
    for (const tl of trafficLights) {
      const d = Math.hypot(tl.x - npc.position.x, tl.z - npc.position.z);
      if (d < nearestD) {
        nearestD = d;
        nearestTl = tl;
      }
    }

    if (nearestTl && nearestD < 8.5) {
      const safe = isPedestrianSafe(nearestTl);
      if (!safe) {
        ud.waiting = true;
        // Idle phone animation
        if (ud.phone) {
          ud.phone.visible = true;
          ud.armR.rotation.x = -0.9;
          ud.armR.rotation.z = -0.4;
        }
        if (ud.legL) {
          ud.legL.rotation.x = 0;
          ud.legR.rotation.x = 0;
        }
        continue;
      } else {
        ud.waiting = false;
        if (ud.phone) ud.phone.visible = false;
        const toX = nearestTl.x - npc.position.x;
        const toZ = nearestTl.z - npc.position.z;
        ud.dir = Math.atan2(toX, toZ);
        npc.rotation.y = ud.dir;
      }
    } else {
      ud.waiting = false;
      if (ud.phone) ud.phone.visible = false;
      ud.turnTimer -= dt;
      if (ud.turnTimer <= 0) {
        ud.dir += (Math.random() - 0.5) * 1.5;
        ud.turnTimer = 2.5 + Math.random() * 5;
        npc.rotation.y = ud.dir;
      }
    }

    if (!ud.waiting) {
      npc.position.x += Math.sin(ud.dir) * ud.speed * dt;
      npc.position.z += Math.cos(ud.dir) * ud.speed * dt;
      if (ud.legL) {
        const swing = Math.sin(performance.now() * 0.01 + ud.phase) * 0.5;
        ud.legL.rotation.x = swing;
        ud.legR.rotation.x = -swing;
        ud.armL.rotation.x = -swing * 0.6;
        ud.armR.rotation.x = swing * 0.6;
      }
    }
  }
}

function updateAtmosphere(dt) {
  dayTime = (dayTime + dt * 0.0055) % 1;
  const t = dayTime;

  // Weather change
  weatherTimer -= dt;
  if (weatherTimer <= 0) {
    const r = Math.random();
    if (r < 0.55) weather = 'clear';
    else if (r < 0.8) weather = 'rain';
    else weather = 'fog';
    weatherTimer = 25 + Math.random() * 40;
  }

  let sunI, ambI, sky, dens;
  if (t < 0.2 || t > 0.88) {
    sunI = 0.04; ambI = 0.1;
    sky = new THREE.Color(0x080e1a);
    dens = weather === 'fog' ? 0.028 : 0.019;
  } else if (t < 0.28) {
    const k = (t - 0.2) / 0.08;
    sunI = 0.04 + k * 1.05; ambI = 0.1 + k * 0.32;
    sky = new THREE.Color().lerpColors(new THREE.Color(0x080e1a), new THREE.Color(0xff9966), k);
    dens = 0.018 - k * 0.005;
  } else if (t < 0.72) {
    sunI = weather === 'rain' ? 0.7 : 1.12;
    ambI = weather === 'rain' ? 0.35 : 0.45;
    sky = weather === 'rain' ? new THREE.Color(0x6a7a8a) : new THREE.Color(0x87b8e8);
    dens = weather === 'fog' ? 0.022 : (weather === 'rain' ? 0.016 : 0.012);
  } else {
    const k = (t - 0.72) / 0.16;
    sunI = 1.1 - k * 1.05; ambI = 0.42 - k * 0.32;
    sky = new THREE.Color().lerpColors(new THREE.Color(0x87b8e8), new THREE.Color(0xff6644), Math.min(1, k * 1.3));
    dens = 0.012 + k * 0.007;
  }

  sun.intensity = sunI;
  ambient.intensity = ambI;
  hemi.intensity = ambI * 0.85;
  scene.background.copy(sky);
  scene.fog.color.copy(sky);
  scene.fog.density = dens;

  const angle = (t - 0.25) * Math.PI * 2;
  sun.position.y = Math.sin(angle) * 95 + 25;

  // Street lamps auto on at night
  const night = t < 0.22 || t > 0.82;
  for (const lamp of streetLamps) {
    if (lamp.userData.light) {
      lamp.userData.light.intensity = night ? 1.15 : 0;
      if (lamp.userData.bulb) {
        lamp.userData.bulb.material.color.setHex(night ? 0xffe8a8 : 0x444433);
      }
    }
  }

  // Rain particles
  if (rainParticles) {
    rainParticles.visible = weather === 'rain';
    if (weather === 'rain') {
      rainParticles.position.copy(player.pos);
      rainParticles.position.y = 0;
      const pos = rainParticles.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i + 1] -= 18 * dt;
        if (pos[i + 1] < 0) pos[i + 1] = 25 + Math.random() * 8;
      }
      rainParticles.geometry.attributes.position.needsUpdate = true;
    }
  }
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
  document.getElementById('weather').textContent =
    weather === 'rain' ? 'Rain' : weather === 'fog' ? 'Fog' : 'Clear';
  document.getElementById('stamina').textContent = `${Math.floor(player.stamina)}%`;
}

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
