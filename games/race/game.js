import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ============================================================
   RACE – Realistic 3D Racing Game
   Modes: Race (vs bots) | Explore (infinite procedural world)
   ============================================================ */

const canvas = document.getElementById('game');
const menuEl = document.getElementById('menu');
const hudEl = document.getElementById('hud');
const speedEl = document.getElementById('speed');
const lapEl = document.getElementById('lap');
const posEl = document.getElementById('position');
const timerEl = document.getElementById('timer');
const modeLabel = document.getElementById('mode-label');
const lapInfo = document.getElementById('lap-info');
const countdownEl = document.getElementById('countdown');
const finishEl = document.getElementById('finish');
const finishTitle = document.getElementById('finish-title');
const finishTime = document.getElementById('finish-time');
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');

// ─── State ───────────────────────────────────────────────────
let mode = null; // 'race' | 'explore'
let running = false;
let raceStarted = false;
let raceFinished = false;
let startTime = 0;
let raceTime = 0;
let currentLap = 1;
const TOTAL_LAPS = 3;
let lastCheckpoint = 0;
let checkpointsPassed = 0;

// ─── Input ───────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Escape') returnToMenu(); });
window.addEventListener('keyup', e => { keys[e.code] = false; });

// ─── Three.js setup ──────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 80, 420);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
let camMode = 0; // 0 = chase, 1 = hood, 2 = free

// Lights
const hemi = new THREE.HemisphereLight(0xb1e1ff, 0xb97a20, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff5e0, 1.4);
sun.position.set(80, 120, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 400;
sun.shadow.camera.left = -120;
sun.shadow.camera.right = 120;
sun.shadow.camera.top = 120;
sun.shadow.camera.bottom = -120;
sun.shadow.bias = -0.0003;
scene.add(sun);

// ─── Simplex / Perlin-ish noise (for infinite terrain) ────────
function hash(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function noise2D(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function fbm(x, z, octaves = 5) {
  let val = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    val += noise2D(x * freq, z * freq) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / max;
}

// ─── Terrain height function ─────────────────────────────────
function getTerrainHeight(x, z) {
  // Base rolling hills
  let h = fbm(x * 0.008, z * 0.008, 4) * 18;
  // Mountains
  const m = fbm(x * 0.003 + 100, z * 0.003 + 100, 5);
  if (m > 0.55) h += (m - 0.55) * 90;
  // Rivers (valleys)
  const river = Math.abs(fbm(x * 0.004 + 50, z * 0.004 + 50, 3) - 0.5);
  if (river < 0.06) h -= (0.06 - river) * 80;
  return h;
}

function isRiver(x, z) {
  const river = Math.abs(fbm(x * 0.004 + 50, z * 0.004 + 50, 3) - 0.5);
  return river < 0.045;
}

function isRoad(x, z) {
  // Infinite procedural road network – main axis + branches
  const roadNoise = fbm(x * 0.002, z * 0.002, 2);
  // Horizontal main roads every ~200 units
  const hx = Math.abs((x % 200) - 100);
  const hz = Math.abs((z % 200) - 100);
  // Slightly curved
  const curve = Math.sin(z * 0.01) * 8;
  if (Math.abs(x - curve) % 180 < 6 || Math.abs(z + curve * 0.5) % 180 < 6) return true;
  // Secondary roads
  if ((hx < 5 && roadNoise > 0.4) || (hz < 5 && roadNoise > 0.45)) return true;
  return false;
}

// ─── Chunk system for infinite world ─────────────────────────
const CHUNK_SIZE = 64;
const CHUNK_RES = 32;
const VIEW_DIST = 4; // chunks
const chunks = new Map();
const treeGeo = new THREE.ConeGeometry(1.2, 4, 6);
const treeMat = new THREE.MeshStandardMaterial({ color: 0x2d6a2d, roughness: 0.85 });
const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 1.5, 6);
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 });
const rockGeo = new THREE.DodecahedronGeometry(1.2, 0);
const rockMat = new THREE.MeshStandardMaterial({ color: 0x6a6a5a, roughness: 0.95 });

