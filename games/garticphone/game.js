/*
  Gartic Phone - simple multiplayer prototype
  Uses Supabase Realtime Presence + Broadcast.
  No database tables are required for this version.
*/

const SUPABASE_URL = "https://degilckgjfdnekszsbry.supabase.co";
const SUPABASE_KEY = "sb_publishable_ym_oqKIyxwk7ixxCvwNCmA_w2VtnpdP";

const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 20 } }
});

const CONFIG = {
  drawSeconds: 30,
  guessSeconds: 20,
  rounds: 3,
  canvasWidth: 760,
  canvasHeight: 500
};

const PROMPTS = [
  "A cat stealing pizza",
  "A wizard stuck in traffic",
  "A shark wearing sunglasses",
  "A tiny dragon at school",
  "A robot eating spaghetti",
  "A haunted toaster",
  "A dog becoming president",
  "A very suspicious banana",
  "A knight fighting a chicken",
  "A UFO picking up a cow",
  "A ghost playing basketball",
  "A dinosaur doing homework",
  "A giant duck in a city",
  "A superhero forgetting their powers",
  "A penguin running a restaurant",
  "A vampire afraid of the dark",
  "A pirate finding a treasure chest",
  "A monster under a bed asking for snacks",
  "A sleepy alien at the beach",
  "A ninja doing karaoke",
  "A frog becoming a detective",
  "A hamster driving a race car",
  "A wizard accidentally summoning a sandwich",
  "A cowboy riding a giant snail",
  "A skeleton trying to play football",
  "A monkey building a computer",
  "A dragon ordering fast food",
  "A witch losing her broom",
  "A chicken discovering a time machine",
  "A superhero battling a giant vacuum"
];

const screens = {
  home: document.getElementById("screen-home"),
  lobby: document.getElementById("screen-lobby"),
  draw: document.getElementById("screen-draw"),
  guess: document.getElementById("screen-guess"),
  results: document.getElementById("screen-results"),
  gameover: document.getElementById("screen-gameover")
};

const els = {
  nameInput: document.getElementById("nameInput"),
  roomInput: document.getElementById("roomInput"),
  createBtn: document.getElementById("createBtn"),
  joinBtn: document.getElementById("joinBtn"),
  homeStatus: document.getElementById("homeStatus"),
  roomCodeDisplay: document.getElementById("roomCodeDisplay"),
  copyRoomBtn: document.getElementById("copyRoomBtn"),
  playerCount: document.getElementById("playerCount"),
  playerList: document.getElementById("playerList"),
  startBtn: document.getElementById("startBtn"),
  lobbyStatus: document.getElementById("lobbyStatus"),
  roundNumber: document.getElementById("roundNumber"),
  phaseTitle: document.getElementById("phaseTitle"),
  timer: document.getElementById("timer"),
  promptText: document.getElementById("promptText"),
  drawCanvas: document.getElementById("drawCanvas"),
  clearCanvasBtn: document.getElementById("clearCanvasBtn"),
  submitDrawingBtn: document.getElementById("submitDrawingBtn"),
  drawStatus: document.getElementById("drawStatus"),
  guessRoundNumber: document.getElementById("guessRoundNumber"),
  guessTimer: document.getElementById("guessTimer"),
  guessImage: document.getElementById("guessImage"),
  guessInput: document.getElementById("guessInput"),
  submitGuessBtn: document.getElementById("submitGuessBtn"),
  guessStatus: document.getElementById("guessStatus"),
  resultRoundNumber: document.getElementById("resultRoundNumber"),
  resultsList: document.getElementById("resultsList"),
  nextRoundBtn: document.getElementById("nextRoundBtn"),
  resultsStatus: document.getElementById("resultsStatus"),
  finalResults: document.getElementById("finalResults"),
  returnLobbyBtn: document.getElementById("returnLobbyBtn"),
  toast: document.getElementById("toast")
};

let roomCode = "";
let clientId = crypto.randomUUID();
let playerName = "";
let channel = null;
let localState = null;
let players = [];
let timerHandle = null;
let lastRenderedPhase = "";
let submittedDrawing = false;
let submittedGuess = false;
let currentBrushColor = "#111111";
let currentBrushSize = 5;
let drawing = false;
let lastPoint = null;

