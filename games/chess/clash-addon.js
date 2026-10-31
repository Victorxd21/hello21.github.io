// ===== CLASH MODE ADDON v3 =====
(function setupClash() {
  var MAX = 10, RATE = 4000, COST = { freeze: 4, rage: 5 };
  var clash = {
    elixirW: 5, elixirB: 5, lastTick: 0, timer: null,
    frozen: {}, rageSq: null, rageLeft: 0, targeting: null,
    blockAi: false
  };
  window.__clashSkipAi = false;
  window.__clash = clash;

  function isClash() { return typeof mode !== 'undefined' && mode === 'clash'; }
  function side() { return (game && game.turn) ? game.turn() : 'w'; }
  function isMyTurn() {
    if (!isClash()) return false;
    if (mode === 'local') return true;
    if (clash.rageLeft > 0 && clash.blockAi) return true;
    return side() === playerColor;
  }
  function elixirOf(c) { return c === 'w' ? clash.elixirW : clash.elixirB; }
  function setElixir(c, v) {
    v = Math.max(0, Math.min(MAX, v));
    if (c === 'w') clash.elixirW = v; else clash.elixirB = v;
    paintElixir();
  }
  function spend(c, n) { setElixir(c, elixirOf(c) - n); }

  function paintElixir() {
    if (!isClash()) return;
    var topC = (playerColor === 'w') ? 'b' : 'w';
    var botC = playerColor || 'w';
    var eT = elixirOf(topC), eB = elixirOf(botC);
    var ft = document.getElementById('elixirFillTop');
    var fb = document.getElementById('elixirFillBot');
    var nt = document.getElementById('elixirTop');
    var nb = document.getElementById('elixirBot');
    if (ft) ft.style.width = (eT / MAX * 100) + '%';
    if (fb) fb.style.width = (eB / MAX * 100) + '%';
    if (nt) nt.textContent = String(Math.floor(eT));
    if (nb) nb.textContent = String(Math.floor(eB));
  }

  function setHint(msg) {
    var h = document.getElementById('clashHint');
    if (!h) return;
    if (!msg) { h.classList.remove('show'); h.textContent = ''; return; }
    h.textContent = msg; h.classList.add('show');
  }

  function showUI(on) {
    ['elixirRowTop', 'elixirRowBot', 'spellsBtn'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('show', !!on);
    });
    if (!on) {
      var p = document.getElementById('spellsPanel');
      if (p) p.classList.remove('show');
      var sb = document.getElementById('spellsBtn');
      if (sb) sb.classList.remove('active');
      setHint('');
    } else paintElixir();
  }

  function clearTarget() {
    clash.targeting = null;
    document.querySelectorAll('.spell-card').forEach(function (c) { c.classList.remove('selected'); });
    var p = document.getElementById('spellsPanel');
    if (p) p.classList.remove('show');
    var sb = document.getElementById('spellsBtn');
    if (sb) sb.classList.remove('active');
  }

  function startElixir() {
    stopElixir();
    clash.lastTick = Date.now();
    clash.timer = setInterval(function () {
      if (!isClash() || gameOver) return;
      var now = Date.now();
      if (now - clash.lastTick >= RATE) {
        var n = Math.floor((now - clash.lastTick) / RATE);
        clash.lastTick += n * RATE;
        clash.elixirW = Math.min(MAX, clash.elixirW + n);
        clash.elixirB = Math.min(MAX, clash.elixirB + n);
        paintElixir();
      }
    }, 250);
  }
  function stopElixir() { if (clash.timer) { clearInterval(clash.timer); clash.timer = null; } }

  function initClash() {
    clash.elixirW = 5; clash.elixirB = 5;
    clash.frozen = {}; clash.rageSq = null; clash.rageLeft = 0;
    clash.targeting = null; clash.blockAi = false;
    window.__clashSkipAi = false;
    showUI(true); startElixir();
    setHint('Clash — spells only on your turn');
    setTimeout(function () { setHint(''); }, 2500);
  }
  function endClash() {
    stopElixir(); showUI(false);
    clash.frozen = {}; clash.rageSq = null; clash.rageLeft = 0;
    clash.targeting = null; clash.blockAi = false;
    window.__clashSkipAi = false;
  }

  function paintMarks() {
    if (!isClash() || !boardEl) return;
    boardEl.querySelectorAll('.sq').forEach(function (el) {
      el.classList.remove('frozen');
      var img = el.querySelector('img.piece');
      if (img) img.classList.remove('raged');
      var s = el.dataset.sq;
      if (!s) return;
      if (clash.frozen[s] && clash.frozen[s].left > 0) el.classList.add('frozen');
      if (clash.rageLeft > 0 && clash.rageSq === s && img) img.classList.add('raged');
    });
  }

  function afterColorMoved(color) {
    Object.keys(clash.frozen).forEach(function (sq) {
      var f = clash.frozen[sq];
      if (f && f.color === color) {
        f.left -= 1;
        if (f.left <= 0) delete clash.frozen[sq];
      }
    });
  }

  function legalFrom(sq) {
    var moves = game.moves({ square: sq, verbose: true }) || [];
    return moves.filter(function (m) {
      return !(clash.frozen[m.from] && clash.frozen[m.from].left > 0);
    });
  }

  function forceSideToMove(color) {
    try {
      var parts = game.fen().split(' ');
      if (parts.length < 4) return false;
      if (parts[1] === color) return true;
      parts[1] = color;
      parts[3] = '-';
      var fen = parts.join(' ');
      var ok = game.load(fen);
      if (!ok) { console.warn('forceSideToMove failed', fen); return false; }
      return true;
    } catch (e) {
      console.warn('forceSideToMove', e);
      return false;
    }
  }

  function castFreeze(sq, caster) {
    var piece = game.get(sq);
    if (!piece || piece.color === caster) { setHint('Freeze: tap an enemy piece'); return false; }
    if (elixirOf(caster) < COST.freeze) { setHint('Need 4 elixir'); return false; }
    spend(caster, COST.freeze);
    clash.frozen[sq] = { color: piece.color, left: 2 };
    setHint('Frozen ' + sq.toUpperCase() + ' for 2 turns');
    paintMarks();
    return true;
  }

  function castRage(sq, caster) {
    var piece = game.get(sq);
    if (!piece || piece.color !== caster) { setHint('Rage: tap your piece'); return false; }
    if (clash.frozen[sq] && clash.frozen[sq].left > 0) { setHint('Cannot Rage a frozen piece'); return false; }
    if (elixirOf(caster) < COST.rage) { setHint('Need 5 elixir'); return false; }
    spend(caster, COST.rage);
    clash.rageSq = sq;
    clash.rageLeft = 2;
    clash.blockAi = (caster === playerColor || mode === 'local');
    setHint('Rage on ' + sq.toUpperCase() + ' — move it twice');
    selected = sq;
    possibleMoves = legalFrom(sq);
    if (typeof renderBoard === 'function') renderBoard();
    paintMarks();
    return true;
  }

  function onBoardCapture(e) {
    if (!isClash()) return;
    var cell = e.target && e.target.closest && e.target.closest('.sq');
    if (!cell || !cell.dataset.sq) return;
    var sq = cell.dataset.sq;

    if (clash.targeting) {
      e.stopPropagation(); e.preventDefault();
      if (!isMyTurn() || gameOver) {
        setHint('Spells only on your turn'); clearTarget(); return;
      }
      var caster = side();
      if (clash.rageLeft > 0 && clash.blockAi) caster = playerColor;
      var ok = false;
      if (clash.targeting === 'freeze') ok = castFreeze(sq, caster);
      else if (clash.targeting === 'rage') ok = castRage(sq, caster);
      clearTarget();
      if (ok) setTimeout(function () { setHint(''); }, 2000);
      return;
    }

    if (clash.frozen[sq] && clash.frozen[sq].left > 0) {
      var p = game.get(sq);
      if (p && (p.color === side() || (clash.blockAi && p.color === playerColor))) {
        e.stopPropagation(); e.preventDefault();
        setHint('That piece is frozen!');
        return;
      }
    }

    if (clash.rageLeft > 0 && clash.rageSq) {
      var p2 = game.get(sq);
      var myC = clash.blockAi ? playerColor : side();
      if (p2 && p2.color === myC && sq !== clash.rageSq && selected !== clash.rageSq) {
        e.stopPropagation(); e.preventDefault();
        setHint('Rage: must move ' + clash.rageSq.toUpperCase());
        selected = clash.rageSq;
        if (side() !== myC) forceSideToMove(myC);
        possibleMoves = legalFrom(clash.rageSq);
        if (typeof renderBoard === 'function') renderBoard();
        paintMarks();
      }
    }
  }

  if (typeof doMove === 'function') {
    var _do = doMove;
    doMove = function (moveObj) {
      if (!isClash()) return _do.apply(this, arguments);

      var from = moveObj.from, to = moveObj.to;

      if (clash.frozen[from] && clash.frozen[from].left > 0) {
        if (side() !== playerColor) {
          var alt = (game.moves({ verbose: true }) || []).filter(function (m) {
            return !(clash.frozen[m.from] && clash.frozen[m.from].left > 0);
          });
          if (alt.length) return _do.call(this, alt[Math.floor(Math.random() * alt.length)]);
        }
        setHint('Frozen — cannot move');
        return;
      }

      if (clash.rageLeft > 0 && clash.rageSq && from !== clash.rageSq) {
        setHint('Rage: only ' + clash.rageSq.toUpperCase());
        return;
      }

      var piece = game.get(from);
      if (piece && side() !== piece.color) {
        forceSideToMove(piece.color);
      }

      var mover = game.turn();
      var rageFirst = (clash.rageLeft === 2 && from === clash.rageSq);
      var rageSecond = (clash.rageLeft === 1 && from === clash.rageSq);

      if (rageFirst) {
        window.__clashSkipAi = true;
        clash.blockAi = true;
      }

      var ret = _do.apply(this, arguments);

      if (!game || game.game_over()) {
        clash.rageLeft = 0; clash.rageSq = null; clash.blockAi = false;
        window.__clashSkipAi = false;
        return ret;
      }

      if (clash.frozen[to]) delete clash.frozen[to];

      if (rageFirst) {
        forceSideToMove(mover);
        clash.rageLeft = 1;
        clash.rageSq = to;
        clash.blockAi = true;
        window.__clashSkipAi = true;
        selected = to;
        thinking = false;
        animating = false;
        possibleMoves = legalFrom(to);
        if (statusEl) statusEl.textContent = 'Rage — move ' + to.toUpperCase() + ' again';
        setHint('Rage! Move ' + to.toUpperCase() + ' again');
        if (typeof setThinking === 'function') setThinking(false);
        if (typeof renderBoard === 'function') renderBoard();
        paintMarks();
        setTimeout(function () {
          if (clash.rageLeft === 1 && clash.rageSq) {
            forceSideToMove(mover);
            thinking = false;
            animating = false;
            window.__clashSkipAi = true;
            if (typeof setThinking === 'function') setThinking(false);
            selected = clash.rageSq;
            possibleMoves = legalFrom(clash.rageSq);
            if (statusEl) statusEl.textContent = 'Rage — move again';
            if (typeof renderBoard === 'function') renderBoard();
            paintMarks();
          }
        }, 350);
        return ret;
      }

      if (rageSecond) {
        clash.rageLeft = 0;
        clash.rageSq = null;
        clash.blockAi = false;
        window.__clashSkipAi = false;
        setHint('');
        afterColorMoved(mover);
        paintMarks();
        paintElixir();
        if (mode !== 'local' && !game.game_over()) {
          var expect = (mover === 'w') ? 'b' : 'w';
          if (side() !== expect) forceSideToMove(expect);
          setTimeout(function () {
            if (!clash.blockAi && typeof aiMove === 'function' && !game.game_over()) {
              aiMove();
            }
          }, 450);
        }
        return ret;
      }

      if (clash.rageLeft > 0 && from === clash.rageSq) {
        clash.rageLeft = 0; clash.rageSq = null; clash.blockAi = false;
        window.__clashSkipAi = false;
      }
      afterColorMoved(mover);
      paintMarks();
      paintElixir();
      return ret;
    };
    window.doMove = doMove;
  }

  if (typeof renderBoard === 'function') {
    var _rb = renderBoard;
    renderBoard = function () {
      var r = _rb.apply(this, arguments);
      if (isClash()) paintMarks();
      return r;
    };
    window.renderBoard = renderBoard;
  }

  function aiMaybeSpell() {
    if (!isClash() || gameOver) return;
    var c = side();
    if (c === playerColor && mode !== 'local') return;
    if (clash.rageLeft > 0) return;
    var pool = elixirOf(c);
    var files = 'abcdefgh';

    if (pool >= COST.freeze && Math.random() < 0.5) {
      var enemies = [];
      for (var r = 1; r <= 8; r++) for (var f = 0; f < 8; f++) {
        var s = files[f] + r;
        var p = game.get(s);
        if (p && p.color !== c && !(clash.frozen[s] && clash.frozen[s].left > 0)) {
          var val = ({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 })[p.type] || 0;
          enemies.push({ sq: s, val: val });
        }
      }
      enemies.sort(function (a, b) { return b.val - a.val; });
      if (enemies.length && enemies[0].val >= 3) {
        castFreeze(enemies[0].sq, c);
        setHint('Stockfish froze ' + enemies[0].sq.toUpperCase());
        return;
      }
    }
    if (pool >= COST.rage && Math.random() < 0.4) {
      var cands = [];
      for (var r2 = 1; r2 <= 8; r2++) for (var f2 = 0; f2 < 8; f2++) {
        var s2 = files[f2] + r2;
        var p2 = game.get(s2);
        if (p2 && p2.color === c && !(clash.frozen[s2] && clash.frozen[s2].left > 0)) {
          var ms = game.moves({ square: s2, verbose: true }) || [];
          var caps = ms.filter(function (m) { return !!m.captured; }).length;
          if (ms.length) cands.push({ sq: s2, caps: caps, n: ms.length, type: p2.type });
        }
      }
      cands.sort(function (a, b) { return (b.caps - a.caps) || (b.n - a.n); });
      if (cands.length && (cands[0].caps > 0 || cands[0].type === 'q' || cands[0].type === 'n')) {
        castRage(cands[0].sq, c);
        setHint('Stockfish raged ' + cands[0].sq.toUpperCase());
      }
    }
  }

  if (typeof aiMove === 'function') {
    var _ai = aiMove;
    aiMove = async function () {
      if (!isClash()) return _ai.apply(this, arguments);

      if (clash.blockAi && clash.rageLeft > 0) {
        if (typeof setThinking === 'function') setThinking(false);
        thinking = false;
        return;
      }
      if (window.__clashSkipAi) {
        window.__clashSkipAi = false;
        if (typeof setThinking === 'function') setThinking(false);
        thinking = false;
        return;
      }

      var aiColor = side();
      if (mode !== 'local' && aiColor === playerColor) {
        var opp = playerColor === 'w' ? 'b' : 'w';
        forceSideToMove(opp);
        aiColor = side();
        if (aiColor === playerColor) {
          if (typeof setThinking === 'function') setThinking(false);
          return;
        }
      }

      if (clash.rageLeft > 0 && clash.rageSq) {
        var ms = legalFrom(clash.rageSq);
        if (ms.length) {
          if (typeof setThinking === 'function') setThinking(true);
          var choice = ms.find(function (m) { return m.captured; }) || ms[Math.floor(Math.random() * ms.length)];
          setTimeout(function () {
            if (typeof setThinking === 'function') setThinking(false);
            doMove(choice);
          }, 350);
          return;
        }
        clash.rageLeft = 0; clash.rageSq = null; clash.blockAi = false;
      }

      aiMaybeSpell();

      if (clash.rageLeft === 2 && clash.rageSq && side() !== playerColor) {
        var ms2 = legalFrom(clash.rageSq);
        if (ms2.length) {
          if (typeof setThinking === 'function') setThinking(true);
          var choice2 = ms2.find(function (m) { return m.captured; }) || ms2[0];
          setTimeout(function () {
            if (typeof setThinking === 'function') setThinking(false);
            doMove(choice2);
          }, 400);
          return;
        }
      }

      return _ai.apply(this, arguments);
    };
    window.aiMove = aiMove;
  }

  if (typeof onSquareClick === 'function') {
    var _on = onSquareClick;
    onSquareClick = function (sq) {
      if (isClash() && clash.rageLeft > 0 && clash.blockAi) {
        if (side() !== playerColor) forceSideToMove(playerColor);
        thinking = false;
        animating = false;
      }
      return _on.apply(this, arguments);
    };
    window.onSquareClick = onSquareClick;
  }

  var spellsBtn = document.getElementById('spellsBtn');
  var spellsPanel = document.getElementById('spellsPanel');
  if (spellsBtn) {
    spellsBtn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (!isClash() || gameOver) return;
      if (!isMyTurn()) { setHint('Spells only on your turn'); return; }
      if (clash.rageLeft > 0) { setHint('Finish your Rage moves first'); return; }
      var open = spellsPanel.classList.toggle('show');
      spellsBtn.classList.toggle('active', open);
      if (!open) clearTarget();
    });
  }
  document.querySelectorAll('.spell-card').forEach(function (card) {
    card.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (!isClash() || !isMyTurn()) { setHint('Spells only on your turn'); return; }
      var sp = card.dataset.spell;
      var cost = COST[sp] || 99;
      var caster = (clash.blockAi && clash.rageLeft > 0) ? playerColor : side();
      if (elixirOf(caster) < cost) { setHint('Need ' + cost + ' elixir'); return; }
      document.querySelectorAll('.spell-card').forEach(function (c) { c.classList.remove('selected'); });
      card.classList.add('selected');
      clash.targeting = sp;
      if (spellsPanel) spellsPanel.classList.remove('show');
      if (spellsBtn) spellsBtn.classList.remove('active');
      setHint(sp === 'freeze' ? 'Tap an enemy piece to Freeze' : 'Tap your piece to Rage');
    });
  });

  document.querySelectorAll('.mode-btn[data-mode]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setTimeout(function () {
        var sel = document.querySelector('.mode-btn[data-mode].selected');
        if (sel && sel.dataset.mode === 'clash') {
          var cs = document.getElementById('colorSection');
          var ds = document.getElementById('diffSection');
          var os = document.getElementById('onlineSection');
          if (cs) cs.style.display = '';
          if (ds) ds.style.display = '';
          if (os) os.style.display = 'none';
        }
      }, 0);
    });
  });

  function bindBoard() {
    if (!boardEl) return;
    boardEl.removeEventListener('click', onBoardCapture, true);
    boardEl.addEventListener('click', onBoardCapture, true);
  }
  bindBoard();
  setInterval(function () { if (isClash()) bindBoard(); }, 1000);

  var _start = window.startNewGame;
  window.startNewGame = function () {
    var modeBtn = document.querySelector('.mode-btn[data-mode].selected');
    var m = modeBtn ? modeBtn.dataset.mode : 'normal';
    if (m !== 'clash') endClash();
    _start.apply(this, arguments);
    if (m === 'clash') {
      mode = 'clash';
      var mb = document.getElementById('modeBadge');
      if (mb) mb.textContent = 'Clash';
      if (typeof timeWhite !== 'undefined') {
        timeWhite = timeWhite || 10 * 60 * 1000;
        timeBlack = timeBlack || 10 * 60 * 1000;
      }
      initClash();
      bindBoard();
    }
  };
  window.__startChess = function (e) {
    if (e) { try { e.preventDefault(); } catch (x) {} }
    try { window.startNewGame(); }
    catch (err) { console.error(err); alert('Start error: ' + (err && err.message ? err.message : err)); }
  };
})();
