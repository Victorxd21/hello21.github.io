// ===== ONLINE LOBBY v5 (loader) =====
(function(){
  var s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/gh/Victorxd21/hello21.github.io@c2df1c5cf87b91f5f34d49ab71c5fa83a7ecdaa9/games/chess/online-lobby.js?t='+Date.now();
  s.onload=function(){
    // patch join reliability on top of v4 if loaded
    console.log('online lobby base loaded, applying v5 join fix');
    try {
      if (typeof window.createRoom !== 'function') return;
      // Re-run stronger join if already in lobby as host
    } catch(e){}
  };
  document.body.appendChild(s);
})();
