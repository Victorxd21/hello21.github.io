import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const GOOD = 'https://raw.githubusercontent.com/Victorxd21/hello21.github.io/9c180b3a5a1eb3d83249ad060e84effa9a33d84f/games/race/game.js';

async function boot() {
  let src = await (await fetch(GOOD)).text();
  src = src.replace(/^import \* as THREE from 'three';\s*import \{ OrbitControls \} from 'three\/addons\/controls\/OrbitControls\.js';\s*/, '');

  const PHYS_START = "/* ─── Per-wheel physics (same as before, condensed) ─────────── */";
  const PHYS_END   = "/* ─── NPC Traffic on infinite highway ──────────────────────── */";
  const i0 = src.indexOf(PHYS_START);
  const i1 = src.indexOf(PHYS_END);
  if (i0 < 0 || i1 < 0) throw new Error('Physics markers missing');

  const NEW_PHYSICS = `/* ─── Realistic physics: wheels on ground, terrain follow, can flip ─── */
class Wheel {
  constructor(localX, localZ, isFront) {
    this.localX = localX; this.localZ = localZ; this.isFront = isFront;
    this.radius = 0.36;
    this.suspensionRest = 0.28;
    this.suspensionMax = 0.55;
    this.springK = 42000; this.damper = 3500; this.grip = 1.3;
    this.compression = 0; this.onGround = false; this.groundY = 0;
    this.force = new THREE.Vector3(); this.spin = 0; this.omega = 0;
    this.steer = 0; this.mesh = null; this.load = 0;
  }
}
class Car {
  constructor(color = 0xff3333, isPlayer = false) {
    this.isPlayer = isPlayer;
    this.wheels = [
      new Wheel(-0.90, 1.40, true), new Wheel(0.90, 1.40, true),
      new Wheel(-0.90, -1.40, false), new Wheel(0.90, -1.40, false)
    ];
    this.mesh = this.createMesh(color); scene.add(this.mesh);
    this.pos = new THREE.Vector3(0, 1, 0); this.vel = new THREE.Vector3();
    this.heading = 0; this.pitch = 0; this.roll = 0;
    this.angVelY = 0; this.angVelPitch = 0; this.angVelRoll = 0;
    this.throttle = 0; this.brake = 0; this.steerInput = 0;
    this.handbrake = false; this.boost = 0; this.onGround = false;
    this.mass = 1450; this.inertiaYaw = 2200; this.inertiaPitch = 1400; this.inertiaRoll = 800;
    this.enginePower = 10000; this.brakePower = 14000; this.maxSteer = 0.70; this.drag = 0.32;
    this.lap = 1; this.checkpoint = 0; this.finished = false; this.finishTime = 0;
    this.name = isPlayer ? 'You' : 'Bot';
  }
  createMesh(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.80, 0.45, 4.0),
      new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.28 }));
    body.position.y = 0.55; body.castShadow = true; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.40, 1.7),
      new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.4, roughness: 0.2 }));
    cabin.position.set(0, 0.95, -0.2); cabin.castShadow = true; g.add(cabin);
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 16); wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.75 });
    this.wheels.forEach(w => {
      const mesh = new THREE.Mesh(wheelGeo, wheelMat);
      mesh.position.set(w.localX, w.radius, w.localZ); mesh.castShadow = true;
      g.add(mesh); w.mesh = mesh;
    });
    return g;
  }
  wheelXZ(w) {
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    return {
      x: this.pos.x + w.localX * c + w.localZ * s,
      z: this.pos.z - w.localX * s + w.localZ * c
    };
  }
  get isUpright() {
    return Math.abs(this.roll) < 1.15 && Math.abs(this.pitch) < 1.15;
  }
  update(dt) {
    if (this.isPlayer) {
      this.throttle = (keys['KeyW'] || keys['ArrowUp']) ? 1 : 0;
      this.brake = (keys['KeyS'] || keys['ArrowDown']) ? 1 : 0;
      this.steerInput = ((keys['KeyA'] || keys['ArrowLeft']) ? 1 : 0) - ((keys['KeyD'] || keys['ArrowRight']) ? 1 : 0);
      this.handbrake = !!keys['Space'];
      this.boost = (keys['ShiftLeft'] || keys['ShiftRight']) ? 1 : 0;
    }

    const spd = Math.abs(this.speed);
    const steerScale = THREE.MathUtils.clamp(1.0 - spd / 70, 0.35, 1.0);
    const targetSteer = this.steerInput * this.maxSteer * steerScale;
    for (const w of this.wheels)
      w.steer = w.isFront ? THREE.MathUtils.lerp(w.steer, targetSteer, Math.min(1, 12 * dt)) : 0;

    for (const w of this.wheels) {
      const xz = this.wheelXZ(w);
      w.groundY = getTerrainHeight(xz.x, xz.z);
    }

    const fl = this.wheels[0].groundY, fr = this.wheels[1].groundY;
    const rl = this.wheels[2].groundY, rr = this.wheels[3].groundY;
    const avgG = (fl + fr + rl + rr) * 0.25;

    if (this.isUpright && this.onGround) {
      const targetPitch = Math.atan2(((fl+fr)*0.5) - ((rl+rr)*0.5), 2.80);
      const targetRoll  = Math.atan2(((fr+rr)*0.5) - ((fl+rl)*0.5), 1.80);
      this.pitch = THREE.MathUtils.lerp(this.pitch, targetPitch, Math.min(1, 8 * dt));
      this.roll  = THREE.MathUtils.lerp(this.roll,  targetRoll,  Math.min(1, 8 * dt));
    }

    const totalForce = new THREE.Vector3(0, -this.mass * 9.81, 0);
    let torqueYaw = 0, torquePitch = 0, torqueRoll = 0, groundedCount = 0;

    for (const w of this.wheels) {
      if (!this.isUpright) {
        w.onGround = false; w.compression = 0;
        w.omega *= 0.95; w.spin += w.omega * dt;
        continue;
      }

      const attY = this.pos.y + w.localZ * Math.sin(this.pitch) - w.localX * Math.sin(this.roll);
      const distToGround = attY - w.groundY;
      const compression = w.suspensionRest + w.radius - distToGround;
      w.force.set(0, 0, 0); w.load = 0;

      if (compression > -0.15 && compression < w.suspensionMax + 0.4) {
        w.onGround = true; groundedCount++;
        w.compression = Math.max(0, Math.min(compression, w.suspensionMax));
        const springF = w.compression * w.springK;
        const damperF = -this.vel.y * w.damper;
        let normalF = Math.max(0, springF + damperF);
        if (compression > w.suspensionMax * 0.9)
          normalF += (compression - w.suspensionMax * 0.88) * w.springK * 4;
        w.load = normalF; w.force.y = normalF;

        const wh = this.heading + w.steer;
        const cosW = Math.cos(wh), sinW = Math.sin(wh);
        const relX = w.localX, relZ = w.localZ;
        const wxVel = this.vel.x - this.angVelY * relZ;
        const wzVel = this.vel.z + this.angVelY * relX;
        const longSpeed = wxVel * sinW + wzVel * cosW;
        const latSpeed  = wxVel * cosW - wzVel * sinW;

        const isDriven = !w.isFront;
        let driveTorque = isDriven ? this.throttle * this.enginePower * (0.5 + this.boost * 0.5) : 0;
        if (this.handbrake && !w.isFront) driveTorque = 0;
        let brakeTorque = this.brake * this.brakePower * 0.25;
        if (this.handbrake && !w.isFront) brakeTorque += this.brakePower * 0.55;
        if (this.handbrake && w.isFront)  brakeTorque += this.brakePower * 0.1;

        const xz = this.wheelXZ(w);
        const onPaved = isOnRoad(xz.x, xz.z) || isOnHighway(xz.x, xz.z);
        const mu = w.grip * (onPaved ? 1.05 : 0.55);
        const maxF = mu * Math.max(normalF, 100);

        let longForce = THREE.MathUtils.clamp(
          (driveTorque - Math.sign(longSpeed || 1) * brakeTorque) / w.radius,
          -maxF, maxF
        );
        const remaining = Math.sqrt(Math.max(0, maxF * maxF - longForce * longForce));
        let latForce = THREE.MathUtils.clamp(-latSpeed * 18 * (normalF / 3200), -remaining, remaining);
        longForce += -Math.sign(longSpeed || 1) * 50 * (normalF / 4000);

        w.force.x += longForce * sinW + latForce * cosW;
        w.force.z += longForce * cosW - latForce * sinW;
        w.omega = longSpeed / w.radius;
        w.spin += w.omega * dt;

        torqueYaw   += (relX * w.force.z - relZ * w.force.x) * 0.0024;
        torquePitch += relZ * w.force.y * 0.0010;
        torqueRoll  += -relX * w.force.y * 0.0012;
      } else {
        w.onGround = false; w.compression = 0;
        w.omega *= 0.92; w.spin += w.omega * dt;
      }
      totalForce.x += w.force.x; totalForce.y += w.force.y; totalForce.z += w.force.z;
    }

    this.onGround = groundedCount >= 2;

    if (!this.isUpright) {
      if (this.pos.y < avgG + 0.35) {
        this.pos.y = avgG + 0.35;
        if (this.vel.y < 0) this.vel.y *= -0.4;
        this.angVelRoll  += (Math.random() - 0.5) * 3;
        this.angVelPitch += (Math.random() - 0.5) * 2;
      }
    } else {
      const targetY = avgG + 0.02;
      if (this.onGround) {
        const err = targetY - this.pos.y;
        totalForce.y += err * this.mass * 25;
        if (this.pos.y < targetY - 0.08) {
          this.pos.y = targetY - 0.08;
          if (this.vel.y < 0) this.vel.y = 0;
        }
        if (this.pos.y > targetY + 0.35 && this.vel.y > 0) this.vel.y *= 0.3;
      }
    }

    const spd2 = this.vel.lengthSq();
    if (spd2 > 0.01) {
      totalForce.x -= this.vel.x * this.drag * spd2 * 0.13;
      totalForce.z -= this.vel.z * this.drag * spd2 * 0.13;
    }

    this.vel.x += (totalForce.x / this.mass) * dt;
    this.vel.y += (totalForce.y / this.mass) * dt;
    this.vel.z += (totalForce.z / this.mass) * dt;

    this.angVelY     += (torqueYaw   / this.inertiaYaw)   * dt * 38;
    this.angVelPitch += (torquePitch / this.inertiaPitch) * dt * 50;
    this.angVelRoll  += (torqueRoll  / this.inertiaRoll)  * dt * 50;

    if (this.isUpright && this.onGround && Math.abs(this.steerInput) > 0.04) {
      const assist = this.steerInput * Math.min(1.2, 0.3 + spd / 25) * 1.8;
      this.angVelY += assist * dt * 7;
    }

    if (this.isUpright && this.onGround) {
      this.angVelY *= (1 - 1.6 * dt);
      this.angVelPitch *= (1 - 6 * dt);
      this.angVelRoll  *= (1 - 8 * dt);
    } else {
      this.angVelY *= (1 - 0.3 * dt);
      this.angVelPitch *= (1 - 0.12 * dt);
      this.angVelRoll  *= (1 - 0.12 * dt);
    }

    this.heading += this.angVelY * dt;
    this.pitch   += this.angVelPitch * dt;
    this.roll    += this.angVelRoll * dt;
    while (this.pitch > Math.PI) this.pitch -= Math.PI * 2;
    while (this.pitch < -Math.PI) this.pitch += Math.PI * 2;
    while (this.roll > Math.PI) this.roll -= Math.PI * 2;
    while (this.roll < -Math.PI) this.roll += Math.PI * 2;

    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;

    const gNow = getTerrainHeight(this.pos.x, this.pos.z);
    if (this.pos.y < gNow - 8) {
      this.pos.y = gNow + 0.3; this.vel.set(0, 0, 0);
      this.pitch = 0; this.roll = 0;
      this.angVelPitch = this.angVelRoll = this.angVelY = 0;
    }

    if (this.isPlayer && keys['KeyR'] && !this.isUpright) {
      this.pitch = 0; this.roll = 0;
      this.angVelPitch = this.angVelRoll = 0;
      this.pos.y = gNow + 0.3;
      this.vel.y = 0;
    }

    this.mesh.position.copy(this.pos);
    this.mesh.rotation.order = 'YXZ';
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.x = this.pitch;
    this.mesh.rotation.z = this.roll;

    for (const w of this.wheels) {
      if (!w.mesh) continue;
      const compressVis = Math.min(w.compression, w.suspensionMax) * 0.7;
      w.mesh.position.set(w.localX, w.radius - compressVis, w.localZ);
      w.mesh.rotation.y = w.steer;
      w.mesh.rotation.x = w.spin;
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
    this.steerInput = THREE.MathUtils.clamp(diff * 2.0, -1, 1);
    this.throttle = 0.65 + Math.random() * 0.25;
    this.brake = Math.abs(diff) > 1.0 ? 0.35 : 0;
    this.handbrake = Math.abs(diff) > 1.4 && Math.abs(this.speed) > 14;
  }
}

`;
  src = src.slice(0, i0) + NEW_PHYSICS + src.slice(i1);

  src = src.replace(/seg\.lookAt\(xb - cx \* CHUNK_SIZE, hy, zb - cz \* CHUNK_SIZE\);\s*seg\.rotateX\(Math\.PI \/ 2\);/g,
    'const _ang = Math.atan2(xb - xa, zb - za); seg.rotation.y = _ang;');
  src = src.replace(/line\.lookAt\(xb - cx \* CHUNK_SIZE, hy, zb - cz \* CHUNK_SIZE\);\s*line\.rotateX\(Math\.PI \/ 2\);/g,
    'line.rotation.y = Math.atan2(xb - xa, zb - za);');
  src = src.replace(/edge\.lookAt\(xb - cx \* CHUNK_SIZE \+ px, hy, zb - cz \* CHUNK_SIZE \+ pz\);\s*edge\.rotateX\(Math\.PI \/ 2\);/g,
    'edge.rotation.y = Math.atan2(xb - xa, zb - za);');

  src = src.replace(/getTerrainHeight\(([^)]+)\) \+ 1\.2/g, 'getTerrainHeight($1) + 0.15');
  src = src.replace(/getTerrainHeight\(([^)]+)\) \+ 0\.5/g, 'getTerrainHeight($1) + 0.15');
  src = src.replace(/player\.pos\.y = gy \+ 1\.2/g, 'player.pos.y = gy + 0.15');
  src = src.replace(/player\.pos\.y = gy \+ 0\.5/g, 'player.pos.y = gy + 0.15');
  src = src.replace(/this\.pos\.y = gNow \+ 1(?!\d)/g, 'this.pos.y = gNow + 0.15');
  src = src.replace(/this\.pos\.y = gNow \+ 0\.5/g, 'this.pos.y = gNow + 0.15');

  const fn = new Function('THREE', 'OrbitControls', src + '\n//# sourceURL=game-realistic.js');
  fn(THREE, OrbitControls);
}

boot().catch(e => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend',
    '<pre style="color:#f66;position:fixed;top:8px;left:8px;background:#000c;z-index:9999;padding:12px;max-width:90vw;overflow:auto">' +
    (e && e.stack ? e.stack : e) + '</pre>');
});
