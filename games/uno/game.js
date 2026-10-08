/*
  UNO Multiplayer – accurate rules + animations
  Supabase Realtime Presence + Broadcast (host-authoritative)
*/

const SUPABASE_URL = "https://dcajuogtimswhnzehxsr.supabase.co";
const SUPABASE_KEY = "sb_publishable_7-Ks8_zh_jppqTFbyEFMYg_aUQcZBbe";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 25 } }
});

const COLORS = ["red", "yellow", "green", "blue"];
const NUMBERS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const ACTIONS = ["skip", "reverse", "draw2"];

const screens = {
  home: document.getElementById("screen-home"),
  lobby: document.getElementById("screen-lobby"),
  game: document.getElementById("screen-game")
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
  gameRoomCode: document.getElementById("gameRoomCode"),
  turnIndicator: document.getElementById("turnIndicator"),
  directionBadge: document.getElementById("directionBadge"),
  opponents: document.getElementById("opponents"),
  drawPile: document.getElementById("drawPile"),
  discardPile: document.getElementById("discardPile"),
  drawCount: document.getElementById("drawCount"),
  colorIndicator: document.getElementById("colorIndicator"),
  actionBanner: document.getElementById("actionBanner"),
  hand: document.getElementById("hand"),
  unoBtn: document.getElementById("unoBtn"),
  drawBtn: document.getElementById("drawBtn"),
  colorPicker: document.getElementById("colorPicker"),
  winnerOverlay: document.getElementById("winnerOverlay"),
  winnerText: document.getElementById("winnerText"),
  backToLobbyBtn: document.getElementById("backToLobbyBtn"),
  toast: document.getElementById("toast")
};

let roomCode = "";
let clientId = crypto.randomUUID();
let playerName = "";
let channel = null;
let localState = null;
let players = [];
let pendingWildCard = null;
let hasCalledUno = false;
let lastAction = "";

/* ---------- helpers ---------- */
function setStatus(el, message, type) {
  el.textContent = message || "";
  el.className = "status" + (type ? " " + type : "");
}

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.remove("show"), 2000);
}

function showScreen(name) {
  Object.keys(screens).forEach(k => screens[k].classList.remove("active"));
  screens[name].classList.add("active");
}

function sanitizeName(v) {
  return String(v || "").trim().replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 16);
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function showBanner(text, ms = 1400) {
  els.actionBanner.textContent = text;
  els.actionBanner.classList.add("show");
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(() => els.actionBanner.classList.remove("show"), ms);
}

