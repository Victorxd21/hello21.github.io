/* Multiplayer Blackjack — fixed buttons, lobby, 2+ players */
(function () {
  const SUPABASE_URL = 'https://lytcjbixpoatqksvsioa.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_d052ueJHOYAjP4OyLWkIHQ_LKp7NgXc';
  const MIN_PLAYERS = 2;
  const BET = 50;

  const { createClient } = window.supabase;
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  const $ = (id) => document.getElementById(id);

  // DOM
  const elLobby = $('lobby');
  const elTable = $('table');
  const elWaiting = $('waitingLobby');
  const elGameArea = $('gameArea');
  const nameInput = $('nameInput');
  const roomInput = $('roomInput');
  const lobbyError = $('lobbyError');
  const roomCodeDisplay = $('roomCodeDisplay');
  const statusText = $('statusText');
  const playerCountEl = $('playerCount');
  const waitingMsg = $('waitingMsg');
  const waitingList = $('waitingList');
  const waitingHint = $('waitingHint');
  const btnStartGame = $('btnStartGame');
  const dealerCards = $('dealerCards');
  const dealerTotal = $('dealerTotal');
  const playersArea = $('playersArea');
  const playerList = $('playerList');
  const gameLog = $('gameLog');
  const myChipsEl = $('myChips');
  const hostControls = $('hostControls');
  const playerControls = $('playerControls');
  const spectateNote = $('spectateNote');
  const btnDeal = $('btnDeal');
  const btnNewRound = $('btnNewRound');
  const btnHit = $('btnHit');
  const btnStand = $('btnStand');

  // State
  let myId = crypto.randomUUID();
  let myName = localStorage.getItem('bj_name') || '';
  let roomCode = '';
  let isHost = false;
  let channel = null;
  let players = {}; // presence snapshot
  let game = null; // host keeps full state (incl. deck); clients get public copy
  let inGameScreen = false; // false = room lobby, true = at table
  let myChips = 1000;
  let lastSettledRound = null;
  let subscribed = false;

  nameInput.value = myName;

  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  function makeDeck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push({ r, s });
    for (let i = d.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function handValue(hand) {
    if (!hand || !hand.length) return 0;
    let total = 0, aces = 0;
    for (const c of hand) {
      if (c.r === 'A') { aces++; total += 11; }
      else if ('JQK'.includes(c.r)) total += 10;
      else total += parseInt(c.r, 10);
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }

  function isBlackjack(hand) {
    return hand && hand.length === 2 && handValue(hand) === 21;
  }

  function cardHTML(card, faceDown) {
    if (faceDown) return '<div class="pcard back"></div>';
    const red = card.s === '♥' || card.s === '♦';
    return (
      '<div class="pcard ' + (red ? 'red' : '') + '">' +
      '<span>' + card.r + '</span>' +
      '<span class="suit">' + card.s + '</span>' +
      '<span class="rank-br">' + card.r + '</span>' +
      '</div>'
    );
  }

  function log(msg) {
    const d = document.createElement('div');
    d.textContent = msg;
    gameLog.prepend(d);
  }

  function setError(msg) {
    lobbyError.textContent = msg || '';
  }

  function randomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = '';
    for (let i = 0; i < 5; i++) c += chars[(Math.random() * chars.length) | 0];
    return c;
  }

  function playerCount() {
    return Object.keys(players).length;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Public snapshot (no deck) ───────────────────────────────
  function publicState() {
    if (!game) return null;
    return {
      roundId: game.roundId,
      phase: game.phase,
      dealer: game.dealer,
      dealerReveal: game.dealerReveal,
      hands: game.hands,
      statuses: game.statuses,
      results: game.results,
      turnIndex: game.turnIndex,
      seatOrder: game.seatOrder,
      bet: game.bet,
      hostId: game.hostId,
      started: true,
    };
  }

  function broadcastGame() {
    if (!channel || !game) return;
    const payload = publicState();
    channel.send({
      type: 'broadcast',
      event: 'game',
      payload,
    });
    // Host renders from local full state (never overwrite deck)
    if (isHost) {
      settleChipsIfNeeded();
      renderAll();
    }
  }

  function broadcastLobbyPhase(started) {
    if (!channel) return;
    channel.send({
      type: 'broadcast',
      event: 'lobby',
      payload: { started: !!started, hostId: isHost ? myId : null },
    });
  }

  // ── Room ────────────────────────────────────────────────────
  async function joinRoom(code, asHost) {
    roomCode = code.toUpperCase();
    isHost = asHost;
    game = null;
    inGameScreen = false;
    lastSettledRound = null;
    subscribed = false;
    players = {};

    if (channel) {
      try { await sb.removeChannel(channel); } catch (_) {}
      channel = null;
    }

    channel = sb.channel('blackjack:' + roomCode, {
      config: {
        broadcast: { self: false },
        presence: { key: myId },
      },
    });

    channel.on('presence', { event: 'sync' }, onPresenceSync);
    channel.on('presence', { event: 'join' }, onPresenceSync);
    channel.on('presence', { event: 'leave' }, onPresenceSync);

    channel.on('broadcast', { event: 'game' }, ({ payload }) => {
      // Clients always apply. Host ignores (keeps local deck).
      if (isHost) return;
      applyClientGameState(payload);
    });

    channel.on('broadcast', { event: 'action' }, ({ payload }) => {
      if (!isHost) return;
      handlePlayerAction(payload.playerId, payload.action);
    });

    channel.on('broadcast', { event: 'lobby' }, ({ payload }) => {
      if (payload && payload.started) {
        enterGameScreen();
      }
    });

    channel.on('broadcast', { event: 'request_state' }, () => {
      if (isHost && game) broadcastGame();
      if (isHost && inGameScreen) broadcastLobbyPhase(true);
    });

    channel.subscribe(async (status, err) => {
      if (status === 'SUBSCRIBED') {
        subscribed = true;
        await channel.track({
          name: myName,
          chips: myChips,
          isHost: isHost,
          joinedAt: Date.now(),
        });
        showRoomShell();
        if (!isHost) {
          channel.send({
            type: 'broadcast',
            event: 'request_state',
            payload: { from: myId },
          });
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setError('Connection failed. Enable Realtime in your Supabase project.');
        console.error('Supabase channel error', status, err);
      }
    });
  }

  function onPresenceSync() {
    if (!channel) return;
    const state = channel.presenceState();
    const next = {};
    for (const key of Object.keys(state)) {
      const metas = state[key];
      const m = metas && metas[0];
      if (!m) continue;
      next[key] = {
        id: key,
        name: m.name || 'Player',
        chips: m.chips != null ? m.chips : 1000,
        isHost: !!m.isHost,
      };
    }
    players = next;
    renderWaitingLobby();
    renderSidebar();
    updateHostButtons();
    playerCountEl.textContent = playerCount() + ' player' + (playerCount() === 1 ? '' : 's');
  }

  function showRoomShell() {
    elLobby.classList.add('hidden');
    elTable.classList.remove('hidden');
    roomCodeDisplay.textContent = roomCode;
    myChipsEl.textContent = myChips;
    elWaiting.classList.remove('hidden');
    elGameArea.classList.add('hidden');
    inGameScreen = false;
    renderWaitingLobby();
    updateHostButtons();
  }

  function enterGameScreen() {
    inGameScreen = true;
    elWaiting.classList.add('hidden');
    elGameArea.classList.remove('hidden');
    if (isHost) hostControls.classList.remove('hidden');
    else hostControls.classList.add('hidden');
    renderAll();
  }

  function leaveRoom() {
    if (channel) {
      try { sb.removeChannel(channel); } catch (_) {}
      channel = null;
    }
    game = null;
    players = {};
    isHost = false;
    roomCode = '';
    inGameScreen = false;
    subscribed = false;
    elTable.classList.add('hidden');
    elLobby.classList.remove('hidden');
    gameLog.innerHTML = '';
  }

  // ── Waiting lobby UI ────────────────────────────────────────
  function renderWaitingLobby() {
    const count = playerCount();
    waitingList.innerHTML = '';
    const list = Object.values(players).sort((a, b) => {
      if (a.isHost && !b.isHost) return -1;
      if (!a.isHost && b.isHost) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
    for (const p of list) {
      const li = document.createElement('li');
      if (p.id === myId) li.classList.add('me');
      li.innerHTML =
        '<span>' + escapeHtml(p.name) + (p.id === myId ? ' (you)' : '') + '</span>' +
        (p.isHost ? '<span class="tag">HOST</span>' : '');
      waitingList.appendChild(li);
    }

    if (count < MIN_PLAYERS) {
      waitingMsg.textContent = 'Waiting for players… (' + count + '/' + MIN_PLAYERS + ' minimum)';
    } else {
      waitingMsg.textContent = count + ' players ready';
    }

    if (isHost) {
      waitingHint.textContent = count < MIN_PLAYERS
        ? 'Need at least ' + MIN_PLAYERS + ' players'
        : 'You can start the game';
      btnStartGame.disabled = count < MIN_PLAYERS;
      btnStartGame.textContent = 'Start Game';
    } else {
      waitingHint.textContent = 'Waiting for host to start…';
      btnStartGame.disabled = true;
      btnStartGame.textContent = 'Waiting for host';
    }
  }

  function updateHostButtons() {
    if (!isHost) return;
    const count = playerCount();
    const inRound = game && (game.phase === 'playing' || game.phase === 'dealer');
    const finished = game && game.phase === 'results';

    btnStartGame.disabled = count < MIN_PLAYERS || inGameScreen;

    if (inGameScreen) {
      hostControls.classList.remove('hidden');
      btnDeal.disabled = !!inRound || count < MIN_PLAYERS;
      btnNewRound.disabled = !finished;
      if (!game) {
        btnDeal.disabled = count < MIN_PLAYERS;
        btnNewRound.disabled = true;
      }
    }
  }

  // ── Host game logic ─────────────────────────────────────────
  function startRound() {
    if (!isHost) return;
    const ids = Object.keys(players);
    if (ids.length < MIN_PLAYERS) {
      statusText.textContent = 'Need at least ' + MIN_PLAYERS + ' players';
      return;
    }

    // stable seat order: host first, then others by name
    const seatOrder = ids.slice().sort((a, b) => {
      if (players[a]?.isHost) return -1;
      if (players[b]?.isHost) return 1;
      return (players[a]?.name || '').localeCompare(players[b]?.name || '');
    });

    const deck = makeDeck();
    // multi-deck feel if many players
    while (deck.length < seatOrder.length * 6 + 20) {
      deck.push(...makeDeck());
    }

    const hands = {};
    const statuses = {};
    for (const id of seatOrder) {
      hands[id] = [deck.pop(), deck.pop()];
      statuses[id] = isBlackjack(hands[id]) ? 'blackjack' : 'playing';
    }
    const dealer = [deck.pop(), deck.pop()];

    game = {
      roundId: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      phase: 'playing',
      deck,
      dealer,
      dealerReveal: false,
      hands,
      statuses,
      results: {},
      turnIndex: 0,
      seatOrder,
      bet: BET,
      hostId: myId,
    };

    advanceTurnPastDone();

    if (game.turnIndex >= game.seatOrder.length) {
      runDealer();
    } else {
      log('Round dealt — ' + seatOrder.length + ' players');
      broadcastGame();
    }
  }

  function advanceTurnPastDone() {
    while (
      game.turnIndex < game.seatOrder.length &&
      game.statuses[game.seatOrder[game.turnIndex]] !== 'playing'
    ) {
      game.turnIndex++;
    }
  }

  function currentTurnId() {
    if (!game || game.phase !== 'playing') return null;
    if (game.turnIndex >= game.seatOrder.length) return null;
    return game.seatOrder[game.turnIndex];
  }

  function handlePlayerAction(playerId, action) {
    if (!isHost || !game || game.phase !== 'playing') return;
    if (currentTurnId() !== playerId) return;
    if (!game.hands[playerId]) return;

    const hand = game.hands[playerId];
    const pname = players[playerId]?.name || 'Player';

    if (action === 'hit') {
      if (!game.deck.length) game.deck = makeDeck();
      hand.push(game.deck.pop());
      const v = handValue(hand);
      if (v > 21) {
        game.statuses[playerId] = 'bust';
        game.turnIndex++;
        advanceTurnPastDone();
        log(pname + ' busts (' + v + ')');
      } else {
        log(pname + ' hits → ' + v);
      }
    } else if (action === 'stand') {
      game.statuses[playerId] = 'stand';
      game.turnIndex++;
      advanceTurnPastDone();
      log(pname + ' stands (' + handValue(hand) + ')');
    } else {
      return;
    }

    if (game.turnIndex >= game.seatOrder.length) {
      runDealer();
    } else {
      broadcastGame();
    }
  }

  function runDealer() {
    if (!game) return;
    game.phase = 'dealer';
    game.dealerReveal = true;

    while (handValue(game.dealer) < 17) {
      if (!game.deck.length) game.deck = makeDeck();
      game.dealer.push(game.deck.pop());
    }

    const dv = handValue(game.dealer);
    const dealerBust = dv > 21;
    const dealerBJ = isBlackjack(game.dealer);

    for (const id of game.seatOrder) {
      const st = game.statuses[id];
      const pv = handValue(game.hands[id]);
      if (st === 'bust') {
        game.results[id] = 'lose';
      } else if (st === 'blackjack') {
        game.results[id] = dealerBJ ? 'push' : 'bj';
      } else if (dealerBust) {
        game.results[id] = 'win';
      } else if (pv > dv) {
        game.results[id] = 'win';
      } else if (pv < dv) {
        game.results[id] = 'lose';
      } else {
        game.results[id] = 'push';
      }
    }

    game.phase = 'results';
    log('Dealer: ' + dv + (dealerBust ? ' BUST' : ''));
    broadcastGame();
  }

  // ── Client applies public state ─────────────────────────────
  function applyClientGameState(payload) {
    if (!payload) return;
    game = payload;
    if (!inGameScreen) enterGameScreen();
    settleChipsIfNeeded();
    renderAll();
  }

  function settleChipsIfNeeded() {
    if (!game || game.phase !== 'results') return;
    if (!game.results || !game.results[myId]) return;
    if (game.roundId && game.roundId === lastSettledRound) return;
    lastSettledRound = game.roundId || 'x';

    const r = game.results[myId];
    const bet = game.bet || BET;
    if (r === 'win') myChips += bet;
    else if (r === 'bj') myChips += (bet + (bet >> 1));
    else if (r === 'lose') myChips = Math.max(0, myChips - bet);

    myChipsEl.textContent = myChips;
    if (channel && subscribed) {
      channel.track({
        name: myName,
        chips: myChips,
        isHost: isHost,
        joinedAt: Date.now(),
      });
    }
  }

  // ── Render ──────────────────────────────────────────────────
  function renderAll() {
    renderDealer();
    renderPlayers();
    renderSidebar();
    updateControls();
    updateStatus();
    updateHostButtons();
  }

  function renderDealer() {
    if (!game || !game.dealer) {
      dealerCards.innerHTML = '';
      dealerTotal.textContent = '';
      return;
    }
    const reveal = game.dealerReveal || game.phase === 'results';
    dealerCards.innerHTML = game.dealer
      .map((c, i) => cardHTML(c, i === 1 && !reveal))
      .join('');
    if (reveal) {
      dealerTotal.textContent = '(' + handValue(game.dealer) + ')';
    } else if (game.dealer[0]) {
      const up = game.dealer[0];
      const v = up.r === 'A' ? 11 : 'JQK'.includes(up.r) ? 10 : parseInt(up.r, 10);
      dealerTotal.textContent = '(' + v + ' + ?)';
    } else {
      dealerTotal.textContent = '';
    }
  }

  function renderPlayers() {
    playersArea.innerHTML = '';
    const order = (game && game.seatOrder) ? game.seatOrder : Object.keys(players);
    const turnId = currentTurnId();

    for (const id of order) {
      const p = players[id] || { id, name: 'Player' };
      const hand = (game && game.hands && game.hands[id]) || [];
      const status = (game && game.statuses && game.statuses[id]) || '';
      const result = (game && game.results && game.results[id]) || null;
      const active = turnId === id;

      const el = document.createElement('div');
      el.className = 'player-seat' + (active ? ' active' : '');
      const you = id === myId ? ' <span class="you">(you)</span>' : '';
      let totalStr = hand.length ? ' <span class="total">(' + handValue(hand) + ')</span>' : '';

      let resultHtml = '';
      if (result) {
        const labels = { win: 'WIN', lose: 'LOSE', push: 'PUSH', bj: 'BLACKJACK!' };
        resultHtml = '<div class="result ' + result + '">' + (labels[result] || result) + '</div>';
      } else if (status === 'bust') {
        resultHtml = '<div class="result lose">BUST</div>';
      } else if (status === 'stand') {
        resultHtml = '<div class="result">STAND</div>';
      } else if (status === 'blackjack') {
        resultHtml = '<div class="result bj">BLACKJACK</div>';
      }

      el.innerHTML =
        '<div class="name">' + escapeHtml(p.name || 'Player') + you + totalStr + '</div>' +
        '<div class="hand">' + hand.map((c) => cardHTML(c, false)).join('') + '</div>' +
        resultHtml;
      playersArea.appendChild(el);
    }
  }

  function renderSidebar() {
    playerList.innerHTML = '';
    for (const p of Object.values(players)) {
      const li = document.createElement('li');
      if (p.id === myId) li.classList.add('me');
      if (p.isHost) li.classList.add('host');
      li.innerHTML =
        '<span>' + escapeHtml(p.name) + '</span>' +
        '<span>' + (p.isHost ? '<span class="tag">HOST</span> ' : '') + (p.chips != null ? p.chips : '—') + '</span>';
      playerList.appendChild(li);
    }
  }

  function updateStatus() {
    if (!inGameScreen) {
      statusText.textContent = isHost ? 'Room lobby — start when ready' : 'In lobby — waiting for host';
      return;
    }
    if (!game) {
      statusText.textContent = isHost ? 'Press Deal to start a round' : 'Waiting for host to deal…';
      return;
    }
    if (game.phase === 'results') {
      statusText.textContent = 'Round over' + (isHost ? ' — deal again when ready' : '');
      return;
    }
    if (game.phase === 'dealer') {
      statusText.textContent = 'Dealer is playing…';
      return;
    }
    const tid = currentTurnId();
    if (tid === myId) statusText.textContent = 'Your turn — Hit or Stand';
    else if (tid) statusText.textContent = (players[tid]?.name || 'Player') + "'s turn";
    else statusText.textContent = '…';
  }

  function updateControls() {
    const myTurn = !!(game && game.phase === 'playing' && currentTurnId() === myId);

    if (isHost && inGameScreen) hostControls.classList.remove('hidden');
    else hostControls.classList.add('hidden');

    if (myTurn) {
      playerControls.classList.remove('hidden');
      spectateNote.classList.add('hidden');
    } else {
      playerControls.classList.add('hidden');
      if (game && game.phase === 'playing') spectateNote.classList.remove('hidden');
      else spectateNote.classList.add('hidden');
    }
  }

  // ── Actions from buttons ────────────────────────────────────
  function sendAction(action) {
    if (!game || game.phase !== 'playing') return;
    if (currentTurnId() !== myId) return;

    // Host processes locally (reliable, keeps deck)
    if (isHost) {
      handlePlayerAction(myId, action);
      return;
    }
    // Guests send to host
    if (!channel) return;
    channel.send({
      type: 'broadcast',
      event: 'action',
      payload: { playerId: myId, action: action },
    });
  }

  function hostStartFromLobby() {
    if (!isHost) return;
    if (playerCount() < MIN_PLAYERS) return;
    enterGameScreen();
    broadcastLobbyPhase(true);
    startRound();
  }

  // ── Wire UI ─────────────────────────────────────────────────
  $('btnCreate').addEventListener('click', async () => {
    myName = (nameInput.value || '').trim() || 'Player';
    localStorage.setItem('bj_name', myName);
    setError('');
    try {
      await joinRoom(randomCode(), true);
    } catch (e) {
      setError(e.message || 'Failed to create room');
    }
  });

  $('btnJoin').addEventListener('click', async () => {
    myName = (nameInput.value || '').trim() || 'Player';
    localStorage.setItem('bj_name', myName);
    const code = (roomInput.value || '').trim().toUpperCase();
    if (code.length < 4) {
      setError('Enter a valid room code');
      return;
    }
    setError('');
    try {
      await joinRoom(code, false);
    } catch (e) {
      setError(e.message || 'Failed to join room');
    }
  });

  roomInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btnJoin').click();
  });
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btnCreate').click();
  });

  $('btnLeave').addEventListener('click', leaveRoom);
  btnStartGame.addEventListener('click', hostStartFromLobby);

  btnDeal.addEventListener('click', () => {
    if (isHost) startRound();
  });
  btnNewRound.addEventListener('click', () => {
    if (isHost) startRound();
  });

  btnHit.addEventListener('click', () => sendAction('hit'));
  btnStand.addEventListener('click', () => sendAction('stand'));
})();
