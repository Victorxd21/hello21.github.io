import * as THREE from 'three';

const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#ffffff','#1f2937'];
const TRACK_RADIUS = 90;
const TRACK_WIDTH = 18;
const LAPS = 3;

const $ = id => document.getElementById(id);
const menu = $('menu'), joinScreen = $('joinScreen'), lobby = $('lobby'), hud = $('hud');
const cfgWarn = $('cfgWarn');
const canvas = $('game');

let myId = Math.random().toString(36).slice(2, 10);
let myName = 'Racer';
let myColor = COLORS[0];
let isHost = false;
let lobbyCode = null;
let players = {};
let mode = 'menu';
let supabase = null;
let channel = null;
let raceStarted = false;

function initSupabase() {
  const cfg = window.PARTY_RACE_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    cfgWarn.classList.remove('hide');
    return null;
  }
  cfgWarn.classList.add('hide');
  return window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
}
supabase = initSupabase();

function codeGen() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

async function connectLobby(code, asHost) {
  if (!supabase) throw new Error('Configure Supabase in config.js for multiplayer');
  if (channel) { await channel.unsubscribe(); channel = null; }
  lobbyCode = code;
  isHost = asHost;
  players = {};
  players[myId] = { name: myName, color: myColor, host: asHost };

  channel = supabase.channel('party-race:' + code, {
    config: { presence: { key: myId }, broadcast: { self: true } }
  });

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    const next = {};
    Object.values(state).forEach(arr => {
      (arr || []).forEach(p => {
        if (p.id) next[p.id] = { name: p.name, color: p.color, host: !!p.host };
      });
    });
    next[myId] = { name: myName, color: myColor, host: isHost };
    players = next;
    renderLobby();
  });

  channel.on('broadcast', { event: 'start' }, ({ payload }) => {
    if (!raceStarted) beginRace(payload);
  });

  channel.on('broadcast', { event: 'state' }, ({ payload }) => {
    if (payload && payload.id && payload.id !== myId) applyRemoteState(payload);
  });

  channel.on('broadcast', { event: 'color' }, ({ payload }) => {
    if (payload && payload.id && players[payload.id]) {
      players[payload.id].color = payload.color;
      renderLobby();
      if (remoteCars[payload.id]) setCarColor(remoteCars[payload.id], payload.color);
      if (payload.id === myId) setCarColor(localCar, payload.color);
    }
  });

  await channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({ id: myId, name: myName, color: myColor, host: isHost });
    }
  });
}

async function leaveLobby() {
  if (channel) {
    try { await channel.unsubscribe(); } catch (_) {}
    channel = null;
  }
  lobbyCode = null;
  isHost = false;
  players = {};
  raceStarted = false;
}

function broadcastStart() {
  if (!channel || !isHost) return;
  channel.send({ type: 'broadcast', event: 'start', payload: { seed: Date.now(), host: myId } });
}

function broadcastState(state) {
  if (!channel || mode !== 'race') return;
  channel.send({ type: 'broadcast', event: 'state', payload: state });
}

function broadcastColor(color) {
  if (!channel) return;
  channel.send({ type: 'broadcast', event: 'color', payload: { id: myId, color } });
}

function show(el) {
  [menu, joinScreen, lobby].forEach(s => s.classList.add('hide'));
  hud.classList.add('hide');
  el.classList.remove('hide');
}

function makeSwatches(container, onPick, selected) {
  container.innerHTML = '';
  COLORS.forEach(c => {
    const d = document.createElement('div');
    d.className = 'swatch' + (c === selected ? ' on' : '');
    d.style.background = c;
    d.onclick = () => onPick(c);
    container.appendChild(d);
  });
}

function bindMenuColors() {
  makeSwatches($('colorPick'), c => {
    myColor = c;
    bindMenuColors();
  }, myColor);
}
bindMenuColors();

function renderLobby() {
  $('lobbyCode').textContent = lobbyCode || '------';
  const list = $('playerList');
  list.innerHTML = '';
  Object.entries(players).forEach(([id, p]) => {
    const row = document.createElement('div');
    row.className = 'player';
    row.innerHTML = `<span class="dot" style="background:${p.color}"></span><span>${escapeHtml(p.name)}</span>${p.host ? '<span class="badge">HOST</span>' : ''}${id === myId ? '<span class="badge">YOU</span>' : ''}`;
    list.appendChild(row);
  });
  const startBtn = $('btnStart');
  if (isHost) {
    startBtn.classList.remove('hide');
    $('lobbyHint').textContent = 'You are host — start when ready';
  } else {
    startBtn.classList.add('hide');
    $('lobbyHint').textContent = 'Waiting for host to start…';
  }
  makeSwatches($('lobbyColors'), onLobbyColor, myColor);
}

