// ===== KILLERS =====
const KILLERS = {
  c00lkidd: {
    id: 'c00lkidd',
    name: 'c00lkidd',
    color: '#ff4d6d',
    speed: 2.55,
    maxHp: 100,
    visionRange: 320,
    ability1: { name: 'Corrupt Energy', cd: 10, desc: 'AoE slow + damage' },
    ability2: { name: '404 Error', cd: 8, desc: 'Short tele-dash' },
    ultimate: { name: 'Pizza Bots', cost: 100, desc: 'Summon autonomous bots' }
  },
  slasher: {
    id: 'slasher',
    name: 'Slasher',
    color: '#c1121f',
    speed: 2.45,
    maxHp: 100,
    visionRange: 300,
    ability1: { name: 'Heavy Slash', cd: 6, desc: 'High melee + bleed' },
    ability2: { name: 'Raging Pace', cd: 12, desc: 'Speed burst + stun immunity' },
    ultimate: { name: 'Blood Frenzy', cost: 100, desc: 'Massive power surge' }
  },
  johndoe: {
    id: 'johndoe',
    name: 'John Doe',
    color: '#6c757d',
    speed: 2.4,
    maxHp: 100,
    visionRange: 310,
    ability1: { name: 'Corrupt Spikes', cd: 11, desc: 'Block corridor' },
    ability2: { name: 'Digital Footprint', cd: 9, desc: 'Slow/reveal trap' },
    ultimate: { name: 'System Crash', cost: 100, desc: 'Area lockdown' }
  },
  '1x1x1x1': {
    id: '1x1x1x1',
    name: '1x1x1x1',
    color: '#9b2226',
    speed: 2.5,
    maxHp: 100,
    visionRange: 330,
    ability1: { name: 'Glitch Matrix', cd: 14, desc: 'Invert controls' },
    ability2: { name: 'Red Energy Wave', cd: 7, desc: 'Ranged projectile' },
    ultimate: { name: 'Null Zone', cost: 100, desc: 'Silence & damage zone' }
  }
};

class Killer extends Entity {
  constructor(x, y, kitId) {
    const kit = KILLERS[kitId] || KILLERS.c00lkidd;
    super(x, y, {
      radius: 16,
      speed: kit.speed,
      maxHp: kit.maxHp,
      team: 'killer',
      name: kit.name,
      color: kit.color,
      visionRange: kit.visionRange,
      visionAngle: Math.PI * 0.85
    });
    this.kit = kit;
    this.malice = 0;
    this.maxMalice = 100;
    this.cd1 = 0;
    this.cd2 = 0;
    this.attackCd = 0;
    this.attackRange = 42;
    this.attackDamage = 28;
    this.bleedTargets = new Map();
    this.spikes = [];
    this.traps = [];
    this.bots = [];
    this.projectiles = [];
    this.glitchTargets = new Map();
    this.rageTimer = 0;
    this.stunImmune = false;
  }

  gainMalice(amount) {
    this.malice = Math.min(this.maxMalice, this.malice + amount);
  }

  basicAttack(targets, map) {
    if (this.attackCd > 0 || this.stunTimer > 0) return null;
    this.attackCd = 0.9;
    let hit = null;
    for (const t of targets) {
      if (!t.alive || t.team === 'killer') continue;
      const d = Math.hypot(t.x - this.x, t.y - this.y);
      if (d < this.attackRange + t.radius) {
        t.applyDamage(this.attackDamage, this);
        this.gainMalice(12);
        map.burst(t.x, t.y, 8, '#e63946');
        hit = t;
        if (this.kit.id === 'slasher') this.bleedTargets.set(t, 3.5);
        break;
      }
    }
    return hit;
  }

  useAbility1(game) {
    if (this.cd1 > 0 || this.stunTimer > 0) return false;
    this.cd1 = this.kit.ability1.cd;
    const map = game.map;
    switch (this.kit.id) {
      case 'c00lkidd': {
        map.burst(this.x, this.y, 20, '#ff4d6d');
        for (const s of game.survivors) {
          if (!s.alive) continue;
          if (Math.hypot(s.x - this.x, s.y - this.y) < 110) {
            s.applyDamage(12, this);
            s.speedMod = 0.55;
            s.speedModTimer = 3;
            this.gainMalice(8);
          }
        }
        break;
      }
      case 'slasher': {
        for (const s of game.survivors) {
          if (!s.alive) continue;
          const d = Math.hypot(s.x - this.x, s.y - this.y);
          if (d < 55) {
            const ang = Math.atan2(s.y - this.y, s.x - this.x);
            let diff = ang - this.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            if (Math.abs(diff) < 0.9) {
              s.applyDamage(40, this);
              this.bleedTargets.set(s, 4);
              this.gainMalice(15);
              map.burst(s.x, s.y, 12, '#c1121f');
            }
          }
        }
        break;
      }
      case 'johndoe': {
        const dist = 50;
        const sx = this.x + Math.cos(this.angle) * dist;
        const sy = this.y + Math.sin(this.angle) * dist;
        const spike = { x: sx - 20, y: sy - 8, w: 40, h: 16, life: 6, angle: this.angle };
        this.spikes.push(spike);
        map.walls.push(spike);
        break;
      }
      case '1x1x1x1': {
        let nearest = null, nd = 200;
        for (const s of game.survivors) {
          if (!s.alive) continue;
          const d = Math.hypot(s.x - this.x, s.y - this.y);
          if (d < nd) { nd = d; nearest = s; }
        }
        if (nearest) {
          this.glitchTargets.set(nearest, 4);
          nearest.glitched = true;
          nearest.glitchTimer = 4;
        }
        break;
      }
    }
    return true;
  }

