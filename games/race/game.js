import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ============================================================
   RACE – Real vehicle physics + pre-made Explore maps
   Car can fall, tilt, tumble, interact with terrain
   Water does NOT slow the car
   Rare procedural cities in infinite world
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

const MAPS = {
  forest: {
    name: 'Forest Highway',
    fogColor: 0x7a9a7a, fogNear: 60, fogFar: 320, sky: 0x87a0b0,
    sunColor: 0xfff0d0, sunIntensity: 1.2, hemiSky: 0xa0c0a0, hemiGround: 0x3a5a30,
    roads: [
      [[-200, 0], [-120, 20], [-40, 10], [40, -15], [120, 5], [200, 30], [280, 10]],
      [[0, -150], [10, -80], [5, 0], [15, 80], [0, 160]],
      [[-80, 40], [-100, 90], [-60, 140], [20, 160], [80, 130]]
    ],
    spawn: [0, 8, 0], treeDensity: 0.55, treeColor: 0x1e4a28, grassHue: 0.28,
    mountainScale: 1.1, riverScale: 0.9, sakura: false, waterColor: 0x2a5a6a
  },
  sakura: {
    name: 'Sakura Road',
    fogColor: 0xe8c0d0, fogNear: 50, fogFar: 280, sky: 0xd0e8f0,
    sunColor: 0xffe8f0, sunIntensity: 1.1, hemiSky: 0xf0d0e0, hemiGround: 0x6a8a60,
    roads: [
      [[-250, 0], [-150, 5], [-50, -5], [50, 8], [150, -3], [250, 10]],
      [[-30, -100], [-10, -40], [0, 20], [20, 80], [40, 140]]
    ],
    spawn: [0, 6, 0], treeDensity: 0.7, treeColor: 0xf0a0b8, grassHue: 0.3,
    mountainScale: 0.7, riverScale: 0.6, sakura: true, waterColor: 0x4a7a9a
  },
  coast: {
    name: 'Coastal Vista',
    fogColor: 0xb0c8e0, fogNear: 70, fogFar: 400, sky: 0x88b8e8,
    sunColor: 0xffd8a0, sunIntensity: 1.4, hemiSky: 0xc0d8f0, hemiGround: 0x5a7a40,
    roads: [
      [[-180, 40], [-100, 60], [-20, 50], [60, 70], [140, 55], [220, 80]],
      [[40, 50], [60, 20], [90, -20], [120, -60], [150, -100]],
      [[-50, -120], [30, -110], [110, -100], [190, -90]]
    ],
    spawn: [0, 10, 50], treeDensity: 0.35, treeColor: 0x2a5a32, grassHue: 0.25,
    mountainScale: 1.4, riverScale: 0.4, sakura: false, waterColor: 0x1a4a7a, ocean: true
  },
  island: {
    name: 'Horizon Island',
    fogColor: 0x90b0a0, fogNear: 90, fogFar: 450, sky: 0x7ab0d8,
    sunColor: 0xfff5e0, sunIntensity: 1.3, hemiSky: 0xb0d0f0, hemiGround: 0x4a6a38,
    roads: [
      [[-220, -80], [-180, 40], [-80, 140], [40, 180], [160, 120], [220, 20], [180, -100], [60, -160], [-80, -140], [-200, -60], [-220, -80]],
      [[0, -180], [10, -80], [0, 20], [-10, 100], [5, 180]],
      [[-160, 20], [-60, 30], [40, 15], [140, 40]],
      [[-40, 80], [-20, 120], [30, 150], [80, 130]],
      [[40, -40], [70, -20], [100, 0], [90, 40]]
    ],
    spawn: [0, 8, -20], treeDensity: 0.4, treeColor: 0x246030, grassHue: 0.27,
    mountainScale: 1.6, riverScale: 1.0, sakura: false, waterColor: 0x1a5070, ocean: true, large: true
  }
};

let activeMap = MAPS.forest;

