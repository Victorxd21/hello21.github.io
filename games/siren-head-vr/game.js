/**
 * Siren Head VR
 * Loads the FULL original game from ../Siren Head/game.js
 * and applies only WebXR patches (does not reimplement gameplay).
 *
 * - Head-relative walk: player.yaw synced from headset BEFORE updatePlayer
 * - Hold left stick (click or push hard) to sprint
 * - Simple hand meshes on controllers
 * - XR local-floor origin tracks player.pos (spawn + walk)
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

    // 3) applyCamera: XR owns pose; still update flashlight + keep yaw in sync
    code = code.replace(
      'function applyCamera(dt) {\n  const p = player.pos;',
      'function applyCamera(dt) {\n' +
        '  if (renderer.xr && renderer.xr.isPresenting) {\n' +
        '    try { if (typeof __sirenSyncHead === "function") __sirenSyncHead(); } catch (eH) {}\n' +
        '    player.flashLevel += ((player.flashOn ? 1 : 0) - player.flashLevel) * (1 - Math.exp(-dt * 25));\n' +
        '    var flXR = player.flashLevel * 3.0;\n' +
        "    if (player.flashOn && typeof mon !== 'undefined' && mon.state !== 'cutscene' && mon.dist < 48)\n" +
        '      flXR *= (Math.random() < (1 - mon.dist / 48) * 0.35 ? 0.15 : 1);\n' +
        '    flashlight.intensity = flXR;\n' +
        '    return;\n' +
        '  }\n' +
        '  const p = player.pos;'
    );

    // 4) pollPad: XR controllers — walk + hold stick to sprint
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
        '          var xv = ax[2] !== undefined ? ax[2] : (ax[0]||0);\n' +
        '          var yv = ax[3] !== undefined ? ax[3] : (ax[1]||0);\n' +
        '          var isLeft = (srcX.handedness === "left") || (si === 0 && srcX.handedness !== "right");\n' +
        '          if (isLeft) {\n' +
        '            if (Math.abs(xv) > Math.abs(xrlx)) xrlx = xv;\n' +
        '            if (Math.abs(yv) > Math.abs(xrly)) xrly = yv;\n' +
        '            // sprint: stick click (btn 3), grip (btn 1), or stick pushed hard\n' +
        '            if (bt[3] && bt[3].pressed) xrsprint = true;\n' +
        '            if (bt[1] && (bt[1].pressed || bt[1].value > 0.5)) xrsprint = true;\n' +
        '            if (Math.hypot(xv, yv) > 0.88) xrsprint = true;\n' +
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
        '        function xrdz(v){ return Math.abs(v)<0.15?0:v; }\n' +
        '        src.padx = xrdz(xrlx); src.padz = -xrdz(xrly); src.padSprint = xrsprint;\n' +
        '        padActive = true;\n' +
        '        return;\n' +
        '      }\n' +
        '    } catch(err) {}\n' +
        '  }\n' +
        '  const gp = getPad();'
    );

    // 5) helpers: head sync (before move), ref-space offset, hands, enterVR
    if (code.indexOf('enterSirenVR') < 0) {
      code = code.replace(
        '/* ------------------------------------------------------------------\n   MAIN LOOP & BOOT\n------------------------------------------------------------------ */',
        'window.__sirenXR = { baseRef: null, lastPx: NaN, lastPy: NaN, lastPz: NaN, hands: null };\n' +
          'function __sirenSyncHead() {\n' +
          '  if (!(renderer.xr && renderer.xr.isPresenting)) return;\n' +
          '  try {\n' +
          '    var xrCam = renderer.xr.getCamera();\n' +
          '    if (!xrCam) return;\n' +
          '    // prefer world quaternion (ArrayCamera can be nested)\n' +
          '    var q = new THREE.Quaternion();\n' +
          '    if (xrCam.cameras && xrCam.cameras[0]) {\n' +
          '      xrCam.cameras[0].getWorldQuaternion(q);\n' +
          '    } else {\n' +
          '      xrCam.getWorldQuaternion(q);\n' +
          '    }\n' +
          "    var eul = new THREE.Euler().setFromQuaternion(q, 'YXZ');\n" +
          '    player.yaw = eul.y;\n' +
          '    player.pitch = eul.x;\n' +
          '  } catch (e) {}\n' +
          '}\n' +
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
          '  var skin = new THREE.MeshStandardMaterial({ color: 0xc4a882, roughness: 0.35, metalness: 0.05 });\n' +
          '  var dark = new THREE.MeshStandardMaterial({ color: 0x2a2218, roughness: 0.9 });\n' +
          '  // palm\n' +
          '  var palm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.09), skin);\n' +
          '  palm.position.set(0, 0, 0.02);\n' +
          '  g.add(palm);\n' +
          '  // fingers\n' +
          '  for (var i = 0; i < 4; i++) {\n' +
          '    var f = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.045), skin);\n' +
          '    f.position.set(-0.024 + i * 0.016, 0.005, 0.075);\n' +
          '    g.add(f);\n' +
          '  }\n' +
          '  // thumb\n' +
          '  var th = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.035), skin);\n' +
          '  th.position.set(side === "left" ? 0.04 : -0.04, 0.008, 0.02);\n' +
          '  th.rotation.y = side === "left" ? -0.6 : 0.6;\n' +
          '  g.add(th);\n' +
          '  // small controller body under palm\n' +
          '  var body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.08), dark);\n' +
          '  body.position.set(0, -0.025, -0.01);\n' +
          '  g.add(body);\n' +
          '  g.rotation.x = -0.4;\n' +
          '  return g;\n' +
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
          '    // attach to grips if available, else controllers\n' +
          '    (g0 || c0).add(hL);\n' +
          '    (g1 || c1).add(hR);\n' +
          '    window.__sirenXR.hands = { c0: c0, c1: c1, g0: g0, g1: g1, hL: hL, hR: hR };\n' +
          '  } catch (e) { console.warn("hands", e); }\n' +
          '}\n' +
          'window.enterSirenVR = async function enterVR() {\n' +
          "  if (!navigator.xr) { alert('WebXR not available'); return; }\n" +
          '  try {\n' +
          "    var session = await navigator.xr.requestSession('immersive-vr', {\n" +
          "      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']\n" +
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
          '    try { __sirenSyncHead(); } catch (e) {}\n' +
          "  } catch (e) { alert('VR failed: ' + (e && e.message ? e.message : e)); }\n" +
          '};\n' +
          '/* ------------------------------------------------------------------\n   MAIN LOOP & BOOT\n------------------------------------------------------------------ */'
      );
    }

    // 6) frame: no nested RAF while presenting
    code = code.replace(
      'function frame(now) {\n  requestAnimationFrame(frame);',
      'function frame(now) {\n  if (!(renderer.xr && renderer.xr.isPresenting)) requestAnimationFrame(frame);'
    );

    // 7) BEFORE movement: sync head yaw so walk follows look direction
    code = code.replace(
      "if (gameState === 'playing') {\n    updatePlayer(dt); applyCamera(dt); updateInteract(); updateMonster(dt);\n  } else if (gameState === 'cutscene') { Cut.update(dt); }\n  else if (gameState === 'dying') { Kill.update(dt); }",
      "if (gameState === 'playing') {\n" +
        '    try { if (renderer.xr && renderer.xr.isPresenting) __sirenSyncHead(); } catch (eH2) {}\n' +
        '    updatePlayer(dt); applyCamera(dt); updateInteract(); updateMonster(dt);\n' +
        "  } else if (gameState === 'cutscene') { Cut.update(dt); }\n" +
        "  else if (gameState === 'dying') { Kill.update(dt); }\n" +
        '  try { if (renderer.xr && renderer.xr.isPresenting) __sirenUpdateXROffset(); } catch (e3) {}'
    );

    // 8) boot RAF + setAnimationLoop
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
