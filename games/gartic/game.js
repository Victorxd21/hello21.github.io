/*
  Gartic Phone – real telephone flow
  write → draw → describe → draw … → museum
  Supabase Realtime Presence + Broadcast
*/

const SUPABASE_URL = "https://vzavwyzkhjomlwxfbuxd.supabase.co";
const SUPABASE_KEY = "sb_publishable_ENkc-Up7Bt3SGKiVLeSRvw_K-aNmGQT";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 20 } }
});

const CONFIG = {
  writeSeconds: 40,
  drawSeconds: 50,
  canvasWidth: 640,
  canvasHeight: 400,
  jpegQuality: 0.45
};

const screens = {
  home: document.getElementById("screen-home"),
  lobby: document.getElementById("screen-lobby"),
  write: document.getElementById("screen-write"),
  draw: document.getElementById("screen-draw"),
  album: document.getElementById("screen-album")
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
  writeTurn: document.getElementById("writeTurn"),
  writeTitle: document.getElementById("writeTitle"),
  writeTimer: document.getElementById("writeTimer"),
  writeHintLabel: document.getElementById("writeHintLabel"),
  writeHintText: document.getElementById("writeHintText"),
  writeImageWrap: document.getElementById("writeImageWrap"),
  writeImage: document.getElementById("writeImage"),
  writeInput: document.getElementById("writeInput"),
  submitWriteBtn: document.getElementById("submitWriteBtn"),
  writeStatus: document.getElementById("writeStatus"),
  roundNumber: document.getElementById("roundNumber"),
  phaseTitle: document.getElementById("phaseTitle"),
  timer: document.getElementById("timer"),
  promptText: document.getElementById("promptText"),
  drawCanvas: document.getElementById("drawCanvas"),
  clearCanvasBtn: document.getElementById("clearCanvasBtn"),
  submitDrawingBtn: document.getElementById("submitDrawingBtn"),
  drawStatus: document.getElementById("drawStatus"),
  albumTitle: document.getElementById("albumTitle"),
  albumSubtitle: document.getElementById("albumSubtitle"),
  albumChain: document.getElementById("albumChain"),
  prevAlbumBtn: document.getElementById("prevAlbumBtn"),
  nextAlbumBtn: document.getElementById("nextAlbumBtn"),
  returnLobbyBtn: document.getElementById("returnLobbyBtn"),
  albumStatus: document.getElementById("albumStatus"),
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
let submitted = false;
let currentBrushColor = "#111111";
let currentBrushSize = 4;
let drawing = false;
let lastPoint = null;
let albumIndex = 0;

const ctx = els.drawCanvas.getContext("2d", { alpha: false });

function setStatus(el, message, type) {
  el.textContent = message || "";
  el.className = "status" + (type ? " " + type : "");
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
  Object.keys(screens).forEach(function (key) {
    screens[key].classList.remove("active");
  });
  screens[name].classList.add("active");
}

function sanitizeName(value) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 18);
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getPlayersFromPresence() {
  if (!channel) return [];
  const state = channel.presenceState();
  const list = [];
  Object.keys(state).forEach(function (key) {
    const entries = state[key] || [];
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
  if (localState && localState.hostId === clientId) return true;
  if (players.length > 0 && players[0].id === clientId) {
    if (localState) localState.hostId = clientId;
    return true;
  }
  return false;
}

function playerNameFor(id) {
  const p = players.find(function (x) { return x.id === id; });
  return p ? p.name : "Player";
}

function orderedIds() {
  return players.map(function (p) { return p.id; });
}

function resetCanvas() {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
}

function setupCanvas() {
  resetCanvas();
  els.drawCanvas.addEventListener("pointerdown", function (e) {
    if (!localState || localState.phase !== "draw" || submitted) return;
    drawing = true;
    els.drawCanvas.setPointerCapture(e.pointerId);
    lastPoint = getCanvasPoint(e);
  });
  els.drawCanvas.addEventListener("pointermove", function (e) {
    if (!drawing || submitted) return;
    const pt = getCanvasPoint(e);
    drawLine(lastPoint, pt);
    lastPoint = pt;
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
    els.drawCanvas.addEventListener(ev, function () {
      drawing = false;
      lastPoint = null;
    });
  });
}

function getCanvasPoint(e) {
  const rect = els.drawCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (CONFIG.canvasWidth / rect.width),
    y: (e.clientY - rect.top) * (CONFIG.canvasHeight / rect.height)
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

function canvasToDataURL() {
  return els.drawCanvas.toDataURL("image/jpeg", CONFIG.jpegQuality);
}

async function ensureChannel() {
  if (channel) return;
  const topic = "gartic-v3-" + roomCode;
  channel = supabaseClient.channel(topic, {
    config: {
      presence: { key: clientId },
      broadcast: { self: true }
    }
  });

  channel.on("presence", { event: "sync" }, function () {
    players = getPlayersFromPresence();
    renderPlayers();
    if (isHost() && localState) broadcastState();
  });
  channel.on("presence", { event: "join" }, function () {
    players = getPlayersFromPresence();
    renderPlayers();
    if (isHost() && localState) broadcastState();
  });
  channel.on("presence", { event: "leave" }, function () {
    players = getPlayersFromPresence();
    renderPlayers();
    if (localState && localState.hostId && orderedIds().indexOf(localState.hostId) === -1) {
      if (players[0] && players[0].id === clientId) {
        localState.hostId = clientId;
        toast("You are the new host.");
        if (localState.phase !== "lobby" && localState.phase !== "album") {
          localState.phase = "lobby";
          localState.books = {};
          localState.submissions = {};
          localState.turn = 0;
        }
        broadcastState();
      }
    }
  });

  channel.on("broadcast", { event: "game_state" }, function (msg) {
    if (!msg || !msg.payload || !msg.payload.state) return;
    localState = msg.payload.state;
    renderFromState();
  });

  channel.on("broadcast", { event: "request_state" }, function () {
    if (isHost() && localState) broadcastState();
  });

  channel.on("broadcast", { event: "submit" }, function (msg) {
    if (!isHost() || !localState) return;
    if (localState.phase !== "write" && localState.phase !== "draw") return;
    const p = msg && msg.payload;
    if (!p || !p.clientId || p.content == null) return;
    if (orderedIds().indexOf(p.clientId) === -1) return;
    localState.submissions[p.clientId] = p.content;
    if (allSubmitted()) {
      advanceTurn();
    } else {
      broadcastState();
    }
  });

  const status = await new Promise(function (resolve) {
    let done = false;
    channel.subscribe(function (value) {
      if (done) return;
      if (value === "SUBSCRIBED") {
        done = true;
        resolve("SUBSCRIBED");
      } else if (value === "CHANNEL_ERROR" || value === "TIMED_OUT" || value === "CLOSED") {
        done = true;
        resolve(value);
      }
    });
  });
  if (status !== "SUBSCRIBED") throw new Error("Realtime failed: " + status);

  await channel.track({ clientId: clientId, name: playerName, joinedAt: Date.now() });
  players = getPlayersFromPresence();

  if (!localState && players.length && players[0].id === clientId) {
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
    turn: 0,
    maxTurns: 0,
    books: {},
    assignments: {},
    submissions: {},
    phaseEndsAt: 0
  };
}

function broadcastState() {
  if (!channel || !localState) return;
  channel.send({
    type: "broadcast",
    event: "game_state",
    payload: { state: localState }
  }).catch(function (err) {
    console.error("broadcast failed", err);
  });
}

function sendSubmit(content) {
  if (!channel) return;
  channel.send({
    type: "broadcast",
    event: "submit",
    payload: { clientId: clientId, content: content }
  }).catch(function (err) {
    console.error("submit failed", err);
    toast("Send failed — try again");
    submitted = false;
    renderFromState();
  });
}

function allSubmitted() {
  const ids = orderedIds();
  return ids.length > 0 && ids.every(function (id) {
    return Object.prototype.hasOwnProperty.call(localState.submissions, id);
  });
}

function startGame() {
  if (!isHost()) return;
  players = getPlayersFromPresence();
  if (players.length < 2) {
    setStatus(els.lobbyStatus, "Need at least 2 players.", "error");
    toast("Need 2 players");
    return;
  }
  const ids = orderedIds();
  const books = {};
  ids.forEach(function (id) { books[id] = []; });
  localState = {
    phase: "write",
    hostId: clientId,
    turn: 0,
    maxTurns: ids.length,
    books: books,
    assignments: {},
    submissions: {},
    phaseEndsAt: Date.now() + CONFIG.writeSeconds * 1000
  };
  ids.forEach(function (id) { localState.assignments[id] = id; });
  submitted = false;
  broadcastState();
  renderFromState();
}

function advanceTurn() {
  if (!isHost() || !localState) return;
  const ids = orderedIds();
  if (!ids.length) return;

  ids.forEach(function (playerId) {
    const bookId = localState.assignments[playerId];
    const content = localState.submissions[playerId];
    if (content == null || !bookId) return;
    const type = localState.phase === "draw" ? "draw" : "text";
    if (!localState.books[bookId]) localState.books[bookId] = [];
    localState.books[bookId].push({
      type: type,
      authorId: playerId,
      content: content
    });
  });

  localState.turn += 1;
  localState.submissions = {};

  if (localState.turn >= localState.maxTurns) {
    localState.phase = "album";
    localState.phaseEndsAt = 0;
    localState.assignments = {};
    broadcastState();
    renderFromState();
    return;
  }

  const assignments = {};
  ids.forEach(function (playerId, i) {
    const bookOwnerIndex = (i - localState.turn + ids.length * 10) % ids.length;
    assignments[playerId] = ids[bookOwnerIndex];
  });
  localState.assignments = assignments;

  if (localState.turn % 2 === 1) {
    localState.phase = "draw";
    localState.phaseEndsAt = Date.now() + CONFIG.drawSeconds * 1000;
  } else {
    localState.phase = "write";
    localState.phaseEndsAt = Date.now() + CONFIG.writeSeconds * 1000;
  }

  broadcastState();
  renderFromState();
}

function getMyBookEntry() {
  if (!localState) return null;
  const bookId = localState.assignments[clientId];
  if (!bookId) return null;
  const book = localState.books[bookId] || [];
  return book.length ? book[book.length - 1] : null;
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
  const host = isHost();
  els.startBtn.style.display = host ? "block" : "none";
  els.startBtn.disabled = !host || players.length < 2;
  if (host) {
    setStatus(els.lobbyStatus, players.length < 2 ? "Need 2 players..." : "You are the host — click Start!", "good");
  } else {
    setStatus(els.lobbyStatus, "Waiting for the host...", "good");
  }
}

function renderFromState() {
  if (!localState) return;
  players = getPlayersFromPresence();

  if (localState.phase !== lastRenderedPhase) {
    lastRenderedPhase = localState.phase;
    clearInterval(timerHandle);
    timerHandle = null;
    submitted = false;
    if (localState.phase === "draw") resetCanvas();
    if (localState.phase === "write") {
      els.writeInput.value = "";
      els.writeInput.disabled = false;
    }
  }

  if (localState.phase === "lobby") {
    showScreen("lobby");
    els.roomCodeDisplay.textContent = roomCode;
    els.startBtn.textContent = players.length >= 2 ? "Start Game" : "Need 2 Players";
    renderPlayers();
    return;
  }

  if (localState.phase === "write") {
    showScreen("write");
    els.writeTurn.textContent = String(localState.turn + 1);
    const isFirst = localState.turn === 0;
    els.writeTitle.textContent = isFirst ? "WRITE!" : "DESCRIBE!";
    const prev = getMyBookEntry();
    if (isFirst || !prev) {
      els.writeHintLabel.textContent = "Your sentence";
      els.writeHintText.textContent = "Write something funny for someone to draw.";
      els.writeImageWrap.style.display = "none";
      els.writeInput.placeholder = "e.g. A cat stealing pizza";
    } else if (prev.type === "draw") {
      els.writeHintLabel.textContent = "What is this drawing?";
      els.writeHintText.textContent = "Describe what you see.";
      els.writeImageWrap.style.display = "flex";
      els.writeImage.src = prev.content;
      els.writeInput.placeholder = "Type what you see...";
    } else {
      els.writeHintLabel.textContent = "Continue the story";
      els.writeHintText.textContent = prev.content;
      els.writeImageWrap.style.display = "none";
    }
    els.submitWriteBtn.disabled = submitted;
    els.writeInput.disabled = submitted;
    setStatus(els.writeStatus, submitted ? "Submitted. Waiting for everyone..." : "", submitted ? "good" : "");
    ensureTimer(els.writeTimer, "write");
    return;
  }

  if (localState.phase === "draw") {
    showScreen("draw");
    els.roundNumber.textContent = String(localState.turn + 1);
    const prev = getMyBookEntry();
    els.promptText.textContent = prev && prev.type === "text" ? prev.content : "Draw anything!";
    els.submitDrawingBtn.disabled = submitted;
    setStatus(els.drawStatus, submitted ? "Drawing submitted. Waiting for everyone..." : "Draw before time runs out.", submitted ? "good" : "");
    ensureTimer(els.timer, "draw");
    return;
  }

  if (localState.phase === "album") {
    showScreen("album");
    renderAlbum();
    return;
  }
}

function ensureTimer(timerEl, phase) {
  if (timerHandle) clearInterval(timerHandle);
  function tick() {
    if (!localState || localState.phase !== phase) return;
    const remaining = Math.max(0, localState.phaseEndsAt - Date.now());
    timerEl.textContent = String(Math.ceil(remaining / 1000));
    if (remaining <= 0) {
      clearInterval(timerHandle);
      timerHandle = null;
      if (!submitted) {
        if (phase === "write") doSubmitWrite(true);
        else if (phase === "draw") doSubmitDraw(true);
      } else if (isHost()) {
        setTimeout(function () {
          if (localState && (localState.phase === "write" || localState.phase === "draw") && allSubmitted()) {
            advanceTurn();
          } else if (localState && (localState.phase === "write" || localState.phase === "draw")) {
            orderedIds().forEach(function (id) {
              if (!Object.prototype.hasOwnProperty.call(localState.submissions, id)) {
                localState.submissions[id] = phase === "draw" ? blankImage() : "(no answer)";
              }
            });
            advanceTurn();
          }
        }, 800);
      }
    }
  }
  tick();
  timerHandle = setInterval(tick, 250);
}

function blankImage() {
  const t = document.createElement("canvas");
  t.width = CONFIG.canvasWidth;
  t.height = CONFIG.canvasHeight;
  const c = t.getContext("2d");
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, t.width, t.height);
  return t.toDataURL("image/jpeg", 0.4);
}

function doSubmitWrite(auto) {
  if (!localState || localState.phase !== "write" || submitted) return;
  let text = els.writeInput.value.trim();
  if (!text) text = auto ? "(blank)" : "";
  if (!text) {
    setStatus(els.writeStatus, "Type something first.", "error");
    return;
  }
  submitted = true;
  text = text.slice(0, 100);
  if (isHost()) {
    localState.submissions[clientId] = text;
    if (allSubmitted()) advanceTurn();
    else broadcastState();
  } else {
    sendSubmit(text);
  }
  renderFromState();
}

function doSubmitDraw(auto) {
  if (!localState || localState.phase !== "draw" || submitted) return;
  submitted = true;
  const image = auto ? blankImage() : canvasToDataURL();
  if (isHost()) {
    localState.submissions[clientId] = image;
    if (allSubmitted()) advanceTurn();
    else broadcastState();
  } else {
    sendSubmit(image);
  }
  renderFromState();
}

function renderAlbum() {
  const ids = Object.keys(localState.books || {});
  if (!ids.length) {
    els.albumChain.innerHTML = "<p>No chains yet.</p>";
    return;
  }
  if (albumIndex < 0) albumIndex = 0;
  if (albumIndex >= ids.length) albumIndex = ids.length - 1;
  const bookId = ids[albumIndex];
  const book = localState.books[bookId] || [];
  els.albumTitle.textContent = playerNameFor(bookId) + "'s chain";
  els.albumSubtitle.textContent = "Chain " + (albumIndex + 1) + " of " + ids.length;
  els.albumChain.innerHTML = "";
  book.forEach(function (entry, i) {
    const card = document.createElement("div");
    card.className = "result-card";
    if (entry.type === "draw") {
      const img = document.createElement("img");
      img.src = entry.content;
      img.alt = "Drawing";
      card.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.style.cssText = "background:#1a2030;border-radius:11px;display:flex;align-items:center;justify-content:center;min-height:120px;padding:16px;font-weight:800;font-size:18px;text-align:center";
      placeholder.textContent = entry.content;
      card.appendChild(placeholder);
    }
    const info = document.createElement("div");
    info.className = "result-info";
    const label = document.createElement("div");
    label.className = "result-label";
    label.textContent = (entry.type === "draw" ? "Drew" : "Wrote") + " by " + playerNameFor(entry.authorId);
    const body = document.createElement("div");
    body.className = "result-guess";
    body.textContent = entry.type === "text" ? entry.content : "Drawing #" + (i + 1);
    info.appendChild(label);
    info.appendChild(body);
    card.appendChild(info);
    els.albumChain.appendChild(card);
  });
  els.prevAlbumBtn.disabled = albumIndex <= 0;
  els.nextAlbumBtn.textContent = albumIndex >= ids.length - 1 ? "Done" : "Next chain →";
  els.returnLobbyBtn.style.display = isHost() ? "block" : "none";
  setStatus(els.albumStatus, isHost() ? "Browse the chaos, then return to lobby." : "Browsing the museum...", "good");
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
  submitted = false;
  setStatus(els.homeStatus, "Connecting...", "");
  els.createBtn.disabled = true;
  els.joinBtn.disabled = true;
  try {
    await ensureChannel();
    showScreen("lobby");
    els.roomCodeDisplay.textContent = roomCode;
    channel.send({ type: "broadcast", event: "request_state", payload: { clientId: clientId } });
    renderPlayers();
  } catch (err) {
    console.error(err);
    setStatus(els.homeStatus, "Could not connect: " + (err.message || err), "error");
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
    try { await channel.untrack(); } catch (e) {}
    try { await supabaseClient.removeChannel(channel); } catch (e) {}
  }
  channel = null;
  localState = null;
  players = [];
  roomCode = "";
  showScreen("home");
}

els.createBtn.addEventListener("click", function () { enterRoom(makeRoomCode()); });
els.joinBtn.addEventListener("click", function () { enterRoom(els.roomInput.value); });
els.roomInput.addEventListener("keydown", function (e) { if (e.key === "Enter") els.joinBtn.click(); });
els.nameInput.addEventListener("keydown", function (e) { if (e.key === "Enter") els.createBtn.click(); });
els.copyRoomBtn.addEventListener("click", async function () {
  try { await navigator.clipboard.writeText(roomCode); toast("Copied!"); }
  catch (e) { toast(roomCode); }
});
els.startBtn.addEventListener("click", function () {
  players = getPlayersFromPresence();
  if (!localState) localState = initialState();
  if (players[0] && players[0].id === clientId) localState.hostId = clientId;
  startGame();
});
els.submitWriteBtn.addEventListener("click", function () { doSubmitWrite(false); });
els.writeInput.addEventListener("keydown", function (e) { if (e.key === "Enter") doSubmitWrite(false); });
els.clearCanvasBtn.addEventListener("click", function () { if (!submitted) resetCanvas(); });
els.submitDrawingBtn.addEventListener("click", function () { doSubmitDraw(false); });
els.prevAlbumBtn.addEventListener("click", function () {
  albumIndex -= 1;
  renderAlbum();
});
els.nextAlbumBtn.addEventListener("click", function () {
  const ids = Object.keys(localState.books || {});
  if (albumIndex >= ids.length - 1) albumIndex = 0;
  else albumIndex += 1;
  renderAlbum();
});
els.returnLobbyBtn.addEventListener("click", function () {
  if (!isHost()) return;
  localState = initialState();
  albumIndex = 0;
  broadcastState();
  renderFromState();
});
document.querySelectorAll(".swatch").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".swatch").forEach(function (o) { o.classList.remove("active"); });
    btn.classList.add("active");
    currentBrushColor = btn.dataset.color;
  });
});
document.querySelectorAll(".size").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".size").forEach(function (o) { o.classList.remove("active"); });
    btn.classList.add("active");
    currentBrushSize = Number(btn.dataset.size) || 4;
  });
});
window.addEventListener("beforeunload", function () {
  if (channel) channel.untrack().catch(function () {});
});

setupCanvas();
if (!window.supabase) {
  setStatus(els.homeStatus, "Supabase failed to load. Refresh.", "error");
}
