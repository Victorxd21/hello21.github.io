import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ============================================================
   RACE – Per-wheel physics + infinite highway + NPC traffic
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

let mode = null, currentMapId = 'forest', running = false;
let raceStarted = false, raceFinished = false, startTime = 0, raceTime = 0, currentLap = 1;
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
sun.shadow.camera.left = sun.shadow.camera.bottom = -150;
sun.shadow.camera.right = sun.shadow.camera.top = 150;
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
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return hash(xi, zi) * (1 - u) * (1 - v) + hash(xi + 1, zi) * u * (1 - v) +
         hash(xi, zi + 1) * (1 - u) * v + hash(xi + 1, zi + 1) * u * v;
}
function fbm(x, z, oct = 5) {
  let val = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < oct; i++) { val += noise2D(x * freq, z * freq) * amp; max += amp; amp *= 0.5; freq *= 2; }
  return val / max;
}

function heightForest(x, z) {
  let h = fbm(x * 0.006, z * 0.006, 5) * 12;
  h += Math.sin(x * 0.015) * Math.cos(z * 0.012) * 4;
  const peak = fbm(x * 0.003 + 20, z * 0.003 + 20, 3);
  if (peak > 0.6) h += (peak - 0.6) * 35;
  const stream = Math.abs(fbm(x * 0.008 + 90, z * 0.008 + 90, 2) - 0.48);
  if (stream < 0.04) h -= (0.04 - stream) * 25;
  return Math.max(h, -1);
}
function heightSakura(x, z) {
  let h = fbm(x * 0.004, z * 0.004, 4) * 5;
  h += Math.sin(x * 0.008) * 1.5 + Math.cos(z * 0.007) * 1.2;
  const rise = fbm(x * 0.002 + 5, z * 0.002 + 5, 3);
  if (rise > 0.55) h += (rise - 0.55) * 12;
  const stream = Math.abs(fbm(x * 0.01 + 40, z * 0.01 + 40, 2) - 0.5);
  if (stream < 0.03) h -= (0.03 - stream) * 8;
  return Math.max(h, 0);
}
function heightCoast(x, z) {
  let h = 8 + z * 0.04 + fbm(x * 0.005, z * 0.005, 4) * 10;
  if (z < -40) { const cliff = Math.max(0, (-40 - z) / 50); h -= cliff * cliff * 40; }
  h += Math.sin(x * 0.02) * Math.max(0, 1 - Math.abs(z + 30) / 40) * 8;
  const mont = fbm(x * 0.003 + 60, z * 0.003 + 60, 4);
  if (mont > 0.55 && z > 20) h += (mont - 0.55) * 55;
  if (h < -1) h = -3 + fbm(x * 0.02, z * 0.02, 2) * 1.5;
  return h;
}
function heightIsland(x, z) {
  let h = fbm(x * 0.005, z * 0.005, 5) * 10;
  const distNE = Math.hypot(x - 120, z - 140);
  if (distNE < 180) { const m = 1 - distNE / 180; h += m * m * 55 * fbm(x * 0.004 + 10, z * 0.004 + 10, 3); }
  const distC = Math.hypot(x, z);
  if (distC < 100) h *= 0.35 + distC / 100 * 0.4;
  if (z < -100 || x < -180) { const edge = Math.max(-z - 100, -x - 180, 0) / 40; h -= edge * edge * 30; }
  const lake = fbm(x * 0.006 + 200, z * 0.006 + 200, 3);
  if (lake > 0.72) h = Math.min(h, 1 - (lake - 0.72) * 20);
  return Math.max(h, -4);
}

const MAPS = {
  forest: {
    name: 'Forest Highway', fogColor: 0x6a8a6a, fogNear: 50, fogFar: 280, sky: 0x7a9a8a,
    sunColor: 0xfff0d0, sunIntensity: 1.15, hemiSky: 0x90b090, hemiGround: 0x2a4a28,
    roads: [[[-220,0],[-140,15],[-60,5],[20,-10],[100,8],[180,25],[260,5]],[[0,-160],[8,-90],[0,-20],[12,60],[5,150]],[[-90,30],[-110,80],[-70,130],[10,155],[70,120]]],
    spawn: [0, 6, 0], treeDensity: 0.65, treeColor: 0x1a4a22, grassHue: 0.28,
    heightFn: heightForest, waterColor: 0x1a4a5a, hasCities: true, hasHighway: true
  },
  sakura: {
    name: 'Sakura Road', fogColor: 0xf0d0e0, fogNear: 40, fogFar: 240, sky: 0xe0f0f8,
    sunColor: 0xffe8f0, sunIntensity: 1.05, hemiSky: 0xf8e0f0, hemiGround: 0x7a9a70,
    roads: [[[-280,0],[-180,3],[-80,-4],[20,6],[120,-2],[220,5],[300,0]],[[-40,-120],[-15,-50],[0,10],[25,90],[50,160]]],
    spawn: [0, 4, 0], treeDensity: 0.8, treeColor: 0xf0a0b8, grassHue: 0.32,
    heightFn: heightSakura, waterColor: 0x5a8aaa, sakura: true, hasCities: false, hasHighway: true
  },
  coast: {
    name: 'Coastal Vista', fogColor: 0xa8c8e8, fogNear: 60, fogFar: 380, sky: 0x78b0e8,
    sunColor: 0xffd8a0, sunIntensity: 1.45, hemiSky: 0xc0d8f0, hemiGround: 0x5a7a40,
    roads: [[[-200,50],[-110,70],[-20,55],[70,75],[160,60],[250,85]],[[50,55],[75,15],[110,-30],[145,-75],[180,-120]],[[-60,-130],[20,-115],[100,-105],[180,-95]]],
    spawn: [0, 12, 60], treeDensity: 0.3, treeColor: 0x2a5a32, grassHue: 0.24,
    heightFn: heightCoast, waterColor: 0x1a4a7a, ocean: true, hasCities: false, hasHighway: true
  },
  island: {
    name: 'Horizon Island', fogColor: 0x88a898, fogNear: 80, fogFar: 420, sky: 0x70a8d0,
    sunColor: 0xfff5e0, sunIntensity: 1.3, hemiSky: 0xb0d0f0, hemiGround: 0x4a6a38,
    roads: [[[-240,-90],[-190,30],[-90,150],[30,190],[150,130],[230,10],[190,-110],[50,-170],[-90,-150],[-210,-70],[-240,-90]],[[0,-190],[8,-90],[0,10],[-8,110],[5,190]],[[-170,15],[-70,25],[30,10],[130,35]],[[-50,90],[-25,130],[25,160],[70,140]],[[50,-50],[80,-25],[110,5],[100,45]]],
    spawn: [0, 6, -30], treeDensity: 0.35, treeColor: 0x246030, grassHue: 0.27,
    heightFn: heightIsland, waterColor: 0x1a5070, ocean: true, large: true, hasCities: true, hasHighway: true
  }
};
let activeMap = MAPS.forest;

