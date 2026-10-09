import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ==========================================================
   World Explorer — fly a ship around a textured Earth globe
   ========================================================== */

const EARTH_RADIUS = 100;
const SHIP_ALTITUDE_START = 18; // above surface
const MAX_SPEED = 2.8;
const BOOST_MULT = 2.4;

// Major landmarks for discovery
const LANDMARKS = [
  { name: 'New York', lat: 40.71, lon: -74.01, desc: 'USA · City of skyscrapers' },
  { name: 'London', lat: 51.51, lon: -0.13, desc: 'UK · Historic capital' },
  { name: 'Tokyo', lat: 35.68, lon: 139.69, desc: 'Japan · Mega-metropolis' },
  { name: 'Sydney', lat: -33.87, lon: 151.21, desc: 'Australia · Harbour city' },
  { name: 'Cairo', lat: 30.04, lon: 31.24, desc: 'Egypt · Near the Pyramids' },
  { name: 'Rio de Janeiro', lat: -22.91, lon: -43.17, desc: 'Brazil · Christ the Redeemer' },
  { name: 'Moscow', lat: 55.76, lon: 37.62, desc: 'Russia · Red Square' },
  { name: 'Cape Town', lat: -33.92, lon: 18.42, desc: 'South Africa · Table Mountain' },
  { name: 'Dubai', lat: 25.20, lon: 55.27, desc: 'UAE · Modern desert city' },
  { name: 'Singapore', lat: 1.35, lon: 103.82, desc: 'Singapore · Garden city' },
  { name: 'Los Angeles', lat: 34.05, lon: -118.24, desc: 'USA · West Coast' },
  { name: 'Beijing', lat: 39.90, lon: 116.40, desc: 'China · Forbidden City' },
  { name: 'Paris', lat: 48.86, lon: 2.35, desc: 'France · City of Light' },
  { name: 'Istanbul', lat: 41.01, lon: 28.98, desc: 'Türkiye · Crossroads of continents' },
  { name: 'Mexico City', lat: 19.43, lon: -99.13, desc: 'Mexico · Historic capital' },
];

// ---------- helpers ----------
function latLonToVec3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function vec3ToLatLon(pos) {
  const r = pos.length();
  const lat = 90 - (Math.acos(pos.y / r) * 180) / Math.PI;
  let lon = (Math.atan2(pos.z, -pos.x) * 180) / Math.PI - 180;
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return { lat, lon, alt: r - EARTH_RADIUS };
}

// ---------- scene setup ----------
const wrap = document.getElementById('canvas-wrap');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02040a);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);

// Soft ambient + directional (sun)
const ambient = new THREE.AmbientLight(0x334466, 0.55);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xfff5e0, 1.35);
sun.position.set(400, 200, 150);
scene.add(sun);

// Starfield
{
  const starGeo = new THREE.BufferGeometry();
  const count = 3500;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 600 + Math.random() * 800;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0.85 });
  scene.add(new THREE.Points(starGeo, starMat));
}

// ---------- Earth ----------
const texLoader = new THREE.TextureLoader();
const earthGroup = new THREE.Group();
scene.add(earthGroup);

const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 96, 64);

// Diffuse + specular-ish night lights via emissive map if available
const earthMat = new THREE.MeshPhongMaterial({
  map: null,
  specular: new THREE.Color(0x222222),
  shininess: 12,
  bumpScale: 0.4,
});

const earthMesh = new THREE.Mesh(earthGeo, earthMat);
earthGroup.add(earthMesh);

// Clouds
const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.008, 64, 48);
const cloudMat = new THREE.MeshLambertMaterial({
  map: null,
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
});
const clouds = new THREE.Mesh(cloudGeo, cloudMat);
earthGroup.add(clouds);

// Atmosphere glow (simple fresnel-ish shell)
const atmoGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.04, 48, 32);
const atmoMat = new THREE.MeshBasicMaterial({
  color: 0x4a9eff,
  transparent: true,
  opacity: 0.12,
  side: THREE.BackSide,
  depthWrite: false,
});
const atmo = new THREE.Mesh(atmoGeo, atmoMat);
earthGroup.add(atmo);

// Load textures (NASA-style public domain / free CDNs)
const earthUrl = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets/earth_atmos_2048.jpg';
const cloudUrl = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets/earth_clouds_1024.png';
const bumpUrl = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets/earth_normal_2048.jpg';

let texturesLoaded = 0;
const totalTextures = 3;

