// ===== ONLINE LOBBY v4 =====
(function setupOnlineLobby() {
  if (!document.getElementById('onlineLobbyStyles')) {
    var st = document.createElement('style');
    st.id = 'onlineLobbyStyles';
    st.textContent = '.online-toggle-row{display:flex;align-items:center}.online-toggle{display:flex;align-items:center;gap:12px;width:100%;padding:10px 14px;border-radius:12px;border:2px solid var(--panel2);background:var(--panel2);color:var(--text);cursor:pointer;font:inherit}.online-toggle[aria-pressed="true"]{border-color:var(--accent);background:rgba(91,141,239,.15)}.online-toggle .ot-knob{width:44px;height:26px;border-radius:13px;background:#3a4155;position:relative;flex-shrink:0;transition:.2s}.online-toggle .ot-knob::after{content:\'\';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#9aa3b5;transition:.2s}.online-toggle[aria-pressed="true"] .ot-knob{background:var(--accent)}.online-toggle[aria-pressed="true"] .ot-knob::after{left:21px;background:#fff}.online-toggle .ot-label{font-size:.9rem;font-weight:600}.match-lobby{position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;background:rgba(6,8,14,.88);backdrop-filter:blur(10px);padding:16px}.match-lobby.show{display:flex}.lobby-card{width:min(420px,100%);background:var(--panel);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:22px 18px 18px;box-shadow:0 20px 60px rgba(0,0,0,.5)}.lobby-code-wrap{text-align:center;margin-bottom:18px}.lobby-code-label{font-size:.7rem;text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}.lobby-code{font-size:2rem;font-weight:800;letter-spacing:.28em;margin:6px 0;color:var(--accent)}.lobby-code-hint{font-size:.75rem;color:var(--muted)}.lobby-vs-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px 0 16px}.lobby-player{flex:1;text-align:center;padding:12px 8px;border-radius:14px;background:var(--panel2)}.lobby-pieces{display:flex;justify-content:center;gap:4px;margin-bottom:8px;min-height:36px}.lobby-pieces img{width:32px;height:32px;object-fit:contain}.lobby-avatar{width:48px;height:48px;border-radius:50%;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;background:linear-gradient(135deg,#3d4f7a,#5b8def);color:#fff}.lobby-avatar.empty{background:#2a3142;color:var(--muted)}.lobby-avatar.ready{background:linear-gradient(135deg,#2d6a4f,#52b788)}.lobby-name{font-weight:700;font-size:.95rem}.lobby-sub{font-size:.75rem;color:var(--muted);margin-top:2px}.lobby-center{width:88px;text-align:center;flex-shrink:0}.lobby-vs{font-weight:800;font-size:1.1rem;opacity:.5;letter-spacing:.1em}.lobby-wait{font-size:.8rem;color:var(--muted);margin-top:6px}.lobby-wait .dots::after{content:\'\';animation:lobbyDots 1.2s steps(4,end) infinite}@keyframes lobbyDots{0%{content:\'\'}25%{content:\'.\'}50%{content:\'..\'}75%{content:\'...\'}}.lobby-countdown{font-size:2.4rem;font-weight:800;color:var(--accent);line-height:1;margin-top:4px}.lobby-countdown.pulse{animation:lobbyPulse .45s ease}@keyframes lobbyPulse{0%{transform:scale(.7);opacity:.4}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}.lobby-cancel{width:100%;margin-top:8px;padding:12px;border-radius:12px;border:none;background:var(--panel2);color:var(--text);font-weight:600;cursor:pointer}.lobby-start{width:100%;margin-top:10px;padding:14px;border-radius:12px;border:none;background:var(--accent);color:#fff;font-weight:700;font-size:1.05rem;cursor:pointer;display:none}.lobby-start.show{display:block}.lobby-start:disabled{opacity:.5;cursor:not-allowed}.lobby-toast{position:fixed;top:18px;left:50%;transform:translateX(-50%) translateY(-120%);background:#1b4332;color:#b7e4c7;border:1px solid #52b788;padding:12px 18px;border-radius:12px;font-weight:600;font-size:.9rem;z-index:200;transition:transform .35s cubic-bezier(.2,.9,.2,1),opacity .35s;opacity:0;pointer-events:none;box-shadow:0 8px 28px rgba(0,0,0,.4)}.lobby-toast.show{transform:translateX(-50%) translateY(0);opacity:1}.lobby-status-line{text-align:center;font-size:.8rem;color:var(--muted);margin-top:6px;min-height:1.2em}';
    document.head.appendChild(st);
  }

  document.querySelectorAll('.mode-btn[data-mode="online"]').forEach(function (b) {
    b.style.display = 'none';
    b.classList.remove('selected');
  });

  if (!document.getElementById('onlineToggle')) {
    var onlineSec = document.getElementById('onlineSection');
    var wrap = document.createElement('div');
    wrap.className = 'section';
    wrap.id = 'onlineToggleSection';
    wrap.innerHTML = '<label>Play Online</label><div class="online-toggle-row"><button type="button" class="online-toggle" id="onlineToggle" aria-pressed="false"><span class="ot-knob"></span><span class="ot-label" id="onlineToggleLabel">Off · vs AI</span></button></div>';
    if (onlineSec && onlineSec.parentNode) onlineSec.parentNode.insertBefore(wrap, onlineSec);
  }
  var onlineSec2 = document.getElementById('onlineSection');
  if (onlineSec2) {
    var lab0 = onlineSec2.querySelector('label');
    if (lab0) lab0.textContent = 'Room';
  }

  if (!document.getElementById('matchLobby')) {
    var lob = document.createElement('div');
    lob.id = 'matchLobby';
    lob.className = 'match-lobby';
    lob.setAttribute('aria-hidden', 'true');
    lob.innerHTML = '<div class="lobby-card"><div class="lobby-code-wrap" id="lobbyCodeWrap" style="display:none"><div class="lobby-code-label">Room code</div><div class="lobby-code" id="lobbyCode">------</div><div class="lobby-code-hint">Share this with your friend</div></div><div class="lobby-vs-row"><div class="lobby-player host"><div class="lobby-pieces" id="lobbyPiecesLeft"><img src="https://cdn.jsdelivr.net/gh/lichess-org/lila@master/public/piece/cburnett/wK.svg" alt=""><img src="https://cdn.jsdelivr.net/gh/lichess-org/lila@master/public/piece/cburnett/wQ.svg" alt=""></div><div class="lobby-avatar" id="lobbyAvatarLeft">You</div><div class="lobby-name" id="lobbyNameLeft">You</div><div class="lobby-sub" id="lobbySubLeft">White</div></div><div class="lobby-center"><div class="lobby-vs" id="lobbyVs">VS</div><div class="lobby-countdown" id="lobbyCountdown" hidden></div><div class="lobby-wait" id="lobbyWait">Waiting<span class="dots"></span></div></div><div class="lobby-player guest"><div class="lobby-pieces" id="lobbyPiecesRight"><img src="https://cdn.jsdelivr.net/gh/lichess-org/lila@master/public/piece/cburnett/bK.svg" alt=""><img src="https://cdn.jsdelivr.net/gh/lichess-org/lila@master/public/piece/cburnett/bQ.svg" alt=""></div><div class="lobby-avatar empty" id="lobbyAvatarRight">?</div><div class="lobby-name" id="lobbyNameRight">Opponent</div><div class="lobby-sub" id="lobbySubRight">Black</div></div></div><div class="lobby-status-line" id="lobbyStatusLine"></div><button type="button" class="lobby-start" id="lobbyStartBtn">Start match</button><button type="button" class="lobby-cancel" id="lobbyCancelBtn">Cancel</button></div>';
    if (!document.getElementById('lobbyToast')) {
      var toast = document.createElement('div');
      toast.id = 'lobbyToast';
      toast.className = 'lobby-toast';
      document.body.appendChild(toast);
    }
    document.body.appendChild(lob);
  }

  var wantOnline = false;
  var lobbyTimer = null;
  var countdownOn = false;
  function $(id) { return document.getElementById(id); }

  function setWantOnline(on) {
    wantOnline = !!on;
    var tog = $('onlineToggle');
    var lab = $('onlineToggleLabel');
    var sec = $('onlineSection');
    if (tog) tog.setAttribute('aria-pressed', wantOnline ? 'true' : 'false');
    if (lab) lab.textContent = wantOnline ? 'On · vs friend' : 'Off · vs AI';
    if (sec) sec.style.display = wantOnline ? '' : 'none';
    refreshModeSections();
  }

  function refreshModeSections() {
    var modeBtn = document.querySelector('.mode-btn[data-mode].selected');
    var m = modeBtn ? modeBtn.dataset.mode : 'normal';
    var isLocal = m === 'local';
    var isPuzzle = m === 'puzzle';
    var onlineType = (document.querySelector('.mode-btn[data-online].selected') || {}).dataset.online || 'create';
    var colorSec = $('colorSection');
    var diffSec = $('diffSection');
    var onlineToggleSec = $('onlineToggleSection');
    if (onlineToggleSec) onlineToggleSec.style.display = (isLocal || isPuzzle) ? 'none' : '';
    if ((isLocal || isPuzzle) && wantOnline) setWantOnline(false);
    if (colorSec) colorSec.style.display = (isLocal || isPuzzle || wantOnline) ? 'none' : '';
    if (diffSec) diffSec.style.display = (isLocal || isPuzzle || wantOnline) ? 'none' : '';
    var createUI = $('createRoomUI');
    var joinUI = $('joinRoomUI');
    if (createUI) createUI.style.display = (wantOnline && onlineType === 'create') ? '' : 'none';
    if (joinUI) joinUI.style.display = (wantOnline && onlineType === 'join') ? '' : 'none';
  }

  var tog = $('onlineToggle');
  if (tog) {
    tog.addEventListener('click', function (e) {
      e.preventDefault();
      setWantOnline(!(tog.getAttribute('aria-pressed') === 'true'));
    });
  }
  document.querySelectorAll('.mode-btn[data-mode]').forEach(function (btn) {
    btn.addEventListener('click', function () { setTimeout(refreshModeSections, 0); });
  });
  document.querySelectorAll('.mode-btn[data-online]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.mode-btn[data-online]').forEach(function (b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      refreshModeSections();
    });
  });
  setWantOnline(false);

  function applyModeTimes(m) {
    if (m === 'blitz') { timeWhite = timeBlack = 3 * 60 * 1000; increment = 2000; if (modeBadge) modeBadge.textContent = 'Online Blitz'; }
    else if (m === 'bullet') { timeWhite = timeBlack = 60 * 1000; increment = 1000; if (modeBadge) modeBadge.textContent = 'Online Bullet'; }
    else if (m === 'clash') { timeWhite = timeBlack = 10 * 60 * 1000; increment = 5000; if (modeBadge) modeBadge.textContent = 'Online Clash'; }
    else { timeWhite = timeBlack = 10 * 60 * 1000; increment = 5000; if (modeBadge) modeBadge.textContent = 'Online'; }
  }

  function showLobby(asHost, code) {
    var el = $('matchLobby');
    if (!el) return;
    el.classList.add('show');
    el.setAttribute('aria-hidden', 'false');
    var codeWrap = $('lobbyCodeWrap');
    if (codeWrap) codeWrap.style.display = asHost ? '' : 'none';
    if (code && $('lobbyCode')) $('lobbyCode').textContent = code;
    var leftYou = asHost;
    $('lobbyNameLeft').textContent = leftYou ? 'You' : 'Opponent';
    $('lobbySubLeft').textContent = 'White';
    $('lobbyAvatarLeft').textContent = leftYou ? 'You' : '?';
    $('lobbyAvatarLeft').className = 'lobby-avatar' + (leftYou ? '' : ' empty');
    $('lobbyNameRight').textContent = leftYou ? 'Opponent' : 'You';
    $('lobbySubRight').textContent = 'Black';
    $('lobbyAvatarRight').textContent = leftYou ? '?' : 'You';
    $('lobbyAvatarRight').className = 'lobby-avatar' + (leftYou ? ' empty' : '');
    $('lobbyWait').hidden = false;
    $('lobbyWait').style.display = '';
    $('lobbyCountdown').hidden = true;
    $('lobbyCountdown').textContent = '';
    $('lobbyVs').style.opacity = '.5';
    countdownOn = false;
  }

  function hideLobby() {
    var el = $('matchLobby');
    if (!el) return;
    el.classList.remove('show');
    el.setAttribute('aria-hidden', 'true');
    if (lobbyTimer) { clearInterval(lobbyTimer); lobbyTimer = null; }
    countdownOn = false;
  }

  function setLobbyOpponentJoined() {
    if (isHost) {
      $('lobbyAvatarRight').textContent = 'P2';
      $('lobbyAvatarRight').className = 'lobby-avatar ready';
      $('lobbyNameRight').textContent = 'Opponent';
    } else {
      $('lobbyAvatarLeft').textContent = 'P1';
      $('lobbyAvatarLeft').className = 'lobby-avatar ready';
      $('lobbyNameLeft').textContent = 'Opponent';
    }
  }

  function runCountdown(seconds, onDone) {
    if (countdownOn) return;
    countdownOn = true;
    var n = seconds | 0;
    if (n < 1) n = 5;
    var wait = $('lobbyWait');
    var cd = $('lobbyCountdown');
    var vs = $('lobbyVs');
    if (wait) wait.style.display = 'none';
    if (vs) vs.style.opacity = '0.25';
    if (cd) {
      cd.hidden = false;
      cd.textContent = String(n);
      cd.classList.remove('pulse');
      void cd.offsetWidth;
      cd.classList.add('pulse');
    }
    if (lobbyTimer) clearInterval(lobbyTimer);
    lobbyTimer = setInterval(function () {
      n -= 1;
      if (n <= 0) {
        clearInterval(lobbyTimer);
        lobbyTimer = null;
        hideLobby();
        if (onDone) onDone();
        return;
      }
      if (cd) {
        cd.textContent = String(n);
        cd.classList.remove('pulse');
        void cd.offsetWidth;
        cd.classList.add('pulse');
      }
    }, 1000);
  }

  function beginMatchAfterLobby() {
    try {
      if (typeof renderBoard === 'function') renderBoard();
      if (typeof updateMovesList === 'function') updateMovesList();
      if (typeof startClock === 'function') startClock();
      if (typeof updateStatsUI === 'function') updateStatsUI();
      if (statusEl) {
        statusEl.textContent = (playerColor === 'w') ? 'Your turn' : 'Opponent turn';
        statusEl.classList.remove('gameover');
      }
      if (typeof playMatchIntro === 'function' && settings && settings.anim) playMatchIntro(function () {});
    } catch (e) { console.warn(e); }
  }

  function cancelLobby() {
    hideLobby();
    try { if (typeof leaveRoom === 'function') leaveRoom(); } catch (e) {}
    onlineMode = false;
    oppConnected = false;
    if (typeof openModal === 'function') openModal();
  }
  var cancelBtn = $('lobbyCancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', cancelLobby);

  function showToast(msg) {
    var t = document.getElementById('lobbyToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'lobbyToast';
      t.className = 'lobby-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    try { if (navigator.vibrate) navigator.vibrate(80); } catch (e) {}
    clearTimeout(showToast._tm);
    showToast._tm = setTimeout(function () { t.classList.remove('show'); }, 3500);
  }
  function setLobbyStatus(msg) {
    var el = document.getElementById('lobbyStatusLine');
    if (el) el.textContent = msg || '';
  }
  function showStartButton(on) {
    var btn = document.getElementById('lobbyStartBtn');
    if (!btn) return;
    btn.classList.toggle('show', !!on);
    btn.disabled = !on;
  }
  function hostStartMatch() {
    if (!isHost || countdownOn) return;
    if (!oppConnected) { setLobbyStatus('Wait for opponent to join'); return; }
    showStartButton(false);
    setLobbyStatus('Starting…');
    try {
      if (channel) {
        channel.send({ type: 'broadcast', event: 'lobby_go', payload: {
          mode: mode, timeWhite: timeWhite, timeBlack: timeBlack, increment: increment,
          fen: game.fen(), hostCosmetic: (myCosmetic && myCosmetic.id) || 'classic', secs: 5
        }});
      }
    } catch (e) {}
    runCountdown(5, function () {
      try {
        if (channel) {
          channel.send({ type: 'broadcast', event: 'start', payload: {
            fen: game.fen(), hostCosmetic: (myCosmetic && myCosmetic.id) || 'classic',
            mode: mode, timeWhite: timeWhite, timeBlack: timeBlack, increment: increment
          }});
        }
      } catch (e) {}
      beginMatchAfterLobby();
    });
  }

  async function startOnlineWithMode() {
    if (typeof ensureAudio === 'function') ensureAudio();
    if (typeof leaveRoom === 'function') leaveRoom();
    puzzleMode = false;
    onlineMode = true;
    var pb = $('puzzleBanner');
    if (pb) pb.style.display = 'none';
    var evalBar = $('evalBar');
    if (evalBar) evalBar.style.opacity = '1';
    var modeBtn = document.querySelector('.mode-btn[data-mode].selected');
    mode = modeBtn ? modeBtn.dataset.mode : 'normal';
    if (mode === 'local' || mode === 'puzzle') mode = 'normal';
    applyModeTimes(mode);
    game = new Chess();
    selected = null; possibleMoves = []; lastMove = null;
    gameOver = false; thinking = false; animating = false;
    if (statusEl) statusEl.classList.remove('gameover');
    if (openingEl) openingEl.textContent = '';
    if (qualityEl) qualityEl.classList.remove('show');
    var onlineType = (document.querySelector('.mode-btn[data-online].selected') || {}).dataset.online || 'create';
    var asHost = onlineType !== 'join';
    if (!asHost) {
      var code = ($('joinCodeInput') && $('joinCodeInput').value) || '';
      var ok = await joinRoom(code);
      if (!ok) return;
      playerColor = 'b'; flipped = true; myColorOnline = 'b';
      if (typeof closeModal === 'function') closeModal();
      if (typeof stopClock === 'function') stopClock();
      if (typeof renderBoard === 'function') renderBoard();
      showLobby(false, roomCode);
      if (statusEl) statusEl.textContent = 'Waiting for host…';
      setLobbyStatus('Connected — waiting for host to start');
      try {
        if (channel) {
          setTimeout(function () {
            try {
              channel.send({
                type: 'broadcast',
                event: 'player_joined',
                payload: { cosmetic: (myCosmetic && myCosmetic.id) || 'classic', role: 'guest' }
              });
            } catch (e) {}
          }, 400);
          var pings = 0;
          var pingIv = setInterval(function () {
            pings += 1;
            if (pings > 8 || countdownOn) { clearInterval(pingIv); return; }
            try {
              channel.send({
                type: 'broadcast',
                event: 'player_joined',
                payload: { cosmetic: (myCosmetic && myCosmetic.id) || 'classic', role: 'guest' }
              });
            } catch (e) {}
          }, 1500);
          channel.on('broadcast', { event: 'lobby_go' }, function (msg) {
            if (isHost) return;
            var payload = (msg && msg.payload) || {};
            setLobbyOpponentJoined();
            if (payload.mode) mode = payload.mode;
            if (payload.timeWhite) timeWhite = payload.timeWhite;
            if (payload.timeBlack) timeBlack = payload.timeBlack;
            if (payload.increment != null) increment = payload.increment;
            if (payload.fen) { try { game = new Chess(payload.fen); } catch (e) {} }
            showToast('Host started the match!');
            setLobbyStatus('Match starting…');
            if (!countdownOn) runCountdown(payload.secs || 5, function () { beginMatchAfterLobby(); });
          });
        }
      } catch (e) {}
    } else {
      await createRoom();
      playerColor = 'w'; flipped = false; myColorOnline = 'w';
      if (typeof closeModal === 'function') closeModal();
      if (typeof stopClock === 'function') stopClock();
      if (typeof renderBoard === 'function') renderBoard();
      showLobby(true, roomCode);
      if (statusEl) statusEl.textContent = 'Waiting for opponent…';
      setLobbyStatus('Share the code — waiting for opponent');
      try {
        if (channel) {
          channel.on('broadcast', { event: 'player_joined' }, function (msg) {
            var payload = (msg && msg.payload) || {};
            if (payload.cosmetic && typeof COSMETICS !== 'undefined') {
              oppCosmetic = COSMETICS.find(function (c) { return c.id === payload.cosmetic; }) || COSMETICS[0];
            }
            oppConnected = true;
            if (typeof window.__onOnlineOpponentJoined === 'function') window.__onOnlineOpponentJoined();
          });
          if (window.__lobbyPoll) clearInterval(window.__lobbyPoll);
          window.__lobbyPoll = setInterval(function () {
            if (!isHost || !channel || countdownOn) return;
            var lobEl = document.getElementById('matchLobby');
            if (!(lobEl && lobEl.classList.contains('show'))) {
              clearInterval(window.__lobbyPoll);
              return;
            }
            try {
              var state = channel.presenceState() || {};
              var keys = Object.keys(state);
              var others = keys.filter(function (k) { return k !== 'host'; });
              var startBtn = document.getElementById('lobbyStartBtn');
              if (others.length && startBtn && !startBtn.classList.contains('show')) {
                oppConnected = true;
                if (typeof window.__onOnlineOpponentJoined === 'function') window.__onOnlineOpponentJoined();
              }
            } catch (e) {}
          }, 1000);
        }
      } catch (e) { console.warn(e); }
    }
  }

  var _start = window.startNewGame;
  window.startNewGame = function () {
    var modeBtn = document.querySelector('.mode-btn[data-mode].selected');
    var m = modeBtn ? modeBtn.dataset.mode : 'normal';
    if (m === 'online') {
      wantOnline = true;
      m = 'normal';
      if (modeBtn) modeBtn.classList.remove('selected');
      var n = document.querySelector('.mode-btn[data-mode="normal"]');
      if (n) n.classList.add('selected');
    }
    if (wantOnline && m !== 'local' && m !== 'puzzle') {
      startOnlineWithMode();
      return;
    }
    hideLobby();
    return _start.apply(this, arguments);
  };
  window.__startChess = function (e) {
    if (e) { try { e.preventDefault(); } catch (x) {} }
    try { window.startNewGame(); }
    catch (err) { console.error(err); alert('Start error: ' + (err && err.message ? err.message : err)); }
  };
  if (typeof startOnlineGame === 'function') {
    startOnlineGame = startOnlineWithMode;
    window.startOnlineGame = startOnlineWithMode;
  }

  window.__onOnlineOpponentJoined = function () {
    var startBtn = document.getElementById('lobbyStartBtn');
    var already = startBtn && startBtn.classList.contains('show');
    setLobbyOpponentJoined();
    if (!already) showToast('Opponent joined the room!');
    setLobbyStatus('Opponent ready — press Start');
    showStartButton(true);
    var wait = document.getElementById('lobbyWait');
    if (wait) wait.style.display = 'none';
    var vs = document.getElementById('lobbyVs');
    if (vs) vs.style.opacity = '1';
    oppConnected = true;
  };

  window.__onOnlineLobbyStart = function (payload) {
    setLobbyOpponentJoined();
    if (payload) {
      if (payload.mode) mode = payload.mode;
      if (payload.timeWhite) timeWhite = payload.timeWhite;
      if (payload.timeBlack) timeBlack = payload.timeBlack;
      if (payload.increment != null) increment = payload.increment;
    }
    if (!countdownOn) {
      setLobbyStatus('Match starting…');
      showStartButton(false);
      runCountdown(5, function () { beginMatchAfterLobby(); });
    }
  };

  function bindStartBtn() {
    var btn = document.getElementById('lobbyStartBtn');
    if (!btn || btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      hostStartMatch();
    });
  }
  bindStartBtn();
  setInterval(bindStartBtn, 1000);

  var _showLobbyOrig = showLobby;
  showLobby = function (asHost, code) {
    _showLobbyOrig(asHost, code);
    showStartButton(false);
    if (asHost) setLobbyStatus('Share the code — waiting for opponent');
    else setLobbyStatus('Connected — waiting for host to start');
    bindStartBtn();
  };

  console.log('online lobby v4 ready');
})();
