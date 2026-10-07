import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ============================================================
   RACE – Unique maps + solid ground physics
   ============================================================ */

const canvas = document.getElementById('game');
const menuEl = document.getElementById('menu');
const mapSelectEl = document.getElementById('map-select');
const hudEl = document.getElementById('hud');
const speedEl = document.getElementById('speed');
const lapEl = document.getElementById('lap');
const posEl = document.getElementById('position');
const timerEl = document.getElementById('timer');
const modeLabel = document.getElementById('mode-label');
const mapNameHud = document.getElementById('map-name-hud');
const mapHintHud = document.getElementById('map-hint-hud');
const lapInfo = document.getElementById('lap-info');
const countdownEl = document.getElementById('countdown');
const finishEl = document.getElementById('finish');
const finishTitle = document.getElementById('finish-title');
const finishTime = document.getElementById('finish-time');
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');

let mode = null;
let currentMapId = 'forest';
let running = false;
let raceStarted = false;
let raceFinished = false;
let startTime = 0;
let raceTime = 0;
let currentLap = 1;
const TOTAL_LAPS = 3;

const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Escape') returnToMenu();
  if (e.code === 'KeyM' && mode === 'explore' && running) openMapSelect(true);
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2500);
let camMode = 0;

const hemi = new THREE.HemisphereLight(0xb1e1ff, 0xb97a20, 0.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff5e0, 1.35);
sun.position.set(80, 120, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 500;
sun.shadow.camera.left = -150;
sun.shadow.camera.right = 150;
sun.shadow.camera.top = 150;
sun.shadow.camera.bottom = -150;
sun.shadow.bias = -0.0003;
scene.add(sun);
scene.add(sun.target);

function hash(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function noise2D(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  return hash(xi, zi) * (1 - u) * (1 - v) + hash(xi + 1, zi) * u * (1 - v) +
         hash(xi, zi + 1) * (1 - u) * v + hash(xi + 1, zi + 1) * u * v;
}
function fbm(x, z, oct = 5) {
  let val = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < oct; i++) {
    val += noise2D(x * freq, z * freq) * amp;
    max += amp; amp *= 0.5; freq *= 2;
  }
  return val / max;
}

/* ============================================================
   UNIQUE TERRAIN FUNCTIONS PER MAP
   ============================================================ */

// Forest: rolling hills + deep forest valleys + ridge lines
function heightForest(x, z) {
  let h = fbm(x * 0.006, z * 0.006, 5) * 12;
  // Soft ridges
  h += Math.sin(x * 0.015) * Math.cos(z * 0.012) * 4;
  // Occasional taller hills
  const peak = fbm(x * 0.003 + 20, z * 0.003 + 20, 3);
  if (peak > 0.6) h += (peak - 0.6) * 35;
  // Gentle valleys for streams
  const stream = Math.abs(fbm(x * 0.008 + 90, z * 0.008 + 90, 2) - 0.48);
  if (stream < 0.04) h -= (0.04 - stream) * 25;
  return Math.max(h, -1);
}

// Sakura: gentle flat valleys with soft rolling meadows – almost park-like
function heightSakura(x, z) {
  let h = fbm(x * 0.004, z * 0.004, 4) * 5;
  h += Math.sin(x * 0.008) * 1.5 + Math.cos(z * 0.007) * 1.2;
  // Very gentle rises
  const rise = fbm(x * 0.002 + 5, z * 0.002 + 5, 3);
  if (rise > 0.55) h += (rise - 0.55) * 12;
  // Shallow decorative streams
  const stream = Math.abs(fbm(x * 0.01 + 40, z * 0.01 + 40, 2) - 0.5);
  if (stream < 0.03) h -= (0.03 - stream) * 8;
  return Math.max(h, 0);
}

// Coast: dramatic cliffs, steep drop to ocean on south, high plateaus north
function heightCoast(x, z) {
  // Base elevation rises as we go north
  let h = 8 + z * 0.04 + fbm(x * 0.005, z * 0.005, 4) * 10;
  // Cliffs near ocean (z < -40)
  if (z < -40) {
    const cliff = Math.max(0, (-40 - z) / 50);
    h -= cliff * cliff * 40;
  }
  // Jagged coastal ridges
  h += Math.sin(x * 0.02) * Math.max(0, 1 - Math.abs(z + 30) / 40) * 8;
  // Inland mountains
  const mont = fbm(x * 0.003 + 60, z * 0.003 + 60, 4);
  if (mont > 0.55 && z > 20) h += (mont - 0.55) * 55;
  // Ocean floor
  if (h < -1) h = -3 + fbm(x * 0.02, z * 0.02, 2) * 1.5;
  return h;
}

// Island: big varied open world – mountains NE, flat center, coast SW, lakes
function heightIsland(x, z) {
  let h = fbm(x * 0.005, z * 0.005, 5) * 10;
  // Large mountain range north-east
  const distNE = Math.hypot(x - 120, z - 140);
  if (distNE < 180) {
    const m = 1 - distNE / 180;
    h += m * m * 55 * fbm(x * 0.004 + 10, z * 0.004 + 10, 3);
  }
  // Central plains (flatten)
  const distC = Math.hypot(x, z);
  if (distC < 100) h *= 0.35 + distC / 100 * 0.4;
  // Coast drop south-west
  if (z < -100 || x < -180) {
    const edge = Math.max(-z - 100, -x - 180, 0) / 40;
    h -= edge * edge * 30;
  }
  // Lakes
  const lake = fbm(x * 0.006 + 200, z * 0.006 + 200, 3);
  if (lake > 0.72) h = Math.min(h, 1 - (lake - 0.72) * 20);
  return Math.max(h, -4);
}

const MAPS = {
  forest: {
    name: 'Forest Highway',
    fogColor: 0x6a8a6a, fogNear: 50, fogFar: 280, sky: 0x7a9a8a,
    sunColor: 0xfff0d0, sunIntensity: 1.15, hemiSky: 0x90b090, hemiGround: 0x2a4a28,
    roads: [
      [[-220, 0], [-140, 15], [-60, 5], [20, -10], [100, 8], [180, 25], [260, 5]],
      [[0, -160], [8, -90], [0, -20], [12, 60], [5, 150]],
      [[-90, 30], [-110, 80], [-70, 130], [10, 155], [70, 120]]
    ],
    spawn: [0, 6, 0],
    treeDensity: 0.65, treeColor: 0x1a4a22, grassHue: 0.28,
    heightFn: heightForest, waterColor: 0x1a4a5a,
    hasCities: true
  },
  sakura: {
    name: 'Sakura Road',
    fogColor: 0xf0d0e0, fogNear: 40, fogFar: 240, sky: 0xe0f0f8,
    sunColor: 0xffe8f0, sunIntensity: 1.05, hemiSky: 0xf8e0f0, hemiGround: 0x7a9a70,
    roads: [
      [[-280, 0], [-180, 3], [-80, -4], [20, 6], [120, -2], [220, 5], [300, 0]],
      [[-40, -120], [-15, -50], [0, 10], [25, 90], [50, 160]]
    ],
    spawn: [0, 4, 0],
    treeDensity: 0.8, treeColor: 0xf0a0b8, grassHue: 0.32,
    heightFn: heightSakura, waterColor: 0x5a8aaa, sakura: true,
    hasCities: false
  },
  coast: {
    name: 'Coastal Vista',
    fogColor: 0xa8c8e8, fogNear: 60, fogFar: 380, sky: 0x78b0e8,
    sunColor: 0xffd8a0, sunIntensity: 1.45, hemiSky: 0xc0d8f0, hemiGround: 0x5a7a40,
    roads: [
      [[-200, 50], [-110, 70], [-20, 55], [70, 75], [160, 60], [250, 85]],
      [[50, 55], [75, 15], [110, -30], [145, -75], [180, -120]],
      [[-60, -130], [20, -115], [100, -105], [180, -95]]
    ],
    spawn: [0, 12, 60],
    treeDensity: 0.3, treeColor: 0x2a5a32, grassHue: 0.24,
    heightFn: heightCoast, waterColor: 0x1a4a7a, ocean: true,
    hasCities: false
  },
  island: {
    name: 'Horizon Island',
    fogColor: 0x88a898, fogNear: 80, fogFar: 420, sky: 0x70a8d0,
    sunColor: 0xfff5e0, sunIntensity: 1.3, hemiSky: 0xb0d0f0, hemiGround: 0x4a6a38,
    roads: [
      [[-240, -90], [-190, 30], [-90, 150], [30, 190], [150, 130], [230, 10], [190, -110], [50, -170], [-90, -150], [-210, -70], [-240, -90]],
      [[0, -190], [8, -90], [0, 10], [-8, 110], [5, 190]],
      [[-170, 15], [-70, 25], [30, 10], [130, 35]],
      [[-50, 90], [-25, 130], [25, 160], [70, 140]],
      [[50, -50], [80, -25], [110, 5], [100, 45]]
    ],
    spawn: [0, 6, -30],
    treeDensity: 0.35, treeColor: 0x246030, grassHue: 0.27,
    heightFn: heightIsland, waterColor: 0x1a5070, ocean: true, large: true,
    hasCities: true
  }
};

let activeMap = MAPS.forest;

function getTerrainHeight(x, z) {
  let h = activeMap.heightFn(x, z);
  // Flatten roads smoothly
  if (isNearRoad(x, z, 10)) {
    const roadH = Math.max(h * 0.2, 0.4);
    const blend = 1 - Math.min(1, distToNearestRoad(x, z) / 10);
    h = h * (1 - blend * 0.85) + roadH * blend * 0.85;
  }
  // Flatten cities
  if (isCityChunk(Math.floor(x / 72), Math.floor(z / 72))) {
    h = Math.max(h * 0.08, 0.3);
  }
  return h;
}

function distToNearestRoad(x, z) {
  let best = 9999;
  if (!activeMap.roads) return best;
  for (const path of activeMap.roads) {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      best = Math.min(best, distToSegment(x, z, a[0], a[1], b[0], b[1]));
    }
  }
  return best;
}

