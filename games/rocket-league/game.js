// Rocket League – Improved visuals + PeerJS multiplayer

let username = localStorage.getItem("rl_username") || "";
let password = localStorage.getItem("rl_password") || "";
let blueScore = 0, orangeScore = 0, matchTime = 300, matchRunning = false, boost = 100;
let scene, camera, renderer, clock, ball, myCar;
let keys = {};
let lastGoalTime = 0;
let otherCars = {};
let lastPosSend = 0;
let boostParticles = [];

const loginScreen = document.getElementById("loginScreen");
const mainMenu = document.getElementById("mainMenu");
const leaderboardScreen = document.getElementById("leaderboardScreen");
const hud = document.getElementById("hud");
const canvas = document.getElementById("gameCanvas");

function init() {
  document.getElementById("usernameInput").value = username;
  document.getElementById("passwordInput").value = password;

  document.getElementById("playBtn").onclick = () => {
    const u = document.getElementById("usernameInput").value.trim();
    if (!u) return alert("Enter a username");
    username = u;
    password = document.getElementById("passwordInput").value;
    localStorage.setItem("rl_username", username);
    localStorage.setItem("rl_password", password);
    loginScreen.classList.add("hidden");
    mainMenu.classList.remove("hidden");
    document.getElementById("welcomeText").textContent = username;
    Network.init(username);
  };

  document.getElementById("soloBtn").onclick = () => startMatch("solo");
  document.getElementById("createRoomBtn").onclick = () => startMatch("create");
  document.getElementById("joinRoomBtn").onclick = () => {
    document.getElementById("joinPanel").classList.toggle("hidden");
  };
  document.getElementById("confirmJoinBtn").onclick = () => {
    const code = document.getElementById("roomCodeInput").value.trim().toUpperCase();
    if (code) startMatch("join", code);
  };
  document.getElementById("leaderboardBtn").onclick = showLeaderboard;
  document.getElementById("closeLbBtn").onclick = () => leaderboardScreen.classList.add("hidden");
  document.getElementById("logoutBtn").onclick = () => {
    localStorage.removeItem("rl_username");
    localStorage.removeItem("rl_password");
    location.reload();
  };

  window.addEventListener("keydown", e => {
    keys[e.code] = true;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  });
  window.addEventListener("keyup", e => keys[e.code] = false);

  if (username) {
    loginScreen.classList.add("hidden");
    mainMenu.classList.remove("hidden");
    document.getElementById("welcomeText").textContent = username;
    Network.init(username);
  }
}

function startMatch(mode, code) {
  mainMenu.classList.add("hidden");
  hud.classList.remove("hidden");

  Network.onPlayerJoin = (id, player) => {
    spawnOtherCar(id, player);
    updatePlayerList();
    setStatus(player.name + " JOINED");
    setTimeout(() => setStatus(""), 2000);
  };
  Network.onPlayerLeave = (id) => {
    if (otherCars[id]) { scene.remove(otherCars[id]); delete otherCars[id]; }
    updatePlayerList();
  };
  Network.onMessage = (data, fromPeer) => {
    if (data.type === "pos" && data.id && otherCars[data.id]) {
      const c = otherCars[data.id];
      c.position.set(data.x, data.y, data.z);
      c.rotation.y = data.ry || 0;
    }
    if (data.type === "ball" && ball) {
      ball.position.set(data.x, data.y, data.z);
      if (ball.userData.velocity) ball.userData.velocity.set(data.vx||0, data.vy||0, data.vz||0);
    }
    if (data.type === "score") {
      blueScore = data.blue||0; orangeScore = data.orange||0;
      document.getElementById("blueScore").textContent = blueScore;
      document.getElementById("orangeScore").textContent = orangeScore;
    }
    if (data.type === "welcome") {
      blueScore = data.blue||0; orangeScore = data.orange||0;
      document.getElementById("blueScore").textContent = blueScore;
      document.getElementById("orangeScore").textContent = orangeScore;
      updatePlayerList();
      for (const id in data.players) {
        if (id !== Network.myId && !otherCars[id]) spawnOtherCar(id, data.players[id]);
      }
    }
  };

  if (mode === "solo") {
    setStatus("TRAINING");
    Network.startSolo(() => beginGame());
  } else if (mode === "create") {
    setStatus("CREATING ROOM...");
    Network.createRoom(
      (room) => { setStatus("ROOM: " + room); beginGame(); },
      (err) => { setStatus("FAILED TO CREATE"); console.error(err); }
    );
  } else if (mode === "join") {
    setStatus("JOINING " + code + "...");
    Network.joinRoom(
      code,
      () => { setStatus("JOINED " + code); beginGame(); },
      (err) => { setStatus("JOIN FAILED"); alert("Could not join. Check the code."); console.error(err); }
    );
  }
}

