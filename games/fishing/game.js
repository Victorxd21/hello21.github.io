import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';

const canvas = document.querySelector('#world');
const mapCanvas = document.querySelector('#map');
const mapContext = mapCanvas.getContext('2d');
const statusElement = document.querySelector('#status');
const toastElement = document.querySelector('#toast');
const interactButton = document.querySelector('#interactButton');
const actionButton = document.querySelector('#actionButton');
const islandArrow = document.querySelector('#islandArrow');
const seaStatus = document.querySelector('#seaStatus');
const fishCountElement = document.querySelector('#fishCount');
const coinsElement = document.querySelector('#coins');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#8dd9dc');
scene.fog = new THREE.FogExp2('#9bdfe0', 0.0016);

const camera = new THREE.PerspectiveCamera(57, window.innerWidth / window.innerHeight, 0.1, 1100);
let cameraYaw = Math.PI;
let cameraPitch = 0;
let dragging = false;
let pointerLocked = false;
let lastPointer = { x: 0, y: 0 };
camera.rotation.order = 'YXZ';

scene.add(new THREE.HemisphereLight('#e9fff0', '#56796b', 2.0));
const sun = new THREE.DirectionalLight('#fff0ce', 3.1);
sun.position.set(-45, 80, -35);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -65;
sun.shadow.camera.right = 65;
sun.shadow.camera.top = 65;
sun.shadow.camera.bottom = -65;
sun.shadow.bias = -0.00015;
scene.add(sun);

