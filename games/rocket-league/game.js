// ======================================================
// Rocket League Multiplayer Prototype
// Photon App ID: e42a4126-88d9-4075-b4f2-6cfa9a885e05
// ======================================================

const PHOTON_APP_ID = "e42a4126-88d9-4075-b4f2-6cfa9a885e05";

// ---------- State ----------
let username = localStorage.getItem("rl_username") || "";
let password = localStorage.getItem("rl_password") || "";
let photonClient = null;
let isConnected = false;
let currentRoom = null;
let myActorNr = 0;
let players = {};          // actorNr -> { name, team, car, score }
let blueScore = 0;
let orangeScore = 0;
let matchTime = 300;      // 5 minutes
let matchRunning = false;
let boost = 100;

// Three.js
let scene, camera, renderer, clock;
let arena, ball, myCar;
let otherCars = {};
let keys = {};

// ---------- DOM ----------
const loginScreen = document.getElementById("loginScreen");
const mainMenu = document.getElementById("mainMenu");
const leaderboardScreen = document.getElementById("leaderboardScreen");
const hud = document.getElementById("hud");
const canvas = document.getElementById("gameCanvas");

// ---------- Init ----------
function init() {
  // Login form
  document.getElementById("usernameInput").value = username;
  document.getElementById("passwordInput").value = password;

  document.getElementById("playBtn").onclick = () => {
    const u = document.getElementById("usernameInput").value.trim();
    const p = document.getElementById("passwordInput").value;
    if (!u) {
      alert("Please enter a username");
      return;
    }
    username = u;
    password = p;
    localStorage.setItem("rl_username", username);
    localStorage.setItem("rl_password", password);
    loginScreen.classList.add("hidden");
    mainMenu.classList.remove("hidden");
    document.getElementById("welcomeText").textContent = "Welcome, " + username;
    initPhoton();
  };

  document.getElementById("quickMatchBtn").onclick = () => joinOrCreateRoom("quick");
  document.getElementById("createRoomBtn").onclick = () => joinOrCreateRoom("private");
  document.getElementById("joinRoomBtn").onclick = () => {
    document.getElementById("roomCodeInput").classList.remove("hidden");
    document.getElementById("confirmJoinBtn").classList.remove("hidden");
  };
  document.getElementById("confirmJoinBtn").onclick = () => {
    const code = document.getElementById("roomCodeInput").value.trim().toUpperCase();
    if (code) joinOrCreateRoom(code);
  };
  document.getElementById("leaderboardBtn").onclick = showLeaderboard;
  document.getElementById("closeLbBtn").onclick = () => leaderboardScreen.classList.add("hidden");
  document.getElementById("logoutBtn").onclick = () => {
    localStorage.removeItem("rl_username");
    localStorage.removeItem("rl_password");
    location.reload();
  };

  // Keyboard
  window.addEventListener("keydown", e => keys[e.code] = true);
  window.addEventListener("keyup", e => keys[e.code] = false);

  // If already logged in, skip login
  if (username) {
    loginScreen.classList.add("hidden");
    mainMenu.classList.remove("hidden");
    document.getElementById("welcomeText").textContent = "Welcome, " + username;
    initPhoton();
  }
}

