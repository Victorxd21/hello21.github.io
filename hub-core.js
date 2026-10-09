(function(){
  const GAMES=[
    {name:"Blackjack",folder:"blackjack",file:"index.html",icon:"🂡",tags:["card"]},
    {name:"Cat Game",folder:"cat-game",file:"catUP.html",icon:"🐱",tags:["fun"]},
    {name:"Gartic Phone",folder:"gartic",file:"index.html",icon:"✏️",tags:["multiplayer","draw"]},
    {name:"Gradess",folder:"gradess",file:"login.html",icon:"📚",tags:["utility"]},
    {name:"Live Earth",folder:"live-earth",file:"index.html",icon:"🌍",tags:["3d","explore"]},
    {name:"Mesh View",folder:"mesh-view",file:"index.html",icon:"🔷",tags:["3d"]},
    {name:"Race",folder:"race",file:"index.html",icon:"🏁",tags:["racing"]},
    {name:"Rocket League",folder:"rocket-league",file:"index.html",icon:"⚽",tags:["sports"]},
    {name:"Royale",folder:null,file:"royale.html",icon:"👑",tags:["battle"]},
    {name:"SlitherIO",folder:"slitherIO",file:"index.html",icon:"🪱",tags:["arcade"]},
    {name:"Snake",folder:null,file:"snake.html",icon:"🐍",tags:["arcade","classic"]},
    {name:"Storm Chaser",folder:"storm-chaser",file:"index.html",icon:"⛈️",tags:["action"]},
    {name:"Super Mario",folder:"super-mario",file:"index.html",icon:"🍄",tags:["platform"]},
    {name:"TikTok",folder:"TikTok",file:"index.html",icon:"📱",tags:["fun"]},
    {name:"UNO",folder:"uno",file:"index.html",icon:"🃏",tags:["card","multiplayer"]},
    {name:"Voxel World",folder:"voxel-world",file:"index.html",icon:"🧱",tags:["3d"]},
    {name:"Werewolf",folder:null,file:"werewolf.html",icon:"🐺",tags:["multiplayer"]},
    {name:"World Explorer",folder:"world-explorer",file:"index.html",icon:"🚀",tags:["3d","explore"]}
  ];
  const HUB_LOGS=[
    {v:"3.4.0",d:"2026-10-09",t:"Options panel (gear top-right) — fun + dev toggles"},
    {v:"3.3.2",d:"2026-10-09",t:"Scroll reveal animations, progress bar, orb parallax"},
    {v:"3.2.1",d:"2026-10-09",t:"Extra effects — name shine, tag rings, button spotlight, sparkles"},
    {v:"3.2.0",d:"2026-10-09",t:"Creative UI — mesh orbs, glass cards, gradient borders"},
    {v:"3.1.3",d:"2026-10-09",t:"Self-contained restore"},
    {v:"3.1.0",d:"2026-10-08",t:"Tags, skeletons, health, seasonal, Logs, Feedback, Grok credit"}
  ];
  const now0=new Date();const mo=now0.getMonth()+1;const dy=now0.getDate();let season="default";
  const seasonEl=document.getElementById("season");
  if(mo===10){season="halloween";document.body.classList.add("season-halloween");seasonEl.style.display="";seasonEl.textContent="🎃 Halloween";}
  else if(mo===12&&dy>=20){season="christmas";document.body.classList.add("season-christmas");seasonEl.style.display="";seasonEl.textContent="🎄 Christmas";}
  else if(mo===12||mo===1||mo===2){season="winter";document.body.classList.add("season-winter");seasonEl.style.display="";seasonEl.textContent="❄ Winter";}
  else if(mo>=3&&mo<=5){season="spring";document.body.classList.add("season-spring");seasonEl.style.display="";seasonEl.textContent="🌸 Spring";}
  else if(mo>=6&&mo<=8){season="summer";document.body.classList.add("season-summer");seasonEl.style.display="";seasonEl.textContent="☀ Summer";}
  else if(mo===9){season="autumn";document.body.classList.add("season-autumn");seasonEl.style.display="";seasonEl.textContent="🍂 Autumn";}
  (function(){
    const tEl=document.getElementById("clockTime"),dEl=document.getElementById("clockDate");
    function tick(){const n=new Date();tEl.textContent=n.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"});dEl.textContent=n.toLocaleDateString([],{weekday:"short",month:"short",day:"numeric",year:"numeric"});}
    tick();setInterval(tick,1000);
  })();
  (function(){
    const fx=document.getElementById("seasonFx");if(!fx)return;
    const n=season==="winter"||season==="christmas"?28:season==="autumn"||season==="halloween"?18:season==="spring"?16:season==="summer"?8:0;
    if(!n)return;
    let html="";
    for(let i=0;i<n;i++){
      const left=(Math.random()*100).toFixed(1),delay=(-Math.random()*12).toFixed(1),dur=(6+Math.random()*10).toFixed(1),size=(4+Math.random()*8).toFixed(0);
      if(season==="winter"||season==="christmas")html+='<div class="flake" style="left:'+left+'%;animation-duration:'+dur+'s;animation-delay:'+delay+'s;width:'+size+'px;height:'+size+'px"></div>';
      else if(season==="autumn")html+='<div class="leaf" style="left:'+left+'%;animation-duration:'+dur+'s;animation-delay:'+delay+'s;width:'+size+'px;height:'+size+'px;background:hsl('+Math.floor(20+Math.random()*40)+' 80% 55%)"></div>';
      else if(season==="spring")html+='<div class="petal" style="left:'+left+'%;animation-duration:'+dur+'s;animation-delay:'+delay+'s"></div>';
      else if(season==="summer")html+='<div class="ray" style="left:'+left+'%;top:'+(10+Math.random()*40).toFixed(0)+'%;animation-delay:'+delay+'s;height:'+(30+Math.random()*50).toFixed(0)+'px"></div>';
      else if(season==="halloween"){if(i%3===0)html+='<div class="bat" style="top:'+(10+Math.random()*50).toFixed(0)+'%;animation-duration:'+(10+Math.random()*8).toFixed(1)+'s;animation-delay:'+delay+'s">🦇</div>';else html+='<div class="star" style="left:'+left+'%;top:'+(Math.random()*80).toFixed(0)+'%;animation-delay:'+delay+'s"></div>';}
    }
    if(season==="christmas"){for(let i=0;i<12;i++){const left=(Math.random()*100).toFixed(1);html+='<div class="star" style="left:'+left+'%;top:'+(Math.random()*70).toFixed(0)+'%;animation-delay:'+(-Math.random()*3).toFixed(1)+'s"></div>';}}
    fx.innerHTML=html;
  })();

  window.__reloadSeasonFx=function(which){
    const fx=document.getElementById("seasonFx");if(!fx)return;
    const s=which||(function(){const mo=new Date().getMonth()+1,dy=new Date().getDate();if(mo===10)return"halloween";if(mo===12&&dy>=20)return"christmas";if(mo===12||mo<=2)return"winter";if(mo<=5)return"spring";if(mo<=8)return"summer";if(mo===9)return"autumn";return"default";})();
    const n=s==="winter"||s==="christmas"?28:s==="autumn"||s==="halloween"?18:s==="spring"?16:s==="summer"?8:0;
    let html="";
    for(let i=0;i<n;i++){
      const left=(Math.random()*100).toFixed(1),delay=(-Math.random()*12).toFixed(1),dur=(6+Math.random()*10).toFixed(1),size=(4+Math.random()*8).toFixed(0);
      if(s==="winter"||s==="christmas")html+='<div class="flake" style="left:'+left+'%;animation-duration:'+dur+'s;animation-delay:'+delay+'s;width:'+size+'px;height:'+size+'px"></div>';
      else if(s==="autumn")html+='<div class="leaf" style="left:'+left+'%;animation-duration:'+dur+'s;animation-delay:'+delay+'s;width:'+size+'px;height:'+size+'px;background:hsl('+Math.floor(20+Math.random()*40)+' 80% 55%)"></div>';
      else if(s==="spring")html+='<div class="petal" style="left:'+left+'%;animation-duration:'+dur+'s;animation-delay:'+delay+'s"></div>';
      else if(s==="summer")html+='<div class="ray" style="left:'+left+'%;top:'+(10+Math.random()*40).toFixed(0)+'%;animation-delay:'+delay+'s;height:'+(30+Math.random()*50).toFixed(0)+'px"></div>';
      else if(s==="halloween"){if(i%3===0)html+='<div class="bat" style="top:'+(10+Math.random()*50).toFixed(0)+'%;animation-duration:'+(10+Math.random()*8).toFixed(1)+'s;animation-delay:'+delay+'s">🦇</div>';else html+='<div class="star" style="left:'+left+'%;top:'+(Math.random()*80).toFixed(0)+'%;animation-delay:'+delay+'s"></div>';}
    }
    if(s==="christmas"){for(let i=0;i<12;i++){const left=(Math.random()*100).toFixed(1);html+='<div class="star" style="left:'+left+'%;top:'+(Math.random()*70).toFixed(0)+'%;animation-delay:'+(-Math.random()*3).toFixed(1)+'s"></div>';}}
    fx.innerHTML=html;
  };

  (function(){
    const sp=document.getElementById("scrollProgress");
    const orbs=document.querySelectorAll(".bg .orb");
    function onScroll(){
      const st=window.scrollY||document.documentElement.scrollTop;
      const max=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
      if(sp)sp.style.width=((st/max)*100)+"%";
      const p=st*0.04;
      if(typeof opts==="undefined"||!document.body.classList.contains("no-parallax")){orbs.forEach((o,i)=>{const m=(i%2?1:-1)*(1+i*0.15);o.style.transform="translate("+ (p*m*0.3)+"px,"+(-p*(0.6+i*0.1))+"px) scale("+(1+Math.min(0.08,st/4000))+")";});}
    }
    let ticking=false;
    addEventListener("scroll",()=>{if(!ticking){requestAnimationFrame(()=>{onScroll();ticking=false;});ticking=true;}},{passive:true});
    onScroll();
    const io=new IntersectionObserver((entries)=>{
      entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}});
    },{root:null,rootMargin:"0px 0px -8% 0px",threshold:0.12});
    window.__observeReveal=function(nodes){nodes.forEach(n=>io.observe(n));};
    document.querySelectorAll(".toolbar.reveal,.tags.reveal,.foot.reveal").forEach(n=>io.observe(n));
  })();
  function pathOf(g){return g.folder?"games/"+g.folder+"/"+(g.file||"index.html"):"games/"+(g.file||"index.html");}
  const allTags=["all"];GAMES.forEach(g=>(g.tags||[]).forEach(t=>{if(!allTags.includes(t))allTags.push(t);}));
  let activeTag="all";const tagsEl=document.getElementById("tags");
  tagsEl.innerHTML=allTags.map(t=>'<button class="tag'+(t==="all"?" on":"")+'" data-t="'+t+'">'+t+'</button>').join("");
  tagsEl.addEventListener("click",e=>{const b=e.target.closest(".tag");if(!b)return;activeTag=b.getAttribute("data-t");tagsEl.querySelectorAll(".tag").forEach(x=>x.classList.toggle("on",x.getAttribute("data-t")===activeTag));draw();});
  const health={};
  function checkHealth(g){const p=pathOf(g);if(health[p]!==undefined)return;health[p]=null;fetch(p,{method:"HEAD",cache:"no-store"}).then(r=>{health[p]=r.ok;const el=document.querySelector('.game[data-path="'+p+'"]');if(el&&!r.ok)el.classList.add("dead");}).catch(()=>{fetch(p,{method:"GET",cache:"no-store"}).then(r=>{health[p]=r.ok;const el=document.querySelector('.game[data-path="'+p+'"]');if(el&&!r.ok)el.classList.add("dead");}).catch(()=>{health[p]=false;});});}
  function draw(){
    const q=(document.getElementById("search").value||"").trim().toLowerCase();const root=document.getElementById("root");
    const list=GAMES.filter(g=>{if(q&&!g.name.toLowerCase().includes(q)&&!(g.folder||"").toLowerCase().includes(q))return false;if(activeTag!=="all"&&!(g.tags||[]).includes(activeTag))return false;return true;});
    let h='<div class="cat" id="catMine"><button class="cat-h" type="button" data-c="catMine"><span class="chev">▼</span><span class="cat-t">Your Games</span><span class="cat-n">'+list.length+'</span></button><div class="cat-b"><div class="cat-bi"><div class="grid">';
    list.forEach((g,i)=>{const p=pathOf(g);const dead=health[p]===false;h+='<div class="game'+(dead?" dead":"")+'" style="--i:'+i+'" data-path="'+p+'">';if(g.name==="World Explorer")h+='<span class="new">NEW</span>';h+='<div class="icon">'+g.icon+'</div><div class="name">'+g.name+'</div><div class="path">'+p+'</div><span class="play">Play</span></div>';checkHealth(g);});
    h+='</div></div></div></div>';
    h+='<div class="cat closed" id="catOther"><button class="cat-h" type="button" data-c="catOther"><span class="chev">▼</span><span class="cat-t">Not By Me</span><span class="cat-n">0</span></button><div class="cat-b"><div class="cat-bi"><div class="grid"></div></div></div></div>';
    root.innerHTML=h;
    root.querySelectorAll(".cat-h").forEach(b=>b.addEventListener("click",()=>{document.getElementById(b.getAttribute("data-c")).classList.toggle("closed");}));
    root.querySelectorAll(".game:not(.dead)").forEach(el=>el.addEventListener("click",()=>{location.href=el.getAttribute("data-path");}));
    root.querySelectorAll(".cat,.game").forEach((el,i)=>{el.classList.add("reveal");el.style.transitionDelay=(Math.min(i,12)*0.045)+"s";});
    if(window.__observeReveal)window.__observeReveal(root.querySelectorAll(".reveal"));
  }
  document.getElementById("search").addEventListener("input",draw);
  document.getElementById("refresh").addEventListener("click",()=>{Object.keys(health).forEach(k=>delete health[k]);draw();});
  document.getElementById("aboutBtn").addEventListener("click",()=>document.getElementById("aboutModal").classList.add("on"));
  document.getElementById("aboutX").addEventListener("click",()=>document.getElementById("aboutModal").classList.remove("on"));
  document.getElementById("logsBtn").addEventListener("click",()=>{document.getElementById("logHub").innerHTML=HUB_LOGS.map(l=>'<div class="log"><strong>v'+l.v+'</strong> · '+l.d+' — '+l.t+'</div>').join("");document.getElementById("logsModal").classList.add("on");});
  document.getElementById("logsX").addEventListener("click",()=>document.getElementById("logsModal").classList.remove("on"));
  document.querySelectorAll(".mbg").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)m.classList.remove("on");}));
  document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("on",x===t));document.getElementById("logHub").style.display=t.getAttribute("data-t")==="hub"?"":"none";document.getElementById("logGames").style.display=t.getAttribute("data-t")==="games"?"":"none";}));
  document.querySelectorAll(".btn").forEach(btn=>{btn.addEventListener("pointermove",e=>{const r=btn.getBoundingClientRect();btn.style.setProperty("--mx",((e.clientX-r.left)/r.width*100)+"%");btn.style.setProperty("--my",((e.clientY-r.top)/r.height*100)+"%");});});
  const bar=document.getElementById("topProgress");
  if(bar){bar.style.width="25%";setTimeout(()=>bar.style.width="70%",100);}
  document.getElementById("root").innerHTML='<div class="grid">'+Array(6).fill(0).map(()=>'<div class="skel"></div>').join("")+'</div>';
  setTimeout(()=>{if(bar)bar.style.width="100%";draw();setTimeout(()=>{if(bar){bar.style.opacity="0";setTimeout(()=>{bar.style.width="0";bar.style.opacity="1"},300);}},250);},300);
  (function(){
    const canvas=document.getElementById("cubeCanvas");const hero=canvas.parentElement;const ctx=canvas.getContext("2d");let W,H,dpr;
    const COLORS=season==="halloween"?["#ff8c42","#9b30ff","#ffb347","#22c55e","#f97316"]:season==="winter"?["#93c5fd","#60a5fa","#e0f2fe","#a5b4fc","#bfdbfe"]:season==="spring"?["#86efac","#4ade80","#f9a8d4","#a7f3d0","#bbf7d0"]:season==="summer"?["#fbbf24","#f59e0b","#38bdf8","#fb923c","#fde68a"]:season==="autumn"?["#fb923c","#ea580c","#fbbf24","#c2410c","#fdba74"]:season==="christmas"?["#ef4444","#22c55e","#fbbf24","#f87171","#4ade80"]:["#a78bfa","#6366f1","#22d3ee","#f472b6","#818cf8","#c4b5fd"];
    function resize(){dpr=Math.min(devicePixelRatio||1,2);const r=hero.getBoundingClientRect();W=r.width+100;H=r.height+50;canvas.width=W*dpr;canvas.height=H*dpr;canvas.style.width=W+"px";canvas.style.height=H+"px";ctx.setTransform(dpr,0,0,dpr,0,0);}
    resize();addEventListener("resize",resize);const G=0.22,REST=0.55;
    function plat(){const tw=Math.min(W*0.55,320);return{x:(W-tw)/2,y:H*0.42,w:tw,h:22};}
    class Cube{constructor(i){this.i=i;this.reset(true);this.carry=Math.random()>0.5?String(0|Math.random()*10):null;this.phase=Math.random()*6.28;this.mood=0;this.timer=50+Math.random()*100;}reset(f){this.size=8+Math.random()*8;this.mass=this.size*this.size*0.08;this.x=50+Math.random()*Math.max(40,W-100);this.y=f?H*0.55+Math.random()*H*0.25:-30;this.vx=(Math.random()-0.5)*2.5;this.vy=f?(Math.random()-0.5)*1.2:0.5;this.angle=Math.random()*6.28;this.w=(Math.random()-0.5)*0.04;this.color=COLORS[this.i%COLORS.length];this.alpha=0.85;this.grounded=false;}step(dt,p){this.timer--;if(this.timer<=0){this.timer=70+Math.random()*140;const r=Math.random();this.mood=r<0.32?1:r<0.55?2:0;}if(this.mood===1){const cx=p.x+p.w/2;this.vx+=Math.sign(cx-this.x)*0.06*dt;if(Math.abs(cx-this.x)<50&&this.y>p.y)this.vy-=0.28*dt;}else if(this.mood===2&&this.grounded){this.vy=-5-Math.random()*2;this.vx+=(Math.random()-0.5)*3;this.w+=(Math.random()-0.5)*0.06;this.grounded=false;this.mood=0;if(Math.random()>0.55)this.carry=this.carry?null:String(0|Math.random()*10);}else this.vx+=Math.sin(performance.now()*0.001+this.phase)*0.015*dt;this.vy+=G*dt;this.vx*=0.999;this.w*=0.97;if(Math.abs(this.w)>0.12)this.w*=0.9;this.x+=this.vx*dt;this.y+=this.vy*dt;this.angle+=this.w*dt;const h=this.size*0.5,fl=H-16;this.grounded=false;if(this.y+h>fl){this.y=fl-h;if(this.vy>0){this.vy*=-REST;this.vx*=0.9;this.w*=0.7;}if(Math.abs(this.vy)<0.4){this.vy=0;this.grounded=true;this.w*=0.85;}}if(this.x+h>p.x&&this.x-h<p.x+p.w&&this.y+h>p.y&&this.y-h<p.y+p.h&&this.vy>0){this.y=p.y-h;this.vy*=-REST*0.85;this.w*=0.75;if(Math.abs(this.vy)<0.4){this.vy=0;this.grounded=true;this.w*=0.85;}}if(this.x<h+8){this.x=h+8;this.vx*=-0.8;}if(this.x>W-h-8){this.x=W-h-8;this.vx*=-0.8;}if(this.y>H+50)this.reset(false);}draw(){ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.angle);ctx.globalAlpha=this.alpha;const s=this.size;const g=ctx.createLinearGradient(-s/2,-s/2,s/2,s/2);g.addColorStop(0,this.color);g.addColorStop(1,"#0a0a14");ctx.fillStyle=g;ctx.strokeStyle="rgba(255,255,255,.3)";ctx.lineWidth=1.2;ctx.shadowColor=this.color;ctx.shadowBlur=6;ctx.beginPath();ctx.roundRect(-s/2,-s/2,s,s,2.5);ctx.fill();ctx.shadowBlur=0;ctx.stroke();ctx.fillStyle="rgba(255,255,255,.22)";ctx.fillRect(-s/2+1.5,-s/2+1.5,s*0.4,s*0.2);if(this.carry){ctx.rotate(-this.angle);ctx.font="bold "+Math.max(10,s*0.8)+"px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#fff";ctx.fillText(this.carry,0,-s*0.95);}ctx.restore();}}
    function collide(a,b){
      const hsA=a.size*0.5,hsB=b.size*0.5;
      const dx=b.x-a.x,dy=b.y-a.y;
      const ox=hsA+hsB-Math.abs(dx),oy=hsA+hsB-Math.abs(dy);
      if(ox<=0||oy<=0)return;
      let nx,ny,pen;
      if(ox<oy){nx=dx<0?-1:1;ny=0;pen=ox;}else{nx=0;ny=dy<0?-1:1;pen=oy;}
      const inv=1/(a.mass+b.mass);
      a.x-=nx*pen*b.mass*inv;a.y-=ny*pen*b.mass*inv;
      b.x+=nx*pen*a.mass*inv;b.y+=ny*pen*a.mass*inv;
      const rv=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
      if(rv>0)return;
      const jn=-(1+REST)*rv*(a.mass*b.mass)/(a.mass+b.mass);
      a.vx-=(jn*nx)/a.mass;a.vy-=(jn*ny)/a.mass;
      b.vx+=(jn*nx)/b.mass;b.vy+=(jn*ny)/b.mass;
      a.w-=jn*0.008;b.w+=jn*0.008;if(Math.abs(a.w)>0.15)a.w*=0.5;if(Math.abs(b.w)>0.15)b.w*=0.5;
    }
    const N=Math.min(11,Math.max(7,0|W/80));const cubes=[];for(let i=0;i<N;i++)cubes.push(new Cube(i));let last=performance.now();
    window.__shakeCubes=function(){cubes.forEach(c=>{c.vx+=(Math.random()-0.5)*8;c.vy-=2+Math.random()*4;c.w+=(Math.random()-0.5)*0.2;c.grounded=false;});};
    function frame(now){requestAnimationFrame(frame);let dt=Math.min(0.033,(now-last)/16.67);last=now;if(dt<0.1)dt=1;const step=dt/3,p=plat();ctx.clearRect(0,0,W,H);ctx.fillStyle="rgba(167,139,250,.06)";ctx.beginPath();ctx.roundRect(p.x,p.y,p.w,p.h,8);ctx.fill();for(let s=0;s<3;s++){for(const c of cubes)c.step(step,p);for(let i=0;i<cubes.length;i++)for(let j=i+1;j<cubes.length;j++)collide(cubes[i],cubes[j]);}for(const c of cubes)c.draw();}requestAnimationFrame(frame);
  })();
})();
