// ===== ONLINE LOBBY + ONLINE-AS-OPTION v1 =====
(function setupOnlineLobby() {
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

    if (onlineToggleSec) {
      onlineToggleSec.style.display = (isLocal || isPuzzle) ? 'none' : '';
    }
    if (isLocal || isPuzzle) {
      if (wantOnline) setWantOnline(false);
    }

    if (colorSec) {
      colorSec.style.display = (isLocal || isPuzzle || wantOnline) ? 'none' : '';
    }
    if (diffSec) {
      diffSec.style.display = (isLocal || isPuzzle || wantOnline) ? 'none' : '';
    }

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
    btn.addEventListener('click', function () {
      setTimeout(refreshModeSections, 0);
    });
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
    if (m === 'blitz') {
      timeWhite = timeBlack = 3 * 60 * 1000;
      increment = 2000;
      if (modeBadge) modeBadge.textContent = 'Online Blitz';
    } else if (m === 'bullet') {
      timeWhite = timeBlack = 60 * 1000;
      increment = 1000;
      if (modeBadge) modeBadge.textContent = 'Online Bullet';
    } else if (m === 'clash') {
      timeWhite = timeBlack = 10 * 60 * 1000;
      increment = 5000;
      if (modeBadge) modeBadge.textContent = 'Online Clash';
    } else {
      timeWhite = timeBlack = 10 * 60 * 1000;
      increment = 5000;
      if (modeBadge) modeBadge.textContent = 'Online';
    }
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
    var asHost = !!isHost;
    if (asHost) {
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
        statusEl.textContent = (typeof playerColor !== 'undefined' && playerColor === 'w') ? 'Your turn' : 'Opponent turn';
        statusEl.classList.remove('gameover');
      }
      if (typeof playMatchIntro === 'function' && settings && settings.anim) {
        playMatchIntro(function () {});
      }
    } catch (e) { console.warn(e); }
  }

  function cancelLobby() {
    hideLobby();
    try {
      if (typeof leaveRoom === 'function') leaveRoom();
    } catch (e) {}
    onlineMode = false;
    oppConnected = false;
    if (typeof openModal === 'function') openModal();
  }

  var cancelBtn = $('lobbyCancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', cancelLobby);

  function applyModeTimesAndInit() {}

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
    selected = null;
    possibleMoves = [];
    lastMove = null;
    gameOver = false;
    thinking = false;
    animating = false;
    if (statusEl) statusEl.classList.remove('gameover');
    if (openingEl) openingEl.textContent = '';
    if (qualityEl) qualityEl.classList.remove('show');

    var onlineType = (document.querySelector('.mode-btn[data-online].selected') || {}).dataset.online || 'create';
    var asHost = onlineType !== 'join';

    if (!asHost) {
      var code = ($('joinCodeInput') && $('joinCodeInput').value) || '';
      var ok = await joinRoom(code);
      if (!ok) return;
      playerColor = 'b';
      flipped = true;
      myColorOnline = 'b';
      if (typeof closeModal === 'function') closeModal();
      if (typeof stopClock === 'function') stopClock();
      if (typeof renderBoard === 'function') renderBoard();
      showLobby(false, roomCode);
      if (statusEl) statusEl.textContent = 'Waiting for match…';
    } else {
      await createRoom();
      playerColor = 'w';
      flipped = false;
      myColorOnline = 'w';
      if (typeof closeModal === 'function') closeModal();
      if (typeof stopClock === 'function') stopClock();
      if (typeof renderBoard === 'function') renderBoard();
      showLobby(true, roomCode);
      if (statusEl) statusEl.textContent = 'Waiting for opponent…';
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
    catch (err) {
      console.error(err);
      alert('Start error: ' + (err && err.message ? err.message : err));
    }
  };

  if (typeof startOnlineGame === 'function') {
    startOnlineGame = startOnlineWithMode;
    window.startOnlineGame = startOnlineWithMode;
  }

  window.__onOnlineOpponentJoined = function () {
    setLobbyOpponentJoined();
    try {
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'lobby_go',
          payload: {
            mode: mode,
            timeWhite: timeWhite,
            timeBlack: timeBlack,
            increment: increment,
            fen: game.fen(),
            hostCosmetic: (myCosmetic && myCosmetic.id) || 'classic',
            secs: 5
          }
        });
      }
    } catch (e) {}
    runCountdown(5, function () {
      try {
        if (channel) {
          channel.send({
            type: 'broadcast',
            event: 'start',
            payload: {
              fen: game.fen(),
              hostCosmetic: (myCosmetic && myCosmetic.id) || 'classic',
              mode: mode,
              timeWhite: timeWhite,
              timeBlack: timeBlack,
              increment: increment
            }
          });
        }
      } catch (e) {}
      beginMatchAfterLobby();
    });
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
      runCountdown(5, function () { beginMatchAfterLobby(); });
    }
  };

  console.log('online lobby ready');
})();