const ctx = els.drawCanvas.getContext("2d", { alpha: false });

function setStatus(element, message, type = "") {
  element.textContent = message || "";
  element.className = "status" + (type ? " " + type : "");
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(function () {
    els.toast.classList.remove("show");
  }, 1800);
}

function showScreen(name) {
  Object.values(screens).forEach(function (screen) {
    screen.classList.remove("active");
  });
  screens[name].classList.add("active");
}

function sanitizeName(value) {
  const clean = String(value || "").trim().replace(/[^a-zA-Z0-9 _-]/g, "");
  return clean.slice(0, 18);
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getPlayersFromPresence() {
  if (!channel) return [];
  const state = channel.presenceState();
  const list = [];

  Object.keys(state).forEach(function (presenceKey) {
    const entries = state[presenceKey] || [];
    const latest = entries[entries.length - 1];
    if (!latest || !latest.clientId) return;
    list.push({
      id: latest.clientId,
      name: latest.name || "Player",
      joinedAt: Number(latest.joinedAt) || 0
    });
  });

  list.sort(function (a, b) {
    return a.joinedAt - b.joinedAt || a.id.localeCompare(b.id);
  });
  return list;
}

function isHost() {
  return localState && localState.hostId === clientId;
}

function currentPlayerIds() {
  return players.map(function (player) { return player.id; });
}

function resetCanvas() {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
}

function setupCanvas() {
  resetCanvas();

  els.drawCanvas.addEventListener("pointerdown", function (event) {
    if (!localState || localState.phase !== "draw" || submittedDrawing) return;
    drawing = true;
    els.drawCanvas.setPointerCapture(event.pointerId);
    lastPoint = getCanvasPoint(event);
  });

  els.drawCanvas.addEventListener("pointermove", function (event) {
    if (!drawing || submittedDrawing) return;
    const point = getCanvasPoint(event);
    drawLine(lastPoint, point);
    lastPoint = point;
  });

  ["pointerup", "pointercancel", "pointerleave"].forEach(function (name) {
    els.drawCanvas.addEventListener(name, function () {
      drawing = false;
      lastPoint = null;
    });
  });
}

function getCanvasPoint(event) {
  const rect = els.drawCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (CONFIG.canvasWidth / rect.width),
    y: (event.clientY - rect.top) * (CONFIG.canvasHeight / rect.height)
  };
}

