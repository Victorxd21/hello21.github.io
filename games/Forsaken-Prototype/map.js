// ===== MAP & PARTICLES =====
class GameMap {
  constructor() {
    this.cols = 36;
    this.rows = 28;
    this.tile = TILE;
    this.width = this.cols * this.tile;
    this.height = this.rows * this.tile;
    this.walls = [];
    this.generators = [];
    this.gates = [];
    this.hatch = null;
    this.spawnPoints = { survivors: [], killer: null };
    this.particles = [];
    this.generate();
  }

  generate() {
    this.walls = [];
    this.generators = [];
    this.gates = [];
    this.hatch = null;
    this.spawnPoints = { survivors: [], killer: null };

    const t = this.tile;
    this.walls.push({ x: 0, y: 0, w: this.width, h: t });
    this.walls.push({ x: 0, y: this.height - t, w: this.width, h: t });
    this.walls.push({ x: 0, y: 0, w: t, h: this.height });
    this.walls.push({ x: this.width - t, y: 0, w: t, h: this.height });

    const rooms = [
      [3, 3, 8, 6], [14, 3, 8, 5], [25, 3, 7, 6],
      [3, 12, 6, 7], [12, 11, 10, 6], [25, 12, 7, 6],
      [4, 21, 9, 4], [16, 20, 8, 5], [26, 21, 6, 4]
    ];
    for (const [cx, cy, cw, ch] of rooms) {
      this.addRoom(cx * t, cy * t, cw * t, ch * t);
    }

    const pillars = [[10, 9], [20, 9], [10, 18], [22, 17], [17, 15], [7, 16]];
    for (const [px, py] of pillars) {
      this.walls.push({ x: px * t, y: py * t, w: t, h: t });
    }

    const genSpots = [
      [5.5, 5.5], [17, 5], [28, 5.5],
      [6, 15], [28, 15]
    ];
    for (const [gx, gy] of genSpots) {
      this.generators.push({
        x: gx * t, y: gy * t,
        progress: 0,
        maxProgress: 100,
        repairing: false,
        repaired: false,
        radius: 22,
        qteActive: false,
        qteTimer: 0,
        qteWindow: 0
      });
    }

    this.gates.push({
      x: 2 * t, y: 13 * t, w: t * 0.6, h: t * 2,
      open: false, progress: 0, side: 'left'
    });
    this.gates.push({
      x: (this.cols - 2.6) * t, y: 13 * t, w: t * 0.6, h: t * 2,
      open: false, progress: 0, side: 'right'
    });

    this.spawnPoints.survivors = [
      { x: 8 * t, y: 23 * t },
      { x: 18 * t, y: 23 * t },
      { x: 12 * t, y: 8 * t },
      { x: 27 * t, y: 23 * t }
    ];
    this.spawnPoints.killer = { x: 18 * t, y: 14 * t };
  }

  addRoom(x, y, w, h) {
    const t = this.tile;
    this.walls.push({ x, y, w: w * 0.35, h: t * 0.5 });
    this.walls.push({ x: x + w * 0.65, y, w: w * 0.35, h: t * 0.5 });
    this.walls.push({ x, y: y + h - t * 0.5, w: w * 0.35, h: t * 0.5 });
    this.walls.push({ x: x + w * 0.65, y: y + h - t * 0.5, w: w * 0.35, h: t * 0.5 });
    this.walls.push({ x, y, w: t * 0.5, h: h * 0.35 });
    this.walls.push({ x, y: y + h * 0.65, w: t * 0.5, h: h * 0.35 });
    this.walls.push({ x: x + w - t * 0.5, y, w: t * 0.5, h: h * 0.35 });
    this.walls.push({ x: x + w - t * 0.5, y: y + h * 0.65, w: t * 0.5, h: h * 0.35 });
  }

  repairedCount() {
    return this.generators.filter(g => g.repaired).length;
  }

  spawnHatch(pos) {
    this.hatch = { x: pos.x, y: pos.y, radius: 28, open: true };
  }