function getTerrainHeight(x, z) {
  const m = activeMap;
  let h = fbm(x * 0.007, z * 0.007, 4) * 14;
  const mont = fbm(x * 0.0025 + 40, z * 0.0025 + 40, 5);
  if (mont > 0.52) h += (mont - 0.52) * 70 * (m.mountainScale || 1);
  const river = Math.abs(fbm(x * 0.0035 + 70, z * 0.0035 + 70, 3) - 0.5);
  if (river < 0.05 * (m.riverScale || 1)) h -= (0.05 * (m.riverScale || 1) - river) * 60;
  if (isNearRoad(x, z, 9)) h = Math.max(h * 0.35, 0.5);
  // Flatten city areas
  if (isCityChunk(Math.floor(x / 72), Math.floor(z / 72))) h = Math.max(h * 0.15, 0.3);
  if (m.ocean && (m.id === 'coast' || m.id === 'island') && z < -90) {
    h = Math.min(h, -2 + (z + 90) * 0.15);
  }
  return h;
}

function isRiver(x, z) {
  const river = Math.abs(fbm(x * 0.0035 + 70, z * 0.0035 + 70, 3) - 0.5);
  return river < 0.038 * (activeMap.riverScale || 1);
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
  if (!activeMap.roads) return false;
  for (const path of activeMap.roads) {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      if (distToSegment(x, z, a[0], a[1], b[0], b[1]) < width) return true;
    }
  }
  return false;
}

function isOnRoad(x, z) {
  return isNearRoad(x, z, 5.5);
}

// Low-chance city: ~8% of chunks, deterministic by chunk coord
function isCityChunk(cx, cz) {
  if (mode === 'race') return false;
  const h = hash(cx * 19.7 + 3.1, cz * 31.3 + 7.9);
  return h > 0.92; // ~8% chance
}

// ─── Chunk system ────────────────────────────────────────────
const CHUNK_SIZE = 72;
const CHUNK_RES = 36;
const VIEW_DIST = 4;
const chunks = new Map();

const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 1.6, 6);
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 });
const rockGeo = new THREE.DodecahedronGeometry(1.1, 0);
const rockMat = new THREE.MeshStandardMaterial({ color: 0x6a6a5a, roughness: 0.95 });
const bldgMats = [
  new THREE.MeshStandardMaterial({ color: 0x6a7a8a, roughness: 0.7, metalness: 0.15 }),
  new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.75 }),
  new THREE.MeshStandardMaterial({ color: 0x5a6a7a, roughness: 0.65, metalness: 0.2 }),
  new THREE.MeshStandardMaterial({ color: 0x9a8a7a, roughness: 0.8 }),
  new THREE.MeshStandardMaterial({ color: 0x4a5a6a, roughness: 0.6, metalness: 0.25 })
];
const windowMat = new THREE.MeshStandardMaterial({
  color: 0x88aacc, emissive: 0x334455, emissiveIntensity: 0.3, metalness: 0.5, roughness: 0.2
});

function chunkKey(cx, cz) { return cx + ',' + cz; }

function createFoliageMesh(isSakura) {
  if (isSakura) {
    return new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xf0a0b8, roughness: 0.85 })
    );
  }
  return new THREE.Mesh(
    new THREE.ConeGeometry(1.4, 4.2, 7),
    new THREE.MeshStandardMaterial({ color: activeMap.treeColor, roughness: 0.88 })
  );
}

