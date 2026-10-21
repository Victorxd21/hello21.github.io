/**
 * jjsVR - Jujutsu Shenanigans inspired city + real Gorilla Tag physics
 * Hands are spheres. Push against surfaces to move. Bounce/climb.
 */
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import * as CANNON from 'cannon-es';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.style.background = '#87CEEB';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b8e0);
scene.fog = new THREE.Fog(0x87b8e0, 40, 120);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 200);
camera.position.set(0, 1.6, 8);

const stage = new THREE.Group();
scene.add(stage);

const hemi = new THREE.HemisphereLight(0xddeeff, 0x445566, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff5e0, 1.1);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
scene.add(sun);

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -12, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;

const matGround = new CANNON.Material('ground');
const matHand = new CANNON.Material('hand');
const matPlayer = new CANNON.Material('player');
world.addContactMaterial(new CANNON.ContactMaterial(matHand, matGround, {
  friction: 0.9, restitution: 0.05
}));
world.addContactMaterial(new CANNON.ContactMaterial(matPlayer, matGround, {
  friction: 0.4, restitution: 0.1
}));

function addStaticBox(x, y, z, sx, sy, sz, color, opts = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz),
    new THREE.MeshStandardMaterial({
      color, roughness: opts.rough ?? 0.85, metalness: opts.metal ?? 0.05
    })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  stage.add(mesh);
  const body = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)),
    position: new CANNON.Vec3(x, y, z),
    material: matGround
  });
  world.addBody(body);
  return { mesh, body };
}

const ROAD = 0x2a2a2e;
const SIDEWALK = 0xb8b8bc;

addStaticBox(0, -0.25, 0, 80, 0.5, 80, 0x5a9a5a);
function roadStrip(x, y, z, sx, sy, sz) {
  addStaticBox(x, y, z, sx, sy, sz, ROAD);
}
roadStrip(0, 0.02, 0, 4, 0.08, 70);
roadStrip(0, 0.02, 0, 70, 0.08, 4);
roadStrip(-18, 0.02, 0, 3.5, 0.08, 55);
roadStrip(18, 0.02, 0, 3.5, 0.08, 55);
roadStrip(0, 0.02, -18, 55, 0.08, 3.5);
roadStrip(0, 0.02, 18, 55, 0.08, 3.5);
roadStrip(-9, 0.02, 0, 3, 0.08, 40);
roadStrip(9, 0.02, 0, 3, 0.08, 40);
roadStrip(0, 0.02, -9, 40, 0.08, 3);
roadStrip(0, 0.02, 9, 40, 0.08, 3);
addStaticBox(0, 0.05, 0, 12, 0.06, 12, SIDEWALK);

const towerH = 18;
addStaticBox(-3.5, towerH / 2, -2, 5, towerH, 5, 0xc8d0dc);
addStaticBox(3.5, towerH / 2, -2, 5, towerH, 5, 0xc8d0dc);
addStaticBox(0, 12, -2, 2.5, 1.2, 3, 0xa8b0bc);
for (let f = 1; f < 10; f++) {
  for (const tx of [-3.5, 3.5]) {
    addStaticBox(tx - 2.3, f * 1.7, -2, 0.15, 0.9, 0.15, 0x88aacc);
    addStaticBox(tx + 2.3, f * 1.7, -2, 0.15, 0.9, 0.15, 0x88aacc);
  }
}

addStaticBox(0, 0.08, 4, 8, 0.1, 8, 0x90c090);
function tree(x, z) {
  addStaticBox(x, 0.8, z, 0.35, 1.6, 0.35, 0x6b4423);
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x2d8a2d, roughness: 0.9 })
  );
  top.position.set(x, 2.2, z);
  top.castShadow = true;
  stage.add(top);
  const tb = new CANNON.Body({ mass: 0, shape: new CANNON.Sphere(1.0), position: new CANNON.Vec3(x, 2.2, z), material: matGround });
  world.addBody(tb);
}
[[-4, 6], [4, 6], [-4, 2], [4, 2], [0, 7], [-6, 0], [6, 0]].forEach(([x, z]) => tree(x, z));

addStaticBox(0, 2, 12, 6, 4, 5, 0xc0392b);
addStaticBox(0, 4.3, 12, 6.2, 0.4, 5.2, 0x922b21);
addStaticBox(-14, 1.5, -12, 7, 3, 5, 0xf5f5f5);
addStaticBox(-14, 2.9, -12, 7.1, 0.35, 5.1, 0x27ae60);
addStaticBox(-14, 2.55, -12, 7.1, 0.2, 5.1, 0xf1c40f);
addStaticBox(-14, 2.3, -12, 7.1, 0.2, 5.1, 0x2980b9);
addStaticBox(-14, 0.25, -9.2, 5, 0.5, 1.5, 0xcccccc);
addStaticBox(-20, 2.5, 0, 6, 5, 8, 0x7f8c8d);
addStaticBox(-20, 5.2, 0, 6.2, 0.4, 8.2, 0x5d6d6e);
addStaticBox(16, 0.15, -16, 10, 0.3, 10, 0x5d4e37);
for (let i = 0; i < 6; i++) {
  const gx = 13 + (i % 3) * 2.5;
  const gz = -14 - Math.floor(i / 3) * 3;
  addStaticBox(gx, 0.7, gz, 0.5, 1.2, 0.15, 0x888888);
}
addStaticBox(20, 2, -6, 6, 4, 6, 0x9b59b6);
addStaticBox(20, 1.5, 6, 7, 3, 6, 0x566573);
addStaticBox(-6, 1.8, -10, 5, 3.6, 5, 0xf5cba7);
addStaticBox(-8, 2, -20, 5, 4, 4, 0x85c1e9);
addStaticBox(0, 2.5, -22, 6, 5, 5, 0xd5d8dc);
addStaticBox(8, 2, -20, 5, 4, 4, 0xf9e79f);
addStaticBox(0, 1.2, 22, 14, 2.4, 6, 0x95a5a6);
addStaticBox(0, 2.6, 22, 14.5, 0.3, 6.5, 0x7f8c8d);
addStaticBox(-4, 0.8, 16, 3, 1.6, 4, 0x444448);
addStaticBox(4, 0.8, 16, 3, 1.6, 4, 0x444448);
addStaticBox(12, -1.5, 0, 8, 0.3, 40, 0x2c3e50);
addStaticBox(8, -0.5, 0, 0.4, 2.2, 40, 0x34495e);
addStaticBox(16, -0.5, 0, 0.4, 2.2, 40, 0x34495e);
addStaticBox(12, 0.6, 0, 8, 0.25, 40, 0x1a252f);
for (let z = -15; z <= 15; z += 5) {
  const light = new THREE.PointLight(0xfff0dd, 0.6, 8);
  light.position.set(12, 0.3, z);
  stage.add(light);
}
addStaticBox(0, 3, -36, 72, 6, 1.5, 0x6c7a89);
addStaticBox(0, 3, 36, 72, 6, 1.5, 0x6c7a89);
addStaticBox(-36, 3, 0, 1.5, 6, 72, 0x6c7a89);
