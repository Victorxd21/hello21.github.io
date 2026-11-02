import React, { useEffect, useRef } from 'react';

interface CursorTrailProps {
  enabled: boolean;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  color: string;
}

export const CursorTrail: React.FC<CursorTrailProps> = ({ enabled }) => {
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

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const particles: Particle[] = [];
    const colors = ['#a78bfa', '#6366f1', '#22d3ee', '#f472b6', '#38bdf8'];

    const onMouseMove = (e: MouseEvent) => {
      for (let i = 0; i < 2; i++) {
        particles.push({
          x: e.clientX + (Math.random() - 0.5) * 8,
          y: e.clientY + (Math.random() - 0.5) * 8,
          size: 4 + Math.random() * 4,
          opacity: 0.8,
          color: colors[Math.floor(Math.random() * colors.length)]
        });
      }
      if (particles.length > 50) {
        particles.splice(0, particles.length - 50);
      }
    };
    window.addEventListener('mousemove', onMouseMove);

    const tick = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.opacity -= 0.025;
        p.size *= 0.96;

        if (p.opacity <= 0 || p.size <= 0.5) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [enabled]);

  if (!enabled) return null;

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[800]" />;
};