function addCityToChunk(group, cx, cz) {
  // Small city block – buildings on a grid, low chance overall
  const baseY = 0.4;
  const grid = 3 + Math.floor(hash(cx, cz) * 3); // 3–5 buildings per side
  const spacing = CHUNK_SIZE / (grid + 1);
  const roadW = 6;

  // City ground patch (asphalt)
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(CHUNK_SIZE * 0.85, 0.2, CHUNK_SIZE * 0.85),
    new THREE.MeshStandardMaterial({ color: 0x333338, roughness: 0.9 })
  );
  pad.position.y = baseY;
  pad.receiveShadow = true;
  group.add(pad);

  for (let ix = 0; ix < grid; ix++) {
    for (let iz = 0; iz < grid; iz++) {
      // Skip some for streets
      if ((ix + iz) % 3 === 0 && hash(cx + ix, cz + iz) > 0.4) continue;

      const lx = (ix - (grid - 1) / 2) * spacing;
      const lz = (iz - (grid - 1) / 2) * spacing;
      const hSeed = hash(cx * 10 + ix, cz * 10 + iz);
      const bw = 4 + hSeed * 6;
      const bd = 4 + hash(ix + 2, iz + 5) * 6;
      const bh = 6 + hSeed * 28; // 6–34 units tall

      const mat = bldgMats[Math.floor(hSeed * bldgMats.length)];
      const bldg = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
      bldg.position.set(lx, baseY + bh / 2, lz);
      bldg.castShadow = true;
      bldg.receiveShadow = true;
      group.add(bldg);

      // Simple windows
      if (bh > 10) {
        const floors = Math.floor(bh / 3.5);
        for (let f = 1; f < floors; f++) {
          const wy = baseY + f * 3.5;
          for (const side of [-1, 1]) {
            const win = new THREE.Mesh(
              new THREE.BoxGeometry(bw * 0.7, 1.2, 0.15),
              windowMat
            );
            win.position.set(lx, wy, lz + side * (bd / 2 + 0.05));
            group.add(win);
          }
        }
      }
    }
  }

  // Street lights
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const lx = Math.cos(ang) * (CHUNK_SIZE * 0.3);
    const lz = Math.sin(ang) * (CHUNK_SIZE * 0.3);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.15, 5, 6),
      new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    pole.position.set(lx, baseY + 2.5, lz);
    pole.castShadow = true;
    group.add(pole);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffaa, emissive: 0xffaa44, emissiveIntensity: 0.8 })
    );
    lamp.position.set(lx, baseY + 5.2, lz);
    group.add(lamp);
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
    if (city) h = Math.max(h * 0.1, 0.25);
    pos.setY(i, h);

    if (city) {
      color.setHSL(0.0, 0.02, 0.2 + Math.random() * 0.05);
    } else if (isOnRoad(wx, wz)) {
      color.setHSL(0.08, 0.04, 0.22 + Math.random() * 0.04);
    } else if (isRiver(wx, wz) || h < -1) {
      color.set(m.waterColor || 0x2a5a6a);
    } else if (h > 22) {
      color.setHSL(0.08, 0.08, 0.55 + (h - 22) * 0.008);
    } else if (h > 10) {
      color.setHSL(0.1, 0.22, 0.32);
    } else {
      const gVar = fbm(wx * 0.05, wz * 0.05, 2);
      color.setHSL((m.grassHue || 0.28) + gVar * 0.04, 0.4 + gVar * 0.15, 0.26 + gVar * 0.08);
      if (m.sakura) color.offsetHSL(0.02, 0.05, 0.03);
    }
    colors.push(color.r, color.g, color.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.92, metalness: 0.03
  }));
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  group.add(mesh);

  if (city) {
    addCityToChunk(group, cx, cz);
  } else {
    // Trees / rocks
    const count = Math.floor(35 * (m.treeDensity || 0.4));
    for (let i = 0; i < count; i++) {
      const lx = (Math.random() - 0.5) * CHUNK_SIZE * 0.92;
      const lz = (Math.random() - 0.5) * CHUNK_SIZE * 0.92;
      const wx = cx * CHUNK_SIZE + lx;
      const wz = cz * CHUNK_SIZE + lz;
      if (isNearRoad(wx, wz, 8) || isRiver(wx, wz)) continue;
      const h = getTerrainHeight(wx, wz);
      if (h > 20 || h < 0) continue;

      if (Math.random() < 0.85) {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.8;
        trunk.castShadow = true;
        tree.add(trunk);
        const foliage = createFoliageMesh(m.sakura);
        foliage.position.y = m.sakura ? 2.8 : 3.4;
        foliage.castShadow = true;
        tree.add(foliage);
        if (m.sakura && Math.random() > 0.4) {
          const extra = createFoliageMesh(true);
          extra.position.set((Math.random() - 0.5) * 1.5, 2.2 + Math.random(), (Math.random() - 0.5) * 1.5);
          extra.scale.setScalar(0.6 + Math.random() * 0.4);
          tree.add(extra);
        }
        tree.position.set(lx, h, lz);
        tree.scale.setScalar(0.65 + Math.random() * 0.9);
        tree.rotation.y = Math.random() * Math.PI * 2;
        group.add(tree);
      } else {
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set(lx, h + 0.35, lz);
        rock.scale.setScalar(0.4 + Math.random() * 1.1);
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
          new THREE.BoxGeometry(10, 0.55, 5),
          new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.85 })
        );
        bridge.position.set(lx, getTerrainHeight(wx, wz) + 1.8, lz);
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
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.88 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });

  for (const path of activeMap.roads) {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const ax = a[0], az = a[1], bx = b[0], bz = b[1];
      const len = Math.hypot(bx - ax, bz - az);
      const midX = (ax + bx) / 2, midZ = (az + bz) / 2;
      const hy = (getTerrainHeight(ax, az) + getTerrainHeight(bx, bz) + getTerrainHeight(midX, midZ)) / 3 + 0.35;

      const seg = new THREE.Mesh(new THREE.BoxGeometry(11, 0.28, len + 1.2), roadMat);
      seg.position.set(midX, hy, midZ);
      seg.lookAt(bx, hy, bz);
      seg.rotateX(Math.PI / 2);
      seg.receiveShadow = true;
      scene.add(seg);
      roadMeshes.push(seg);

      if (i % 2 === 0) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, Math.min(3, len * 0.4)), lineMat);
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
   REAL VEHICLE PHYSICS
   - Gravity always active
   - 4-corner ground probes → can fall off cliffs / go airborne
   - Angular velocity for pitch & roll (tilt / tumble)
   - Suspension spring forces
   - Bounce on hard landings
   - World interaction: terrain normals affect orientation
   - NO water slowdown
   ============================================================ */