/* ─── Infinite Highway ───────────────────────────────────────
   Wide dual-lane road that runs forever along X with gentle curves.
   Z-center = highwayZ(x)  – slight sine so it feels alive.
*/
const HW_HALF_WIDTH = 9; // total ~18 units wide

function highwayZ(x) {
  // Gentle infinite curves
  return Math.sin(x * 0.008) * 18 + Math.sin(x * 0.003) * 8;
}
function highwayHeading(x) {
  // Tangent of the curve for NPC direction
  const dz = Math.cos(x * 0.008) * 18 * 0.008 + Math.cos(x * 0.003) * 8 * 0.003;
  return Math.atan2(dz, 1); // mostly facing +X
}
function distToHighway(x, z) {
  if (!activeMap.hasHighway) return 9999;
  return Math.abs(z - highwayZ(x));
}
function isOnHighway(x, z) {
  return distToHighway(x, z) < HW_HALF_WIDTH;
}

function getTerrainHeight(x, z) {
  let h = activeMap.heightFn(x, z);
  // Flatten pre-made roads
  if (isNearRoad(x, z, 10)) {
    const roadH = Math.max(h * 0.2, 0.4);
    const blend = 1 - Math.min(1, distToNearestRoad(x, z) / 10);
    h = h * (1 - blend * 0.85) + roadH * blend * 0.85;
  }
  // Flatten infinite highway (stronger / wider)
  if (activeMap.hasHighway) {
    const d = distToHighway(x, z);
    if (d < HW_HALF_WIDTH + 4) {
      const blend = 1 - Math.min(1, d / (HW_HALF_WIDTH + 4));
      const hwH = Math.max(h * 0.15, 0.5);
      h = h * (1 - blend * 0.9) + hwH * blend * 0.9;
    }
  }
  if (isCityChunk(Math.floor(x / 72), Math.floor(z / 72))) h = Math.max(h * 0.08, 0.3);
  return h;
}
function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz;
  if (len2 < 0.001) return Math.hypot(px - ax, pz - az);
  let t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}
function distToNearestRoad(x, z) {
  let best = 9999;
  if (activeMap.roads) {
    for (const path of activeMap.roads)
      for (let i = 0; i < path.length - 1; i++)
        best = Math.min(best, distToSegment(x, z, path[i][0], path[i][1], path[i+1][0], path[i+1][1]));
  }
  best = Math.min(best, distToHighway(x, z));
  return best;
}
function isNearRoad(x, z, w = 7) { return distToNearestRoad(x, z) < w; }
function isOnRoad(x, z) { return distToNearestRoad(x, z) < 5.5 || isOnHighway(x, z); }
function isRiver(x, z) {
  if (activeMap.id === 'sakura') return Math.abs(fbm(x * 0.01 + 40, z * 0.01 + 40, 2) - 0.5) < 0.025;
  if (activeMap.id === 'coast' || activeMap.id === 'island') return getTerrainHeight(x, z) < -0.5;
  return Math.abs(fbm(x * 0.008 + 90, z * 0.008 + 90, 2) - 0.48) < 0.032;
}
function isCityChunk(cx, cz) {
  if (mode === 'race' || !activeMap.hasCities) return false;
  return hash(cx * 19.7 + 3.1, cz * 31.3 + 7.9) > 0.93;
}

const CHUNK_SIZE = 72, CHUNK_RES = 40, VIEW_DIST = 4;
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
const windowMat = new THREE.MeshStandardMaterial({ color: 0x88aacc, emissive: 0x334455, emissiveIntensity: 0.25, metalness: 0.5, roughness: 0.2 });
const hwRoadMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.88 });
const hwLineMat = new THREE.MeshStandardMaterial({ color: 0xeeee88 });
const hwEdgeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

function chunkKey(cx, cz) { return cx + ',' + cz; }
function createFoliageMesh(isSakura) {
  if (isSakura) return new THREE.Mesh(new THREE.SphereGeometry(2.0, 7, 5), new THREE.MeshStandardMaterial({ color: 0xf0a0b8, roughness: 0.85 }));
  return new THREE.Mesh(new THREE.ConeGeometry(1.3, 4.0, 6), new THREE.MeshStandardMaterial({ color: activeMap.treeColor, roughness: 0.88 }));
}
function addCityToChunk(group, cx, cz) {
  const baseY = 0.35, grid = 3 + Math.floor(hash(cx, cz) * 3), spacing = CHUNK_SIZE / (grid + 1);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(CHUNK_SIZE * 0.85, 0.18, CHUNK_SIZE * 0.85), new THREE.MeshStandardMaterial({ color: 0x333338, roughness: 0.9 }));
  pad.position.y = baseY; pad.receiveShadow = true; group.add(pad);
  for (let ix = 0; ix < grid; ix++) for (let iz = 0; iz < grid; iz++) {
    if ((ix + iz) % 3 === 0 && hash(cx + ix, cz + iz) > 0.4) continue;
    const lx = (ix - (grid - 1) / 2) * spacing, lz = (iz - (grid - 1) / 2) * spacing;
    const hSeed = hash(cx * 10 + ix, cz * 10 + iz);
    const bw = 4 + hSeed * 5, bd = 4 + hash(ix + 2, iz + 5) * 5, bh = 5 + hSeed * 26;
    const bldg = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), bldgMats[Math.floor(hSeed * bldgMats.length)]);
    bldg.position.set(lx, baseY + bh / 2, lz); bldg.castShadow = true; bldg.receiveShadow = true; group.add(bldg);
  }
}

