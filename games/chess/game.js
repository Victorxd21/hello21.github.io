(async function () {
  var url = 'https://cdn.jsdelivr.net/gh/Victorxd21/hello21.github.io@339303459285656e422ed49e9b5ad2636f2cc6a5/games/chess/game.js';
  var js;
  try {
    js = await (await fetch(url + '?t=' + Date.now())).text();
  } catch (e) {
    console.error('fetch fail', e);
    var b = document.getElementById('engineBadge');
    if (b) b.textContent = 'load error';
    return;
  }

  js = js.replace(
    "function updateEvalBar(){if(!settings.eval||puzzleMode){document.getElementById('evalFill').style.height='50%';return}const score=evaluate(game);let pct=50+Math.max(-48,Math.min(48,score/20));document.getElementById('evalFill').style.height=pct+'%';const label=Math.abs(score)>9000?'M':(Math.abs(score)/100).toFixed(1);const sign=score>50?'+':score<-50?'-':'';if(score>=0){document.getElementById('evalBot').textContent=sign+label;document.getElementById('evalTop').textContent=''}else{document.getElementById('evalTop').textContent='-'+label;document.getElementById('evalBot').textContent=''}",
    "function updateEvalBar(){var fill=document.getElementById('evalFill');if(!settings.eval||puzzleMode){if(fill)fill.style.height='50%';return}var score=evaluate(game);var pct=50+Math.max(-48,Math.min(48,score/20));if(fill)fill.style.height=pct+'%';var label=Math.abs(score)>9000?'M':(Math.abs(score)/100).toFixed(1);var sign=score>50?'+':score<-50?'-':'';var eb=document.getElementById('evalBot');var et=document.getElementById('evalTop');if(score>=0){if(eb)eb.textContent=sign+label;if(et)et.textContent=''}else{if(et)et.textContent='-'+label;if(eb)eb.textContent=''}"
  );

  js = js.replace(
    "const slider=document.createElement('div');slider.className='sliding-piece';const img=document.createElement('img');img.src=pieceSrc(pieceColor,pieceType);slider.appendChild(img);",
    "const slider=document.createElement('div');slider.className='sliding-piece';const img=document.createElement('img');img.src=pieceSrc(pieceColor,pieceType);if(pieceType==='k'||pieceType==='q'){var cos=(onlineMode?(pieceColor===myColorOnline?myCosmetic:oppCosmetic):myCosmetic);if(cos&&cos.cls){img.classList.add(cos.cls);slider.classList.add('fx-'+cos.id)}}slider.appendChild(img);"
  );

  js = js.replace(
    "document.getElementById('puzzleBanner').style.display='none';",
    "var _pb=document.getElementById('puzzleBanner');if(_pb)_pb.style.display='none';"
  );

  js = js.replace(
    "initStockfish();\nfillCosmeticGrid();\ninitSupabase();\napplySettingsUI();\nupdateStatsUI();\nrenderBoard();\nopenModal();",
    "try{initStockfish()}catch(e){console.warn(e)}\ntry{fillCosmeticGrid()}catch(e){console.warn(e)}\ntry{initSupabase()}catch(e){console.warn(e)}\ntry{applySettingsUI()}catch(e){console.warn(e)}\ntry{updateStatsUI()}catch(e){console.warn(e)}\ntry{renderBoard()}catch(e){console.warn(e)}\nopenModal();\nwindow.startNewGame=startNewGame;window.closeModal=closeModal;window.openModal=openModal;window.onSquareClick=onSquareClick;window.doMove=doMove;window.renderBoard=renderBoard;"
  );

  js = js.replace(
    "if(!best&&sfReady){const uci=await sfGo(game.fen(),depth,mt,skill,elo);",
    "if(!best&&sfReady){var uci=null;try{uci=await Promise.race([sfGo(game.fen(),depth,mt,skill,elo),new Promise(function(r){setTimeout(function(){r(null)},mt+2000)})])}catch(e){uci=null}"
  );

  var intro = [
    "function playMatchIntro(done){",
    "  try {",
    "    var el = document.getElementById('matchIntro');",
    "    if (!el || !(settings && settings.anim)) { if (done) done(); return; }",
    "    var nTop = document.getElementById('nameTop');",
    "    var sTop = document.getElementById('subTop');",
    "    var nBot = document.getElementById('nameBottom');",
    "    var sBot = document.getElementById('subBottom');",
    "    var t;",
    "    t = document.getElementById('introNameTop'); if (t) t.textContent = nTop ? nTop.textContent : 'Stockfish';",
    "    t = document.getElementById('introSubTop'); if (t) t.textContent = sTop ? sTop.textContent : 'AI';",
    "    t = document.getElementById('introNameBot'); if (t) t.textContent = nBot ? nBot.textContent : 'You';",
    "    t = document.getElementById('introSubBot'); if (t) t.textContent = sBot ? sBot.textContent : 'Player';",
    "    var avTop = document.getElementById('introAvatarTop');",
    "    var avBot = document.getElementById('introAvatarBot');",
    "    if (avTop) avTop.textContent = 'SF';",
    "    if (avBot) avBot.textContent = 'You';",
    "    var bTop = document.getElementById('introBannerTop');",
    "    var bBot = document.getElementById('introBannerBot');",
    "    var vs = document.getElementById('introVs');",
    "    var fight = document.getElementById('introFight');",
    "    if (bTop) bTop.className = 'intro-banner top';",
    "    if (bBot) bBot.className = 'intro-banner bot';",
    "    if (vs) vs.className = 'intro-vs';",
    "    if (fight) {",
    "      fight.className = 'intro-fight';",
    "      fight.innerHTML = '';",
    "      var word = 'PLAY!';",
    "      for (var i = 0; i < word.length; i++) {",
    "        var sp = document.createElement('span');",
    "        sp.className = 'ch';",
    "        sp.textContent = word[i];",
    "        sp.style.animationDelay = (i * 70) + 'ms';",
    "        fight.appendChild(sp);",
    "      }",
    "    }",
    "    var wrap = document.querySelector('.board-wrap');",
    "    if (wrap) { wrap.classList.remove('intro-zoom-in'); wrap.classList.add('intro-zoom'); }",
    "    el.classList.add('show');",
    "    requestAnimationFrame(function(){ requestAnimationFrame(function(){ if (wrap) wrap.classList.add('intro-zoom-in'); }); });",
    "    setTimeout(function () { if (fight) fight.classList.add('show'); }, 2200);",
    "    setTimeout(function () {",
    "      if (bTop) bTop.classList.add('exit-up');",
    "      if (bBot) bBot.classList.add('exit-down');",
    "      if (vs) vs.classList.add('exit');",
    "    }, 3000);",
    "    setTimeout(function () { if (fight) fight.classList.add('fade'); }, 3200);",
    "    setTimeout(function () {",
    "      el.classList.remove('show');",
    "      if (wrap) { wrap.classList.remove('intro-zoom'); wrap.classList.remove('intro-zoom-in'); wrap.style.transform = ''; }",
    "      flyInPieces();",
    "      if (done) done();",
    "    }, 4200);",
    "  } catch (err) {",
    "    console.warn('intro', err);",
    "    if (done) done();",
    "  }",
    "}",
    "function flyInPieces(){",
    "  try {",
    "    if (!(settings && settings.anim) || !boardEl) return;",
    "    var imgs = boardEl.querySelectorAll('img.piece');",
    "    for (var i = 0; i < imgs.length; i++) {",
    "      var img = imgs[i];",
    "      var sq = img.closest('.sq');",
    "      if (!sq || !sq.dataset.sq) continue;",
    "      var file = sq.dataset.sq.charCodeAt(0) - 97;",
    "      var rank = parseInt(sq.dataset.sq[1], 10);",
    "      var fromBottom = rank <= 2;",
    "      img.style.setProperty('--fx', ((file - 3.5) * 40) + 'px');",
    "      img.style.setProperty('--fy', fromBottom ? '140px' : '-140px');",
    "      img.classList.remove('fly-in');",
    "      void img.offsetWidth;",
    "      img.style.animationDelay = ((Math.abs(file - 3.5) * 28 + (fromBottom ? 0 : 50)) | 0) + 'ms';",
    "      img.classList.add('fly-in');",
    "    }",
    "    setTimeout(function () {",
    "      for (var j = 0; j < imgs.length; j++) {",
    "        imgs[j].classList.remove('fly-in');",
    "        imgs[j].style.animationDelay = '';",
    "      }",
    "    }, 950);",
    "  } catch (err) { console.warn('flyIn', err); }",
    "}"
  ].join('\n');

  js = js.replace('function startNewGame(){', intro + '\nfunction startNewGame(){');
  js = js.replace(
    "closeModal();renderBoard();updateMovesList();startClock();updateStatsUI();if(mode!=='local'&&playerColor==='b')setTimeout(aiMove,400)}",
    "closeModal();renderBoard();updateMovesList();startClock();updateStatsUI();playMatchIntro(function(){if(mode!=='local'&&mode!=='clash'&&playerColor==='b')setTimeout(aiMove,400);if(mode==='clash'&&playerColor==='b')setTimeout(aiMove,400);});}"
  );

  try {
    new Function(js);
  } catch (e) {
    console.error('patch syntax error, using unpatched', e);
    js = await (await fetch(url)).text();
  }

  var s = document.createElement('script');
  s.textContent = js;
  document.body.appendChild(s);

  // ===== CLASH MODE ADDON =====
  (function setupClash(){
    var CLASH_MAX = 10;
    var CLASH_RATE_MS = 4000;
    var COST = { freeze: 4, rage: 5 };
    var clash = {
      on: false,
      elixirW: 5,
      elixirB: 5,
      lastTick: 0,
      timer: null,
      frozen: {},
      rageSq: null,
      ragePending: false,
      spellTargeting: null
    };

    function isClash(){ return typeof mode !== 'undefined' && mode === 'clash'; }

    function showClashUI(show){
      ['elixirRowTop','elixirRowBot','spellsBtn'].forEach(function(id){
        var el = document.getElementById(id);
        if (el) el.classList.toggle('show', !!show);
      });
      if (!show) {
        var p = document.getElementById('spellsPanel');
        if (p) p.classList.remove('show');
        var h = document.getElementById('clashHint');
        if (h) { h.classList.remove('show'); h.textContent = ''; }
        var sb = document.getElementById('spellsBtn');
        if (sb) sb.classList.remove('active');
      }
      updateElixirUI();
    }

    function updateElixirUI(){
      if (!isClash()) return;
      var flippedView = (typeof flipped !== 'undefined' && flipped);
      var topColor = (typeof playerColor !== 'undefined' && playerColor === 'w') ? 'b' : 'w';
      var botColor = (typeof playerColor !== 'undefined') ? playerColor : 'w';
      if (typeof mode !== 'undefined' && mode === 'local') {
        topColor = flippedView ? 'w' : 'b';
        botColor = flippedView ? 'b' : 'w';
      }
      var eTop = topColor === 'w' ? clash.elixirW : clash.elixirB;
      var eBot = botColor === 'w' ? clash.elixirW : clash.elixirB;
      var ft = document.getElementById('elixirFillTop');
      var fb = document.getElementById('elixirFillBot');
      var nt = document.getElementById('elixirTop');
      var nb = document.getElementById('elixirBot');
      if (ft) ft.style.width = (eTop / CLASH_MAX * 100) + '%';
      if (fb) fb.style.width = (eBot / CLASH_MAX * 100) + '%';
      if (nt) nt.textContent = Math.floor(eTop);
      if (nb) nb.textContent = Math.floor(eBot);
    }

    function startElixir(){
      stopElixir();
      clash.lastTick = Date.now();
      clash.timer = setInterval(function(){
        if (!isClash() || (typeof gameOver !== 'undefined' && gameOver)) return;
        var now = Date.now();
        var dt = now - clash.lastTick;
        if (dt >= CLASH_RATE_MS) {
          var steps = Math.floor(dt / CLASH_RATE_MS);
          clash.lastTick += steps * CLASH_RATE_MS;
          clash.elixirW = Math.min(CLASH_MAX, clash.elixirW + steps);
          clash.elixirB = Math.min(CLASH_MAX, clash.elixirB + steps);
          updateElixirUI();
        }
      }, 200);
    }
    function stopElixir(){
      if (clash.timer) { clearInterval(clash.timer); clash.timer = null; }
    }

    function myElixir(){
      var c = (typeof game !== 'undefined' && game) ? game.turn() : 'w';
      return c === 'w' ? clash.elixirW : clash.elixirB;
    }
    function spendElixir(color, n){
      if (color === 'w') clash.elixirW = Math.max(0, clash.elixirW - n);
      else clash.elixirB = Math.max(0, clash.elixirB - n);
      updateElixirUI();
    }

    function setHint(msg){
      var h = document.getElementById('clashHint');
      if (!h) return;
      if (!msg) { h.classList.remove('show'); h.textContent = ''; return; }
      h.textContent = msg;
      h.classList.add('show');
    }

    function cancelSpell(){
      clash.spellTargeting = null;
      var p = document.getElementById('spellsPanel');
      if (p) p.classList.remove('show');
      var sb = document.getElementById('spellsBtn');
      if (sb) sb.classList.remove('active');
      document.querySelectorAll('.spell-card').forEach(function(c){ c.classList.remove('selected'); });
      setHint('');
    }

    function initClash(){
      clash.on = true;
      clash.elixirW = 5;
      clash.elixirB = 5;
      clash.frozen = {};
      clash.rageSq = null;
      clash.ragePending = false;
      clash.spellTargeting = null;
      showClashUI(true);
      startElixir();
      setHint('Clash mode — gather elixir & cast spells');
      setTimeout(function(){ setHint(''); }, 2500);
    }

    function endClash(){
      clash.on = false;
      stopElixir();
      showClashUI(false);
      clash.frozen = {};
      clash.rageSq = null;
      clash.ragePending = false;
    }

    function onTurnEnded(colorJustMoved){
      Object.keys(clash.frozen).forEach(function(sq){
        var f = clash.frozen[sq];
        if (!f) return;
        if (f.color === colorJustMoved) {
          f.turnsLeft -= 1;
          if (f.turnsLeft <= 0) delete clash.frozen[sq];
        }
      });
    }

    function filterMoves(moves){
      if (!moves) return moves;
      return moves.filter(function(m){
        if (clash.frozen[m.from] && clash.frozen[m.from].turnsLeft > 0) return false;
        return true;
      });
    }

    function paintClashSquares(){
      if (!isClash() || typeof boardEl === 'undefined' || !boardEl) return;
      boardEl.querySelectorAll('.sq').forEach(function(el){
        el.classList.remove('frozen');
        var img = el.querySelector('img.piece');
        if (img) img.classList.remove('raged');
        var s = el.dataset.sq;
        if (s && clash.frozen[s] && clash.frozen[s].turnsLeft > 0) el.classList.add('frozen');
        if (s && clash.rageSq === s && img) img.classList.add('raged');
      });
    }

    // Wrap core functions
    if (typeof onSquareClick === 'function') {
      var _onSq = onSquareClick;
      onSquareClick = function(sq){
        if (isClash() && clash.spellTargeting) {
          var piece = game.get(sq);
          var turn = game.turn();
          if (clash.spellTargeting === 'freeze') {
            if (!piece || piece.color === turn) { setHint('Freeze: tap an enemy piece'); return; }
            if (myElixir() < COST.freeze) { setHint('Not enough elixir'); cancelSpell(); return; }
            spendElixir(turn, COST.freeze);
            clash.frozen[sq] = { color: piece.color, turnsLeft: 2 };
            setHint('Frozen ' + sq.toUpperCase() + ' for 2 turns');
            cancelSpell();
            if (typeof renderBoard === 'function') renderBoard();
            paintClashSquares();
            return;
          }
          if (clash.spellTargeting === 'rage') {
            if (!piece || piece.color !== turn) { setHint('Rage: tap one of your pieces'); return; }
            if (myElixir() < COST.rage) { setHint('Not enough elixir'); cancelSpell(); return; }
            spendElixir(turn, COST.rage);
            clash.rageSq = sq;
            clash.ragePending = false;
            setHint('Rage on ' + sq.toUpperCase() + ' — move it to play twice');
            cancelSpell();
            selected = sq;
            possibleMoves = filterMoves(game.moves({ square: sq, verbose: true }));
            if (typeof renderBoard === 'function') renderBoard();
            paintClashSquares();
            return;
          }
        }
        if (isClash()) {
          var p = game.get(sq);
          if (p && clash.frozen[sq] && clash.frozen[sq].turnsLeft > 0) {
            setHint('That piece is frozen!');
            return;
          }
          if (clash.ragePending && clash.rageSq) {
            if (selected) {
              var mv = (possibleMoves || []).find(function(m){ return m.to === sq; });
              if (mv) { doMove(mv); return; }
              return;
            }
            if (sq !== clash.rageSq) {
              setHint('Rage: you must move ' + clash.rageSq.toUpperCase());
              return;
            }
          }
        }
        _onSq(sq);
        if (isClash() && possibleMoves) {
          possibleMoves = filterMoves(possibleMoves);
          if (typeof renderBoard === 'function') renderBoard();
          paintClashSquares();
        }
      };
      window.onSquareClick = onSquareClick;
    }

    if (typeof doMove === 'function') {
      var _do = doMove;
      doMove = function(moveObj){
        if (!isClash()) return _do.apply(this, arguments);
        var from = moveObj.from;
        if (clash.frozen[from] && clash.frozen[from].turnsLeft > 0) {
          if (typeof playerColor !== 'undefined' && game.turn() !== playerColor) {
            var legal = filterMoves(game.moves({ verbose: true }));
            if (legal.length) return _do.call(this, legal[Math.floor(Math.random() * legal.length)]);
          }
          setHint('That piece is frozen!');
          return;
        }
        if (clash.ragePending && clash.rageSq && from !== clash.rageSq) {
          setHint('Rage: only ' + clash.rageSq.toUpperCase());
          return;
        }
        var mover = game.turn();
        var wasRageFirst = (clash.rageSq && from === clash.rageSq && !clash.ragePending);
        var to = moveObj.to;
        var result = _do.apply(this, arguments);
        if (clash.frozen[to]) delete clash.frozen[to];

        if (wasRageFirst && !game.game_over()) {
          try {
            var parts = game.fen().split(' ');
            if (parts[1] !== mover) {
              parts[1] = mover;
              game.load(parts.join(' '));
            }
          } catch (e) { console.warn(e); }
          clash.ragePending = true;
          clash.rageSq = to;
          selected = to;
          possibleMoves = filterMoves(game.moves({ square: to, verbose: true }));
          setHint('Rage! Move ' + to.toUpperCase() + ' again');
          if (statusEl) statusEl.textContent = 'Rage — move again';
          if (typeof renderBoard === 'function') renderBoard();
          paintClashSquares();
          return result;
        }

        if (clash.ragePending) {
          clash.ragePending = false;
          clash.rageSq = null;
          onTurnEnded(mover);
          setHint('');
        } else {
          onTurnEnded(mover);
        }
        paintClashSquares();
        updateElixirUI();
        return result;
      };
      window.doMove = doMove;
    }

    if (typeof renderBoard === 'function') {
      var _rb = renderBoard;
      renderBoard = function(){
        var r = _rb.apply(this, arguments);
        paintClashSquares();
        return r;
      };
      window.renderBoard = renderBoard;
    }

    // UI
    var spellsBtn = document.getElementById('spellsBtn');
    var spellsPanel = document.getElementById('spellsPanel');
    if (spellsBtn) {
      spellsBtn.addEventListener('click', function(e){
        e.preventDefault();
        if (!isClash()) return;
        if (typeof gameOver !== 'undefined' && gameOver) return;
        if (mode !== 'local' && typeof playerColor !== 'undefined' && game.turn() !== playerColor) {
          setHint('Wait for your turn');
          return;
        }
        var open = spellsPanel && spellsPanel.classList.toggle('show');
        spellsBtn.classList.toggle('active', !!open);
        if (!open) cancelSpell();
      });
    }
    document.querySelectorAll('.spell-card').forEach(function(card){
      card.addEventListener('click', function(){
        if (!isClash()) return;
        var sp = card.dataset.spell;
        var cost = COST[sp] || 99;
        if (myElixir() < cost) { setHint('Need ' + cost + ' elixir'); return; }
        document.querySelectorAll('.spell-card').forEach(function(c){ c.classList.remove('selected'); });
        card.classList.add('selected');
        clash.spellTargeting = sp;
        if (spellsPanel) spellsPanel.classList.remove('show');
        if (spellsBtn) spellsBtn.classList.remove('active');
        if (sp === 'freeze') setHint('Freeze: tap an enemy piece (' + cost + ' elixir)');
        else if (sp === 'rage') setHint('Rage: tap your piece (' + cost + ' elixir)');
      });
    });

    document.querySelectorAll('.mode-btn[data-mode]').forEach(function(btn){
      btn.addEventListener('click', function(){
        setTimeout(function(){
          var sel = document.querySelector('.mode-btn[data-mode].selected');
          var m = sel ? sel.dataset.mode : '';
          var cs = document.getElementById('colorSection');
          var ds = document.getElementById('diffSection');
          var os = document.getElementById('onlineSection');
          if (m === 'clash') {
            if (cs) cs.style.display = '';
            if (ds) ds.style.display = '';
            if (os) os.style.display = 'none';
          }
        }, 0);
      });
    });

    var _start = window.startNewGame || startNewGame;
    window.startNewGame = function(){
      var modeBtn = document.querySelector('.mode-btn[data-mode].selected');
      var m = modeBtn ? modeBtn.dataset.mode : 'normal';
      if (m !== 'clash') endClash();
      _start.apply(this, arguments);
      if (m === 'clash') {
        try {
          mode = 'clash';
          var mb = document.getElementById('modeBadge');
          if (mb) mb.textContent = 'Clash';
          if (typeof timeWhite !== 'undefined') {
            if (!timeWhite) timeWhite = 10 * 60 * 1000;
            if (!timeBlack) timeBlack = 10 * 60 * 1000;
          }
          initClash();
        } catch (e) { console.warn(e); }
      }
    };
    window.__startChess = function(e){
      if (e) { try { e.preventDefault(); } catch (x) {} }
      try { window.startNewGame(); }
      catch (err) { console.error(err); alert('Start error: ' + (err && err.message ? err.message : err)); }
    };

    window.__clash = clash;
  })();

  setTimeout(function () {
    var modal = document.getElementById('modal');
    if (modal && !modal.classList.contains('show')) modal.classList.add('show');
  }, 500);
})();