function isRiver(x, z) {
  // Map-specific water detection
  if (activeMap.id === 'sakura') {
    const stream = Math.abs(fbm(x * 0.01 + 40, z * 0.01 + 40, 2) - 0.5);
    return stream < 0.025;
  }
  if (activeMap.id === 'coast' || activeMap.id === 'island') {
    return getTerrainHeight(x, z) < -0.5;
  }
  // forest
  const stream = Math.abs(fbm(x * 0.008 + 90, z * 0.008 + 90, 2) - 0.48);
  return stream < 0.032;
}

function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 < 0.001) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

function isNearRoad(x, z, width = 7) {
  return distToNearestRoad(x, z) < width;
}
function isOnRoad(x, z) {
  return distToNearestRoad(x, z) < 5.5;
}

function isCityChunk(cx, cz) {
  if (mode === 'race' || !activeMap.hasCities) return false;
  return hash(cx * 19.7 + 3.1, cz * 31.3 + 7.9) > 0.93;
}

// ─── Chunks ──────────────────────────────────────────────────
const CHUNK_SIZE = 72;
const CHUNK_RES = 40;
const VIEW_DIST = 4;
const chunks = new Map();

const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 1.5, 6);
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 });
const rockGeo = new THREE.DodecahedronGeometry(1.0, 0);
const rockMat = new THREE.MeshStandardMaterial({ color: 0x6a6a5a, roughness: 0.95 });
const bldgMats = [
  new THREE.MeshStandardMaterial({ color: 0x6a7a8a, roughness: 0.7, metalness: 0.15 }),
  new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.75 }),
  new THREE.MeshStandardMaterial({ color: 0x5a6a7a, roughness: 0.65, metalness: 0.2 }),
  new THREE.MeshStandardMaterial({ color: 0x9a8a7a, roughness: 0.8 })
];
const windowMat = new THREE.MeshStandardMaterial({
  color: 0x88aacc, emissive: 0x334455, emissiveIntensity: 0.25, metalness: 0.5, roughness: 0.2
});