// ---------- Photon ----------
function initPhoton() {
  if (typeof Photon === "undefined") {
    console.error("Photon SDK not loaded");
    setStatus("Photon SDK failed to load");
    return;
  }

  // Use Photon LoadBalancing Client
  photonClient = new Photon.LoadBalancing.LoadBalancingClient(Photon.ConnectionProtocol.Wss, PHOTON_APP_ID, "1.0");
  
  photonClient.onStateChange = function(state) {
    const name = Photon.LoadBalancing.LoadBalancingClient.StateToName(state);
    console.log("Photon state:", name);
    if (state === Photon.LoadBalancing.LoadBalancingClient.State.Joined) {
      isConnected = true;
      myActorNr = photonClient.myActor().actorNr;
      setStatus("Joined room – waiting for players...");
      startGame();
    }
  };

  photonClient.onRoomList = function(rooms) {
    console.log("Rooms:", rooms);
  };

  photonClient.onJoinRoom = function() {
    console.log("Joined room", photonClient.myRoom().name);
  };

  photonClient.onActorJoin = function(actor) {
    console.log("Actor joined", actor.actorNr, actor.name);
    addPlayer(actor);
  };

  photonClient.onActorLeave = function(actor) {
    console.log("Actor left", actor.actorNr);
    removePlayer(actor.actorNr);
  };

  photonClient.onEvent = function(code, content, actorNr) {
    handlePhotonEvent(code, content, actorNr);
  };

  photonClient.connectToRegionMaster("us"); // or "eu", "asia" etc.
}

function joinOrCreateRoom(type) {
  if (!photonClient) {
    alert("Still connecting to Photon...");
    return;
  }

  mainMenu.classList.add("hidden");
  hud.classList.remove("hidden");
  setStatus("Connecting...");

  const options = {
    isVisible: true,
    isOpen: true,
    maxPlayers: 8
  };

  if (type === "quick") {
    // Try to join any open room, otherwise create
    photonClient.joinRandomRoom({}, 0, false, options);
    // Fallback create after short delay if needed is handled by SDK callbacks in full implementation
    setTimeout(() => {
      if (!photonClient.isJoinedToRoom()) {
        const name = "RL_" + Math.random().toString(36).substring(2, 8).toUpperCase();
        photonClient.createRoom(name, options);
      }
    }, 1500);
  } else if (type === "private") {
    const name = "RL_" + Math.random().toString(36).substring(2, 8).toUpperCase();
    photonClient.createRoom(name, options);
    setStatus("Private room: " + name);
  } else {
    // Join specific code
    photonClient.joinRoom(type, options);
  }
}

function addPlayer(actor) {
  const team = (Object.keys(players).length % 2 === 0) ? "blue" : "orange";
  players[actor.actorNr] = {
    name: actor.name || ("Player" + actor.actorNr),
    team: team,
    score: 0
  };
  updatePlayerList();
}

function removePlayer(nr) {
  if (otherCars[nr]) {
    scene.remove(otherCars[nr]);
    delete otherCars[nr];
  }
  delete players[nr];
  updatePlayerList();
}

function updatePlayerList() {
  const el = document.getElementById("playerList");
  let html = "<b>Players</b><br>";
  for (const nr in players) {
    const p = players[nr];
    html += `<span style="color:${p.team === 'blue' ? '#4da6ff' : '#ff9a3c'}">${p.name}</span><br>`;
  }
  el.innerHTML = html;
}

function setStatus(msg) {
  document.getElementById("statusMsg").textContent = msg;
}

// ---------- Photon Events ----------
const EVT = {
  POS: 1,
  BALL: 2,
  SCORE: 3,
  BOOST: 4,
  CHAT: 5
};

function sendPosition() {
  if (!photonClient || !photonClient.isJoinedToRoom() || !myCar) return;
  photonClient.raiseEvent(EVT.POS, {
    x: myCar.position.x,
    y: myCar.position.y,
    z: myCar.position.z,
    rx: myCar.rotation.x,
    ry: myCar.rotation.y,
    rz: myCar.rotation.z,
    boost: boost
  }, { receivers: Photon.LoadBalancing.Constants.ReceiverGroup.Others });
}

function handlePhotonEvent(code, content, actorNr) {
  if (code === EVT.POS && otherCars[actorNr]) {
    const c = otherCars[actorNr];
    c.position.set(content.x, content.y, content.z);
    c.rotation.set(content.rx, content.ry, content.rz);
  }
  if (code === EVT.BALL && ball) {
    ball.position.set(content.x, content.y, content.z);
    if (content.vx !== undefined) {
      ball.userData.velocity.set(content.vx, content.vy, content.vz);
    }
  }
  if (code === EVT.SCORE) {
    blueScore = content.blue;
    orangeScore = content.orange;
    document.getElementById("blueScore").textContent = blueScore;
    document.getElementById("orangeScore").textContent = orangeScore;
  }
}

