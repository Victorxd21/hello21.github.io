(function(){
  const SB_URL="https://makmmhmsssfhbfpzqfcj.supabase.co";
  const SB_KEY="sb_publishable_QPZuusUtLAqEz2gRuvbrlQ_ZlrzBII6";

  const GAME_META={
    "angry-birds":{name:"Angry Birds",file:"index.html",icon:"🐦",tags:["arcade","physics"]},
    "blackjack":{name:"Blackjack",file:"index.html",icon:"🂡",tags:["card"]},
    "fishing":{name:"Fishing",file:"index.html",icon:"🎣",tags:["3d","explore"]},
    "cat-game":{name:"Cat Game",file:"catUP.html",icon:"🐱",tags:["fun"]},
    "gartic":{name:"Gartic Phone",file:"index.html",icon:"✏️",tags:["multiplayer","draw"]},
    "gradess":{name:"Gradess",file:"login.html",icon:"📚",tags:["utility"]},
    "live-earth":{name:"Live Earth",file:"index.html",icon:"🌍",tags:["3d","explore"]},
    "mesh-view":{name:"Mesh View",file:"index.html",icon:"🔷",tags:["3d"]},
    "race":{name:"Race",file:"index.html",icon:"🏁",tags:["racing"]},
    "rocket-league":{name:"Rocket League",file:"index.html",icon:"⚽",tags:["sports"]},
    "slitherIO":{name:"SlitherIO",file:"index.html",icon:"🪱",tags:["arcade"]},
    "storm-chaser":{name:"Storm Chaser",file:"index.html",icon:"⛈️",tags:["action"]},
    "super-mario":{name:"Super Mario",file:"index.html",icon:"🍄",tags:["platform"]},
    "TikTok":{name:"TikTok",file:"index.html",icon:"📱",tags:["fun"]},
    "uno":{name:"UNO",file:"index.html",icon:"🃏",tags:["card","multiplayer"]},
    "voxel-world":{name:"Voxel World",file:"index.html",icon:"🧱",tags:["3d"]},
    "world-explorer":{name:"World Explorer",file:"index.html",icon:"🚀",tags:["3d","explore"]},
    "Monochrome":{name:"Monochrome",file:"index.html",icon:"⬛",tags:["fun"]},
    "Siren Head":{name:"Siren Head",file:"index.html",icon:"📢",tags:["action","fun"]},
    "heads":{name:"Heads",file:"index.html",icon:"🧠",tags:["fun"]},
    "NotByMe":{name:"Not By Me",file:"index.html",icon:"👥",tags:["community"],notByMe:true}
  };

  const ROOT_GAMES=[
    {name:"Royale",folder:null,file:"royale.html",icon:"👑",tags:["battle"]},
    {name:"Snake",folder:null,file:"snake.html",icon:"🐍",tags:["arcade","classic"]},
    {name:"Werewolf",folder:null,file:"werewolf.html",icon:"🐺",tags:["multiplayer"]}
  ];
  const ICONS=["🎮","🕹️","👾","🎯","🎲","🧩","⚡","🔥","💎","🌟","🚀","🏆"];
  let GAMES=[];

  /* --- Views & Plays System --- */
  const VIEWS_KEY="hub_game_views_v1";
  const CACHE_GAMES_KEY="hub_cached_games_v2";
  let VIEWS={};
  try{const saved=localStorage.getItem(VIEWS_KEY);if(saved)VIEWS=JSON.parse(saved);}catch(e){}

  function formatViews(n){
    if(!n||n<0)return"0";
    if(n>=1000000)return(n/1000000).toFixed(1).replace(/\.0$/,"")+"M";
    if(n>=1000)return(n/1000).toFixed(1).replace(/\.0$/,"")+"k";
    return String(n);
  }

  window.__hubViews=VIEWS;
  window.__formatViews=formatViews;
  window.__recordView=function(path){
    VIEWS[path]=(VIEWS[path]||0)+1;
    try{localStorage.setItem(VIEWS_KEY,JSON.stringify(VIEWS));}catch(e){}
    try{
      fetch(SB_URL+"/rest/v1/rpc/increment_game_view",{
        method:"POST",
        headers:{"apikey":SB_KEY,"Authorization":"Bearer "+SB_KEY,"Content-Type":"application/json"},
        body:JSON.stringify({p_path:path}),
        keepalive:true
      }).catch(()=>{});
    }catch(e){}
    document.querySelectorAll('.views-badge[data-path="'+path+'"]').forEach(b=>{
      b.textContent="👁️ "+formatViews(VIEWS[path]);
    });
    document.querySelectorAll('.feat-views[data-path="'+path+'"]').forEach(b=>{
      b.textContent="👁️ "+formatViews(VIEWS[path])+" plays";
    });
  };

  async function loadGlobalViews(){
    try{
      const r=await fetch(SB_URL+"/rest/v1/game_views?select=path,views",{
        headers:{"apikey":SB_KEY,"Authorization":"Bearer "+SB_KEY},
        cache:"no-store"
      });
      if(r.ok){
        const rows=await r.json();
        if(Array.isArray(rows)){
          rows.forEach(row=>{
            VIEWS[row.path]=Math.max(VIEWS[row.path]||0,row.views||0);
          });
          try{localStorage.setItem(VIEWS_KEY,JSON.stringify(VIEWS));}catch(e){}
          draw();
          if(window.__updateFeaturedViews)window.__updateFeaturedViews();
        }
      }
    }catch(e){}
  }

  function prettyName(folder){
    return folder.replace(/[-_]+/g," ").replace(/\b\w/g,c=>c.toUpperCase());
  }

  function entryFromFolder(folder){
    const m=GAME_META[folder]||{};
    return {
      name:m.name||prettyName(folder),
      folder:folder,
      file:m.file||"index.html",
      icon:m.icon||ICONS[Math.abs([...folder].reduce((a,c)=>a+c.charCodeAt(0),0))%ICONS.length],
      tags:m.tags||["all"],
      notByMe:!!m.notByMe
    };
  }

  async function discoverGames(){
    const api="https://api.github.com/repos/Victorxd21/hello21.github.io/contents/games";
    let foundFolders=[];
    try{
      const r=await fetch(api,{headers:{"Accept":"application/vnd.github+json"},cache:"no-store"});
      if(r.ok){
        const items=await r.json();
        if(Array.isArray(items)){
          foundFolders=items.filter(x=>x.type==="dir").map(x=>x.name);
        }
      }
    }catch(e){}

    if(!foundFolders.length){
      try{
        const cached=localStorage.getItem(CACHE_GAMES_KEY);
        if(cached)foundFolders=JSON.parse(cached);
      }catch(e){}
    }
    if(!foundFolders.length){
      foundFolders=Object.keys(GAME_META);
    }else{
      try{localStorage.setItem(CACHE_GAMES_KEY,JSON.stringify(foundFolders));}catch(e){}
    }

    foundFolders=[...new Set([...foundFolders,...Object.keys(GAME_META)])];
    const fromFolders=foundFolders.map(entryFromFolder);
    const seen=new Set(fromFolders.map(g=>(g.folder||"")+":"+(g.file||"")));
    const extras=ROOT_GAMES.filter(g=>!seen.has((g.folder||"")+":"+(g.file||"")));
    GAMES=[...fromFolders,...extras];
    return GAMES;
  }

  function naturalSeason(){
    const now=new Date(),mo=now.getMonth()+1,dy=now.getDate();
    if(mo===10)return"halloween";
    if(mo===12&&dy>=20)return"christmas";
    if(mo===12||mo===1||mo===2)return"winter";
    if(mo>=3&&mo<=5)return"spring";
    if(mo>=6&&mo<=8)return"summer";
    if(mo===9)return"autumn";
    return"default";
  }

  function naturalTimeOfDay(){
    const hr=new Date().getHours();
    if(hr>=5&&hr<12)return"morning";
    if(hr>=12&&hr<17)return"afternoon";
    if(hr>=17&&hr<21)return"sunset";
    return"night";
  }

  let activeSeason=naturalSeason();
  let activeTimeOfDay=naturalTimeOfDay();

  function applyAtmosphere(seasonChoice, timeChoice){
    activeSeason=(!seasonChoice||seasonChoice==="auto")?naturalSeason():seasonChoice;
    activeTimeOfDay=(!timeChoice||timeChoice==="auto")?naturalTimeOfDay():timeChoice;

    const b=document.body;
    ["season-halloween","season-winter","season-spring","season-summer","season-autumn","season-christmas","season-default"].forEach(c=>b.classList.remove(c));
    ["time-morning","time-afternoon","time-sunset","time-night"].forEach(c=>b.classList.remove(c));

    b.classList.add("season-"+activeSeason);
    b.classList.add("time-"+activeTimeOfDay);

    const sEl=document.getElementById("season");
    if(sEl){
      const sNames={halloween:"🎃 Halloween",winter:"❄ Winter",spring:"🌸 Spring",summer:"☀ Summer",autumn:"🍂 Autumn",christmas:"🎄 Christmas",default:"🌌 Hub"};
      const tNames={morning:"🌅 Dawn",afternoon:"☀️ Noon",sunset:"🌇 Dusk",night:"🌙 Night"};
      sEl.style.display="";
      sEl.textContent=(sNames[activeSeason]||activeSeason)+" · "+(tNames[activeTimeOfDay]||activeTimeOfDay);
    }

    renderWeatherFX(activeSeason, activeTimeOfDay);
    if(window.__updateCubeColors) window.__updateCubeColors();
  }

  function renderWeatherFX(season, time){
    const fx=document.getElementById("seasonFx");
    if(!fx)return;
    fx.innerHTML="";

    const count=season==="winter"||season==="christmas"?32:season==="autumn"||season==="halloween"?22:season==="spring"?18:season==="summer"?16:12;
    const isNight=time==="night", isSunset=time==="sunset";

    let html="";
    for(let i=0;i<count;i++){
      const left=(Math.random()*100).toFixed(1);
      const delay=(-Math.random()*16).toFixed(1);
      const dur=(5+Math.random()*9).toFixed(1);
      const size=(4+Math.random()*8).toFixed(1);

      if(season==="winter"||season==="christmas"){
        html+=`<div class="flake" style="left:${left}%;animation-duration:${dur}s;animation-delay:${delay}s;width:${size}px;height:${size}px"></div>`;
      }else if(season==="autumn"){
        const hue=Math.floor(15+Math.random()*35);
        html+=`<div class="leaf" style="left:${left}%;animation-duration:${dur}s;animation-delay:${delay}s;width:${size*1.3}px;height:${size*1.3}px;background:hsl(${hue} 85% ${isNight?35:50}%)"></div>`;
      }else if(season==="spring"){
        html+=`<div class="petal" style="left:${left}%;animation-duration:${dur}s;animation-delay:${delay}s;width:${size}px;height:${size}px"></div>`;
      }else if(season==="summer"){
        if(isNight||isSunset){
          const top=(15+Math.random()*70).toFixed(1);
          html+=`<div class="firefly" style="left:${left}%;top:${top}%;animation-delay:${delay}s"></div>`;
        }else{
          const top=(10+Math.random()*35).toFixed(1);
          html+=`<div class="ray" style="left:${left}%;top:${top}%;height:${(40+Math.random()*60).toFixed(0)}px;animation-delay:${delay}s"></div>`;
        }
      }else if(season==="halloween"){
        if(i%4===0){
          html+=`<div class="bat" style="top:${(12+Math.random()*50).toFixed(1)}%;animation-duration:${(9+Math.random()*7).toFixed(1)}s;animation-delay:${delay}s">🦇</div>`;
        }else{
          html+=`<div class="star" style="left:${left}%;top:${(Math.random()*85).toFixed(1)}%;animation-delay:${delay}s"></div>`;
        }
      }else{
        html+=`<div class="star" style="left:${left}%;top:${(Math.random()*90).toFixed(1)}%;animation-delay:${delay}s"></div>`;
      }
    }
    fx.innerHTML=html;
  }

  window.__reloadAtmosphere=applyAtmosphere;
  window.__reloadSeasonFx=function(which){ applyAtmosphere(which, activeTimeOfDay); };

  (function(){
    const tEl=document.getElementById("clockTime"),dEl=document.getElementById("clockDate");
    function tick(){
      const n=new Date();
      if(tEl) tEl.textContent=n.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"});
      if(dEl) dEl.textContent=n.toLocaleDateString([],{weekday:"short",month:"short",day:"numeric",year:"numeric"});
      const newT=naturalTimeOfDay();
      if(newT!==activeTimeOfDay&&(!window.__hubOpts||window.__hubOpts.timeOfDay==="auto")){
        applyAtmosphere(activeSeason, newT);
      }
    }
    tick();setInterval(tick,1000);
  })();

  applyAtmosphere(naturalSeason(), naturalTimeOfDay());

  (function(){
    const sp=document.getElementById("scrollProgress");
    const orbs=document.querySelectorAll(".bg .orb");
    function onScroll(){
      const st=window.scrollY||document.documentElement.scrollTop;
      const max=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
      if(sp)sp.style.width=((st/max)*100)+"%";
      const p=st*0.04;
      if(typeof opts==="undefined"||!document.body.classList.contains("no-parallax")){
        orbs.forEach((o,i)=>{
          const m=(i%2?1:-1)*(1+i*0.15);
          o.style.transform="translate("+(p*m*0.3)+"px,"+(-p*(0.6+i*0.1))+"px) scale("+(1+Math.min(0.08,st/4000))+")";
        });
      }
    }
    let ticking=false;
    addEventListener("scroll",()=>{if(!ticking){requestAnimationFrame(()=>{onScroll();ticking=false;});ticking=true;}},{passive:true});
    onScroll();
  })();

  function pathOf(g){return g.folder?"games/"+g.folder+"/"+(g.file||"index.html"):"games/"+(g.file||"index.html");}
  let activeTag="all";const tagsEl=document.getElementById("tags");
  function rebuildTags(){
    if(!tagsEl)return;
    const allTags=["all"];
    GAMES.forEach(g=>(g.tags||[]).forEach(t=>{if(t!=="all"&&!allTags.includes(t))allTags.push(t);}));
    tagsEl.innerHTML=allTags.map(t=>'<button class="tag'+(t===activeTag?" on":"")+'" data-t="'+t+'">'+t+'</button>').join("");
  }
  if(tagsEl){
    tagsEl.addEventListener("click",e=>{
      const b=e.target.closest(".tag");
      if(!b)return;
      activeTag=b.getAttribute("data-t");
      tagsEl.querySelectorAll(".tag").forEach(x=>x.classList.toggle("on",x.getAttribute("data-t")===activeTag));
      draw();
    });
  }

  const health={};
  function checkHealth(g){
    const p=pathOf(g);
    if(health[p]!==undefined)return;
    health[p]=null;
    fetch(p,{method:"HEAD",cache:"no-store"}).then(r=>{
      health[p]=r.ok;
      const el=document.querySelector('.game[data-path="'+p+'"]');
      if(el&&!r.ok)el.classList.add("dead");
    }).catch(()=>{
      fetch(p,{method:"GET",cache:"no-store"}).then(r=>{
        health[p]=r.ok;
        const el=document.querySelector('.game[data-path="'+p+'"]');
        if(el&&!r.ok)el.classList.add("dead");
      }).catch(()=>{
        health[p]=true; // Default to true if blocked by local CORS
      });
    });
  }

  function draw(){
    const sInput=document.getElementById("search");
    const q=(sInput&&sInput.value||"").trim().toLowerCase();
    const root=document.getElementById("root");
    if(!root)return;

    const mine=GAMES.filter(g=>!g.notByMe);
    const other=GAMES.filter(g=>g.notByMe);
    const filterFn=g=>{
      if(q&&!(g.name||"").toLowerCase().includes(q)&&!(g.folder||"").toLowerCase().includes(q))return false;
      if(activeTag!=="all"&&!(g.tags||[]).includes(activeTag))return false;
      return true;
    };

    const sortByPlays=(a,b)=>{
      const va=VIEWS[pathOf(a)]||0, vb=VIEWS[pathOf(b)]||0;
      if(vb!==va)return vb-va;
      return (a.name||"").localeCompare(b.name||"",undefined,{sensitivity:"base"});
    };

    const list=mine.filter(filterFn).sort(sortByPlays);
    const listOther=other.filter(filterFn).sort(sortByPlays);

    let h='<div class="cat" id="catMine"><button class="cat-h" type="button" data-c="catMine"><span class="chev">▼</span><span class="cat-t">Your Games</span><span class="cat-n">'+list.length+'</span></button><div class="cat-b"><div class="cat-bi"><div class="grid">';
    list.forEach((g,i)=>{
      const p=pathOf(g);
      const dead=health[p]===false;
      const v=VIEWS[p]||0;
      h+='<div class="game'+(dead?" dead":"")+' in" style="--i:'+i+'" data-path="'+p+'">';
      if(g.name==="World Explorer")h+='<span class="new">NEW</span>';
      h+='<span class="views-badge" data-path="'+p+'" title="'+v+' plays">👁️ '+formatViews(v)+'</span>';
      h+='<div class="icon">'+g.icon+'</div><div class="name">'+g.name+'</div><div class="path">'+p+'</div><span class="play">Play</span></div>';
      checkHealth(g);
    });
    h+='</div></div></div></div>';

    h+='<div class="cat'+(listOther.length?"":" closed")+'" id="catOther"><button class="cat-h" type="button" data-c="catOther"><span class="chev">▼</span><span class="cat-t">Not By Me</span><span class="cat-n">'+listOther.length+'</span></button><div class="cat-b"><div class="cat-bi"><div class="grid">';
    listOther.forEach((g,i)=>{
      const p=pathOf(g);
      const dead=health[p]===false;
      const v=VIEWS[p]||0;
      h+='<div class="game'+(dead?" dead":"")+' in" style="--i:'+i+'" data-path="'+p+'">';
      h+='<span class="views-badge" data-path="'+p+'" title="'+v+' plays">👁️ '+formatViews(v)+'</span>';
      h+='<div class="icon">'+g.icon+'</div><div class="name">'+g.name+'</div><div class="path">'+p+'</div><span class="play">Play</span></div>';
      checkHealth(g);
    });
    h+='</div></div></div></div>';

    root.innerHTML=h;
    root.querySelectorAll(".cat-h").forEach(b=>b.addEventListener("click",()=>{document.getElementById(b.getAttribute("data-c")).classList.toggle("closed");}));

    root.querySelectorAll(".game:not(.dead)").forEach(el=>el.addEventListener("click",()=>{
      const p=el.getAttribute("data-path");
      if(window.__recordView)window.__recordView(p);
      window.open(p,"_blank","noopener,noreferrer");
    }));
  }

  const sBox=document.getElementById("search");
  if(sBox) sBox.addEventListener("input",draw);

  const refBtn=document.getElementById("refresh");
  if(refBtn){
    refBtn.addEventListener("click",()=>{
      Object.keys(health).forEach(k=>delete health[k]);
      discoverGames().then(()=>{rebuildTags();draw();loadGlobalViews();});
    });
  }

  const abBtn=document.getElementById("aboutBtn");
  if(abBtn) abBtn.addEventListener("click",()=>document.getElementById("aboutModal").classList.add("on"));
  const abX=document.getElementById("aboutX");
  if(abX) abX.addEventListener("click",()=>document.getElementById("aboutModal").classList.remove("on"));

  const lgBtn=document.getElementById("logsBtn");
  if(lgBtn){
    lgBtn.addEventListener("click",()=>{
      const HUB_LOGS=[
        {v:"3.8.1",d:"2026-10-22",t:"Restored full games grid + First-person seated 3D Matrix screen"},
        {v:"3.8.0",d:"2026-10-22",t:"Active 2D rigid-body cube physics (drag & fling) + dynamic time themes"},
        {v:"3.7.1",d:"2026-10-21",t:"Persistent game cache + Featured views counter"}
      ];
      document.getElementById("logHub").innerHTML=HUB_LOGS.map(l=>'<div class="log"><strong>v'+l.v+'</strong> · '+l.d+' — '+l.t+'</div>').join("");
      document.getElementById("logsModal").classList.add("on");
    });
  }
  const lgX=document.getElementById("logsX");
  if(lgX) lgX.addEventListener("click",()=>document.getElementById("logsModal").classList.remove("on"));

  document.querySelectorAll(".mbg").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)m.classList.remove("on");}));
  document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("on",x===t));
    document.getElementById("logHub").style.display=t.getAttribute("data-t")==="hub"?"":"none";
    document.getElementById("logGames").style.display=t.getAttribute("data-t")==="games"?"":"none";
  }));

  const bar=document.getElementById("topProgress");
  if(bar){bar.style.width="25%";setTimeout(()=>bar.style.width="70%",100);}

  // Load games and draw immediately
  discoverGames().then(()=>{
    rebuildTags();
    if(bar)bar.style.width="100%";
    draw();
    loadGlobalViews();
    setTimeout(()=>{if(bar){bar.style.opacity="0";setTimeout(()=>{bar.style.width="0";bar.style.opacity="1"},300);}},250);
  });

  /* ========================================================
     ACTIVE 2D RIGID-BODY CUBE PHYSICS IN HERO
     ======================================================== */
  (function(){
    const canvas=document.getElementById("cubeCanvas");
    if(!canvas)return;
    const hero=canvas.parentElement;
    const ctx=canvas.getContext("2d");
    let W,H,dpr;

    function getSeasonalPalette(){
      const cs=getComputedStyle(document.body);
      const cA=cs.getPropertyValue("--a").trim()||"#a78bfa";
      const cB=cs.getPropertyValue("--b").trim()||"#6366f1";
      const cC=cs.getPropertyValue("--c").trim()||"#22d3ee";
      const cD=cs.getPropertyValue("--d").trim()||"#f472b6";
      return [cA, cB, cC, cD, "#ffffff"];
    }

    let COLORS=getSeasonalPalette();
    window.__updateCubeColors=function(){
      COLORS=getSeasonalPalette();
      cubes.forEach((c,i)=>{ c.color=COLORS[i%COLORS.length]; });
    };

    function resize(){
      dpr=Math.min(devicePixelRatio||1,2);
      const r=hero.getBoundingClientRect();
      W=r.width+100;
      H=r.height+50;
      canvas.width=W*dpr;
      canvas.height=H*dpr;
      canvas.style.width=W+"px";
      canvas.style.height=H+"px";
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    resize();
    addEventListener("resize",resize);

    const GRAVITY=0.22;
    const BOUNCE=0.58;
    const FRICTION=0.988;

    function plat(){
      const tw=Math.min(W*0.55,340);
      return{x:(W-tw)/2, y:H*0.44, w:tw, h:20};
    }

    class RigidCube{
      constructor(i){
        this.i=i;
        this.reset(true);
      }
      reset(firstTime){
        this.size=9+Math.random()*9;
        this.mass=this.size*this.size*0.1;
        this.invMass=1/this.mass;
        this.x=60+Math.random()*Math.max(60,W-120);
        this.y=firstTime?H*0.45+Math.random()*(H*0.35):-40-Math.random()*60;
        this.vx=(Math.random()-0.5)*2.5;
        this.vy=firstTime?(Math.random()-0.5)*1.5:1+Math.random()*2;
        this.angle=Math.random()*Math.PI*2;
        this.vr=(Math.random()-0.5)*0.06;
        this.color=COLORS[this.i%COLORS.length];
        this.isHeld=false;
      }
      step(dt,p){
        if(this.isHeld)return;
        this.vy+=GRAVITY*dt;
        this.vx*=Math.pow(FRICTION,dt);
        this.x+=this.vx*dt;
        this.y+=this.vy*dt;
        this.angle+=this.vr*dt;

        const rad=this.size*0.95;
        if(this.x+rad>p.x && this.x-rad<p.x+p.w && this.y+rad>p.y && this.y-rad<p.y+p.h){
          if(this.y < p.y && this.vy > 0){
            this.y = p.y - rad;
            this.vy = -this.vy * BOUNCE;
            this.vx *= 0.94;
            if(Math.abs(this.vy)<0.35) this.vy=0;
            this.vr += (this.vx)*0.015;
          }
        }
        if(this.x - rad < 10){ this.x=10+rad; this.vx=Math.abs(this.vx)*BOUNCE; }
        else if(this.x + rad > W - 10){ this.x=W-10-rad; this.vx=-Math.abs(this.vx)*BOUNCE; }
        if(this.y > H + 90) this.reset(false);
      }
      draw(ctx){
        ctx.save();
        ctx.translate(this.x,this.y);
        ctx.rotate(this.angle);
        const s=this.size;
        ctx.fillStyle=this.color;
        ctx.fillRect(-s,-s,s*2,s*2);
        ctx.strokeStyle="rgba(0,0,0,0.3)";
        ctx.lineWidth=1.5;
        ctx.strokeRect(-s,-s,s*2,s*2);
        ctx.restore();
      }
    }

    const cubes=Array.from({length:15},(_,i)=>new RigidCube(i));

    function resolveCollisions(){
      for(let i=0;i<cubes.length;i++){
        for(let j=i+1;j<cubes.length;j++){
          const a=cubes[i], b=cubes[j];
          const dx=b.x-a.x, dy=b.y-a.y;
          const dist=Math.hypot(dx,dy);
          const minDist=(a.size+b.size)*0.92;
          if(dist>0&&dist<minDist){
            const nx=dx/dist, ny=dy/dist;
            const penetration=minDist-dist;
            const invMassSum=a.invMass+b.invMass;
            if(!a.isHeld){ a.x -= nx*penetration*(a.invMass/invMassSum); a.y -= ny*penetration*(a.invMass/invMassSum); }
            if(!b.isHeld){ b.x += nx*penetration*(b.invMass/invMassSum); b.y += ny*penetration*(b.invMass/invMassSum); }
            const velAlongNormal = (b.vx - a.vx)*nx + (b.vy - a.vy)*ny;
            if(velAlongNormal < 0){
              const impulse = -(1 + BOUNCE) * velAlongNormal / invMassSum;
              if(!a.isHeld){ a.vx -= impulse*a.invMass*nx; a.vy -= impulse*a.invMass*ny; }
              if(!b.isHeld){ b.vx += impulse*b.invMass*nx; b.vy += impulse*b.invMass*ny; }
            }
          }
        }
      }
    }

    let heldCube=null;
    let prevMouse={x:0,y:0};
    let mouseVel={x:0,y:0};

    function getCoords(e){
      const r=canvas.getBoundingClientRect();
      const cx=e.touches?e.touches[0].clientX:e.clientX;
      const cy=e.touches?e.touches[0].clientY:e.clientY;
      return{ x:(cx-r.left)*(W/r.width), y:(cy-r.top)*(H/r.height) };
    }

    canvas.addEventListener("mousedown",e=>{
      const pt=getCoords(e);
      prevMouse={x:pt.x,y:pt.y};
      for(let i=cubes.length-1;i>=0;i--){
        const c=cubes[i];
        if(Math.hypot(pt.x-c.x, pt.y-c.y) < c.size*1.8){
          heldCube=c; c.isHeld=true; c.vx=0; c.vy=0; break;
        }
      }
    });

    addEventListener("mousemove",e=>{
      const pt=getCoords(e);
      mouseVel={x:pt.x-prevMouse.x, y:pt.y-prevMouse.y};
      prevMouse={x:pt.x,y:pt.y};
      if(heldCube){ heldCube.x=pt.x; heldCube.y=pt.y; }
    });

    addEventListener("mouseup",()=>{
      if(heldCube){
        heldCube.isHeld=false;
        heldCube.vx=Math.max(-14, Math.min(14, mouseVel.x*1.3));
        heldCube.vy=Math.max(-14, Math.min(14, mouseVel.y*1.3));
        heldCube=null;
      }
    });

    window.__shakeCubes=function(){
      cubes.forEach(c=>{
        c.vy = -6 - Math.random()*8;
        c.vx = (Math.random()-0.5)*12;
      });
    };

    let last=performance.now();
    function loop(now){
      const dt=Math.min(2.5,(now-last)/16);
      last=now;
      const p=plat();
      cubes.forEach(c=>c.step(dt,p));
      resolveCollisions();
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle="rgba(255,255,255,0.08)";
      ctx.fillRect(p.x,p.y,p.w,p.h);
      cubes.forEach(c=>c.draw(ctx));
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  })();
})();