const materials = {
  sand: new THREE.MeshStandardMaterial({ color: '#e5c992', roughness: 1 }),
  grass: new THREE.MeshStandardMaterial({ color: '#7fa96c', roughness: 1 }),
  trunk: new THREE.MeshStandardMaterial({ color: '#876044', roughness: 1 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#477e63', roughness: 1 }),
  leafLight: new THREE.MeshStandardMaterial({ color: '#67966c', roughness: 1 }),
  wood: new THREE.MeshStandardMaterial({ color: '#9b7650', roughness: .88 }),
  woodLight: new THREE.MeshStandardMaterial({ color: '#c4a274', roughness: .9 }),
  boat: new THREE.MeshStandardMaterial({ color: '#e8eee0', roughness: .45, metalness: .05 }),
  boatTrim: new THREE.MeshStandardMaterial({ color: '#416d62', roughness: .55 }),
  dark: new THREE.MeshStandardMaterial({ color: '#43534a', roughness: .9 }),
};

const waterGeometry = new THREE.PlaneGeometry(2400, 2400, 90, 90);
waterGeometry.rotateX(-Math.PI / 2);
const waterPositions = waterGeometry.attributes.position;
const waterBase = waterPositions.array.slice();
const water = new THREE.Mesh(waterGeometry, new THREE.MeshStandardMaterial({
  color: '#43aeb6', roughness: .28, metalness: .06, transparent: true, opacity: .94,
}));
water.position.y = -0.12;
water.receiveShadow = true;
scene.add(water);

const island = new THREE.Group();
scene.add(island);
const islandColliders = [];

function addMesh(parent, geometry, material, position, scale, castShadow = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

addMesh(island, new THREE.SphereGeometry(1, 48, 28), materials.sand, [0, -2.7, 0], [15.8, 5.3, 13.5]);
addMesh(island, new THREE.SphereGeometry(1, 44, 24), materials.grass, [0, -1.3, -0.5], [12.4, 4.1, 10.1]);

function addPalm(x, z, height, lean, leafMaterial = materials.leaf) {
  islandColliders.push({ x, z, radius: .48 });
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);
  tree.rotation.z = lean;
  island.add(tree);
  addMesh(tree, new THREE.CylinderGeometry(.13, .27, height, 8), materials.trunk, [0, height / 2 - .25, 0], [1, 1, 1]);
  const crownY = height - .35;
  addMesh(tree, new THREE.SphereGeometry(.32, 10, 8), materials.wood, [0, crownY, 0], [1, .8, 1]);
  for (let index = 0; index < 7; index += 1) {
    const angle = index * Math.PI * 2 / 7;
    const leaf = addMesh(tree, new THREE.ConeGeometry(.42, 3.2, 5), leafMaterial, [Math.cos(angle) * .75, crownY - .1, Math.sin(angle) * .75], [1, 1, .42]);
    leaf.rotation.z = -Math.cos(angle) * .68;
    leaf.rotation.x = Math.sin(angle) * .68;
  }
}

[
  [-7.4, -4.1, 6.3, -.08], [-3.6, -7, 5.2, .12], [3.7, -6.8, 6.1, -.13],
  [7.6, -2.7, 5.5, .1], [-7.8, 2.3, 4.8, .03], [5.4, 4.1, 5.1, -.1],
].forEach((tree) => addPalm(...tree));

const grassTuftMaterial = new THREE.MeshStandardMaterial({ color: '#a1b675', roughness: 1 });
for (let index = 0; index < 34; index += 1) {
  const angle = index * 2.399;
  const radius = 3.1 + (index % 7) * 1.05;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius * .76 - .4;
  if (Math.abs(z) > 7.5 && Math.abs(x) < 3.7) continue;
  const tuft = addMesh(island, new THREE.ConeGeometry(.18, .72, 4), grassTuftMaterial, [x, .55, z], [1, 1, 1], false);
  tuft.rotation.z = (index % 2 ? 1 : -1) * .23;
}

for (let index = 0; index < 10; index += 1) {
  const angle = index * 2.2;
  const x = Math.cos(angle) * (8.5 + (index % 3));
  const z = Math.sin(angle) * (7.2 + (index % 2));
  islandColliders.push({ x, z, radius: .62 });
  addMesh(island, new THREE.DodecahedronGeometry(.55 + (index % 3) * .18, 0), new THREE.MeshStandardMaterial({ color: index % 2 ? '#9caa8c' : '#c3b28e', roughness: 1 }), [x, .15, z], [1.3, .7, .9]);
}

const dock = new THREE.Group();
dock.position.set(0, .1, 7.1);
island.add(dock);
for (let index = 0; index < 9; index += 1) {
  addMesh(dock, new THREE.BoxGeometry(3.2, .2, 1.05), index % 2 ? materials.wood : materials.woodLight, [0, .28, index * .92], [1, 1, 1]);
}
for (const x of [-1.35, 1.35]) {
  for (const z of [0, 3.7, 7.35]) {
    islandColliders.push({ x, z: dock.position.z + z, radius: .3 });
    addMesh(dock, new THREE.CylinderGeometry(.13, .16, 1.5, 8), materials.trunk, [x, -.22, z], [1, 1, 1]);
  }
}

const seller = new THREE.Group();
seller.position.set(3.45, .05, 4.7);
island.add(seller);
islandColliders.push({ x: seller.position.x, z: seller.position.z, radius: 1.05 });
addMesh(seller, new THREE.BoxGeometry(2.2, .22, .9), materials.wood, [0, 1.05, 0]);
addMesh(seller, new THREE.BoxGeometry(.16, 2.1, .16), materials.trunk, [-.88, 1.1, 0]);
addMesh(seller, new THREE.BoxGeometry(.16, 2.1, .16), materials.trunk, [.88, 1.1, 0]);
addMesh(seller, new THREE.BoxGeometry(2.4, .11, .13), materials.woodLight, [0, 2.18, 0]);
addMesh(seller, new THREE.BoxGeometry(2.5, .72, .12), new THREE.MeshStandardMaterial({ color: '#496e5e', roughness: 1 }), [0, 2.72, -.03]);

function makeSignTexture() {
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512;
  signCanvas.height = 144;
  const context = signCanvas.getContext('2d');
  context.fillStyle = '#496e5e';
  context.fillRect(0, 0, signCanvas.width, signCanvas.height);
  context.fillStyle = '#eff1d2';
  context.font = '700 52px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('FISH BUYER', 256, 72);
  const texture = new THREE.CanvasTexture(signCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.25, .63), new THREE.MeshBasicMaterial({ map: makeSignTexture() }));
sign.position.set(0, 2.72, .045);
seller.add(sign);
addMesh(seller, new THREE.BoxGeometry(2.05, .72, .76), materials.woodLight, [0, .65, .05]);
addMesh(seller, new THREE.BoxGeometry(2.15, .12, .84), materials.wood, [0, .25, .05]);

const boat = new THREE.Group();
scene.add(boat);
boat.position.set(0, .15, 15.2);
boat.rotation.y = Math.PI;
const hullShape = new THREE.Shape();
hullShape.moveTo(-1.28, -.2);
hullShape.lineTo(-1.12, 3.15);
hullShape.quadraticCurveTo(0, 3.85, 1.12, 3.15);
hullShape.lineTo(1.28, -.2);
hullShape.quadraticCurveTo(0, -.82, -1.28, -.2);
const hullGeometry = new THREE.ExtrudeGeometry(hullShape, { depth: .23, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .11, bevelThickness: .1 });
hullGeometry.rotateX(-Math.PI / 2);
const hull = new THREE.Mesh(hullGeometry, materials.boat);
hull.position.y = -.12;
hull.castShadow = true;
hull.receiveShadow = true;
boat.add(hull);
addMesh(boat, new THREE.BoxGeometry(1.82, .17, 2.55), materials.boatTrim, [0, .14, .75]);
addMesh(boat, new THREE.BoxGeometry(.2, .48, .2), materials.wood, [-.77, .35, -.15]);
addMesh(boat, new THREE.BoxGeometry(.2, .48, .2), materials.wood, [.77, .35, -.15]);
addMesh(boat, new THREE.BoxGeometry(1.56, .13, .17), materials.woodLight, [0, .55, -.15]);
addMesh(boat, new THREE.BoxGeometry(1.65, .15, .54), materials.wood, [0, .36, 2.02]);
addMesh(boat, new THREE.BoxGeometry(.16, .24, .16), materials.wood, [-.7, .27, 2.5]);
addMesh(boat, new THREE.BoxGeometry(.16, .24, .16), materials.wood, [.7, .27, 2.5]);
addMesh(boat, new THREE.BoxGeometry(1.3, .12, .15), materials.woodLight, [0, .4, 2.5]);
addMesh(boat, new THREE.CylinderGeometry(.07, .1, .7, 10), materials.dark, [0, .72, 1.05]);
const helmWheel = addMesh(boat, new THREE.TorusGeometry(.27, .035, 8, 24), materials.woodLight, [0, 1.08, 1.05]);
for (let spoke = 0; spoke < 4; spoke += 1) {
  const angle = spoke * Math.PI / 2;
  const wheelSpoke = addMesh(boat, new THREE.BoxGeometry(.24, .035, .035), materials.woodLight, [Math.cos(angle) * .1, 1.08 + Math.sin(angle) * .1, 1.05]);
  wheelSpoke.rotation.z = angle;
}
addMesh(boat, new THREE.BoxGeometry(1.25, .12, .18), materials.wood, [0, .53, 1.95]);

const rodGroup = new THREE.Group();
rodGroup.position.set(.56, .4, 1.68);
const rodShaft = addMesh(rodGroup, new THREE.CylinderGeometry(.025, .055, 2.5, 7), new THREE.MeshStandardMaterial({ color: '#513c32', roughness: .7 }), [0, .97, 0], [1, 1, 1]);
rodShaft.rotation.z = -.48;
const rodTip = new THREE.Object3D();
rodTip.position.set(-.56, 2.03, 0);
rodGroup.add(rodTip);
boat.add(rodGroup);

const handRig = new THREE.Group();
camera.add(handRig);
const sleeveMaterial = new THREE.MeshStandardMaterial({ color: '#dc795c', roughness: .88 });
const gloveMaterial = new THREE.MeshStandardMaterial({ color: '#d7a47b', roughness: .9 });
const leftSleeve = addMesh(handRig, new THREE.CapsuleGeometry(.09, .38, 4, 8), sleeveMaterial, [-.29, -.37, -.5], [1, 1, 1]);
leftSleeve.rotation.z = -.58;
const rightSleeve = addMesh(handRig, new THREE.CapsuleGeometry(.09, .38, 4, 8), sleeveMaterial, [.32, -.35, -.48], [1, 1, 1]);
rightSleeve.rotation.z = .58;
addMesh(handRig, new THREE.SphereGeometry(.095, 12, 10), gloveMaterial, [-.12, -.3, -.47], [1, .8, 1]);
addMesh(handRig, new THREE.SphereGeometry(.095, 12, 10), gloveMaterial, [.19, -.3, -.46], [1, .8, 1]);
handRig.visible = false;
scene.add(camera);

const bobber = new THREE.Group();
const bobberBall = new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 10), new THREE.MeshStandardMaterial({ color: '#f4eac4', roughness: .4 }));
bobberBall.position.y = .1;
bobber.add(bobberBall);
const bobberTip = new THREE.Mesh(new THREE.SphereGeometry(.1, 10, 8), new THREE.MeshStandardMaterial({ color: '#ee7458', roughness: .5 }));
bobberTip.position.y = .22;
bobber.add(bobberTip);
scene.add(bobber);
bobber.visible = false;
const fishingLineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const fishingLine = new THREE.Line(fishingLineGeometry, new THREE.LineBasicMaterial({ color: '#f7f0d7', transparent: true, opacity: .72 }));
scene.add(fishingLine);
fishingLine.visible = false;
const ripple = new THREE.Mesh(new THREE.TorusGeometry(.45, .025, 5, 36), new THREE.MeshBasicMaterial({ color: '#e8fff0', transparent: true, opacity: .54 }));
ripple.rotation.x = Math.PI / 2;
scene.add(ripple);
ripple.visible = false;