class Car {
  constructor(color = 0xff3333, isPlayer = false) {
    this.isPlayer = isPlayer;
    this.wheels = [];
    this.mesh = this.createMesh(color);
    scene.add(this.mesh);

    this.pos = new THREE.Vector3(0, 5, 0);
    this.vel = new THREE.Vector3(0, 0, 0);       // world velocity
    this.angVel = new THREE.Vector3(0, 0, 0);    // pitch, yaw, roll rates
    this.heading = 0;
    this.pitch = 0;
    this.roll = 0;

    this.speed = 0; // forward speed along heading (for convenience)
    this.steerAngle = 0;
    this.throttle = 0;
    this.brake = 0;
    this.handbrake = false;
    this.boost = 0;
    this.onGround = false;
    this.groundNormal = new THREE.Vector3(0, 1, 0);

    this.lap = 1;
    this.checkpoint = 0;
    this.finished = false;
    this.finishTime = 0;
    this.name = isPlayer ? 'You' : 'Bot';

    // Tuning
    this.maxSteer = 0.58;
    this.engineForce = 48;
    this.brakeForce = 60;
    this.drag = 0.38;
    this.rollingResistance = 6;
    this.lateralGrip = 22;
    this.handbrakeGrip = 3.2;
    this.mass = 1300;
    this.gravity = 28;
    this.suspensionStiffness = 45;
    this.suspensionDamping = 12;
    this.restLength = 0.55; // wheel rest height above ground sample
    this.wheelBase = 1.35;  // half length
    this.trackWidth = 0.9;  // half width
  }

