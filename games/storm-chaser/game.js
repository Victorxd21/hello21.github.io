import * as THREE from 'three';

(function () {
  'use strict';

  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x0a1020);
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a2030, 0.0018);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 4000);
  let camMode = 0;

  scene.add(new THREE.AmbientLight(0x6688aa, 0.55));
  const sun = new THREE.DirectionalLight(0xffe6c0, 0.85);
  sun.position.set(200, 400, 100);
  scene.add(sun);
  const stormLight = new THREE.PointLight(0x8866ff, 0, 400);
  scene.add(stormLight);

  const groundSize = 4000;
  const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, 32, 32);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, Math.sin(x * 0.01) * Math.cos(y * 0.008) * 4);
  }
  pos.needsUpdate = true;
  groundGeo.computeVertexNormals();

  function makeGroundTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#1a2a1a';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = 'rgb(' + (20 + Math.random() * 30) + ',' + (40 + Math.random() * 40) + ',' + (18 + Math.random() * 20) + ')';
      g.fillRect(Math.random() * 512, Math.random() * 512, 40 + Math.random() * 80, 40 + Math.random() * 80);
    }
    g.strokeStyle = '#2a2a2a';
    g.lineWidth = 6;
    for (let i = 0; i < 8; i++) {
      g.beginPath(); g.moveTo(0, i * 64 + 32); g.lineTo(512, i * 64 + 32); g.stroke();
      g.beginPath(); g.moveTo(i * 64 + 32, 0); g.lineTo(i * 64 + 32, 512); g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(40, 40);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ map: makeGroundTexture() }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const car = new THREE.Group();
  function addBox(w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, y, z);
    car.add(m);
    return m;
  }
  addBox(2.2, 0.55, 4.2, 0xff6b1a, 0, 0.55, 0);
  addBox(1.8, 0.7, 2.0, 0x1a1a22, 0, 1.15, -0.2);
  addBox(1.6, 0.5, 0.1, 0x88ccee, 0, 1.2, 0.85);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  [[-1.1, 0.35, 1.3], [1.1, 0.35, 1.3], [-1.1, 0.35, -1.3], [1.1, 0.35, -1.3]].forEach(function (p) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.35, 10), wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(p[0], p[1], p[2]);
    car.add(w);
  });
  const headL = new THREE.PointLight(0xfff0c0, 0.8, 40);
  headL.position.set(-0.6, 0.6, 2.2);
  car.add(headL);
  const headR = headL.clone();
  headR.position.x = 0.6;
  car.add(headR);
  const roof = new THREE.PointLight(0x4488ff, 0.5, 20);
  roof.position.set(0, 1.8, 0);
  car.add(roof);
  scene.add(car);

  const clouds = [];
  const cloudGroup = new THREE.Group();
  scene.add(cloudGroup);
  let cloudsOn = true;

  function makeCloud() {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({
      color: 0xdde6f0, transparent: true,
      opacity: 0.55 + Math.random() * 0.25, depthWrite: false
    });
    const n = 4 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const s = 12 + Math.random() * 28;
      const m = new THREE.Mesh(new THREE.SphereGeometry(s, 6, 5), mat);
      m.position.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 30);
      m.scale.y = 0.45 + Math.random() * 0.3;
      g.add(m);
    }
    g.position.set((Math.random() - 0.5) * 2800, 80 + Math.random() * 120, (Math.random() - 0.5) * 2800);
    g.userData.vx = 4 + Math.random() * 12;
    g.userData.vz = (Math.random() - 0.5) * 6;
    g.userData.spin = (Math.random() - 0.5) * 0.05;
    cloudGroup.add(g);
    clouds.push(g);
  }
  for (let i = 0; i < 28; i++) makeCloud();

  const storms = [];
  const stormGroup = new THREE.Group();
  scene.add(stormGroup);
  let stormsOn = true;

  function addStorm(x, z, r, name, pts) {
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, 60, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
    );
    cyl.position.set(x, 30, z);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.9, r, 32),
      new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 1.5, z);
    stormGroup.add(cyl);
    stormGroup.add(ring);
    storms.push({ x: x, z: z, r: r, name: name, pts: pts });
  }

  [
    [80, -40, 55, 'Plains Cell', 10],
    [-120, 90, 45, 'Front Line', 9],
    [200, 150, 70, 'Supercell', 14],
    [-200, -100, 50, 'Shelf Cloud', 11],
    [0, 220, 60, 'Wall Cloud', 12],
    [300, -200, 80, 'MCS', 13],
    [-280, 250, 40, 'Gust Front', 8],
    [150, 300, 55, 'Squall', 10]
  ].forEach(function (s) { addStorm(s[0], s[1], s[2], s[3], s[4]); });

  const bolts = [];
  const boltGroup = new THREE.Group();
  scene.add(boltGroup);

  function spawnBolt() {
    let x, z;
    if (storms.length && Math.random() < 0.7) {
      const s = storms[Math.floor(Math.random() * storms.length)];
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * s.r;
      x = s.x + Math.cos(a) * d;
      z = s.z + Math.sin(a) * d;
    } else {
      x = car.position.x + (Math.random() - 0.5) * 400;
      z = car.position.z + (Math.random() - 0.5) * 400;
    }
    const points = [];
    let px = x, py = 120 + Math.random() * 40, pz = z;
    points.push(new THREE.Vector3(px, py, pz));
    while (py > 2) {
      px += (Math.random() - 0.5) * 12;
      pz += (Math.random() - 0.5) * 12;
      py -= 8 + Math.random() * 15;
      points.push(new THREE.Vector3(px, Math.max(2, py), pz));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xc4b5fd }));
    boltGroup.add(line);
    const flash = new THREE.PointLight(0xddbbff, 3, 200);
    flash.position.set(x, 40, z);
    scene.add(flash);
    bolts.push({ line: line, flash: flash, t: performance.now(), x: x, z: z, scored: false });
    stormLight.intensity = 2;
    setTimeout(function () { stormLight.intensity = 0; }, 120);
  }

  let playing = false;
  let heading = 0;
  let speed = 0;
  let fuel = 100, armor = 100, score = 0, boltHits = 0;
  const keys = { up: false, down: false, left: false, right: false };
  let stormScoreAcc = 0;

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._id);
    toast._id = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function setStat(id, val, cls) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = typeof val === 'number' ? Math.round(val) : val;
    const p = el.parentElement;
    if (p) {
      p.classList.remove('warn', 'danger', 'good');
      if (cls) p.classList.add(cls);
    }
  }

  function bindKey(code, down) {
    if (code === 'ArrowUp' || code === 'KeyW') keys.up = down;
    if (code === 'ArrowDown' || code === 'KeyS') keys.down = down;
    if (code === 'ArrowLeft' || code === 'KeyA') keys.left = down;
    if (code === 'ArrowRight' || code === 'KeyD') keys.right = down;
  }
  window.addEventListener('keydown', function (e) {
    bindKey(e.code, true);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }, { passive: false });
  window.addEventListener('keyup', function (e) { bindKey(e.code, false); });

  document.querySelectorAll('#dpad button').forEach(function (btn) {
    const k = btn.getAttribute('data-k');
    const set = function (v) { keys[k] = v; };
    btn.addEventListener('pointerdown', function (e) { e.preventDefault(); set(true); btn.setPointerCapture(e.pointerId); });
    btn.addEventListener('pointerup', function () { set(false); });
    btn.addEventListener('pointercancel', function () { set(false); });
  });

  document.getElementById('btnClouds').onclick = function () {
    cloudsOn = !cloudsOn;
    cloudGroup.visible = cloudsOn;
    document.getElementById('btnClouds').classList.toggle('on', cloudsOn);
  };
  document.getElementById('btnStorms').onclick = function () {
    stormsOn = !stormsOn;
    stormGroup.visible = stormsOn;
    document.getElementById('btnStorms').classList.toggle('on', stormsOn);
  };
  document.getElementById('btnCam').onclick = function () {
    camMode = (camMode + 1) % 3;
    toast(camMode === 0 ? 'Camera: Chase' : camMode === 1 ? 'Camera: High' : 'Camera: Hood');
  };
  document.getElementById('btnChase').onclick = function () {
    if (!storms.length) return;
    let best = storms[0], bestD = Infinity;
    storms.forEach(function (s) {
      const d = Math.hypot(s.x - car.position.x, s.z - car.position.z);
      if (d < bestD) { bestD = d; best = s; }
    });
    heading = Math.atan2(best.x - car.position.x, best.z - car.position.z);
    toast('Tracking: ' + best.name);
  };
  document.getElementById('back').onclick = function () {
    const u = new URL(location.href);
    let p = u.pathname.replace(/\/games\/storm-chaser\/?.*$/i, '/');
    if (!p.endsWith('/')) p += '/';
    location.href = u.origin + p;
  };

  function startGame() {
    document.getElementById('overlay').classList.add('hide');
    score = 0; fuel = 100; armor = 100; boltHits = 0; speed = 0; stormScoreAcc = 0;
    car.position.set(0, 0, 0);
    heading = 0;
    playing = true;
    toast('Chase on — head for orange storm cells');
  }
  document.getElementById('btnStart').onclick = startGame;

  const mm = document.getElementById('mm');
  const mmCtx = mm.getContext('2d');
  function resizeMini() {
    const r = mm.parentElement.getBoundingClientRect();
    mm.width = r.width * (window.devicePixelRatio || 1);
    mm.height = r.height * (window.devicePixelRatio || 1);
  }
  resizeMini();

  function drawMini() {
    const w = mm.width, h = mm.height;
    mmCtx.fillStyle = '#0c1420';
    mmCtx.fillRect(0, 0, w, h);
    const scale = w / 600;
    const cx = car.position.x, cz = car.position.z;
    storms.forEach(function (s) {
      const x = w / 2 + (s.x - cx) * scale;
      const y = h / 2 + (s.z - cz) * scale;
      mmCtx.fillStyle = 'rgba(249,115,22,0.35)';
      mmCtx.beginPath();
      mmCtx.arc(x, y, s.r * scale, 0, Math.PI * 2);
      mmCtx.fill();
    });
    mmCtx.fillStyle = '#38bdf8';
    mmCtx.beginPath();
    mmCtx.arc(w / 2, h / 2, 4, 0, Math.PI * 2);
    mmCtx.fill();
  }

  let last = performance.now();
  let boltTimer = 0;
  let lastHud = 0;

  function updateCamera() {
    const px = car.position.x, pz = car.position.z;
    if (camMode === 0) {
      const back = 14, up = 7;
      const cx = px - Math.sin(heading) * back;
      const cz = pz - Math.cos(heading) * back;
      camera.position.lerp(new THREE.Vector3(cx, up, cz), 0.08);
      camera.lookAt(px, 1.5, pz);
    } else if (camMode === 1) {
      camera.position.lerp(new THREE.Vector3(px, 80, pz + 40), 0.06);
      camera.lookAt(px, 0, pz);
    } else {
      const fx = px + Math.sin(heading) * 2;
      const fz = pz + Math.cos(heading) * 2;
      camera.position.set(px, 1.6, pz);
      camera.lookAt(fx, 1.4, fz);
    }
  }

  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (playing) {
      if (keys.left) heading += 1.8 * dt;
      if (keys.right) heading -= 1.8 * dt;
      if (keys.up) speed = Math.min(1, speed + 1.1 * dt);
      else if (keys.down) speed = Math.max(0, speed - 1.4 * dt);
      else speed = Math.max(0, speed - 0.35 * dt);

      if (speed > 0.02 && fuel > 0) {
        const v = speed * 55;
        car.position.x += Math.sin(heading) * v * dt;
        car.position.z += Math.cos(heading) * v * dt;
        fuel = Math.max(0, fuel - speed * 2.0 * dt);
      } else if (speed < 0.05) {
        fuel = Math.min(100, fuel + 2.5 * dt);
      }
      car.rotation.y = heading;
      car.rotation.z = (keys.left ? 0.08 : 0) + (keys.right ? -0.08 : 0);

      let intensity = 0;
      if (stormsOn) {
        for (let i = 0; i < storms.length; i++) {
          const s = storms[i];
          const d = Math.hypot(s.x - car.position.x, s.z - car.position.z);
          if (d < s.r) {
            const local = 1 - d / s.r;
            intensity = Math.max(intensity, local);
            stormScoreAcc += local * s.pts * dt;
            if (stormScoreAcc > 1) {
              score += Math.floor(stormScoreAcc);
              stormScoreAcc -= Math.floor(stormScoreAcc);
            }
            if (local > 0.65) armor = Math.max(0, armor - 7 * local * dt);
          }
        }
      }

      boltTimer += dt;
      if (boltTimer > 1.2 + Math.random()) {
        boltTimer = 0;
        spawnBolt();
      }

      const tnow = performance.now();
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        if (tnow - b.t > 900) {
          boltGroup.remove(b.line);
          scene.remove(b.flash);
          b.line.geometry.dispose();
          bolts.splice(i, 1);
          continue;
        }
        b.flash.intensity = Math.max(0, 3 * (1 - (tnow - b.t) / 900));
        const d = Math.hypot(b.x - car.position.x, b.z - car.position.z);
        if (d < 35 && !b.scored) {
          b.scored = true;
          const pts = d < 12 ? 25 : d < 22 ? 12 : 5;
          score += pts;
          boltHits++;
          toast('⚡ Lightning +' + pts);
        }
      }

      if (now - lastHud > 100) {
        lastHud = now;
        setStat('score', score, 'good');
        setStat('spd', speed * 160, speed > 0.85 ? 'warn' : '');
        setStat('fuel', fuel, fuel < 25 ? 'danger' : fuel < 50 ? 'warn' : '');
        setStat('armor', armor, armor < 30 ? 'danger' : armor < 60 ? 'warn' : 'good');
        setStat('stormLvl', intensity * 100, intensity > 0.6 ? 'danger' : intensity > 0.2 ? 'warn' : '');
        setStat('bolts', boltHits);
        document.getElementById('throttleFill').style.width = (speed * 100) + '%';
      }

      if (armor <= 0) {
        playing = false;
        document.getElementById('overlay').classList.remove('hide');
        document.querySelector('.card h1').textContent = 'Wrecked';
        document.querySelector('.card p').textContent = 'Armor gone. Score: ' + score + ' · Bolts: ' + boltHits;
        document.getElementById('btnStart').textContent = 'Chase Again';
      }
    }

    if (cloudsOn) {
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        c.position.x += c.userData.vx * dt;
        c.position.z += c.userData.vz * dt;
        c.rotation.y += c.userData.spin * dt;
        if (c.position.x > 1600) c.position.x = -1600;
        if (c.position.x < -1600) c.position.x = 1600;
      }
    }

    updateCamera();
    drawMini();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    resizeMini();
  });

  camera.position.set(0, 12, 20);
  camera.lookAt(0, 0, 0);
  requestAnimationFrame(tick);
})();
