(function(){
  const SB_URL="https://makmmhmsssfhbfpzqfcj.supabase.co";
  const SB_KEY="sb_publishable_QPZuusUtLAqEz2gRuvbrlQ_ZlrzBII6";

  const GAME_META={
    "angry-birds":{name:"Angry Birds",file:"index.html",icon:"🐦",tags:["arcade","physics"]},
    "blackjack":{name:"Blackjack",file:"index.html",icon:"🂡",tags:["card"]},
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

  // Expose helpers globally so featured-admin can read views
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
    // Update any visible badges on the screen
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
      if(!r.ok)throw new Error("GitHub API "+r.status);
      const items=await r.json();
      if(Array.isArray(items)){
        foundFolders=items.filter(x=>x.type==="dir").map(x=>x.name);
      }
    }catch(e){
      console.warn("GitHub discovery unavailable (rate-limit/offline), loading cache & fallbacks:",e);
    }

    // If GitHub API failed or returned empty, restore from localStorage cache
    if(!foundFolders.length){
      try{
        const cached=localStorage.getItem(CACHE_GAMES_KEY);
        if(cached)foundFolders=JSON.parse(cached);
      }catch(e){}
    }

    // If still empty, use default GAME_META keys
    if(!foundFolders.length){
      foundFolders=Object.keys(GAME_META);
    }else{
      // Save working folder list to localStorage for offline / rate-limit resilience
      try{localStorage.setItem(CACHE_GAMES_KEY,JSON.stringify(foundFolders));}catch(e){}
    }

    const fromFolders=foundFolders.map(entryFromFolder);
    const seen=new Set(fromFolders.map(g=>(g.folder||"")+":"+(g.file||"")));
    const extras=ROOT_GAMES.filter(g=>!seen.has((g.folder||"")+":"+(g.file||"")));
    GAMES=[...fromFolders,...extras];
    return GAMES;
  }

  const HUB_LOGS=[
    {v:"3.7.1",d:"2026-10-21",t:"Persistent game cache (fixes rate limits) + Featured views counter"},
    {v:"3.7.0",d:"2026-10-10",t:"Added plays counter & sorted games by most played"},
    {v:"3.6.0",d:"2026-10-10",t:"Featured games with rotating banners + password admin (Supabase)"},
    {v:"3.5.0",d:"2026-10-10",t:"Auto-discover every folder in /games via GitHub API"}
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
    const s=which||season;
    const n=s==="winter"||s==="christmas"?28:s==="autumn"||s==="halloween"?18:s==="spring"?16:s==="summer"?8:0;
    let html="";
    for(let i=0;i<n;i++){
      const left=(Math.random()*100).toFixed(1),delay=(-Math.random()*12).toFixed(1),dur=(6+Math.random()*10).toFixed(1),size=(4+Math.random()*8).toFixed(0);
      if(s==="winter"||s==="christmas")html+='<div class="flake" style="left:'+left+'%;animation-duration:'+dur+'s;animation-delay:'+delay+'s;width:'+size+'px;height:'+size+'px"></div>';
      else if(s==="autumn")html+='<div class="leaf" style="left:'+left+'%;animation-duration:'+dur+'s;animation-delay:'+delay+'s;width:'+size+'px;height:'+size+'px;background:hsl('+Math.floor(20+Math.random()*40)+' 80% 55%)"></div>';
      else if(s==="spring")html+='<div class="petal" style="left:'+left+'%;animation-duration:'+dur+'s;animation-delay:'+delay+'s"></div>';
      else if(s==="summer")html+='<div class="ray" style="left:'+left+'%;top:'+(10+Math.random()*40).toFixed(0)+'%;animation-delay:'+delay+'s"></div>';
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
  let activeTag="all";const tagsEl=document.getElementById("tags");
  function rebuildTags(){
    const allTags=["all"];
    GAMES.forEach(g=>(g.tags||[]).forEach(t=>{if(t!=="all"&&!allTags.includes(t))allTags.push(t);}));
    tagsEl.innerHTML=allTags.map(t=>'<button class="tag'+(t===activeTag?" on":"")+'" data-t="'+t+'">'+t+'</button>').join("");
  }
  tagsEl.addEventListener("click",e=>{const b=e.target.closest(".tag");if(!b)return;activeTag=b.getAttribute("data-t");tagsEl.querySelectorAll(".tag").forEach(x=>x.classList.toggle("on",x.getAttribute("data-t")===activeTag));draw();});

  const health={};
  function checkHealth(g){const p=pathOf(g);if(health[p]!==undefined)return;health[p]=null;fetch(p,{method:"HEAD",cache:"no-store"}).then(r=>{health[p]=r.ok;const el=document.querySelector('.game[data-path="'+p+'"]');if(el&&!r.ok)el.classList.add("dead");}).catch(()=>{fetch(p,{method:"GET",cache:"no-store"}).then(r=>{health[p]=r.ok;const el=document.querySelector('.game[data-path="'+p+'"]');if(el&&!r.ok)el.classList.add("dead");}).catch(()=>{health[p]=false;});});}

  function draw(){
    const sInput=document.getElementById("search");
    const q=(sInput&&sInput.value||"").trim().toLowerCase();
    const root=document.getElementById("root");

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
      h+='<div class="game'+(dead?" dead":"")+'" style="--i:'+i+'" data-path="'+p+'">';
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
      h+='<div class="game'+(dead?" dead":"")+'" style="--i:'+i+'" data-path="'+p+'">';
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
      setTimeout(()=>{ location.href=p; },80);
    }));

    root.querySelectorAll(".cat,.game").forEach((el,i)=>{el.classList.add("reveal");el.style.transitionDelay=(Math.min(i,12)*0.045)+"s";});
    if(window.__observeReveal)window.__observeReveal(root.querySelectorAll(".reveal"));
  }

  document.getElementById("search").addEventListener("input",draw);
  document.getElementById("refresh").addEventListener("click",()=>{
    Object.keys(health).forEach(k=>delete health[k]);
    discoverGames().then(()=>{rebuildTags();draw();loadGlobalViews();});
  });
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

  discoverGames().then(()=>{
    rebuildTags();
    if(bar)bar.style.width="100%";
    draw();
    loadGlobalViews();
    setTimeout(()=>{if(bar){bar.style.opacity="0";setTimeout(()=>{bar.style.width="0";bar.style.opacity="1"},300);}},250);
  });

  (function(){
    const canvas=document.getElementById("cubeCanvas");const hero=canvas.parentElement;const ctx=canvas.getContext("2d");let W,H,dpr;
    const COLORS=season==="halloween"?["#ff8c42","#9b30ff","#ffb347","#22c55e","#f97316"]:season==="winter"?["#93c5fd","#60a5fa","#e0f2fe","#a5b4fc","#bfdbfe"]:season==="spring"?["#86efac","#4ade80","#f9a8d4","#a7f3d0","#bbf7d0"]:season==="summer"?["#fbbf24","#f59e0b","#38bdf8","#fb923c","#fde68a"]:season==="autumn"?["#fb923c","#ea580c","#fbbf24","#c2410c","#fdba74"]:season==="christmas"?["#ef4444","#22c55e","#fbbf24","#f87171","#4ade80"]:["#a78bfa","#6366f1","#22d3ee","#f472b6","#818cf8","#c4b5fd"];
    function resize(){dpr=Math.min(devicePixelRatio||1,2);const r=hero.getBoundingClientRect();W=r.width+100;H=r.height+50;canvas.width=W*dpr;canvas.height=H*dpr;canvas.style.width=W+"px";canvas.style.height=H+"px";ctx.setTransform(dpr,0,0,dpr,0,0);}
    resize();addEventListener("resize",resize);const G=0.22,REST=0.55;
    function plat(){const tw=Math.min(W*0.55,320);return{x:(W-tw)/2,y:H*0.42,w:tw,h:22};}
    class Cube{constructor(i){this.i=i;this.reset(true);this.carry=Math.random()>0.5?String(0|Math.random()*10):null;this.phase=Math.random()*6.28;this.mood=0;this.timer=50+Math.random()*100;}reset(f){this.size=8+Math.random()*8;this.mass=this.size*this.size*0.08;this.x=50+Math.random()*Math.max(40,W-100);this.y=f?H*0.55+Math.random()*H*0.25:-30;this.vx=(Math.random()-0.5)*2.5;this.vy=f?(Math.random()-0.5)*1.2:0.5;this.angle=Math.random()*6.28;this.w=(Math.random()-0.5)*0.04;this.color=COLORS[this.i%COLORS.length];this.alpha=0.85;this.grounded=false;}step(dt,p){this.timer--;if(this.timer<=0){this.timer=70+Math.random()*140;const r=Math.random();this.mood=r<0.32?1:r<0.55?2:0;}if(this.mood===1){const cx=p.x+p.w/2;this.vx+=Math.sign(cx-this.x)*0.06*dt;if(Math.abs(cx-this.x)<50&&this.y>p.y)this.vy-=0.28*dt;}else if(this.mood===2&&this.grounded){this.vy=-5-Math.random()*2;this.vx+=(Math.random()-0.5)*2;this.omega+=(Math.random()-0.5)*0.1;}this.vy+=G*dt;this.vx*=0.995;this.x+=this.vx*dt;this.y+=this.vy*dt;this.angle+=this.w*dt;this.grounded=false;const pr=plat();if(this.y+this.size>pr.y&&this.y<pr.y+pr.h&&this.x>pr.x-this.size&&this.x<pr.x+pr.w+this.size){if(this.vy>0){this.y=pr.y-this.size;this.vy*=-REST;this.vx*=0.9;this.grounded=true;if(Math.abs(this.vy)<0.5)this.vy=0;}}if(this.y>H+50)this.reset(false);}draw(ctx){ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.angle);ctx.globalAlpha=this.alpha;ctx.fillStyle=this.color;ctx.fillRect(-this.size,-this.size,this.size*2,this.size*2);ctx.strokeStyle="rgba(0,0,0,0.2)";ctx.lineWidth=1;ctx.strokeRect(-this.size,-this.size,this.size*2,this.size*2);if(this.carry){ctx.fillStyle="#fff";ctx.font=(this.size*1.2)+"px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(this.carry,0,0);}ctx.restore();}}
    const cubes=Array.from({length:14},(_,i)=>new Cube(i));
    let last=performance.now();
    function frame(now){const dt=Math.min(32,(now-last)/16);last=now;const p=plat();cubes.forEach(c=>c.step(dt,p));ctx.clearRect(0,0,W,H);ctx.fillStyle="rgba(255,255,255,0.06)";ctx.fillRect(p.x,p.y,p.w,p.h);cubes.forEach(c=>c.draw(ctx));requestAnimationFrame(frame);}
    requestAnimationFrame(frame);
  })();
})();