function chunkKey(cx, cz) { return `${cx},${cz}`; }

function createChunk(cx, cz) {
  const group = new THREE.Group();
  group.userData = { cx, cz };

  // Terrain mesh
  const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_RES, CHUNK_RES);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const color = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    const wx = cx * CHUNK_SIZE + lx;
    const wz = cz * CHUNK_SIZE + lz;
    let h = getTerrainHeight(wx, wz);

    // Flatten roads a bit
    if (isRoad(wx, wz)) h = Math.max(h, getTerrainHeight(wx, wz) * 0.7 + 0.5);

    pos.setY(i, h);

    // Vertex colors
    if (isRiver(wx, wz)) {
      color.setHSL(0.55, 0.7, 0.35 + Math.random() * 0.1);
    } else if (isRoad(wx, wz)) {
      color.setHSL(0.08, 0.05, 0.25 + Math.random() * 0.05);
    } else if (h > 25) {
      color.setHSL(0.08, 0.1, 0.55 + (h - 25) * 0.01); // snow/rock
    } else if (h > 12) {
      color.setHSL(0.1, 0.25, 0.35); // rocky
    } else {
      color.setHSL(0.28, 0.45 + Math.random() * 0.15, 0.28 + Math.random() * 0.1); // grass
    }
    colors.push(color.r, color.g, color.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.05,
    flatShading: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  group.add(mesh);

  // Trees, rocks, bridges
  const density = 0.35;
  for (let i = 0; i < 40; i++) {
    const lx = (Math.random() - 0.5) * CHUNK_SIZE * 0.9;
    const lz = (Math.random() - 0.5) * CHUNK_SIZE * 0.9;
    const wx = cx * CHUNK_SIZE + lx;
    const wz = cz * CHUNK_SIZE + lz;
    const h = getTerrainHeight(wx, wz);

    if (isRiver(wx, wz) || isRoad(wx, wz) || h > 22) continue;

    if (Math.random() < density) {
      // Tree
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.75;
      trunk.castShadow = true;
      tree.add(trunk);
      const foliage = new THREE.Mesh(treeGeo, treeMat);
      foliage.position.y = 3.2;
      foliage.castShadow = true;
      tree.add(foliage);
      tree.position.set(lx, h, lz);
      tree.scale.setScalar(0.7 + Math.random() * 0.8);
      tree.rotation.y = Math.random() * Math.PI * 2;
      group.add(tree);
    } else if (Math.random() < 0.15) {
      // Rock
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(lx, h + 0.4, lz);
      rock.scale.setScalar(0.5 + Math.random() * 1.2);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      group.add(rock);
    }
  }

  // Simple bridges over rivers
  for (let i = 0; i < 3; i++) {
    const lx = (Math.random() - 0.5) * CHUNK_SIZE * 0.8;
    const lz = (Math.random() - 0.5) * CHUNK_SIZE * 0.8;
    const wx = cx * CHUNK_SIZE + lx;
    const wz = cz * CHUNK_SIZE + lz;
    if (isRiver(wx, wz)) {
      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.6, 4),
        new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.85 })
      );
      const h = getTerrainHeight(wx, wz) + 1.5;
      bridge.position.set(lx, h, lz);
      bridge.castShadow = true;
      bridge.receiveShadow = true;
      group.add(bridge);
    }
  }

  group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
  scene.add(group);
  chunks.set(chunkKey(cx, cz), group);
  return group;
}

