// Rocket League – Solo + Free Multiplayer (PeerJS)

let username = localStorage.getItem("rl_username") || "";
let password = localStorage.getItem("rl_password") || "";
let blueScore = 0, orangeScore = 0, matchTime = 300, matchRunning = false, boost = 100;
let scene, camera, renderer, clock, ball, myCar;
let keys = {};
let lastGoalTime = 0;
let otherCars = {};          // peerId -> car mesh
let lastPosSend = 0;

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
    document.getElementById("welcomeText").textContent = "Welcome, " + username;
    Network.init(username);
  };

  document.getElementById("soloBtn").onclick = () => startMatch("solo");
  document.getElementById("createRoomBtn").onclick = () => startMatch("create");
  document.getElementById("joinRoomBtn").onclick = () => {
    document.getElementById("roomCodeInput").classList.remove("hidden");
    document.getElementById("confirmJoinBtn").classList.remove("hidden");
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
    document.getElementById("welcomeText").textContent = "Welcome, " + username;
    Network.init(username);
  }
}

function startMatch(mode, code) {
  mainMenu.classList.add("hidden");
  hud.classList.remove("hidden");

  Network.onPlayerJoin = (id, player) => {
    spawnOtherCar(id, player);
    updatePlayerList();
    setStatus(player.name + " joined!");
    setTimeout(() => setStatus(""), 2000);
  };

  Network.onPlayerLeave = (id) => {
    if (otherCars[id]) {
      scene.remove(otherCars[id]);
      delete otherCars[id];
    }
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
      if (ball.userData.velocity) {
        ball.userData.velocity.set(data.vx || 0, data.vy || 0, data.vz || 0);
      }
    }
    if (data.type === "score") {
      blueScore = data.blue || 0;
      orangeScore = data.orange || 0;
      document.getElementById("blueScore").textContent = blueScore;
      document.getElementById("orangeScore").textContent = orangeScore;
    }
    if (data.type === "welcome") {
      blueScore = data.blue || 0;
      orangeScore = data.orange || 0;
      document.getElementById("blueScore").textContent = blueScore;
      document.getElementById("orangeScore").textContent = orangeScore;
      updatePlayerList();
      // Spawn cars for existing players
      for (const id in data.players) {
        if (id !== Network.myId && !otherCars[id]) {
          spawnOtherCar(id, data.players[id]);
        }
      }
    }
  };

  if (mode === "solo") {
    setStatus("Solo Practice");
    Network.startSolo(() => beginGame());
  } else if (mode === "create") {
    setStatus("Creating room...");
    Network.createRoom(
      (room) => {
        setStatus("Room: " + room + "  –  share this code!");
        beginGame();
      },
      (err) => {
        setStatus("Failed to create room");
        console.error(err);
      }
    );
  } else if (mode === "join") {
    setStatus("Joining " + code + "...");
    Network.joinRoom(
      code,
      () => {
        setStatus("Joined " + code);
        beginGame();
      },
      (err) => {
        setStatus("Could not join room");
        alert("Could not join room. Check the code and try again.");
        console.error(err);
      }
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
  scene.background = new THREE.Color(0x6eb5e0);
  scene.fog = new THREE.Fog(0x6eb5e0, 90, 240);

  camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 400);
  camera.position.set(0, 14, 32);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  const hemi = new THREE.HemisphereLight(0xffffff, 0x334455, 0.85);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.15);
  dir.position.set(40, 60, 25);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  scene.add(dir);

  window.addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

function createArena() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 80),
    new THREE.MeshStandardMaterial({ color: 0x2a8c3e, roughness: 0.85 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 80),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  line.rotation.x = -Math.PI / 2;
  line.position.y = 0.02;
  scene.add(line);

  makeGoal(-55, 0x3b9eff);
  makeGoal(55, 0xff8c2a);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x445566, transparent: true, opacity: 0.35 });
  [[0, 12, -40, 120, 24, 1], [0, 12, 40, 120, 24, 1], [-60, 12, 0, 1, 24, 80], [60, 12, 0, 1, 24, 80]].forEach(p => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(p[3], p[4], p[5]), wallMat);
    w.position.set(p[0], p[1], p[2]);
    scene.add(w);
  });
}

function makeGoal(x, color) {
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.3 });
  const post = new THREE.BoxGeometry(0.8, 9, 0.8);
  const l = new THREE.Mesh(post, mat); l.position.set(x, 4.5, -12); scene.add(l);
  const r = new THREE.Mesh(post, mat); r.position.set(x, 4.5, 12); scene.add(r);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 25), mat); top.position.set(x, 9, 0); scene.add(top);
}

function createBall() {
  ball = new THREE.Mesh(
    new THREE.SphereGeometry(Physics.BALL_RADIUS, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.35, metalness: 0.1 })
  );
  ball.castShadow = true;
  ball.userData.velocity = new THREE.Vector3();
  Physics.resetBall(ball);
  scene.add(ball);
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
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.75, 3.6),
    new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.4 })
  );
  body.castShadow = true;
  g.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.55, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x222233, metalness: 0.5, roughness: 0.2 })
  );
  cabin.position.y = 0.55;
  cabin.position.z = 0.2;
  g.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.38, 14);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  [[-1.15, -0.15, 1.15], [1.15, -0.15, 1.15], [-1.15, -0.15, -1.15], [1.15, -0.15, -1.15]].forEach(pos => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(...pos);
    g.add(w);
  });
  return g;
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
  let html = "<b>Players</b><br>";
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

  setTimeout(() => setStatus(""), 2000);
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

  boost = Physics.updateCar(myCar, getInput(), dt, boost);
  document.getElementById("boostFill").style.width = boost + "%";

  // All cars for ball collision
  const allCars = [myCar].concat(Object.values(otherCars));
  Physics.updateBall(ball, allCars, dt);

  const scored = Physics.checkGoal(ball);
  if (scored) onGoal(scored);

  // Send my position ~20 times per second
  const now = performance.now();
  if (Network.mode === "multi" && myCar && now - lastPosSend > 50) {
    lastPosSend = now;
    Network.sendPosition({
      x: myCar.position.x,
      y: myCar.position.y,
      z: myCar.position.z,
      ry: myCar.rotation.y
    });

    // Host also sends ball state
    if (Network.isHost && ball) {
      const v = ball.userData.velocity;
      Network.sendBall({
        x: ball.position.x,
        y: ball.position.y,
        z: ball.position.z,
        vx: v.x, vy: v.y, vz: v.z
      });
    }
  }

  // Camera follow
  if (myCar) {
    const offset = new THREE.Vector3(0, 9, 18).applyQuaternion(myCar.quaternion);
    camera.position.lerp(myCar.position.clone().add(offset), 0.07);
    camera.lookAt(myCar.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
  }

  renderer.render(scene, camera);
}

init();