const fishTypes = [
  { name: 'Silver Sardine', value: 7, weight: 26, color: '#d7e1d4' },
  { name: 'Sunfin Perch', value: 10, weight: 22, color: '#e3b56d' },
  { name: 'Coral Clownfish', value: 17, weight: 15, color: '#eb805d' },
  { name: 'Glasswing Tang', value: 20, weight: 12, color: '#81c7bb' },
  { name: 'Pufferfish', value: 28, weight: 9, color: '#d9c978' },
  { name: 'Striped Lionfish', value: 36, weight: 6, color: '#d57860' },
  { name: 'Bluefin Tuna', value: 52, weight: 4, color: '#638db2' },
  { name: 'Moon Jelly', value: 61, weight: 3, color: '#b2a1ce' },
  { name: 'Golden Koi', value: 84, weight: 2, color: '#f2b868' },
  { name: 'Abyssal Eel', value: 120, weight: 1, color: '#657c80' },
];

const player = new THREE.Vector3(0, 0, 8.15);
const boatLocalPlayer = new THREE.Vector3(0, 0, .8);
const inventory = [];
const keys = new Set();
let mode = 'walk';
let hasRod = false;
let boatSpeed = 0;
let fishingState = 'idle';
let fishingTimer = 0;
let biteWindow = 0;
let fishingPoint = new THREE.Vector3();
let coins = 0;
let toastTimeout = 0;
let statusClock = 0;
let waterClock = 0;