function beginGame() {
  initThree();
  createArena();
  createBall();
  createMyCar();
  matchRunning = true;
  clock = new THREE.Clock();
  animate();
  setInterval(updateTimer, 1000);
  updatePlayerList();
}

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b8d8);
  scene.fog = new THREE.FogExp2(0x87b8d8, 0.0045);

  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
  camera.position.set(0, 16, 36);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  // Lighting – stadium feel
  const hemi = new THREE.HemisphereLight(0xb8d4f0, 0x3a5a30, 0.7);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff5e0, 1.3);
  sun.position.set(40, 70, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 50;
  sun.shadow.camera.bottom = -50;
  scene.add(sun);

  // Stadium floodlights
  [[-40, 35, -25], [40, 35, -25], [-40, 35, 25], [40, 35, 25]].forEach(p => {
    const light = new THREE.PointLight(0xfff0dd, 0.6, 100);
    light.position.set(...p);
    scene.add(light);
  });

  window.addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

function createArena() {
  // Grass field
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x2d9a42, roughness: 0.9, metalness: 0.05 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), grassMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Field markings
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  // Center line
  const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 80), lineMat);
  cl.rotation.x = -Math.PI / 2; cl.position.y = 0.03; scene.add(cl);
  // Center circle
  const circleGeo = new THREE.RingGeometry(9.5, 10, 64);
  const circle = new THREE.Mesh(circleGeo, lineMat);
  circle.rotation.x = -Math.PI / 2; circle.position.y = 0.03; scene.add(circle);

  // Goals with nets feel
  makeGoal(-56, 0x3b9eff, true);
  makeGoal(56, 0xff8c2a, false);

  // Side boards / walls
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.6, metalness: 0.3 });
  // Long sides
  [[0, 1.2, -40.5, 120, 2.4, 1], [0, 1.2, 40.5, 120, 2.4, 1]].forEach(p => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(p[3], p[4], p[5]), boardMat);
    w.position.set(p[0], p[1], p[2]);
    w.castShadow = true; w.receiveShadow = true;
    scene.add(w);
  });
  // End walls (behind goals)
  [[-61, 4, 0, 2, 8, 82], [61, 4, 0, 2, 8, 82]].forEach(p => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(p[3], p[4], p[5]), boardMat);
    w.position.set(p[0], p[1], p[2]);
    scene.add(w);
  });

  // Stadium stands (simple blocks)
  const standMat = new THREE.MeshStandardMaterial({ color: 0x2a3545, roughness: 0.8 });
  // Side stands
  [[0, 8, -48, 130, 14, 12], [0, 8, 48, 130, 14, 12]].forEach(p => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(p[3], p[4], p[5]), standMat);
    s.position.set(p[0], p[1], p[2]);
    scene.add(s);
  });
  // End stands
  [[-70, 10, 0, 14, 18, 100], [70, 10, 0, 14, 18, 100]].forEach(p => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(p[3], p[4], p[5]), standMat);
    s.position.set(p[0], p[1], p[2]);
    scene.add(s);
  });

  // Roof structure (transparent glass feel)
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0xaaccff, transparent: true, opacity: 0.12, roughness: 0.1, metalness: 0.8
  });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(150, 1, 110), roofMat);
  roof.position.y = 28;
  scene.add(roof);

  // Corner pillars
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x556677, metalness: 0.5, roughness: 0.4 });
  [[-58, 14, -38], [58, 14, -38], [-58, 14, 38], [58, 14, 38]].forEach(p => {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 28, 8), pillarMat);
    pillar.position.set(...p);
    scene.add(pillar);
  });
}

function makeGoal(x, color, isBlue) {
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.3 });
  const postGeo = new THREE.BoxGeometry(1, 10, 1);
  const left = new THREE.Mesh(postGeo, mat);
  left.position.set(x, 5, -12.5); scene.add(left);
  const right = new THREE.Mesh(postGeo, mat);
  right.position.set(x, 5, 12.5); scene.add(right);
  const cross = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 26), mat);
  cross.position.set(x, 10, 0); scene.add(cross);

  // Back net frame
  const back = new THREE.Mesh(new THREE.BoxGeometry(4, 10, 1), mat);
  back.position.set(x + (isBlue ? -3 : 3), 5, 0);
  scene.add(back);
}

