/**
 * Siren Head VR — loads the FULL original game from ../Siren Head/
 * and applies only WebXR patches (does not replace gameplay).
 */
(async function () {
  const loading = document.getElementById('loading');
  function fail(e) {
    console.error(e);
    if (loading) {
      loading.innerHTML = '<div class="loading-inner"><div class="loading-title">LOAD ERROR</div><div class="loading-sub">' +
        (e && e.message ? e.message : e) + '</div></div>';
    }
  }
  try {
    const res = await fetch('../Siren%20Head/game.js');
    if (!res.ok) throw new Error('Could not load original game.js (' + res.status + ')');
    let code = await res.text();

    // 1) enable XR
    if (code.indexOf('renderer.xr.enabled') < 0) {
      code = code.replace(
        'renderer.setSize(window.innerWidth, window.innerHeight);',
        'renderer.setSize(window.innerWidth, window.innerHeight);\nrenderer.xr.enabled = true;'
      );
    }

    // 2) sounds from original folder
    code = code.replace(
      /const FOLDER\s*=\s*['"][^'"]*['"]/,
      "const FOLDER = '../Siren Head/SirenSounds/'"
    );

    // 3) applyCamera: XR owns headset pose
    code = code.replace(
      'function applyCamera(dt) {\n  const p = player.pos;',
      `function applyCamera(dt) {
  if (renderer.xr && renderer.xr.isPresenting) {
    try {
      var xrCam = renderer.xr.getCamera();
      var eul = new THREE.Euler().setFromQuaternion(xrCam.quaternion, 'YXZ');
      player.yaw = eul.y; player.pitch = eul.x;
      var dir = new THREE.Vector3(0,0,-1).applyQuaternion(xrCam.quaternion);
      flashlight.position.copy(xrCam.position);
      if (flashlight.target) flashlight.target.position.copy(xrCam.position).add(dir.multiplyScalar(6));
    } catch (err) {}
    player.flashLevel += ((player.flashOn ? 1 : 0) - player.flashLevel) * (1 - Math.exp(-dt * 25));
    flashlight.intensity = player.flashLevel * 3.0;
    return;
  }
  const p = player.pos;`
    );

    // 4) pollPad: XR controllers -> existing input
    code = code.replace(
      'function pollPad(dt) {\n  const gp = getPad();',
      `function pollPad(dt) {
  if (renderer.xr && renderer.xr.isPresenting) {
    try {
      var session = renderer.xr.getSession();
      if (session) {
        var xrlx=0,xrly=0,xrrx=0,xrry=0,xrsprint=false;
        for (var si=0; si<session.inputSources.length; si++) {
          var srcX = session.inputSources[si];
          if (!srcX.gamepad) continue;
          var g = srcX.gamepad, ax = g.axes || [];
          var xv = ax[2] !== undefined ? ax[2] : (ax[0]||0);
          var yv = ax[3] !== undefined ? ax[3] : (ax[1]||0);
          if (srcX.handedness === 'left' || si === 0) {
            if (Math.abs(xv) > Math.abs(xrlx)) xrlx = xv;
            if (Math.abs(yv) > Math.abs(xrly)) xrly = yv;
            if (g.buttons[1] && g.buttons[1].pressed) xrsprint = true;
            var ltrig = !!(g.buttons[0] && g.buttons[0].pressed);
            if (ltrig && !srcX._flashPrev) { try { player.flashOn = !player.flashOn; } catch(e) {} }
            srcX._flashPrev = ltrig;
          } else {
            if (Math.abs(xv) > Math.abs(xrrx)) xrrx = xv;
            if (Math.abs(yv) > Math.abs(xrry)) xrry = yv;
            var rtrig = !!(g.buttons[0] && g.buttons[0].pressed);
            if (rtrig && !srcX._usePrev) { try { if (typeof doInteract === 'function') doInteract(); } catch(e) {} }
            srcX._usePrev = rtrig;
          }
        }
        function xrdz(v){ return Math.abs(v)<0.18?0:v; }
        src.padx = xrdz(xrlx); src.padz = -xrdz(xrly); src.padSprint = xrsprint;
        padActive = true;
        return;
      }
    } catch(err) {}
  }
  const gp = getPad();`
    );

    if (code.indexOf('enterSirenVR') < 0) {
      code = code.replace(
        '/* ------------------------------------------------------------------\n   MAIN LOOP & BOOT\n------------------------------------------------------------------ */',
        `window.enterSirenVR = async function enterVR() {
  if (!navigator.xr) { alert('WebXR not available'); return; }
  try {
    var session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor','bounded-floor'] });
    await renderer.xr.setSession(session);
    if (typeof gameState !== 'undefined' && gameState === 'menu' && typeof startGame === 'function') {
      try { startGame(); } catch(e) {}
    }
  } catch(e) { alert('VR failed: ' + (e && e.message ? e.message : e)); }
};
/* ------------------------------------------------------------------
   MAIN LOOP & BOOT
------------------------------------------------------------------ */`
      );
    }

    code = code.replace(
      'function frame(now) {\n  requestAnimationFrame(frame);',
      'function frame(now) {\n  if (!(renderer.xr && renderer.xr.isPresenting)) requestAnimationFrame(frame);'
    );
    var bootRaf = code.lastIndexOf('requestAnimationFrame(frame);');
    if (bootRaf > 0) {
      code = code.slice(0, bootRaf) +
        'requestAnimationFrame(frame);\n  try { renderer.setAnimationLoop(function(t){ if (renderer.xr && renderer.xr.isPresenting) frame(t); }); } catch(e) {}\n' +
        code.slice(bootRaf + 'requestAnimationFrame(frame);'.length);
    }

    (0, eval)(code);
  } catch (e) {
    fail(e);
  }
})();