function chunkKey(cx, cz) { return cx + ',' + cz; }

function createFoliageMesh(isSakura) {
  if (isSakura) {
    return new THREE.Mesh(
      new THREE.SphereGeometry(2.0, 7, 5),
      new THREE.MeshStandardMaterial({ color: 0xf0a0b8, roughness: 0.85 })
    );
  }
  return new THREE.Mesh(
    new THREE.ConeGeometry(1.3, 4.0, 6),
    new THREE.MeshStandardMaterial({ color: activeMap.treeColor, roughness: 0.88 })
  );
}

function addCityToChunk(group, cx, cz) {
  const baseY = 0.35;
  const grid = 3 + Math.floor(hash(cx, cz) * 3);
  const spacing = CHUNK_SIZE / (grid + 1);
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(CHUNK_SIZE * 0.85, 0.18, CHUNK_SIZE * 0.85),
    new THREE.MeshStandardMaterial({ color: 0x333338, roughness: 0.9 })
  );
  pad.position.y = baseY;
  pad.receiveShadow = true;
  group.add(pad);

  for (let ix = 0; ix < grid; ix++) {
    for (let iz = 0; iz < grid; iz++) {
      if ((ix + iz) % 3 === 0 && hash(cx + ix, cz + iz) > 0.4) continue;
      const lx = (ix - (grid - 1) / 2) * spacing;
      const lz = (iz - (grid - 1) / 2) * spacing;
      const hSeed = hash(cx * 10 + ix, cz * 10 + iz);
      const bw = 4 + hSeed * 5;
      const bd = 4 + hash(ix + 2, iz + 5) * 5;
      const bh = 5 + hSeed * 26;
      const mat = bldgMats[Math.floor(hSeed * bldgMats.length)];
      const bldg = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
      bldg.position.set(lx, baseY + bh / 2, lz);
      bldg.castShadow = true;
      bldg.receiveShadow = true;
      group.add(bldg);
      if (bh > 10) {
        const floors = Math.floor(bh / 3.5);
        for (let f = 1; f < floors; f++) {
          for (const side of [-1, 1]) {
            const win = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.65, 1.1, 0.12), windowMat);
            win.position.set(lx, baseY + f * 3.5, lz + side * (bd / 2 + 0.05));
            group.add(win);
          }
        }
      }
    }
  }
}

