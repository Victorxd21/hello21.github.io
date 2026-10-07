/* Multiplayer Blackjack — Supabase Realtime Broadcast + Presence */
(function () {
  const SUPABASE_URL = 'https://lytcjbixpoatqksvsioa.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_d052ueJHOYAjP4OyLWkIHQ_LKp7NgXc';

  const { createClient } = supabase;
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── DOM ─────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const lobby = $('lobby');
  const table = $('table');
  const nameInput = $('nameInput');
  const roomInput = $('roomInput');
  const lobbyError = $('lobbyError');
  const roomCodeDisplay = $('roomCodeDisplay');
  const statusText = $('statusText');
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

  // ── State ───────────────────────────────────────────────────
  let myId = crypto.randomUUID();
  let myName = localStorage.getItem('bj_name') || '';
  let roomCode = '';
  let isHost = false;
  let channel = null;
  let players = {}; // id -> { id, name, chips, hand, status, bet }
  let game = null;  // authoritative game state (host drives)
  let myChips = 1000;

  nameInput.value = myName;

  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  function makeDeck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push({ r, s });
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function handValue(hand) {
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
    return hand.length === 2 && handValue(hand) === 21;
  }

  function cardHTML(card, faceDown) {
    if (faceDown) return '<div class="pcard back"></div>';
    const red = card.s === '♥' || card.s === '♦';
    return `<div class="pcard ${red ? 'red' : ''}">
      <span>${card.r}</span>
      <span class="suit">${card.s}</span>
      <span class="rank-br">${card.r}</span>
    </div>`;
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
    for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
  }

  // ── Room / channel ──────────────────────────────────────────
  async function joinRoom(code, asHost) {
    roomCode = code.toUpperCase();
    isHost = asHost;

    if (channel) {
      await sb.removeChannel(channel);
      channel = null;
    }

    channel = sb.channel(`blackjack:${roomCode}`, {
      config: {
        broadcast: { self: true },
        presence: { key: myId },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const next = {};
        for (const [key, metas] of Object.entries(state)) {
          const m = metas[0];
          if (!m) continue;
          next[key] = {
            id: key,
            name: m.name,
            chips: m.chips ?? 1000,
            isHost: !!m.isHost,
            hand: players[key]?.hand || [],
            status: players[key]?.status || 'waiting',
            bet: players[key]?.bet || 0,
            result: players[key]?.result || null,
          };
        }
        players = next;
        renderSidebar();
        renderPlayers();
        updateControls();
      })
      .on('broadcast', { event: 'game' }, ({ payload }) => {
        applyGameState(payload);
      })
      .on('broadcast', { event: 'action' }, ({ payload }) => {
        if (!isHost) return;
        handlePlayerAction(payload);
      })
      .on('broadcast', { event: 'request_state' }, ({ payload }) => {
        if (isHost && game) broadcastGame();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            name: myName,
            chips: myChips,
            isHost,
            joinedAt: Date.now(),
          });
          // ask host for current state if joining mid-game
          if (!isHost) {
            channel.send({
              type: 'broadcast',
              event: 'request_state',
              payload: { from: myId },
            });
          }
          showTable();
        } else if (status === 'CHANNEL_ERROR') {
          setError('Could not connect to room. Check Supabase realtime settings.');
        }
      });
  }

  function showTable() {
    lobby.classList.add('hidden');
    table.classList.remove('hidden');
    roomCodeDisplay.textContent = roomCode;
    myChipsEl.textContent = myChips;
    if (isHost) {
      hostControls.classList.remove('hidden');
      statusText.textContent = 'You are the host — press Deal when ready';
    } else {
      statusText.textContent = 'Waiting for host to deal…';
    }
    updateControls();
  }

  function leaveRoom() {
    if (channel) {
      sb.removeChannel(channel);
      channel = null;
    }
    game = null;
    players = {};
    isHost = false;
    roomCode = '';
    table.classList.add('hidden');
    lobby.classList.remove('hidden');
    gameLog.innerHTML = '';
  }

  // ── Host game logic ─────────────────────────────────────────
  function startRound() {
    if (!isHost) return;
    const ids = Object.keys(players);
    if (ids.length < 1) return;

    const deck = makeDeck();
    const seatOrder = ids.slice();
    // host can play too

    const hands = {};
    for (const id of seatOrder) {
      hands[id] = [deck.pop(), deck.pop()];
    }
    const dealer = [deck.pop(), deck.pop()];

    game = {
      phase: 'playing', // playing | dealer | results
      deck,
      dealer,
      dealerReveal: false,
      hands,
      statuses: {},
      results: {},
      turnIndex: 0,
      seatOrder,
      bet: 50,
    };

    for (const id of seatOrder) {
      if (isBlackjack(hands[id])) {
        game.statuses[id] = 'blackjack';
      } else {
        game.statuses[id] = 'playing';
      }
    }

    // skip players who already have blackjack
    advanceTurnPastDone();

    // if everyone has blackjack, go to dealer
    if (game.turnIndex >= game.seatOrder.length) {
      runDealer();
    } else {
      broadcastGame();
      log('New round dealt');
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

  function handlePlayerAction({ playerId, action }) {
    if (!game || game.phase !== 'playing') return;
    if (currentTurnId() !== playerId) return;

    const hand = game.hands[playerId];
    if (action === 'hit') {
      hand.push(game.deck.pop());
      const v = handValue(hand);
      if (v > 21) {
        game.statuses[playerId] = 'bust';
        game.turnIndex++;
        advanceTurnPastDone();
        log(`${players[playerId]?.name || 'Player'} busts`);
      }
    } else if (action === 'stand') {
      game.statuses[playerId] = 'stand';
      game.turnIndex++;
      advanceTurnPastDone();
      log(`${players[playerId]?.name || 'Player'} stands`);
    }

    if (game.turnIndex >= game.seatOrder.length) {
      runDealer();
    } else {
      broadcastGame();
    }
  }

  function runDealer() {
    game.phase = 'dealer';
    game.dealerReveal = true;
    // dealer hits until 17+
    while (handValue(game.dealer) < 17) {
      game.dealer.push(game.deck.pop());
    }
    const dv = handValue(game.dealer);
    const dealerBust = dv > 21;

    for (const id of game.seatOrder) {
      const st = game.statuses[id];
      const pv = handValue(game.hands[id]);
      if (st === 'bust') {
        game.results[id] = 'lose';
      } else if (st === 'blackjack') {
        game.results[id] = dealerBust || !isBlackjack(game.dealer) ? 'bj' : 'push';
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
    broadcastGame();
    log(`Dealer has ${dv}${dealerBust ? ' (bust)' : ''}`);
  }

  function broadcastGame() {
    if (!channel || !game) return;
    channel.send({
      type: 'broadcast',
      event: 'game',
      payload: {
        phase: game.phase,
        dealer: game.dealer,
        dealerReveal: game.dealerReveal,
        hands: game.hands,
        statuses: game.statuses,
        results: game.results,
        turnIndex: game.turnIndex,
        seatOrder: game.seatOrder,
        bet: game.bet,
        hostId: myId,
      },
    });
  }

  function applyGameState(payload) {
    game = payload;

    // sync local player records for rendering
    for (const id of payload.seatOrder || []) {
      if (!players[id]) players[id] = { id, name: 'Player', chips: 1000 };
      players[id].hand = payload.hands[id] || [];
      players[id].status = payload.statuses[id] || 'waiting';
      players[id].result = payload.results?.[id] || null;
      players[id].bet = payload.bet || 0;
    }

    // update chips locally on results (simple fixed bet)
    if (payload.phase === 'results' && payload.results[myId]) {
      const r = payload.results[myId];
      const bet = payload.bet || 50;
      if (r === 'win') myChips += bet;
      else if (r === 'bj') myChips += Math.floor(bet * 1.5);
      else if (r === 'lose') myChips = Math.max(0, myChips - bet);
      // push: no change
      myChipsEl.textContent = myChips;
      if (channel) {
        channel.track({ name: myName, chips: myChips, isHost, joinedAt: Date.now() });
      }
    }

    renderAll();
  }

  // ── Render ──────────────────────────────────────────────────
  function renderAll() {
    renderDealer();
    renderPlayers();
    renderSidebar();
    updateControls();
    updateStatus();
  }

  function renderDealer() {
    if (!game) {
      dealerCards.innerHTML = '';
      dealerTotal.textContent = '';
      return;
    }
    const reveal = game.dealerReveal || game.phase === 'results';
    dealerCards.innerHTML = game.dealer
      .map((c, i) => cardHTML(c, i === 1 && !reveal))
      .join('');
    if (reveal) {
      dealerTotal.textContent = `(${handValue(game.dealer)})`;
    } else if (game.dealer[0]) {
      // show only upcard value hint
      const up = game.dealer[0];
      let v = up.r === 'A' ? 11 : 'JQK'.includes(up.r) ? 10 : parseInt(up.r, 10);
      dealerTotal.textContent = `(${v} + ?)`;
    } else {
      dealerTotal.textContent = '';
    }
  }

  function renderPlayers() {
    playersArea.innerHTML = '';
    const order = game?.seatOrder || Object.keys(players);
    const turnId = currentTurnId();

    for (const id of order) {
      const p = players[id];
      if (!p) continue;
      const hand = game?.hands?.[id] || p.hand || [];
      const status = game?.statuses?.[id] || p.status;
      const result = game?.results?.[id] || p.result;
      const active = turnId === id;

      const el = document.createElement('div');
      el.className = 'player-seat' + (active ? ' active' : '');
      const you = id === myId ? ' <span class="you">(you)</span>' : '';
      let totalStr = '';
      if (hand.length) totalStr = ` <span class="total">(${handValue(hand)})</span>`;

      let resultHtml = '';
      if (result) {
        const labels = { win: 'WIN', lose: 'LOSE', push: 'PUSH', bj: 'BLACKJACK!' };
        resultHtml = `<div class="result ${result}">${labels[result] || result}</div>`;
      } else if (status === 'bust') {
        resultHtml = '<div class="result lose">BUST</div>';
      } else if (status === 'stand') {
        resultHtml = '<div class="result">STAND</div>';
      }

      el.innerHTML = `
        <div class="name">${escapeHtml(p.name || 'Player')}${you}${totalStr}</div>
        <div class="hand">${hand.map((c) => cardHTML(c, false)).join('')}</div>
        ${resultHtml}
      `;
      playersArea.appendChild(el);
    }
  }

  function renderSidebar() {
    playerList.innerHTML = '';
    for (const p of Object.values(players)) {
      const li = document.createElement('li');
      if (p.isHost) li.classList.add('host');
      if (p.id === myId) li.classList.add('me');
      li.innerHTML = `<span>${escapeHtml(p.name)}</span><span>${p.chips ?? '—'}</span>`;
      playerList.appendChild(li);
    }
  }

  function updateStatus() {
    if (!game) {
      statusText.textContent = isHost
        ? 'You are the host — press Deal when ready'
        : 'Waiting for host to deal…';
      return;
    }
    if (game.phase === 'results') {
      statusText.textContent = 'Round over — host can start a new round';
      return;
    }
    if (game.phase === 'dealer') {
      statusText.textContent = 'Dealer is playing…';
      return;
    }
    const tid = currentTurnId();
    if (tid === myId) statusText.textContent = 'Your turn — Hit or Stand';
    else if (tid) statusText.textContent = `${players[tid]?.name || 'Player'}'s turn`;
    else statusText.textContent = '…';
  }

  function updateControls() {
    const myTurn = game && game.phase === 'playing' && currentTurnId() === myId;
    const inRound = game && (game.phase === 'playing' || game.phase === 'dealer');
    const finished = game && game.phase === 'results';

    if (isHost) {
      hostControls.classList.remove('hidden');
      btnDeal.disabled = inRound;
      btnNewRound.disabled = !finished && !!game;
      if (!game) btnNewRound.disabled = true;
    } else {
      hostControls.classList.add('hidden');
    }

    if (myTurn) {
      playerControls.classList.remove('hidden');
      spectateNote.classList.add('hidden');
    } else {
      playerControls.classList.add('hidden');
      if (game && game.phase === 'playing') spectateNote.classList.remove('hidden');
      else spectateNote.classList.add('hidden');
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Events ──────────────────────────────────────────────────
  $('btnCreate').onclick = async () => {
    myName = (nameInput.value || '').trim() || 'Player';
    localStorage.setItem('bj_name', myName);
    setError('');
    const code = randomCode();
    try {
      await joinRoom(code, true);
    } catch (e) {
      setError(e.message || 'Failed to create room');
    }
  };

  $('btnJoin').onclick = async () => {
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
  };

  roomInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btnJoin').click();
  });
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btnCreate').click();
  });

  $('btnLeave').onclick = leaveRoom;

  btnDeal.onclick = () => {
    if (isHost) startRound();
  };
  btnNewRound.onclick = () => {
    if (isHost) startRound();
  };

  btnHit.onclick = () => {
    if (!channel) return;
    channel.send({
      type: 'broadcast',
      event: 'action',
      payload: { playerId: myId, action: 'hit' },
    });
  };
  btnStand.onclick = () => {
    if (!channel) return;
    channel.send({
      type: 'broadcast',
      event: 'action',
      payload: { playerId: myId, action: 'stand' },
    });
  };
})();