function formatFishCount() {
  fishCountElement.textContent = `${inventory.length} ${inventory.length === 1 ? 'fish' : 'fish'}`;
}

function showToast(message) {
  toastElement.textContent = message;
  toastElement.classList.add('show');
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toastElement.classList.remove('show'), 2600);
}

function distanceTo(x, z, pointX, pointZ) {
  return Math.hypot(x - pointX, z - pointZ);
}

function islandDistance() {
  return Math.hypot(player.x, player.z);
}

function boatForward() {
  return new THREE.Vector3(-Math.sin(boat.rotation.y), 0, -Math.cos(boat.rotation.y));
}

function updateModeVisibility() {
  boat.userData.occupied = mode === 'sail';
  handRig.visible = hasRod && mode !== 'walk';
  rodGroup.visible = mode !== 'walk';
}

function updateButtons() {
  const dockDistance = distanceTo(player.x, player.z, 0, 10.2);
  const sellerDistance = distanceTo(player.x, player.z, seller.position.x, seller.position.z);
  let prompt = '';
  let showInteract = false;
  if (mode === 'walk' && islandDistance() < 24 && distanceTo(player.x, player.z, boat.position.x, boat.position.z) < 4.2) {
    prompt = 'STEP ABOARD';
    showInteract = true;
  } else if (mode === 'walk' && sellerDistance < 3.7) {
    prompt = inventory.length ? `SELL ${inventory.length} FISH` : 'FISH BUYER';
    showInteract = inventory.length > 0;
  } else if (mode === 'boatWalk') {
    const helm = boat.localToWorld(new THREE.Vector3(0, 0, 1.48));
    const rod = rodGroup.parent === boat ? rodGroup.getWorldPosition(new THREE.Vector3()) : null;
    const exit = boat.localToWorld(new THREE.Vector3(0, 0, 2.1));
    if (rod && !hasRod && player.distanceTo(rod) < 1.35) {
      prompt = 'PICK UP FISHING ROD';
      showInteract = true;
    } else if (dockDistance < 10 && player.distanceTo(exit) < 1.55 && isWalkable(exit.x, exit.z)) {
      prompt = 'STEP ASHORE';
      showInteract = true;
    } else if (player.distanceTo(helm) < 1.45) {
      prompt = 'TAKE THE HELM';
      showInteract = true;
    }
  }
  interactButton.hidden = !showInteract;
  interactButton.textContent = prompt;
  actionButton.hidden = mode !== 'sail' || !hasRod;
  if (fishingState === 'bite') actionButton.textContent = 'REEL IN NOW';
  else if (fishingState === 'waiting') actionButton.textContent = 'BRING IN LINE';
  else actionButton.textContent = 'CAST YOUR LINE';
  if (mode === 'sail' && islandDistance() > 19) {
    seaStatus.textContent = 'OPEN WATER';
    statusElement.textContent = fishingState === 'waiting' ? 'Watching the line' : fishingState === 'bite' ? 'A fish is on the line!' : 'Open water · cast anywhere';
  } else if (mode === 'sail' || mode === 'boatWalk') {
    seaStatus.textContent = 'SHALLOWS';
    statusElement.textContent = 'The island is just ahead';
  } else {
    seaStatus.textContent = 'ISLAND';
    statusElement.textContent = 'A quiet morning at sea';
  }
}

