/**
 * Siren Head VR
 * Loads the FULL original game from ../Siren Head/game.js
 * and applies only WebXR patches (does not reimplement gameplay).
 *
 * Spawn / camera:
 *  - On session start, capture the local-floor reference space.
 *  - Every frame, offset that space so its origin tracks player.pos (feet).
 *  - Headset then sits on the real farmhouse spawn instead of world (0,0,0).
 *  - applyCamera early-returns while presenting (XR owns pose).
 *  - Controllers map into existing src.padx / src.padz.
 */
(async function () {
  const loading = document.getElementById('loading');
  function fail(e) {
    console.error(e);
    if (loading) {
      loading.innerHTML =
        '<div class="loading-inner"><div class="loading-title">LOAD ERROR</div><div class="loading-sub">' +
        (e && e.message ? e.message : e) +
        '</div></div>';
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

    // 3) applyCamera: XR owns headset pose; only sync yaw/pitch + flashlight
    code = code.replace(
      'function applyCamera(dt) {\n  const p = player.pos;',
      'function applyCamera(dt) {\n' +
        '  if (renderer.xr && renderer.xr.isPresenting) {\n' +
        '    try {\n' +
        '      var xrCam = renderer.xr.getCamera();\n' +
        "      var eul = new THREE.Euler().setFromQuaternion(xrCam.quaternion, 'YXZ');\n" +
        '      player.yaw = eul.y;\n' +
        '      player.pitch = eul.x;\n' +
        '    } catch (err) {}\n' +
        '    player.flashLevel += ((player.flashOn ? 1 : 0) - player.flashLevel) * (1 - Math.exp(-dt * 25));\n' +
        '    var fl = player.flashLevel * 3.0;\n' +
        "    if (player.flashOn && typeof mon !== 'undefined' && mon.state !== 'cutscene' && mon.dist < 48)\n" +
        '      fl *= (Math.random() < (1 - mon.dist / 48) * 0.35 ? 0.15 : 1);\n' +
        '    flashlight.intensity = fl;\n' +
        '    return;\n' +
        '  }\n' +
        '  const p = player.pos;'
    );

    // 4) pollPad: XR controllers -> existing input
    code = code.replace(
      'function pollPad(dt) {\n  const gp = getPad();',
      'function pollPad(dt) {\n' +
        '  if (renderer.xr && renderer.xr.isPresenting) {\n' +
        '    try {\n' +
        '      var session = renderer.xr.getSession();\n' +
        '      if (session) {\n' +
        '        var xrlx=0,xrly=0,xrrx=0,xrry=0,xrsprint=false;\n' +
        '        for (var si=0; si<session.inputSources.length; si++) {\n' +
        '          var srcX = session.inputSources[si];\n' +
        '          if (!srcX.gamepad) continue;\n' +
        '          var g = srcX.gamepad, ax = g.axes || [];\n' +
        '          var xv = ax[2] !== undefined ? ax[2] : (ax[0]||0);\n' +
        '          var yv = ax[3] !== undefined ? ax[3] : (ax[1]||0);\n' +
        "          if (srcX.handedness === 'left' || si === 0) {\n" +
        '            if (Math.abs(xv) > Math.abs(xrlx)) xrlx = xv;\n' +
        '            if (Math.abs(yv) > Math.abs(xrly)) xrly = yv;\n' +
        '            if (g.buttons[1] && g.buttons[1].pressed) xrsprint = true;\n' +
        '            var ltrig = !!(g.buttons[0] && g.buttons[0].pressed);\n' +
        '            if (ltrig && !srcX._flashPrev) { try { player.flashOn = !player.flashOn; } catch(e) {} }\n' +
        '            srcX._flashPrev = ltrig;\n' +
        '          } else {\n' +
        '            if (Math.abs(xv) > Math.abs(xrrx)) xrrx = xv;\n' +
        '            if (Math.abs(yv) > Math.abs(xrry)) xrry = yv;\n' +
        '            var rtrig = !!(g.buttons[0] && g.buttons[0].pressed);\n' +
        "            if (rtrig && !srcX._usePrev) { try { if (typeof doInteract === 'function') doInteract(); } catch(e) {} }\n" +
        '            srcX._usePrev = rtrig;\n' +
        '          }\n' +
        '        }\n' +
        '        function xrdz(v){ return Math.abs(v)<0.18?0:v; }\n' +
        '        src.padx = xrdz(xrlx); src.padz = -xrdz(xrly); src.padSprint = xrsprint;\n' +
        '        padActive = true;\n' +
        '        return;\n' +
        '      }\n' +
        '    } catch(err) {}\n' +
        '  }\n' +
        '  const gp = getPad();'
    );

    // 5) enterSirenVR + XR offset helpers
    if (code.indexOf('enterSirenVR') < 0) {
      code = code.replace(
        '/* ------------------------------------------------------------------\n   MAIN LOOP & BOOT\n------------------------------------------------------------------ */',
        'window.__sirenXR = { baseRef: null, lastPx: NaN, lastPy: NaN, lastPz: NaN };\n' +
          'function __sirenUpdateXROffset() {\n' +
          '  if (!(renderer.xr && renderer.xr.isPresenting)) return;\n' +
          "  if (typeof player === 'undefined' || !player.pos) return;\n" +
          '  var px = player.pos.x, py = player.pos.y, pz = player.pos.z;\n' +
          '  var xr = window.__sirenXR;\n' +
          '  if (!xr.baseRef) {\n' +
          '    try { xr.baseRef = renderer.xr.getReferenceSpace(); } catch (e) { return; }\n' +
          '    if (!xr.baseRef) return;\n' +
          '  }\n' +
          '  if (px === xr.lastPx && py === xr.lastPy && pz === xr.lastPz) return;\n' +
          '  try {\n' +
          '    if (typeof XRRigidTransform === "undefined") throw new Error("no XRRigidTransform");\n' +
          '    var t = new XRRigidTransform({ x: px, y: py, z: pz });\n' +
          '    renderer.xr.setReferenceSpace(xr.baseRef.getOffsetReferenceSpace(t));\n' +
          '    xr.lastPx = px; xr.lastPy = py; xr.lastPz = pz;\n' +
          '    // keep scene rooted at origin when using ref-space offset\n' +
          '    scene.position.set(0, 0, 0);\n' +
          '    if (camera && !camera.parent) try { scene.add(camera); } catch (e) {}\n' +
          '  } catch (e2) {\n' +
          '    // Fallback: move the whole world under the headset\n' +
          '    scene.position.set(-px, -py, -pz);\n' +
          '    if (camera && camera.parent) camera.parent.remove(camera);\n' +
          '    xr.lastPx = px; xr.lastPy = py; xr.lastPz = pz;\n' +
          '  }\n' +
          '}\n' +
          'window.enterSirenVR = async function enterVR() {\n' +
          "  if (!navigator.xr) { alert('WebXR not available'); return; }\n" +
          '  try {\n' +
          "    var session = await navigator.xr.requestSession('immersive-vr', {\n" +
          "      optionalFeatures: ['local-floor', 'bounded-floor']\n" +
          '    });\n' +
          '    await renderer.xr.setSession(session);\n' +
          '    window.__sirenXR.baseRef = null;\n' +
          '    window.__sirenXR.lastPx = window.__sirenXR.lastPy = window.__sirenXR.lastPz = NaN;\n' +
          '    try { window.__sirenXR.baseRef = renderer.xr.getReferenceSpace(); } catch (e1) {}\n' +
          '    session.addEventListener("end", function () {\n' +
          '      window.__sirenXR.baseRef = null;\n' +
          '      window.__sirenXR.lastPx = window.__sirenXR.lastPy = window.__sirenXR.lastPz = NaN;\n' +
          '      try { scene.position.set(0, 0, 0); } catch (e) {}\n' +
          '      if (camera && !camera.parent) try { scene.add(camera); } catch (e) {}\n' +
          '    });\n' +
          "    if (typeof gameState !== 'undefined' && gameState === 'menu' && typeof startGame === 'function') {\n" +
          '      try { startGame(); } catch (e) {}\n' +
          '    }\n' +
          '    // snap headset to current player feet immediately\n' +
          '    try { __sirenUpdateXROffset(); } catch (e) {}\n' +
          "  } catch (e) { alert('VR failed: ' + (e && e.message ? e.message : e)); }\n" +
          '};\n' +
          '/* ------------------------------------------------------------------\n   MAIN LOOP & BOOT\n------------------------------------------------------------------ */'
      );
    }

    // 6) frame: skip nested RAF while presenting; XR drives the loop
    code = code.replace(
      'function frame(now) {\n  requestAnimationFrame(frame);',
      'function frame(now) {\n  if (!(renderer.xr && renderer.xr.isPresenting)) requestAnimationFrame(frame);'
    );

    // 7) keep XR origin glued to player.pos — after the if/else chain so cutscene/dying still run
    code = code.replace(
      "if (gameState === 'playing') {\n    updatePlayer(dt); applyCamera(dt); updateInteract(); updateMonster(dt);\n  } else if (gameState === 'cutscene') { Cut.update(dt); }\n  else if (gameState === 'dying') { Kill.update(dt); }",
      "if (gameState === 'playing') {\n" +
        '    updatePlayer(dt); applyCamera(dt); updateInteract(); updateMonster(dt);\n' +
        '  } else if (gameState === \'cutscene\') { Cut.update(dt); }\n' +
        '  else if (gameState === \'dying\') { Kill.update(dt); }\n' +
        '  try { if (renderer.xr && renderer.xr.isPresenting) __sirenUpdateXROffset(); } catch (e3) {}'
    );

    // 8) boot both RAF and setAnimationLoop
    var bootRaf = code.lastIndexOf('requestAnimationFrame(frame);');
    if (bootRaf > 0) {
      code =
        code.slice(0, bootRaf) +
        'requestAnimationFrame(frame);\n' +
        '  try {\n' +
        '    renderer.setAnimationLoop(function (t) {\n' +
        '      if (renderer.xr && renderer.xr.isPresenting) frame(t);\n' +
        '    });\n' +
        '  } catch (e) {}\n' +
        code.slice(bootRaf + 'requestAnimationFrame(frame);'.length);
    }

    (0, eval)(code);
  } catch (e) {
    fail(e);
  }
})();
