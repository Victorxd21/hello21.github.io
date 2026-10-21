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

    if (code.indexOf('renderer.xr.enabled') < 0) {
      code = code.replace(
        'renderer.setSize(window.innerWidth, window.innerHeight);',
        'renderer.setSize(window.innerWidth, window.innerHeight);\nrenderer.xr.enabled = true;'
      );
    }

    code = code.replace(
      /const FOLDER\s*=\s*['"][^'"]*['"]/,
      "const FOLDER = '../Siren Head/SirenSounds/'"
    );

    code = code.replace(
      'function applyCamera(dt) {\n  const p = player.pos;',
      'function applyCamera(dt) {\n  if (renderer.xr && renderer.xr.isPresenting) {\n    try {\n      var xrCam = renderer.xr.getCamera();\n      var eul = new THREE.Euler().setFromQuaternion(xrCam.quaternion, \'YXZ\');\n      player.yaw = eul.y; player.pitch = eul.x;\n      var dir = new THREE.Vector3(0,0,-1).applyQuaternion(xrCam.quaternion);\n      flashlight.position.copy(xrCam.position);\n      if (flashlight.target) flashlight.target.position.copy(xrCam.position).add(dir.multiplyScalar(6));\n    } catch (err) {}\n    player.flashLevel += ((player.flashOn ? 1 : 0) - player.flashLevel) * (1 - Math.exp(-dt * 25));\n    flashlight.intensity = player.flashLevel * 3.0;\n    return;\n  }\n  const p = player.pos;'
    );

    code = code.replace(
      'function pollPad(dt) {\n  const gp = getPad();',
      'function pollPad(dt) {\n  if (renderer.xr && renderer.xr.isPresenting) {\n    try {\n      var session = renderer.xr.getSession();\n      if (session) {\n        var xrlx=0,xrly=0,xrrx=0,xrry=0,xrsprint=false;\n        for (var si=0; si<session.inputSources.length; si++) {\n          var srcX = session.inputSources[si];\n          if (!srcX.gamepad) continue;\n          var g = srcX.gamepad, ax = g.axes || [];\n          var xv = ax[2] !== undefined ? ax[2] : (ax[0]||0);\n          var yv = ax[3] !== undefined ? ax[3] : (ax[1]||0);\n          if (srcX.handedness === \'left\' || si === 0) {\n            if (Math.abs(xv) > Math.abs(xrlx)) xrlx = xv;\n            if (Math.abs(yv) > Math.abs(xrly)) xrly = yv;\n            if (g.buttons[1] && g.buttons[1].pressed) xrsprint = true;\n          } else {\n            if (Math.abs(xv) > Math.abs(xrrx)) xrrx = xv;\n            if (Math.abs(yv) > Math.abs(xrry)) xrry = yv;\n          }\n          if (srcX.handedness === \'right\' && g.buttons[0] && g.buttons[0].pressed) {\n            if (!srcX._trigPrev) { try { if (typeof doInteract === \'function\') doInteract(); } catch(e) {} }\n            srcX._trigPrev = true;\n          } else if (srcX.handedness === \'right\') { srcX._trigPrev = false; }\n          if (srcX.handedness === \'left\' && g.buttons[0] && g.buttons[0].pressed) {\n            if (!srcX._flashPrev) { try { player.flashOn = !player.flashOn; } catch(e) {} }\n            srcX._flashPrev = true;\n          } else if (srcX.handedness === \'left\') { srcX._flashPrev = false; }\n        }\n        function xrdz(v){ return Math.abs(v)<0.18?0:v; }\n        src.padx = xrdz(xrlx); src.padz = -xrdz(xrly); src.padSprint = xrsprint;\n        addYaw(-xrdz(xrrx)*dt*2.7*(settings&&settings.sens?settings.sens:1));\n        player.pitch = clamp(player.pitch-xrdz(xrry)*dt*2.2*(settings&&settings.sens?settings.sens:1),-1.5,1.5);\n        padActive = true;\n        return;\n      }\n    } catch(err) {}\n  }\n  const gp = getPad();'
    );

    if (code.indexOf('enterSirenVR') < 0) {
      code = code.replace(
        '/* ------------------------------------------------------------------\n   MAIN LOOP & BOOT\n------------------------------------------------------------------ */',
        'window.enterSirenVR = async function enterVR() {\n  if (!navigator.xr) { alert(\'WebXR not available\'); return; }\n  try {\n    var session = await navigator.xr.requestSession(\'immersive-vr\', { optionalFeatures: [\'local-floor\',\'bounded-floor\'] });\n    await renderer.xr.setSession(session);\n    if (typeof gameState !== \'undefined\' && gameState === \'menu\' && typeof startGame === \'function\') {\n      try { startGame(); } catch(e) {}\n    }\n  } catch(e) { alert(\'VR failed: \' + (e && e.message ? e.message : e)); }\n};\n/* ------------------------------------------------------------------\n   MAIN LOOP & BOOT\n------------------------------------------------------------------ */'
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