function weightedFish() {
  const roll = Math.random() * fishTypes.reduce((sum, fish) => sum + fish.weight, 0);
  let cumulative = 0;
  for (const fish of fishTypes) {
    cumulative += fish.weight;
    if (roll <= cumulative) return fish;
  }
  return fishTypes[0];
}

function castOrReel() {
  if (mode !== 'sail' || !hasRod) return;
  if (islandDistance() <= 19) {
    showToast('Sail a little farther out to find the fish.');
    return;
  }
  if (fishingState === 'bite') {
    const fish = weightedFish();
    inventory.push(fish);
    fishingState = 'idle';
    bobber.visible = false;
    fishingLine.visible = false;
    ripple.visible = false;
    formatFishCount();
    showToast(`${fish.name} · worth $${fish.value}`);
    updateButtons();
    return;
  }
  if (fishingState === 'waiting') {
    fishingState = 'idle';
    bobber.visible = false;
    fishingLine.visible = false;
    ripple.visible = false;
    showToast('Line reeled in. Try another spot.');
    updateButtons();
    return;
  }
  const forward = boatForward();
  fishingPoint.set(boat.position.x + forward.x * 7, 0, boat.position.z + forward.z * 7);
  fishingState = 'waiting';
  fishingTimer = 3.2 + Math.random() * 5.5;
  bobber.position.set(fishingPoint.x, 0, fishingPoint.z);
  bobber.visible = true;
  fishingLine.visible = true;
  ripple.visible = true;
  showToast('Line out. Keep an eye on the float.');
  updateButtons();
}

function sellCatch() {
  if (!inventory.length) {
    showToast('Nothing to sell yet.');
    return;
  }
  const total = inventory.reduce((sum, fish) => sum + fish.value, 0);
  const sold = inventory.length;
  inventory.length = 0;
  coins += total;
  coinsElement.textContent = String(coins);
  formatFishCount();
  showToast(`${sold} fish sold for $${total}. Nice haul.`);
  updateButtons();
}