function addHighwayToChunk(group, cx, cz) {
  if (!activeMap.hasHighway) return;
  // Build highway segments across this chunk in world X
  const x0 = cx * CHUNK_SIZE - CHUNK_SIZE / 2;
  const x1 = cx * CHUNK_SIZE + CHUNK_SIZE / 2;
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    const xa = x0 + (i / steps) * CHUNK_SIZE;
    const xb = x0 + ((i + 1) / steps) * CHUNK_SIZE;
    const za = highwayZ(xa), zb = highwayZ(xb);
    const midX = (xa + xb) / 2, midZ = (za + zb) / 2;
    const len = Math.hypot(xb - xa, zb - za);
    const hy = (getTerrainHeight(xa, za) + getTerrainHeight(xb, zb)) / 2 + 0.12;

    // Main asphalt (wide)
    const seg = new THREE.Mesh(new THREE.BoxGeometry(HW_HALF_WIDTH * 2, 0.18, len + 0.5), hwRoadMat);
    seg.position.set(midX - cx * CHUNK_SIZE, hy, midZ - cz * CHUNK_SIZE);
    seg.lookAt(xb - cx * CHUNK_SIZE, hy, zb - cz * CHUNK_SIZE);
    seg.rotateX(Math.PI / 2);
    seg.receiveShadow = true;
    group.add(seg);

    // Center dashed line
    if (i % 2 === 0) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, Math.min(3, len * 0.4)), hwLineMat);
      line.position.set(midX - cx * CHUNK_SIZE, hy + 0.02, midZ - cz * CHUNK_SIZE);
      line.lookAt(xb - cx * CHUNK_SIZE, hy, zb - cz * CHUNK_SIZE);
      line.rotateX(Math.PI / 2);
      group.add(line);
    }

    // Edge lines
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.19, len + 0.3), hwEdgeMat);
      // Offset perpendicular to road direction
      const dx = xb - xa, dz = zb - za, invLen = 1 / (len || 1);
      const px = -dz * invLen * HW_HALF_WIDTH * 0.92 * side;
      const pz = dx * invLen * HW_HALF_WIDTH * 0.92 * side;
      edge.position.set(midX - cx * CHUNK_SIZE + px, hy + 0.015, midZ - cz * CHUNK_SIZE + pz);
      edge.lookAt(xb - cx * CHUNK_SIZE + px, hy, zb - cz * CHUNK_SIZE + pz);
      edge.rotateX(Math.PI / 2);
      group.add(edge);
    }
  }
}

function createChunk(cx, cz) {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_RES, CHUNK_RES);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, colors = [], color = new THREE.Color();
  const m = activeMap, city = isCityChunk(cx, cz);
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i), lz = pos.getZ(i), wx = cx * CHUNK_SIZE + lx, wz = cz * CHUNK_SIZE + lz;
    let h = city ? 0.3 : getTerrainHeight(wx, wz);
    pos.setY(i, h);
    if (city) color.setHSL(0, 0.02, 0.2 + Math.random() * 0.04);
    else if (isOnHighway(wx, wz)) color.setHSL(0.08, 0.02, 0.18 + Math.random() * 0.03);
    else if (isOnRoad(wx, wz)) color.setHSL(0.08, 0.03, 0.2 + Math.random() * 0.03);
    else if (isRiver(wx, wz) || h < -0.3) color.set(m.waterColor);
    else if (h > 28) color.setHSL(0.08, 0.05, 0.6 + Math.min(0.2, (h - 28) * 0.01));
    else if (h > 14) color.setHSL(0.09, 0.18, 0.3);
    else { const gVar = fbm(wx * 0.04, wz * 0.04, 2); color.setHSL(m.grassHue + gVar * 0.03, 0.42 + gVar * 0.12, 0.25 + gVar * 0.07); if (m.sakura) color.offsetHSL(0.015, 0.04, 0.04); }
    colors.push(color.r, color.g, color.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02 }));
  mesh.receiveShadow = true; group.add(mesh);

  // Highway mesh on top of terrain
  addHighwayToChunk(group, cx, cz);

  if (city) addCityToChunk(group, cx, cz);
  else {
    const count = Math.floor(28 * m.treeDensity);
    for (let i = 0; i < count; i++) {
      const lx = (Math.random() - 0.5) * CHUNK_SIZE * 0.9, lz = (Math.random() - 0.5) * CHUNK_SIZE * 0.9;
      const wx = cx * CHUNK_SIZE + lx, wz = cz * CHUNK_SIZE + lz;
      if (isNearRoad(wx, wz, 10) || isOnHighway(wx, wz) || isRiver(wx, wz)) continue;
      const h = getTerrainHeight(wx, wz);
      if (h > 22 || h < 0.2) continue;
      if (Math.random() < 0.88) {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeo, trunkMat); trunk.position.y = 0.75; trunk.castShadow = true; tree.add(trunk);
        const foliage = createFoliageMesh(m.sakura); foliage.position.y = m.sakura ? 2.6 : 3.2; foliage.castShadow = true; tree.add(foliage);
        tree.position.set(lx, h, lz); tree.scale.setScalar(0.6 + Math.random() * 0.85); tree.rotation.y = Math.random() * Math.PI * 2; group.add(tree);
      } else {
        const rock = new THREE.Mesh(rockGeo, rockMat); rock.position.set(lx, h + 0.3, lz); rock.scale.setScalar(0.35 + Math.random()); rock.castShadow = true; group.add(rock);
      }
    }
  }
  group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
  scene.add(group); chunks.set(chunkKey(cx, cz), group); return group;
}
function updateChunks(px, pz) {
  const cx = Math.floor(px / CHUNK_SIZE), cz = Math.floor(pz / CHUNK_SIZE), needed = new Set();
  const range = activeMap.large ? 5 : VIEW_DIST;
  for (let dx = -range; dx <= range; dx++) for (let dz = -range; dz <= range; dz++) {
    const key = chunkKey(cx + dx, cz + dz); needed.add(key);
    if (!chunks.has(key)) createChunk(cx + dx, cz + dz);
  }
  for (const [key, group] of chunks) if (!needed.has(key)) {
    scene.remove(group);
    group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material.dispose(); } });
    chunks.delete(key);
  }
}
function clearChunks() {
  for (const [, group] of chunks) {
    scene.remove(group);
    group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material.dispose(); } });
  }
  chunks.clear();
}

