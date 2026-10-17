'use strict';
/* ============================================================
   SOUNDS – drop your audio files into a folder named "sounds"
   next to index.html, named exactly like the keys below.
     e.g.  sounds/m1_1.mp3   sounds/music_domain.mp3
   Missing files are simply silent. The number after each name is
   its volume (0–1). Use FILES to point a name at any other path.
   ============================================================ */
const SOUND_DIR='sounds/',SOUND_EXT='mp3';           // change to 'ogg' / 'wav' if you prefer
const VOL={sfx:.8,music:.5};                          // master volumes
const FILES={};                                       // optional overrides, e.g. {step:'audio/walk.ogg'}
const SOUNDS={
  /* movement */      step:.5, dash:.8, jump:.8, double_jump:.8, land:.7,
  /* basic combat */  m1_1:1, m1_2:1, m1_3:1, m1_4:1.1, uppercut:1, downslam:1, hit:.9, hit_heavy:1, block:.9, player_hurt:1, ko:1,
  /* vessel moves */  move1:1, move2:1, move3:1, move4:1,                 // cast sounds for keys 1–4 (Cursed Strikes, Crushing Blow, Divergent Fist, Manji Kick)
                      cs_kick:1, cb_grab:1, cb_slam:1, cb_launch:1, shockwave:1,
                      bf_charge:1, black_flash:1.2, df_explosion:1, manji_counter:1,
  /* king of curses*/ awaken:1, awaken_end:.8,
                      ult1:1, ult2:1, ult3:1, ult4:1,                     // cast sounds for keys 1–4 while awakened (Dismantle, Sever Rush, Fuga, Domain)
                      dismantle_slash:.8, rush_grab:1, rush_slide:.7, rush_launch:1, rush_kick:1.1,
                      fuga_fire:1, fuga_explode:1.2, domain_slash:.5, domain_enter:1, domain_end:1.2, domain_ambience:.6,
  /* world */         dummy_swing:.8, prop_break:.9,
  /* soundtrack (loops) */ music_main:.6, music_awaken:.7, music_domain:.8
};

const Snd=(()=>{
  const A={};let on=false,primed=false,want=null,cur=null,curN=null,found=0;
  const vol=n=>Math.min(1,SOUNDS[n]*(n.startsWith('music_')?VOL.music:VOL.sfx));
  const tip=document.createElement('div');   // small status message so you can see if your files were found
  tip.style.cssText='position:fixed;left:8px;bottom:8px;max-width:70vw;font:12px sans-serif;color:#fff;background:rgba(0,0,0,.65);padding:5px 9px;border-radius:6px;z-index:9;pointer-events:none;opacity:0;transition:opacity .4s';
  document.body.append(tip);
  const get=n=>{
    if(n in A)return A[n];if(!(n in SOUNDS))return null;
    const a=new Audio(FILES[n]||SOUND_DIR+n+'.'+SOUND_EXT);a.preload='auto';
    a.addEventListener('canplay',()=>found++,{once:true});a.addEventListener('error',()=>{A[n]=null});return A[n]=a;
  };
  function prime(){   // iOS only lets an <audio> play later if it was started once inside a tap
    Object.keys(SOUNDS).forEach(n=>{const a=get(n);if(!a||a===cur)return;a.muted=true;const p=a.play();
      if(p&&p.then)p.then(()=>{primed=true;if(a!==cur){a.pause();a.currentTime=0}a.muted=false}).catch(()=>{a.muted=false})});
  }
  function apply(){
    if(!on)return;
    if(cur&&curN!==want){cur.pause();cur=null;curN=null}
    if(want&&!cur){const a=get(want);if(a){a.loop=true;a.muted=false;a.volume=vol(want);a.currentTime=0;a.play().catch(()=>{});cur=a;curN=want}}
  }
  function unlock(){
    if(primed)return;on=true;prime();apply();
    if(!tip.dataset.s){tip.dataset.s=1;setTimeout(()=>{
      tip.textContent='Sound files found: '+found+' / '+Object.keys(SOUNDS).length+(found?'':' – put them in a "sounds" folder next to index.html (e.g. sounds/step.mp3)');
      tip.style.opacity=1;setTimeout(()=>tip.style.opacity=0,7000)},3000)}
  }
  return{
    unlock,
    play(n,v=1){if(!on)return;const a=get(n);if(!a)return;const e=a.paused?a:a.cloneNode();e.volume=Math.min(1,vol(n)*v);if(e===a)a.currentTime=0;e.play().catch(()=>{})},
    loop(n,s){if(!on)return;const a=get(n);if(!a)return;
      if(s&&a.paused){a.loop=true;a.volume=vol(n);a.play().catch(()=>{})}else if(!s&&!a.paused){a.pause();a.currentTime=0}},
    music(n){want=n;apply()}
  };
})();
['pointerup','touchend','click','keydown'].forEach(e=>addEventListener(e,()=>Snd.unlock(),true));   // iOS only accepts audio unlock on touchend/click