function onLobbyColor(c) {
  myColor = c;
  if (players[myId]) players[myId].color = c;
  if (localCar) setCarColor(localCar, c);
  broadcastColor(c);
  if (channel) channel.track({ id: myId, name: myName, color: myColor, host: isHost });
  renderLobby();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

$('btnCreate').onclick = async () => {
  myName = ($('playerName').value || 'Racer').slice(0, 16);
  if (!supabase) { alert('Add Supabase URL + key in games/party-race/config.js for multiplayer, or use Solo Practice.'); return; }
  try {
    const code = codeGen();
    await connectLobby(code, true);
    show(lobby);
    renderLobby();
  } catch (e) {
    alert(e.message || String(e));
  }
};

$('btnJoinShow').onclick = () => show(joinScreen);
$('btnJoinBack').onclick = () => show(menu);
$('btnJoin').onclick = async () => {
  myName = ($('playerName').value || 'Racer').slice(0, 16);
  const code = ($('joinCode').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (code.length < 4) { alert('Enter a valid lobby code'); return; }
  if (!supabase) { alert('Configure Supabase in config.js'); return; }
  try {
    await connectLobby(code, false);
    show(lobby);
    renderLobby();
  } catch (e) {
    alert(e.message || String(e));
  }
};

$('btnSolo').onclick = () => {
  myName = ($('playerName').value || 'Racer').slice(0, 16);
  players = { [myId]: { name: myName, color: myColor, host: true } };
  isHost = true;
  lobbyCode = null;
  beginRace({ seed: Date.now(), solo: true });
};

$('btnStart').onclick = () => {
  if (!isHost) return;
  broadcastStart();
  beginRace({ seed: Date.now() });
};

$('btnLeave').onclick = async () => {
  await leaveLobby();
  show(menu);
};

$('btnAgain').onclick = async () => {
  $('finish').classList.remove('show');
  raceStarted = false;
  mode = 'menu';
  cleanupRace();
  await leaveLobby();
  show(menu);
};

$('backMenu').onclick = async () => {
  raceStarted = false;
  mode = 'menu';
  cleanupRace();
  await leaveLobby();
  show(menu);
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x87b8e0);
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87b8e0, 120, 420);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 800);
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xfff5e0, 1.05);
sun.position.set(60, 120, 40);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(800, 800),
  new THREE.MeshLambertMaterial({ color: 0x3d8f4a })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

function buildTrack() {
  const group = new THREE.Group();
  const shape = new THREE.Shape();
  const outer = TRACK_RADIUS + TRACK_WIDTH / 2;
  const inner = TRACK_RADIUS - TRACK_WIDTH / 2;
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.4, bevelEnabled: false });
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x2a2a32 }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.05;
  group.add(mesh);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.35), new THREE.MeshBasicMaterial({ color: 0xf8fafc }));
    dash.position.set(Math.cos(a) * TRACK_RADIUS, 0.28, Math.sin(a) * TRACK_RADIUS);
    dash.rotation.y = -a;
    group.add(dash);
  }
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    for (const r of [outer + 0.8, inner - 0.8]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 0.4), new THREE.MeshLambertMaterial({ color: i % 2 ? 0xe11d48 : 0xf8fafc }));
      b.position.set(Math.cos(a) * r, 0.6, Math.sin(a) * r);
      b.rotation.y = -a;
      group.add(b);
    }
  }
  const line = new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH, 0.1, 1.2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  line.position.set(TRACK_RADIUS, 0.3, 0);
  line.rotation.y = Math.PI / 2;
  group.add(line);
  scene.add(group);
  return group;
}
let trackMesh = null;

function makeCar(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 3.6), new THREE.MeshLambertMaterial({ color }));
  body.position.y = 0.45;
  body.name = 'body';
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 1.6), new THREE.MeshLambertMaterial({ color: 0x111827 }));
  cabin.position.set(0, 0.95, -0.2);
  g.add(cabin);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.08), new THREE.MeshLambertMaterial({ color: 0x7dd3fc }));
  glass.position.set(0, 0.95, 0.65);
  g.add(glass);
  const wmat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  [[-0.95, 0.3, 1.1], [0.95, 0.3, 1.1], [-0.95, 0.3, -1.1], [0.95, 0.3, -1.1]].forEach(([x, y, z]) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.28, 10), wmat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, y, z);
    g.add(w);
  });
  return g;
}

function setCarColor(car, color) {
  if (!car) return;
  const body = car.getObjectByName('body');
  if (body) body.material.color.set(color);
}

function createVehicle(color, x, z, heading) {
  const mesh = makeCar(color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    mesh, x, z, heading,
    speed: 0, yawRate: 0, lap: 0, progress: 0,
    lastAngle: Math.atan2(z, x),
    finished: false, finishTime: 0
  };
}