// ---------- Three.js Game ----------
function startGame() {
  initThree();
  createArena();
  createBall();
  createMyCar();
  matchRunning = true;
  clock = new THREE.Clock();
  animate();
  setInterval(sendPosition, 50); // 20 Hz
  setInterval(updateTimer, 1000);
}

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);
  scene.fog = new THREE.Fog(0x87CEEB, 80, 220);

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 12, 28);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  // Lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(30, 50, 20);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  scene.add(dir);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function createArena() {
  // Floor
  const floorGeo = new THREE.PlaneGeometry(120, 80);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2d8a3e, roughness: 0.8 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Field lines
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  // Center circle + line etc. simplified

  // Goals
  createGoal(-55, 0x4da6ff); // Blue
  createGoal(55, 0xff9a3c);  // Orange

  // Walls (invisible colliders later)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x555577, transparent: true, opacity: 0.25 });
  // Side walls, back walls simplified for prototype
}

function createGoal(x, color) {
  const postMat = new THREE.MeshStandardMaterial({ color });
  const postGeo = new THREE.BoxGeometry(1, 8, 1);
  const left = new THREE.Mesh(postGeo, postMat);
  left.position.set(x, 4, -12);
  scene.add(left);
  const right = new THREE.Mesh(postGeo, postMat);
  right.position.set(x, 4, 12);
  scene.add(right);
  const cross = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 25), postMat);
  cross.position.set(x, 8, 0);
  scene.add(cross);
}

function createBall() {
  const geo = new THREE.SphereGeometry(1.1, 32, 32);
  const mat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4, roughnessMap: null });
  ball = new THREE.Mesh(geo, mat);
  ball.position.set(0, 1.2, 0);
  ball.castShadow = true;
  ball.userData.velocity = new THREE.Vector3(0, 0, 0);
  scene.add(ball);
}

function createMyCar() {
  myCar = createCarMesh(0xffcc00);
  myCar.position.set(0, 0.6, 15);
  scene.add(myCar);
}

function createCarMesh(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.7, 3.4),
    new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.4 })
  );
  body.castShadow = true;
  group.add(body);

  // Simple wheels
  const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  [[-1.1, -0.2, 1.1], [1.1, -0.2, 1.1], [-1.1, -0.2, -1.1], [1.1, -0.2, -1.1]].forEach(pos => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(...pos);
    group.add(w);
  });

  return group;
}

// ---------- Controls & Physics (simplified) ----------
const SPEED = 0.35;
const TURN = 0.045;
const BOOST_FORCE = 0.55;
const GRAVITY = -0.025;

function updateCar(dt) {
  if (!myCar) return;

  let throttle = 0;
  let steer = 0;
  let boosting = false;

  if (keys["KeyW"] || keys["ArrowUp"]) throttle = 1;
  if (keys["KeyS"] || keys["ArrowDown"]) throttle = -0.6;
  if (keys["KeyA"] || keys["ArrowLeft"]) steer = 1;
  if (keys["KeyD"] || keys["ArrowRight"]) steer = -1;
  if (keys["ShiftLeft"] || keys["ShiftRight"]) boosting = true;

  // Boost
  if (boosting && boost > 0) {
    boost = Math.max(0, boost - 40 * dt);
    throttle *= 1.8;
  } else {
    boost = Math.min(100, boost + 12 * dt);
  }
  document.getElementById("boostFill").style.width = boost + "%";

  // Movement
  myCar.rotation.y += steer * TURN * (throttle !== 0 ? 1 : 0.5);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(myCar.quaternion);
  myCar.position.add(forward.multiplyScalar(throttle * SPEED));

  // Simple ground clamp
  myCar.position.y = 0.6;

  // Camera follow
  const camOffset = new THREE.Vector3(0, 8, 16).applyQuaternion(myCar.quaternion);
  camera.position.lerp(myCar.position.clone().add(camOffset), 0.08);
  camera.lookAt(myCar.position.clone().add(new THREE.Vector3(0, 1, 0)));
}