function createChunk(cx, cz) {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_RES, CHUNK_RES);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const color = new THREE.Color();
  const m = activeMap;
  const city = isCityChunk(cx, cz);

  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    const wx = cx * CHUNK_SIZE + lx;
    const wz = cz * CHUNK_SIZE + lz;
    let h = getTerrainHeight(wx, wz);
    if (city) h = 0.3;
    pos.setY(i, h);

    if (city) {
      color.setHSL(0, 0.02, 0.2 + Math.random() * 0.04);
    } else if (isOnRoad(wx, wz)) {
      color.setHSL(0.08, 0.03, 0.2 + Math.random() * 0.03);
    } else if (isRiver(wx, wz) || h < -0.3) {
      color.set(m.waterColor);
    } else if (h > 28) {
      color.setHSL(0.08, 0.05, 0.6 + Math.min(0.2, (h - 28) * 0.01));
    } else if (h > 14) {
      color.setHSL(0.09, 0.18, 0.3);
    } else {
      const gVar = fbm(wx * 0.04, wz * 0.04, 2);
      color.setHSL(m.grassHue + gVar * 0.03, 0.42 + gVar * 0.12, 0.25 + gVar * 0.07);
      if (m.sakura) color.offsetHSL(0.015, 0.04, 0.04);
    }
    colors.push(color.r, color.g, color.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.92, metalness: 0.02
  }));
  mesh.receiveShadow = true;
  group.add(mesh);

  if (city) {
    addCityToChunk(group, cx, cz);
  } else {
    const count = Math.floor(32 * m.treeDensity);
    for (let i = 0; i < count; i++) {
      const lx = (Math.random() - 0.5) * CHUNK_SIZE * 0.9;
      const lz = (Math.random() - 0.5) * CHUNK_SIZE * 0.9;
      const wx = cx * CHUNK_SIZE + lx;
      const wz = cz * CHUNK_SIZE + lz;
      if (isNearRoad(wx, wz, 9) || isRiver(wx, wz)) continue;
      const h = getTerrainHeight(wx, wz);
      if (h > 22 || h < 0.2) continue;

      if (Math.random() < 0.88) {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.75;
        trunk.castShadow = true;
        tree.add(trunk);
        const foliage = createFoliageMesh(m.sakura);
        foliage.position.y = m.sakura ? 2.6 : 3.2;
        foliage.castShadow = true;
        tree.add(foliage);
        if (m.sakura && Math.random() > 0.35) {
          const extra = createFoliageMesh(true);
          extra.position.set((Math.random() - 0.5) * 1.4, 2.0 + Math.random(), (Math.random() - 0.5) * 1.4);
          extra.scale.setScalar(0.55 + Math.random() * 0.4);
          tree.add(extra);
        }
        tree.position.set(lx, h, lz);
        tree.scale.setScalar(0.6 + Math.random() * 0.85);
        tree.rotation.y = Math.random() * Math.PI * 2;
        group.add(tree);
      } else {
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set(lx, h + 0.3, lz);
        rock.scale.setScalar(0.35 + Math.random() * 1.0);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.castShadow = true;
        group.add(rock);
      }
    }

    // Bridges
    for (let i = 0; i < 2; i++) {
      const lx = (Math.random() - 0.5) * CHUNK_SIZE * 0.7;
      const lz = (Math.random() - 0.5) * CHUNK_SIZE * 0.7;
      const wx = cx * CHUNK_SIZE + lx;
      const wz = cz * CHUNK_SIZE + lz;
      if (isRiver(wx, wz) && isNearRoad(wx, wz, 14)) {
        const bridge = new THREE.Mesh(
          new THREE.BoxGeometry(10, 0.5, 5),
          new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.85 })
        );
        bridge.position.set(lx, getTerrainHeight(wx, wz) + 1.6, lz);
        bridge.castShadow = true;
        bridge.receiveShadow = true;
        group.add(bridge);
      }
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
  const range = activeMap.large ? 5 : VIEW_DIST;
  for (let dx = -range; dx <= range; dx++) {
    for (let dz = -range; dz <= range; dz++) {
      const key = chunkKey(cx + dx, cz + dz);
      needed.add(key);
      if (!chunks.has(key)) createChunk(cx + dx, cz + dz);
    }
  }
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

function clearChunks() {
  for (const [, group] of chunks) {
    scene.remove(group);
    group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
  }
  chunks.clear();
}

let roadMeshes = [];

function buildRoadMeshes() {
  roadMeshes.forEach(m => scene.remove(m));
  roadMeshes = [];
  if (!activeMap.roads) return;
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });

  for (const path of activeMap.roads) {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const ax = a[0], az = a[1], bx = b[0], bz = b[1];
      const len = Math.hypot(bx - ax, bz - az);
      const midX = (ax + bx) / 2, midZ = (az + bz) / 2;
      // Sample several points for better road height
      let hy = 0;
      const samples = 5;
      for (let s = 0; s <= samples; s++) {
        const t = s / samples;
        hy += getTerrainHeight(ax + (bx - ax) * t, az + (bz - az) * t);
      }
      hy = hy / (samples + 1) + 0.15;

      const seg = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.2, len + 0.8), roadMat);
      seg.position.set(midX, hy, midZ);
      seg.lookAt(bx, hy, bz);
      seg.rotateX(Math.PI / 2);
      seg.receiveShadow = true;
      scene.add(seg);
      roadMeshes.push(seg);

      if (i % 2 === 0) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.22, Math.min(2.5, len * 0.35)), lineMat);
        line.position.set(midX, hy + 0.02, midZ);
        line.lookAt(bx, hy, bz);
        line.rotateX(Math.PI / 2);
        scene.add(line);
        roadMeshes.push(line);
      }
    }
  }
}

function applyMapTheme(mapId) {
  activeMap = MAPS[mapId];
  activeMap.id = mapId;
  currentMapId = mapId;
  scene.background = new THREE.Color(activeMap.sky);
  scene.fog = new THREE.Fog(activeMap.fogColor, activeMap.fogNear, activeMap.fogFar);
  hemi.color.set(activeMap.hemiSky);
  hemi.groundColor.set(activeMap.hemiGround);
  sun.color.set(activeMap.sunColor);
  sun.intensity = activeMap.sunIntensity;
  clearChunks();
  buildRoadMeshes();
}

/* ============================================================
   SOLID GROUND PHYSICS – no floating
   Car sits ON the terrain using average of 4 wheel heights
   ============================================================ */
class Car {
  constructor(color = 0xff3333, isPlayer = false) {
    this.isPlayer = isPlayer;
    this.wheels = [];
    this.mesh = this.createMesh(color);
    scene.add(this.mesh);

    this.pos = new THREE.Vector3(0, 5, 0);
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.pitch = 0;
    this.roll = 0;
    this.angVelPitch = 0;
    this.angVelRoll = 0;

    this.speed = 0;
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

    // Physics constants
    this.wheelRadius = 0.38;
    this.bodyClearance = 0.12; // gap between body bottom and wheel top visual
    this.halfLength = 1.4;
    this.halfWidth = 0.9;
    this.mass = 1400;
    this.gravity = 32;
    this.maxSteer = 0.52;
    this.engineForce = 52;
    this.brakeForce = 70;
    this.dragCoeff = 0.35;
    this.rollResist = 5;
    this.grip = 28;
    this.handbrakeGrip = 4;
  }