  createMesh(color) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.28 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.52, 4.3), bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    g.add(body);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.48, 1.85),
      new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.4, roughness: 0.2 })
    );
    cabin.position.set(0, 1.02, -0.15);
    cabin.castShadow = true;
    g.add(cabin);

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x88aacc, metalness: 0.9, roughness: 0.08, transparent: true, opacity: 0.55
    });
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.38, 0.08), glassMat);
    windshield.position.set(0, 1.08, 0.75);
    windshield.rotation.x = -0.28;
    g.add(windshield);

    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
    [[-0.95, 0.38, 1.4], [0.95, 0.38, 1.4], [-0.95, 0.38, -1.4], [0.95, 0.38, -1.4]].forEach(p => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(...p);
      w.castShadow = true;
      g.add(w);
      this.wheels.push(w);
    });

    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffaa, emissiveIntensity: 0.85 });
    [[-0.6, 0.55, 2.15], [0.6, 0.55, 2.15]].forEach(p => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.1), lightMat);
      l.position.set(...p);
      g.add(l);
    });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 });
    [[-0.6, 0.55, -2.15], [0.6, 0.55, -2.15]].forEach(p => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.08), tailMat);
      l.position.set(...p);
      g.add(l);
    });
    return g;
  }

  // Sample ground at a world XZ, return height
  sampleGround(x, z) {
    return getTerrainHeight(x, z);
  }

  // 4 corner probes relative to car orientation
  getWheelWorldPositions() {
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    const offsets = [
      { x: -this.trackWidth, z: this.wheelBase },  // FL
      { x: this.trackWidth, z: this.wheelBase },   // FR
      { x: -this.trackWidth, z: -this.wheelBase }, // RL
      { x: this.trackWidth, z: -this.wheelBase }   // RR
    ];
    return offsets.map(o => ({
      x: this.pos.x + o.x * c + o.z * s,
      z: this.pos.z - o.x * s + o.z * c,
      localX: o.x,
      localZ: o.z
    }));
  }

  update(dt) {
    // ── Input ──
    if (this.isPlayer) {
      this.throttle = (keys['KeyW'] || keys['ArrowUp']) ? 1 : 0;
      this.brake = (keys['KeyS'] || keys['ArrowDown']) ? 1 : 0;
      const steerInput = ((keys['KeyA'] || keys['ArrowLeft']) ? 1 : 0) - ((keys['KeyD'] || keys['ArrowRight']) ? 1 : 0);
      this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, steerInput * this.maxSteer, 10 * dt);
      this.handbrake = !!keys['Space'];
      if (keys['ShiftLeft'] || keys['ShiftRight']) this.boost = Math.min(1, this.boost + dt * 2);
      else this.boost = Math.max(0, this.boost - dt * 1.5);
    }

    // ── Gravity (always) ──
    this.vel.y -= this.gravity * dt;

    // ── Ground probes (4 corners) ──
    const wheels = this.getWheelWorldPositions();
    let groundedCount = 0;
    let totalForceY = 0;
    let avgNormal = new THREE.Vector3(0, 0, 0);
    let pitchTorque = 0;
    let rollTorque = 0;

    const suspensionTravel = 0.7;

    for (const w of wheels) {
      const groundY = this.sampleGround(w.x, w.z);
      // Approximate normal from nearby samples
      const hL = this.sampleGround(w.x - 0.8, w.z);
      const hR = this.sampleGround(w.x + 0.8, w.z);
      const hF = this.sampleGround(w.x, w.z + 0.8);
      const hB = this.sampleGround(w.x, w.z - 0.8);
      const n = new THREE.Vector3(hL - hR, 2, hB - hF).normalize();

      // Wheel world height (car body + rest offset, accounting for pitch/roll roughly)
      const wheelY = this.pos.y - this.restLength +
        w.localZ * Math.sin(this.pitch) * 0.3 -
        w.localX * Math.sin(this.roll) * 0.3;

      const compression = groundY + this.restLength - (this.pos.y + w.localZ * Math.sin(this.pitch) * 0.15 - w.localX * Math.sin(this.roll) * 0.15);

      if (compression > -0.15 && compression < suspensionTravel + 0.4) {
        // In contact or close
        const spring = compression * this.suspensionStiffness;
        const damp = -this.vel.y * this.suspensionDamping;
        const force = Math.max(0, spring + damp);
        totalForceY += force;
        groundedCount++;
        avgNormal.add(n);

        // Torque from uneven compression
        pitchTorque += -w.localZ * force * 0.015;
        rollTorque += w.localX * force * 0.02;

        // Hard contact: push out of ground
        if (compression > suspensionTravel * 0.85) {
          const penetration = compression - suspensionTravel * 0.7;
          this.pos.y += penetration * 0.5;
          if (this.vel.y < 0) this.vel.y *= -0.25; // bounce
        }
      }
    }

    this.onGround = groundedCount >= 1;

    if (this.onGround && groundedCount > 0) {
      avgNormal.multiplyScalar(1 / groundedCount).normalize();
      this.groundNormal.copy(avgNormal);

      // Apply suspension force
      this.vel.y += (totalForceY / this.mass) * dt * 55;

      // Align pitch/roll toward terrain (soft)
      const targetPitch = Math.atan2(-avgNormal.z, avgNormal.y) * 0.9;
      const targetRoll = Math.atan2(avgNormal.x, avgNormal.y) * 0.9;

      // Spring toward terrain orientation + suspension torque
      this.angVel.x += (targetPitch - this.pitch) * 8 * dt + pitchTorque * dt;
      this.angVel.z += (targetRoll - this.roll) * 8 * dt + rollTorque * dt;

      // Dampen angular when grounded
      this.angVel.x *= (1 - 6 * dt);
      this.angVel.z *= (1 - 6 * dt);
    } else {
      // Airborne – free tumble, slight angular damping
      this.angVel.x *= (1 - 0.3 * dt);
      this.angVel.z *= (1 - 0.3 * dt);
      // Extra gravity feel
      this.vel.y -= this.gravity * 0.15 * dt;
    }

    // Integrate angular
    this.pitch += this.angVel.x * dt;
    this.roll += this.angVel.z * dt;
    // Clamp extreme tumbles a bit for playability but allow flips
    this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI * 0.9, Math.PI * 0.9);
    this.roll = THREE.MathUtils.clamp(this.roll, -Math.PI * 0.95, Math.PI * 0.95);

    // ── Longitudinal / lateral (only effective when mostly upright & grounded) ──
    const upright = Math.cos(this.pitch) * Math.cos(this.roll);
    const canDrive = this.onGround && upright > 0.35;

    if (canDrive) {
      let force = 0;
      force += this.throttle * this.engineForce * (1 + this.boost * 0.8);
      force -= this.brake * this.brakeForce * Math.sign(this.speed || 1);
      force -= this.rollingResistance * Math.sign(this.speed);
      force -= this.drag * this.speed * Math.abs(this.speed) * 0.012;

      // Road grip bonus
      if (isOnRoad(this.pos.x, this.pos.z) || isCityChunk(Math.floor(this.pos.x / CHUNK_SIZE), Math.floor(this.pos.z / CHUNK_SIZE))) {
        force *= 1.1;
      } else {
        force *= 0.78; // dirt
      }

      this.speed += (force / this.mass) * 58 * dt;
      this.speed = THREE.MathUtils.clamp(this.speed, -25, 62 + this.boost * 18);

      // Steering
      const steerFactor = Math.min(Math.abs(this.speed) * 0.09, 2.4);
      this.heading += this.steerAngle * steerFactor * dt * Math.sign(this.speed || 1);
      this.angVel.y = this.steerAngle * steerFactor * Math.sign(this.speed || 1);

      // Project velocity onto heading with lateral grip
      const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
      const desired = forward.clone().multiplyScalar(this.speed);
      const horiz = new THREE.Vector3(this.vel.x, 0, this.vel.z);
      const slip = horiz.clone().sub(desired);
      const grip = this.handbrake ? this.handbrakeGrip : this.lateralGrip;
      this.vel.x += -slip.x * grip * dt;
      this.vel.z += -slip.z * grip * dt;
      this.vel.x = THREE.MathUtils.lerp(this.vel.x, desired.x, 10 * dt);
      this.vel.z = THREE.MathUtils.lerp(this.vel.z, desired.z, 10 * dt);
    } else {
      // Airborne or upside down – speed bleeds, limited control
      this.speed *= (1 - 0.4 * dt);
      if (this.isPlayer && Math.abs(this.steerAngle) > 0.1) {
        // Slight air control
        this.heading += this.steerAngle * 0.4 * dt;
      }
      // Keep some of previous horizontal velocity
      this.vel.x *= (1 - 0.15 * dt);
      this.vel.z *= (1 - 0.15 * dt);
    }

    // ── Integrate position ──
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;

    // Safety: if fallen very far below terrain, soft reset upward
    const gY = this.sampleGround(this.pos.x, this.pos.z);
    if (this.pos.y < gY - 15) {
      this.pos.y = gY + 3;
      this.vel.set(0, 0, 0);
      this.speed = 0;
      this.pitch = 0;
      this.roll = 0;
      this.angVel.set(0, 0, 0);
    }

    // ── Visuals ──
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.order = 'YXZ';
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.x = this.pitch;
    this.mesh.rotation.z = this.roll;

    const wheelSpin = this.speed * dt * 2.6;
    this.wheels.forEach((w, i) => {
      w.rotation.x += wheelSpin;
      if (i < 2) w.rotation.y = this.steerAngle * 0.85;
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
    this.steerAngle = THREE.MathUtils.clamp(diff * 1.9, -this.maxSteer, this.maxSteer);
    this.throttle = 0.7 + Math.random() * 0.25;
    this.brake = Math.abs(diff) > 1.15 ? 0.35 : 0;
    this.handbrake = Math.abs(diff) > 1.5 && Math.abs(this.speed) > 14;
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
    mid.y = (getTerrainHeight(mid.x, mid.z) + a.y + b.y) / 3 + 0.2;
    const len = a.distanceTo(b);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(10, 0.25, len + 0.6), roadMat);
    seg.position.copy(mid);
    seg.lookAt(b.x, mid.y, b.z);
    seg.rotateX(Math.PI / 2);
    seg.receiveShadow = true;
    scene.add(seg);
    roadMeshes.push(seg);
    if (i % 2 === 0) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.28, 2), lineMat);
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
      bot.pos.set(-(i + 1) * 3.5, 4, -(i + 1) * 3.5);
      bots.push(bot);
      allCars.push(bot);
    }
    player.pos.set(0, 4, 0);
  } else {
    const s = activeMap.spawn;
    player.pos.set(s[0], s[1] + 2, s[2]);
    player.heading = 0;
  }
}