function drawLine(from, to) {
  if (!from || !to) return;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = currentBrushColor;
  ctx.lineWidth = currentBrushSize;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

function resizeCanvasForDisplay() {
  els.drawCanvas.width = CONFIG.canvasWidth;
  els.drawCanvas.height = CONFIG.canvasHeight;
  resetCanvas();
}

function canvasToDataURL() {
  return els.drawCanvas.toDataURL("image/jpeg", 0.72);
}

async function ensureChannel() {
  if (channel) return;

  const topic = "gartic-phone-" + roomCode;
  channel = supabase.channel(topic, {
    config: {
      presence: { key: clientId },
      broadcast: { self: false }
    }
  });

  channel.on("presence", { event: "sync" }, async function () {
    players = getPlayersFromPresence();
    renderPlayers();

    if (isHost()) {
      await maybeRecoverHostState();
      broadcastState();
    }
  });

  channel.on("presence", { event: "join" }, function () {
    players = getPlayersFromPresence();
    renderPlayers();
    if (isHost()) broadcastState();
  });

  channel.on("presence", { event: "leave" }, async function () {
    players = getPlayersFromPresence();
    renderPlayers();

    if (localState && localState.hostId && !currentPlayerIds().includes(localState.hostId)) {
      const nextHost = players[0];
      if (nextHost && nextHost.id === clientId) {
        localState.hostId = clientId;
        if (localState.phase === "lobby") {
          broadcastState();
        } else {
          // A full authoritative recovery is intentionally kept simple.
          localState.phase = "lobby";
          localState.round = 1;
          localState.promptByPlayer = {};
          localState.drawings = {};
          localState.guesses = {};
          localState.assignments = {};
          broadcastState();
          toast("The old host left. You are the new host.");
        }
      }
    }

    if (isHost()) broadcastState();
  });

  channel.on("broadcast", { event: "game_state" }, function (message) {
    if (!message || !message.payload || !message.payload.state) return;
    localState = message.payload.state;
    renderFromState();
  });

  channel.on("broadcast", { event: "request_state" }, function (message) {
    if (!isHost()) return;
    const requester = message && message.payload && message.payload.clientId;
    if (requester) broadcastState();
  });

  channel.on("broadcast", { event: "start_game" }, function (message) {
    if (!isHost()) return;
    if (localState.phase !== "lobby") return;
    startRound(1);
  });

  channel.on("broadcast", { event: "submit_drawing" }, function (message) {
    if (!isHost() || !localState || localState.phase !== "draw") return;
    const payload = message && message.payload;
    if (!payload || !payload.clientId || typeof payload.image !== "string") return;
    if (!currentPlayerIds().includes(payload.clientId)) return;
    localState.drawings[payload.clientId] = payload.image;

    if (allSubmitted(localState.drawings)) {
      startGuessPhase();
    } else {
      broadcastState();
    }
  });

  channel.on("broadcast", { event: "submit_guess" }, function (message) {
    if (!isHost() || !localState || localState.phase !== "guess") return;
    const payload = message && message.payload;
    if (!payload || !payload.clientId) return;
    if (!currentPlayerIds().includes(payload.clientId)) return;
    localState.guesses[payload.clientId] = String(payload.guess || "").slice(0, 80);

    if (allSubmitted(localState.guesses)) {
      finishRound();
    } else {
      broadcastState();
    }
  });

  channel.on("broadcast", { event: "next_round" }, function () {
    if (!isHost()) return;
    if (localState.phase !== "results") return;
    if (localState.round >= CONFIG.rounds) {
      localState.phase = "gameover";
      broadcastState();
      return;
    }
    startRound(localState.round + 1);
  });

  const status = await new Promise(function (resolve) {
    let settled = false;
    channel.subscribe(async function (value, error) {
      if (settled) return;
      if (value === "SUBSCRIBED") {
        settled = true;
        resolve("SUBSCRIBED");
        return;
      }
      if (value === "CHANNEL_ERROR" || value === "TIMED_OUT" || value === "CLOSED") {
        settled = true;
        resolve(value);
        console.error("Supabase channel status:", value, error || "");
      }
    });
  });

  if (status !== "SUBSCRIBED") {
    throw new Error("Realtime channel failed: " + status);
  }

  await channel.track({
    clientId,
    name: playerName,
    joinedAt: Date.now()
  });

  players = getPlayersFromPresence();

  // The first connected player becomes the host for a new room.
  // An existing host will already have broadcast its state to us.
  if (!localState && players.length > 0 && players[0].id === clientId) {
    localState = initialState();
    broadcastState();
    renderFromState();
  } else {
    renderPlayers();
  }
}

function initialState() {
  return {
    phase: "lobby",
    hostId: clientId,
    round: 0,
    promptByPlayer: {},
    drawings: {},
    guesses: {},
    assignments: {},
    phaseEndsAt: 0
  };
}

function maybeRecoverHostState() {
  if (localState) return;
  localState = initialState();
}

function broadcastState() {
  if (!channel || !localState) return;
  channel.send({
    type: "broadcast",
    event: "game_state",
    payload: { state: localState }
  }).catch(function (error) {
    console.error("State broadcast failed:", error);
  });
}

function sendEvent(event, payload) {
  if (!channel) return;
  channel.send({
    type: "broadcast",
    event,
    payload
  }).catch(function (error) {
    console.error("Broadcast failed:", error);
    toast("Connection hiccup. Try again.");
  });
}

function renderPlayers() {
  els.playerCount.textContent = String(players.length);
  els.playerList.innerHTML = "";

  players.forEach(function (player) {
    const row = document.createElement("div");
    row.className = "player";

    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name + (player.id === clientId ? " (you)" : "");

    row.appendChild(name);

    if (localState && player.id === localState.hostId) {
      const badge = document.createElement("div");
      badge.className = "badge";
      badge.textContent = "HOST";
      row.appendChild(badge);
    }

    els.playerList.appendChild(row);
  });

  const host = localState && localState.hostId === clientId;
  els.startBtn.style.display = host ? "block" : "none";
  if (!host) setStatus(els.lobbyStatus, "Waiting for the host to start...", "good");
}

function randomPrompt() {
  return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
}

function createPromptAssignments() {
  const map = {};
  const used = [];

  players.forEach(function (player) {
    let prompt = randomPrompt();
    let tries = 0;
    while (used.includes(prompt) && tries < 20) {
      prompt = randomPrompt();
      tries += 1;
    }
    used.push(prompt);
    map[player.id] = prompt;
  });

  return map;
}

function startRound(round) {
  if (!isHost()) return;
  if (players.length < 2) {
    setStatus(els.lobbyStatus, "You need at least 2 players.", "error");
    return;
  }

  submittedDrawing = false;
  submittedGuess = false;
  localState = {
    phase: "draw",
    hostId: clientId,
    round,
    promptByPlayer: createPromptAssignments(),
    drawings: {},
    guesses: {},
    assignments: {},
    phaseEndsAt: Date.now() + CONFIG.drawSeconds * 1000
  };
  broadcastState();
  renderFromState();
}

function startGuessPhase() {
  if (!isHost()) return;
  const ids = currentPlayerIds();
  if (ids.length < 2) {
    finishRound();
    return;
  }

  const shuffled = ids.slice().sort(function () { return Math.random() - 0.5; });
  const assignments = {};
  ids.forEach(function (id, index) {
    let target = shuffled[(index + 1) % shuffled.length];
    if (target === id) target = ids.find(function (candidate) { return candidate !== id; }) || id;
    assignments[id] = target;
  });

  localState.phase = "guess";
  localState.assignments = assignments;
  localState.guesses = {};
  localState.phaseEndsAt = Date.now() + CONFIG.guessSeconds * 1000;
  broadcastState();
  renderFromState();
}

function finishRound() {
  if (!isHost()) return;
  localState.phase = "results";
  localState.phaseEndsAt = 0;
  broadcastState();
  renderFromState();
}

function allSubmitted(object) {
  const ids = currentPlayerIds();
  return ids.length > 0 && ids.every(function (id) {
    return Object.prototype.hasOwnProperty.call(object, id);
  });
}

function renderFromState() {
  if (!localState) return;

  if (localState.phase !== lastRenderedPhase) {
    lastRenderedPhase = localState.phase;
    clearInterval(timerHandle);
    timerHandle = null;
  }

  players = getPlayersFromPresence();
  els.startBtn.style.display = isHost() ? "block" : "none";

  if (localState.phase === "lobby") {
    showScreen("lobby");
    els.roomCodeDisplay.textContent = roomCode;
    els.startBtn.textContent = players.length >= 2 ? "Start Game" : "Need 2 Players";
    els.startBtn.disabled = !isHost() || players.length < 2;
    setStatus(els.lobbyStatus, isHost() ? "You are the host." : "Waiting for the host to start...", isHost() ? "good" : "");
    renderPlayers();
    return;
  }

  if (localState.phase === "draw") {
    showScreen("draw");
    els.roundNumber.textContent = String(localState.round);
    els.phaseTitle.textContent = "DRAW!";
    els.promptText.textContent = localState.promptByPlayer[clientId] || "Draw anything!";
    els.submitDrawingBtn.disabled = submittedDrawing;
    setStatus(els.drawStatus, submittedDrawing ? "Drawing submitted. Waiting for everyone..." : "Draw the prompt before the timer hits zero.", submittedDrawing ? "good" : "");
    ensureDrawTimer();
    return;
  }

  if (localState.phase === "guess") {
    showScreen("guess");
    els.guessRoundNumber.textContent = String(localState.round);
    const targetId = localState.assignments[clientId];
    const image = targetId ? localState.drawings[targetId] : null;
    els.guessImage.src = image || blankImage();
    els.submitGuessBtn.disabled = submittedGuess;
    els.guessInput.disabled = submittedGuess;
    setStatus(els.guessStatus, submittedGuess ? "Guess submitted. Waiting for everyone..." : "What did they draw?", submittedGuess ? "good" : "");
    ensureGuessTimer();
    return;
  }

  if (localState.phase === "results") {
    showScreen("results");
    els.resultRoundNumber.textContent = String(localState.round);
    renderResults(els.resultsList);
    els.nextRoundBtn.style.display = isHost() ? "block" : "none";
    els.nextRoundBtn.disabled = !isHost();
    setStatus(els.resultsStatus, isHost() ? "Start the next round when everyone is ready." : "Waiting for the host...", isHost() ? "good" : "");
    return;
  }

  if (localState.phase === "gameover") {
    showScreen("gameover");
    renderResults(els.finalResults);
    return;
  }
}

function ensureDrawTimer() {
  if (timerHandle) clearInterval(timerHandle);
  updateDrawTimer();
  timerHandle = setInterval(updateDrawTimer, 250);
}

function updateDrawTimer() {
  if (!localState || localState.phase !== "draw") return;
  const remaining = Math.max(0, localState.phaseEndsAt - Date.now());
  els.timer.textContent = String(Math.ceil(remaining / 1000));
  if (remaining <= 0) {
    clearInterval(timerHandle);
    timerHandle = null;
    submitDrawing();
  }
}

function ensureGuessTimer() {
  if (timerHandle) clearInterval(timerHandle);
  updateGuessTimer();
  timerHandle = setInterval(updateGuessTimer, 250);
}

function updateGuessTimer() {
  if (!localState || localState.phase !== "guess") return;
  const remaining = Math.max(0, localState.phaseEndsAt - Date.now());
  els.guessTimer.textContent = String(Math.ceil(remaining / 1000));
  if (remaining <= 0) {
    clearInterval(timerHandle);
    timerHandle = null;
    submitGuess();
  }
}

function submitDrawing() {
  if (!localState || localState.phase !== "draw" || submittedDrawing) return;
  submittedDrawing = true;
  const image = canvasToDataURL();
  sendEvent("submit_drawing", { clientId, image });
  renderFromState();
}

function submitGuess() {
  if (!localState || localState.phase !== "guess" || submittedGuess) return;
  submittedGuess = true;
  const guess = els.guessInput.value.trim() || "No idea 😭";
  sendEvent("submit_guess", { clientId, guess });
  renderFromState();
}

function renderResults(container) {
  container.innerHTML = "";
  const ids = currentPlayerIds();

  ids.forEach(function (playerId) {
    const image = localState.drawings[playerId];
    if (!image) return;

    const card = document.createElement("div");
    card.className = "result-card";

    const img = document.createElement("img");
    img.src = image;
    img.alt = "Drawing by player";

    const info = document.createElement("div");
    info.className = "result-info";

    const pLabel = document.createElement("div");
    pLabel.className = "result-label";
    pLabel.textContent = "Original prompt";

    const prompt = document.createElement("div");
    prompt.className = "result-prompt";
    prompt.textContent = localState.promptByPlayer[playerId] || "Unknown prompt";

    const guessedBy = ids.filter(function (otherId) {
      return localState.assignments[otherId] === playerId;
    });

    info.appendChild(pLabel);
    info.appendChild(prompt);

    guessedBy.forEach(function (guesserId) {
      const gLabel = document.createElement("div");
      gLabel.className = "result-label";
      gLabel.textContent = playerNameFor(guesserId) + " guessed";

      const guess = document.createElement("div");
      guess.className = "result-guess";
      guess.textContent = localState.guesses[guesserId] || "No guess submitted.";

      info.appendChild(gLabel);
      info.appendChild(guess);
    });

    card.appendChild(img);
    card.appendChild(info);
    container.appendChild(card);
  });
}

function playerNameFor(id) {
  const player = players.find(function (candidate) { return candidate.id === id; });
  return player ? player.name : "Player";
}

function blankImage() {
  const temp = document.createElement("canvas");
  temp.width = 760;
  temp.height = 500;
  const tempCtx = temp.getContext("2d");
  tempCtx.fillStyle = "#ffffff";
  tempCtx.fillRect(0, 0, temp.width, temp.height);
  return temp.toDataURL("image/jpeg", 0.7);
}

function returnToLobby() {
  if (!isHost()) return;
  localState = initialState();
  broadcastState();
  renderFromState();
}

async function enterRoom(code) {
  playerName = sanitizeName(els.nameInput.value);
  roomCode = String(code || "").trim().toUpperCase();

  if (!playerName) {
    setStatus(els.homeStatus, "Enter a name first.", "error");
    return;
  }
  if (!/^[A-Z0-9]{5}$/.test(roomCode)) {
    setStatus(els.homeStatus, "Room codes are 5 characters.", "error");
    return;
  }

  clientId = crypto.randomUUID();
  localState = null;
  lastRenderedPhase = "";
  submittedDrawing = false;
  submittedGuess = false;

  setStatus(els.homeStatus, "Connecting to room...", "");
  els.createBtn.disabled = true;
  els.joinBtn.disabled = true;

  try {
    await ensureChannel();
    showScreen("lobby");
    els.roomCodeDisplay.textContent = roomCode;
    sendEvent("request_state", { clientId });
    setStatus(els.lobbyStatus, "Connected.", "good");
    renderPlayers();
  } catch (error) {
    console.error(error);
    setStatus(els.homeStatus, "Could not connect to the room: " + (error.message || error), "error");
    await leaveRoom();
  } finally {
    els.createBtn.disabled = false;
    els.joinBtn.disabled = false;
  }
}

async function leaveRoom() {
  clearInterval(timerHandle);
  timerHandle = null;
  if (channel) {
    try { await channel.untrack(); } catch (_) {}
    try { await supabase.removeChannel(channel); } catch (_) {}
  }
  channel = null;
  localState = null;
  players = [];
  roomCode = "";
  showScreen("home");
}

els.createBtn.addEventListener("click", function () {
  enterRoom(makeRoomCode());
});

els.joinBtn.addEventListener("click", function () {
  enterRoom(els.roomInput.value);
});

els.roomInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") els.joinBtn.click();
});