function interact() {
  const sellerDistance = distanceTo(player.x, player.z, seller.position.x, seller.position.z);
  const boatDistance = distanceTo(player.x, player.z, boat.position.x, boat.position.z);
  const dockDistance = distanceTo(player.x, player.z, 0, 10.2);
  if (mode === 'walk' && islandDistance() < 24 && boatDistance < 4.2) {
    mode = 'boatWalk';
    boatLocalPlayer.set(0, 0, -.2);
    syncBoatWalkPosition();
    cameraYaw = boat.rotation.y;
    updateModeVisibility();
    showToast('You stepped aboard. Walk to the helm to set off.');
  } else if (mode === 'walk' && sellerDistance < 3.7) {
    sellCatch();
  } else if (mode === 'boatWalk') {
    const rodPosition = rodGroup.parent === boat ? rodGroup.getWorldPosition(new THREE.Vector3()) : null;
    const helmPosition = boat.localToWorld(new THREE.Vector3(0, 0, 1.48));
    const exitPosition = boat.localToWorld(new THREE.Vector3(0, 0, 2.1));
    if (!hasRod && rodPosition && player.distanceTo(rodPosition) < 1.35) {
      hasRod = true;
      boat.remove(rodGroup);
      camera.add(rodGroup);
      rodGroup.position.set(.34, -.39, -.67);
      rodGroup.rotation.set(.1, -.25, -.55);
      rodGroup.scale.setScalar(.34);
      updateModeVisibility();
      showToast('Fishing rod picked up. Walk to the helm when you are ready.');
    } else if (dockDistance < 10 && player.distanceTo(exitPosition) < 1.55 && isWalkable(exitPosition.x, exitPosition.z)) {
      mode = 'walk';
      player.set(exitPosition.x, groundHeightAt(exitPosition.x, exitPosition.z), exitPosition.z);
      cameraYaw = boat.rotation.y;
      updateModeVisibility();
      showToast('Back on the island. The fish buyer is nearby.');
    } else if (player.distanceTo(helmPosition) < 1.45) {
      mode = 'sail';
      cameraYaw = boat.rotation.y;
      updateModeVisibility();
      showToast('At the helm. Steer with A and D.');
    }
  } else if (mode === 'sail' && dockDistance < 10) {
    if (fishingState !== 'idle') {
      fishingState = 'idle';
      bobber.visible = false;
      fishingLine.visible = false;
      ripple.visible = false;
    }
    mode = 'boatWalk';
    boatLocalPlayer.set(0, 0, -.2);
    syncBoatWalkPosition();
    updateModeVisibility();
    showToast('You left the helm. Walk to the pier to step ashore.');
  }
  updateButtons();
}

function isWalkable(x, z) {
  const islandLand = (x * x) / (14 * 14) + ((z + .2) * (z + .2)) / (11.7 * 11.7) < 1;
  const onDock = Math.abs(x) < 1.48 && z > 6.25 && z < 15.15;
  if (!islandLand && !onDock) return false;
  if (islandColliders.some((obstacle) => distanceTo(x, z, obstacle.x, obstacle.z) < obstacle.radius + .32)) return false;
  return true;
}

function updateWalking(dt) {
  const forward = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0);
  const sideways = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
  if (!forward && !sideways) return;
  const moveX = -Math.sin(cameraYaw) * forward + Math.cos(cameraYaw) * sideways;
  const moveZ = -Math.cos(cameraYaw) * forward - Math.sin(cameraYaw) * sideways;
  const length = Math.hypot(moveX, moveZ) || 1;
  const speed = 3.4 * dt;
  if (mode === 'boatWalk') {
    const delta = new THREE.Vector3(moveX / length * speed, 0, moveZ / length * speed);
    delta.applyQuaternion(boat.quaternion.clone().invert());
    const nextX = boatLocalPlayer.x + delta.x;
    const nextZ = boatLocalPlayer.z + delta.z;
    if (nextX > -.7 && nextX < .7 && nextZ > -.35 && nextZ < 1.82) {
      boatLocalPlayer.set(nextX, 0, nextZ);
      syncBoatWalkPosition();
    }
    return;
  }
  const nextX = player.x + moveX / length * speed;
  const nextZ = player.z + moveZ / length * speed;
  if (isWalkable(nextX, player.z)) player.x = nextX;
  if (isWalkable(player.x, nextZ)) player.z = nextZ;
  player.y = groundHeightAt(player.x, player.z);
}