  createMesh(color) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.28 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.5, 4.2), bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    g.add(body);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.45, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.4, roughness: 0.2 })
    );
    cabin.position.set(0, 1.0, -0.15);
    cabin.castShadow = true;
    g.add(cabin);

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x88aacc, metalness: 0.9, roughness: 0.08, transparent: true, opacity: 0.55
    });
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.35, 0.08), glassMat);
    windshield.position.set(0, 1.05, 0.7);
    windshield.rotation.x = -0.28;
    g.add(windshield);

    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
    // Wheel local positions (relative to car origin at ground contact level)
    this.wheelLocals = [
      { x: -0.92, z: 1.35 },
      { x: 0.92, z: 1.35 },
      { x: -0.92, z: -1.35 },
      { x: 0.92, z: -1.35 }
    ];
    this.wheelLocals.forEach(p => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(p.x, 0.38, p.z);
      w.castShadow = true;
      g.add(w);
      this.wheels.push(w);
    });

    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffaa, emissiveIntensity: 0.8 });
    [[-0.55, 0.5, 2.1], [0.55, 0.5, 2.1]].forEach(p => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.08), lightMat);
      l.position.set(...p);
      g.add(l);
    });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.45 });
    [[-0.55, 0.5, -2.1], [0.55, 0.5, -2.1]].forEach(p => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.06), tailMat);
      l.position.set(...p);
      g.add(l);
    });
    return g;
  }

  // Convert local wheel offset to world XZ
  wheelWorldXZ(localX, localZ) {
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    return {
      x: this.pos.x + localX * c + localZ * s,
      z: this.pos.z - localX * s + localZ * c
    };
  }

  update(dt) {
    // Input
    if (this.isPlayer) {
      this.throttle = (keys['KeyW'] || keys['ArrowUp']) ? 1 : 0;
      this.brake = (keys['KeyS'] || keys['ArrowDown']) ? 1 : 0;
      const si = ((keys['KeyA'] || keys['ArrowLeft']) ? 1 : 0) - ((keys['KeyD'] || keys['ArrowRight']) ? 1 : 0);
      this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, si * this.maxSteer, 12 * dt);
      this.handbrake = !!keys['Space'];
      if (keys['ShiftLeft'] || keys['ShiftRight']) this.boost = Math.min(1, this.boost + dt * 2.2);
      else this.boost = Math.max(0, this.boost - dt * 1.8);
    }

    // ── Sample ground under each wheel ──
    const groundYs = [];
    let minGround = Infinity, maxGround = -Infinity;
    for (const wl of this.wheelLocals) {
      const w = this.wheelWorldXZ(wl.x, wl.z);
      const gy = getTerrainHeight(w.x, w.z);
      groundYs.push(gy);
      minGround = Math.min(minGround, gy);
      maxGround = Math.max(maxGround, gy);
    }
    const avgGround = (groundYs[0] + groundYs[1] + groundYs[2] + groundYs[3]) / 4;

    // Target car Y = average ground + wheel radius (car origin at axle height)
    const targetY = avgGround + this.wheelRadius;

    // How far is the car above/below where it should sit?
    const heightError = this.pos.y - targetY;

    // Grounded if within reasonable range of terrain
    this.onGround = heightError < 1.2 && heightError > -0.5;

    if (this.onGround) {
      // Snap / spring toward correct height – THIS kills floating
      // Strong spring so car sits firmly on ground
      const springK = 80;
      const dampK = 18;
      const forceY = -heightError * springK - this.vel.y * dampK;
      this.vel.y += forceY * dt;

      // Hard floor – never sink below terrain
      if (this.pos.y < targetY - 0.05) {
        this.pos.y = targetY;
        if (this.vel.y < 0) this.vel.y = 0;
      }

      // Soft ceiling when slightly above (prevents hop)
      if (heightError > 0.3 && this.vel.y > 0) {
        this.vel.y *= 0.5;
      }

      // Pitch from front vs rear ground difference
      const frontG = (groundYs[0] + groundYs[1]) / 2;
      const rearG = (groundYs[2] + groundYs[3]) / 2;
      const targetPitch = Math.atan2(rearG - frontG, this.halfLength * 2) * 0.95;

      // Roll from left vs right
      const leftG = (groundYs[0] + groundYs[2]) / 2;
      const rightG = (groundYs[1] + groundYs[3]) / 2;
      const targetRoll = Math.atan2(leftG - rightG, this.halfWidth * 2) * 0.95;

      // Spring orientation to terrain
      this.angVelPitch += (targetPitch - this.pitch) * 18 * dt;
      this.angVelRoll += (targetRoll - this.roll) * 18 * dt;
      this.angVelPitch *= (1 - 10 * dt);
      this.angVelRoll *= (1 - 10 * dt);
    } else {
      // Airborne – full gravity, free rotation damp
      this.vel.y -= this.gravity * dt;
      this.angVelPitch *= (1 - 0.4 * dt);
      this.angVelRoll *= (1 - 0.4 * dt);
    }

    // Always apply some gravity so jumps feel weighty
    if (!this.onGround) {
      // already applied
    } else {
      // light gravity still, countered by spring
      this.vel.y -= this.gravity * 0.15 * dt;
    }

    this.pitch += this.angVelPitch * dt;
    this.roll += this.angVelRoll * dt;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.1, 1.1);
    this.roll = THREE.MathUtils.clamp(this.roll, -1.2, 1.2);

    // ── Drive forces ──
    const upright = Math.cos(this.pitch) * Math.cos(this.roll);
    const canDrive = this.onGround && upright > 0.4;

    if (canDrive) {
      let force = 0;
      force += this.throttle * this.engineForce * (1 + this.boost * 0.85);
      force -= this.brake * this.brakeForce * Math.sign(this.speed || 1);
      force -= this.rollResist * Math.sign(this.speed);
      force -= this.dragCoeff * this.speed * Math.abs(this.speed) * 0.011;

      // Surface friction
      if (isOnRoad(this.pos.x, this.pos.z) || isCityChunk(Math.floor(this.pos.x / CHUNK_SIZE), Math.floor(this.pos.z / CHUNK_SIZE))) {
        force *= 1.12;
      } else {
        force *= 0.72; // dirt / grass slower accel
        this.speed *= (1 - 0.8 * dt); // extra drag off-road
      }

      // Slope resistance – harder to go uphill
      const slopeFactor = Math.sin(this.pitch);
      force -= slopeFactor * 18;

      this.speed += (force / this.mass) * 55 * dt;
      this.speed = THREE.MathUtils.clamp(this.speed, -22, 65 + this.boost * 20);

      // Steering – more responsive at mid speed, less at very high
      const speedFactor = Math.min(Math.abs(this.speed) / 12, 1.8);
      this.heading += this.steerAngle * speedFactor * 1.6 * dt * Math.sign(this.speed || 1);

      // Project velocity with grip
      const fwd = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
      const desired = fwd.multiplyScalar(this.speed);
      const gripAmt = this.handbrake ? this.handbrakeGrip : this.grip;
      this.vel.x += (desired.x - this.vel.x) * Math.min(1, gripAmt * dt);
      this.vel.z += (desired.z - this.vel.z) * Math.min(1, gripAmt * dt);
    } else {
      // Airborne or flipped – bleed speed, limited air steer
      this.speed *= (1 - 0.5 * dt);
      this.vel.x *= (1 - 0.2 * dt);
      this.vel.z *= (1 - 0.2 * dt);
      if (this.isPlayer) this.heading += this.steerAngle * 0.35 * dt;
    }

    // Integrate
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;

    // Emergency recovery if deep underground or fallen forever
    const gNow = getTerrainHeight(this.pos.x, this.pos.z);
    if (this.pos.y < gNow - 8) {
      this.pos.y = gNow + this.wheelRadius + 0.5;
      this.vel.set(0, 0, 0);
      this.speed = 0;
      this.pitch = 0;
      this.roll = 0;
    }

    // Visuals – origin is at axle height so wheels sit on ground
    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.mesh.rotation.order = 'YXZ';
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.x = this.pitch;
    this.mesh.rotation.z = this.roll;

    const spin = this.speed * dt * 2.5;
    this.wheels.forEach((w, i) => {
      w.rotation.x += spin;
      if (i < 2) w.rotation.y = this.steerAngle * 0.8;
    });
  }

  updateAI(dt, target) {
    if (!target) return;
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    let desired = Math.atan2(dx, dz);
    let diff = desired - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.steerAngle = THREE.MathUtils.clamp(diff * 2.0, -this.maxSteer, this.maxSteer);
    this.throttle = 0.72 + Math.random() * 0.22;
    this.brake = Math.abs(diff) > 1.1 ? 0.4 : 0;
    this.handbrake = Math.abs(diff) > 1.5 && Math.abs(this.speed) > 12;
  }
}

