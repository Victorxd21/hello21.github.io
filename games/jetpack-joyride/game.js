const Game = (() => {
  const canvas = document.getElementById('gameCanvas'); const ctx = canvas.getContext('2d');
  let raf, running=false, me, other, score=0, startedAt, obstacles=[], coins=[], lastSpawn=0, input=false;
  const W=1100,H=680;
  function resize(){ const d=window.devicePixelRatio||1; canvas.width=W*d; canvas.height=H*d; ctx.setTransform(d,0,0,d,0,0); }
  function reset(){ score=0; obstacles=[]; coins=[]; lastSpawn=0; me={x:145,y:H/2,vy:0,alive:true}; other={x:260,y:H/2,vy:0,alive:true}; }
  function start(){ reset(); running=true; startedAt=performance.now(); cancelAnimationFrame(raf); raf=requestAnimationFrame(loop); }
  function setInput(v){ input=v; }
  function spawn(){ const gap=155, top=80+Math.random()*(H-gap-160); obstacles.push({x:W+30,top,hole:top+gap,w:58}); if(Math.random()>.25) coins.push({x:W+90,y:80+Math.random()*(H-180),r:9}); }
  function hit(p,o){ return p.x+22>o.x&&p.x-22<o.x+o.w&&(p.y-20<o.top||p.y+20>o.hole); }
  function draw(){ ctx.clearRect(0,0,W,H); const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#171c62');g.addColorStop(1,'#101531');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#272d7a'; for(let x=0;x<W;x+=110){ctx.beginPath();ctx.moveTo(x,H);ctx.lineTo(x+40,H-100);ctx.lineTo(x+85,H);ctx.fill();}
    obstacles.forEach(o=>{ctx.fillStyle='#8995b8';ctx.fillRect(o.x,0,o.w,o.top);ctx.fillRect(o.x,o.hole,o.w,H-o.hole);ctx.fillStyle='#38d7e8';ctx.fillRect(o.x-5,o.top-8,o.w+10,8);ctx.fillRect(o.x-5,o.hole,o.w+10,8);});
    coins.forEach(c=>{ctx.fillStyle='#ffd83d';ctx.beginPath();ctx.arc(c.x,c.y,c.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff2a1';ctx.stroke();});
    drawPlayer(me,'#ff4f9a','YOU'); drawPlayer(other,'#5de4ff','RIVAL');
  }
  function drawPlayer(p,color,label){if(!p.alive)return;ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=15;ctx.beginPath();ctx.arc(0,0,20,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillText(label,0,-29);ctx.fillStyle='#ffd166';ctx.fillRect(-28,10,14,8);ctx.restore();}
  function loop(now){ if(!running)return; const dt=Math.min((now-(loop.last||now))/16.67,2);loop.last=now; const elapsed=(now-startedAt)/1000; score=Math.floor(elapsed*10); document.getElementById('player1Score').textContent=score; me.vy += (input?-0.65:0.55)*dt; me.y += me.vy*dt; me.y=Math.max(24,Math.min(H-24,me.y)); if(now-lastSpawn>1250){spawn();lastSpawn=now;} obstacles.forEach(o=>o.x-=5*dt); coins.forEach(c=>c.x-=5*dt); obstacles=obstacles.filter(o=>o.x>-80);coins=coins.filter(c=>c.x>-30); if(obstacles.some(o=>hit(me,o))||me.y<=24||me.y>=H-24){me.alive=false; multiplayer.sendDeath(score); end(false);return;} draw(); raf=requestAnimationFrame(loop); }
  function end(won){running=false; cancelAnimationFrame(raf); multiplayer.sendScore(score); setTimeout(()=>UI.showGameOver(won,score),350);}
  function remoteDeath(remoteScore){ other.alive=false; document.getElementById('player2Status').textContent='Eliminated'; if(running){ score=Math.max(score,remoteScore||0); end(true); } }
  function remoteScore(s){ document.getElementById('player2Score').textContent=s; }
  window.addEventListener('resize',resize); window.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();setInput(true)}});window.addEventListener('keyup',e=>{if(e.code==='Space')setInput(false)});canvas.addEventListener('pointerdown',()=>setInput(true));canvas.addEventListener('pointerup',()=>setInput(false)); resize();
  return {start,setInput,remoteDeath,remoteScore};
})();