function updateChunks(px, pz) {
  const cx = Math.floor(px / CHUNK_SIZE);
  const cz = Math.floor(pz / CHUNK_SIZE);
  const needed = new Set();

  for (let dx = -VIEW_DIST; dx <= VIEW_DIST; dx++) {
    for (let dz = -VIEW_DIST; dz <= VIEW_DIST; dz++) {
      const key = chunkKey(cx + dx, cz + dz);
      needed.add(key);
      if (!chunks.has(key)) createChunk(cx + dx, cz + dz);
    }
  }

  // Unload far chunks
  for (const [key, group] of chunks) {
    if (!needed.has(key)) {
      scene.remove(group);
      group.traverse(o => {
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

// ─── Vehicle class with realistic-ish physics ────────────────
class Car {
  constructor(color = 0xff3333, isPlayer = false) {
    this.isPlayer = isPlayer;
    this.mesh = this.createMesh(color);
    scene.add(this.mesh);

    // Physics state
    this.pos = new THREE.Vector3(0, 2, 0);
    this.vel = new THREE.Vector3();
    this.heading = 0; // yaw
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;
    this.angularVel = 0;
    this.steerAngle = 0;
    this.throttle = 0;
    this.brake = 0;
    this.handbrake = false;
    this.boost = 0;
    this.onGround = true;
    this.lap = 1;
    this.checkpoint = 0;
    this.finished = false;
    this.finishTime = 0;
    this.name = isPlayer ? 'You' : 'Bot';

    // Tuning
    this.maxSteer = 0.55;
    this.engineForce = 42;
    this.brakeForce = 55;
    this.drag = 0.42;
    this.rollingResistance = 8;
    this.lateralGrip = 18;
    this.handbrakeGrip = 4;
    this.mass = 1200;
  }

  createMesh(color) {
    const g = new THREE.Group();

    // Body
    const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 4.2), bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    g.add(body);

    // Cabin
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.5, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.4, roughness: 0.2 })
    );
    cabin.position.set(0, 1.05, -0.2);
    cabin.castShadow = true;
    g.add(cabin);

    // Windows
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x88aacc, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.6 });
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.08), glassMat);
    windshield.position.set(0, 1.1, 0.7);
    windshield.rotation.x = -0.3;
    g.add(windshield);

    // Wheels
    this.wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
    const positions = [
      [-0.95, 0.38, 1.35], [0.95, 0.38, 1.35],
      [-0.95, 0.38, -1.35], [0.95, 0.38, -1.35]
    ];
    positions.forEach((p, i) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(...p);
      w.castShadow = true;
      g.add(w);
      this.wheels.push(w);
    });

    // Headlights
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffaa, emissiveIntensity: 0.8 });
    [[-0.6, 0.55, 2.1], [0.6, 0.55, 2.1]].forEach(p => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.1), lightMat);
      l.position.set(...p);
      g.add(l);
    });

    // Taillights
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 });
    [[-0.6, 0.55, -2.1], [0.6, 0.55, -2.1]].forEach(p => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.08), tailMat);
      l.position.set(...p);
      g.add(l);
    });

    return g;
  }

  update(dt) {
    // Input
    if (this.isPlayer) {
      this.throttle = keys['KeyW'] || keys['ArrowUp'] ? 1 : 0;
      this.brake = keys['KeyS'] || keys['ArrowDown'] ? 1 : 0;
      const steerInput = (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0);
      this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, steerInput * this.maxSteer, 8 * dt);
      this.handbrake = keys['Space'];
      if (keys['ShiftLeft'] || keys['ShiftRight']) this.boost = Math.min(1, this.boost + dt * 2);
      else this.boost = Math.max(0, this.boost - dt * 1.5);
    }

    // Ground height
    const groundY = getTerrainHeight(this.pos.x, this.pos.z);
    const targetY = groundY + 0.55;

    // Simple ground check
    if (this.pos.y <= targetY + 0.3) {
      this.onGround = true;
      this.pos.y = THREE.MathUtils.lerp(this.pos.y, targetY, 12 * dt);
      // Align to terrain slope (approximate)
      const hL = getTerrainHeight(this.pos.x - 1, this.pos.z);
      const hR = getTerrainHeight(this.pos.x + 1, this.pos.z);
      const hF = getTerrainHeight(this.pos.x, this.pos.z + 1);
      const hB = getTerrainHeight(this.pos.x, this.pos.z - 1);
      this.roll = THREE.MathUtils.lerp(this.roll, Math.atan2(hL - hR, 2) * 0.6, 4 * dt);
      this.pitch = THREE.MathUtils.lerp(this.pitch, Math.atan2(hB - hF, 2) * 0.5, 4 * dt);
    } else {
      this.onGround = false;
      this.vel.y -= 25 * dt; // gravity
    }

    // Longitudinal force
    let force = 0;
    if (this.onGround) {
      force += this.throttle * this.engineForce * (1 + this.boost * 0.7);
      force -= this.brake * this.brakeForce * Math.sign(this.speed || 1);
      // Rolling resistance + drag
      force -= this.rollingResistance * Math.sign(this.speed);
      force -= this.drag * this.speed * Math.abs(this.speed) * 0.015;
    }

    this.speed += (force / this.mass) * 60 * dt; // scale for feel
    this.speed = THREE.MathUtils.clamp(this.speed, -25, 55 + this.boost * 15);

    // Steering & angular
    const steerFactor = this.onGround ? 1 : 0.15;
    const turnRate = this.steerAngle * Math.min(Math.abs(this.speed) * 0.08, 2.2) * steerFactor;
    this.heading += turnRate * dt * Math.sign(this.speed || 1);

    // Lateral grip / drift
    const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const right = new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading));

    // Desired velocity along heading
    const desiredVel = forward.clone().multiplyScalar(this.speed);
    // Current horizontal velocity
    const horizVel = new THREE.Vector3(this.vel.x, 0, this.vel.z);
    const slip = horizVel.clone().sub(desiredVel);
    const grip = this.handbrake ? this.handbrakeGrip : this.lateralGrip;
    const correction = slip.multiplyScalar(-grip * dt);
    this.vel.x += correction.x;
    this.vel.z += correction.z;

    // Apply forward speed
    this.vel.x = THREE.MathUtils.lerp(this.vel.x, desiredVel.x, 8 * dt);
    this.vel.z = THREE.MathUtils.lerp(this.vel.z, desiredVel.z, 8 * dt);

    // Integrate
    this.pos.addScaledVector(this.vel, dt);
    if (this.onGround) this.vel.y = 0;

    // Water / river slowdown
    if (isRiver(this.pos.x, this.pos.z) && this.pos.y < getTerrainHeight(this.pos.x, this.pos.z) + 1.5) {
      this.speed *= 0.92;
      this.vel.multiplyScalar(0.95);
    }

    // Update mesh
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.order = 'YXZ';
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.x = this.pitch;
    this.mesh.rotation.z = this.roll;

    // Spin wheels
    const wheelSpin = this.speed * dt * 2.5;
    this.wheels.forEach((w, i) => {
      w.rotation.x += wheelSpin;
      if (i < 2) w.rotation.y = this.steerAngle * 0.8; // front wheels steer
    });
  }

  // Simple AI for bots
  updateAI(dt, target) {
    if (!target) return;
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const desiredHeading = Math.atan2(dx, dz);
    let diff = desiredHeading - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    this.steerAngle = THREE.MathUtils.clamp(diff * 1.8, -this.maxSteer, this.maxSteer);
    this.throttle = 0.75 + Math.random() * 0.2;
    this.brake = Math.abs(diff) > 1.2 ? 0.4 : 0;
    this.handbrake = Math.abs(diff) > 1.6 && Math.abs(this.speed) > 15;
  }
}

