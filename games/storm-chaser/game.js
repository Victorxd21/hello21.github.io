(function () {
  'use strict';

  const QUALITY = {
    low:  { maxBolts: 40, boltFadeMs: 12000, radarOpacity: 0.45, tickMs: 50, animBolts: false },
    med:  { maxBolts: 80, boltFadeMs: 20000, radarOpacity: 0.55, tickMs: 33, animBolts: true },
    high: { maxBolts: 140, boltFadeMs: 30000, radarOpacity: 0.65, tickMs: 16, animBolts: true }
  };
  let qKey = 'med';
  try { qKey = localStorage.getItem('sc_quality') || 'med'; } catch (_) {}
  let Q = QUALITY[qKey] || QUALITY.med;

  const map = L.map('map', {
    zoomControl: true,
    attributionControl: true,
    preferCanvas: true,
    worldCopyJump: true,
    maxBounds: [[-85, -180], [85, 180]],
    maxBoundsViscosity: 0.8
  }).setView([35, -95], 5);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OSM © CARTO',
    subdomains: 'abcd',
    maxZoom: 18,
    updateWhenIdle: true,
    keepBuffer: 1
  }).addTo(map);

  let radarLayer = null;
  let radarOn = true;
  let boltsOn = true;
  let stormsOn = true;

  const boltLayer = L.layerGroup().addTo(map);
  const stormLayer = L.layerGroup().addTo(map);

  let lat = 35.2, lon = -97.4;
  let heading = 0;
  let speed = 0;
  let fuel = 100;
  let armor = 100;
  let score = 0;
  let boltHits = 0;
  let keys = { up: false, down: false, left: false, right: false };
  let playing = false;

  const carIcon = L.divIcon({
    className: '',
    html: '<div class="car-icon">🚗</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
  const car = L.marker([lat, lon], { icon: carIcon, zIndexOffset: 1000 }).addTo(map);

  let storms = [];
  let ws = null;
  const bolts = [];

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._id);
    toast._id = setTimeout(() => t.classList.remove('show'), 2800);
  }

  function setStat(id, val, cls) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(0)) : val;
    const p = el.parentElement;
    if (p) {
      p.classList.remove('warn', 'danger', 'good');
      if (cls) p.classList.add(cls);
    }
  }

  async function loadRadar() {
    if (!radarOn) return;
    try {
      const r = await fetch('https://api.rainviewer.com/public/weather-maps.json', { cache: 'no-store' });
      if (!r.ok) return;
      const data = await r.json();
      const frames = (data.radar && data.radar.past) || [];
      if (!frames.length) return;
      const frame = frames[frames.length - 1];
      const host = data.host || 'https://tilecache.rainviewer.com';
      const url = host + frame.path + '/256/{z}/{x}/{y}/2/1_1.png';
      if (radarLayer) map.removeLayer(radarLayer);
      radarLayer = L.tileLayer(url, {
        opacity: Q.radarOpacity,
        maxZoom: 12,
        maxNativeZoom: 7,
        updateWhenIdle: true,
        keepBuffer: 0
      }).addTo(map);
    } catch (e) {
      console.warn('radar', e);
    }
  }

  async function loadStorms() {
    if (!stormsOn) return;
    storms = [];
    stormLayer.clearLayers();
    try {
      const r = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=severeStorms,wildfires&limit=40', { cache: 'no-store' });
      if (r.ok) {
        const data = await r.json();
        (data.events || []).forEach(ev => {
          const geo = (ev.geometry || [])[(ev.geometry || []).length - 1];
          if (!geo || !geo.coordinates) return;
          let lo, la;
          if (geo.type === 'Point') { lo = geo.coordinates[0]; la = geo.coordinates[1]; }
          else if (Array.isArray(geo.coordinates[0])) { lo = geo.coordinates[0][0]; la = geo.coordinates[0][1]; }
          else return;
          if (!Number.isFinite(la) || !Number.isFinite(lo)) return;
          const name = ev.title || 'Storm';
          const radiusKm = name.toLowerCase().includes('hurricane') || name.toLowerCase().includes('typhoon') ? 180 : 60;
          storms.push({ lat: la, lon: lo, r: radiusKm, name, pts: 15 });
        });
      }
    } catch (e) { console.warn('eonet', e); }

    const seeds = [
      { lat: 35.5, lon: -97.5, r: 80, name: 'Plains Cell', pts: 10 },
      { lat: 32.8, lon: -96.8, r: 55, name: 'Dallas System', pts: 8 },
      { lat: 39.1, lon: -94.6, r: 70, name: 'KC Front', pts: 10 },
      { lat: 41.3, lon: -95.9, r: 65, name: 'Omaha Line', pts: 9 },
      { lat: 29.8, lon: -95.4, r: 90, name: 'Gulf Moisture', pts: 12 },
      { lat: 27.95, lon: -82.46, r: 100, name: 'Florida Tropics', pts: 14 },
      { lat: 30.0, lon: -90.1, r: 75, name: 'Gulf Coast', pts: 11 },
      { lat: 40.7, lon: -74.0, r: 40, name: 'Northeast Low', pts: 7 }
    ];
    seeds.forEach(s => storms.push(s));

    storms.forEach(s => {
      const circle = L.circle([s.lat, s.lon], {
        radius: s.r * 1000,
        color: '#f97316',
        weight: 1,
        fillColor: '#ea580c',
        fillOpacity: 0.15,
        interactive: true
      }).bindTooltip(s.name, { sticky: true });
      const mk = L.marker([s.lat, s.lon], {
        icon: L.divIcon({ className: '', html: '<div class="storm-marker"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        interactive: false
      });
      stormLayer.addLayer(circle);
      stormLayer.addLayer(mk);
      s._circle = circle;
    });
  }

  function decodeBlitz(b) {
    try {
      if (typeof b !== 'string') b = new TextDecoder().decode(b);
      const d = b.split('');
      let e = {}, c = d[0], f = c, g = [c], h = 256, o = h;
      for (let i = 1; i < d.length; i++) {
        const a = d[i].charCodeAt(0);
        const x = h > a ? d[i] : (e[a] !== undefined ? e[a] : f + c);
        g.push(x); c = x.charAt(0); e[o] = f + c; o++; f = x;
      }
      return g.join('');
    } catch (_) { return null; }
  }

  function addBolt(la, lo) {
    if (!boltsOn || !Number.isFinite(la) || !Number.isFinite(lo)) return;
    const b = map.getBounds();
    if (!b.pad(0.4).contains([la, lo])) return;

    const marker = L.marker([la, lo], {
      icon: L.divIcon({ className: '', html: '<div class="bolt"></div>', iconSize: [12, 12], iconAnchor: [6, 6] }),
      interactive: false
    });
    boltLayer.addLayer(marker);
    const rec = { lat: la, lon: lo, t: Date.now(), marker };
    bolts.push(rec);
    while (bolts.length > Q.maxBolts) {
      const old = bolts.shift();
      boltLayer.removeLayer(old.marker);
    }
  }

  function connectLightning() {
    if (!boltsOn) return;
    const hosts = ['wss://ws1.blitzortung.org', 'wss://ws2.blitzortung.org', 'wss://ws3.blitzortung.org'];
    let hi = 0;
    function connect() {
      if (!boltsOn || !playing) return;
      try {
        ws = new WebSocket(hosts[hi++ % hosts.length]);
        ws.binaryType = 'arraybuffer';
        ws.onopen = () => { try { ws.send(JSON.stringify({ a: 111 })); } catch (_) {} };
        ws.onmessage = (ev) => {
          if (!boltsOn) return;
          let text = typeof ev.data === 'string' ? ev.data : decodeBlitz(ev.data);
          if (!text) try { text = new TextDecoder().decode(ev.data); } catch (_) {}
          if (!text) return;
          try {
            const j = JSON.parse(text);
            const la = j.lat ?? j.latitude;
            const lo = j.lon ?? j.lng ?? j.longitude;
            if (la != null && lo != null) addBolt(+la, +lo);
          } catch (_) {}
        };
        ws.onclose = () => { if (boltsOn && playing) setTimeout(connect, 2500); };
        ws.onerror = () => { try { ws.close(); } catch (_) {} };
      } catch (_) {
        if (boltsOn && playing) setTimeout(connect, 4000);
      }
    }
    connect();
  }

  function stopLightning() {
    if (ws) { try { ws.close(); } catch (_) {} ws = null; }
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  let last = performance.now();
  let stormScoreAcc = 0;
  let lastHud = 0;

  function tick(now) {
    if (!playing) {
      requestAnimationFrame(tick);
      return;
    }
    const dt = Math.min(0.08, (now - last) / 1000);
    last = now;

    if (keys.left) heading -= 90 * dt;
    if (keys.right) heading += 90 * dt;
    if (keys.up) speed = Math.min(1, speed + 1.2 * dt);
    else if (keys.down) speed = Math.max(0, speed - 1.5 * dt);
    else speed = Math.max(0, speed - 0.4 * dt);

    if (speed > 0.02 && fuel > 0) {
      const kmPerSec = (160 * speed) / 3600;
      const distKm = kmPerSec * dt;
      const rad = heading * Math.PI / 180;
      const dLat = (distKm / 111) * Math.cos(rad);
      const cosLat = Math.cos(lat * Math.PI / 180) || 0.01;
      const dLon = (distKm / (111 * cosLat)) * Math.sin(rad);
      lat = Math.max(-80, Math.min(80, lat + dLat));
      lon = ((lon + dLon + 540) % 360) - 180;
      fuel = Math.max(0, fuel - speed * 2.2 * dt);
      car.setLatLng([lat, lon]);
    } else if (speed < 0.05) {
      fuel = Math.min(100, fuel + 3 * dt);
    }

    let intensity = 0;
    for (let i = 0; i < storms.length; i++) {
      const s = storms[i];
      const d = haversineKm(lat, lon, s.lat, s.lon);
      if (d < s.r) {
        const local = 1 - d / s.r;
        intensity = Math.max(intensity, local);
        stormScoreAcc += local * s.pts * dt;
        if (stormScoreAcc > 1) {
          const add = Math.floor(stormScoreAcc);
          score += add;
          stormScoreAcc -= add;
        }
        if (local > 0.7) {
          armor = Math.max(0, armor - 8 * local * dt);
        }
      }
    }

    const nowMs = Date.now();
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      if (nowMs - b.t > Q.boltFadeMs) {
        boltLayer.removeLayer(b.marker);
        bolts.splice(i, 1);
        continue;
      }
      const d = haversineKm(lat, lon, b.lat, b.lon);
      if (d < 12 && !b._scored) {
        b._scored = true;
        const pts = d < 3 ? 25 : d < 7 ? 12 : 5;
        score += pts;
        boltHits++;
        toast('⚡ Lightning intercept +' + pts);
      }
    }

    if (now - lastHud > 100) {
      lastHud = now;
      setStat('score', score, 'good');
      setStat('spd', Math.round(speed * 160), speed > 0.85 ? 'warn' : '');
      setStat('fuel', Math.round(fuel), fuel < 25 ? 'danger' : fuel < 50 ? 'warn' : '');
      setStat('armor', Math.round(armor), armor < 30 ? 'danger' : armor < 60 ? 'warn' : 'good');
      setStat('stormLvl', Math.round(intensity * 100), intensity > 0.6 ? 'danger' : intensity > 0.2 ? 'warn' : '');
      setStat('bolts', boltHits);
      document.getElementById('throttleFill').style.width = (speed * 100) + '%';
      document.getElementById('spd').textContent = Math.round(speed * 160);
    }

    if (armor <= 0) {
      playing = false;
      stopLightning();
      document.getElementById('overlay').classList.remove('hide');
      document.querySelector('.card h1').textContent = 'Wrecked';
      document.querySelector('.card p').textContent = 'Armor depleted. Final score: ' + score + ' · Lightning intercepts: ' + boltHits;
      document.getElementById('btnStart').textContent = 'Chase Again';
      toast('Chase over — score ' + score);
    }

    requestAnimationFrame(tick);
  }

  function bindKey(code, down) {
    if (code === 'ArrowUp' || code === 'KeyW') keys.up = down;
    if (code === 'ArrowDown' || code === 'KeyS') keys.down = down;
    if (code === 'ArrowLeft' || code === 'KeyA') keys.left = down;
    if (code === 'ArrowRight' || code === 'KeyD') keys.right = down;
  }
  window.addEventListener('keydown', e => {
    bindKey(e.code, true);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  }, { passive: false });
  window.addEventListener('keyup', e => bindKey(e.code, false));

  document.querySelectorAll('#dpad button').forEach(btn => {
    const k = btn.getAttribute('data-k');
    const set = (v) => { keys[k] = v; };
    btn.addEventListener('pointerdown', e => { e.preventDefault(); set(true); btn.setPointerCapture(e.pointerId); });
    btn.addEventListener('pointerup', () => set(false));
    btn.addEventListener('pointercancel', () => set(false));
    btn.addEventListener('lostpointercapture', () => set(false));
  });

  function toggleBtn(el, on) {
    el.classList.toggle('on', on);
  }

  document.getElementById('btnRadar').onclick = () => {
    radarOn = !radarOn;
    toggleBtn(document.getElementById('btnRadar'), radarOn);
    if (radarOn) loadRadar();
    else if (radarLayer) { map.removeLayer(radarLayer); radarLayer = null; }
  };
  document.getElementById('btnBolt').onclick = () => {
    boltsOn = !boltsOn;
    toggleBtn(document.getElementById('btnBolt'), boltsOn);
    if (boltsOn && playing) connectLightning();
    else {
      stopLightning();
      boltLayer.clearLayers();
      bolts.length = 0;
    }
  };
  document.getElementById('btnStorms').onclick = () => {
    stormsOn = !stormsOn;
    toggleBtn(document.getElementById('btnStorms'), stormsOn);
    if (stormsOn) loadStorms();
    else { stormLayer.clearLayers(); storms = []; }
  };

  document.getElementById('btnCenter').onclick = () => map.setView([lat, lon], Math.max(map.getZoom(), 7));
  document.getElementById('btnChase').onclick = () => {
    if (!storms.length) { toast('No storms loaded'); return; }
    let best = storms[0], bestD = Infinity;
    storms.forEach(s => {
      const d = haversineKm(lat, lon, s.lat, s.lon);
      if (d < bestD) { bestD = d; best = s; }
    });
    map.flyTo([best.lat, best.lon], 7, { duration: 1.2 });
    toast('Tracking: ' + best.name);
  };

  document.getElementById('btnQuality').onclick = () => {
    qKey = qKey === 'low' ? 'med' : qKey === 'med' ? 'high' : 'low';
    Q = QUALITY[qKey];
    try { localStorage.setItem('sc_quality', qKey); } catch (_) {}
    document.getElementById('btnQuality').textContent = 'Quality: ' + (qKey === 'med' ? 'Med' : qKey === 'low' ? 'Low' : 'High');
    toast('Quality → ' + qKey);
  };

  document.getElementById('btnHelp').onclick = () => {
    document.getElementById('overlay').classList.remove('hide');
    playing = false;
    stopLightning();
  };

  document.getElementById('back').onclick = () => {
    const u = new URL(location.href);
    let p = u.pathname.replace(/\/games\/storm-chaser\/?.*$/i, '/');
    if (!p.endsWith('/')) p += '/';
    location.href = u.origin + p;
  };

  function startGame() {
    document.getElementById('overlay').classList.add('hide');
    score = 0; fuel = 100; armor = 100; boltHits = 0; speed = 0; stormScoreAcc = 0;
    lat = 35.2; lon = -97.4; heading = 0;
    car.setLatLng([lat, lon]);
    map.setView([lat, lon], 6);
    playing = true;
    last = performance.now();
    if (boltsOn) connectLightning();
    toast('Chase is on — head for the orange cells');
  }

  document.getElementById('btnStart').onclick = startGame;

  toggleBtn(document.getElementById('btnRadar'), true);
  toggleBtn(document.getElementById('btnBolt'), true);
  toggleBtn(document.getElementById('btnStorms'), true);
  document.getElementById('btnQuality').textContent = 'Quality: ' + (qKey === 'med' ? 'Med' : qKey === 'low' ? 'Low' : 'High');

  loadRadar();
  loadStorms();
  setInterval(() => { if (radarOn) loadRadar(); }, 5 * 60 * 1000);
  setInterval(() => { if (stormsOn) loadStorms(); }, 10 * 60 * 1000);

  setInterval(() => {
    if (!playing || speed < 0.15) return;
    const b = map.getBounds();
    if (!b.contains([lat, lon])) map.panTo([lat, lon], { animate: true, duration: 0.4 });
  }, 1000);

  requestAnimationFrame(tick);
})();