let roadMeshes = [];
function buildRoadMeshes() {
  roadMeshes.forEach(m => scene.remove(m)); roadMeshes = [];
  if (!activeMap.roads) return;
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  for (const path of activeMap.roads) for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], ax = a[0], az = a[1], bx = b[0], bz = b[1];
    const len = Math.hypot(bx - ax, bz - az), midX = (ax + bx) / 2, midZ = (az + bz) / 2;
    let hy = 0; for (let s = 0; s <= 5; s++) { const t = s / 5; hy += getTerrainHeight(ax + (bx - ax) * t, az + (bz - az) * t); }
    hy = hy / 6 + 0.15;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.2, len + 0.8), roadMat);
    seg.position.set(midX, hy, midZ); seg.lookAt(bx, hy, bz); seg.rotateX(Math.PI / 2); seg.receiveShadow = true;
    scene.add(seg); roadMeshes.push(seg);
  }
}
function applyMapTheme(mapId) {
  activeMap = MAPS[mapId]; activeMap.id = mapId; currentMapId = mapId;
  scene.background = new THREE.Color(activeMap.sky);
  scene.fog = new THREE.Fog(activeMap.fogColor, activeMap.fogNear, activeMap.fogFar);
  hemi.color.set(activeMap.hemiSky); hemi.groundColor.set(activeMap.hemiGround);
  sun.color.set(activeMap.sunColor); sun.intensity = activeMap.sunIntensity;
  clearChunks(); buildRoadMeshes(); clearNPCs();
}

