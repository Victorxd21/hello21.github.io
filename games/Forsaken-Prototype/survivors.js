// ===== SURVIVORS =====
const SURVIVORS = {
  noob: {
    id: 'noob', name: 'Noob', color: '#4cc9f0', speed: 2.25,
    ability1: { name: 'Bloxy Cola', cd: 14, desc: 'Speed burst (bypasses stamina)' },
    ability2: { name: 'Slateskin', cd: 18, desc: 'Temporary shield' }
  },
  guest1337: {
    id: 'guest1337', name: 'Guest 1337', color: '#90be6d', speed: 2.2,
    ability1: { name: 'Block/Parry', cd: 10, desc: 'Block next hit' },
    ability2: { name: 'Charge Punch', cd: 12, desc: 'Stun the killer' }
  },
  shedletsky: {
    id: 'shedletsky', name: 'Shedletsky', color: '#f9c74f', speed: 2.2,
    ability1: { name: 'Sword Slash', cd: 11, desc: 'Stun killer' },
    ability2: { name: 'Fried Chicken', cd: 16, desc: 'Self-heal' }
  },
  '007n7': {
    id: '007n7', name: '007n7', color: '#577590', speed: 2.3,
    ability1: { name: 'Decoy Clone', cd: 15, desc: 'Spawn decoy bot' },
    ability2: { name: 'Decoy Clone', cd: 15, desc: 'Spawn decoy bot' }
  },
  veeronica: {
    id: 'veeronica', name: 'Veeronica', color: '#f72585', speed: 2.35,
    ability1: { name: 'SK8 Skateboard', cd: 9, desc: 'High mobility dash' },
    ability2: { name: 'SK8 Skateboard', cd: 9, desc: 'High mobility dash' }
  },
  elliot: {
    id: 'elliot', name: 'Elliot', color: '#43aa8b', speed: 2.2,
    ability1: { name: 'Pizza Throw', cd: 13, desc: 'Team heal' },
    ability2: { name: 'Rush Hour', cd: 16, desc: 'Sprint aura for team' }
  }
};

const PERKS = {
  lightfoot: { id: 'lightfoot', name: 'Lightfoot', desc: '+12% move speed' },
  adrenaline: { id: 'adrenaline', name: 'Adrenaline', desc: 'Faster stamina regen' },
  resilient: { id: 'resilient', name: 'Resilient', desc: '+20 max HP' },
  terrifying: { id: 'terrifying', name: 'Terrifying Aura', desc: 'Killer vision reduced near you' }
};

class Survivor extends Entity {
  constructor(x, y, kitId, perkId) {
    const kit = SURVIVORS[kitId] || SURVIVORS.noob;
    super(x, y, {
      radius: 13, speed: kit.speed, maxHp: 100, team: 'survivor',
      name: kit.name, color: kit.color, visionRange: 260, visionAngle: Math.PI * 0.9
    });
    this.kit = kit;
    this.perk = PERKS[perkId] || null;
    this.cd1 = 0; this.cd2 = 0;
    this.blocking = false; this.blockTimer = 0;
    this.shield = 0; this.colaTimer = 0;
    this.decoy = null;
    this.glitched = false; this.glitchTimer = 0;
    this.revealed = 0; this.repairing = null; this.isPlayer = false;
    if (this.perk) {
      if (this.perk.id === 'lightfoot') this.speed *= 1.12;
      if (this.perk.id === 'resilient') { this.maxHp = 120; this.hp = 120; }
    }
  }