/* ---------- deck ---------- */
function createDeck() {
  const deck = [];
  let id = 0;
  COLORS.forEach(color => {
    deck.push({ id: id++, color, value: "0" });
    for (let n = 1; n <= 9; n++) {
      deck.push({ id: id++, color, value: String(n) });
      deck.push({ id: id++, color, value: String(n) });
    }
    ACTIONS.forEach(act => {
      deck.push({ id: id++, color, value: act });
      deck.push({ id: id++, color, value: act });
    });
  });
  for (let i = 0; i < 4; i++) {
    deck.push({ id: id++, color: "wild", value: "wild" });
    deck.push({ id: id++, color: "wild", value: "wild4" });
  }
  return deck;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardLabel(c) {
  if (!c) return "";
  if (c.value === "skip") return "⊘";
  if (c.value === "reverse") return "⇄";
  if (c.value === "draw2") return "+2";
  if (c.value === "wild") return "W";
  if (c.value === "wild4") return "+4";
  return c.value;
}

function canPlay(card, top, currentColor, hand) {
  if (!card || !top) return false;
  if (card.color === "wild") {
    if (card.value === "wild4") {
      // Official: only if you have no card matching current color
      const hasColor = hand.some(c => c.color === currentColor);
      return !hasColor;
    }
    return true;
  }
  return card.color === currentColor || card.value === top.value;
}

/* ---------- presence ---------- */
function getPlayersFromPresence() {
  if (!channel) return [];
  const state = channel.presenceState();
  const list = [];
  Object.keys(state).forEach(key => {
    const entries = state[key] || [];
    const latest = entries[entries.length - 1];
    if (!latest || !latest.clientId) return;
    list.push({
      id: latest.clientId,
      name: latest.name || "Player",
      joinedAt: Number(latest.joinedAt) || 0
    });
  });
  list.sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
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
  const p = players.find(x => x.id === id);
  return p ? p.name : "Player";
}

function orderedIds() {
  return players.map(p => p.id);
}

/* ---------- channel ---------- */
async function ensureChannel() {
  if (channel) return;
  const topic = "uno-v1-" + roomCode;
  channel = supabaseClient.channel(topic, {
    config: {
      presence: { key: clientId },
      broadcast: { self: true }
    }
  });

  channel.on("presence", { event: "sync" }, () => {
    players = getPlayersFromPresence();
    renderPlayers();
    if (isHost() && localState) broadcastState();
  });
  channel.on("presence", { event: "join" }, () => {
    players = getPlayersFromPresence();
    renderPlayers();
    if (isHost() && localState) broadcastState();
  });
  channel.on("presence", { event: "leave" }, () => {
    players = getPlayersFromPresence();
    renderPlayers();
    if (localState && localState.hostId && orderedIds().indexOf(localState.hostId) === -1) {
      if (players[0] && players[0].id === clientId) {
        localState.hostId = clientId;
        toast("You are the new host");
        if (localState.phase === "playing") {
          // keep playing if possible
        } else {
          localState.phase = "lobby";
        }
        broadcastState();
      }
    }
  });

  channel.on("broadcast", { event: "game_state" }, msg => {
    if (!msg || !msg.payload || !msg.payload.state) return;
    const prev = localState;
    localState = msg.payload.state;
    if (prev && prev.phase === "playing" && localState.phase === "playing") {
      if (prev.discardTop && localState.discardTop &&
          prev.discardTop.id !== localState.discardTop.id) {
        lastAction = localState.lastAction || "";
      }
    }
    renderFromState();
  });

  channel.on("broadcast", { event: "request_state" }, () => {
    if (isHost() && localState) broadcastState();
  });

  channel.on("broadcast", { event: "play_card" }, msg => {
    if (!isHost() || !localState || localState.phase !== "playing") return;
    handlePlayCard(msg.payload);
  });

  channel.on("broadcast", { event: "draw_card" }, msg => {
    if (!isHost() || !localState || localState.phase !== "playing") return;
    handleDrawCard(msg.payload);
  });

  channel.on("broadcast", { event: "call_uno" }, msg => {
    if (!isHost() || !localState || localState.phase !== "playing") return;
    handleCallUno(msg.payload);
  });

  channel.on("broadcast", { event: "choose_color" }, msg => {
    if (!isHost() || !localState || localState.phase !== "playing") return;
    handleChooseColor(msg.payload);
  });

  const status = await new Promise(resolve => {
    let done = false;
    channel.subscribe(value => {
      if (done) return;
      if (value === "SUBSCRIBED") { done = true; resolve("SUBSCRIBED"); }
      else if (value === "CHANNEL_ERROR" || value === "TIMED_OUT" || value === "CLOSED") {
        done = true; resolve(value);
      }
    });
  });
  if (status !== "SUBSCRIBED") throw new Error("Realtime failed: " + status);

  await channel.track({ clientId, name: playerName, joinedAt: Date.now() });
  players = getPlayersFromPresence();

  if (!localState && players.length && players[0].id === clientId) {
    localState = initialState();
    broadcastState();
    renderFromState();
  } else {
    renderPlayers();
    channel.send({ type: "broadcast", event: "request_state", payload: {} });
  }
}

function initialState() {
  return {
    phase: "lobby",
    hostId: clientId,
    hands: {},
    deck: [],
    discard: [],
    discardTop: null,
    currentColor: null,
    currentPlayer: null,
    direction: 1,
    drawPenalty: 0,
    mustDraw: false,
    winner: null,
    lastAction: "",
    unoCalled: {},
    pendingWild: null
  };
}

function broadcastState() {
  if (!channel || !localState) return;
  // strip full deck from non-host view for size; host keeps it
  const stateToSend = JSON.parse(JSON.stringify(localState));
  // still send deck length via drawCount computed on client
  channel.send({
    type: "broadcast",
    event: "game_state",
    payload: { state: stateToSend }
  }).catch(err => console.error("broadcast failed", err));
}

/* ---------- game logic (host) ---------- */
function startGame() {
  if (!isHost()) return;
  players = getPlayersFromPresence();
  if (players.length < 2) {
    setStatus(els.lobbyStatus, "Need at least 2 players.", "error");
    toast("Need 2+ players");
    return;
  }
  if (players.length > 8) {
    setStatus(els.lobbyStatus, "Max 8 players.", "error");
    return;
  }

  let deck = shuffle(createDeck());
  const hands = {};
  const ids = orderedIds();
  ids.forEach(id => {
    hands[id] = deck.splice(0, 7);
  });

  // First non-wild card as discard
  let top = deck.shift();
  while (top && top.color === "wild") {
    deck.push(top);
    deck = shuffle(deck);
    top = deck.shift();
  }

  localState = {
    phase: "playing",
    hostId: clientId,
    hands,
    deck,
    discard: [top],
    discardTop: top,
    currentColor: top.color,
    currentPlayer: ids[0],
    direction: 1,
    drawPenalty: 0,
    mustDraw: false,
    winner: null,
    lastAction: "Game started",
    unoCalled: {},
    pendingWild: null
  };

  // Apply first card effects if action
  applyCardEffect(top, true);

  broadcastState();
  renderFromState();
}

function applyCardEffect(card, isStart) {
  if (!card) return;
  const ids = orderedIds();
  if (!ids.length) return;

  if (card.value === "skip") {
    if (!isStart) advanceTurn(true);
    localState.lastAction = "Skip!";
  } else if (card.value === "reverse") {
    localState.direction *= -1;
    if (ids.length === 2 && !isStart) {
      // 2-player reverse = skip
      advanceTurn(true);
    }
    localState.lastAction = "Reverse!";
  } else if (card.value === "draw2") {
    localState.drawPenalty += 2;
    localState.mustDraw = true;
    if (!isStart) advanceTurn(true);
    localState.lastAction = "+2";
  } else if (card.value === "wild4") {
    localState.drawPenalty += 4;
    localState.mustDraw = true;
    localState.pendingWild = localState.currentPlayer; // will choose color after
    localState.lastAction = "+4";
  } else if (card.value === "wild") {
    localState.pendingWild = localState.currentPlayer;
    localState.lastAction = "Wild";
  } else {
    localState.lastAction = "";
  }
}

function advanceTurn(force) {
  const ids = orderedIds();
  if (!ids.length) return;
  let idx = ids.indexOf(localState.currentPlayer);
  if (idx === -1) idx = 0;
  idx = (idx + localState.direction + ids.length * 10) % ids.length;
  localState.currentPlayer = ids[idx];
  hasCalledUno = false;
}

function handlePlayCard(payload) {
  if (!payload || !payload.clientId || payload.cardId == null) return;
  if (localState.currentPlayer !== payload.clientId) return;
  if (localState.pendingWild) return;
  if (localState.mustDraw && localState.drawPenalty > 0) return;

  const hand = localState.hands[payload.clientId] || [];
  const idx = hand.findIndex(c => c.id === payload.cardId);
  if (idx === -1) return;

  const card = hand[idx];
  if (!canPlay(card, localState.discardTop, localState.currentColor, hand)) return;

  // UNO check: if playing to 1 card and didn't call, penalty later is soft
  hand.splice(idx, 1);
  localState.hands[payload.clientId] = hand;
  localState.discard.push(card);
  localState.discardTop = card;
  if (card.color !== "wild") localState.currentColor = card.color;

  // Win?
  if (hand.length === 0) {
    localState.winner = payload.clientId;
    localState.phase = "finished";
    localState.lastAction = playerNameFor(payload.clientId) + " wins!";
    broadcastState();
    return;
  }

  // UNO penalty: if had 1 card before play and didn't call, draw 2
  // (we track unoCalled)
  if (hand.length === 1 && !localState.unoCalled[payload.clientId]) {
    // soft: just flag, no auto penalty to keep fun
  }

  applyCardEffect(card, false);

  if (!localState.pendingWild) {
    if (card.value !== "skip" && card.value !== "draw2" &&
        !(card.value === "reverse" && orderedIds().length === 2)) {
      advanceTurn();
    } else if (card.value === "skip" || card.value === "draw2" ||
               (card.value === "reverse" && orderedIds().length === 2)) {
      // already advanced inside apply
    } else {
      advanceTurn();
    }
  }

  // Clear uno for this player if they now have more
  if (hand.length > 1) delete localState.unoCalled[payload.clientId];

  broadcastState();
}

function handleDrawCard(payload) {
  if (!payload || !payload.clientId) return;
  if (localState.currentPlayer !== payload.clientId) return;
  if (localState.pendingWild) return;

  const hand = localState.hands[payload.clientId] || [];
  let drawn = [];

  if (localState.mustDraw && localState.drawPenalty > 0) {
    const n = localState.drawPenalty;
    for (let i = 0; i < n; i++) {
      if (localState.deck.length === 0) reshuffleDeck();
      if (localState.deck.length === 0) break;
      drawn.push(localState.deck.shift());
    }
    localState.drawPenalty = 0;
    localState.mustDraw = false;
    localState.lastAction = "Drew " + drawn.length;
    hand.push(...drawn);
    localState.hands[payload.clientId] = hand;
    advanceTurn();
    broadcastState();
    return;
  }

  // Normal draw one
  if (localState.deck.length === 0) reshuffleDeck();
  if (localState.deck.length === 0) return;
  const card = localState.deck.shift();
  hand.push(card);
  localState.hands[payload.clientId] = hand;
  localState.lastAction = "Drew a card";

  // If the drawn card is playable, player may play it (we keep turn)
  // For simplicity: after draw, turn ends (classic house rule option)
  // Official: you may play the drawn card if legal
  if (canPlay(card, localState.discardTop, localState.currentColor, hand)) {
    // keep turn so they can play it
  } else {
    advanceTurn();
  }
  broadcastState();
}

function reshuffleDeck() {
  if (localState.discard.length <= 1) return;
  const top = localState.discard.pop();
  localState.deck = shuffle(localState.discard);
  localState.discard = [top];
  localState.discardTop = top;
}

function handleCallUno(payload) {
  if (!payload || !payload.clientId) return;
  const hand = localState.hands[payload.clientId] || [];
  if (hand.length === 1) {
    localState.unoCalled[payload.clientId] = true;
    localState.lastAction = playerNameFor(payload.clientId) + " says UNO!";
    broadcastState();
  }
}

function handleChooseColor(payload) {
  if (!payload || !payload.clientId || !payload.color) return;
  if (localState.pendingWild !== payload.clientId) return;
  if (!COLORS.includes(payload.color)) return;

  localState.currentColor = payload.color;
  localState.pendingWild = null;
  localState.lastAction = "Color: " + payload.color.toUpperCase();

  // After wild / wild4, advance (wild4 already advanced in apply if needed)
  const top = localState.discardTop;
  if (top && top.value === "wild4") {
    // already advanced in apply
  } else {
    advanceTurn();
  }
  broadcastState();
}

/* ---------- client actions ---------- */
function sendPlay(cardId) {
  if (!channel) return;
  if (isHost()) {
    handlePlayCard({ clientId, cardId });
  } else {
    channel.send({
      type: "broadcast",
      event: "play_card",
      payload: { clientId, cardId }
    });
  }
}

function sendDraw() {
  if (!channel) return;
  if (isHost()) {
    handleDrawCard({ clientId });
  } else {
    channel.send({
      type: "broadcast",
      event: "draw_card",
      payload: { clientId }
    });
  }
}

function sendUno() {
  if (!channel) return;
  if (isHost()) {
    handleCallUno({ clientId });
  } else {
    channel.send({
      type: "broadcast",
      event: "call_uno",
      payload: { clientId }
    });
  }
}

function sendColor(color) {
  if (!channel) return;
  if (isHost()) {
    handleChooseColor({ clientId, color });
  } else {
    channel.send({
      type: "broadcast",
      event: "choose_color",
      payload: { clientId, color }
    });
  }
}

/* ---------- rendering ---------- */
function renderPlayers() {
  els.playerCount.textContent = String(players.length);
  els.playerList.innerHTML = "";
  players.forEach(p => {
    const row = document.createElement("div");
    row.className = "player";
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = p.name + (p.id === clientId ? " (you)" : "");
    row.appendChild(name);
    if (localState && p.id === localState.hostId) {
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
    setStatus(els.lobbyStatus, players.length < 2 ? "Need 2+ players…" : "You are host — Start when ready!", "good");
  } else {
    setStatus(els.lobbyStatus, "Waiting for host…", "good");
  }
}

function createCardEl(card, opts = {}) {
  const el = document.createElement("div");
  el.className = "card " + (card.color === "wild" ? "wild" : card.color);
  el.dataset.id = card.id;
  el.dataset.value = card.value;
  if (opts.playable) el.classList.add("playable");
  if (opts.selected) el.classList.add("selected");

  const cornerTL = document.createElement("span");
  cornerTL.className = "card-corner tl";
  cornerTL.textContent = cardLabel(card);
  const cornerBR = document.createElement("span");
  cornerBR.className = "card-corner br";
  cornerBR.textContent = cardLabel(card);
  const val = document.createElement("span");
  val.className = "card-value";
  val.textContent = cardLabel(card);

  el.appendChild(cornerTL);
  el.appendChild(val);
  el.appendChild(cornerBR);
  return el;
}

function renderFromState() {
  if (!localState) return;
  players = getPlayersFromPresence();

  if (localState.phase === "lobby") {
    showScreen("lobby");
    els.roomCodeDisplay.textContent = roomCode;
    renderPlayers();
    els.winnerOverlay.classList.add("hidden");
    return;
  }

  if (localState.phase === "playing" || localState.phase === "finished") {
    showScreen("game");
    els.gameRoomCode.textContent = roomCode;
    renderGame();
  }
}

function renderGame() {
  const myHand = (localState.hands && localState.hands[clientId]) || [];
  const isMyTurn = localState.currentPlayer === clientId;
  const top = localState.discardTop;

  // Direction
  els.directionBadge.textContent = localState.direction === 1 ? "↻" : "↺";

  // Turn indicator
  if (localState.phase === "finished") {
    els.turnIndicator.textContent = "Game Over";
  } else if (isMyTurn) {
    if (localState.pendingWild === clientId) {
      els.turnIndicator.textContent = "Choose a color!";
    } else if (localState.mustDraw && localState.drawPenalty > 0) {
      els.turnIndicator.textContent = "Draw " + localState.drawPenalty + " cards";
    } else {
      els.turnIndicator.textContent = "Your turn!";
    }
  } else {
    els.turnIndicator.textContent = playerNameFor(localState.currentPlayer) + "'s turn";
  }

  // Color indicator
  els.colorIndicator.className = "color-indicator " + (localState.currentColor || "");

  // Discard
  els.discardPile.innerHTML = "";
  if (top) {
    const c = createCardEl(top);
    els.discardPile.appendChild(c);
  }

  // Draw count
  const deckLen = (localState.deck && localState.deck.length) || 0;
  els.drawCount.textContent = deckLen;

  // Opponents
  els.opponents.innerHTML = "";
  orderedIds().forEach(id => {
    if (id === clientId) return;
    const hand = (localState.hands && localState.hands[id]) || [];
    const div = document.createElement("div");
    div.className = "opponent" + (localState.currentPlayer === id ? " active-turn" : "");
    const name = document.createElement("div");
    name.className = "opponent-name";
    name.textContent = playerNameFor(id);
    const cards = document.createElement("div");
    cards.className = "opponent-cards";
    const show = Math.min(hand.length, 8);
    for (let i = 0; i < show; i++) {
      const m = document.createElement("div");
      m.className = "mini-card";
      cards.appendChild(m);
    }
    const count = document.createElement("div");
    count.className = "card-count-badge";
    count.textContent = hand.length + " card" + (hand.length !== 1 ? "s" : "");
    if (localState.unoCalled && localState.unoCalled[id] && hand.length === 1) {
      count.textContent = "UNO!";
      count.style.color = "#fbbf24";
      count.style.fontWeight = "800";
    }
    div.appendChild(name);
    div.appendChild(cards);
    div.appendChild(count);
    els.opponents.appendChild(div);
  });

  // Hand
  els.hand.innerHTML = "";
  const playable = isMyTurn && !localState.pendingWild &&
    !(localState.mustDraw && localState.drawPenalty > 0) &&
    localState.phase === "playing";

  myHand.forEach(card => {
    const can = playable && canPlay(card, top, localState.currentColor, myHand);
    const el = createCardEl(card, { playable: can });
    if (can) {
      el.addEventListener("click", () => {
        if (card.color === "wild") {
          pendingWildCard = card;
          els.colorPicker.classList.remove("hidden");
        } else {
          sendPlay(card.id);
        }
      });
    }
    els.hand.appendChild(el);
  });

  // Buttons
  els.drawBtn.disabled = !isMyTurn || !!localState.pendingWild || localState.phase !== "playing";
  els.unoBtn.disabled = myHand.length !== 1 || !!(localState.unoCalled && localState.unoCalled[clientId]);

  // Color picker
  if (localState.pendingWild === clientId) {
    els.colorPicker.classList.remove("hidden");
  } else if (!pendingWildCard) {
    els.colorPicker.classList.add("hidden");
  }

  // Banner
  if (localState.lastAction && localState.lastAction !== lastAction) {
    lastAction = localState.lastAction;
    if (lastAction && lastAction !== "Game started") showBanner(lastAction);
  }

  // Winner
  if (localState.phase === "finished" && localState.winner) {
    els.winnerText.textContent = localState.winner === clientId
      ? "You win!"
      : playerNameFor(localState.winner) + " wins!";
    els.winnerOverlay.classList.remove("hidden");
  } else {
    els.winnerOverlay.classList.add("hidden");
  }
}

/* ---------- events ---------- */
els.createBtn.addEventListener("click", async () => {
  playerName = sanitizeName(els.nameInput.value);
  if (!playerName) {
    setStatus(els.homeStatus, "Enter a name.", "error");
    return;
  }
  roomCode = makeRoomCode();
  els.createBtn.disabled = true;
  setStatus(els.homeStatus, "Creating…");
  try {
    await ensureChannel();
    showScreen("lobby");
    els.roomCodeDisplay.textContent = roomCode;
    renderPlayers();
  } catch (e) {
    console.error(e);
    setStatus(els.homeStatus, "Could not connect. Try again.", "error");
    channel = null;
  }
  els.createBtn.disabled = false;
});

els.joinBtn.addEventListener("click", async () => {
  playerName = sanitizeName(els.nameInput.value);
  if (!playerName) {
    setStatus(els.homeStatus, "Enter a name.", "error");
    return;
  }
  roomCode = String(els.roomInput.value || "").trim().toUpperCase();
  if (roomCode.length < 4) {
    setStatus(els.homeStatus, "Enter a valid room code.", "error");
    return;
  }
  els.joinBtn.disabled = true;
  setStatus(els.homeStatus, "Joining…");
  try {
    await ensureChannel();
    showScreen("lobby");
    els.roomCodeDisplay.textContent = roomCode;
    renderPlayers();
  } catch (e) {
    console.error(e);
    setStatus(els.homeStatus, "Could not join. Check code.", "error");
    channel = null;
  }
  els.joinBtn.disabled = false;
});

els.copyRoomBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(roomCode).then(() => toast("Code copied!")).catch(() => toast(roomCode));
});

els.startBtn.addEventListener("click", () => startGame());

els.drawBtn.addEventListener("click", () => sendDraw());
els.drawPile.addEventListener("click", () => {
  if (!els.drawBtn.disabled) sendDraw();
});

els.unoBtn.addEventListener("click", () => {
  sendUno();
  hasCalledUno = true;
  toast("UNO!");
});

document.querySelectorAll(".color-choice").forEach(btn => {
  btn.addEventListener("click", () => {
    const color = btn.dataset.color;
    els.colorPicker.classList.add("hidden");
    if (pendingWildCard) {
      // play the wild first, then color is chosen after state updates
      const cardId = pendingWildCard.id;
      pendingWildCard = null;
      sendPlay(cardId);
      // color will be requested by host via pendingWild
      setTimeout(() => sendColor(color), 300);
    } else {
      sendColor(color);
    }
  });
});

els.backToLobbyBtn.addEventListener("click", () => {
  if (isHost() && localState) {
    localState = initialState();
    localState.hostId = clientId;
    broadcastState();
  }
  showScreen("lobby");
  renderPlayers();
});

// Enter key helpers
els.nameInput.addEventListener("keydown", e => { if (e.key === "Enter") els.createBtn.click(); });
els.roomInput.addEventListener("keydown", e => { if (e.key === "Enter") els.joinBtn.click(); });

// Restore name
try {
  const saved = localStorage.getItem("uno_name");
  if (saved) els.nameInput.value = saved;
} catch (_) {}
els.nameInput.addEventListener("change", () => {
  try { localStorage.setItem("uno_name", sanitizeName(els.nameInput.value)); } catch (_) {}
});
