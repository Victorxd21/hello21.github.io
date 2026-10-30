(async function () {
  var url = 'https://cdn.jsdelivr.net/gh/Victorxd21/hello21.github.io@339303459285656e422ed49e9b5ad2636f2cc6a5/games/chess/game.js';
  var js;
  try {
    js = await (await fetch(url)).text();
  } catch (e) {
    console.error('fetch fail', e);
    document.getElementById('engineBadge').textContent = 'load error';
    return;
  }

  // Keep cosmetics while sliding
  js = js.replace(
    "const slider=document.createElement('div');slider.className='sliding-piece';const img=document.createElement('img');img.src=pieceSrc(pieceColor,pieceType);slider.appendChild(img);",
    "const slider=document.createElement('div');slider.className='sliding-piece';const img=document.createElement('img');img.src=pieceSrc(pieceColor,pieceType);if(pieceType==='k'||pieceType==='q'){var cos=(onlineMode?(pieceColor===myColorOnline?myCosmetic:oppCosmetic):myCosmetic);if(cos&&cos.cls){img.classList.add(cos.cls);slider.classList.add('fx-'+cos.id)}}slider.appendChild(img);"
  );

  // Cosmetic fx class on board pieces
  js = js.replace(
    "if(piece.type==='k'||piece.type==='q'){const cos=(onlineMode?(piece.color===myColorOnline?myCosmetic:oppCosmetic):myCosmetic);if(cos&&cos.cls)img.classList.add(cos.cls)}sq.appendChild(img)}",
    "if(piece.type==='k'||piece.type==='q'){var cos=(onlineMode?(piece.color===myColorOnline?myCosmetic:oppCosmetic):myCosmetic);if(cos&&cos.cls){img.classList.add(cos.cls);sq.classList.add('fx-'+cos.id)}}sq.appendChild(img)}"
  );

  // Null-safe eval labels
  js = js.replace(
    "document.getElementById('evalBot').textContent=sign+label;document.getElementById('evalTop').textContent=''",
    "var eb=document.getElementById('evalBot');var et=document.getElementById('evalTop');if(eb)eb.textContent=sign+label;if(et)et.textContent=''"
  );
  js = js.replace(
    "document.getElementById('evalTop').textContent='-'+label;document.getElementById('evalBot').textContent=''",
    "var et2=document.getElementById('evalTop');var eb2=document.getElementById('evalBot');if(et2)et2.textContent='-'+label;if(eb2)eb2.textContent=''"
  );

  // Match intro (Clash Royale style)
  var intro = [
    'function playMatchIntro(done){',
    '  var el=document.getElementById("matchIntro");',
    '  if(!el||!settings.anim){if(done)done();return}',
    '  var nTop=document.getElementById("nameTop"); var sTop=document.getElementById("subTop");',
    '  var nBot=document.getElementById("nameBottom"); var sBot=document.getElementById("subBottom");',
    '  var a; a=document.getElementById("introNameTop"); if(a)a.textContent=nTop?nTop.textContent:"Stockfish";',
    '  a=document.getElementById("introSubTop"); if(a)a.textContent=sTop?sTop.textContent:"AI";',
    '  a=document.getElementById("introNameBot"); if(a)a.textContent=nBot?nBot.textContent:"You";',
    '  a=document.getElementById("introSubBot"); if(a)a.textContent=sBot?sBot.textContent:"Player";',
    '  var avTop=document.getElementById("introAvatarTop");',
    '  var avBot=document.getElementById("introAvatarBot");',
    '  var aTop=document.getElementById("avatarTop");',
    '  if(avTop){ if(aTop&&aTop.querySelector(".sf-icon")) avTop.innerHTML="🐟"; else { var im=aTop&&aTop.querySelector("img"); avTop.innerHTML=im?("<img src=\""+im.src+"\" alt=\"\">"):"♟"; } }',
    '  if(avBot){ var be=document.getElementById("avatarBottom"); var bi=be&&be.querySelector("img"); avBot.innerHTML=bi?("<img src=\""+bi.src+"\" alt=\"\">"):("<img src=\""+pieceSrc(playerColor||"w","k")+"\" alt=\"\">"); }',
    '  var bTop=document.getElementById("introBannerTop"); var bBot=document.getElementById("introBannerBot");',
    '  var vs=document.getElementById("introVs"); var fight=document.getElementById("introFight");',
    '  if(bTop)bTop.className="intro-banner top"; if(bBot)bBot.className="intro-banner bot";',
    '  if(vs)vs.className="intro-vs"; if(fight)fight.className="intro-fight";',
    '  el.classList.add("show");',
    '  setTimeout(function(){ if(fight)fight.classList.add("show"); },900);',
    '  setTimeout(function(){ if(bTop)bTop.classList.add("exit-top"); if(bBot)bBot.classList.add("exit-bot"); if(vs)vs.classList.add("exit"); },1400);',
    '  setTimeout(function(){ el.classList.remove("show"); flyInPieces(); if(done)done(); },1850);',
    '}',
    'function flyInPieces(){',
    '  if(!settings.anim||!boardEl)return;',
    '  var imgs=boardEl.querySelectorAll("img.piece");',
    '  for(var i=0;i<imgs.length;i++){',
    '    var img=imgs[i]; var sq=img.closest(".sq"); if(!sq||!sq.dataset.sq)continue;',
    '    var file=sq.dataset.sq.charCodeAt(0)-97; var rank=parseInt(sq.dataset.sq[1],10); var fromBottom=rank<=2;',
    '    img.style.setProperty("--fx",((file-3.5)*40)+"px");',
    '    img.style.setProperty("--fy",fromBottom?"140px":"-140px");',
    '    img.classList.remove("fly-in"); void img.offsetWidth;',
    '    img.style.animationDelay=((Math.abs(file-3.5)*28+(fromBottom?0:50))|0)+"ms";',
    '    img.classList.add("fly-in");',
    '  }',
    '  setTimeout(function(){ for(var j=0;j<imgs.length;j++){ imgs[j].classList.remove("fly-in"); imgs[j].style.animationDelay=""; } },950);',
    '}',
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
  }

  var s = document.createElement('script');
  s.textContent = js;
  document.body.appendChild(s);
})();
