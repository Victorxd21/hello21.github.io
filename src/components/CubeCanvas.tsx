import React, { useEffect, useRef } from 'react';
import { Season } from '../types/game';

interface CubeCanvasProps {
  season: Season;
  enabled: boolean;
  onFlingRef?: React.MutableRefObject<(() => void) | null>;
}

interface Cube {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  color: string;
  isDragging?: boolean;
}

export const CubeCanvas: React.FC<CubeCanvasProps> = ({ season, enabled, onFlingRef }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const getPalette = (): string[] => {
      switch (season) {
        case 'halloween':
          return ['#ff8c42', '#9b30ff', '#ffb347', '#22c55e', '#ffffff'];
        case 'winter':
          return ['#93c5fd', '#60a5fa', '#e0f2fe', '#a5b4fc', '#ffffff'];
        case 'spring':
          return ['#86efac', '#4ade80', '#f9a8d4', '#a7f3d0', '#ffffff'];
        case 'summer':
          return ['#fbbf24', '#f59e0b', '#38bdf8', '#fb923c', '#ffffff'];
        case 'autumn':
          return ['#fb923c', '#ea580c', '#fbbf24', '#c2410c', '#ffffff'];
        case 'christmas':
          return ['#ef4444', '#22c55e', '#fbbf24', '#f87171', '#ffffff'];
        default:
          return ['#a78bfa', '#6366f1', '#22d3ee', '#f472b6', '#38bdf8', '#ffffff'];
      }
    };

    const palette = getPalette();
    const cubes: Cube[] = [];
    // Number of cubes based on screen width
    const cubeCount = Math.min(22, Math.max(12, Math.floor(width / 70)));

    for (let i = 0; i < cubeCount; i++) {
      const size = 26 + Math.random() * 24;
      cubes.push({
        x: Math.random() * width,
        y: Math.random() * height - height * 0.2, // Staggered initial heights
        size,
        vx: (Math.random() - 0.5) * 2,
        vy: 1 + Math.random() * 2.5,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.04,
        color: palette[i % palette.length]
      });
    }

    const GRAVITY = 0.16;
    const BOUNCE = 0.62;
    const FRICTION = 0.99;

    let dragCube: Cube | null = null;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let mouseVx = 0;
    let mouseVy = 0;

    const findCubeAt = (clientX: number, clientY: number): Cube | null => {
      for (let i = cubes.length - 1; i >= 0; i--) {
        const c = cubes[i];
        const half = c.size * 0.75; // slightly larger hit area for easy grabbing
        if (
          clientX >= c.x - half &&
          clientX <= c.x + half &&
          clientY >= c.y - half &&
          clientY <= c.y + half
        ) {
          return c;
        }
      }
      return null;
    };

    const handlePointerDown = (clientX: number, clientY: number) => {
      const hit = findCubeAt(clientX, clientY);
      if (hit) {
        dragCube = hit;
        hit.isDragging = true;
        hit.vx = 0;
        hit.vy = 0;
        lastMouseX = clientX;
        lastMouseY = clientY;
      }
    };

    const handlePointerMove = (clientX: number, clientY: number) => {
      mouseVx = clientX - lastMouseX;
      mouseVy = clientY - lastMouseY;
      lastMouseX = clientX;
      lastMouseY = clientY;

      if (dragCube) {
        dragCube.x = clientX;
        dragCube.y = clientY;
      }
    };

    const handlePointerUp = () => {
      if (dragCube) {
        dragCube.vx = Math.max(-20, Math.min(20, mouseVx * 0.8));
        dragCube.vy = Math.max(-20, Math.min(20, mouseVy * 0.8));
        dragCube.vr = (mouseVx + mouseVy) * 0.015;
        dragCube.isDragging = false;
        dragCube = null;
      }
    };

    // Mouse listeners
    const onMouseDown = (e: MouseEvent) => {
      // Only grab if clicking a cube; otherwise allow buttons and cards to work
      const hit = findCubeAt(e.clientX, e.clientY);
      if (hit) {
        handlePointerDown(e.clientX, e.clientY);
      }
    };
    const onMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX, e.clientY);
    const onMouseUp = () => handlePointerUp();

    // Touch listeners for mobile
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        const hit = findCubeAt(t.clientX, t.clientY);
        if (hit) {
          handlePointerDown(t.clientX, t.clientY);
        }
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (dragCube && e.touches.length > 0) {
        const t = e.touches[0];
        handlePointerMove(t.clientX, t.clientY);
      }
    };
    const onTouchEnd = () => handlePointerUp();

    window.addEventListener('mousedown', onMouseDown, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseup', onMouseUp, { passive: true });

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    const flingCubes = () => {
      cubes.forEach((c) => {
        c.vy = -10 - Math.random() * 14;
        c.vx = (Math.random() - 0.5) * 16;
        c.vr = (Math.random() - 0.5) * 0.25;
      });
    };

    if (onFlingRef) {
      onFlingRef.current = flingCubes;
    }

    const tick = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < cubes.length; i++) {
        const c = cubes[i];

        if (!c.isDragging) {
          c.vy += GRAVITY;
          c.vx *= FRICTION;
          c.vy *= FRICTION;
          c.vr *= 0.992;

          c.x += c.vx;
          c.y += c.vy;
          c.rot += c.vr;

          const r = c.size / 2;

          // Wall bounces
          if (c.x - r < 0) {
            c.x = r;
            c.vx = -c.vx * BOUNCE;
            c.vr += c.vy * 0.02;
          } else if (c.x + r > width) {
            c.x = width - r;
            c.vx = -c.vx * BOUNCE;
            c.vr -= c.vy * 0.02;
          }

          // When cubes fall past the bottom:
          // Either bounce or gently recycle back to the top for an infinite gravity fall
          if (c.y - r > height) {
            // Respawn above screen with random horizontal position
            c.y = -c.size - Math.random() * 60;
            c.x = Math.random() * width;
            c.vy = 1 + Math.random() * 2.5;
            c.vx = (Math.random() - 0.5) * 2;
            c.vr = (Math.random() - 0.5) * 0.04;
          } else if (c.y - r < -120) {
            c.vy = 1;
          }
        }

        // Cube-to-cube elastic collisions
        for (let j = i + 1; j < cubes.length; j++) {
          const b = cubes[j];
          const dx = b.x - c.x;
          const dy = b.y - c.y;
          const dist = Math.hypot(dx, dy);
          const minD = (c.size + b.size) * 0.5;

          if (dist > 0 && dist < minD) {
            const nx = dx / dist;
            const ny = dy / dist;
            const pen = minD - dist;
            const ma = c.size * c.size;
            const mb = b.size * b.size;
            const inv = 1 / (ma + mb);

            if (!c.isDragging) {
              c.x -= nx * pen * mb * inv;
              c.y -= ny * pen * mb * inv;
            }
            if (!b.isDragging) {
              b.x += nx * pen * ma * inv;
              b.y += ny * pen * ma * inv;
            }

            const rv = (b.vx - c.vx) * nx + (b.vy - c.vy) * ny;
            if (rv < 0) {
              const jn = (-(1 + BOUNCE) * rv) / (1 / ma + 1 / mb);
              if (!c.isDragging) {
                c.vx -= (jn * nx) / ma;
                c.vy -= (jn * ny) / ma;
                c.vr -= jn * 0.015;
              }
              if (!b.isDragging) {
                b.vx += (jn * nx) / mb;
                b.vy += (jn * ny) / mb;
                b.vr += jn * 0.015;
              }
            }
          }
        }

        // Render stylish glowing cube
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);

        ctx.shadowColor = c.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = c.color;
        ctx.globalAlpha = 0.55;

        const half = c.size / 2;
        const rad = 6;
        ctx.beginPath();
        ctx.roundRect(-half, -half, c.size, c.size, rad);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.restore();
      }

      animId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [season, enabled, onFlingRef]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      title="Gravity cubes tumbling in background"
    />
  );
};
