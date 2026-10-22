/*! Game Hub - Seated Matrix Void (First-Person with Live HTML Screen) */
(function(){
  let isVoidActive = false;
  let scene, camera, renderer, animId;
  let audioCtx = null;

  // First-person look controls (Yaw & Pitch)
  let yaw = 0;
  let pitch = 0;
  let isDragging = false;
  let prevMouse = { x: 0, y: 0 };

  const css = `
#voidOverlay{
  position:fixed;
  inset:0;
  z-index:999999;
  background:#020206;
  opacity:0;
  pointer-events:none;
  transition:opacity 0.8s ease;
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
  font:900 clamp(24px,5vw,50px) system-ui,sans-serif;
  letter-spacing:0.2em;
  text-transform:uppercase;
  text-align:center;
  background:radial-gradient(circle,rgba(167,139,250,0.18) 0%,transparent 70%);
  text-shadow:0 0 30px rgba(167,139,250,0.9),0 0 60px rgba(34,211,238,0.6);
  opacity:0;
  transform:scale(0.94);
  transition:opacity 1.2s ease,transform 1.6s cubic-bezier(0.16,1,0.3,1);
  pointer-events:none;
  z-index:20;
}
#voidIntroText.on{opacity:1;transform:scale(1)}

#voidCanvas3D{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  z-index:1;
  cursor:grab;
}
#voidCanvas3D:active{cursor:grabbing}

/* Real Live HTML projected inside the monitor */
#liveScreenStage{
  position:absolute;
  top:50%;
  left:50%;
  width:880px;
  height:560px;
  margin-left:-440px;
  margin-top:-310px;
  z-index:5;
  background:#06060e;
  border-radius:10px;
  border:16px solid #100f1c;
  box-shadow:0 0 50px rgba(34,211,238,0.4),0 20px 40px rgba(0,0,0,0.9);
  overflow:hidden;
  transform-origin:center center;
  transition:transform 3.5s cubic-bezier(0.16,1,0.3,1),opacity 1s;
  pointer-events:auto;
}
#liveScreenStage iframe{
  width:100%;
  height:100%;
  border:none;
}

#voidExitBtn{
  position:absolute;
  top:20px;
  right:20px;
  z-index:30;
  padding:10px 20px;
  border-radius:999px;
  border:1px solid rgba(167,139,250,0.4);
  background:rgba(10,8,22,0.85);
  backdrop-filter:blur(14px);
  color:#f2f0ff;
  font:700 12px system-ui,sans-serif;
  letter-spacing:0.08em;
  text-transform:uppercase;
  cursor:pointer;
  box-shadow:0 0 20px rgba(167,139,250,0.3);
  transition:transform 0.25s,background 0.25s;
  display:none;
}
#voidExitBtn:hover{transform:scale(1.05);background:rgba(167,139,250,0.3)}

#voidHint{
  position:absolute;
  bottom:20px;
  left:50%;
  transform:translateX(-50%);
  color:rgba(255,255,255,0.45);
  font:600 11px system-ui,sans-serif;
  letter-spacing:0.12em;
  text-transform:uppercase;
  z-index:30;
  pointer-events:none;
  display:none;
}
`;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  const container = document.createElement("div");
  container.id = "voidOverlay";
  container.innerHTML = `
    <div id="voidIntroText">Take a look around you...</div>
    <div id="liveScreenStage">
      <iframe id="voidLiveFrame" src="about:blank"></iframe>
    </div>
    <canvas id="voidCanvas3D"></canvas>
    <button type="button" id="voidExitBtn">Return to Reality [Esc / \`]</button>
    <div id="voidHint">You are in your chair · Drag mouse to look around 360°</div>
  `;
  document.body.appendChild(container);

  const introText = document.getElementById("voidIntroText");
  const stage = document.getElementById("liveScreenStage");
  const iframe = document.getElementById("voidLiveFrame");
  const canvas = document.getElementById("voidCanvas3D");
  const exitBtn = document.getElementById("voidExitBtn");
  const hint = document.getElementById("voidHint");

  function playSpookyDrone(){
    try{
      if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const o1 = audioCtx.createOscillator();
      const o2 = audioCtx.createOscillator();
      const g = audioCtx.createGain();

      o1.type = "sawtooth";
      o1.frequency.setValueAtTime(55, audioCtx.currentTime);
      o1.frequency.exponentialRampToValueAtTime(32, audioCtx.currentTime + 5);

      o2.type = "sine";
      o2.frequency.setValueAtTime(110, audioCtx.currentTime);
      o2.frequency.exponentialRampToValueAtTime(64, audioCtx.currentTime + 5);

      g.gain.setValueAtTime(0.001, audioCtx.currentTime);
      g.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 1.5);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 7);

      o1.connect(g); o2.connect(g); g.connect(audioCtx.destination);
      o1.start(); o2.start();
      o1.stop(audioCtx.currentTime + 7); o2.stop(audioCtx.currentTime + 7);
    }catch(e){}
  }

  function loadThree(cb){
    if(window.THREE){ cb(); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    s.onload = cb;
    document.head.appendChild(s);
  }

  function init3D(){
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020208);
    scene.fog = new THREE.FogExp2(0x020208, 0.04);

    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    // Seated in the chair: eye level right in front of the desk
    camera.position.set(0, 1.35, 1.15);

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const amb = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(amb);

    const dir = new THREE.DirectionalLight(0xa78bfa, 0.8);
    dir.position.set(3, 10, 5);
    scene.add(dir);

    // Infinite Floor Grid
    const grid = new THREE.GridHelper(100, 50, 0xa78bfa, 0x141228);
    grid.position.y = 0;
    scene.add(grid);

    // Build Single Desk + PC Setup
    const deskGroup = new THREE.Group();
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x11101c, roughness: 0.4, metalness: 0.6 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x08070e, roughness: 0.7, metalness: 0.8 });

    // Tabletop
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.4), tableMat);
    top.position.y = 0.95;
    deskGroup.add(top);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.95);
    [[-1.1,-0.6], [1.1,-0.6], [-1.1,0.6], [1.1,0.6]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, 0.475, lz);
      deskGroup.add(leg);
    });

    // Keyboard & Mouse on table
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.02, 0.22), new THREE.MeshStandardMaterial({ color: 0x181628 }));
    kb.position.set(0, 1.0, 0.22);
    deskGroup.add(kb);

    const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.13), new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.3 }));
    mouse.position.set(0.48, 1.0, 0.22);
    deskGroup.add(mouse);

    // Monitor stand and chassis
    const standNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25), legMat);
    standNeck.position.set(0, 1.07, -0.15);
    const standBase = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.3), legMat);
    standBase.position.set(0, 0.99, -0.15);
    deskGroup.add(standNeck);
    deskGroup.add(standBase);

    // Monitor back casing
    const monChassis = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.96, 0.08), new THREE.MeshStandardMaterial({ color: 0x0b0a14 }));
    monChassis.position.set(0, 1.55, -0.18);
    deskGroup.add(monChassis);

    // Endless Grid of Desks & Computers in the Dark Void
    const desksContainer = new THREE.Group();
    const GRID_SIZE = 5;
    const SPACING = 3.8;
    for(let x = -GRID_SIZE; x <= GRID_SIZE; x++){
      for(let z = -GRID_SIZE; z <= GRID_SIZE; z++){
        const clone = deskGroup.clone();
        clone.position.set(x * SPACING, 0, z * SPACING);
        desksContainer.add(clone);
      }
    }
    scene.add(desksContainer);

    // Cyber Dust Floating Particles
    const pGeo = new THREE.BufferGeometry();
    const pCount = 700;
    const pPos = new Float32Array(pCount * 3);
    for(let i=0; i<pCount*3; i+=3){
      pPos[i] = (Math.random()-0.5)*50;
      pPos[i+1] = Math.random()*12;
      pPos[i+2] = (Math.random()-0.5)*50;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.06, transparent: true, opacity: 0.6 });
    const pPoints = new THREE.Points(pGeo, pMat);
    scene.add(pPoints);

    // First-Person Drag-to-Look Controls (Seated POV)
    canvas.addEventListener("mousedown", e => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    });
    addEventListener("mousemove", e => {
      if(!isDragging) return;
      const dx = (e.clientX - prevMouse.x) * 0.0035;
      const dy = (e.clientY - prevMouse.y) * 0.0035;
      prevMouse = { x: e.clientX, y: e.clientY };

      yaw -= dx;
      pitch = Math.max(-1.1, Math.min(1.1, pitch - dy));
    });
    addEventListener("mouseup", () => { isDragging = false; });

    addEventListener("resize", () => {
      if(!isVoidActive) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  function loop(){
    animId = requestAnimationFrame(loop);

    // Seated camera orientation: look around from chair
    const dir = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch)
    );
    const target = new THREE.Vector3().addVectors(camera.position, dir);
    camera.lookAt(target);

    // Synchronize the real live HTML monitor screen with seated head rotation!
    const lookFrontDist = Math.cos(yaw) * Math.cos(pitch);
    const screenRotY = (-yaw * 57.3);
    const screenRotX = (pitch * 57.3);

    // Hide or dim monitor if looking away
    if(lookFrontDist < 0.2){
      stage.style.opacity = "0";
    }else{
      stage.style.opacity = "1";
      if(!isPullingBack){
        stage.style.transform = `scale(0.38) rotateY(${screenRotY}deg) rotateX(${screenRotX}deg)`;
      }
    }

    renderer.render(scene, camera);
  }

  let isPullingBack = false;

  function enterVoid(){
    if(isVoidActive) return;
    isVoidActive = true;

    try{
      if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    }catch(e){}

    // Load actual live Game Hub into the 3D monitor screen
    iframe.src = location.href;

    // Start with the screen filling 100% of your monitor (seamless reality transition)
    stage.style.transform = "scale(1.0) rotateY(0deg) rotateX(0deg)";
    stage.style.opacity = "1";
    isPullingBack = true;

    container.classList.add("on");
    introText.classList.add("on");
    playSpookyDrone();

    loadThree(() => {
      if(!scene) init3D();

      yaw = 0;
      pitch = 0;
      camera.position.set(0, 1.35, 1.15);

      setTimeout(() => {
        introText.classList.remove("on");

        // The camera pulls back into your seated position: your screen shrinks into the desk monitor!
        setTimeout(() => {
          stage.style.transform = "scale(0.38) rotateY(0deg) rotateX(0deg)";
          loop();

          setTimeout(() => {
            isPullingBack = false;
            exitBtn.style.display = "block";
            hint.style.display = "block";
          }, 3500);
        }, 500);
      }, 2400);
    });
  }

  function exitVoid(){
    if(!isVoidActive) return;
    isVoidActive = false;

    if(document.fullscreenElement){
      try{ document.exitFullscreen(); }catch(e){}
    }

    container.classList.remove("on");
    exitBtn.style.display = "none";
    hint.style.display = "none";
    iframe.src = "about:blank";

    if(animId) cancelAnimationFrame(animId);
  }

  addEventListener("keydown", e => {
    if(e.code === "Backquote" || e.key === "`" || e.key === "~"){
      if(e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      e.preventDefault();
      if(!isVoidActive) enterVoid();
      else exitVoid();
    }else if(e.key === "Escape" && isVoidActive){
      exitVoid();
    }
  });

  exitBtn.addEventListener("click", exitVoid);
})();