/* ─── Per-wheel physics (same as before, condensed) ─────────── */
class Wheel {
  constructor(localX, localZ, isFront) {
    this.localX = localX; this.localZ = localZ; this.isFront = isFront;
    this.radius = 0.38; this.suspensionRest = 0.45; this.suspensionMax = 0.75;
    this.springK = 16000; this.damper = 1400; this.grip = 1;
    this.compression = 0; this.onGround = false; this.groundY = 0;
    this.force = new THREE.Vector3(); this.spin = 0; this.steer = 0; this.mesh = null;
  }
}
class Car {
  constructor(color = 0xff3333, isPlayer = false) {
    this.isPlayer = isPlayer;
    this.wheels = [
      new Wheel(-0.92, 1.35, true), new Wheel(0.92, 1.35, true),
      new Wheel(-0.92, -1.35, false), new Wheel(0.92, -1.35, false)
    ];
    this.mesh = this.createMesh(color); scene.add(this.mesh);
    this.pos = new THREE.Vector3(0, 3, 0); this.vel = new THREE.Vector3();
    this.heading = 0; this.pitch = 0; this.roll = 0;
    this.angVelY = 0; this.angVelPitch = 0; this.angVelRoll = 0;
    this.throttle = 0; this.brake = 0; this.steerInput = 0; this.handbrake = false; this.boost = 0;
    this.onGround = false; this.mass = 1400;
    this.inertiaYaw = 2200; this.inertiaPitch = 1800; this.inertiaRoll = 900;
    this.enginePower = 9000; this.brakePower = 12000; this.maxSteer = 0.55; this.drag = 0.4;
    this.lap = 1; this.checkpoint = 0; this.finished = false; this.finishTime = 0;
    this.name = isPlayer ? 'You' : 'Bot';
  }
  createMesh(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.5, 4.2), new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.28 }));
    body.position.y = 0.55; body.castShadow = true; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 1.8), new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.4, roughness: 0.2 }));
    cabin.position.set(0, 1.0, -0.15); cabin.castShadow = true; g.add(cabin);
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 16); wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
    this.wheels.forEach(w => {
      const mesh = new THREE.Mesh(wheelGeo, wheelMat);
      mesh.position.set(w.localX, w.radius, w.localZ); mesh.castShadow = true; g.add(mesh); w.mesh = mesh;
    });
    return g;
  }
  wheelWorldPos(w) {
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    return {
      x: this.pos.x + w.localX * c + w.localZ * s,
      z: this.pos.z - w.localX * s + w.localZ * c,
      attachY: this.pos.y + w.localZ * Math.sin(this.pitch) - w.localX * Math.sin(this.roll)
    };
  }
  update(dt) {
    if (this.isPlayer) {
      this.throttle = (keys['KeyW'] || keys['ArrowUp']) ? 1 : 0;
      this.brake = (keys['KeyS'] || keys['ArrowDown']) ? 1 : 0;
      this.steerInput = ((keys['KeyA'] || keys['ArrowLeft']) ? 1 : 0) - ((keys['KeyD'] || keys['ArrowRight']) ? 1 : 0);
      this.handbrake = !!keys['Space'];
      if (keys['ShiftLeft'] || keys['ShiftRight']) this.boost = Math.min(1, this.boost + dt * 2);
      else this.boost = Math.max(0, this.boost - dt * 1.6);
    }
    const targetSteer = this.steerInput * this.maxSteer;
    for (const w of this.wheels) w.steer = w.isFront ? THREE.MathUtils.lerp(w.steer, targetSteer, 10 * dt) : 0;

    const onRoad = isOnRoad(this.pos.x, this.pos.z);
    const surfaceGrip = onRoad ? 1.0 : 0.55;
    let totalForce = new THREE.Vector3(), torquePitch = 0, torqueRoll = 0, torqueYaw = 0, groundedCount = 0;
    const cosY = Math.cos(this.heading), sinY = Math.sin(this.heading);

    for (const w of this.wheels) {
      const wp = this.wheelWorldPos(w);
      w.groundY = getTerrainHeight(wp.x, wp.z);
      const distToGround = wp.attachY - w.groundY;
      const compression = w.suspensionRest + w.radius - distToGround;
      w.force.set(0, 0, 0);
      if (compression > -0.05 && compression < w.suspensionMax + 0.3) {
        w.onGround = true; groundedCount++;
        w.compression = Math.max(0, Math.min(compression, w.suspensionMax));
        const springForce = w.compression * w.springK;
        const damperForce = -this.vel.y * w.damper;
        const suspForce = Math.max(0, springForce + damperForce);
        w.force.y += suspForce;
        if (compression > w.suspensionMax * 0.9) w.force.y += (compression - w.suspensionMax * 0.85) * w.springK * 2;

        const wh = this.heading + w.steer;
        const fDirX = Math.sin(wh), fDirZ = Math.cos(wh);
        const rDirX = Math.cos(wh), rDirZ = -Math.sin(wh);
        const relX = w.localX * cosY + w.localZ * sinY, relZ = -w.localX * sinY + w.localZ * cosY;
        const wxVel = this.vel.x - this.angVelY * relZ, wzVel = this.vel.z + this.angVelY * relX;
        const longSpeed = wxVel * fDirX + wzVel * fDirZ;
        const latSpeed = wxVel * rDirX + wzVel * rDirZ;

        let driveForce = 0;
        if (!w.isFront || this.boost > 0.1) {
          driveForce = this.throttle * this.enginePower * (1 + this.boost * 0.7) * surfaceGrip;
          if (w.isFront) driveForce *= 0.3;
        }
        let brakeForce = 0;
        if (this.brake > 0 || this.handbrake) {
          const bPow = this.handbrake && !w.isFront ? this.brakePower * 1.4 : this.brakePower;
          brakeForce = -Math.sign(longSpeed || 1) * this.brake * bPow * surfaceGrip;
        }
        const rollRes = -Math.sign(longSpeed || 1) * 80 * surfaceGrip;
        const longForce = driveForce + brakeForce + rollRes;
        const gripMul = this.handbrake && !w.isFront ? 0.25 : 1;
        let latForce = THREE.MathUtils.clamp(-latSpeed * 900 * surfaceGrip * gripMul, -5500 * surfaceGrip * gripMul, 5500 * surfaceGrip * gripMul);
        w.force.x += fDirX * longForce + rDirX * latForce;
        w.force.z += fDirZ * longForce + rDirZ * latForce;
        torquePitch += -w.localZ * suspForce * 0.001;
        torqueRoll += w.localX * suspForce * 0.0015;
        torqueYaw += (relX * w.force.z - relZ * w.force.x) * 0.001;
        w.spin += longSpeed * dt / w.radius;
      } else { w.onGround = false; w.compression = 0; }
      totalForce.add(w.force);
    }
    this.onGround = groundedCount >= 1;
    totalForce.y -= this.mass * 28;
    totalForce.x -= this.vel.x * Math.abs(this.vel.x) * this.drag * 8;
    totalForce.z -= this.vel.z * Math.abs(this.vel.z) * this.drag * 8;
    this.vel.x += (totalForce.x / this.mass) * dt;
    this.vel.y += (totalForce.y / this.mass) * dt;
    this.vel.z += (totalForce.z / this.mass) * dt;
    this.angVelPitch += (torquePitch / this.inertiaPitch) * dt * 60;
    this.angVelRoll += (torqueRoll / this.inertiaRoll) * dt * 60;
    this.angVelY += (torqueYaw / this.inertiaYaw) * dt * 40;
    if (this.onGround) { this.angVelPitch *= (1 - 8 * dt); this.angVelRoll *= (1 - 8 * dt); this.angVelY *= (1 - 3 * dt); }
    else { this.angVelPitch *= (1 - 0.5 * dt); this.angVelRoll *= (1 - 0.5 * dt); }
    this.heading += this.angVelY * dt;
    this.pitch = THREE.MathUtils.clamp(this.pitch + this.angVelPitch * dt, -1.2, 1.2);
    this.roll = THREE.MathUtils.clamp(this.roll + this.angVelRoll * dt, -1.3, 1.3);
    this.pos.x += this.vel.x * dt; this.pos.y += this.vel.y * dt; this.pos.z += this.vel.z * dt;
    if (this.onGround) {
      let avgG = 0; for (const w of this.wheels) avgG += w.groundY; avgG /= 4;
      if (this.pos.y < avgG + 0.15) { this.pos.y = avgG + 0.15; if (this.vel.y < 0) this.vel.y = 0; }
    }
    const gNow = getTerrainHeight(this.pos.x, this.pos.z);
    if (this.pos.y < gNow - 10) { this.pos.y = gNow + 1; this.vel.set(0,0,0); this.pitch = this.roll = 0; this.angVelPitch = this.angVelRoll = this.angVelY = 0; }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.order = 'YXZ';
    this.mesh.rotation.y = this.heading; this.mesh.rotation.x = this.pitch; this.mesh.rotation.z = this.roll;
    for (const w of this.wheels) {
      if (!w.mesh) continue;
      w.mesh.position.set(w.localX, w.radius - Math.min(w.compression, w.suspensionMax) * 0.6, w.localZ);
      w.mesh.rotation.y = w.steer; w.mesh.rotation.x = w.spin;
    }
  }
  get speed() {
    return this.vel.x * Math.sin(this.heading) + this.vel.z * Math.cos(this.heading);
  }
  updateAI(dt, target) {
    if (!target) return;
    const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
    let desired = Math.atan2(dx, dz), diff = desired - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    this.steerInput = THREE.MathUtils.clamp(diff * 2.2, -1, 1);
    this.throttle = 0.7 + Math.random() * 0.25;
    this.brake = Math.abs(diff) > 1.1 ? 0.4 : 0;
    this.handbrake = Math.abs(diff) > 1.5 && Math.abs(this.speed) > 12;
  }
}