// ─── Race track (for Race mode) ──────────────────────────────
let trackPoints = [];
let checkpoints = [];
let startLine = null;

function buildRaceTrack() {
  // Generate a fun closed track with elevation
  trackPoints = [];
  const radius = 90;
  for (let i = 0; i <= 80; i++) {
    const t = (i / 80) * Math.PI * 2;
    const r = radius + Math.sin(t * 3) * 25 + Math.cos(t * 5) * 12;
    const x = Math.cos(t) * r;
    const z = Math.sin(t) * r * 0.85;
    const y = getTerrainHeight(x, z) + 0.5;
    trackPoints.push(new THREE.Vector3(x, y, z));
  }

  // Road mesh along the spline
  const roadShape = new THREE.Shape();
  roadShape.moveTo(-5, 0);
  roadShape.lineTo(5, 0);
  roadShape.lineTo(5, 0.15);
  roadShape.lineTo(-5, 0.15);
  roadShape.closePath();

  // Simpler: place road segments
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.85 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });

  for (let i = 0; i < trackPoints.length - 1; i++) {
    const a = trackPoints[i];
    const b = trackPoints[i + 1];
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y = (getTerrainHeight(mid.x, mid.z) + getTerrainHeight(a.x, a.z) + getTerrainHeight(b.x, b.z)) / 3 + 0.3;

    const seg = new THREE.Mesh(new THREE.BoxGeometry(10, 0.25, len + 0.5), roadMat);
    seg.position.copy(mid);
    seg.lookAt(b.x, mid.y, b.z);
    seg.rotateX(Math.PI / 2);
    seg.receiveShadow = true;
    scene.add(seg);

    // Center line
    if (i % 2 === 0) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.28, 2), lineMat);
      line.position.copy(mid);
      line.lookAt(b.x, mid.y, b.z);
      line.rotateX(Math.PI / 2);
      scene.add(line);
    }
  }

  // Checkpoints
  checkpoints = [];
  for (let i = 0; i < 8; i++) {
    const idx = Math.floor((i / 8) * (trackPoints.length - 1));
    checkpoints.push(trackPoints[idx].clone());
  }

  // Start / finish banner
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(14, 4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0x443300 })
  );
  banner.position.copy(trackPoints[0]);
  banner.position.y += 4;
  scene.add(banner);
  startLine = trackPoints[0].clone();
}

