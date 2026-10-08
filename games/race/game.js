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

  const NEW_PHYSICS = `/* Tire-force physics — high grip, holds road, still can drift if pushed */
class Wheel {
  constructor(lx, lz, front) {
    this.localX = lx; this.localZ = lz; this.isFront = front;
    this.radius = 0.36; this.suspensionRest = 0.32; this.suspensionMax = 0.55;
    this.springK = 48000; this.damper = 4000;
    this.grip = 1.85;
    this.compression = 0; this.onGround = false; this.groundY = 0;
    this.force = new THREE.Vector3(); this.spin = 0; this.omega = 0;
    this.steer = 0; this.mesh = null; this.load = 0; this.inertia = 1.1;
    this.slipAngle = 0; this.slipRatio = 0;
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
    this.mass = 1450; this.inertiaYaw = 2400; this.inertiaPitch = 1600; this.inertiaRoll = 900;
    this.engineTorque = 2800; this.brakeTorque = 5000; this.maxSteer = 0.52; this.drag = 0.38;
    this.lap = 1; this.checkpoint = 0; this.finished = false; this.finishTime = 0;
    this.name = isPlayer ? 'You' : 'Bot';
    this.gripUsage = 0;
  }
  createMesh(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.80, 0.45, 4.0),
      new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.28 }));
    body.position.y = 0.55; body.castShadow = true; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.40, 1.7),
      new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.4, roughness: 0.2 }));
    cabin.position.set(0, 0.95, -0.2); cabin.castShadow = true; g.add(cabin);
    const wg = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 16); wg.rotateZ(Math.PI / 2);
    const wm = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.75 });
    this.wheels.forEach(w => {
      const m = new THREE.Mesh(wg, wm);
      m.position.set(w.localX, w.radius, w.localZ); m.castShadow = true;
      g.add(m); w.mesh = m;
    });
    return g;
  }
  wheelXZ(w) {
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    return { x: this.pos.x + w.localX * c + w.localZ * s, z: this.pos.z - w.localX * s + w.localZ * c };
  }
  get isUpright() { return Math.abs(this.roll) < 1.2 && Math.abs(this.pitch) < 1.2; }
  tireCurve(rho) { return Math.sin(1.55 * Math.atan(2.4 * rho)); }
  update(dt) {
    if (this.isPlayer) {
      this.throttle = (keys['KeyW'] || keys['ArrowUp']) ? 1 : 0;
      this.brake = (keys['KeyS'] || keys['ArrowDown']) ? 1 : 0;
      this.steerInput = ((keys['KeyA'] || keys['ArrowLeft']) ? 1 : 0) - ((keys['KeyD'] || keys['ArrowRight']) ? 1 : 0);
      this.handbrake = !!keys['Space'];
      this.boost = (keys['ShiftLeft'] || keys['ShiftRight']) ? 1 : 0;
    }
    const spd = Math.abs(this.speed);
    const steerScale = THREE.MathUtils.clamp(1.0 - spd / 60, 0.30, 1.0);
    const targetSteer = this.steerInput * this.maxSteer * steerScale;
    for (const w of this.wheels)
      w.steer = w.isFront ? THREE.MathUtils.lerp(w.steer, targetSteer, Math.min(1, 16 * dt)) : 0;

    for (const w of this.wheels) {
      const xz = this.wheelXZ(w);
      w.groundY = getTerrainHeight(xz.x, xz.z);
    }
    const fl = this.wheels[0].groundY, fr = this.wheels[1].groundY;
    const rl = this.wheels[2].groundY, rr = this.wheels[3].groundY;
    const avgG = (fl + fr + rl + rr) * 0.25;

    if (this.isUpright && this.onGround) {
      const targetPitch = Math.atan2(((rl+rr)*0.5) - ((fl+fr)*0.5), 2.80);
      const targetRoll  = Math.atan2(((fr+rr)*0.5) - ((fl+rl)*0.5), 1.80);
      this.pitch = THREE.MathUtils.lerp(this.pitch, targetPitch, Math.min(1, 10 * dt));
      this.roll  = THREE.MathUtils.lerp(this.roll,  targetRoll,  Math.min(1, 10 * dt));
    }

    const totalForce = new THREE.Vector3(0, -this.mass * 9.81, 0);
    let torqueYaw = 0, torquePitch = 0, torqueRoll = 0, groundedCount = 0;
    let maxRho = 0;
    const driveTotal = this.throttle * this.engineTorque * (1 + this.boost * 0.55);

    for (const w of this.wheels) {
      if (!this.isUpright) {
        w.onGround = false; w.compression = 0;
        w.omega *= 0.97; w.spin += w.omega * dt;
        continue;
      }
      const attY = this.pos.y + w.localZ * Math.sin(this.pitch) - w.localX * Math.sin(this.roll);
      const distToGround = attY - w.groundY;
      const compression = w.suspensionRest + w.radius - distToGround;
      w.force.set(0, 0, 0); w.load = 0;

      if (compression > -0.12 && compression < w.suspensionMax + 0.35) {
        w.onGround = true; groundedCount++;
        w.compression = Math.max(0, Math.min(compression, w.suspensionMax));
        let normalF = Math.max(250, w.compression * w.springK - this.vel.y * w.damper);
        if (compression > w.suspensionMax * 0.88)
          normalF += (compression - w.suspensionMax * 0.85) * w.springK * 5;
        w.load = normalF; w.force.y = normalF;

        const wh = this.heading + w.steer;
        const cosW = Math.cos(wh), sinW = Math.sin(wh);
        const latX = cosW, latZ = -sinW;
        const relX = w.localX, relZ = w.localZ;
        const wxVel = this.vel.x - this.angVelY * relZ;
        const wzVel = this.vel.z + this.angVelY * relX;
        const vLong = wxVel * sinW + wzVel * cosW;
        const vLat  = wxVel * latX + wzVel * latZ;

        let engineT = w.isFront ? 0 : driveTotal / 2;
        if (this.handbrake && !w.isFront) engineT = 0;
        let brakeT = this.brake * this.brakeTorque * 0.25;
        if (this.handbrake && !w.isFront) brakeT += this.brakeTorque * 0.55;
        if (this.handbrake && w.isFront) brakeT += this.brakeTorque * 0.1;
        if (Math.abs(w.omega) > 0.05) brakeT *= Math.sign(w.omega); else brakeT = 0;
        w.omega += ((engineT - brakeT - Math.sign(w.omega || vLong) * 22) / w.inertia) * dt;

        const vRef = Math.max(Math.abs(vLong), 0.8);
        const slipRatio = (w.omega * w.radius - vLong) / vRef;
        const slipAngle = Math.atan2(vLat, Math.max(Math.abs(vLong), 0.5));
        w.slipRatio = slipRatio; w.slipAngle = slipAngle;

        const xz = this.wheelXZ(w);
        const onPaved = isOnRoad(xz.x, xz.z) || isOnHighway(xz.x, xz.z);
        const mu = w.grip * (onPaved ? 1.15 : 0.45);
        const peakSlip = 0.10;
        const peakAngle = 0.10;
        const sx = slipRatio / peakSlip;
        const sy = slipAngle / peakAngle;
        const rho = Math.max(1e-4, Math.hypot(sx, sy));
        if (rho > maxRho) maxRho = rho;
        const f = this.tireCurve(Math.min(rho, 2.5));
        const load = Math.max(normalF, 400);
        let Fx = mu * load * f * (sx / rho);
        let Fy = -mu * load * f * (sy / rho);
        if (Math.abs(slipAngle) < 0.12 && Math.abs(slipRatio) < 0.15) {
          Fy *= 1.25;
        }
        const maxF = mu * load;
        const fMag = Math.hypot(Fx, Fy);
        if (fMag > maxF) { const s = maxF / fMag; Fx *= s; Fy *= s; }

        w.omega -= (Fx * w.radius / w.inertia) * dt;
        w.omega = THREE.MathUtils.clamp(w.omega, -160, 160);
        w.spin += w.omega * dt;

        const fWorldX = Fx * sinW + Fy * latX;
        const fWorldZ = Fx * cosW + Fy * latZ;
        w.force.x += fWorldX; w.force.z += fWorldZ;
        torqueYaw += (relX * fWorldZ - relZ * fWorldX);
        torquePitch += relZ * w.force.y * 0.0008;
        torqueRoll  += -relX * w.force.y * 0.001;
      } else {
        w.onGround = false; w.compression = 0;
        w.omega *= 0.96; w.spin += w.omega * dt;
      }
      totalForce.x += w.force.x; totalForce.y += w.force.y; totalForce.z += w.force.z;
    }

    this.onGround = groundedCount >= 2;
    this.gripUsage = THREE.MathUtils.clamp(maxRho, 0, 1.5) / 1.5;

    if (!this.isUpright) {
      if (this.pos.y < avgG + 0.35) {
        this.pos.y = avgG + 0.35;
        if (this.vel.y < 0) this.vel.y *= -0.35;
        this.angVelRoll += (Math.random() - 0.5) * 2.5;
        this.angVelPitch += (Math.random() - 0.5) * 1.8;
      }
    } else if (this.onGround) {
      const targetY = avgG + 0.02;
      const err = targetY - this.pos.y;
      totalForce.y += err * this.mass * 24;
      if (this.pos.y < targetY - 0.1) {
        this.pos.y = targetY - 0.1;
        if (this.vel.y < 0) this.vel.y = 0;
      }
      const cH = Math.cos(this.heading), sH = Math.sin(this.heading);
      const vLatBody = this.vel.x * cH - this.vel.z * sH;
      if (Math.abs(vLatBody) > 0.3 && maxRho < 1.1) {
        const kill = Math.min(1, 8 * dt);
        this.vel.x -= vLatBody * cH * kill * 0.55;
        this.vel.z += vLatBody * sH * kill * 0.55;
      }
    }

    const spd2 = this.vel.lengthSq();
    if (spd2 > 0.01) {
      totalForce.x -= this.vel.x * this.drag * spd2 * 0.12;
      totalForce.z -= this.vel.z * this.drag * spd2 * 0.12;
    }

    this.vel.x += (totalForce.x / this.mass) * dt;
    this.vel.y += (totalForce.y / this.mass) * dt;
    this.vel.z += (totalForce.z / this.mass) * dt;

    this.angVelY     += (torqueYaw / this.inertiaYaw) * dt;
    this.angVelPitch += (torquePitch / this.inertiaPitch) * dt;
    this.angVelRoll  += (torqueRoll / this.inertiaRoll) * dt;

    if (this.isUpright && this.onGround) {
      this.angVelY *= (1 - 1.0 * dt);
      this.angVelPitch *= (1 - 5 * dt);
      this.angVelRoll  *= (1 - 6 * dt);
    } else {
      this.angVelY *= (1 - 0.25 * dt);
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
      this.pos.y = gNow + 0.25; this.vel.set(0, 0, 0);
      this.pitch = 0; this.roll = 0;
      this.angVelPitch = this.angVelRoll = this.angVelY = 0;
    }
    if (this.isPlayer && keys['KeyR'] && !this.isUpright) {
      this.pitch = 0; this.roll = 0;
      this.angVelPitch = this.angVelRoll = 0;
      this.pos.y = gNow + 0.25; this.vel.y = 0;
    }

    this.mesh.position.copy(this.pos);
    this.mesh.rotation.order = 'YXZ';
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.x = this.pitch;
    this.mesh.rotation.z = this.roll;

    for (const w of this.wheels) {
      if (!w.mesh) continue;
      const cv = Math.min(w.compression, w.suspensionMax) * 0.65;
      w.mesh.position.set(w.localX, w.radius - cv, w.localZ);
      w.mesh.rotation.y = w.steer;
      w.mesh.rotation.x = w.spin;
    }

    if (this.isPlayer) {
      const bar = document.getElementById('grip-fill');
      if (bar) {
        const pct = Math.min(100, this.gripUsage * 100);
        bar.style.width = pct + '%';
        bar.style.background = pct > 85 ? '#f44' : pct > 60 ? '#fa0' : '#4c4';
      }
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
    this.throttle = 0.7 + Math.random() * 0.2;
    this.brake = Math.abs(diff) > 1.0 ? 0.3 : 0;
    this.handbrake = Math.abs(diff) > 1.35 && Math.abs(this.speed) > 12;
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

  if (!document.getElementById('grip-meter')) {
    const el = document.createElement('div');
    el.id = 'grip-meter';
    el.innerHTML = '<div style="font:11px monospace;color:#ccc;margin-bottom:2px">GRIP</div><div style="width:100px;height:8px;background:#333;border-radius:3px;overflow:hidden"><div id="grip-fill" style="width:0%;height:100%;background:#4c4;transition:width .05s"></div></div>';
    el.style.cssText = 'position:fixed;bottom:24px;left:16px;z-index:50;pointer-events:none';
    document.body.appendChild(el);
  }

  const fn = new Function('THREE', 'OrbitControls', src + '\n//# sourceURL=game-grip.js');
  fn(THREE, OrbitControls);
}

boot().catch(e => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend',
    '<pre style="color:#f66;position:fixed;top:8px;left:8px;background:#000c;z-index:9999;padding:12px;max-width:90vw;overflow:auto">' +
    (e && e.stack ? e.stack : e) + '</pre>');
});
