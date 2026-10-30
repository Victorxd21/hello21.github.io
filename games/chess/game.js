(async()=>{
  const url='https://raw.githubusercontent.com/Victorxd21/hello21.github.io/339303459285656e422ed49e9b5ad2636f2cc6a5/games/chess/game.js';
  let js=await(await fetch(url)).text();
  // cosmetics stay on sliding pieces
  js=js.replace(
    "const slider=document.createElement('div');slider.className='sliding-piece';const img=document.createElement('img');img.src=pieceSrc(pieceColor,pieceType);slider.appendChild(img);",
    "const slider=document.createElement('div');slider.className='sliding-piece';const img=document.createElement('img');img.src=pieceSrc(pieceColor,pieceType);if(pieceType==='k'||pieceType==='q'){const cos=(onlineMode?(pieceColor===myColorOnline?myCosmetic:oppCosmetic):myCosmetic);if(cos&&cos.cls){img.classList.add(cos.cls);slider.classList.add('fx-'+cos.id)}}slider.appendChild(img);"
  );
  // K+Q preview in menu
  js=js.replace(
    "function fillCosmeticGrid(){const grid=document.getElementById('cosmeticGrid');if(!grid)return;grid.innerHTML='';COSMETICS.forEach(c=>{const btn=document.createElement('div');btn.className='cosmetic-btn'+(myCosmetic.id===c.id?' selected':'');btn.dataset.cos=c.id;const img=document.createElement('img');img.src=pieceSrc('w','k');img.classList.add('piece');if(c.cls)img.classList.add(c.cls);btn.appendChild(img);const lab=document.createElement('div');lab.textContent=c.name;btn.appendChild(lab);btn.onclick=()=>{myCosmetic=c;saveCosmetic(c.id);grid.querySelectorAll('.cosmetic-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');if(onlineMode&&channel)channel.send({type:'broadcast',event:'sync',payload:{cosmetic:c.id}});renderBoard()};grid.appendChild(btn)})}",
    "function fillCosmeticGrid(){const grid=document.getElementById('cosmeticGrid');if(!grid)return;grid.innerHTML='';COSMETICS.forEach(c=>{const btn=document.createElement('div');btn.className='cosmetic-btn'+(myCosmetic.id===c.id?' selected':'');btn.dataset.cos=c.id;const row=document.createElement('div');row.className='cos-preview';['k','q'].forEach(t=>{const wrap=document.createElement('div');wrap.className='cos-piece-wrap'+(c.cls?' fx-'+c.id:'');const img=document.createElement('img');img.src=pieceSrc('w',t);img.classList.add('piece');if(c.cls)img.classList.add(c.cls);wrap.appendChild(img);row.appendChild(wrap)});btn.appendChild(row);const lab=document.createElement('div');lab.className='cos-label';lab.textContent=c.name;btn.appendChild(lab);btn.onclick=()=>{myCosmetic=c;saveCosmetic(c.id);grid.querySelectorAll('.cosmetic-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');if(onlineMode&&channel)channel.send({type:'broadcast',event:'sync',payload:{cosmetic:c.id}});renderBoard()};grid.appendChild(btn)})}"
  );
  // fx class on board squares for particles
  js=js.replace(
    "if(piece.type==='k'||piece.type==='q'){const cos=(onlineMode?(piece.color===myColorOnline?myCosmetic:oppCosmetic):myCosmetic);if(cos&&cos.cls)img.classList.add(cos.cls)}sq.appendChild(img)}",
    "if(piece.type==='k'||piece.type==='q'){const cos=(onlineMode?(piece.color===myColorOnline?myCosmetic:oppCosmetic):myCosmetic);if(cos&&cos.cls){img.classList.add(cos.cls);sq.classList.add('fx-'+cos.id)}}sq.appendChild(img)}"
  );
  const s=document.createElement('script');
  s.textContent=js;
  document.body.appendChild(s);
})();