  useAbility1(game) {
    if (this.cd1 > 0 || this.stunTimer > 0) return false;
    this.cd1 = this.kit.ability1.cd;
    const map = game.map, killer = game.killer;
    switch (this.kit.id) {
      case 'noob':
        this.colaTimer = 4; this.speedMod = 1.6; this.speedModTimer = 4;
        map.burst(this.x, this.y, 8, '#4cc9f0'); break;
      case 'guest1337':
        this.blocking = true; this.blockTimer = 2.5; break;
      case 'shedletsky':
        if (killer && killer.alive && Math.hypot(killer.x - this.x, killer.y - this.y) < 55) {
          if (!killer.stunImmune) { killer.stunTimer = 2.2; map.burst(killer.x, killer.y, 12, '#f9c74f'); }
        }
        break;
      case '007n7':
        this.decoy = { x: this.x + (Math.random()-0.5)*30, y: this.y + (Math.random()-0.5)*30, life: 8, radius: 13, color: this.color };
        break;
      case 'veeronica': {
        const dash = 110;
        this.x += Math.cos(this.angle) * dash;
        this.y += Math.sin(this.angle) * dash;
        resolveWallCollision(this, map.walls);
        map.burst(this.x, this.y, 10, '#f72585');
        break;
      }
      case 'elliot':
        for (const s of game.survivors) {
          if (!s.alive) continue;
          if (Math.hypot(s.x - this.x, s.y - this.y) < 140) { s.heal(25); map.burst(s.x, s.y, 6, '#43aa8b'); }
        }
        break;
    }
    return true;
  }

  useAbility2(game) {
    if (this.cd2 > 0 || this.stunTimer > 0) return false;
    if (this.kit.id === '007n7' || this.kit.id === 'veeronica') return this.useAbility1(game);
    this.cd2 = this.kit.ability2.cd;
    const map = game.map, killer = game.killer;
    switch (this.kit.id) {
      case 'noob':
        this.shield = 40; this.invuln = 0.1; map.burst(this.x, this.y, 10, '#adb5bd'); break;
      case 'guest1337':
        if (killer && killer.alive && Math.hypot(killer.x - this.x, killer.y - this.y) < 50) {
          if (!killer.stunImmune) { killer.stunTimer = 2.8; map.burst(killer.x, killer.y, 14, '#90be6d'); }
        }
        break;
      case 'shedletsky':
        this.heal(35); map.burst(this.x, this.y, 8, '#f9c74f'); break;
      case 'elliot':
        for (const s of game.survivors) {
          if (!s.alive) continue;
          if (Math.hypot(s.x - this.x, s.y - this.y) < 160) { s.speedMod = 1.35; s.speedModTimer = 5; }
        }
        map.burst(this.x, this.y, 12, '#43aa8b');
        break;
    }
    return true;
  }

  applyDamage(amount, source) {
    if (this.blocking) { this.blocking = false; this.blockTimer = 0; return false; }
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, amount);
      this.shield -= absorbed; amount -= absorbed;
      if (amount <= 0) return false;
    }
    return super.applyDamage(amount, source);
  }

  update(dt, game) {
    this.updateTimers(dt);
    if (this.cd1 > 0) this.cd1 -= dt;
    if (this.cd2 > 0) this.cd2 -= dt;
    if (this.blockTimer > 0) { this.blockTimer -= dt; if (this.blockTimer <= 0) this.blocking = false; }
    if (this.colaTimer > 0) this.colaTimer -= dt;
    if (this.glitchTimer > 0) { this.glitchTimer -= dt; if (this.glitchTimer <= 0) this.glitched = false; }
    if (this.revealed > 0) this.revealed -= dt;
    if (this.decoy) { this.decoy.life -= dt; if (this.decoy.life <= 0) this.decoy = null; }
    if (this.perk && this.perk.id === 'adrenaline' && this.stamina < this.maxStamina) {
      this.stamina = Math.min(this.maxStamina, this.stamina + 6 * dt);
    }
  }

  drawExtras(ctx, cam) {
    if (this.blocking) {
      ctx.beginPath();
      ctx.arc(this.x - cam.x, this.y - cam.y, this.radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(144,190,109,0.8)'; ctx.lineWidth = 3; ctx.stroke();
    }
    if (this.shield > 0) {
      ctx.beginPath();
      ctx.arc(this.x - cam.x, this.y - cam.y, this.radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(173,181,189,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    }
    if (this.decoy) {
      ctx.beginPath();
      ctx.arc(this.decoy.x - cam.x, this.decoy.y - cam.y, this.decoy.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(87,117,144,0.5)'; ctx.fill();
      ctx.strokeStyle = this.color; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
    }
  }
}