els.nameInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") els.createBtn.click();
});

els.copyRoomBtn.addEventListener("click", async function () {
  try {
    await navigator.clipboard.writeText(roomCode);
    toast("Room code copied.");
  } catch (_) {
    toast(roomCode);
  }
});

els.startBtn.addEventListener("click", function () {
  if (!isHost() || players.length < 2) return;
  sendEvent("start_game", { clientId });
  startRound(1);
});

els.clearCanvasBtn.addEventListener("click", function () {
  if (submittedDrawing) return;
  resetCanvas();
});

els.submitDrawingBtn.addEventListener("click", submitDrawing);
els.submitGuessBtn.addEventListener("click", submitGuess);

els.guessInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") submitGuess();
});

els.nextRoundBtn.addEventListener("click", function () {
  if (!isHost()) return;
  sendEvent("next_round", { clientId });
  if (localState.round >= CONFIG.rounds) {
    localState.phase = "gameover";
    broadcastState();
    renderFromState();
  } else {
    startRound(localState.round + 1);
  }
});

els.returnLobbyBtn.addEventListener("click", returnToLobby);

document.querySelectorAll(".swatch").forEach(function (button) {
  button.addEventListener("click", function () {
    document.querySelectorAll(".swatch").forEach(function (other) { other.classList.remove("active"); });
    button.classList.add("active");
    currentBrushColor = button.dataset.color;
  });
});

document.querySelectorAll(".size").forEach(function (button) {
  button.addEventListener("click", function () {
    document.querySelectorAll(".size").forEach(function (other) { other.classList.remove("active"); });
    button.classList.add("active");
    currentBrushSize = Number(button.dataset.size) || 5;
  });
});

window.addEventListener("beforeunload", function () {
  if (channel) channel.untrack().catch(function () {});
});

setupCanvas();
resizeCanvasForDisplay();

// Helpful startup message in the page rather than failing silently.
if (!window.supabase) {
  setStatus(els.homeStatus, "Supabase failed to load. Refresh the page.", "error");
}