function onTex() {
  texturesLoaded++;
  if (texturesLoaded >= totalTextures) {
    document.getElementById('loading').classList.add('hide');
  }
}

texLoader.load(earthUrl, (t) => {
  t.colorSpace = THREE.SRGBColorSpace;
  earthMat.map = t;
  earthMat.needsUpdate = true;
  onTex();
}, undefined, () => onTex());

texLoader.load(cloudUrl, (t) => {
  t.colorSpace = THREE.SRGBColorSpace;
  cloudMat.map = t;
  cloudMat.needsUpdate = true;
  onTex();
}, undefined, () => onTex());

texLoader.load(bumpUrl, (t) => {
  earthMat.bumpMap = t;
  earthMat.needsUpdate = true;
  onTex();
}, undefined, () => onTex());

// Fallback if textures fail after timeout
setTimeout(() => {
  if (texturesLoaded < totalTextures) {
    document.getElementById('loading').classList.add('hide');
  }
}, 8000);

// ---------- Landmark markers ----------
const markerGroup = new THREE.Group();
scene.add(markerGroup);
const markers = [];

LANDMARKS.forEach((lm) => {
  const pos = latLonToVec3(lm.lat, lm.lon, EARTH_RADIUS * 1.015);
  const geo = new THREE.SphereGeometry(0.55, 12, 10);
  const mat = new THREE.MeshBasicMaterial({ color: 0x60a5fa });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  mesh.userData = lm;
  markerGroup.add(mesh);

  // subtle ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1.1, 24),
    new THREE.MeshBasicMaterial({ color: 0x93c5fd, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
  );
  ring.position.copy(pos);
  ring.lookAt(0, 0, 0);
  markerGroup.add(ring);

  markers.push({ mesh, ring, lm, pos });
});

// ---------- Ship ----------
const ship = new THREE.Group();

// Body
const body = new THREE.Mesh(
  new THREE.ConeGeometry(0.55, 2.2, 8),
  new THREE.MeshStandardMaterial({ color: 0xc0c8d8, metalness: 0.7, roughness: 0.35 })
);
body.rotation.x = Math.PI / 2;
ship.add(body);

// Cockpit
const cockpit = new THREE.Mesh(
  new THREE.SphereGeometry(0.38, 12, 10),
  new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.85 })
);
cockpit.position.z = -0.55;
ship.add(cockpit);

// Wings
const wingMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.4 });
const wingL = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.7), wingMat);
wingL.position.set(0, 0, 0.15);
ship.add(wingL);
const wingR = wingL.clone();
ship.add(wingR);

// Engine glow
const engine = new THREE.Mesh(
  new THREE.SphereGeometry(0.28, 10, 8),
  new THREE.MeshBasicMaterial({ color: 0x60a5fa })
);
engine.position.z = 1.15;
ship.add(engine);

// Engine light
const engineLight = new THREE.PointLight(0x60a5fa, 1.8, 12);
engineLight.position.z = 1.3;
ship.add(engineLight);

scene.add(ship);

// Start position: above Atlantic, facing roughly north-east
const startPos = latLonToVec3(20, -40, EARTH_RADIUS + SHIP_ALTITUDE_START);
ship.position.copy(startPos);

// Orient ship tangent to surface, nose forward
function orientShipToSurface() {
  const up = ship.position.clone().normalize();
  // keep current forward projected onto tangent plane
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion);
  forward.projectOnPlane(up).normalize();
  if (forward.lengthSq() < 0.01) {
    forward.set(1, 0, 0).projectOnPlane(up).normalize();
  }
  const right = new THREE.Vector3().crossVectors(forward, up).normalize();
  const m = new THREE.Matrix4().makeBasis(right, up, forward.clone().negate());
  ship.quaternion.setFromRotationMatrix(m);
}
orientShipToSurface();

// ---------- Controls ----------
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

let pointerLocked = false;
let yawDelta = 0;
let pitchDelta = 0;

renderer.domElement.addEventListener('click', () => {
  renderer.domElement.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
});

document.addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  yawDelta += e.movementX * 0.0022;
  pitchDelta += e.movementY * 0.0020;
});

// ---------- Camera (third-person chase) ----------
const camOffset = new THREE.Vector3(0, 1.8, 6.5);
const camLook = new THREE.Vector3(0, 0.4, -4);

// ---------- State ----------
let velocity = 0;
let lastTime = performance.now();