  useAbility2(game) {
    if (this.cd2 > 0 || this.stunTimer > 0) return false;
    this.cd2 = this.kit.ability2.cd;
    const map = game.map;
    switch (this.kit.id) {
      case 'c00lkidd': {
        const dash = 90;
        this.x += Math.cos(this.angle) * dash;
        this.y += Math.sin(this.angle) * dash;
        resolveWallCollision(this, map.walls);
        map.burst(this.x, this.y, 10, '#ff4d6d');
        break;
      }
      case 'slasher': {
        this.speedMod = 1.7;
        this.speedModTimer = 4;
        this.stunImmune = true;
        this.rageTimer = 4;
        break;
      }
      case 'johndoe': {
        this.traps.push({ x: this.x, y: this.y, radius: 36, life: 12, triggered: false });
        break;
      }
      case '1x1x1x1': {
        this.projectiles.push({
          x: this.x, y: this.y,
          vx: Math.cos(this.angle) * 320,
          vy: Math.sin(this.angle) * 320,
          life: 1.2, radius: 10, damage: 22
        });
        break;
      }
    }
    return true;
  }

  tryUltimate(game) {
    if (this.malice < 100) return false;
    this.malice = 0;
    if (this.kit.id === 'c00lkidd') {
      for (let i = 0; i < 2; i++) {
        this.bots.push({
          x: this.x + (Math.random() - 0.5) * 40,
          y: this.y + (Math.random() - 0.5) * 40,
          life: 12, speed: 2.1, radius: 10, target: null, attackCd: 0
        });
      }
    }
    game.map.burst(this.x, this.y, 25, this.color);
    return true;
  }

  update(dt, game) {
    this.updateTimers(dt);
    if (this.cd1 > 0) this.cd1 -= dt;
    if (this.cd2 > 0) this.cd2 -= dt;
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.rageTimer > 0) {
      this.rageTimer -= dt;
      if (this.rageTimer <= 0) this.stunImmune = false;
    }
    for (const [t, time] of this.bleedTargets) {
      const nt = time - dt;
      if (nt <= 0 || !t.alive) this.bleedTargets.delete(t);
      else {
        this.bleedTargets.set(t, nt);
        if (Math.random() < dt * 2) {
          t.applyDamage(3, this);
          game.map.addParticle(t.x, t.y, { color: '#c1121f', life: 0.4 });
        }
      }
    }
    for (let i = this.spikes.length - 1; i >= 0; i--) {
      this.spikes[i].life -= dt;
      if (this.spikes[i].life <= 0) {
        const idx = game.map.walls.indexOf(this.spikes[i]);
        if (idx >= 0) game.map.walls.splice(idx, 1);
        this.spikes.splice(i, 1);
      }
    }
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const tr = this.traps[i];
      tr.life -= dt;
      if (tr.life <= 0) { this.traps.splice(i, 1); continue; }
      if (tr.triggered) continue;
      for (const s of game.survivors) {
        if (!s.alive) continue;
        if (Math.hypot(s.x - tr.x, s.y - tr.y) < tr.radius + s.radius) {
          tr.triggered = true;
          s.speedMod = 0.4;
          s.speedModTimer = 3.5;
          s.revealed = 4;
          game.map.burst(tr.x, tr.y, 12, '#6c757d');
        }
      }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      let hit = false;
      for (const s of game.survivors) {
        if (!s.alive) continue;
        if (Math.hypot(s.x - p.x, s.y - p.y) < p.radius + s.radius) {
          s.applyDamage(p.damage, this);
          this.gainMalice(10);
          game.map.burst(s.x, s.y, 8, '#9b2226');
          hit = true;
          break;
        }
      }
      if (hit || p.life <= 0 || lineHitsWall(p.x - p.vx * dt, p.y - p.vy * dt, p.x, p.y, game.map.walls)) {
        this.projectiles.splice(i, 1);
      }
    }
    for (let i = this.bots.length - 1; i >= 0; i--) {
      const b = this.bots[i];
      b.life -= dt;
      if (b.life <= 0) { this.bots.splice(i, 1); continue; }
      let nearest = null, nd = 9999;
      for (const s of game.survivors) {
        if (!s.alive) continue;
        const d = Math.hypot(s.x - b.x, s.y - b.y);
        if (d < nd) { nd = d; nearest = s; }
      }
      if (nearest) {
        const ang = Math.atan2(nearest.y - b.y, nearest.x - b.x);
        b.x += Math.cos(ang) * b.speed;
        b.y += Math.sin(ang) * b.speed;
        if (nd < 30 && b.attackCd <= 0) {
          nearest.applyDamage(10, this);
          b.attackCd = 1.2;
          game.map.burst(nearest.x, nearest.y, 5, '#ff4d6d');
        }
      }
      if (b.attackCd > 0) b.attackCd -= dt;
    }
    for (const [s, t] of this.glitchTargets) {
      const nt = t - dt;
      if (nt <= 0) { s.glitched = false; this.glitchTargets.delete(s); }
      else this.glitchTargets.set(s, nt);
    }
  }

  drawExtras(ctx, cam) {
    for (const tr of this.traps) {
      if (tr.triggered) continue;
      ctx.beginPath();
      ctx.arc(tr.x - cam.x, tr.y - cam.y, tr.radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(108,117,125,0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const p of this.projectiles) {
      ctx.beginPath();
      ctx.arc(p.x - cam.x, p.y - cam.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#e63946';
      ctx.fill();
    }
    for (const b of this.bots) {
      ctx.beginPath();
      ctx.arc(b.x - cam.x, b.y - cam.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ff8fa3';
      ctx.fill();
      ctx.strokeStyle = '#ff4d6d';
      ctx.stroke();
    }
  }
}
