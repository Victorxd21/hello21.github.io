(async()=>{
  const url='https://raw.githubusercontent.com/Victorxd21/hello21.github.io/339303459285656e422ed49e9b5ad2636f2cc6a5/games/chess/game.js';
  let js=await(await fetch(url)).text();
  js=js.replace(
    "const slider=document.createElement('div');slider.className='sliding-piece';const img=document.createElement('img');img.src=pieceSrc(pieceColor,pieceType);slider.appendChild(img);",
    "const slider=document.createElement('div');slider.className='sliding-piece';const img=document.createElement('img');img.src=pieceSrc(pieceColor,pieceType);if(pieceType==='k'||pieceType==='q'){const cos=(onlineMode?(pieceColor===myColorOnline?myCosmetic:oppCosmetic):myCosmetic);if(cos&&cos.cls){img.classList.add(cos.cls);slider.classList.add('fx-'+cos.id)}}slider.appendChild(img);"
  );
  js=js.replace(
    "function fillCosmeticGrid(){const grid=document.getElementById('cosmeticGrid');if(!grid)return;grid.innerHTML='';COSMETICS.forEach(c=>{const btn=document.createElement('div');btn.className='cosmetic-btn'+(myCosmetic.id===c.id?' selected':'');btn.dataset.cos=c.id;const img=document.createElement('img');img.src=pieceSrc('w','k');img.classList.add('piece');if(c.cls)img.classList.add(c.cls);btn.appendChild(img);const lab=document.createElement('div');lab.textContent=c.name;btn.appendChild(lab);btn.onclick=()=>{myCosmetic=c;saveCosmetic(c.id);grid.querySelectorAll('.cosmetic-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');if(onlineMode&&channel)channel.send({type:'broadcast',event:'sync',payload:{cosmetic:c.id}});renderBoard()};grid.appendChild(btn)})}",
    "function fillCosmeticGrid(){const grid=document.getElementById('cosmeticGrid');if(!grid)return;grid.innerHTML='';COSMETICS.forEach(c=>{const btn=document.createElement('div');btn.className='cosmetic-btn'+(myCosmetic.id===c.id?' selected':'');btn.dataset.cos=c.id;const row=document.createElement('div');row.className='cos-preview';['k','q'].forEach(t=>{const wrap=document.createElement('div');wrap.className='cos-piece-wrap'+(c.cls?' fx-'+c.id:'');const img=document.createElement('img');img.src=pieceSrc('w',t);img.classList.add('piece');if(c.cls)img.classList.add(c.cls);wrap.appendChild(img);row.appendChild(wrap)});btn.appendChild(row);const lab=document.createElement('div');lab.className='cos-label';lab.textContent=c.name;btn.appendChild(lab);btn.onclick=()=>{myCosmetic=c;saveCosmetic(c.id);grid.querySelectorAll('.cosmetic-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');if(onlineMode&&channel)channel.send({type:'broadcast',event:'sync',payload:{cosmetic:c.id}});renderBoard()};grid.appendChild(btn)})}"
  );
  js=js.replace(
    "if(piece.type==='k'||piece.type==='q'){const cos=(onlineMode?(piece.color===myColorOnline?myCosmetic:oppCosmetic):myCosmetic);if(cos&&cos.cls)img.classList.add(cos.cls)}sq.appendChild(img)}",
    "if(piece.type==='k'||piece.type==='q'){const cos=(onlineMode?(piece.color===myColorOnline?myCosmetic:oppCosmetic):myCosmetic);if(cos&&cos.cls){img.classList.add(cos.cls);sq.classList.add('fx-'+cos.id)}}sq.appendChild(img)}"
  );
  js=js.replace(
    "document.getElementById('evalBot').textContent=sign+label;document.getElementById('evalTop').textContent=''",
    "const eb=document.getElementById('evalBot');const et=document.getElementById('evalTop');if(eb)eb.textContent=sign+label;if(et)et.textContent=''"
  );
  js=js.replace(
    "document.getElementById('evalTop').textContent='-'+label;document.getElementById('evalBot').textContent=''",
    "const et2=document.getElementById('evalTop');const eb2=document.getElementById('evalBot');if(et2)et2.textContent='-'+label;if(eb2)eb2.textContent=''"
  );

  const introCode = [
    'function playMatchIntro(done){',
    '  const el=document.getElementById("matchIntro");',
    '  if(!el||!settings.anim){if(done)done();return}',
    '  var nTop=document.getElementById("nameTop");',
    '  var sTop=document.getElementById("subTop");',
    '  var nBot=document.getElementById("nameBottom");',
    '  var sBot=document.getElementById("subBottom");',
    '  document.getElementById("introNameTop").textContent=nTop?nTop.textContent:"Stockfish";',
    '  document.getElementById("introSubTop").textContent=sTop?sTop.textContent:"AI";',
    '  document.getElementById("introNameBot").textContent=nBot?nBot.textContent:"You";',
    '  document.getElementById("introSubBot").textContent=sBot?sBot.textContent:"Player";',
    '  var avTop=document.getElementById("introAvatarTop");',
    '  var avBot=document.getElementById("introAvatarBot");',
    '  var aTop=document.getElementById("avatarTop");',
    '  if(aTop&&aTop.querySelector(".sf-icon")) avTop.innerHTML="🐟";',
    '  else {var img=aTop&&aTop.querySelector("img");avTop.innerHTML=img?("<img src=\""+img.src+"\" alt=\"\">"):"♟";}',
    '  var botImg=document.getElementById("avatarBottom");botImg=botImg&&botImg.querySelector("img");',
    '  avBot.innerHTML=botImg?("<img src=\""+botImg.src+"\" alt=\"\">"):("<img src=\""+pieceSrc(playerColor||"w","k")+"\" alt=\"\">");',
    '  var bTop=document.getElementById("introBannerTop");',
    '  var bBot=document.getElementById("introBannerBot");',
    '  var vs=document.getElementById("introVs");',
    '  var fight=document.getElementById("introFight");',
    '  bTop.className="intro-banner top";',
    '  bBot.className="intro-banner bot";',
    '  vs.className="intro-vs";',
    '  fight.className="intro-fight";',
    '  el.classList.add("show");',
    '  setTimeout(function(){fight.classList.add("show");},900);',
    '  setTimeout(function(){bTop.classList.add("exit-top");bBot.classList.add("exit-bot");vs.classList.add("exit");},1400);',
    '  setTimeout(function(){el.classList.remove("show");flyInPieces();if(done)done();},1850);',
    '}',
    'function flyInPieces(){',
    '  if(!settings.anim||!boardEl)return;',
    '  var imgs=boardEl.querySelectorAll("img.piece");',
    '  for(var i=0;i<imgs.length;i++){',
    '    var img=imgs[i];',
    '    var sq=img.closest(".sq");if(!sq||!sq.dataset.sq)continue;',
    '    var file=sq.dataset.sq.charCodeAt(0)-97;',
    '    var rank=parseInt(sq.dataset.sq[1],10);',
    '    var fromBottom=rank<=2;',
    '    img.style.setProperty("--fx",((file-3.5)*40)+"px");',
    '    img.style.setProperty("--fy",fromBottom?"140px":"-140px");',
    '    img.classList.remove("fly-in");',
    '    void img.offsetWidth;',
    '    img.style.animationDelay=((Math.abs(file-3.5)*28+(fromBottom?0:50))|0)+"ms";',
    '    img.classList.add("fly-in");',
    '  }',
    '  setTimeout(function(){for(var j=0;j<imgs.length;j++){imgs[j].classList.remove("fly-in");imgs[j].style.animationDelay="";}},950);',
    '}',
  ].join('\n');
  js=js.replace('function startNewGame(){', introCode+'\nfunction startNewGame(){');
  js=js.replace(
    "closeModal();renderBoard();updateMovesList();startClock();updateStatsUI();if(mode!=='local'&&playerColor==='b')setTimeout(aiMove,400)}",
    "closeModal();renderBoard();updateMovesList();startClock();updateStatsUI();playMatchIntro(function(){if(mode!=='local'&&playerColor==='b')setTimeout(aiMove,400);});}"
  );

  // syntax guard
  try { new Function(js); } catch(e){ console.error('patch syntax', e); js=await(await fetch(url)).text(); }
  const s=document.createElement('script');
  s.textContent=js;
  document.body.appendChild(s);
})();
