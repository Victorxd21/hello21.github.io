/*! Game Hub - 3D Terminal & Infinite Void Unzoom */
(function(){
  let isUnzoomed = false;
  let isTransitioning = false;
  let scene, camera, renderer, animId;
  let particles, desksContainer;

  function loadThree(cb){
    if(window.THREE){ cb(); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    s.onload = cb;
    document.head.appendChild(s);
  }

  function init3DVoid(){
    const canvas = document.getElementById("voidCanvas3D");
    if(!canvas) return;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020208);
    scene.fog = new THREE.FogExp2(0x020208, 0.038);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 120);
    camera.position.set(0, 1.25, 3.2);
    camera.lookAt(0, 1.25, 0);

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const amb = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(amb);

    const dir = new THREE.DirectionalLight(0xa78bfa, 0.7);
    dir.position.set(4, 12, 6);
    scene.add(dir);

    // Infinite Neon Floor Grid
    const grid = new THREE.GridHelper(120, 60, 0xa78bfa, 0x141228);
    grid.position.y = 0;
    scene.add(grid);

    // Build One Duplicate Desk + Monitor unit
    const deskGroup = new THREE.Group();
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x0f0e1a, roughness: 0.5, metalness: 0.5 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x07060d, roughness: 0.8, metalness: 0.8 });

    // Tabletop
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 1.3), tableMat);
    top.position.y = 0.95;
    deskGroup.add(top);

    // Table Legs
    const legGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.95);
    [[-1.05,-0.55], [1.05,-0.55], [-1.05,0.55], [1.05,0.55]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, 0.475, lz);
      deskGroup.add(leg);
    });

    // Monitor chassis & glowing screen
    const monChassis = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.86, 0.06), new THREE.MeshStandardMaterial({ color: 0x090812 }));
    monChassis.position.set(0, 1.48, -0.15);
    deskGroup.add(monChassis);

    const monScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8), new THREE.MeshBasicMaterial({ color: 0x151226 }));
    monScreen.position.set(0, 1.48, -0.118);
    deskGroup.add(monScreen);

    // Monitor Stand
    const standNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2), legMat);
    standNeck.position.set(0, 1.05, -0.15);
    const standBase = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 0.25), legMat);
    standBase.position.set(0, 0.99, -0.15);
    deskGroup.add(standNeck);
    deskGroup.add(standBase);

    // Keyboard & Mouse
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.02, 0.2), new THREE.MeshStandardMaterial({ color: 0x171526 }));
    kb.position.set(0, 1.0, 0.2);
    const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.12), new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.2 }));
    mouse.position.set(0.45, 1.0, 0.2);
    deskGroup.add(kb);
    deskGroup.add(mouse);

    // Populate Endless Matrix Grid of Duplicate Desks (excluding the center user desk)
    desksContainer = new THREE.Group();
    const GRID_SIZE = 5;
    const SPACING = 3.6;
    for(let x = -GRID_SIZE; x <= GRID_SIZE; x++){
      for(let z = -GRID_SIZE; z <= GRID_SIZE; z++){
        if(x === 0 && z === 0) continue; // Skip center desk (that's where the real HTML sits)
        const clone = deskGroup.clone();
        clone.position.set(x * SPACING, 0, z * SPACING);
        desksContainer.add(clone);
      }
    }
    scene.add(desksContainer);

    // Ambient Cyber Dust Particles
    const pGeo = new THREE.BufferGeometry();
    const pCount = 600;
    const pPos = new Float32Array(pCount * 3);
    for(let i=0; i<pCount*3; i+=3){
      pPos[i] = (Math.random()-0.5)*50;
      pPos[i+1] = Math.random()*12;
      pPos[i+2] = (Math.random()-0.5)*50;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.06, transparent: true, opacity: 0.5 });
    particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    function loop(){
      animId = requestAnimationFrame(loop);
      if(particles) particles.rotation.y += 0.0004;
      renderer.render(scene, camera);
    }
    loop();
  }

  function triggerUnzoom(){
    if(isTransitioning || isUnzoomed) return;
    isTransitioning = true;

    const overlay = document.getElementById("matrixDimmer");
    const introText = document.getElementById("matrixIntroText");
    const desk = document.getElementById("mainDeskRig");
    const backBtn = document.getElementById("matrixBackBtn");

    // Step 1: Lower screen brightness (Dim atmospheric lighting)
    overlay.classList.add("dim");

    // Step 2: Show dramatic text "Take a look around you..."
    introText.classList.add("show");

    setTimeout(() => {
      // Step 3: Fade out text
      introText.classList.remove("show");

      setTimeout(() => {
        // Step 4: Camera unzooms (desk shrinks back into the void)
        desk.classList.add("unzoomed");
        overlay.classList.remove("dim"); // restore void lighting
        isUnzoomed = true;
        isTransitioning = false;
        backBtn.classList.add("show");
      }, 700);
    }, 2200);
  }

  function triggerZoomIn(){
    if(isTransitioning || !isUnzoomed) return;
    isTransitioning = true;

    const desk = document.getElementById("mainDeskRig");
    const backBtn = document.getElementById("matrixBackBtn");
    const overlay = document.getElementById("matrixDimmer");

    backBtn.classList.remove("show");
    desk.classList.remove("unzoomed");
    overlay.classList.remove("dim");

    setTimeout(() => {
      isUnzoomed = false;
      isTransitioning = false;
    }, 2200);
  }

  // Key Trigger: Backtick ( ` ) or Tilde ( ~ )
  addEventListener("keydown", e => {
    if(e.code === "Backquote" || e.key === "`" || e.key === "~"){
      if(e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      e.preventDefault();
      if(!isUnzoomed) triggerUnzoom();
      else triggerZoomIn();
    }else if(e.key === "Escape" && isUnzoomed){
      triggerZoomIn();
    }
  });

  const backBtn = document.getElementById("matrixBackBtn");
  if(backBtn) backBtn.addEventListener("click", triggerZoomIn);

  // Initialize Three.js 3D background void
  loadThree(init3DVoid);
})();