  addParticle(x, y, opts = {}) {
    this.particles.push({
      x, y,
      vx: opts.vx || (Math.random() - 0.5) * 60,
      vy: opts.vy || (Math.random() - 0.5) * 60,
      life: opts.life || 0.6,
      maxLife: opts.life || 0.6,
      size: opts.size || 3 + Math.random() * 3,
      color: opts.color || '#e63946',
      gravity: opts.gravity || 0
    });
  }

  burst(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      this.addParticle(x, y, {
        vx: (Math.random() - 0.5) * 120,
        vy: (Math.random() - 0.5) * 120,
        life: 0.3 + Math.random() * 0.5,
        size: 2 + Math.random() * 4,
        color
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  draw(ctx, cam) {
    ctx.fillStyle = '#0c0e14';
    ctx.fillRect(-cam.x, -cam.y, this.width, this.height);

    ctx.strokeStyle = 'rgba(255,177,90,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += this.tile) {
      ctx.beginPath();
      ctx.moveTo(x - cam.x, -cam.y);
      ctx.lineTo(x - cam.x, this.height - cam.y);
      ctx.stroke();
    }
    for (let y = 0; y < this.height; y += this.tile) {
      ctx.beginPath();
      ctx.moveTo(-cam.x, y - cam.y);
      ctx.lineTo(this.width - cam.x, y - cam.y);
      ctx.stroke();
    }

    ctx.fillStyle = '#1a1d28';
    ctx.strokeStyle = 'rgba(255,177,90,0.15)';
    ctx.lineWidth = 1;
    for (const w of this.walls) {
      ctx.fillRect(w.x - cam.x, w.y - cam.y, w.w, w.h);
      ctx.strokeRect(w.x - cam.x, w.y - cam.y, w.w, w.h);
    }

    for (const g of this.generators) {
      const sx = g.x - cam.x, sy = g.y - cam.y;
      ctx.beginPath();
      ctx.arc(sx, sy, g.radius, 0, Math.PI * 2);
      ctx.fillStyle = g.repaired ? 'rgba(42,157,143,0.35)' : 'rgba(255,177,90,0.2)';
      ctx.fill();
      ctx.strokeStyle = g.repaired ? '#2a9d8f' : '#ffb15a';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (!g.repaired && g.progress > 0) {
        ctx.beginPath();
        ctx.arc(sx, sy, g.radius + 4, -Math.PI / 2, -Math.PI / 2 + (g.progress / g.maxProgress) * Math.PI * 2);
        ctx.strokeStyle = '#ffb15a';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.fillStyle = g.repaired ? '#2a9d8f' : '#ffb15a';
      ctx.font = '9px Share Tech Mono';
      ctx.textAlign = 'center';
      ctx.fillText(g.repaired ? 'DONE' : 'GEN', sx, sy + 3);
    }

    for (const gate of this.gates) {
      const sx = gate.x - cam.x, sy = gate.y - cam.y;
      ctx.fillStyle = gate.open ? 'rgba(42,157,143,0.4)' : 'rgba(230,57,70,0.35)';
      ctx.fillRect(sx, sy, gate.w, gate.h);
      ctx.strokeStyle = gate.open ? '#2a9d8f' : '#e63946';
      ctx.strokeRect(sx, sy, gate.w, gate.h);
      if (!gate.open && gate.progress > 0) {
        ctx.fillStyle = 'rgba(255,177,90,0.5)';
        ctx.fillRect(sx, sy + gate.h * (1 - gate.progress / 100), gate.w, gate.h * (gate.progress / 100));
      }
    }

    if (this.hatch) {
      const sx = this.hatch.x - cam.x, sy = this.hatch.y - cam.y;
      ctx.beginPath();
      ctx.arc(sx, sy, this.hatch.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,177,90,0.25)';
      ctx.fill();
      ctx.strokeStyle = '#ffb15a';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#ffb15a';
      ctx.font = '10px Orbitron';
      ctx.textAlign = 'center';
      ctx.fillText('HATCH', sx, sy + 4);
    }

    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - cam.x, p.y - cam.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