// ─── Game objects ────────────────────────────────────────────
let player = null;
let bots = [];
let allCars = [];

function spawnCars(raceMode) {
  player = new Car(0x00e5ff, true);
  bots = [];
  allCars = [player];

  if (raceMode) {
    const colors = [0xff4444, 0x44ff44, 0xffaa00, 0xcc44ff, 0xff88aa];
    for (let i = 0; i < 5; i++) {
      const bot = new Car(colors[i], false);
      bot.name = `Bot ${i + 1}`;
      // Stagger start positions
      const offset = (i + 1) * 4;
      bot.pos.set(-offset * 0.8, 2, -offset);
      bot.heading = 0;
      bots.push(bot);
      allCars.push(bot);
    }
    player.pos.set(0, 2, 0);
  } else {
    // Explore – spawn in a nice forest area
    player.pos.set(30, 5, 30);
  }
}

// ─── Camera ──────────────────────────────────────────────────
const camOffset = new THREE.Vector3(0, 4.5, -9);
const camLook = new THREE.Vector3(0, 1.2, 6);
let freeControls = null;

function updateCamera(dt) {
  if (!player) return;

  if (keys['KeyC']) {
    keys['KeyC'] = false;
    camMode = (camMode + 1) % 3;
    if (camMode === 2) {
      freeControls = new OrbitControls(camera, renderer.domElement);
      freeControls.target.copy(player.pos);
      freeControls.enableDamping = true;
    } else if (freeControls) {
      freeControls.dispose();
      freeControls = null;
    }
  }

  if (camMode === 0) {
    // Chase cam
    const offset = camOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), player.heading);
    const targetPos = player.pos.clone().add(offset);
    targetPos.y = Math.max(targetPos.y, getTerrainHeight(targetPos.x, targetPos.z) + 3);
    camera.position.lerp(targetPos, 6 * dt);
    const lookAt = player.pos.clone().add(camLook.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), player.heading));
    camera.lookAt(lookAt);
  } else if (camMode === 1) {
    // Hood cam
    const hood = new THREE.Vector3(0, 1.3, 0.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.heading);
    camera.position.copy(player.pos).add(hood);
    const forward = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
    camera.lookAt(player.pos.clone().add(forward.multiplyScalar(20)).add(new THREE.Vector3(0, 1, 0)));
  } else if (freeControls) {
    freeControls.target.lerp(player.pos, 2 * dt);
    freeControls.update();
  }
}