// ─── Race track ──────────────────────────────────────────────
let trackPoints = [];
let checkpoints = [];

function buildRaceTrack() {
  trackPoints = [];
  const radius = 95;
  for (let i = 0; i <= 90; i++) {
    const t = (i / 90) * Math.PI * 2;
    const r = radius + Math.sin(t * 3) * 28 + Math.cos(t * 5) * 14;
    const x = Math.cos(t) * r;
    const z = Math.sin(t) * r * 0.88;
    trackPoints.push(new THREE.Vector3(x, getTerrainHeight(x, z) + 0.5, z));
  }
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.85 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
  for (let i = 0; i < trackPoints.length - 1; i++) {
    const a = trackPoints[i], b = trackPoints[i + 1];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y = (getTerrainHeight(mid.x, mid.z) + a.y + b.y) / 3 + 0.15;
    const len = a.distanceTo(b);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(10, 0.22, len + 0.5), roadMat);
    seg.position.copy(mid);
    seg.lookAt(b.x, mid.y, b.z);
    seg.rotateX(Math.PI / 2);
    seg.receiveShadow = true;
    scene.add(seg);
    roadMeshes.push(seg);
    if (i % 2 === 0) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.25, 2), lineMat);
      line.position.copy(mid);
      line.lookAt(b.x, mid.y, b.z);
      line.rotateX(Math.PI / 2);
      scene.add(line);
      roadMeshes.push(line);
    }
  }
  checkpoints = [];
  for (let i = 0; i < 8; i++) {
    checkpoints.push(trackPoints[Math.floor((i / 8) * (trackPoints.length - 1))].clone());
  }
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(14, 4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0x443300 })
  );
  banner.position.copy(trackPoints[0]);
  banner.position.y += 4;
  scene.add(banner);
  roadMeshes.push(banner);
}