const MAX_SPEED = 48;
const ACCEL = 28;
const BRAKE = 40;
const DRAG = 3.5;
const ROLL = 6;
const STEER_MAX = 1.35;

let localCar = null;
let localVeh = null;
let remoteCars = {};
let remoteVeh = {};
let keys = { up: false, down: false, left: false, right: false };
let raceTime = 0;
let countdown = 3;
let countdownActive = false;
let lastBroadcast = 0;

function spawnPositions(n) {
  const spots = [];
  for (let i = 0; i < n; i++) {
    const a = -0.08 - i * 0.06;
    const r = TRACK_RADIUS - 3 + (i % 2) * 4;
    spots.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, heading: a + Math.PI / 2 });
  }
  return spots;
}

function beginRace(payload) {
  raceStarted = true;
  mode = 'race';
  show(hud);
  hud.classList.remove('hide');
  menu.classList.add('hide');
  joinScreen.classList.add('hide');
  lobby.classList.add('hide');
  $('finish').classList.remove('show');
  $('backMenu').classList.add('show');

  cleanupRace(false);
  if (!trackMesh) trackMesh = buildTrack();

  const ids = Object.keys(players);
  if (!ids.includes(myId)) ids.unshift(myId);
  const spots = spawnPositions(Math.max(ids.length, 1));

  const si = Math.max(0, ids.indexOf(myId));
  const sp = spots[si] || spots[0];
  localVeh = createVehicle(myColor, sp.x, sp.z, sp.heading);
  localCar = localVeh.mesh;

  ids.forEach((id, i) => {
    if (id === myId) return;
    const s = spots[i] || spots[0];
    const p = players[id] || { color: COLORS[i % COLORS.length], name: 'P' };
    const mesh = makeCar(p.color);
    mesh.position.set(s.x, 0, s.z);
    mesh.rotation.y = s.heading;
    scene.add(mesh);
    remoteCars[id] = mesh;
    remoteVeh[id] = { x: s.x, z: s.z, heading: s.heading, speed: 0, lap: 0, name: p.name };
  });

  raceTime = 0;
  countdown = 3;
  countdownActive = true;
  $('countdown').textContent = '3';
  $('countdown').classList.add('show');
  $('lap').textContent = 'Lap 1/' + LAPS;
}

function cleanupRace(removeTrack = true) {
  if (localCar) { scene.remove(localCar); localCar = null; localVeh = null; }
  Object.values(remoteCars).forEach(m => scene.remove(m));
  remoteCars = {};
  remoteVeh = {};
  if (removeTrack && trackMesh) {
    scene.remove(trackMesh);
    trackMesh = null;
  }
}

function applyRemoteState(p) {
  if (!remoteCars[p.id]) {
    const mesh = makeCar(p.color || '#888');
    scene.add(mesh);
    remoteCars[p.id] = mesh;
  }
  const m = remoteCars[p.id];
  m.position.x += (p.x - m.position.x) * 0.35;
  m.position.z += (p.z - m.position.z) * 0.35;
  m.rotation.y = p.heading;
  if (p.color) setCarColor(m, p.color);
  remoteVeh[p.id] = p;
}

function updatePhysics(veh, input, dt) {
  const speed = veh.speed;
  const absSp = Math.abs(speed);

  if (input.throttle > 0) {
    const power = ACCEL * (1 - absSp / MAX_SPEED);
    veh.speed += power * input.throttle * dt;
  }
  if (input.brake > 0) {
    if (speed > 0.5) veh.speed -= BRAKE * input.brake * dt;
    else if (speed < -0.5) veh.speed += BRAKE * input.brake * dt;
    else veh.speed = 0;
  }
  if (input.throttle < 0 && speed <= 0.5) {
    veh.speed += ACCEL * 0.4 * input.throttle * dt;
    veh.speed = Math.max(veh.speed, -MAX_SPEED * 0.35);
  }

  const drag = DRAG * speed * absSp * 0.002;
  const roll = ROLL * Math.sign(speed);
  if (absSp > 0.05) veh.speed -= (drag + roll) * dt;
  else if (!input.throttle) veh.speed = 0;
  veh.speed = Math.max(-MAX_SPEED * 0.4, Math.min(MAX_SPEED, veh.speed));

  const steerEff = STEER_MAX * input.steer * (absSp < 2 ? absSp / 2 : Math.min(1, 18 / (absSp + 4)));
  veh.heading += steerEff * Math.sign(veh.speed || 1) * dt * (absSp > 0.3 ? 1 : 0);

  veh.x += Math.sin(veh.heading) * veh.speed * dt;
  veh.z += Math.cos(veh.heading) * veh.speed * dt;

  const r = Math.hypot(veh.x, veh.z);
  const minR = TRACK_RADIUS - TRACK_WIDTH / 2 + 1.2;
  const maxR = TRACK_RADIUS + TRACK_WIDTH / 2 - 1.2;
  if (r < minR || r > maxR) {
    const ang = Math.atan2(veh.z, veh.x);
    const targetR = Math.max(minR, Math.min(maxR, r));
    veh.x = Math.cos(ang) * targetR;
    veh.z = Math.sin(ang) * targetR;
    veh.speed *= 0.92;
  }

  const ang = Math.atan2(veh.z, veh.x);
  let dAng = ang - veh.lastAngle;
  if (dAng > Math.PI) dAng -= Math.PI * 2;
  if (dAng < -Math.PI) dAng += Math.PI * 2;
  if (veh.speed > 1) {
    veh.progress += dAng;
    if (veh.progress > Math.PI * 2) {
      veh.progress -= Math.PI * 2;
      veh.lap += 1;
    }
  }
  veh.lastAngle = ang;

  veh.mesh.position.x = veh.x;
  veh.mesh.position.z = veh.z;
  veh.mesh.rotation.y = veh.heading;
  veh.mesh.rotation.z = -input.steer * 0.12 * Math.min(1, absSp / 20);
}