// ─── Minimap ─────────────────────────────────────────────────
function drawMinimap() {
  const w = minimapCanvas.width;
  const h = minimapCanvas.height;
  minimapCtx.clearRect(0, 0, w, h);

  // Background
  minimapCtx.fillStyle = 'rgba(20, 40, 30, 0.9)';
  minimapCtx.beginPath();
  minimapCtx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
  minimapCtx.fill();

  if (!player) return;

  const scale = 0.35;
  const cx = w / 2;
  const cy = h / 2;

  // Draw track if race mode
  if (mode === 'race' && trackPoints.length) {
    minimapCtx.strokeStyle = '#555';
    minimapCtx.lineWidth = 4;
    minimapCtx.beginPath();
    trackPoints.forEach((p, i) => {
      const x = cx + (p.x - player.pos.x) * scale;
      const y = cy + (p.z - player.pos.z) * scale;
      if (i === 0) minimapCtx.moveTo(x, y);
      else minimapCtx.lineTo(x, y);
    });
    minimapCtx.closePath();
    minimapCtx.stroke();
  }

  // Bots
  bots.forEach(b => {
    const x = cx + (b.pos.x - player.pos.x) * scale;
    const y = cy + (b.pos.z - player.pos.z) * scale;
    minimapCtx.fillStyle = '#ff6644';
    minimapCtx.beginPath();
    minimapCtx.arc(x, y, 3, 0, Math.PI * 2);
    minimapCtx.fill();
  });

  // Player
  minimapCtx.fillStyle = '#00e5ff';
  minimapCtx.beginPath();
  minimapCtx.arc(cx, cy, 5, 0, Math.PI * 2);
  minimapCtx.fill();

  // Direction indicator
  minimapCtx.strokeStyle = '#fff';
  minimapCtx.lineWidth = 2;
  minimapCtx.beginPath();
  minimapCtx.moveTo(cx, cy);
  minimapCtx.lineTo(cx + Math.sin(player.heading) * 10, cy + Math.cos(player.heading) * 10);
  minimapCtx.stroke();
}

// ─── Race logic ──────────────────────────────────────────────
function checkRaceProgress() {
  if (!raceStarted || raceFinished) return;

  allCars.forEach(car => {
    if (car.finished) return;
    const cp = checkpoints[car.checkpoint % checkpoints.length];
    if (!cp) return;
    const dist = car.pos.distanceTo(cp);
    if (dist < 18) {
      car.checkpoint++;
      if (car.checkpoint % checkpoints.length === 0) {
        car.lap++;
        if (car === player) {
          currentLap = car.lap;
          lapEl.textContent = Math.min(currentLap, TOTAL_LAPS);
        }
        if (car.lap > TOTAL_LAPS) {
          car.finished = true;
          car.finishTime = raceTime;
          if (car === player) {
            raceFinished = true;
            showFinish();
          }
        }
      }
    }
  });

  // Position ranking
  const ranked = [...allCars].sort((a, b) => {
    if (a.finished && !b.finished) return -1;
    if (!a.finished && b.finished) return 1;
    if (a.lap !== b.lap) return b.lap - a.lap;
    return b.checkpoint - a.checkpoint;
  });
  const myRank = ranked.indexOf(player) + 1;
  posEl.textContent = `P${myRank}`;
}

function showFinish() {
  finishEl.classList.remove('hidden');
  const mins = Math.floor(raceTime / 60);
  const secs = (raceTime % 60).toFixed(3).padStart(6, '0');
  finishTime.textContent = `Time: ${mins}:${secs}`;
  const ranked = [...allCars].filter(c => c.finished).sort((a, b) => a.finishTime - b.finishTime);
  const place = ranked.indexOf(player) + 1;
  finishTitle.textContent = place === 1 ? '🏆 WINNER!' : `Finished P${place}`;
}

function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t % 1) * 1000);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