let player = null;
let bots = [];
let allCars = [];

function spawnCars(raceMode) {
  if (player) scene.remove(player.mesh);
  bots.forEach(b => scene.remove(b.mesh));
  player = new Car(0x00e5ff, true);
  bots = [];
  allCars = [player];

  if (raceMode) {
    const colors = [0xff4444, 0x44ff44, 0xffaa00, 0xcc44ff, 0xff88aa];
    for (let i = 0; i < 5; i++) {
      const bot = new Car(colors[i], false);
      bot.name = 'Bot ' + (i + 1);
      const gy = getTerrainHeight(-(i + 1) * 3.5, -(i + 1) * 3.5);
      bot.pos.set(-(i + 1) * 3.5, gy + 0.4, -(i + 1) * 3.5);
      bots.push(bot);
      allCars.push(bot);
    }
    const gy = getTerrainHeight(0, 0);
    player.pos.set(0, gy + 0.4, 0);
  } else {
    const s = activeMap.spawn;
    const gy = getTerrainHeight(s[0], s[2]);
    player.pos.set(s[0], gy + 0.4, s[2]);
    player.heading = 0;
  }
}

const camOffset = new THREE.Vector3(0, 5.0, -10.5);
const camLook = new THREE.Vector3(0, 1.2, 7);
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
    const offset = camOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), player.heading);
    const targetPos = player.pos.clone().add(offset);
    targetPos.y = Math.max(targetPos.y, getTerrainHeight(targetPos.x, targetPos.z) + 3.5);
    camera.position.lerp(targetPos, 6 * dt);
    const lookAt = player.pos.clone().add(camLook.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), player.heading));
    camera.lookAt(lookAt);
  } else if (camMode === 1) {
    const hood = new THREE.Vector3(0, 1.3, 0.85).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.heading);
    camera.position.copy(player.pos).add(hood);
    const fwd = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
    camera.lookAt(player.pos.clone().add(fwd.multiplyScalar(20)).add(new THREE.Vector3(0, 1, 0)));
  } else if (freeControls) {
    freeControls.target.lerp(player.pos, 2 * dt);
    freeControls.update();
  }
}

function drawMinimap() {
  const w = minimapCanvas.width, h = minimapCanvas.height;
  minimapCtx.clearRect(0, 0, w, h);
  minimapCtx.fillStyle = 'rgba(15, 35, 25, 0.92)';
  minimapCtx.beginPath();
  minimapCtx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
  minimapCtx.fill();
  if (!player) return;

  const scale = mode === 'explore' ? 0.2 : 0.3;
  const cx = w / 2, cy = h / 2;

  if (mode === 'explore' && activeMap.roads) {
    minimapCtx.strokeStyle = '#666';
    minimapCtx.lineWidth = 2.2;
    for (const path of activeMap.roads) {
      minimapCtx.beginPath();
      path.forEach((p, i) => {
        const x = cx + (p[0] - player.pos.x) * scale;
        const y = cy + (p[1] - player.pos.z) * scale;
        if (i === 0) minimapCtx.moveTo(x, y); else minimapCtx.lineTo(x, y);
      });
      minimapCtx.stroke();
    }
  }

  if (mode === 'explore' && activeMap.hasCities) {
    const pcx = Math.floor(player.pos.x / CHUNK_SIZE);
    const pcz = Math.floor(player.pos.z / CHUNK_SIZE);
    minimapCtx.fillStyle = '#99aacc';
    for (let dx = -7; dx <= 7; dx++) {
      for (let dz = -7; dz <= 7; dz++) {
        if (isCityChunk(pcx + dx, pcz + dz)) {
          minimapCtx.fillRect(cx + dx * CHUNK_SIZE * scale - 3, cy + dz * CHUNK_SIZE * scale - 3, 6, 6);
        }
      }
    }
  }

  if (mode === 'race' && trackPoints.length) {
    minimapCtx.strokeStyle = '#555';
    minimapCtx.lineWidth = 3;
    minimapCtx.beginPath();
    trackPoints.forEach((p, i) => {
      const x = cx + (p.x - player.pos.x) * scale;
      const y = cy + (p.z - player.pos.z) * scale;
      if (i === 0) minimapCtx.moveTo(x, y); else minimapCtx.lineTo(x, y);
    });
    minimapCtx.closePath();
    minimapCtx.stroke();
  }

  bots.forEach(b => {
    minimapCtx.fillStyle = '#ff6644';
    minimapCtx.beginPath();
    minimapCtx.arc(cx + (b.pos.x - player.pos.x) * scale, cy + (b.pos.z - player.pos.z) * scale, 3, 0, Math.PI * 2);
    minimapCtx.fill();
  });

  minimapCtx.fillStyle = '#00e5ff';
  minimapCtx.beginPath();
  minimapCtx.arc(cx, cy, 5, 0, Math.PI * 2);
  minimapCtx.fill();
  minimapCtx.strokeStyle = '#fff';
  minimapCtx.lineWidth = 2;
  minimapCtx.beginPath();
  minimapCtx.moveTo(cx, cy);
  minimapCtx.lineTo(cx + Math.sin(player.heading) * 10, cy + Math.cos(player.heading) * 10);
  minimapCtx.stroke();
}