window.addEventListener('keydown', e => {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = true;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = true;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
});
window.addEventListener('keyup', e => {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = false;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
});

function updateCamera(dt) {
  if (!localVeh) return;
  const back = 10, up = 5;
  const tx = localVeh.x - Math.sin(localVeh.heading) * back;
  const tz = localVeh.z - Math.cos(localVeh.heading) * back;
  camera.position.x += (tx - camera.position.x) * Math.min(1, 6 * dt);
  camera.position.z += (tz - camera.position.z) * Math.min(1, 6 * dt);
  camera.position.y += (up - camera.position.y) * Math.min(1, 4 * dt);
  camera.lookAt(localVeh.x, 1.2, localVeh.z);
}

function rankPlayers() {
  const all = [];
  if (localVeh) all.push({ id: myId, name: myName, lap: localVeh.lap, progress: localVeh.progress, finished: localVeh.finished, finishTime: localVeh.finishTime });
  Object.entries(remoteVeh).forEach(([id, v]) => {
    all.push({ id, name: v.name || id, lap: v.lap || 0, progress: v.progress || 0, finished: v.finished, finishTime: v.finishTime || 0 });
  });
  all.sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    if (b.lap !== a.lap) return b.lap - a.lap;
    return b.progress - a.progress;
  });
  return all;
}

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (mode === 'race' && localVeh) {
    if (countdownActive) {
      countdown -= dt;
      const n = Math.ceil(countdown);
      $('countdown').textContent = n > 0 ? String(n) : 'GO!';
      if (countdown <= 0) {
        countdownActive = false;
        setTimeout(() => $('countdown').classList.remove('show'), 500);
      }
    } else if (!localVeh.finished) {
      raceTime += dt;
      const input = {
        throttle: keys.up ? 1 : 0,
        brake: keys.down ? 1 : 0,
        steer: (keys.left ? 1 : 0) + (keys.right ? -1 : 0)
      };
      if (keys.down && localVeh.speed < 1) input.throttle = -1;
      updatePhysics(localVeh, input, dt);

      if (localVeh.lap >= LAPS && !localVeh.finished) {
        localVeh.finished = true;
        localVeh.finishTime = raceTime;
        $('finishTitle').textContent = 'Finished!';
        const ranks = rankPlayers();
        const place = ranks.findIndex(r => r.id === myId) + 1;
        $('finishSub').textContent = 'Place: #' + place + ' · Time: ' + raceTime.toFixed(1) + 's';
        $('finish').classList.add('show');
      }

      if (channel && now - lastBroadcast > 100) {
        lastBroadcast = now;
        broadcastState({
          id: myId, name: myName, color: myColor,
          x: localVeh.x, z: localVeh.z, heading: localVeh.heading,
          speed: localVeh.speed, lap: localVeh.lap, progress: localVeh.progress,
          finished: localVeh.finished, finishTime: localVeh.finishTime
        });
      }
    }

    const mph = Math.abs(localVeh.speed) * 2.23694;
    $('speedo').textContent = Math.round(mph) + ' mph';
    $('lap').textContent = 'Lap ' + Math.min(localVeh.lap + 1, LAPS) + '/' + LAPS;
    const ranks = rankPlayers();
    const place = ranks.findIndex(r => r.id === myId) + 1;
    $('pos').textContent = '#' + place + ' / ' + ranks.length;

    updateCamera(dt);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

camera.position.set(0, 40, 80);
camera.lookAt(0, 0, 0);
