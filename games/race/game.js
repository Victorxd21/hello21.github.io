import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* Restore full game from last known-good commit, then patch floating + steering. */
const GOOD = 'https://raw.githubusercontent.com/Victorxd21/hello21.github.io/9c180b3a5a1eb3d83249ad060e84effa9a33d84f/games/race/game.js';

async function boot() {
  let src = await (await fetch(GOOD)).text();
  // Strip original imports (we already imported)
  src = src.replace(/^import \* as THREE from 'three';\s*import \{ OrbitControls \} from 'three\/addons\/controls\/OrbitControls\.js';\s*/, '');

  // === FIX FLOATING ===
  // 1) Lower rest length so equilibrium sits near ground (wheel bottoms ~ ground)
  src = src.replace('this.suspensionRest = 0.45', 'this.suspensionRest = 0.08');
  // 2) Stronger springs so car does not sink then bounce
  src = src.replace('this.springK = 16000', 'this.springK = 32000');
  src = src.replace('this.damper = 1400', 'this.damper = 3600');
  // 3) Hard floor at ground (wheel bottoms are at body origin Y)
  src = src.replace(
    'if (this.pos.y < avgG + 0.15) { this.pos.y = avgG + 0.15; if (this.vel.y < 0) this.vel.y = 0; }',
    'if (this.pos.y < avgG) { this.pos.y = avgG; if (this.vel.y < 0) this.vel.y = 0; }\n' +
    '      // Soft ceiling – kill upward hop so car stays planted\n' +
    '      if (this.pos.y > avgG + 0.55 && this.vel.y > 0) this.vel.y *= 0.35;'
  );
  // 4) Soft clamp if floating too high while "grounded"
  src = src.replace(
    'this.onGround = groundedCount >= 1;\n    totalForce.y -= this.mass * 28;',
    'this.onGround = groundedCount >= 1;\n' +
    '    // Pull down hard if body is floating above all wheels\n' +
    '    {\n' +
    '      let minG = Infinity; for (const w of this.wheels) minG = Math.min(minG, w.groundY);\n' +
    '      if (this.pos.y > minG + 0.7) totalForce.y -= this.mass * 40;\n' +
    '    }\n' +
    '    totalForce.y -= this.mass * 28;'
  );
  // 5) Spawn / reset closer to ground
  src = src.replace(/getTerrainHeight\(([^)]+)\) \+ 1\.2/g, 'getTerrainHeight($1) + 0.35');
  src = src.replace(/getTerrainHeight\(([^)]+)\) \+ 1(?!\d)/g, 'getTerrainHeight($1) + 0.35');
  src = src.replace('player.pos.y = gy + 1.2', 'player.pos.y = gy + 0.35');
  src = src.replace('this.pos.y = gNow + 1', 'this.pos.y = gNow + 0.35');

  // === FIX TURNING ===
  // More responsive steering, less yaw damping so car can actually rotate
  src = src.replace('this.maxSteer = 0.55', 'this.maxSteer = 0.72');
  src = src.replace('this.angVelY *= (1 - 3 * dt)', 'this.angVelY *= (1 - 1.6 * dt)');
  // Stronger yaw torque from lateral forces
  src = src.replace(
    'torqueYaw += (relX * w.force.z - relZ * w.force.x) * 0.001',
    'torqueYaw += (relX * w.force.z - relZ * w.force.x) * 0.0022'
  );
  // Direct steer assist when on ground (arcade + physics hybrid so turning always works)
  src = src.replace(
    'this.heading += this.angVelY * dt;',
    'if (this.onGround && Math.abs(this.steerInput) > 0.05) {\n' +
    '      const spd = Math.abs(this.vel.x * Math.sin(this.heading) + this.vel.z * Math.cos(this.heading));\n' +
    '      const turnRate = this.steerInput * Math.min(1, spd / 8) * 2.4;\n' +
    '      this.angVelY += turnRate * dt * 8;\n' +
    '    }\n' +
    '    this.heading += this.angVelY * dt;'
  );

  // Run
  const fn = new Function('THREE', 'OrbitControls', src + '\n//# sourceURL=game-patched.js');
  fn(THREE, OrbitControls);
}

boot().catch(e => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend',
    '<pre style="color:#f66;position:fixed;top:8px;left:8px;background:#000c;z-index:9999;padding:12px;max-width:90vw;overflow:auto">' +
    (e && e.stack ? e.stack : e) + '</pre>');
});
