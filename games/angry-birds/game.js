(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const levelLabel = document.getElementById('levelLabel');
  const scoreLabel = document.getElementById('scoreLabel');
  const birdsLeftEl = document.getElementById('birdsLeft');
  const messageEl = document.getElementById('message');
  const menuOverlay = document.getElementById('menuOverlay');
  const winOverlay = document.getElementById('winOverlay');
  const loseOverlay = document.getElementById('loseOverlay');
  const starsEl = document.getElementById('stars');
  const finalScoreEl = document.getElementById('finalScore');

  let W, H, dpr;
  const GRAVITY = 0.35;
  const FRICTION = 0.99;
  const AIR = 0.995;
  const REST = 0.35;
  const GROUND_Y = () => H * 0.78;

  // ─── helpers ───────────────────────────────────────────────
  function rand(a, b) { return a + Math.random() * (b - a); }
  function irand(a, b) { return (a + Math.random() * (b - a + 1)) | 0; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function showMsg(t, ms = 1800) {
    messageEl.textContent = t;
    messageEl.classList.add('show');
    clearTimeout(showMsg._t);
    showMsg._t = setTimeout(() => messageEl.classList.remove('show'), ms);
  }

  // ─── physics bodies ────────────────────────────────────────
  class Body {
    constructor(x, y, w, h, type, opts = {}) {
      this.x = x; this.y = y; this.w = w; this.h = h;
      this.type = type; // 'bird' | 'pig' | 'wood' | 'stone' | 'glass' | 'ground'
      this.vx = 0; this.vy = 0;
      this.angle = opts.angle || 0;
      this.omega = 0;
      this.alive = true;
      this.static = !!opts.static;
      this.hp = opts.hp ?? 1;
      this.maxHp = this.hp;
      this.color = opts.color || '#8B4513';
      this.radius = opts.radius || Math.min(w, h) / 2;
      this.isCircle = !!opts.circle;
      this.birdType = opts.birdType || 'red';
      this.launched = false;
      this.settled = false;
      this.scoreValue = opts.scoreValue || 0;
      this.mass = opts.mass || (this.isCircle ? this.radius * this.radius * 0.04 : w * h * 0.008);
      if (this.static) this.mass = 1e9;
    }
    get cx() { return this.x + (this.isCircle ? 0 : this.w / 2); }
    get cy() { return this.y + (this.isCircle ? 0 : this.h / 2); }
    bounds() {
      if (this.isCircle) return { l: this.x - this.radius, r: this.x + this.radius, t: this.y - this.radius, b: this.y + this.radius };
      return { l: this.x, r: this.x + this.w, t: this.y, b: this.y + this.h };
    }
  }

  // ─── game state ────────────────────────────────────────────
  let bodies = [];
  let particles = [];
  let level = 1;
  let score = 0;
  let birdsQueue = [];
  let currentBird = null;
  let sling = { x: 0, y: 0 };
  let dragging = false;
  let dragStart = null;
  let aim = { x: 0, y: 0 };
  let waitingSettle = false;
  let settleTimer = 0;
  let gameActive = false;
  let levelSeed = 1;
  let totalBirds = 3;
  let pigsLeft = 0;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sling.x = W * 0.18;
    sling.y = GROUND_Y() - 90;
  }
  addEventListener('resize', () => { resize(); if (gameActive) placeCurrentBird(); });
  resize();

  // ─── level generation (procedural) ─────────────────────────
  function mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function generateLevel(seed) {
    bodies = [];
    particles = [];
    levelSeed = seed;
    const rng = mulberry32(seed);
    const r = (a, b) => a + rng() * (b - a);
    const ri = (a, b) => (a + rng() * (b - a + 1)) | 0;

    // ground
    bodies.push(new Body(0, GROUND_Y(), W, H - GROUND_Y() + 50, 'ground', { static: true, color: '#3d8b37' }));

    // difficulty scales with level
    const difficulty = 1 + Math.min(level * 0.12, 2.5);
    const structureCount = ri(1, 1 + Math.min(3, (level / 4) | 0));
    const baseX = W * 0.55;

    for (let s = 0; s < structureCount; s++) {
      const sx = baseX + s * (W * 0.22) + r(-30, 40);
      const floors = ri(1, 2 + Math.min(3, (level / 5) | 0));
      const width = ri(2, 3 + Math.min(2, (level / 6) | 0));
      const blockW = 28 + r(0, 12);
      const blockH = 22 + r(0, 10);

      for (let f = 0; f < floors; f++) {
        const y = GROUND_Y() - (f + 1) * (blockH + 4) - 2;
        // horizontal platform
        for (let i = 0; i < width; i++) {
          const mat = pickMaterial(rng, difficulty);
          const bx = sx + i * (blockW + 2);
          bodies.push(new Body(bx, y, blockW, blockH, mat.type, {
            hp: mat.hp, color: mat.color, mass: mat.mass, scoreValue: mat.score
          }));
        }
        // vertical supports under next floor (except top)
        if (f < floors - 1) {
          for (let i = 0; i <= width; i += Math.max(1, width - 1)) {
            const mat = pickMaterial(rng, difficulty);
            const bx = sx + i * (blockW + 2) - 6;
            bodies.push(new Body(bx, y - blockH - 2, 14, blockH + 4, mat.type, {
              hp: mat.hp, color: mat.color, mass: mat.mass * 0.7, scoreValue: mat.score
            }));
          }
        }
        // pigs on some floors
        if (rng() < 0.55 + Math.min(0.3, level * 0.02) || f === floors - 1) {
          const pigX = sx + r(10, width * blockW - 30);
          const pigR = 16 + r(0, 6);
          bodies.push(new Body(pigX, y - pigR - 2, pigR * 2, pigR * 2, 'pig', {
            circle: true, radius: pigR, hp: 1 + (difficulty > 1.8 ? 1 : 0),
            color: '#4ade80', mass: 2.2, scoreValue: 5000
          }));
        }
      }

      // occasional tower on the side
      if (rng() < 0.4 && level > 2) {
        const tx = sx + width * (blockW + 2) + 20;
        const th = ri(2, 4);
        for (let t = 0; t < th; t++) {
          const mat = pickMaterial(rng, difficulty);
          bodies.push(new Body(tx, GROUND_Y() - (t + 1) * 30, 22, 26, mat.type, {
            hp: mat.hp, color: mat.color, mass: mat.mass, scoreValue: mat.score
          }));
        }
        if (rng() < 0.7) {
          bodies.push(new Body(tx + 2, GROUND_Y() - th * 30 - 18, 18, 18, 'pig', {
            circle: true, radius: 14, hp: 1, color: '#4ade80', mass: 2, scoreValue: 5000
          }));
        }
      }
    }

    // extra floating pigs / small piles for variety
    if (level > 3 && rng() < 0.5) {
      const px = W * 0.7 + r(-80, 120);
      bodies.push(new Body(px, GROUND_Y() - 20, 18, 18, 'pig', {
        circle: true, radius: 14, hp: 1, color: '#4ade80', mass: 2, scoreValue: 5000
      }));
    }

    // birds
    totalBirds = clamp(3 + (level / 4 | 0), 3, 6);
    birdsQueue = [];
    for (let i = 0; i < totalBirds; i++) {
      const types = ['red', 'red', 'yellow', 'blue'];
      const t = types[ri(0, Math.min(3, 1 + (level / 5 | 0)))];
      birdsQueue.push(t);
    }
    currentBird = null;
    pigsLeft = bodies.filter(b => b.type === 'pig' && b.alive).length;
    waitingSettle = false;
    settleTimer = 0;
    placeCurrentBird();
    updateUI();
  }

  function pickMaterial(rng, difficulty) {
    const roll = rng();
    if (roll < 0.45 - difficulty * 0.05) return { type: 'wood', hp: 25, color: '#b5651d', mass: 3.5, score: 500 };
    if (roll < 0.75) return { type: 'stone', hp: 55 + difficulty * 8, color: '#94a3b8', mass: 7, score: 800 };
    return { type: 'glass', hp: 12, color: '#7dd3fc', mass: 1.8, score: 300 };
  }

  function placeCurrentBird() {
    if (birdsQueue.length === 0) {
      currentBird = null;
      return;
    }
    const type = birdsQueue.shift();
    const r = type === 'blue' ? 12 : type === 'yellow' ? 14 : 16;
    currentBird = new Body(sling.x, sling.y, r * 2, r * 2, 'bird', {
      circle: true, radius: r, birdType: type,
      color: type === 'yellow' ? '#facc15' : type === 'blue' ? '#38bdf8' : '#ef4444',
      mass: type === 'yellow' ? 2.8 : type === 'blue' ? 1.6 : 2.2
    });
    bodies.push(currentBird);
    updateUI();
  }

  // ─── input ─────────────────────────────────────────────────
  function getPos(e) {
    if (e.touches) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }

  function onDown(e) {
    if (!gameActive || !currentBird || currentBird.launched) return;
    e.preventDefault();
    const p = getPos(e);
    if (dist(p, { x: currentBird.x, y: currentBird.y }) < 80) {
      dragging = true;
      dragStart = p;
    }
  }
  function onMove(e) {
    if (!dragging || !currentBird) return;
    e.preventDefault();
    const p = getPos(e);
    const maxPull = 110;
    let dx = p.x - sling.x;
    let dy = p.y - sling.y;
    const d = Math.hypot(dx, dy);
    if (d > maxPull) { dx = dx / d * maxPull; dy = dy / d * maxPull; }
    // only pull backward-ish
    if (dx > 20) dx = 20;
    currentBird.x = sling.x + dx;
    currentBird.y = sling.y + dy;
    aim.x = dx; aim.y = dy;
  }
  function onUp(e) {
    if (!dragging || !currentBird) return;
    e.preventDefault();
    dragging = false;
    const power = Math.hypot(aim.x, aim.y);
    if (power < 18) {
      // snap back
      currentBird.x = sling.x;
      currentBird.y = sling.y;
      return;
    }
    const mult = currentBird.birdType === 'yellow' ? 0.28 : 0.22;
    currentBird.vx = -aim.x * mult;
    currentBird.vy = -aim.y * mult;
    currentBird.launched = true;
    waitingSettle = true;
    settleTimer = 0;
    // blue bird: split into 3 after short delay
    if (currentBird.birdType === 'blue') {
      setTimeout(() => {
        if (!currentBird || !currentBird.alive) return;
        const b = currentBird;
        for (let i = -1; i <= 1; i++) {
          if (i === 0) continue;
          const clone = new Body(b.x, b.y, b.radius * 2, b.radius * 2, 'bird', {
            circle: true, radius: b.radius * 0.85, birdType: 'blue',
            color: '#38bdf8', mass: 1.4
          });
          clone.vx = b.vx + i * 3.5;
          clone.vy = b.vy + (Math.random() - 0.5) * 2;
          clone.launched = true;
          bodies.push(clone);
        }
        b.radius *= 0.85;
      }, 280);
    }
  }

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseup', onUp);
  canvas.addEventListener('mouseleave', onUp);
  canvas.addEventListener('touchstart', onDown, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', onUp);

  // ─── physics ───────────────────────────────────────────────
  function stepPhysics() {
    const gy = GROUND_Y();
    for (const b of bodies) {
      if (!b.alive || b.static) continue;
      if (b.type === 'bird' && !b.launched) continue;

      b.vy += GRAVITY;
      b.vx *= AIR;
      b.vy *= AIR;
      b.x += b.vx;
      b.y += b.vy;
      b.angle += b.omega;
      b.omega *= 0.98;

      // ground collision
      const bottom = b.isCircle ? b.y + b.radius : b.y + b.h;
      if (bottom > gy) {
        if (b.isCircle) b.y = gy - b.radius;
        else b.y = gy - b.h;
        if (Math.abs(b.vy) > 2) {
          damage(b, Math.abs(b.vy) * 2.5);
          spawnDust(b.cx, gy, 4);
        }
        b.vy *= -REST;
        b.vx *= 0.85;
        b.omega *= 0.6;
        if (Math.abs(b.vy) < 0.8) b.vy = 0;
        if (Math.abs(b.vx) < 0.3) b.vx = 0;
      }

      // walls
      if (b.x < -100 || b.x > W + 100 || b.y > H + 100) {
        if (b.type === 'bird' || b.type === 'pig') b.alive = false;
      }
    }

    // pairwise collisions (simple circle-circle + AABB)
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      if (!a.alive || a.static) continue;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        if (!b.alive) continue;
        resolve(a, b);
      }
    }

    // cleanup dead
    bodies = bodies.filter(b => b.alive);
  }

  function resolve(a, b) {
    if (a.isCircle && b.isCircle) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const minD = a.radius + b.radius;
      if (d >= minD) return;
      const overlap = minD - d;
      const nx = dx / d, ny = dy / d;
      const totalMass = a.mass + b.mass;
      if (!a.static) { a.x -= nx * overlap * (b.mass / totalMass); a.y -= ny * overlap * (b.mass / totalMass); }
      if (!b.static) { b.x += nx * overlap * (a.mass / totalMass); b.y += ny * overlap * (a.mass / totalMass); }
      const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
      const velAlong = rvx * nx + rvy * ny;
      if (velAlong > 0) return;
      const e = 0.4;
      const j = -(1 + e) * velAlong / (1 / a.mass + 1 / b.mass);
      const ix = j * nx, iy = j * ny;
      if (!a.static) { a.vx -= ix / a.mass; a.vy -= iy / a.mass; }
      if (!b.static) { b.vx += ix / b.mass; b.vy += iy / b.mass; }
      const impact = Math.abs(j);
      if (impact > 4) {
        damage(a, impact * 1.8);
        damage(b, impact * 1.8);
        spawnDust((a.x + b.x) / 2, (a.y + b.y) / 2, 3);
      }
      return;
    }

    // circle vs AABB
    const circle = a.isCircle ? a : b;
    const box = a.isCircle ? b : a;
    if (!circle.isCircle || box.isCircle) {
      // both AABB
      const ab = a.bounds(), bb = b.bounds();
      if (ab.r < bb.l || ab.l > bb.r || ab.b < bb.t || ab.t > bb.b) return;
      const ox = Math.min(ab.r - bb.l, bb.r - ab.l);
      const oy = Math.min(ab.b - bb.t, bb.b - ab.t);
      let nx = 0, ny = 0;
      if (ox < oy) nx = (a.cx < b.cx) ? -1 : 1;
      else ny = (a.cy < b.cy) ? -1 : 1;
      const totalMass = a.mass + b.mass;
      if (!a.static) { a.x += nx * ox * 0.5 * (b.mass / totalMass); a.y += ny * oy * 0.5 * (b.mass / totalMass); }
      if (!b.static) { b.x -= nx * ox * 0.5 * (a.mass / totalMass); b.y -= ny * oy * 0.5 * (a.mass / totalMass); }
      const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
      const velAlong = rvx * nx + rvy * ny;
      if (velAlong > 0) return;
      const j = -(1 + 0.35) * velAlong / (1 / a.mass + 1 / b.mass);
      if (!a.static) { a.vx -= j * nx / a.mass; a.vy -= j * ny / a.mass; }
      if (!b.static) { b.vx += j * nx / b.mass; b.vy += j * ny / b.mass; }
      const impact = Math.abs(j);
      if (impact > 5) {
        damage(a, impact * 1.5);
        damage(b, impact * 1.5);
      }
      return;
    }

    // circle-AABB
    const closestX = clamp(circle.x, box.x, box.x + box.w);
    const closestY = clamp(circle.y, box.y, box.y + box.h);
    const dx = circle.x - closestX, dy = circle.y - closestY;
    const d = Math.hypot(dx, dy);
    if (d >= circle.radius || d < 0.001) return;
    const nx = dx / d, ny = dy / d;
    const overlap = circle.radius - d;
    if (!circle.static) { circle.x += nx * overlap; circle.y += ny * overlap; }
    if (!box.static) { box.x -= nx * overlap * 0.3; box.y -= ny * overlap * 0.3; }
    const rvx = circle.vx - box.vx, rvy = circle.vy - box.vy;
    const velAlong = rvx * nx + rvy * ny;
    if (velAlong > 0) {
      // already separating
    } else {
      const j = -(1 + 0.4) * velAlong / (1 / circle.mass + 1 / box.mass);
      if (!circle.static) { circle.vx += j * nx / circle.mass; circle.vy += j * ny / circle.mass; }
      if (!box.static) { box.vx -= j * nx / box.mass; box.vy -= j * ny / box.mass; }
      const impact = Math.abs(j);
      if (impact > 3.5) {
        damage(circle, impact * 1.2);
        damage(box, impact * 2.2);
        spawnDust(closestX, closestY, 4);
      }
    }
  }

  function damage(b, amount) {
    if (b.static || b.type === 'bird') return;
    b.hp -= amount;
    if (b.hp <= 0) {
      b.alive = false;
      score += b.scoreValue || 0;
      if (b.type === 'pig') {
        pigsLeft = bodies.filter(x => x.type === 'pig' && x.alive && x !== b).length;
        spawnBurst(b.x, b.y, '#4ade80', 12);
        showMsg('Pig down! +' + (b.scoreValue || 5000));
      } else {
        spawnDust(b.cx, b.cy, 8);
      }
      updateUI();
    }
  }

  function spawnDust(x, y, n) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x, y, vx: rand(-3, 3), vy: rand(-4, -1),
        life: 20 + rand(0, 20), max: 40, color: '#d4a574', size: rand(2, 5)
      });
    }
  }
  function spawnBurst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(2, 6);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 25 + rand(0, 25), max: 50, color, size: rand(3, 7)
      });
    }
  }

  // ─── settle / win-lose check ───────────────────────────────
  function checkSettle() {
    if (!waitingSettle) return;
    settleTimer++;
    let moving = false;
    for (const b of bodies) {
      if (!b.alive || b.static) continue;
      if (b.type === 'bird' && !b.launched) continue;
      if (Math.abs(b.vx) > 0.6 || Math.abs(b.vy) > 0.6) { moving = true; break; }
    }
    if (!moving && settleTimer > 45) {
      waitingSettle = false;
      // remove spent birds that are almost stopped
      bodies.forEach(b => {
        if (b.type === 'bird' && b.launched && Math.hypot(b.vx, b.vy) < 1) b.alive = false;
      });
      bodies = bodies.filter(b => b.alive);
      pigsLeft = bodies.filter(b => b.type === 'pig' && b.alive).length;
      if (pigsLeft <= 0) {
        endLevel(true);
        return;
      }
      if (birdsQueue.length === 0 && !currentBird) {
        // last bird already used
        endLevel(false);
        return;
      }
      if (!currentBird || currentBird.launched) placeCurrentBird();
      if (!currentBird && birdsQueue.length === 0) endLevel(false);
    }
    // safety timeout
    if (settleTimer > 240) {
      waitingSettle = false;
      if (pigsLeft <= 0) endLevel(true);
      else if (birdsQueue.length === 0 && (!currentBird || currentBird.launched)) endLevel(false);
      else placeCurrentBird();
    }
  }

  function endLevel(won) {
    gameActive = false;
    if (won) {
      // bonus for unused birds
      const bonus = birdsQueue.length * 10000 + (currentBird && !currentBird.launched ? 10000 : 0);
      score += bonus;
      const stars = score > 40000 ? 3 : score > 20000 ? 2 : 1;
      starsEl.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
      finalScoreEl.textContent = 'Score: ' + score.toLocaleString();
      winOverlay.classList.remove('hidden');
    } else {
      loseOverlay.classList.remove('hidden');
    }
    updateUI();
  }

  function updateUI() {
    levelLabel.textContent = 'Level ' + level;
    scoreLabel.textContent = 'Score: ' + score.toLocaleString();
    const left = birdsQueue.length + (currentBird && !currentBird.launched ? 1 : 0);
    birdsLeftEl.textContent = '🐦 x ' + left;
  }

  // ─── render ────────────────────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // sky already via CSS; draw clouds
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    drawCloud(W * 0.2, 80, 60);
    drawCloud(W * 0.55, 50, 80);
    drawCloud(W * 0.85, 100, 50);

    // ground detail
    const gy = GROUND_Y();
    ctx.fillStyle = '#2d6a27';
    ctx.fillRect(0, gy, W, H - gy);
    ctx.fillStyle = '#3d8b37';
    for (let i = 0; i < W; i += 18) {
      ctx.beginPath();
      ctx.moveTo(i, gy);
      ctx.lineTo(i + 9, gy - 6 - (i % 5));
      ctx.lineTo(i + 18, gy);
      ctx.fill();
    }

    // slingshot
    drawSling();

    // trajectory preview
    if (dragging && currentBird && !currentBird.launched) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      let px = currentBird.x, py = currentBird.y;
      let pvx = -aim.x * (currentBird.birdType === 'yellow' ? 0.28 : 0.22);
      let pvy = -aim.y * (currentBird.birdType === 'yellow' ? 0.28 : 0.22);
      ctx.moveTo(px, py);
      for (let i = 0; i < 40; i++) {
        pvy += GRAVITY;
        px += pvx; py += pvy;
        pvx *= AIR; pvy *= AIR;
        ctx.lineTo(px, py);
        if (py > gy) break;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // bodies
    for (const b of bodies) {
      if (!b.alive) continue;
      if (b.type === 'ground') continue;
      ctx.save();
      if (b.isCircle) {
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        if (b.type === 'bird') drawBird(b);
        else if (b.type === 'pig') drawPig(b);
      } else {
        ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
        ctx.rotate(b.angle);
        drawBlock(b);
      }
      ctx.restore();
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      if (p.life <= 0) particles.splice(i, 1);
    }
    ctx.globalAlpha = 1;

    // remaining birds icons
    const left = birdsQueue.length;
    for (let i = 0; i < left; i++) {
      const t = birdsQueue[i];
      const col = t === 'yellow' ? '#facc15' : t === 'blue' ? '#38bdf8' : '#ef4444';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(30 + i * 28, H - 30, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawCloud(x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
    ctx.arc(x + s * 0.4, y - s * 0.15, s * 0.4, 0, Math.PI * 2);
    ctx.arc(x + s * 0.8, y, s * 0.45, 0, Math.PI * 2);
    ctx.arc(x + s * 0.35, y + s * 0.15, s * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSling() {
    const baseY = GROUND_Y();
    // posts
    ctx.strokeStyle = '#5c3317';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sling.x - 18, baseY);
    ctx.lineTo(sling.x - 12, sling.y + 10);
    ctx.moveTo(sling.x + 18, baseY);
    ctx.lineTo(sling.x + 12, sling.y + 10);
    ctx.stroke();
    // band
    if (currentBird && !currentBird.launched) {
      ctx.strokeStyle = '#4a2c0a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sling.x - 12, sling.y + 10);
      ctx.lineTo(currentBird.x, currentBird.y);
      ctx.lineTo(sling.x + 12, sling.y + 10);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#4a2c0a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sling.x - 12, sling.y + 10);
      ctx.lineTo(sling.x + 12, sling.y + 10);
      ctx.stroke();
    }
  }

  function drawBird(b) {
    const r = b.radius;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    // belly
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.25, r * 0.55, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.2, r * 0.28, 0, Math.PI * 2);
    ctx.arc(r * 0.25, -r * 0.2, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-r * 0.25, -r * 0.18, r * 0.12, 0, Math.PI * 2);
    ctx.arc(r * 0.3, -r * 0.18, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    // beak
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(r * 0.15, r * 0.05);
    ctx.lineTo(r * 0.7, r * 0.15);
    ctx.lineTo(r * 0.15, r * 0.3);
    ctx.closePath();
    ctx.fill();
    // brows (angry)
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, -r * 0.45);
    ctx.lineTo(-r * 0.1, -r * 0.35);
    ctx.moveTo(r * 0.55, -r * 0.45);
    ctx.lineTo(r * 0.1, -r * 0.35);
    ctx.stroke();
  }

  function drawPig(b) {
    const r = b.radius;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    // ears
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.ellipse(-r * 0.55, -r * 0.55, r * 0.28, r * 0.22, -0.5, 0, Math.PI * 2);
    ctx.ellipse(r * 0.55, -r * 0.55, r * 0.28, r * 0.22, 0.5, 0, Math.PI * 2);
    ctx.fill();
    // snout
    ctx.fillStyle = '#86efac';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.25, r * 0.45, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.arc(-r * 0.15, r * 0.25, r * 0.1, 0, Math.PI * 2);
    ctx.arc(r * 0.15, r * 0.25, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    // eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.15, r * 0.22, 0, Math.PI * 2);
    ctx.arc(r * 0.3, -r * 0.15, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.12, r * 0.1, 0, Math.PI * 2);
    ctx.arc(r * 0.32, -r * 0.12, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBlock(b) {
    const hw = b.w / 2, hh = b.h / 2;
    const hpRatio = b.hp / b.maxHp;
    ctx.fillStyle = b.color;
    ctx.fillRect(-hw, -hh, b.w, b.h);
    // edge
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-hw, -hh, b.w, b.h);
    // cracks when damaged
    if (hpRatio < 0.7) {
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-hw * 0.6, -hh * 0.3);
      ctx.lineTo(hw * 0.2, hh * 0.4);
      if (hpRatio < 0.4) {
        ctx.moveTo(hw * 0.5, -hh * 0.5);
        ctx.lineTo(-hw * 0.3, hh * 0.6);
      }
      ctx.stroke();
    }
    // material hint
    if (b.type === 'glass') {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(-hw + 3, -hh + 3, b.w * 0.35, b.h * 0.25);
    } else if (b.type === 'wood') {
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.moveTo(-hw, 0);
      ctx.lineTo(hw, 0);
      ctx.stroke();
    }
  }

  // ─── loop ──────────────────────────────────────────────────
  function loop() {
    if (gameActive) {
      stepPhysics();
      checkSettle();
    }
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ─── UI buttons ────────────────────────────────────────────
  function startLevel(seed) {
    menuOverlay.classList.add('hidden');
    winOverlay.classList.add('hidden');
    loseOverlay.classList.add('hidden');
    score = 0;
    generateLevel(seed || (level * 7919 + 42));
    gameActive = true;
    showMsg('Level ' + level);
  }

  document.getElementById('btnPlay').onclick = () => { level = 1; startLevel(1); };
  document.getElementById('btnRandom').onclick = () => {
    level = irand(1, 99);
    startLevel((Math.random() * 1e9) | 0);
  };
  document.getElementById('btnNext').onclick = () => {
    level++;
    startLevel(level * 7919 + 42);
  };
  document.getElementById('btnContinue').onclick = () => {
    level++;
    startLevel(level * 7919 + 42);
  };
  document.getElementById('btnReplay').onclick = () => startLevel(levelSeed);
  document.getElementById('btnRetry').onclick = () => startLevel(levelSeed);
  document.getElementById('btnNewRandom').onclick = () => {
    level = irand(1, 99);
    startLevel((Math.random() * 1e9) | 0);
  };
  document.getElementById('btnMenu').onclick = () => {
    gameActive = false;
    menuOverlay.classList.remove('hidden');
    winOverlay.classList.add('hidden');
    loseOverlay.classList.add('hidden');
  };

  // show menu on load
  menuOverlay.classList.remove('hidden');
})();