function createBall() {
  // Soccer ball look
  const geo = new THREE.SphereGeometry(Physics.BALL_RADIUS, 48, 48);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf5f5f5,
    roughness: 0.35,
    metalness: 0.05
  });
  ball = new THREE.Mesh(geo, mat);
  ball.castShadow = true;
  ball.receiveShadow = true;
  ball.userData.velocity = new THREE.Vector3();
  Physics.resetBall(ball);
  scene.add(ball);

  // Simple pattern with a darker band
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(Physics.BALL_RADIUS * 0.98, 0.08, 8, 48),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  ball.add(band);
}

function createMyCar() {
  myCar = buildCar(0xffcc00);
  myCar.position.set(0, 0.55, Network.isHost ? 18 : -18);
  myCar.userData.velocity = new THREE.Vector3();
  myCar.userData.onGround = true;
  scene.add(myCar);
}

function spawnOtherCar(id, player) {
  if (otherCars[id]) return;
  const color = player.team === "blue" ? 0x3b9eff : 0xff8c2a;
  const car = buildCar(color);
  car.position.set(0, 0.55, player.team === "blue" ? 18 : -18);
  scene.add(car);
  otherCars[id] = car;
}

function buildCar(color) {
  const g = new THREE.Group();

  // Main body – more car-like
  const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.45, roughness: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.65, 4.0), bodyMat);
  body.position.y = 0.15;
  body.castShadow = true;
  g.add(body);

  // Hood slope
  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.35, 1.4),
    bodyMat
  );
  hood.position.set(0, 0.4, -1.1);
  hood.rotation.x = 0.15;
  g.add(hood);

  // Cabin / cockpit
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.6, roughness: 0.15 });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 1.8), cabinMat);
  cabin.position.set(0, 0.65, 0.3);
  g.add(cabin);

  // Spoiler
  const spoiler = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.12, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.5, roughness: 0.4 })
  );
  spoiler.position.set(0, 0.85, 1.7);
  g.add(spoiler);
  // Spoiler supports
  [[-0.8, 0.55, 1.5], [0.8, 0.55, 1.5]].forEach(p => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), bodyMat);
    s.position.set(...p);
    g.add(s);
  });

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.4, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.3 });
  [[-1.25, -0.05, 1.25], [1.25, -0.05, 1.25], [-1.25, -0.05, -1.25], [1.25, -0.05, -1.25]].forEach(pos => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(...pos);
    wheel.castShadow = true;
    g.add(wheel);
    // Rim
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.42, 12), rimMat);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(...pos);
    g.add(rim);
  });

  // Headlights
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffaa, emissiveIntensity: 0.6 });
  [[-0.7, 0.25, -1.95], [0.7, 0.25, -1.95]].forEach(p => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.15), lightMat);
    hl.position.set(...p);
    g.add(hl);
  });

  // Boost nozzle (rear)
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.28, 0.3, 8),
    new THREE.MeshStandardMaterial({ color: 0x333344, metalness: 0.7 })
  );
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, 0.2, 2.1);
  g.add(nozzle);

  return g;
}

function spawnBoostFlame() {
  if (!myCar || boost < 5) return;
  const input = getInput();
  if (!input.boost) return;

  // Simple particle behind car
  const geo = new THREE.SphereGeometry(0.15 + Math.random() * 0.2, 6, 6);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color().setHSL(0.08 + Math.random() * 0.08, 1, 0.55),
    transparent: true,
    opacity: 0.85
  });
  const p = new THREE.Mesh(geo, mat);
  const back = new THREE.Vector3(0, 0.3, 2.3).applyQuaternion(myCar.quaternion);
  p.position.copy(myCar.position).add(back);
  p.userData.life = 0.35 + Math.random() * 0.2;
  p.userData.vel = new THREE.Vector3(
    (Math.random() - 0.5) * 2,
    Math.random() * 1.5,
    (Math.random() - 0.5) * 2
  ).add(new THREE.Vector3(0, 0, 8).applyQuaternion(myCar.quaternion));
  scene.add(p);
  boostParticles.push(p);
}

