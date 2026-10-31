// ===== AI (A* + decision trees) =====
class Pathfinder {
  constructor(map) {
    this.map = map;
    this.tile = map.tile;
    this.cols = map.cols;
    this.rows = map.rows;
  }

  isWalkable(tx, ty) {
    if (tx < 1 || ty < 1 || tx >= this.cols - 1 || ty >= this.rows - 1) return false;
    const wx = tx * this.tile + this.tile / 2;
    const wy = ty * this.tile + this.tile / 2;
    for (const w of this.map.walls) {
      if (circleRect(wx, wy, 12, w.x, w.y, w.w, w.h)) return false;
    }
    return true;
  }

  worldToTile(x, y) {
    return { x: Math.floor(x / this.tile), y: Math.floor(y / this.tile) };
  }

  heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  findPath(sx, sy, gx, gy) {
    const start = this.worldToTile(sx, sy);
    const goal = this.worldToTile(gx, gy);
    if (!this.isWalkable(goal.x, goal.y)) return [];

    const open = [];
    const closed = new Set();
    const key = (p) => p.x + ',' + p.y;
    const came = new Map();
    const gScore = new Map();
    const fScore = new Map();

    open.push(start);
    gScore.set(key(start), 0);
    fScore.set(key(start), this.heuristic(start, goal));

    const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    let iterations = 0;
    while (open.length > 0 && iterations++ < 400) {
      open.sort((a, b) => (fScore.get(key(a)) || 999) - (fScore.get(key(b)) || 999));
      const current = open.shift();
      if (current.x === goal.x && current.y === goal.y) return this.reconstruct(came, current);
      closed.add(key(current));

      for (const [dx, dy] of dirs) {
        const nx = current.x + dx, ny = current.y + dy;
        if (!this.isWalkable(nx, ny)) continue;
        const nk = nx + ',' + ny;
        if (closed.has(nk)) continue;
        const tentative = (gScore.get(key(current)) || 0) + (dx && dy ? 1.4 : 1);
        if (tentative < (gScore.get(nk) || Infinity)) {
          came.set(nk, current);
          gScore.set(nk, tentative);
          fScore.set(nk, tentative + this.heuristic({ x: nx, y: ny }, goal));
          if (!open.find(p => p.x === nx && p.y === ny)) open.push({ x: nx, y: ny });
        }
      }
    }
    return [];
  }

  reconstruct(came, current) {
    const path = [];
    let cur = current;
    while (cur) {
      path.unshift({
        x: cur.x * this.tile + this.tile / 2,
        y: cur.y * this.tile + this.tile / 2
      });
      cur = came.get(cur.x + ',' + cur.y);
    }
    return path;
  }
}

class SurvivorAI {
  constructor(survivor, pathfinder) {
    this.s = survivor;
    this.pf = pathfinder;
    this.path = [];
    this.pathIdx = 0;
    this.state = 'idle';
    this.repathTimer = 0;
    this.targetGen = null;
  }

  update(dt, game) {
    const s = this.s;
    if (!s.alive) return;
    s.update(dt, game);

    const killer = game.killer;
    const distToKiller = killer && killer.alive ? Math.hypot(killer.x - s.x, killer.y - s.y) : 9999;

    if (distToKiller < 160) this.state = 'flee';
    else if (game.map.hatch && game.aliveSurvivors() <= 1) this.state = 'hatch';
    else if (game.map.repairedCount() >= 3) this.state = 'gate';
    else this.state = 'repair';

    this.repathTimer -= dt;
    if (this.repathTimer <= 0 || this.path.length === 0) {
      this.repathTimer = 0.8 + Math.random() * 0.6;
      this.computePath(game);
    }
    this.followPath(dt, game);

    if (this.state === 'repair') {
      for (const g of game.map.generators) {
        if (g.repaired) continue;
        if (Math.hypot(g.x - s.x, g.y - s.y) < g.radius + s.radius + 8) {
          s.repairing = g;
          game.tryRepair(s, g, dt);
          break;
        }
      }
    } else if (this.state === 'gate') {
      for (const gate of game.map.gates) {
        if (gate.open) continue;
        const cx = gate.x + gate.w / 2, cy = gate.y + gate.h / 2;
        if (Math.hypot(cx - s.x, cy - s.y) < 40) game.tryOpenGate(s, gate, dt);
      }
    } else if (this.state === 'hatch' && game.map.hatch) {
      if (Math.hypot(game.map.hatch.x - s.x, game.map.hatch.y - s.y) < 35) game.escapeSurvivor(s);
    }

    if (distToKiller < 90 && Math.random() < dt * 0.4) {
      if (s.cd1 <= 0) s.useAbility1(game);
      else if (s.cd2 <= 0) s.useAbility2(game);
    }
  }