const camOffset = new THREE.Vector3(0, 5.2, -11);
const camLook = new THREE.Vector3(0, 1.4, 8);
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
    targetPos.y = Math.max(targetPos.y, getTerrainHeight(targetPos.x, targetPos.z) + 4);
    camera.position.lerp(targetPos, 5.5 * dt);
    const lookAt = player.pos.clone().add(camLook.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), player.heading));
    camera.lookAt(lookAt);
  } else if (camMode === 1) {
    const hood = new THREE.Vector3(0, 1.4, 0.9).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.heading);
    camera.position.copy(player.pos).add(hood);
    const fwd = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
    camera.lookAt(player.pos.clone().add(fwd.multiplyScalar(22)).add(new THREE.Vector3(0, 1.2, 0)));
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

  const scale = mode === 'explore' ? 0.22 : 0.32;
  const cx = w / 2, cy = h / 2;

  if (mode === 'explore' && activeMap.roads) {
    minimapCtx.strokeStyle = '#555';
    minimapCtx.lineWidth = 2.5;
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

  // City markers on minimap
  if (mode === 'explore') {
    const pcx = Math.floor(player.pos.x / CHUNK_SIZE);
    const pcz = Math.floor(player.pos.z / CHUNK_SIZE);
    minimapCtx.fillStyle = '#aabbcc';
    for (let dx = -6; dx <= 6; dx++) {
      for (let dz = -6; dz <= 6; dz++) {
        if (isCityChunk(pcx + dx, pcz + dz)) {
          const x = cx + (dx * CHUNK_SIZE) * scale;
          const y = cy + (dz * CHUNK_SIZE) * scale;
          minimapCtx.fillRect(x - 3, y - 3, 6, 6);
        }
      }
    }
  }

  if (mode === 'race' && trackPoints.length) {
    minimapCtx.strokeStyle = '#555';
    minimapCtx.lineWidth = 3.5;
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
    const x = cx + (b.pos.x - player.pos.x) * scale;
    const y = cy + (b.pos.z - player.pos.z) * scale;
    minimapCtx.fillStyle = '#ff6644';
    minimapCtx.beginPath();
    minimapCtx.arc(x, y, 3, 0, Math.PI * 2);
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
  minimapCtx.lineTo(cx + Math.sin(player.heading) * 11, cy + Math.cos(player.heading) * 11);
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
          if (car === player) {
            raceFinished = true;
            showFinish();
          }
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
  const place = ranked.indexOf(player) + 1;
  finishTitle.textContent = place === 1 ? '🏆 WINNER!' : 'Finished P' + place;
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
  if (fromGame) {
    running = false;
    hudEl.classList.add('hidden');
  } else {
    menuEl.classList.add('hidden');
  }
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
  if (selectedMode === 'explore') {
    openMapSelect(false);
    return;
  }
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
    ...MAPS.forest,
    id: 'race',
    roads: [],
    treeDensity: 0.25,
    mountainScale: 0.8,
    riverScale: 0.5,
    sakura: false,
    ocean: false
  };
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 90, 380);
  hemi.color.set(0xb1e1ff);
  hemi.groundColor.set(0xb97a20);
  sun.color.set(0xfff5e0);
  sun.intensity = 1.35;

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
    const h = getTerrainHeight(player.pos.x, player.pos.z);
    player.pos.y = h + 3;
    player.vel.set(0, 0, 0);
    player.speed = 0;
    player.pitch = 0;
    player.roll = 0;
    player.angVel.set(0, 0, 0);
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