/* ─── NPC Traffic on infinite highway ──────────────────────── */
const NPC_COLORS = [0xff4444, 0x44aa44, 0x4488ff, 0xffaa00, 0xcc44ff, 0xffffff, 0x333333, 0x00cccc];
let npcs = [];
const MAX_NPCS = 12;
const NPC_SPAWN_RANGE = 280;
const NPC_DESPAWN_RANGE = 350;

class NPCCar {
  constructor(x, lane, dir) {
    // dir: +1 = eastbound (+X), -1 = westbound
    this.dir = dir;
    this.lane = lane; // -1 left lane, +1 right lane relative to direction
    this.speed = 18 + Math.random() * 16; // m/s feel
    this.x = x;
    this.color = NPC_COLORS[Math.floor(Math.random() * NPC_COLORS.length)];
    this.mesh = this.createMesh();
    scene.add(this.mesh);
    this.updatePos(0);
  }
  createMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 3.8),
      new THREE.MeshStandardMaterial({ color: this.color, metalness: 0.5, roughness: 0.35 }));
    body.position.y = 0.5; body.castShadow = true; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.3, roughness: 0.2 }));
    cabin.position.set(0, 0.9, -0.1); g.add(cabin);
    return g;
  }
  updatePos(dt) {
    this.x += this.dir * this.speed * dt;
    const zCenter = highwayZ(this.x);
    // Lane offset perpendicular to road
    const hdg = highwayHeading(this.x);
    // Perpendicular (right relative to +X travel)
    const rightX = Math.cos(hdg), rightZ = -Math.sin(hdg); // wait: heading is atan2(dz,1)
    // For dir=+1, right is +perp; for dir=-1, lanes flip
    const laneOff = this.lane * 3.5 * this.dir;
    // Perpendicular vector to direction of travel
    // direction vector: (cos approx 1, sin = dz component)
    const fx = Math.cos(hdg), fz = Math.sin(hdg);
    // right = (-fz, fx) for right-hand
    const rx = -fz, rz = fx;
    const z = zCenter + rx * laneOff * 0; // simplify: offset in Z via lane
    // Better simple lane: offset along world Z from center, signed by lane & dir
    const laneZ = zCenter + this.lane * 3.8;
    const y = getTerrainHeight(this.x, laneZ) + 0.55;
    this.mesh.position.set(this.x, y, laneZ);
    // Face travel direction
    this.mesh.rotation.y = this.dir > 0 ? hdg : hdg + Math.PI;
  }
  dispose() {
    scene.remove(this.mesh);
    this.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
}

function clearNPCs() {
  npcs.forEach(n => n.dispose());
  npcs = [];
}

function updateNPCs(dt, playerX) {
  if (!activeMap.hasHighway || mode !== 'explore') return;

  // Move existing
  for (const n of npcs) n.updatePos(dt);

  // Despawn far ones
  npcs = npcs.filter(n => {
    if (Math.abs(n.x - playerX) > NPC_DESPAWN_RANGE) { n.dispose(); return false; }
    return true;
  });

  // Spawn new if under max
  while (npcs.length < MAX_NPCS) {
    // Spawn ahead or behind player on highway
    const side = Math.random() > 0.5 ? 1 : -1;
    const offset = side * (80 + Math.random() * 180);
    const x = playerX + offset;
    const dir = Math.random() > 0.5 ? 1 : -1;
    const lane = Math.random() > 0.5 ? 1 : -1;
    // Don't spawn too close to another NPC
    if (npcs.some(n => Math.abs(n.x - x) < 25 && n.dir === dir && n.lane === lane)) continue;
    npcs.push(new NPCCar(x, lane, dir));
  }
}

// ─── Race track / flow ───────────────────────────────────────
let trackPoints = [], checkpoints = [];
function buildRaceTrack() {
  trackPoints = [];
  const radius = 95;
  for (let i = 0; i <= 90; i++) {
    const t = (i / 90) * Math.PI * 2;
    const r = radius + Math.sin(t * 3) * 28 + Math.cos(t * 5) * 14;
    const x = Math.cos(t) * r, z = Math.sin(t) * r * 0.88;
    trackPoints.push(new THREE.Vector3(x, getTerrainHeight(x, z) + 0.5, z));
  }
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.85 });
  for (let i = 0; i < trackPoints.length - 1; i++) {
    const a = trackPoints[i], b = trackPoints[i + 1];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y = (getTerrainHeight(mid.x, mid.z) + a.y + b.y) / 3 + 0.15;
    const len = a.distanceTo(b);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(10, 0.22, len + 0.5), roadMat);
    seg.position.copy(mid); seg.lookAt(b.x, mid.y, b.z); seg.rotateX(Math.PI / 2); seg.receiveShadow = true;
    scene.add(seg); roadMeshes.push(seg);
  }
  checkpoints = [];
  for (let i = 0; i < 8; i++) checkpoints.push(trackPoints[Math.floor((i / 8) * (trackPoints.length - 1))].clone());
}

let player = null, bots = [], allCars = [];
function spawnCars(raceMode) {
  if (player) scene.remove(player.mesh);
  bots.forEach(b => scene.remove(b.mesh));
  player = new Car(0x00e5ff, true);
  bots = []; allCars = [player];
  if (raceMode) {
    const colors = [0xff4444, 0x44ff44, 0xffaa00, 0xcc44ff, 0xff88aa];
    for (let i = 0; i < 5; i++) {
      const bot = new Car(colors[i], false);
      bot.name = 'Bot ' + (i + 1);
      bot.pos.set(-(i + 1) * 3.5, getTerrainHeight(-(i + 1) * 3.5, -(i + 1) * 3.5) + 1, -(i + 1) * 3.5);
      bots.push(bot); allCars.push(bot);
    }
    player.pos.set(0, getTerrainHeight(0, 0) + 1, 0);
  } else {
    // Spawn near the infinite highway so player finds it immediately
    const sx = activeMap.spawn[0];
    const sz = highwayZ(sx);
    player.pos.set(sx, getTerrainHeight(sx, sz) + 1.2, sz);
    player.heading = highwayHeading(sx);
  }
}