// HUD elements
const elAlt = document.getElementById('alt');
const elSpd = document.getElementById('spd');
const elLat = document.getElementById('lat');
const elLon = document.getElementById('lon');
const infoPanel = document.getElementById('infoPanel');
const infoTitle = document.getElementById('infoTitle');
const infoSub = document.getElementById('infoSub');

document.getElementById('infoClose').onclick = () => { infoPanel.style.display = 'none'; };
document.getElementById('backBtn').onclick = () => { location.href = '../../index.html'; };

// ---------- Reset ----------
function resetShip() {
  ship.position.copy(latLonToVec3(20, -40, EARTH_RADIUS + SHIP_ALTITUDE_START));
  orientShipToSurface();
  velocity = 0;
  yawDelta = 0;
  pitchDelta = 0;
}

// ---------- Animation loop ----------
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  // Cloud slow rotation
  clouds.rotation.y += dt * 0.008;

  // Input
  const boost = keys['Space'] ? BOOST_MULT : 1;
  if (keys['KeyW'] || keys['ArrowUp']) velocity += 1.8 * dt * boost;
  if (keys['KeyS'] || keys['ArrowDown']) velocity -= 1.4 * dt;
  velocity *= Math.pow(0.92, dt * 60); // drag
  velocity = THREE.MathUtils.clamp(velocity, -MAX_SPEED * 0.4, MAX_SPEED * boost);

  // Mouse look accumulated
  const yaw = yawDelta + ((keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0)) * 1.1 * dt;
  const pitch = pitchDelta + ((keys['KeyQ'] ? 1 : 0) - (keys['KeyE'] ? 1 : 0)) * 0.9 * dt;
  yawDelta *= 0.7;
  pitchDelta *= 0.7;

  // Local rotation
  ship.rotateY(-yaw);
  ship.rotateX(-pitch);

  // Keep upright-ish relative to planet (gentle auto-level)
  const up = ship.position.clone().normalize();
  const shipUp = new THREE.Vector3(0, 1, 0).applyQuaternion(ship.quaternion);
  const align = new THREE.Quaternion().setFromUnitVectors(shipUp, up);
  ship.quaternion.slerp(ship.quaternion.clone().premultiply(align), 0.04);

  // Move forward
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion);
  ship.position.addScaledVector(forward, velocity * dt * 18);

  // Collision / min altitude
  const dist = ship.position.length();
  const minR = EARTH_RADIUS + 1.2;
  if (dist < minR) {
    ship.position.setLength(minR);
    // bounce velocity a bit outward
    const radial = ship.position.clone().normalize();
    const vn = velocity * forward.dot(radial);
    if (vn < 0) velocity *= 0.3;
  }

  // Soft max altitude
  const maxR = EARTH_RADIUS + 90;
  if (dist > maxR) {
    ship.position.setLength(maxR);
  }

  if (keys['KeyR']) resetShip();

  // Camera chase
  const desiredCam = camOffset.clone().applyQuaternion(ship.quaternion).add(ship.position);
  camera.position.lerp(desiredCam, 1 - Math.pow(0.02, dt));
  const lookTarget = camLook.clone().applyQuaternion(ship.quaternion).add(ship.position);
  camera.lookAt(lookTarget);

  // Engine visual intensity
  const intensity = 0.6 + Math.abs(velocity) * 1.2;
  engineLight.intensity = intensity;
  engine.scale.setScalar(0.85 + Math.abs(velocity) * 0.15);

  // Landmark proximity check
  let nearest = null;
  let nearestDist = 12;
  for (const m of markers) {
    const d = ship.position.distanceTo(m.pos);
    // pulse
    const s = 1 + 0.15 * Math.sin(now * 0.004 + m.pos.x);
    m.mesh.scale.setScalar(s);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = m;
    }
  }
  if (nearest && nearestDist < 8) {
    infoTitle.textContent = nearest.lm.name;
    infoSub.textContent = nearest.lm.desc + ' · ' + nearest.lm.lat.toFixed(2) + '°, ' + nearest.lm.lon.toFixed(2) + '°';
    infoPanel.style.display = 'block';
  }

  // HUD
  const geo = vec3ToLatLon(ship.position);
  elAlt.textContent = (geo.alt * 12.7).toFixed(0) + ' km'; // scale for fun
  elSpd.textContent = (Math.abs(velocity) * 420).toFixed(0) + ' km/h';
  elLat.textContent = geo.lat.toFixed(2) + '°';
  elLon.textContent = geo.lon.toFixed(2) + '°';

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
