import React, { useEffect, useState } from 'react';

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotSpeed: number;
  opacity: number;
}

interface ConfettiProps {
  triggerTimestamp: number | null;
  originX?: number;
  originY?: number;
}

export const Confetti: React.FC<ConfettiProps> = ({ triggerTimestamp, originX, originY }) => {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (!triggerTimestamp) return;

    const startX = originX ?? window.innerWidth / 2;
    const startY = originY ?? window.innerHeight / 2;
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

    const newPieces: ConfettiPiece[] = Array.from({ length: 45 }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 8;
      return {
        id: Date.now() + i,
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 6 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 12,
        opacity: 1
      };
    });

    setPieces(newPieces);

    let current = newPieces;
    let animId: number;

    const update = () => {
      current = current
        .map((p) => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.22,
          rotation: p.rotation + p.rotSpeed,
          opacity: p.opacity - 0.016
        }))
        .filter((p) => p.opacity > 0);

      setPieces([...current]);

      if (current.length > 0) {
        animId = requestAnimationFrame(update);
      }
    };

    animId = requestAnimationFrame(update);

    return () => cancelAnimationFrame(animId);
  }, [triggerTimestamp, originX, originY]);

  if (pieces.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[900] overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            transform: `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rotation}deg)`,
            width: `${p.size}px`,
            height: `${p.size * 0.6}px`,
            backgroundColor: p.color,
            opacity: p.opacity,
            borderRadius: '2px',
            boxShadow: `0 0 6px ${p.color}`
          }}
        />
      ))}
    </div>
  );
};
