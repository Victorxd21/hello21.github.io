import React, { useMemo } from 'react';
import { Season, TimeOfDay } from '../types/game';

interface SeasonWeatherFXProps {
  season: Season;
  timeOfDay: TimeOfDay;
  enabled: boolean;
}

export const SeasonWeatherFX: React.FC<SeasonWeatherFXProps> = ({ season, timeOfDay, enabled }) => {
  const isNight = timeOfDay === 'night';
  const isSunset = timeOfDay === 'sunset';

  const particles = useMemo(() => {
    if (!enabled) return [];
    const count =
      season === 'winter' || season === 'christmas'
        ? 32
        : season === 'autumn' || season === 'halloween'
        ? 24
        : season === 'spring'
        ? 20
        : season === 'summer'
        ? 18
        : 14;

    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 90,
      delay: -(Math.random() * 16),
      duration: 6 + Math.random() * 9,
      size: 4 + Math.random() * 8,
      hue: Math.floor(15 + Math.random() * 35),
      isBat: i % 4 === 0
    }));
  }, [season, enabled]);

  if (!enabled) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {particles.map((p) => {
        if (season === 'winter' || season === 'christmas') {
          return (
            <div
              key={p.id}
              className="absolute rounded-full bg-white/70 shadow-sm animate-fall"
              style={{
                left: `${p.left}%`,
                top: `-20px`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                filter: 'blur(0.5px)'
              }}
            />
          );
        }

        if (season === 'autumn') {
          return (
            <div
              key={p.id}
              className="absolute rounded-tl-xl rounded-br-xl animate-fall-sway"
              style={{
                left: `${p.left}%`,
                top: `-20px`,
                width: `${p.size * 1.4}px`,
                height: `${p.size * 1.4}px`,
                background: `hsl(${p.hue} 85% ${isNight ? '35%' : '52%'})`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration * 1.2}s`,
                opacity: 0.85
              }}
            />
          );
        }

        if (season === 'spring') {
          return (
            <div
              key={p.id}
              className="absolute rounded-full bg-pink-300/80 animate-fall-sway shadow-pink-500/20"
              style={{
                left: `${p.left}%`,
                top: `-20px`,
                width: `${p.size}px`,
                height: `${p.size * 1.2}px`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration * 1.1}s`
              }}
            />
          );
        }

        if (season === 'summer') {
          if (isNight || isSunset) {
            return (
              <div
                key={p.id}
                className="absolute w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_10px_#fde047] animate-pulse"
                style={{
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${2 + Math.random() * 3}s`
                }}
              />
            );
          }
          return (
            <div
              key={p.id}
              className="absolute w-1 rounded bg-amber-200/20"
              style={{
                left: `${p.left}%`,
                top: `${p.top * 0.5}%`,
                height: `${50 + Math.random() * 60}px`,
                animationDelay: `${p.delay}s`
              }}
            />
          );
        }

        if (season === 'halloween') {
          if (p.isBat) {
            return (
              <div
                key={p.id}
                className="absolute text-lg select-none animate-float-bat opacity-70"
                style={{
                  top: `${15 + (p.id * 12) % 60}%`,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.duration * 1.5}s`
                }}
              >
                🦇
              </div>
            );
          }
          return (
            <div
              key={p.id}
              className="absolute w-1.5 h-1.5 rounded-full bg-purple-300/60 shadow-[0_0_8px_#c084fc] animate-pulse"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${3 + Math.random() * 2}s`
              }}
            />
          );
        }

        // Default: twinkling stars
        return (
          <div
            key={p.id}
            className="absolute w-1.5 h-1.5 rounded-full bg-cyan-200/60 shadow-[0_0_6px_#67e8f9] animate-pulse"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${2 + (p.id % 4)}s`
            }}
          />
        );
      })}
    </div>
  );
};
