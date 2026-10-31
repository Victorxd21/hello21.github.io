// ===== MAIN GAME =====
const Game = {
  canvas: null, ctx: null, map: null, player: null, killer: null,
  survivors: [], pathfinder: null, survivorAIs: [], killerAI: null,
  cam: { x: 0, y: 0 }, keys: {}, joy: { active: false, dx: 0, dy: 0 },
  sprintHeld: false, running: false, lastTime: 0, shake: 0,
  spectator: false, spectateTarget: null,
  stats: { gens: 0, escapes: 0, kills: 0, time: 0 },
  audioCtx: null, heartbeatRate: 0,

  init() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (['Space','ShiftLeft','ShiftRight'].includes(e.code)) e.preventDefault();
      if (e.code === 'KeyE') this.tryInteract();
      if (e.code === 'KeyQ') this.useAbility(1);
      if (e.code === 'KeyF') this.useAbility(2);
      if (e.code === 'Space') this.confirmQTE();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    document.getElementById('btn-ability1').onclick = () => this.useAbility(1);
    document.getElementById('btn-ability2').onclick = () => this.useAbility(2);
    document.getElementById('btn-mob-a1').onclick = () => this.useAbility(1);
    document.getElementById('btn-mob-a2').onclick = () => this.useAbility(2);
    document.getElementById('btn-interact').onclick = () => this.tryInteract();
    document.getElementById('btn-sprint').addEventListener('touchstart', e => { e.preventDefault(); this.sprintHeld = true; });
    document.getElementById('btn-sprint').addEventListener('touchend', () => { this.sprintHeld = false; });
    this.initJoystick();
    UI.init();
  },

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  initJoystick() {
    const zone = document.getElementById('joystick-zone');
    const knob = document.getElementById('joystick-knob');
    let origin = null;
    const getPos = (e) => { const t = e.touches ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; };
    const start = (e) => { e.preventDefault(); origin = getPos(e); this.joy.active = true; };
    const move = (e) => {
      if (!this.joy.active || !origin) return;
      e.preventDefault();
      const p = getPos(e);
      let dx = p.x - origin.x, dy = p.y - origin.y;
      const max = 40, len = Math.hypot(dx, dy);
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      this.joy.dx = dx / max; this.joy.dy = dy / max;
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };
    const end = () => {
      this.joy.active = false; this.joy.dx = 0; this.joy.dy = 0;
      knob.style.transform = 'translate(-50%, -50%)'; origin = null;
    };
    zone.addEventListener('touchstart', start, { passive: false });
    zone.addEventListener('touchmove', move, { passive: false });
    zone.addEventListener('touchend', end);
    zone.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
  },

  startMatch(role, charId, perkId) {
    this.map = new GameMap();
    this.pathfinder = new Pathfinder(this.map);
    this.survivors = []; this.survivorAIs = [];
    this.spectator = false; this.shake = 0;
    this.stats = { gens: 0, escapes: 0, kills: 0, time: 0 };
    UI.setSpectator(false);

    const kSpawn = this.map.spawnPoints.killer;
    const killerId = role === 'killer' ? charId : Object.keys(KILLERS)[Math.floor(Math.random() * 4)];
    this.killer = new Killer(kSpawn.x, kSpawn.y, killerId);

    const survIds = Object.keys(SURVIVORS);
    const playerSurvId = role === 'survivor' ? charId : null;
    const spawnPts = this.map.spawnPoints.survivors;

    for (let i = 0; i < 4; i++) {
      let id = (i === 0 && playerSurvId) ? playerSurvId : survIds[Math.floor(Math.random() * survIds.length)];
      const perk = (i === 0 && playerSurvId) ? perkId : Object.keys(PERKS)[Math.floor(Math.random() * 4)];
      const s = new Survivor(spawnPts[i].x, spawnPts[i].y, id, perk);
      this.survivors.push(s);
      if (!(i === 0 && role === 'survivor')) this.survivorAIs.push(new SurvivorAI(s, this.pathfinder));
      else s.isPlayer = true;
    }

    if (role === 'killer') { this.player = this.killer; this.killerAI = null; }
    else { this.player = this.survivors[0]; this.killerAI = new KillerAI(this.killer, this.pathfinder); }

    UI.updateHUD(this.player, this);
    this.running = true;
    this.lastTime = performance.now();
    this.initAudio();
    requestAnimationFrame(t => this.loop(t));
  },

  initAudio() {
    try { this.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { this.audioCtx = null; }
  },

  playTone(freq, dur, type = 'square', vol = 0.08) {
    if (!this.audioCtx) return;
    const o = this.audioCtx.createOscillator();
    const g = this.audioCtx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + dur);
    o.connect(g); g.connect(this.audioCtx.destination);
    o.start(); o.stop(this.audioCtx.currentTime + dur);
  },

  playHeartbeat() {
    this.playTone(60, 0.08, 'sine', 0.12);
    setTimeout(() => this.playTone(50, 0.1, 'sine', 0.1), 120);
  },

  aliveSurvivors() { return this.survivors.filter(s => s.alive).length; },

  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.stats.time += dt;
    this.update(dt);
    this.render();
    requestAnimationFrame(t => this.loop(t));
  },

  update(dt) {
    if (this.shake > 0) this.shake -= dt;
    if (this.player && this.player.alive && !this.spectator) this.handlePlayerInput(dt);
    for (const ai of this.survivorAIs) ai.update(dt, this);
    if (this.killerAI) this.killerAI.update(dt, this);
    else if (this.killer) this.killer.update(dt, this);
    for (const s of this.survivors) { if (s.isPlayer) s.update(dt, this); }
    this.map.updateParticles(dt);

    let focus = this.player;
    if (this.spectator) {
      const alive = this.survivors.filter(s => s.alive);
      if (alive.length) { this.spectateTarget = alive[0]; focus = this.spectateTarget; }
    }
    if (focus) {
      const tx = focus.x - this.canvas.width / 2;
      const ty = focus.y - this.canvas.height / 2;
      this.cam.x += (tx - this.cam.x) * 0.12;
      this.cam.y += (ty - this.cam.y) * 0.12;
    }

    if (this.player && this.player.team === 'survivor' && this.killer && this.killer.alive) {
      const d = Math.hypot(this.killer.x - this.player.x, this.killer.y - this.player.y);
      const overlay = document.getElementById('heartbeat-overlay');
      if (d < 200) {
        overlay.classList.add('active');
        this.heartbeatRate += dt;
        if (this.heartbeatRate > Math.max(0.35, d / 400)) {
          this.heartbeatRate = 0;
          this.playHeartbeat();
        }
      } else overlay.classList.remove('active');
    }

    if (this.aliveSurvivors() === 1 && !this.map.hatch) {
      const last = this.survivors.find(s => s.alive);
      if (last) {
        this.map.spawnHatch({ x: last.x + 80, y: last.y });
        UI.status('EMERGENCY HATCH SPAWNED');
        this.playTone(200, 0.3, 'sawtooth', 0.1);
      }
    }
    this.checkEnd();
  },

  handlePlayerInput(dt) {
    const p = this.player;
    let mx = 0, my = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) my -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) my += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;
    if (this.joy.active) { mx = this.joy.dx; my = this.joy.dy; }
    if (p.glitched) { mx = -mx; my = -my; }
    const len = Math.hypot(mx, my);
    const moving = len > 0.1;
    if (moving) p.angle = Math.atan2(my, mx);
    const sprint = (this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.sprintHeld) && !p.exhausted;
    const colaActive = p.colaTimer > 0;
    p.updateStamina(dt, sprint && !colaActive, moving);
    let spd = p.getMoveSpeed();
    if (sprint || colaActive) spd *= p.sprintMult;
    if (moving) {
      p.x += Math.cos(p.angle) * spd * Math.min(1, len);
      p.y += Math.sin(p.angle) * spd * Math.min(1, len);
    }
    resolveWallCollision(p, this.map.walls);
    if (p.team === 'killer' && (this.keys['Space'] || this.keys['KeyE'])) {
      const hit = p.basicAttack(this.survivors, this.map);
      if (hit) {
        this.shake = 0.25;
        this.playTone(120, 0.1, 'sawtooth', 0.12);
        if (!hit.alive) this.stats.kills++;
      }
    }
    UI.updateHUD(p, this);
  },

  tryInteract() {
    const p = this.player;
    if (!p || !p.alive || p.team !== 'survivor') return;
    for (const g of this.map.generators) {
      if (g.repaired) continue;
      if (Math.hypot(g.x - p.x, g.y - p.y) < g.radius + p.radius + 10) {
        this.startRepair(p, g); return;
      }
    }
    if (this.map.repairedCount() >= 3) {
      for (const gate of this.map.gates) {
        if (gate.open) continue;
        const cx = gate.x + gate.w / 2, cy = gate.y + gate.h / 2;
        if (Math.hypot(cx - p.x, cy - p.y) < 45) { this.tryOpenGate(p, gate, 0.4); return; }
      }
    }
    if (this.map.hatch && Math.hypot(this.map.hatch.x - p.x, this.map.hatch.y - p.y) < 40) {
      this.escapeSurvivor(p);
    }
  },

  startRepair(s, g) { if (!g.repaired) s.repairing = g; },

  tryRepair(s, g, dt) {
    if (!s.alive || g.repaired) return;
    if (Math.hypot(g.x - s.x, g.y - s.y) > g.radius + s.radius + 12) {
      s.repairing = null;
      if (s.isPlayer) UI.showGenProgress(false);
      return;
    }
    g.progress += 12 * dt;
    if (s.isPlayer) UI.showGenProgress(true, g.progress, 'REPAIRING...');
    if (!g.qteActive && Math.random() < dt * 0.25) {
      g.qteActive = true; g.qteTimer = 1.4; g.qteWindow = 0.35;
      if (s.isPlayer) { UI.showQTE(true); this.playTone(440, 0.08, 'square', 0.1); }
    }
    if (g.qteActive) {
      g.qteTimer -= dt;
      if (g.qteTimer <= 0) {
        g.qteActive = false;
        g.progress = Math.max(0, g.progress - 18);
        s.stamina = Math.max(0, s.stamina - 25);
        this.map.burst(g.x, g.y, 15, '#e63946');
        this.playTone(80, 0.2, 'sawtooth', 0.15);
        if (s.isPlayer) { UI.showQTE(false); UI.status('QTE FAILED!'); this.shake = 0.3; }
      }
    }
    if (g.progress >= g.maxProgress) {
      g.repaired = true; g.progress = 100; g.qteActive = false;
      this.stats.gens++;
      this.map.burst(g.x, g.y, 20, '#2a9d8f');
      this.playTone(520, 0.25, 'sine', 0.12);
      if (s.isPlayer) { UI.showGenProgress(false); UI.showQTE(false); UI.status('GENERATOR REPAIRED'); }
      s.repairing = null;
    }
  },

  confirmQTE() {
    const p = this.player;
    if (!p || !p.repairing) return;
    const g = p.repairing;
    if (!g.qteActive) return;
    if (g.qteTimer < g.qteWindow + 0.3) {
      g.qteActive = false; g.progress += 8;
      UI.showQTE(false); this.playTone(660, 0.1, 'sine', 0.1); UI.status('NICE!');
    } else {
      g.qteActive = false; g.progress = Math.max(0, g.progress - 12);
      UI.showQTE(false); this.playTone(90, 0.15, 'sawtooth', 0.12);
    }
  },

  tryOpenGate(s, gate, dt) {
    if (this.map.repairedCount() < 3) return;
    gate.progress += 25 * (dt || 0.3);
    if (s.isPlayer) UI.status(`OPENING GATE ${Math.floor(gate.progress)}%`);
    if (gate.progress >= 100) {
      gate.open = true; UI.status('GATE OPEN!'); this.playTone(400, 0.4, 'triangle', 0.1);
    }
  },

  escapeSurvivor(s) {
    if (!s.alive) return;
    let can = false;
    if (this.map.hatch && Math.hypot(this.map.hatch.x - s.x, this.map.hatch.y - s.y) < 40) can = true;
    for (const gate of this.map.gates) {
      if (gate.open) {
        const cx = gate.x + gate.w / 2, cy = gate.y + gate.h / 2;
        if (Math.hypot(cx - s.x, cy - s.y) < 50) can = true;
      }
    }
    if (!can && this.map.repairedCount() >= 3) {
      for (const gate of this.map.gates) {
        const cx = gate.x + gate.w / 2, cy = gate.y + gate.h / 2;
        if (Math.hypot(cx - s.x, cy - s.y) < 50) { gate.open = true; can = true; }
      }
    }
    if (can) {
      s.alive = false; s.escaped = true; this.stats.escapes++;
      UI.status(`${s.name} ESCAPED!`); this.playTone(700, 0.35, 'sine', 0.12);
      if (s.isPlayer) this.endMatch(true);
    }
  },

  useAbility(slot) {
    const p = this.player;
    if (!p || !p.alive) return;
    if (slot === 1) {
      if (p.useAbility1(this)) { this.playTone(300, 0.12, 'square', 0.1); this.shake = 0.15; }
    } else {
      if (p.useAbility2(this)) { this.playTone(350, 0.12, 'square', 0.1); this.shake = 0.15; }
    }
    if (p.team === 'killer' && p.malice >= 100) p.tryUltimate(this);
    UI.updateHUD(p, this);
  },

  checkEnd() {
    if (this.player && !this.player.alive && !this.spectator && this.player.team === 'survivor' && !this.player.escaped) {
      this.spectator = true; UI.setSpectator(true); UI.status('YOU DIED — SPECTATING');
    }
    const alive = this.aliveSurvivors();
    const escaped = this.survivors.filter(s => s.escaped).length;
    if (alive === 0) {
      if (this.player.team === 'survivor') this.endMatch(this.player.escaped === true);
      else this.endMatch(escaped === 0);
    }
    if (this.player && this.player.alive && this.player.repairing) {
      this.tryRepair(this.player, this.player.repairing, 1 / 60);
    }
  },

  endMatch(playerWon) {
    this.running = false;
    const title = playerWon ? 'VICTORY' : 'DEFEATED';
    const mins = Math.floor(this.stats.time / 60);
    const secs = Math.floor(this.stats.time % 60);
    const html = `<div><strong>Time:</strong> ${mins}m ${secs}s</div><div><strong>Generators:</strong> ${this.map.repairedCount()}/5</div><div><strong>Escapes:</strong> ${this.stats.escapes}</div><div><strong>Kills:</strong> ${this.stats.kills}</div>`;
    UI.showEnd(title, html);
  },

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    let sx = 0, sy = 0;
    if (this.shake > 0) {
      sx = (Math.random() - 0.5) * 10 * this.shake;
      sy = (Math.random() - 0.5) * 10 * this.shake;
    }
    ctx.save();
    ctx.translate(sx, sy);
    this.map.draw(ctx, this.cam);
    for (const s of this.survivors) { s.draw(ctx, this.cam, s === this.player); s.drawExtras(ctx, this.cam); }
    if (this.killer) { this.killer.draw(ctx, this.cam, this.killer === this.player); this.killer.drawExtras(ctx, this.cam); }
    if (this.player && this.player.team === 'survivor' && !this.spectator) {
      const grd = ctx.createRadialGradient(w/2, h/2, 80, w/2, h/2, Math.max(w, h) * 0.7);
      grd.addColorStop(0, 'transparent');
      grd.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }
};

window.addEventListener('load', () => Game.init());
