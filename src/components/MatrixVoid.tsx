import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Terminal, X, CornerDownLeft } from 'lucide-react';

interface MatrixVoidProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MatrixVoid: React.FC<MatrixVoidProps> = ({ isOpen, onClose }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const container = mountRef.current;
    if (!container) return;

    let animId: number;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020208);
    scene.fog = new THREE.FogExp2(0x020208, 0.035);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 150);
    camera.position.set(0, 1.35, 3.8);
    camera.lookAt(0, 1.25, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const amb = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(amb);

    const dir = new THREE.DirectionalLight(0xa78bfa, 0.85);
    dir.position.set(4, 12, 6);
    scene.add(dir);

    // Neon Floor Grid
    const grid = new THREE.GridHelper(120, 60, 0xa78bfa, 0x141228);
    grid.position.y = 0;
    scene.add(grid);

    // Desk unit
    const deskGroup = new THREE.Group();
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x0f0e1a, roughness: 0.5, metalness: 0.5 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x07060d, roughness: 0.8, metalness: 0.8 });

    // Tabletop
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.3), tableMat);
    top.position.y = 0.95;
    deskGroup.add(top);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.95);
    [[-1.05, -0.55], [1.05, -0.55], [-1.05, 0.55], [1.05, 0.55]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, 0.475, lz);
      deskGroup.add(leg);
    });

    // Monitor
    const monBody = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.65, 0.08), tableMat);
    monBody.position.set(0, 1.45, -0.15);
    deskGroup.add(monBody);

    // Monitor screen canvas with matrix rain
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 512;
    screenCanvas.height = 320;
    const sCtx = screenCanvas.getContext('2d');
    const screenTex = new THREE.CanvasTexture(screenCanvas);
    const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
    const monScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.58), screenMat);
    monScreen.position.set(0, 1.45, -0.1);
    deskGroup.add(monScreen);

    // Monitor Stand
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4), legMat);
    stand.position.set(0, 1.15, -0.15);
    deskGroup.add(stand);

    // Keyboard
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.22), tableMat);
    kb.position.set(0, 1.0, 0.25);
    deskGroup.add(kb);

    scene.add(deskGroup);

    // Matrix particles
    const particleCount = 400;
    const pGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0x22d3ee, size: 0.12, transparent: true, opacity: 0.75 });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // Matrix rain loop on CRT screen
    const drops = Array.from({ length: 32 }, () => Math.floor(Math.random() * 20));
    let lastMatrixTime = 0;

    const renderMatrixScreen = (time: number) => {
      if (!sCtx) return;
      if (time - lastMatrixTime > 50) {
        lastMatrixTime = time;
        sCtx.fillStyle = 'rgba(2, 4, 10, 0.25)';
        sCtx.fillRect(0, 0, screenCanvas.width, screenCanvas.height);

        sCtx.fillStyle = '#22d3ee';
        sCtx.font = '14px monospace';

        for (let i = 0; i < drops.length; i++) {
          const char = String.fromCharCode(0x30a0 + Math.floor(Math.random() * 96));
          sCtx.fillText(char, i * 16, drops[i] * 16);
          if (drops[i] * 16 > screenCanvas.height && Math.random() > 0.96) {
            drops[i] = 0;
          }
          drops[i]++;
        }
        screenTex.needsUpdate = true;
      }
    };

    let targetZ = 3.8;
    const handleWheel = (e: WheelEvent) => {
      targetZ = Math.max(1.5, Math.min(18, targetZ + e.deltaY * 0.005));
    };
    window.addEventListener('wheel', handleWheel);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    const animate = (time: number) => {
      animId = requestAnimationFrame(animate);

      // Camera smooth zoom & gentle sway
      camera.position.z += (targetZ - camera.position.z) * 0.05;
      camera.position.x = Math.sin(time * 0.0005) * 0.3;

      // Float particles
      const pArr = pGeo.attributes.position.array as Float32Array;
      for (let i = 1; i < pArr.length; i += 3) {
        pArr[i] -= 0.04;
        if (pArr[i] < 0) pArr[i] = 20;
      }
      pGeo.attributes.position.needsUpdate = true;

      renderMatrixScreen(time);
      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', onResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black text-slate-100 flex flex-col animate-fadeIn select-none">
      {/* 3D Scene Viewport */}
      <div ref={mountRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />

      {/* Top HUD */}
      <header className="relative z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-md">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wider text-cyan-300">MATRIX VOID TERMINAL</h1>
            <p className="text-xs text-slate-400 font-mono">3D Infinite Architecture Room</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs font-mono text-slate-500 bg-slate-900/80 px-2 py-1 rounded border border-slate-800">
            Scroll to Zoom · Press ` or Esc to exit
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-all flex items-center gap-1.5 text-xs font-semibold"
          >
            <X className="w-4 h-4" />
            <span>Return to Hub</span>
          </button>
        </div>
      </header>

      {/* Center Prompt */}
      <div className="relative z-10 mt-auto mb-12 self-center text-center pointer-events-none">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-950/80 border border-cyan-500/30 backdrop-blur-md shadow-lg text-xs font-mono text-cyan-300">
          <CornerDownLeft className="w-3.5 h-3.5 text-cyan-400" />
          <span>Press backtick (`) or click Return to Hub anytime</span>
        </div>
      </div>
    </div>
  );
};