function groundHeightAt(x, z) {
  if (Math.abs(x) < 1.48 && z > 6.25 && z < 15.15) return .5;
  const grassRadius = 1 - (x * x) / (12.4 * 12.4) - ((z + .5) * (z + .5)) / (10.1 * 10.1);
  const sandRadius = 1 - (x * x) / (15.8 * 15.8) - (z * z) / (13.5 * 13.5);
  const grassHeight = grassRadius > 0 ? -1.3 + 4.1 * Math.sqrt(grassRadius) : -Infinity;
  const sandHeight = sandRadius > 0 ? -2.7 + 5.3 * Math.sqrt(sandRadius) : .15;
  return Math.max(.15, grassHeight, sandHeight);
}

function updateBoat(dt) {
  const throttle = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0);
  const steering = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
  const turn = steering * dt * (boatSpeed < 0 ? -1 : 1) * .78;
  boat.rotation.y += turn;
  cameraYaw += turn;
  boatSpeed = THREE.MathUtils.damp(boatSpeed, throttle * 12, throttle ? 1.7 : 1.1, dt);
  const forward = boatForward();
  const nextX = boat.position.x + forward.x * boatSpeed * dt;
  const nextZ = boat.position.z + forward.z * boatSpeed * dt;
  const onIsland = (nextX * nextX) / (14.7 * 14.7) + ((nextZ + .2) * (nextZ + .2)) / (12.2 * 12.2) < 1;
  if (!onIsland) {
    boat.position.x = nextX;
    boat.position.z = nextZ;
  }
  boat.position.y = .15 + Math.sin(waterClock * 1.7 + boat.position.x * .1) * .12;
  syncBoatWalkPosition();
}

function syncBoatWalkPosition() {
  const world = boat.localToWorld(boatLocalPlayer.clone());
  player.set(world.x, boat.position.y, world.z);
}

function updateCamera() {
  if (mode === 'sail') camera.position.copy(boat.localToWorld(new THREE.Vector3(0, 1.2, 1.35)));
  else camera.position.set(player.x, player.y + 1.58, player.z);
  camera.rotation.set(cameraPitch, cameraYaw, 0, 'YXZ');
}