// ─── Start / Menu ────────────────────────────────────────────
function clearSceneExtras() {
  // Remove previous track / extra objects (keep lights & sky)
  const toRemove = [];
  scene.traverse(o => {
    if (o.userData && o.userData.isTrack) toRemove.push(o);
  });
  // Simpler: just rely on chunk system + new cars
  for (const [k, g] of chunks) {
    scene.remove(g);
    chunks.delete(k);
  }
  allCars.forEach(c => scene.remove(c.mesh));
  allCars = [];
  bots = [];
  player = null;
}

function startGame(selectedMode) {
  mode = selectedMode;
  menuEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  finishEl.classList.add('hidden');
  raceFinished = false;
  raceStarted = false;
  currentLap = 1;
  raceTime = 0;

  clearSceneExtras();

  if (mode === 'race') {
    modeLabel.textContent = 'Race Mode';
    lapInfo.classList.remove('hidden');
    lapEl.textContent = '1';
    buildRaceTrack();
    spawnCars(true);
    // Countdown
    countdownEl.classList.remove('hidden');
    let count = 3;
    countdownEl.textContent = count;
    const iv = setInterval(() => {
      count--;
      if (count > 0) {
        countdownEl.textContent = count;
        countdownEl.style.animation = 'none';
        countdownEl.offsetHeight;
        countdownEl.style.animation = 'pulse 0.8s ease';
      } else if (count === 0) {
        countdownEl.textContent = 'GO!';
      } else {
        countdownEl.classList.add('hidden');
        clearInterval(iv);
        raceStarted = true;
        startTime = performance.now();
        running = true;
      }
    }, 900);
  } else {
    modeLabel.textContent = 'Explore Mode – Infinite World';
    lapInfo.classList.add('hidden');
    spawnCars(false);
    raceStarted = true;
    startTime = performance.now();
    running = true;
  }

  // Initial chunks
  if (player) updateChunks(player.pos.x, player.pos.z);
}

function returnToMenu() {
  running = false;
  raceStarted = false;
  menuEl.classList.remove('hidden');
  hudEl.classList.add('hidden');
  finishEl.classList.add('hidden');
  countdownEl.classList.add('hidden');
  clearSceneExtras();
}

document.getElementById('btn-race').addEventListener('click', () => startGame('race'));
document.getElementById('btn-explore').addEventListener('click', () => startGame('explore'));
document.getElementById('btn-restart').addEventListener('click', () => startGame(mode));
document.getElementById('btn-menu').addEventListener('click', returnToMenu);

// Reset car
window.addEventListener('keydown', e => {
  if (e.code === 'KeyR' && player && running) {
    const h = getTerrainHeight(player.pos.x, player.pos.z);
    player.pos.y = h + 2;
    player.vel.set(0, 0, 0);
    player.speed = 0;
    player.pitch = 0;
    player.roll = 0;
  }
});

// ─── Main loop ───────────────────────────────────────────────
let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (!running || !player) {
    renderer.render(scene, camera);
    return;
  }

  if (raceStarted && !raceFinished) {
    raceTime = (now - startTime) / 1000;
    timerEl.textContent = formatTime(raceTime);
  }

  // Update player
  player.update(dt);

  // Update bots
  if (mode === 'race' && raceStarted) {
    bots.forEach((bot, i) => {
      // Target next checkpoint or follow track
      const cpIdx = bot.checkpoint % checkpoints.length;
      const target = checkpoints[cpIdx] || trackPoints[0];
      bot.updateAI(dt, target);
      bot.update(dt);
    });
    checkRaceProgress();
  }

  // Infinite world chunks (explore + also around race for scenery)
  updateChunks(player.pos.x, player.pos.z);

  // Camera
  updateCamera(dt);

  // HUD
  speedEl.textContent = Math.abs(Math.round(player.speed * 3.6)); // approx km/h feel

  // Minimap
  drawMinimap();

  // Sun follow player a bit
  sun.position.set(player.pos.x + 80, 120, player.pos.z + 60);
  sun.target.position.copy(player.pos);
  sun.target.updateMatrixWorld();

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start idle render
animate(performance.now());