  computePath(game) {
    const s = this.s;
    let tx = s.x, ty = s.y;
    if (this.state === 'flee' && game.killer) {
      const ang = Math.atan2(s.y - game.killer.y, s.x - game.killer.x);
      tx = s.x + Math.cos(ang) * 180;
      ty = s.y + Math.sin(ang) * 180;
    } else if (this.state === 'repair') {
      let best = null, bd = 99999;
      for (const g of game.map.generators) {
        if (g.repaired) continue;
        const d = Math.hypot(g.x - s.x, g.y - s.y);
        if (d < bd) { bd = d; best = g; }
      }
      if (best) { tx = best.x; ty = best.y; this.targetGen = best; }
    } else if (this.state === 'gate') {
      const gate = game.map.gates[0];
      tx = gate.x; ty = gate.y + gate.h / 2;
    } else if (this.state === 'hatch' && game.map.hatch) {
      tx = game.map.hatch.x; ty = game.map.hatch.y;
    }
    this.path = this.pf.findPath(s.x, s.y, tx, ty);
    this.pathIdx = 0;
  }

  followPath(dt, game) {
    const s = this.s;
    if (this.path.length === 0 || this.pathIdx >= this.path.length) return;
    const target = this.path[this.pathIdx];
    const dx = target.x - s.x, dy = target.y - s.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 12) { this.pathIdx++; return; }
    s.angle = Math.atan2(dy, dx);
    const sprint = this.state === 'flee';
    const spd = s.getMoveSpeed() * (sprint ? s.sprintMult : 1);
    s.updateStamina(dt, sprint, true);
    s.x += Math.cos(s.angle) * spd;
    s.y += Math.sin(s.angle) * spd;
    resolveWallCollision(s, game.map.walls);
  }
}

class KillerAI {
  constructor(killer, pathfinder) {
    this.k = killer;
    this.pf = pathfinder;
    this.path = [];
    this.pathIdx = 0;
    this.repathTimer = 0;
    this.state = 'hunt';
  }

  update(dt, game) {
    const k = this.k;
    if (!k.alive) return;
    k.update(dt, game);

    let target = null, td = 99999;
    for (const s of game.survivors) {
      if (!s.alive) continue;
      if (s.decoy && Math.random() < 0.4) {
        const d = Math.hypot(s.decoy.x - k.x, s.decoy.y - k.y);
        if (d < td) { td = d; target = { x: s.decoy.x, y: s.decoy.y, isDecoy: true, real: s }; }
        continue;
      }
      const d = Math.hypot(s.x - k.x, s.y - k.y);
      if (d < td) { td = d; target = s; }
    }

    this.repathTimer -= dt;
    if (target && (this.repathTimer <= 0 || this.path.length === 0)) {
      this.repathTimer = 0.5;
      const gx = target.x || target.real?.x;
      const gy = target.y || target.real?.y;
      this.path = this.pf.findPath(k.x, k.y, gx, gy);
      this.pathIdx = 0;
    }

    if (this.path.length > 0 && this.pathIdx < this.path.length) {
      const node = this.path[this.pathIdx];
      const dx = node.x - k.x, dy = node.y - k.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 14) this.pathIdx++;
      else {
        k.angle = Math.atan2(dy, dx);
        const spd = k.getMoveSpeed() * 1.15;
        k.x += Math.cos(k.angle) * spd;
        k.y += Math.sin(k.angle) * spd;
        resolveWallCollision(k, game.map.walls);
      }
    }

    if (target && !target.isDecoy) {
      const real = target;
      const d = Math.hypot(real.x - k.x, real.y - k.y);
      if (d < k.attackRange + real.radius) k.basicAttack(game.survivors, game.map);
      if (d < 130 && k.cd1 <= 0 && Math.random() < dt * 0.5) k.useAbility1(game);
      if (d < 100 && k.cd2 <= 0 && Math.random() < dt * 0.4) k.useAbility2(game);
      if (k.malice >= 100 && Math.random() < dt * 0.3) k.tryUltimate(game);
    }
  }
}
