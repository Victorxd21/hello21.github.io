/*! Game Hub - Infinite Void Easter Egg (Matrix Mode) */
(function(){
  let isVoidActive = false;
  let threeLoaded = false;
  let scene, camera, renderer, animationFrameId;
  let desksGroup, particles;
  let audioCtx = null;
  let lookTarget = { x: 0, y: 0 };
  let currentLook = { x: 0, y: 0 };
  let isDragging = false;
  let prevMouse = { x: 0, y: 0 };
  let camRadius = 7.5;
  let camTheta = Math.PI / 2; // Horizontal angle
  let camPhi = 0.35;          // Vertical angle

  // Inject styles for overlay & text
  const css = `
#voidOverlay{
  position:fixed;
  inset:0;
  z-index:999999;
  background:#04030a;
  opacity:0;
  pointer-events:none;
  transition:opacity 1.2s ease;
  overflow:hidden;
}
#voidOverlay.on{
  opacity:1;
  pointer-events:auto;
}
#voidIntroText{
  position:absolute;
  inset:0;
  display:flex;
  align-items:center;
  justify-content:center;
  color:#f2f0ff;
  font:900 clamp(28px,6vw,56px) system-ui,sans-serif;
  letter-spacing:0.18em;
  text-transform:uppercase;
  text-align:center;
  padding:20px;
  background:radial-gradient(circle,rgba(167,139,250,0.15) 0%,transparent 70%);
  text-shadow:0 0 30px rgba(167,139,250,0.8),0 0 60px rgba(34,211,238,0.5);
  opacity:0;
  transform:scale(0.92);
  transition:opacity 1.4s ease,transform 1.8s cubic-bezier(0.16,1,0.3,1);
  pointer-events:none;
  z-index:2;
}
#voidIntroText.on{
  opacity:1;
  transform:scale(1);
}
#voidCanvas{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  cursor:grab;
}
#voidCanvas:active{
  cursor:grabbing;
}
#voidExitBtn{
  position:absolute;
  top:24px;
  right:24px;
  z-index:10;
  padding:10px 20px;
  border-radius:999px;
  border:1px solid rgba(167,139,250,0.4);
  background:rgba(10,8,20,0.7);
  backdrop-filter:blur(12px);
  color:#f2f0ff;
  font:700 12px system-ui,sans-serif;
  letter-spacing:0.08em;
  text-transform:uppercase;
  cursor:pointer;
  box-shadow:0 0 20px rgba(167,139,250,0.3);
  transition:transform 0.25s,background 0.25s;
  display:none;
}
#voidExitBtn:hover{
  transform:scale(1.06);
  background:rgba(167,139,250,0.25);
}
#voidHint{
  position:absolute;
  bottom:24px;
  left:50%;
  transform:translateX(-50%);
  color:rgba(255,255,255,0.4);
  font:600 12px system-ui,sans-serif;
  letter-spacing:0.1em;
  text-transform:uppercase;
  pointer-events:none;
  display:none;
}
`;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  // Inject DOM elements
  const container = document.createElement("div");
  container.id = "voidOverlay";
  container.innerHTML = `
    <div id="voidIntroText">Take a look around you...</div>
    <canvas id="voidCanvas"></canvas>
    <button type="button" id="voidExitBtn">Return to Reality [Esc / \`]</button>
    <div id="voidHint">Drag with mouse to look around</div>
  `;
  document.body.appendChild(container);

  const introText = document.getElementById("voidIntroText");
  const canvas = document.getElementById("voidCanvas");
  const exitBtn = document.getElementById("voidExitBtn");
  const hintText = document.getElementById("voidHint");

  function playSpookyDrone(){
    try{
      if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(55, audioCtx.currentTime); // A1 note
      osc1.frequency.exponentialRampToValueAtTime(36, audioCtx.currentTime + 6);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(110, audioCtx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(72, audioCtx.currentTime + 6);

      gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 2);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioCtx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(audioCtx.currentTime + 8);
      osc2.stop(audioCtx.currentTime + 8);
    }catch(e){}
  }

  function loadThreeJS(cb){
    if(window.THREE){ cb(); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    s.onload = () => { threeLoaded = true; cb(); };
    document.head.appendChild(s);
  }

  // Generate Hub Screen texture for the 3D computer
  function createScreenTexture(){
    const sc = document.createElement("canvas");
    sc.width = 512;
    sc.height = 340;
    const sctx = sc.getContext("2d");

    // Cyberpunk Hub Screen simulation
    sctx.fillStyle = "#06060e";
    sctx.fillRect(0,0,512,340);

    const grad = sctx.createLinearGradient(0,0,512,0);
    grad.addColorStop(0,"#a78bfa");
    grad.addColorStop(0.5,"#22d3ee");
    grad.addColorStop(1,"#f472b6");
    sctx.fillStyle = grad;
    sctx.font = "900 36px system-ui";
    sctx.textAlign = "center";
    sctx.fillText("GAME HUB", 256, 70);

    sctx.fillStyle = "#8b87a8";
    sctx.font = "600 14px system-ui";
    sctx.fillText("Pick a game and play", 256, 100);

    // Mock Game Cards
    for(let r=0; r<2; r++){
      for(let c=0; c<3; c++){
        const x = 50 + c * 145;
        const y = 130 + r * 90;
        sctx.fillStyle = "rgba(255,255,255,0.06)";
        sctx.fillRect(x, y, 125, 75);
        sctx.strokeStyle = "rgba(167,139,250,0.4)";
        sctx.lineWidth = 1.5;
        sctx.strokeRect(x, y, 125, 75);

        sctx.fillStyle = c%2===0 ? "#a78bfa" : "#22d3ee";
        sctx.font = "24px system-ui";
        sctx.fillText(c%2===0?"🎮":"🚀", x+24, y+35);

        sctx.fillStyle = "#fff";
        sctx.font = "700 12px system-ui";
        sctx.textAlign = "left";
        sctx.fillText("Game "+(r*3+c+1), x+48, y+32);
      }
    }

    const tex = new THREE.CanvasTexture(sc);
    tex.anisotropy = 4;
    return tex;
  }

  function init3DScene(){
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030208);
    scene.fog = new THREE.FogExp2(0x030208, 0.04);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xa78bfa, 0.8);
    dirLight.position.set(5, 12, 7);
    scene.add(dirLight);

    // Center monitor glow light
    const centerGlow = new THREE.PointLight(0x22d3ee, 2.5, 8);
    centerGlow.position.set(0, 1.4, 0.5);
    scene.add(centerGlow);

    // Infinite Floor Grid
    const grid = new THREE.GridHelper(120, 60, 0xa78bfa, 0x1f1a3a);
    grid.position.y = 0;
    scene.add(grid);

    // Build Single Desk + Computer Setup
    const deskGroup = new THREE.Group();
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x11101a, roughness: 0.4, metalness: 0.6 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x08070d, roughness: 0.7, metalness: 0.8 });

    // Tabletop
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.4), tableMat);
    tableTop.position.y = 0.95;
    deskGroup.add(tableTop);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.95);
    [[-1.1,-0.6], [1.1,-0.6], [-1.1,0.6], [1.1,0.6]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, 0.475, lz);
      deskGroup.add(leg);
    });

    // Computer Monitor
    const monBezel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 0.06), new THREE.MeshStandardMaterial({ color: 0x0a0914, metalness: 0.7, roughness: 0.3 }));
    monBezel.position.set(0, 1.5, -0.15);
    deskGroup.add(monBezel);

    // Screen with Hub texture
    const screenMat = new THREE.MeshBasicMaterial({ map: createScreenTexture() });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 0.77), screenMat);
    screen.position.set(0, 1.5, -0.118);
    deskGroup.add(screen);

    // Monitor Stand
    const standNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25), legMat);
    standNeck.position.set(0, 1.07, -0.15);
    const standBase = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.3), legMat);
    standBase.position.set(0, 0.99, -0.15);
    deskGroup.add(standNeck);
    deskGroup.add(standBase);

    // Keyboard & Mouse
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.22), new THREE.MeshStandardMaterial({ color: 0x1a1829 }));
    kb.position.set(0, 1.0, 0.2);
    const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.025, 0.14), new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.2 }));
    mouse.position.set(0.48, 1.0, 0.2);
    deskGroup.add(kb);
    deskGroup.add(mouse);

    // Replicate Desks into an Endless Matrix Grid
    desksGroup = new THREE.Group();
    const GRID_SIZE = 5; // 11x11 = 121 desks & computers!
    const SPACING = 4.0;
    for(let x = -GRID_SIZE; x <= GRID_SIZE; x++){
      for(let z = -GRID_SIZE; z <= GRID_SIZE; z++){
        const clone = deskGroup.clone();
        clone.position.set(x * SPACING, 0, z * SPACING);
        desksGroup.add(clone);
      }
    }
    scene.add(desksGroup);

    // Ambient Cyber Floating Particles
    const pGeo = new THREE.BufferGeometry();
    const pCount = 800;
    const pPositions = new Float32Array(pCount * 3);
    for(let i=0; i<pCount*3; i+=3){
      pPositions[i] = (Math.random()-0.5)*60;
      pPositions[i+1] = Math.random()*15;
      pPositions[i+2] = (Math.random()-0.5)*60;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({ color: 0x22d3ee, size: 0.07, transparent: true, opacity: 0.7 });
    particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // Handle Window Resize
    addEventListener("resize", () => {
      if(!isVoidActive) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Mouse Drag Rotation
    canvas.addEventListener("mousedown", e => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    });
    addEventListener("mousemove", e => {
      if(!isDragging) return;
      const dx = (e.clientX - prevMouse.x) * 0.005;
      const dy = (e.clientY - prevMouse.y) * 0.005;
      prevMouse = { x: e.clientX, y: e.clientY };

      camTheta -= dx;
      camPhi = Math.max(0.05, Math.min(Math.PI / 2.1, camPhi + dy));
    });
    addEventListener("mouseup", () => { isDragging = false; });

    // Touch controls for mobile/tablet
    canvas.addEventListener("touchstart", e => {
      if(e.touches.length === 1){
        isDragging = true;
        prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }, { passive: true });
    addEventListener("touchmove", e => {
      if(!isDragging || e.touches.length !== 1) return;
      const dx = (e.touches[0].clientX - prevMouse.x) * 0.006;
      const dy = (e.touches[0].clientY - prevMouse.y) * 0.006;
      prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      camTheta -= dx;
      camPhi = Math.max(0.05, Math.min(Math.PI / 2.1, camPhi + dy));
    }, { passive: true });
    addEventListener("touchend", () => { isDragging = false; });
  }

  // Cinematic Camera Zoom Animation
  let animStartTime = 0;
  let isZoomingOut = false;

  function animate(now){
    animationFrameId = requestAnimationFrame(animate);

    if(particles){
      particles.rotation.y += 0.0006;
    }

    if(isZoomingOut){
      const elapsed = (now - animStartTime) / 1000;
      const progress = Math.min(1, elapsed / 4.2);
      // Smooth ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      // Camera starts right against the monitor glass (FOV zoom), pulls back into 3D world
      const startPos = new THREE.Vector3(0, 1.5, 0.25);
      const targetPos = new THREE.Vector3(
        camRadius * Math.sin(camTheta) * Math.cos(camPhi),
        1.5 + camRadius * Math.sin(camPhi),
        camRadius * Math.cos(camTheta) * Math.cos(camPhi)
      );

      camera.position.lerpVectors(startPos, targetPos, ease);
      camera.lookAt(0, 1.25, 0);

      if(progress >= 1){
        isZoomingOut = false;
        exitBtn.style.display = "block";
        hintText.style.display = "block";
      }
    }else{
      // Free orbital camera based on user mouse drag
      camera.position.x = camRadius * Math.sin(camTheta) * Math.cos(camPhi);
      camera.position.y = 1.25 + camRadius * Math.sin(camPhi);
      camera.position.z = camRadius * Math.cos(camTheta) * Math.cos(camPhi);
      camera.lookAt(0, 1.25, 0);
    }

    renderer.render(scene, camera);
  }

  function enterVoidMode(){
    if(isVoidActive) return;
    isVoidActive = true;

    // Request fullscreen
    try{
      if(document.documentElement.requestFullscreen){
        document.documentElement.requestFullscreen();
      }
    }catch(e){}

    const overlay = document.getElementById("voidOverlay");
    overlay.classList.add("on");

    introText.classList.add("on");
    playSpookyDrone();

    loadThreeJS(() => {
      if(!scene) init3DScene();

      // Reset camera orientation
      camTheta = Math.PI / 2;
      camPhi = 0.35;
      camRadius = 7.5;
      camera.position.set(0, 1.5, 0.25);
      camera.lookAt(0, 1.5, -0.15);

      // Fade out intro text after 2.6s, then start cinematic camera pull-back
      setTimeout(() => {
        introText.classList.remove("on");
        setTimeout(() => {
          isZoomingOut = true;
          animStartTime = performance.now();
          animate(animStartTime);
        }, 600);
      }, 2600);
    });
  }

  function exitVoidMode(){
    if(!isVoidActive) return;
    isVoidActive = false;

    if(document.fullscreenElement){
      try{ document.exitFullscreen(); }catch(e){}
    }

    const overlay = document.getElementById("voidOverlay");
    overlay.classList.remove("on");
    exitBtn.style.display = "none";
    hintText.style.display = "none";

    if(animationFrameId){
      cancelAnimationFrame(animationFrameId);
    }
  }

  // Key Trigger: Backtick ( ` ) or Tilde ( ~ )
  addEventListener("keydown", e => {
    if(e.code === "Backquote" || e.key === "`" || e.key === "~"){
      if(e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      e.preventDefault();
      if(!isVoidActive) enterVoidMode();
      else exitVoidMode();
    }else if(e.key === "Escape" && isVoidActive){
      exitVoidMode();
    }
  });

  exitBtn.addEventListener("click", exitVoidMode);
})();
