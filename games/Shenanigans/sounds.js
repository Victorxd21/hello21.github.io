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
  /* movement */      step:.5, jump:.8, double_jump:.8, land:.7,
  /* basic combat */  m1_1:1, m1_2:1, m1_3:1, m1_4:1.1, hit:.9, hit_heavy:1, block:.9, player_hurt:1, ko:1,
  /* vessel moves */  move1:1, move2:1, move3:1, move4:1,                 // cast sounds for keys 1–4 (Cursed Strikes, Crushing Blow, Divergent Fist, Manji Kick)
                      cs_kick:1, cb_grab:1, cb_slam:1, cb_launch:1, shockwave:1,
                      bf_charge:1, black_flash:1.2, df_explosion:1, manji_counter:1,
  /* king of curses*/ awaken:1, awaken_end:.8,
                      ult1:1, ult2:1, ult3:1, ult4:1,                     // cast sounds for keys 1–4 while awakened (Dismantle, Sever Rush, Fuga, Domain)
                      dismantle_slash:.8, rush_grab:1, rush_slide:.7, rush_launch:1, rush_kick:1.1,
                      fuga_fire:1, fuga_explode:1.2, domain_slash:.5, domain_end:1.2, domain_ambience:.6,
  /* world */         dummy_swing:.8, prop_break:.9,
  /* soundtrack (loops) */ music_main:.6, music_awaken:.7, music_domain:.8
};

const Snd=(()=>{
  const A={};let on=false,want=null,cur=null,curN=null;
  const vol=n=>Math.min(1,SOUNDS[n]*(n.startsWith('music_')?VOL.music:VOL.sfx));
  const get=n=>{
    if(n in A)return A[n];if(!(n in SOUNDS))return null;
    const a=new Audio(FILES[n]||SOUND_DIR+n+'.'+SOUND_EXT);a.preload='auto';a.onerror=()=>{A[n]=null};return A[n]=a;
  };
  function apply(){
    if(!on)return;
    if(cur&&curN!==want){cur.pause();cur=null;curN=null}
    if(want&&!cur){const a=get(want);if(a){a.loop=true;a.volume=vol(want);a.currentTime=0;a.play().catch(()=>{});cur=a;curN=want}}
  }
  return{
    unlock(){if(on)return;on=true;Object.keys(SOUNDS).forEach(get);apply()},                 // browsers need a first click/key
    play(n,v=1){if(!on)return;const a=get(n);if(!a)return;const c=a.cloneNode();c.volume=Math.min(1,vol(n)*v);c.play().catch(()=>{})},
    loop(n,s){if(!on)return;const a=get(n);if(!a)return;
      if(s&&a.paused){a.loop=true;a.volume=vol(n);a.play().catch(()=>{})}else if(!s&&!a.paused){a.pause();a.currentTime=0}},
    music(n){want=n;apply()}
  };
})();
['pointerdown','keydown','touchstart'].forEach(e=>addEventListener(e,()=>Snd.unlock()));