function checkRaceProgress() {
  if (!raceStarted || raceFinished) return;
  allCars.forEach(car => {
    if (car.finished) return;
    const cp = checkpoints[car.checkpoint % checkpoints.length];
    if (!cp) return;
    if (car.pos.distanceTo(cp) < 18) {
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
          if (car === player) { raceFinished = true; showFinish(); }
        }
      }
    }
  });
  const ranked = [...allCars].sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.lap !== b.lap) return b.lap - a.lap;
    return b.checkpoint - a.checkpoint;
  });
  posEl.textContent = 'P' + (ranked.indexOf(player) + 1);
}

function showFinish() {
  finishEl.classList.remove('hidden');
  const mins = Math.floor(raceTime / 60);
  const secs = (raceTime % 60).toFixed(3).padStart(6, '0');
  finishTime.textContent = 'Time: ' + mins + ':' + secs;
  const ranked = [...allCars].filter(c => c.finished).sort((a, b) => a.finishTime - b.finishTime);
  finishTitle.textContent = ranked.indexOf(player) === 0 ? '🏆 WINNER!' : 'Finished P' + (ranked.indexOf(player) + 1);
}

function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t % 1) * 1000);
  return m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0') + '.' + ms.toString().padStart(3, '0');
}

function clearSceneExtras() {
  roadMeshes.forEach(m => scene.remove(m));
  roadMeshes = [];
  clearChunks();
  allCars.forEach(c => { if (c.mesh) scene.remove(c.mesh); });
  allCars = [];
  bots = [];
  player = null;
}

function openMapSelect(fromGame = false) {
  if (fromGame) { running = false; hudEl.classList.add('hidden'); }
  else menuEl.classList.add('hidden');
  mapSelectEl.classList.remove('hidden');
}

function startExplore(mapId) {
  mode = 'explore';
  mapSelectEl.classList.add('hidden');
  menuEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  finishEl.classList.add('hidden');
  raceFinished = false;
  raceStarted = true;
  startTime = performance.now();
  raceTime = 0;
  running = true;

  applyMapTheme(mapId);
  modeLabel.textContent = 'Explore';
  mapNameHud.textContent = activeMap.name;
  mapNameHud.classList.remove('hidden');
  mapHintHud.classList.remove('hidden');
  lapInfo.classList.add('hidden');

  spawnCars(false);
  updateChunks(player.pos.x, player.pos.z);
}

function startGame(selectedMode) {
  if (selectedMode === 'explore') { openMapSelect(false); return; }
  mode = 'race';
  menuEl.classList.add('hidden');
  mapSelectEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  finishEl.classList.add('hidden');
  mapNameHud.classList.add('hidden');
  mapHintHud.classList.add('hidden');
  raceFinished = false;
  raceStarted = false;
  currentLap = 1;
  raceTime = 0;

  clearSceneExtras();
  activeMap = {
    ...MAPS.forest, id: 'race', roads: [], treeDensity: 0.2,
    heightFn: heightForest, hasCities: false, sakura: false, ocean: false
  };
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 90, 360);
  hemi.color.set(0xb1e1ff);
  hemi.groundColor.set(0xb97a20);
  sun.color.set(0xfff5e0);
  sun.intensity = 1.3;

  modeLabel.textContent = 'Race Mode';
  lapInfo.classList.remove('hidden');
  lapEl.textContent = '1';
  buildRaceTrack();
  spawnCars(true);

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
}

function returnToMenu() {
  running = false;
  raceStarted = false;
  menuEl.classList.remove('hidden');
  mapSelectEl.classList.add('hidden');
  hudEl.classList.add('hidden');
  finishEl.classList.add('hidden');
  countdownEl.classList.add('hidden');
  clearSceneExtras();
}

document.getElementById('btn-race').addEventListener('click', () => startGame('race'));
document.getElementById('btn-explore').addEventListener('click', () => startGame('explore'));
document.getElementById('btn-map-back').addEventListener('click', () => {
  mapSelectEl.classList.add('hidden');
  menuEl.classList.remove('hidden');
});
document.getElementById('btn-restart').addEventListener('click', () => startGame(mode));
document.getElementById('btn-menu').addEventListener('click', returnToMenu);
document.querySelectorAll('.map-card').forEach(card => {
  card.addEventListener('click', () => startExplore(card.dataset.map));
});

window.addEventListener('keydown', e => {
  if (e.code === 'KeyR' && player && running) {
    const gy = getTerrainHeight(player.pos.x, player.pos.z);
    player.pos.y = gy + player.wheelRadius + 0.3;
    player.vel.set(0, 0, 0);
    player.speed = 0;
    player.pitch = 0;
    player.roll = 0;
    player.angVelPitch = 0;
    player.angVelRoll = 0;
  }
});

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

  player.update(dt);

  if (mode === 'race' && raceStarted) {
    bots.forEach(bot => {
      const cpIdx = bot.checkpoint % checkpoints.length;
      bot.updateAI(dt, checkpoints[cpIdx] || trackPoints[0]);
      bot.update(dt);
    });
    checkRaceProgress();
  }

  updateChunks(player.pos.x, player.pos.z);
  updateCamera(dt);
  speedEl.textContent = Math.abs(Math.round(player.speed * 3.6));
  drawMinimap();

  sun.position.set(player.pos.x + 90, 130, player.pos.z + 50);
  sun.target.position.copy(player.pos);
  sun.target.updateMatrixWorld();

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate(performance.now());