function updateBoostParticles(dt) {
  for (let i = boostParticles.length - 1; i >= 0; i--) {
    const p = boostParticles[i];
    p.userData.life -= dt;
    p.position.add(p.userData.vel.clone().multiplyScalar(dt));
    p.userData.vel.y += 2 * dt;
    p.material.opacity = Math.max(0, p.userData.life * 2);
    p.scale.multiplyScalar(0.96);
    if (p.userData.life <= 0) {
      scene.remove(p);
      boostParticles.splice(i, 1);
    }
  }
}

function getInput() {
  return {
    forward: keys["KeyW"] || keys["ArrowUp"],
    back: keys["KeyS"] || keys["ArrowDown"],
    left: keys["KeyA"] || keys["ArrowLeft"],
    right: keys["KeyD"] || keys["ArrowRight"],
    boost: keys["ShiftLeft"] || keys["ShiftRight"],
    jump: keys["Space"]
  };
}

function updatePlayerList() {
  const el = document.getElementById("playerList");
  let html = "<b>PLAYERS</b><br>";
  for (const id in Network.players) {
    const p = Network.players[id];
    html += `<span style="color:${p.team === "blue" ? "#4da6ff" : "#ff9a3c"}">${p.name}</span><br>`;
  }
  el.innerHTML = html;
}

function setStatus(msg) {
  document.getElementById("statusMsg").textContent = msg;
}

function updateTimer() {
  if (!matchRunning) return;
  matchTime = Math.max(0, matchTime - 1);
  const m = Math.floor(matchTime / 60);
  const s = matchTime % 60;
  document.getElementById("timer").textContent = m + ":" + (s < 10 ? "0" : "") + s;
}

function onGoal(team) {
  const now = performance.now();
  if (now - lastGoalTime < 2000) return;
  lastGoalTime = now;

  if (team === "blue") blueScore++;
  else orangeScore++;

  document.getElementById("blueScore").textContent = blueScore;
  document.getElementById("orangeScore").textContent = orangeScore;
  setStatus(team.toUpperCase() + " SCORES!");

  Physics.resetBall(ball);
  if (myCar) {
    myCar.position.set(0, 0.55, Network.isHost ? 18 : -18);
    myCar.userData.velocity.set(0, 0, 0);
  }

  Network.saveScore(username, 1);
  Network.sendScore(blueScore, orangeScore);
  setTimeout(() => setStatus(""), 2200);
}

function showLeaderboard() {
  const list = Network.getLeaderboard();
  let html = "";
  if (!list.length) html = "<p>No scores yet. Score some goals!</p>";
  else list.slice(0, 25).forEach((e, i) => {
    html += `<div><span>#${i + 1} ${e.name}</span><span>${e.goals} goals</span></div>`;
  });
  document.getElementById("lbList").innerHTML = html;
  leaderboardScreen.classList.remove("hidden");
}

function animate() {
  requestAnimationFrame(animate);
  if (!clock) return;
  const dt = Math.min(clock.getDelta(), 0.05);

  const prevBoost = boost;
  boost = Physics.updateCar(myCar, getInput(), dt, boost);
  document.getElementById("boostFill").style.width = boost + "%";
  document.getElementById("boostText").textContent = Math.round(boost);

  // Boost flames
  if (getInput().boost && boost > 0) {
    spawnBoostFlame();
    if (Math.random() > 0.5) spawnBoostFlame();
  }
  updateBoostParticles(dt);

  const allCars = [myCar].concat(Object.values(otherCars));
  Physics.updateBall(ball, allCars, dt);

  // Spin ball
  if (ball && ball.userData.velocity) {
    const v = ball.userData.velocity;
    ball.rotation.x += v.z * 0.02;
    ball.rotation.z -= v.x * 0.02;
  }

  const scored = Physics.checkGoal(ball);
  if (scored) onGoal(scored);

  // Network sync
  const now = performance.now();
  if (Network.mode === "multi" && myCar && now - lastPosSend > 50) {
    lastPosSend = now;
    Network.sendPosition({
      x: myCar.position.x, y: myCar.position.y, z: myCar.position.z,
      ry: myCar.rotation.y
    });
    if (Network.isHost && ball) {
      const v = ball.userData.velocity;
      Network.sendBall({ x: ball.position.x, y: ball.position.y, z: ball.position.z, vx: v.x, vy: v.y, vz: v.z });
    }
  }

  // Camera – smoother follow with slight lag
  if (myCar) {
    const offset = new THREE.Vector3(0, 10, 20).applyQuaternion(myCar.quaternion);
    camera.position.lerp(myCar.position.clone().add(offset), 0.06);
    camera.lookAt(myCar.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
  }

  renderer.render(scene, camera);
}

init();