function updateBall(dt) {
  if (!ball) return;
  const v = ball.userData.velocity;

  // Gravity
  v.y += GRAVITY;

  // Integrate
  ball.position.add(v.clone().multiplyScalar(dt * 60));

  // Bounce floor
  if (ball.position.y < 1.1) {
    ball.position.y = 1.1;
    v.y *= -0.65;
    v.x *= 0.98;
    v.z *= 0.98;
  }

  // Simple walls
  if (Math.abs(ball.position.x) > 58) v.x *= -0.8;
  if (Math.abs(ball.position.z) > 38) v.z *= -0.8;

  // Car-ball collision (very basic)
  if (myCar) {
    const dist = ball.position.distanceTo(myCar.position);
    if (dist < 3.2) {
      const dir = ball.position.clone().sub(myCar.position).normalize();
      const force = 0.6 + (boost > 50 ? 0.4 : 0);
      v.add(dir.multiplyScalar(force));
      v.y += 0.15;
    }
  }

  // Goal detection
  if (ball.position.x < -55 && Math.abs(ball.position.z) < 12 && ball.position.y < 8) {
    // Orange scores
    orangeScore++;
    resetBall();
    broadcastScore();
  }
  if (ball.position.x > 55 && Math.abs(ball.position.z) < 12 && ball.position.y < 8) {
    blueScore++;
    resetBall();
    broadcastScore();
  }
}

function resetBall() {
  ball.position.set(0, 1.2, 0);
  ball.userData.velocity.set(0, 0, 0);
  document.getElementById("blueScore").textContent = blueScore;
  document.getElementById("orangeScore").textContent = orangeScore;
}

function broadcastScore() {
  if (photonClient && photonClient.isJoinedToRoom()) {
    photonClient.raiseEvent(EVT.SCORE, { blue: blueScore, orange: orangeScore }, { receivers: Photon.LoadBalancing.Constants.ReceiverGroup.All });
  }
  // Simple local leaderboard update
  updateLocalLeaderboard();
}

function updateTimer() {
  if (!matchRunning) return;
  matchTime--;
  if (matchTime < 0) matchTime = 0;
  const m = Math.floor(matchTime / 60);
  const s = matchTime % 60;
  document.getElementById("timer").textContent = m + ":" + (s < 10 ? "0" + s : s);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  updateCar(dt);
  updateBall(dt);
  renderer.render(scene, camera);
}

// ---------- Leaderboard (local + simple global structure) ----------
function updateLocalLeaderboard() {
  let lb = JSON.parse(localStorage.getItem("rl_leaderboard") || "{}");
  if (!lb[username]) lb[username] = { wins: 0, goals: 0, matches: 0 };
  lb[username].goals = (lb[username].goals || 0) + 1;
  lb[username].matches = (lb[username].matches || 0) + 1;
  localStorage.setItem("rl_leaderboard", JSON.stringify(lb));
}

function showLeaderboard() {
  const lb = JSON.parse(localStorage.getItem("rl_leaderboard") || "{}");
  const list = Object.entries(lb)
    .sort((a, b) => (b[1].goals || 0) - (a[1].goals || 0))
    .slice(0, 20);

  let html = "";
  if (list.length === 0) {
    html = "<p>No scores yet. Play some matches!</p>";
  } else {
    list.forEach(([name, data], i) => {
      html += `<div><span>#${i + 1} ${name}</span><span>${data.goals || 0} goals</span></div>`;
    });
  }
  document.getElementById("lbList").innerHTML = html;
  leaderboardScreen.classList.remove("hidden");
}

// Start
init();