function drawMap() {
  const context = mapContext;
  const width = mapCanvas.width;
  const height = mapCanvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#397e7d';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(230,255,239,.1)';
  context.lineWidth = 1;
  for (let grid = 0; grid <= width; grid += 30) {
    context.beginPath(); context.moveTo(grid, 0); context.lineTo(grid, height); context.stroke();
    context.beginPath(); context.moveTo(0, grid); context.lineTo(width, grid); context.stroke();
  }
  const scale = Math.min(2.2, 63 / (islandDistance() + 15));
  const centerX = width / 2;
  const centerY = height / 2;
  context.save();
  context.translate(centerX, centerY);
  context.fillStyle = '#c9b986';
  context.beginPath(); context.ellipse(0, 0, 15.8 * scale, 13.5 * scale, 0, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#729e70';
  context.beginPath(); context.ellipse(0, -1 * scale, 12.4 * scale, 10.1 * scale, 0, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#9b7650';
  context.fillRect(-3.2 * scale, 7.1 * scale, 6.4 * scale, 8.2 * scale);
  context.fillStyle = '#e9e9c5';
  context.fillRect(3.0 * scale, 4.7 * scale, 1.2 * scale, .8 * scale);
  context.restore();
  const playerX = centerX + player.x * scale;
  const playerY = centerY + player.z * scale;
  context.fillStyle = '#f2db99';
  context.beginPath(); context.arc(playerX, playerY, 4.5, 0, Math.PI * 2); context.fill();
  context.strokeStyle = '#f2db99';
  context.lineWidth = 2.2;
  context.beginPath();
  context.moveTo(playerX, playerY);
  context.lineTo(playerX - Math.sin(cameraYaw) * 11, playerY - Math.cos(cameraYaw) * 11);
  context.stroke();
  context.fillStyle = 'rgba(243,255,245,.72)';
  context.font = '10px monospace';
  context.fillText('N', width - 14, 14);
}

function updateIslandArrow() {
  const dx = -player.x;
  const dz = -player.z;
  const worldAngle = Math.atan2(dx, -dz);
  islandArrow.style.transform = `rotate(${worldAngle - cameraYaw}rad)`;
}

function updateFishing(dt) {
  if (fishingState === 'waiting') {
    fishingTimer -= dt;
    if (fishingTimer <= 0) {
      fishingState = 'bite';
      biteWindow = 2.35;
      showToast('BITE! Reel in now!');
      updateButtons();
    }
  } else if (fishingState === 'bite') {
    biteWindow -= dt;
    if (biteWindow <= 0) {
      fishingState = 'idle';
      bobber.visible = false;
      fishingLine.visible = false;
      ripple.visible = false;
      showToast('It got away. Cast again when you are ready.');
      updateButtons();
    }
  }
  if (bobber.visible) {
    bobber.position.y = -.05 + Math.sin(waterClock * 2.4) * .14;
    if (fishingState === 'bite') bobber.position.y += Math.sin(waterClock * 22) * .12;
    ripple.position.set(fishingPoint.x, -.04, fishingPoint.z);
    ripple.scale.setScalar(.9 + Math.sin(waterClock * 2) * .12);
    const rodWorld = new THREE.Vector3();
    rodTip.getWorldPosition(rodWorld);
    fishingLine.geometry.setFromPoints([rodWorld, new THREE.Vector3(fishingPoint.x, bobber.position.y, fishingPoint.z)]);
  }
}

function updateHud() {
  updateButtons();
  updateIslandArrow();
  drawMap();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(.04, clock.getDelta());
  waterClock += dt;
  if (mode === 'sail') updateBoat(dt);
  else updateWalking(dt);
  updateFishing(dt);
  updateCamera(dt);
  if (statusClock >= .12) {
    updateHud();
    statusClock = 0;
  }
  statusClock += dt;
  water.position.x = player.x;
  water.position.z = player.z;
  for (let index = 0; index < waterPositions.count; index += 1) {
    const offset = index * 3;
    const x = waterBase[offset] + water.position.x;
    const z = waterBase[offset + 2] + water.position.z;
    waterPositions.array[offset + 1] = waterBase[offset + 1] + Math.sin(x * .045 + waterClock * 1.25) * .16 + Math.sin((z + x * .45) * .055 + waterClock * .8) * .12;
  }
  waterPositions.needsUpdate = true;
  if (Math.floor(waterClock * 12) % 3 === 0) waterGeometry.computeVertexNormals();
  renderer.render(scene, camera);
}

const clock = new THREE.Clock();

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', ' '].includes(key)) event.preventDefault();
  if (key.startsWith('arrow')) {
    keys.add(({ arrowup: 'w', arrowleft: 'a', arrowdown: 's', arrowright: 'd' })[key]);
  } else if (['w', 'a', 's', 'd'].includes(key)) {
    keys.add(key);
  }
  if (event.repeat) return;
  if (key === 'e') interact();
  if (key === 'f') castOrReel();
});
window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  const mapped = key.startsWith('arrow') ? ({ arrowup: 'w', arrowleft: 'a', arrowdown: 's', arrowright: 'd' })[key] : key;
  keys.delete(mapped);
});
window.addEventListener('blur', () => keys.clear());

document.querySelectorAll('.dpad button').forEach((button) => {
  const key = button.dataset.key;
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.classList.add('active');
    keys.add(key);
    button.setPointerCapture(event.pointerId);
  });
  const release = () => { keys.delete(key); button.classList.remove('active'); };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
});

interactButton.addEventListener('click', interact);
actionButton.addEventListener('click', castOrReel);

canvas.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse' && canvas.requestPointerLock && !pointerLocked) {
    canvas.requestPointerLock();
    return;
  }
  dragging = true;
  lastPointer = { x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  dragging = false;
});
canvas.addEventListener('pointermove', (event) => {
  if (!dragging && !pointerLocked) return;
  const dx = pointerLocked ? event.movementX : event.clientX - lastPointer.x;
  const dy = pointerLocked ? event.movementY : event.clientY - lastPointer.y;
  cameraYaw -= dx * .0025;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch - dy * .0025, -1.25, 1.25);
  lastPointer = { x: event.clientX, y: event.clientY };
});
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

formatFishCount();
player.y = groundHeightAt(player.x, player.z);
updateModeVisibility();
updateHud();
animate();