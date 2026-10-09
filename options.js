/*! Game Hub Options v3.4.0 */
(function(){
  const OPT_KEY="hub_opts_v1";
  const defaultOpts={trail:false,party:false,confetti:true,sound:false,fx:true,grid:true,cubes:true,parallax:true,motion:false,fps:false,hideDead:false,forceOk:false,season:"auto"};
  let opts=Object.assign({},defaultOpts);
  try{const s=localStorage.getItem(OPT_KEY);if(s)Object.assign(opts,JSON.parse(s));}catch(e){}
  function saveOpts(){try{localStorage.setItem(OPT_KEY,JSON.stringify(opts));}catch(e){}}

  const css=`
#optBtn{position:fixed;top:14px;right:16px;z-index:220;width:42px;height:42px;border-radius:14px;border:1px solid var(--border);background:rgba(0,0,0,.4);backdrop-filter:blur(12px);color:var(--text);font-size:18px;cursor:pointer;display:grid;place-items:center;transition:transform .35s var(--spring),background .25s,box-shadow .3s}
#optBtn:hover{transform:rotate(45deg) scale(1.08);background:rgba(167,139,250,.2);box-shadow:0 0 24px var(--glow)}
#optPanel{position:fixed;top:64px;right:16px;z-index:230;width:min(320px,calc(100vw - 32px));max-height:min(78vh,560px);overflow:auto;border-radius:18px;border:1px solid rgba(167,139,250,.25);background:linear-gradient(165deg,rgba(20,18,32,.96),rgba(10,8,18,.98));backdrop-filter:blur(20px);box-shadow:0 20px 60px rgba(0,0,0,.55),0 0 40px rgba(167,139,250,.12);padding:16px;transform:translateY(-12px) scale(.96);opacity:0;pointer-events:none;transition:transform .4s cubic-bezier(.34,1.56,.64,1),opacity .3s}
#optPanel.on{transform:none;opacity:1;pointer-events:auto}
#optPanel h3{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:14px 0 8px}
#optPanel h3:first-child{margin-top:0}
.opt-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border-radius:12px;border:1px solid transparent}
.opt-row:hover{background:rgba(255,255,255,.04);border-color:var(--border)}
.opt-row label{font-size:13px;font-weight:600;color:var(--text);cursor:pointer;flex:1}
.opt-row .hint{font-size:10px;color:var(--muted);font-weight:500;display:block;margin-top:2px}
.toggle{position:relative;width:40px;height:22px;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid var(--border);cursor:pointer;flex-shrink:0;transition:background .25s}
.toggle.on{background:linear-gradient(135deg,var(--a),var(--b));border-color:transparent;box-shadow:0 0 12px var(--glow)}
.toggle::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .3s cubic-bezier(.34,1.56,.64,1);box-shadow:0 1px 4px rgba(0,0,0,.3)}
.toggle.on::after{transform:translateX(18px)}
.opt-select{width:100%;padding:8px 10px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,.05);color:var(--text);font-size:12px;font-weight:600;outline:none;cursor:pointer;margin-top:4px}
.opt-btn{width:100%;padding:9px 12px;margin-top:6px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,.04);color:var(--text);font-size:12px;font-weight:700;cursor:pointer;transition:background .2s,transform .25s}
.opt-btn:hover{background:rgba(167,139,250,.18);transform:translateY(-1px)}
.opt-btn.danger:hover{background:rgba(239,68,68,.2);border-color:rgba(239,68,68,.4)}
#fpsMeter{position:fixed;bottom:12px;left:12px;z-index:200;font:600 11px ui-monospace,monospace;color:var(--c);background:rgba(0,0,0,.45);border:1px solid var(--border);padding:4px 8px;border-radius:8px;display:none;pointer-events:none}
body.reduce-motion *,body.reduce-motion *::before,body.reduce-motion *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
body.no-grid .bg .grid{display:none}
body.no-fx #seasonFx,body.no-fx .bg .spark{display:none!important}
body.no-cubes #cubeCanvas{display:none}
body.no-parallax .bg .orb{transition:none!important}
body.party .game:hover{animation:partyWiggle .4s ease infinite}
@keyframes partyWiggle{0%,100%{transform:translateY(-12px) scale(1.05) rotate(-2deg)}50%{transform:translateY(-14px) scale(1.08) rotate(2deg)}}
#cursorTrail{position:fixed;inset:0;pointer-events:none;z-index:150}
.trail-dot{position:absolute;width:8px;height:8px;border-radius:50%;pointer-events:none;opacity:.7;transform:translate(-50%,-50%);transition:opacity .4s,transform .4s}
body.hide-dead .game.dead{display:none}
#confettiBox{position:fixed;inset:0;pointer-events:none;z-index:400}
`;
  const st=document.createElement("style");st.textContent=css;document.head.appendChild(st);

  const panelHTML=`
<button id="optBtn" type="button" title="Options" aria-label="Options">⚙</button>
<div id="optPanel" role="dialog" aria-label="Options">
  <h3>Fun</h3>
  <div class="opt-row"><label>Cursor trail<span class="hint">Particles follow the mouse</span></label><button type="button" class="toggle" data-opt="trail"></button></div>
  <div class="opt-row"><label>Party mode<span class="hint">Extra wiggle on hover</span></label><button type="button" class="toggle" data-opt="party"></button></div>
  <div class="opt-row"><label>Click confetti<span class="hint">Burst when opening a game</span></label><button type="button" class="toggle" data-opt="confetti"></button></div>
  <div class="opt-row"><label>UI sounds<span class="hint">Soft clicks (WebAudio)</span></label><button type="button" class="toggle" data-opt="sound"></button></div>
  <h3>Season</h3>
  <select class="opt-select" id="optSeason">
    <option value="auto">Auto (by date)</option>
    <option value="default">Default</option>
    <option value="halloween">🎃 Halloween</option>
    <option value="winter">❄ Winter</option>
    <option value="spring">🌸 Spring</option>
    <option value="summer">☀ Summer</option>
    <option value="autumn">🍂 Autumn</option>
    <option value="christmas">🎄 Christmas</option>
  </select>
  <h3>Visual</h3>
  <div class="opt-row"><label>Background FX<span class="hint">Particles & sparkles</span></label><button type="button" class="toggle" data-opt="fx"></button></div>
  <div class="opt-row"><label>Grid overlay</label><button type="button" class="toggle" data-opt="grid"></button></div>
  <div class="opt-row"><label>Physics cubes</label><button type="button" class="toggle" data-opt="cubes"></button></div>
  <div class="opt-row"><label>Scroll parallax</label><button type="button" class="toggle" data-opt="parallax"></button></div>
  <div class="opt-row"><label>Reduce motion</label><button type="button" class="toggle" data-opt="motion"></button></div>
  <h3>Dev</h3>
  <div class="opt-row"><label>FPS counter</label><button type="button" class="toggle" data-opt="fps"></button></div>
  <div class="opt-row"><label>Hide dead games</label><button type="button" class="toggle" data-opt="hideDead"></button></div>
  <div class="opt-row"><label>Show all as playable<span class="hint">Ignore health checks</span></label><button type="button" class="toggle" data-opt="forceOk"></button></div>
  <button type="button" class="opt-btn" id="optShake">Shake cubes</button>
  <button type="button" class="opt-btn" id="optReloadFx">Reload seasonal FX</button>
  <button type="button" class="opt-btn danger" id="optClear">Clear saved options</button>
  <p style="margin-top:12px;font-size:10px;color:var(--muted);text-align:center">Game Hub options · saved locally</p>
</div>
<div id="fpsMeter">-- fps</div>
<div id="cursorTrail"></div>
<div id="confettiBox"></div>`;
  const wrap=document.createElement("div");wrap.innerHTML=panelHTML;
  while(wrap.firstChild)document.body.appendChild(wrap.firstChild);

  let audioCtx=null;
  function blip(freq,dur,type,vol){
    if(!opts.sound)return;
    try{
      if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.type=type||"sine";o.frequency.value=freq||440;
      g.gain.value=vol||0.04;g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+(dur||0.08));
      o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+(dur||0.08));
    }catch(e){}
  }

  function naturalSeason(){
    const mo=new Date().getMonth()+1,dy=new Date().getDate();
    if(mo===10)return"halloween";
    if(mo===12&&dy>=20)return"christmas";
    if(mo===12||mo===1||mo===2)return"winter";
    if(mo>=3&&mo<=5)return"spring";
    if(mo>=6&&mo<=8)return"summer";
    if(mo===9)return"autumn";
    return"default";
  }

  function applyForcedSeason(){
    ["season-halloween","season-winter","season-spring","season-summer","season-autumn","season-christmas"].forEach(c=>document.body.classList.remove(c));
    let use=opts.season;
    if(!use||use==="auto")use=naturalSeason();
    const sEl=document.getElementById("season");
    if(use&&use!=="default"){
      document.body.classList.add("season-"+use);
      if(sEl){
        const labels={halloween:"🎃 Halloween",winter:"❄ Winter",spring:"🌸 Spring",summer:"☀ Summer",autumn:"🍂 Autumn",christmas:"🎄 Christmas"};
        sEl.style.display="";sEl.textContent=labels[use]||use;
      }
    }else if(sEl&&opts.season==="default"){sEl.style.display="none";}
    if(window.__reloadSeasonFx)window.__reloadSeasonFx(use);
  }

  function applyOpts(){
    document.body.classList.toggle("party",!!opts.party);
    document.body.classList.toggle("reduce-motion",!!opts.motion);
    document.body.classList.toggle("no-grid",!opts.grid);
    document.body.classList.toggle("no-fx",!opts.fx);
    document.body.classList.toggle("no-cubes",!opts.cubes);
    document.body.classList.toggle("no-parallax",!opts.parallax);
    document.body.classList.toggle("hide-dead",!!opts.hideDead);
    const fpsEl=document.getElementById("fpsMeter");
    if(fpsEl)fpsEl.style.display=opts.fps?"block":"none";
    document.querySelectorAll("#optPanel .toggle").forEach(t=>{
      const k=t.getAttribute("data-opt");if(k in opts)t.classList.toggle("on",!!opts[k]);
    });
    const sel=document.getElementById("optSeason");if(sel)sel.value=opts.season||"auto";
    applyForcedSeason();
    window.__hubOpts=opts;
  }

  (function(){
    const layer=document.getElementById("cursorTrail");
    let last=0;
    addEventListener("pointermove",e=>{
      if(!opts.trail||!layer)return;
      const now=performance.now();if(now-last<30)return;last=now;
      const d=document.createElement("div");d.className="trail-dot";
      d.style.left=e.clientX+"px";d.style.top=e.clientY+"px";
      d.style.background=getComputedStyle(document.body).getPropertyValue("--a").trim()||"#a78bfa";
      layer.appendChild(d);
      requestAnimationFrame(()=>{d.style.opacity="0";d.style.transform="translate(-50%,-50%) scale(0)";});
      setTimeout(()=>d.remove(),450);
    },{passive:true});
  })();

  window.__confetti=function(x,y){
    if(!opts.confetti)return;
    const box=document.getElementById("confettiBox");if(!box)return;
    const colors=["var(--a)","var(--b)","var(--c)","var(--d)","#fff"];
    for(let i=0;i<28;i++){
      const p=document.createElement("div");
      const ang=Math.random()*6.28,dist=40+Math.random()*80,size=4+Math.random()*6;
      p.style.cssText="position:absolute;left:"+x+"px;top:"+y+"px;width:"+size+"px;height:"+size+"px;border-radius:"+(Math.random()>.5?"50%":"2px")+";background:"+colors[i%colors.length]+";pointer-events:none;transition:transform .7s cubic-bezier(.2,.8,.3,1),opacity .7s;opacity:1";
      box.appendChild(p);
      requestAnimationFrame(()=>{p.style.transform="translate("+(Math.cos(ang)*dist)+"px,"+(Math.sin(ang)*dist-30)+"px) rotate("+Math.random()*360+"deg)";p.style.opacity="0";});
      setTimeout(()=>p.remove(),750);
    }
  };

  (function(){
    let frames=0,last=performance.now();
    const el=document.getElementById("fpsMeter");
    function loop(now){
      frames++;
      if(now-last>=1000){if(el&&opts.fps)el.textContent=frames+" fps";frames=0;last=now;}
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  })();

  const btn=document.getElementById("optBtn"),panel=document.getElementById("optPanel");
  btn.addEventListener("click",e=>{e.stopPropagation();panel.classList.toggle("on");blip(520,.06,"triangle",.03);});
  addEventListener("click",e=>{if(panel.classList.contains("on")&&!panel.contains(e.target)&&e.target!==btn)panel.classList.remove("on");});
  addEventListener("keydown",e=>{if(e.key==="Escape")panel.classList.remove("on");});
  panel.querySelectorAll(".toggle").forEach(t=>{
    t.addEventListener("click",()=>{
      const k=t.getAttribute("data-opt");
      opts[k]=!opts[k];t.classList.toggle("on",opts[k]);saveOpts();applyOpts();blip(opts[k]?660:320,.05,"sine",.03);
    });
  });
  document.getElementById("optSeason").addEventListener("change",e=>{opts.season=e.target.value;saveOpts();applyOpts();blip(480,.06);});
  document.getElementById("optClear").addEventListener("click",()=>{opts=Object.assign({},defaultOpts);saveOpts();applyOpts();blip(200,.1,"sawtooth",.04);});
  document.getElementById("optReloadFx").addEventListener("click",()=>{if(window.__reloadSeasonFx)window.__reloadSeasonFx(opts.season==="auto"?naturalSeason():opts.season);blip(700,.05);});
  document.getElementById("optShake").addEventListener("click",()=>{if(window.__shakeCubes)window.__shakeCubes();blip(180,.08,"square",.03);});

  const rootObs=new MutationObserver(()=>{
    document.querySelectorAll(".game").forEach(el=>{
      if(el.__optHooked)return;el.__optHooked=true;
      el.addEventListener("click",function(){
        if(this.classList.contains("dead")&&!opts.forceOk)return;
        const r=this.getBoundingClientRect();
        if(window.__confetti)window.__confetti(r.left+r.width/2,r.top+r.height/2);
        blip(880,.05,"sine",.04);
      });
      if(opts.forceOk)el.classList.remove("dead");
    });
  });
  const root=document.getElementById("root");
  if(root)rootObs.observe(root,{childList:true,subtree:true});

  applyOpts();
  window.__hubOpts=opts;
})();
