/**
 * Siren Head VR
 * Loads the FULL original game from ../Siren Head/game.js
 * and applies only WebXR patches (does not reimplement gameplay).
 *
 * Movement: while XR is presenting, stick direction is projected onto the
 * headset look vector (head-relative), not the old mouse yaw.
 * Sprint: stick click / grip / stick pushed hard.
 * Hands: simple meshes on controller grips.
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

    // 3) HEAD-RELATIVE MOVEMENT — replace the yaw-based velocity math
    code = code.replace(
      '  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);\n  let vx = (-sy * mz + cy * mx) * speed, vz = (-cy * mz - sy * mx) * speed;',
      '  var sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);\n' +
        '  var vx = (-sy * mz + cy * mx) * speed, vz = (-cy * mz - sy * mx) * speed;\n' +
        '  if (renderer.xr && renderer.xr.isPresenting) {\n' +
        '    try {\n' +
        '      var _xrC = renderer.xr.getCamera();\n' +
        '      var _fwd = new THREE.Vector3();\n' +
        '      var _rgt = new THREE.Vector3();\n' +
        '      if (_xrC.cameras && _xrC.cameras[0]) _xrC.cameras[0].getWorldDirection(_fwd);\n' +
        '      else _xrC.getWorldDirection(_fwd);\n' +
        '      _fwd.y = 0;\n' +
        '      if (_fwd.lengthSq() < 1e-6) { _fwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)); }\n' +
        '      else _fwd.normalize();\n' +
        '      _rgt.set(_fwd.z, 0, -_fwd.x);\n' +
        '      vx = (_fwd.x * mz + _rgt.x * mx) * speed;\n' +
        '      vz = (_fwd.z * mz + _rgt.z * mx) * speed;\n' +
        '      player.yaw = Math.atan2(-_fwd.x, -_fwd.z);\n' +
        '    } catch (_eMove) {}\n' +
        '  }'
    );

    // 4) applyCamera XR: flashlight only
    code = code.replace(
      'function applyCamera(dt) {\n  const p = player.pos;',
      'function applyCamera(dt) {\n' +
        '  if (renderer.xr && renderer.xr.isPresenting) {\n' +
        '    player.flashLevel += ((player.flashOn ? 1 : 0) - player.flashLevel) * (1 - Math.exp(-dt * 25));\n' +
        '    var flXR = player.flashLevel * 3.0;\n' +
        "    if (player.flashOn && typeof mon !== 'undefined' && mon.state !== 'cutscene' && mon.dist < 48)\n" +
        '      flXR *= (Math.random() < (1 - mon.dist / 48) * 0.35 ? 0.15 : 1);\n' +
        '    flashlight.intensity = flXR;\n' +
        '    return;\n' +
        '  }\n' +
        '  const p = player.pos;'
    );

    // 5) pollPad XR
    code = code.replace(
      'function pollPad(dt) {\n  const gp = getPad();',
      'function pollPad(dt) {\n' +
        '  if (renderer.xr && renderer.xr.isPresenting) {\n' +
        '    try {\n' +
        '      var session = renderer.xr.getSession();\n' +
        '      if (session) {\n' +
        '        var xrlx=0,xrly=0,xrsprint=false;\n' +
        '        for (var si=0; si<session.inputSources.length; si++) {\n' +
        '          var srcX = session.inputSources[si];\n' +
        '          if (!srcX.gamepad) continue;\n' +
        '          var g = srcX.gamepad, ax = g.axes || [], bt = g.buttons || [];\n' +
        '          var xv = (ax.length > 2 ? ax[2] : ax[0]) || 0;\n' +
        '          var yv = (ax.length > 3 ? ax[3] : ax[1]) || 0;\n' +
        '          if (Math.abs(xv) < 0.01 && Math.abs(yv) < 0.01 && ax.length >= 2) {\n' +
        '            xv = ax[0] || 0; yv = ax[1] || 0;\n' +
        '          }\n' +
        '          var isLeft = (srcX.handedness === "left") || (si === 0 && srcX.handedness !== "right");\n' +
        '          if (isLeft) {\n' +
        '            xrlx = xv; xrly = yv;\n' +
        '            if (bt[3] && bt[3].pressed) xrsprint = true;\n' +
        '            if (bt[1] && (bt[1].pressed || bt[1].value > 0.5)) xrsprint = true;\n' +
        '            if (Math.hypot(xv, yv) > 0.85) xrsprint = true;\n' +
        '            var ltrig = !!(bt[0] && (bt[0].pressed || bt[0].value > 0.5));\n' +
        '            if (ltrig && !srcX._flashPrev) { try { player.flashOn = !player.flashOn; } catch(e) {} }\n' +
        '            srcX._flashPrev = ltrig;\n' +
        '          } else {\n' +
        '            var rtrig = !!(bt[0] && (bt[0].pressed || bt[0].value > 0.5));\n' +
        '            if (rtrig && !srcX._usePrev) { try { if (typeof doInteract === "function") doInteract(); } catch(e) {} }\n' +
        '            srcX._usePrev = rtrig;\n' +
        '            if (bt[3] && bt[3].pressed) xrsprint = true;\n' +
        '            if (bt[1] && (bt[1].pressed || bt[1].value > 0.5)) xrsprint = true;\n' +
        '          }\n' +
        '        }\n' +
        '        function xrdz(v){ return Math.abs(v)<0.12?0:v; }\n' +
        '        src.padx = xrdz(xrlx); src.padz = -xrdz(xrly); src.padSprint = xrsprint;\n' +
        '        padActive = true;\n' +
        '        return;\n' +
        '      }\n' +
        '    } catch(err) {}\n' +
        '  }\n' +
        '  const gp = getPad();'
    );

    // 6) helpers + enterVR + hands
    if (code.indexOf('enterSirenVR') < 0) {
      code = code.replace(
        '/* ------------------------------------------------------------------\n   MAIN LOOP & BOOT\n------------------------------------------------------------------ */',
        'window.__sirenXR = { baseRef: null, lastPx: NaN, lastPy: NaN, lastPz: NaN, hands: null };\n' +
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
          '    scene.position.set(0, 0, 0);\n' +
          '    if (camera && !camera.parent) try { scene.add(camera); } catch (e) {}\n' +
          '  } catch (e2) {\n' +
          '    scene.position.set(-px, -py, -pz);\n' +
          '    if (camera && camera.parent) camera.parent.remove(camera);\n' +
          '    xr.lastPx = px; xr.lastPy = py; xr.lastPz = pz;\n' +
          '  }\n' +
          '}\n' +
          'function __sirenMakeHand(side) {\n' +
          '  var g = new THREE.Group();\n' +
          '  var skin = new THREE.MeshStandardMaterial({ color: 0xc4a882, roughness: 0.4, metalness: 0.05 });\n' +
          '  var dark = new THREE.MeshStandardMaterial({ color: 0x2a2218, roughness: 0.9 });\n' +
          '  var palm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.09), skin);\n' +
          '  palm.position.set(0, 0, 0.02); g.add(palm);\n' +
          '  for (var i = 0; i < 4; i++) {\n' +
          '    var f = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.045), skin);\n' +
          '    f.position.set(-0.024 + i * 0.016, 0.005, 0.075); g.add(f);\n' +
          '  }\n' +
          '  var th = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.035), skin);\n' +
          '  th.position.set(side === "left" ? 0.04 : -0.04, 0.008, 0.02);\n' +
          '  th.rotation.y = side === "left" ? -0.6 : 0.6; g.add(th);\n' +
          '  var body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.08), dark);\n' +
          '  body.position.set(0, -0.025, -0.01); g.add(body);\n' +
          '  g.rotation.x = -0.4; return g;\n' +
          '}\n' +
          'function __sirenSetupHands() {\n' +
          '  try {\n' +
          '    if (window.__sirenXR.hands) return;\n' +
          '    var c0 = renderer.xr.getController(0);\n' +
          '    var c1 = renderer.xr.getController(1);\n' +
          '    var g0 = renderer.xr.getControllerGrip(0);\n' +
          '    var g1 = renderer.xr.getControllerGrip(1);\n' +
          '    scene.add(c0); scene.add(c1); scene.add(g0); scene.add(g1);\n' +
          '    var hL = __sirenMakeHand("left");\n' +
          '    var hR = __sirenMakeHand("right");\n' +
          '    (g0 || c0).add(hL); (g1 || c1).add(hR);\n' +
          '    window.__sirenXR.hands = { c0: c0, c1: c1, g0: g0, g1: g1, hL: hL, hR: hR };\n' +
          '  } catch (e) { console.warn("hands", e); }\n' +
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
          '    __sirenSetupHands();\n' +
          '    session.addEventListener("end", function () {\n' +
          '      window.__sirenXR.baseRef = null;\n' +
          '      window.__sirenXR.lastPx = window.__sirenXR.lastPy = window.__sirenXR.lastPz = NaN;\n' +
          '      try { scene.position.set(0, 0, 0); } catch (e) {}\n' +
          '      if (camera && !camera.parent) try { scene.add(camera); } catch (e) {}\n' +
          '    });\n' +
          "    if (typeof gameState !== 'undefined' && gameState === 'menu' && typeof startGame === 'function') {\n" +
          '      try { startGame(); } catch (e) {}\n' +
          '    }\n' +
          '    try { __sirenUpdateXROffset(); } catch (e) {}\n' +
          "  } catch (e) { alert('VR failed: ' + (e && e.message ? e.message : e)); }\n" +
          '};\n' +
          '/* ------------------------------------------------------------------\n   MAIN LOOP & BOOT\n------------------------------------------------------------------ */'
      );
    }

    // 7) frame RAF
    code = code.replace(
      'function frame(now) {\n  requestAnimationFrame(frame);',
      'function frame(now) {\n  if (!(renderer.xr && renderer.xr.isPresenting)) requestAnimationFrame(frame);'
    );

    // 8) XR offset each frame
    code = code.replace(
      "if (gameState === 'playing') {\n    updatePlayer(dt); applyCamera(dt); updateInteract(); updateMonster(dt);\n  } else if (gameState === 'cutscene') { Cut.update(dt); }\n  else if (gameState === 'dying') { Kill.update(dt); }",
      "if (gameState === 'playing') {\n" +
        '    updatePlayer(dt); applyCamera(dt); updateInteract(); updateMonster(dt);\n' +
        "  } else if (gameState === 'cutscene') { Cut.update(dt); }\n" +
        "  else if (gameState === 'dying') { Kill.update(dt); }\n" +
        '  try { if (renderer.xr && renderer.xr.isPresenting) __sirenUpdateXROffset(); } catch (e3) {}'
    );

    // 9) boot both loops
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