const camOffset = new THREE.Vector3(0, 5.0, -10.5);
const camLook = new THREE.Vector3(0, 1.2, 7);
let freeControls = null;
function updateCamera(dt) {
  if (!player) return;
  if (keys['KeyC']) {
    keys['KeyC'] = false; camMode = (camMode + 1) % 3;
    if (camMode === 2) { freeControls = new OrbitControls(camera, renderer.domElement); freeControls.target.copy(player.pos); freeControls.enableDamping = true; }
    else if (freeControls) { freeControls.dispose(); freeControls = null; }
  }
  if (camMode === 0) {
    const offset = camOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), player.heading);
    const targetPos = player.pos.clone().add(offset);
    targetPos.y = Math.max(targetPos.y, getTerrainHeight(targetPos.x, targetPos.z) + 3.5);
    camera.position.lerp(targetPos, 6 * dt);
    camera.lookAt(player.pos.clone().add(camLook.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), player.heading)));
  } else if (camMode === 1) {
    const hood = new THREE.Vector3(0, 1.3, 0.85).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.heading);
    camera.position.copy(player.pos).add(hood);
    const fwd = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
    camera.lookAt(player.pos.clone().add(fwd.multiplyScalar(20)).add(new THREE.Vector3(0, 1, 0)));
  } else if (freeControls) { freeControls.target.lerp(player.pos, 2 * dt); freeControls.update(); }
}

function drawMinimap() {
  const w = minimapCanvas.width, h = minimapCanvas.height;
  minimapCtx.clearRect(0, 0, w, h);
  minimapCtx.fillStyle = 'rgba(15,35,25,0.92)';
  minimapCtx.beginPath(); minimapCtx.arc(w/2, h/2, w/2-2, 0, Math.PI*2); minimapCtx.fill();
  if (!player) return;
  const scale = mode === 'explore' ? 0.18 : 0.3, cx = w/2, cy = h/2;

  // Infinite highway on minimap
  if (mode === 'explore' && activeMap.hasHighway) {
    minimapCtx.strokeStyle = '#ccaa44'; minimapCtx.lineWidth = 3;
    minimapCtx.beginPath();
    for (let i = -20; i <= 20; i++) {
      const x = player.pos.x + i * 12;
      const z = highwayZ(x);
      const mx = cx + (x - player.pos.x) * scale;
      const my = cy + (z - player.pos.z) * scale;
      if (i === -20) minimapCtx.moveTo(mx, my); else minimapCtx.lineTo(mx, my);
    }
    minimapCtx.stroke();
  }

  if (mode === 'explore' && activeMap.roads) {
    minimapCtx.strokeStyle = '#666'; minimapCtx.lineWidth = 2;
    for (const path of activeMap.roads) {
      minimapCtx.beginPath();
      path.forEach((p, i) => { const x = cx+(p[0]-player.pos.x)*scale, y = cy+(p[1]-player.pos.z)*scale; if (i===0) minimapCtx.moveTo(x,y); else minimapCtx.lineTo(x,y); });
      minimapCtx.stroke();
    }
  }

  // NPCs on minimap
  npcs.forEach(n => {
    minimapCtx.fillStyle = '#ffaa44';
    minimapCtx.beginPath();
    minimapCtx.arc(cx + (n.x - player.pos.x) * scale, cy + (n.mesh.position.z - player.pos.z) * scale, 2.5, 0, Math.PI * 2);
    minimapCtx.fill();
  });

  if (mode === 'race' && trackPoints.length) {
    minimapCtx.strokeStyle = '#555'; minimapCtx.lineWidth = 3; minimapCtx.beginPath();
    trackPoints.forEach((p,i) => { const x=cx+(p.x-player.pos.x)*scale, y=cy+(p.z-player.pos.z)*scale; if(i===0)minimapCtx.moveTo(x,y); else minimapCtx.lineTo(x,y); });
    minimapCtx.closePath(); minimapCtx.stroke();
  }
  bots.forEach(b => { minimapCtx.fillStyle='#ff6644'; minimapCtx.beginPath(); minimapCtx.arc(cx+(b.pos.x-player.pos.x)*scale, cy+(b.pos.z-player.pos.z)*scale, 3, 0, Math.PI*2); minimapCtx.fill(); });
  minimapCtx.fillStyle='#00e5ff'; minimapCtx.beginPath(); minimapCtx.arc(cx,cy,5,0,Math.PI*2); minimapCtx.fill();
  minimapCtx.strokeStyle='#fff'; minimapCtx.lineWidth=2; minimapCtx.beginPath();
  minimapCtx.moveTo(cx,cy); minimapCtx.lineTo(cx+Math.sin(player.heading)*10, cy+Math.cos(player.heading)*10); minimapCtx.stroke();
}

