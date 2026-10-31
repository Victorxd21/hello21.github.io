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

  // Null-safe eval bar (HTML may not have evalTop/evalBot labels)
  js = js.replace(
    "function updateEvalBar(){if(!settings.eval||puzzleMode){document.getElementById('evalFill').style.height='50%';return}const score=evaluate(game);let pct=50+Math.max(-48,Math.min(48,score/20));document.getElementById('evalFill').style.height=pct+'%';const label=Math.abs(score)>9000?'M':(Math.abs(score)/100).toFixed(1);const sign=score>50?'+':score<-50?'-':'';if(score>=0){document.getElementById('evalBot').textContent=sign+label;document.getElementById('evalTop').textContent=''}else{document.getElementById('evalTop').textContent='-'+label;document.getElementById('evalBot').textContent=''}",
    "function updateEvalBar(){var fill=document.getElementById('evalFill');if(!settings.eval||puzzleMode){if(fill)fill.style.height='50%';return}var score=evaluate(game);var pct=50+Math.max(-48,Math.min(48,score/20));if(fill)fill.style.height=pct+'%';var label=Math.abs(score)>9000?'M':(Math.abs(score)/100).toFixed(1);var sign=score>50?'+':score<-50?'-':'';var eb=document.getElementById('evalBot');var et=document.getElementById('evalTop');if(score>=0){if(eb)eb.textContent=sign+label;if(et)et.textContent=''}else{if(et)et.textContent='-'+label;if(eb)eb.textContent=''}"
  );

  // Cosmetics while sliding
  js = js.replace(
    "const slider=document.createElement('div');slider.className='sliding-piece';const img=document.createElement('img');img.src=pieceSrc(pieceColor,pieceType);slider.appendChild(img);",
    "const slider=document.createElement('div');slider.className='sliding-piece';const img=document.createElement('img');img.src=pieceSrc(pieceColor,pieceType);if(pieceType==='k'||pieceType==='q'){var cos=(onlineMode?(pieceColor===myColorOnline?myCosmetic:oppCosmetic):myCosmetic);if(cos&&cos.cls){img.classList.add(cos.cls);slider.classList.add('fx-'+cos.id)}}slider.appendChild(img);"
  );

  // Ensure init always opens modal even if something earlier soft-fails
  js = js.replace(
    "initStockfish();\nfillCosmeticGrid();\ninitSupabase();\napplySettingsUI();\nupdateStatsUI();\nrenderBoard();\nopenModal();",
    "try{initStockfish()}catch(e){console.warn(e)}\ntry{fillCosmeticGrid()}catch(e){console.warn(e)}\ntry{initSupabase()}catch(e){console.warn(e)}\ntry{applySettingsUI()}catch(e){console.warn(e)}\ntry{updateStatsUI()}catch(e){console.warn(e)}\ntry{renderBoard()}catch(e){console.warn(e)}\nopenModal();"
  );
  // also without newlines
  js = js.replace(
    "initStockfish();fillCosmeticGrid();initSupabase();applySettingsUI();updateStatsUI();renderBoard();openModal();",
    "try{initStockfish()}catch(e){}try{fillCosmeticGrid()}catch(e){}try{initSupabase()}catch(e){}try{applySettingsUI()}catch(e){}try{updateStatsUI()}catch(e){}try{renderBoard()}catch(e){}openModal();"
  );

  // Make sure AI always tries fallback if stockfish hangs
  js = js.replace(
    "if(!best&&sfReady){const uci=await sfGo(game.fen(),depth,mt,skill,elo);",
    "if(!best&&sfReady){var uci=null;try{uci=await Promise.race([sfGo(game.fen(),depth,mt,skill,elo),new Promise(function(r){setTimeout(function(){r(null)},mt+2000)})])}catch(e){uci=null}"
  );

  try {
    new Function(js);
  } catch (e) {
    console.error('patch syntax error, using unpatched', e);
    js = await (await fetch(url)).text();
    // minimal critical patch only
    js = js.replace(
      "document.getElementById('evalBot').textContent",
      "(document.getElementById('evalBot')||{}).textContent"
    );
    js = js.replace(
      "document.getElementById('evalTop').textContent",
      "(document.getElementById('evalTop')||{}).textContent"
    );
  }

  var s = document.createElement('script');
  s.textContent = js;
  document.body.appendChild(s);

  // Extra safety: if modal still not open after 500ms, open it
  setTimeout(function () {
    var modal = document.getElementById('modal');
    if (modal && !modal.classList.contains('show')) {
      modal.classList.add('show');
    }
  }, 600);
})();
