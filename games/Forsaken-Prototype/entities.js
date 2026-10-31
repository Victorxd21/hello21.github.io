// ===== ENTITIES =====
const TILE = 40;

class Entity {
  constructor(x, y, opts = {}) {
    this.x = x;
    this.y = y;
    this.radius = opts.radius || 14;
    this.speed = opts.speed || 2.2;
    this.maxHp = opts.maxHp || 100;
    this.hp = this.maxHp;
    this.stamina = 100;
    this.maxStamina = 100;
    this.exhausted = false;
    this.exhaustedTimer = 0;
    this.sprintMult = 1.55;
    this.alive = true;
    this.angle = 0;
    this.vx = 0;
    this.vy = 0;
    this.team = opts.team || 'survivor';
    this.name = opts.name || 'Entity';
    this.color = opts.color || '#aaa';
    this.stunTimer = 0;
    this.invuln = 0;
    this.speedMod = 1;
    this.speedModTimer = 0;
    this.visionRange = opts.visionRange || 280;
    this.visionAngle = opts.visionAngle || Math.PI * 0.7;
    this.perk = null;
    this.effects = [];
  }

  get centerX() { return this.x; }
  get centerY() { return this.y; }

  applyDamage(amount, source) {
    if (!this.alive || this.invuln > 0) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invuln = 0.35;
    if (this.hp <= 0) {
      this.alive = false;
      this.hp = 0;
      return true;
    }
    return false;
  }

  heal(amount) {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  updateStamina(dt, isSprinting, isMoving) {
    if (this.stunTimer > 0) return;

    if (this.exhausted) {
      this.exhaustedTimer -= dt;
      this.stamina = Math.min(this.maxStamina, this.stamina + 18 * dt);
      if (this.stamina >= 30 || this.exhaustedTimer <= 0) {
        this.exhausted = false;
      }
      return;
    }

    if (isSprinting && isMoving) {
      this.stamina -= 22 * dt;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.exhausted = true;
        this.exhaustedTimer = 2.2;
      }
    } else if (isMoving) {
      this.stamina = Math.min(this.maxStamina, this.stamina + 8 * dt);
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + 22 * dt);
    }
  }

  getMoveSpeed() {
    let s = this.speed * this.speedMod;
    if (this.exhausted) s *= 0.55;
    if (this.stunTimer > 0) s = 0;
    return s;
  }

  updateTimers(dt) {
    if (this.stunTimer > 0) this.stunTimer -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.speedModTimer > 0) {
      this.speedModTimer -= dt;
      if (this.speedModTimer <= 0) this.speedMod = 1;
    }
  }

  canSee(target, walls) {
    if (!target || !target.alive) return false;
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this.visionRange) return false;

    const ang = Math.atan2(dy, dx);
    let diff = ang - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > this.visionAngle / 2) return false;

    return !lineHitsWall(this.x, this.y, target.x, target.y, walls);
  }

  draw(ctx, cam, isPlayer) {
    if (!this.alive) return;
    const sx = this.x - cam.x;
    const sy = this.y - cam.y;

    ctx.beginPath();
    ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.invuln > 0 ? '#fff' : this.color;
    ctx.fill();
    ctx.strokeStyle = isPlayer ? '#ffb15a' : 'rgba(0,0,0,0.5)';
    ctx.lineWidth = isPlayer ? 3 : 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(this.angle) * (this.radius + 8), sy + Math.sin(this.angle) * (this.radius + 8));
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '10px Share Tech Mono';
    ctx.textAlign = 'center';
    ctx.fillText(this.name, sx, sy - this.radius - 8);

    if (this.hp < this.maxHp) {
      const bw = 28, bh = 4;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(sx - bw/2, sy - this.radius - 18, bw, bh);
      ctx.fillStyle = this.team === 'killer' ? '#e63946' : '#2a9d8f';
      ctx.fillRect(sx - bw/2, sy - this.radius - 18, bw * (this.hp / this.maxHp), bh);
    }
  }
}

function lineHitsWall(x1, y1, x2, y2, walls) {
  for (const w of walls) {
    if (lineRect(x1, y1, x2, y2, w.x, w.y, w.w, w.h)) return true;
  }
  return false;
}

function lineRect(x1, y1, x2, y2, rx, ry, rw, rh) {
  const left = rx, right = rx + rw, top = ry, bottom = ry + rh;
  const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - left, right - x1, y1 - top, bottom - y1];
  let u1 = 0, u2 = 1;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) u1 = Math.max(u1, t);
      else u2 = Math.min(u2, t);
      if (u1 > u2) return false;
    }
  }
  return true;
}

function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function resolveWallCollision(ent, walls) {
  for (const w of walls) {
    if (!circleRect(ent.x, ent.y, ent.radius, w.x, w.y, w.w, w.h)) continue;
    const nearestX = Math.max(w.x, Math.min(ent.x, w.x + w.w));
    const nearestY = Math.max(w.y, Math.min(ent.y, w.y + w.h));
    let dx = ent.x - nearestX;
    let dy = ent.y - nearestY;
    const dist = Math.hypot(dx, dy) || 0.001;
    const overlap = ent.radius - dist + 0.5;
    if (overlap > 0) {
      ent.x += (dx / dist) * overlap;
      ent.y += (dy / dist) * overlap;
    }
  }
}