function checkRaceProgress() {
  if (!raceStarted || raceFinished) return;
  allCars.forEach(car => {
    if (car.finished) return;
    const cp = checkpoints[car.checkpoint % checkpoints.length]; if (!cp) return;
    if (car.pos.distanceTo(cp) < 18) {
      car.checkpoint++;
      if (car.checkpoint % checkpoints.length === 0) {
        car.lap++;
        if (car === player) { currentLap = car.lap; lapEl.textContent = Math.min(currentLap, TOTAL_LAPS); }
        if (car.lap > TOTAL_LAPS) { car.finished = true; car.finishTime = raceTime; if (car === player) { raceFinished = true; showFinish(); } }
      }
    }
  });
  const ranked = [...allCars].sort((a,b) => { if (a.finished!==b.finished) return a.finished?-1:1; if (a.lap!==b.lap) return b.lap-a.lap; return b.checkpoint-a.checkpoint; });
  posEl.textContent = 'P' + (ranked.indexOf(player) + 1);
}
function showFinish() {
  finishEl.classList.remove('hidden');
  const mins = Math.floor(raceTime/60), secs = (raceTime%60).toFixed(3).padStart(6,'0');
  finishTime.textContent = 'Time: '+mins+':'+secs;
  const ranked = [...allCars].filter(c=>c.finished).sort((a,b)=>a.finishTime-b.finishTime);
  finishTitle.textContent = ranked.indexOf(player)===0 ? '🏆 WINNER!' : 'Finished P'+(ranked.indexOf(player)+1);
}
function formatTime(t) {
  const m=Math.floor(t/60), s=Math.floor(t%60), ms=Math.floor((t%1)*1000);
  return m.toString().padStart(2,'0')+':'+s.toString().padStart(2,'0')+'.'+ms.toString().padStart(3,'0');
}
function clearSceneExtras() {
  roadMeshes.forEach(m=>scene.remove(m)); roadMeshes=[]; clearChunks(); clearNPCs();
  allCars.forEach(c=>{ if(c.mesh) scene.remove(c.mesh); }); allCars=[]; bots=[]; player=null;
}
function openMapSelect(fromGame=false) {
  if (fromGame) { running=false; hudEl.classList.add('hidden'); } else menuEl.classList.add('hidden');
  mapSelectEl.classList.remove('hidden');
}
function startExplore(mapId) {
  mode='explore'; mapSelectEl.classList.add('hidden'); menuEl.classList.add('hidden');
  hudEl.classList.remove('hidden'); finishEl.classList.add('hidden');
  raceFinished=false; raceStarted=true; startTime=performance.now(); raceTime=0; running=true;
  applyMapTheme(mapId);
  modeLabel.textContent='Explore'; mapNameHud.textContent=activeMap.name + ' · Highway';
  mapNameHud.classList.remove('hidden'); mapHintHud.classList.remove('hidden'); lapInfo.classList.add('hidden');
  spawnCars(false); updateChunks(player.pos.x, player.pos.z);
}
function startGame(selectedMode) {
  if (selectedMode==='explore') { openMapSelect(false); return; }
  mode='race'; menuEl.classList.add('hidden'); mapSelectEl.classList.add('hidden');
  hudEl.classList.remove('hidden'); finishEl.classList.add('hidden');
  mapNameHud.classList.add('hidden'); mapHintHud.classList.add('hidden');
  raceFinished=false; raceStarted=false; currentLap=1; raceTime=0;
  clearSceneExtras();
  activeMap={...MAPS.forest, id:'race', roads:[], treeDensity:0.2, heightFn:heightForest, hasCities:false, hasHighway:false, sakura:false, ocean:false};
  scene.background=new THREE.Color(0x87ceeb); scene.fog=new THREE.Fog(0x87ceeb,90,360);
  hemi.color.set(0xb1e1ff); hemi.groundColor.set(0xb97a20); sun.color.set(0xfff5e0); sun.intensity=1.3;
  modeLabel.textContent='Race Mode'; lapInfo.classList.remove('hidden'); lapEl.textContent='1';
  buildRaceTrack(); spawnCars(true);
  countdownEl.classList.remove('hidden'); let count=3; countdownEl.textContent=count;
  const iv=setInterval(()=>{
    count--;
    if(count>0){ countdownEl.textContent=count; countdownEl.style.animation='none'; countdownEl.offsetHeight; countdownEl.style.animation='pulse 0.8s ease'; }
    else if(count===0) countdownEl.textContent='GO!';
    else { countdownEl.classList.add('hidden'); clearInterval(iv); raceStarted=true; startTime=performance.now(); running=true; }
  },900);
}
function returnToMenu() {
  running=false; raceStarted=false; menuEl.classList.remove('hidden');
  mapSelectEl.classList.add('hidden'); hudEl.classList.add('hidden');
  finishEl.classList.add('hidden'); countdownEl.classList.add('hidden'); clearSceneExtras();
}

document.getElementById('btn-race').addEventListener('click', () => startGame('race'));
document.getElementById('btn-explore').addEventListener('click', () => startGame('explore'));
document.getElementById('btn-map-back').addEventListener('click', () => { mapSelectEl.classList.add('hidden'); menuEl.classList.remove('hidden'); });
document.getElementById('btn-restart').addEventListener('click', () => startGame(mode));
document.getElementById('btn-menu').addEventListener('click', returnToMenu);
document.querySelectorAll('.map-card').forEach(card => card.addEventListener('click', () => startExplore(card.dataset.map)));

window.addEventListener('keydown', e => {
  if (e.code === 'KeyR' && player && running) {
    const gy = getTerrainHeight(player.pos.x, player.pos.z);
    player.pos.y = gy + 1.2; player.vel.set(0,0,0);
    player.pitch = player.roll = 0; player.angVelPitch = player.angVelRoll = player.angVelY = 0;
  }
});

let lastTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  if (!running || !player) { renderer.render(scene, camera); return; }
  if (raceStarted && !raceFinished) { raceTime = (now - startTime) / 1000; timerEl.textContent = formatTime(raceTime); }
  player.update(dt);
  if (mode === 'race' && raceStarted) {
    bots.forEach(bot => { bot.updateAI(dt, checkpoints[bot.checkpoint % checkpoints.length] || trackPoints[0]); bot.update(dt); });
    checkRaceProgress();
  }
  if (mode === 'explore') updateNPCs(dt, player.pos.x);
  updateChunks(player.pos.x, player.pos.z);
  updateCamera(dt);
  speedEl.textContent = Math.abs(Math.round(player.speed * 3.6));
  drawMinimap();
  sun.position.set(player.pos.x + 90, 130, player.pos.z + 50);
  sun.target.position.copy(player.pos); sun.target.updateMatrixWorld();
  renderer.render(scene, camera);
}
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
animate(performance.now());
