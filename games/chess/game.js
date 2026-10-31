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
    "try{initStockfish()}catch(e){console.warn(e)}\ntry{fillCosmeticGrid()}catch(e){console.warn(e)}\ntry{initSupabase()}catch(e){console.warn(e)}\ntry{applySettingsUI()}catch(e){console.warn(e)}\ntry{updateStatsUI()}catch(e){console.warn(e)}\ntry{renderBoard()}catch(e){console.warn(e)}\nopenModal();\nwindow.startNewGame=startNewGame;window.closeModal=closeModal;window.openModal=openModal;"
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
    "closeModal();renderBoard();updateMovesList();startClock();updateStatsUI();playMatchIntro(function(){if(mode!=='local'&&playerColor==='b')setTimeout(aiMove,400);});}"
  );

  try {
    new Function(js);
  } catch (e) {
    console.error('patch syntax error, using unpatched', e);
    js = await (await fetch(url)).text();
    js = js.replace("document.getElementById('evalBot').textContent", "(document.getElementById('evalBot')||{}).textContent");
    js = js.replace("document.getElementById('evalTop').textContent", "(document.getElementById('evalTop')||{}).textContent");
    js = js.replace("document.getElementById('puzzleBanner').style.display='none';", "var _pb=document.getElementById('puzzleBanner');if(_pb)_pb.style.display='none';");
  }

  var s = document.createElement('script');
  s.textContent = js;
  document.body.appendChild(s);

  setTimeout(function () {
    var modal = document.getElementById('modal');
    if (modal && !modal.classList.contains('show')) modal.classList.add('show');
  }, 500);
})();
