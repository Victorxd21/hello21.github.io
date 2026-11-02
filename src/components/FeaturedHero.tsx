import React, { useState, useEffect } from 'react';
import { Game } from '../types/game';
import { Play, Eye, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { playUiSound } from '../utils/audio';

interface FeaturedHeroProps {
  featuredGames: Game[];
  onSelectGame: (game: Game) => void;
  soundEnabled: boolean;
}

export const FeaturedHero: React.FC<FeaturedHeroProps> = ({
  featuredGames,
  onSelectGame,
  soundEnabled
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (featuredGames.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredGames.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [featuredGames.length]);

  if (featuredGames.length === 0) return null;

  const current = featuredGames[currentIndex] || featuredGames[0];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (soundEnabled) playUiSound('click');
    setCurrentIndex((prev) => (prev - 1 + featuredGames.length) % featuredGames.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (soundEnabled) playUiSound('click');
    setCurrentIndex((prev) => (prev + 1) % featuredGames.length);
  };

  return (
    <div
      onClick={() => {
        if (soundEnabled) playUiSound('pop');
        onSelectGame(current);
      }}
      className="relative w-full rounded-2xl overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 shadow-2xl cursor-pointer group transition-all duration-300 hover:border-cyan-500/50"
    >
      {/* Background Graphic & Banner */}
      <div className="absolute inset-0 z-0">
        {current.banner ? (
          <img
            src={current.banner}
            alt={current.name}
            className="w-full h-full object-cover opacity-35 group-hover:opacity-45 group-hover:scale-105 transition-all duration-700"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full bg-radial from-cyan-900/30 via-slate-900/60 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/40 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 sm:p-8 flex flex-col justify-end min-h-[220px] sm:min-h-[260px] max-w-2xl">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-[11px] font-bold text-cyan-300 uppercase tracking-wider backdrop-blur-md">
            <Sparkles className="w-3 h-3" />
            <span>Featured Game</span>
          </span>
          <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
            <Eye className="w-3 h-3 text-cyan-400" />
            <span>{current.views === 1 ? '1 play' : `${current.views} plays`}</span>
          </span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-md group-hover:text-cyan-300 transition-colors flex items-center gap-3">
          <span>{current.icon}</span>
          <span>{current.name}</span>
        </h2>

        <p className="mt-2 text-xs sm:text-sm text-slate-300 line-clamp-2 max-w-xl leading-relaxed">
          {current.description}
        </p>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            className="px-5 py-2.5 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-400 hover:from-cyan-300 hover:to-blue-300 shadow-lg shadow-cyan-500/20 flex items-center gap-2 text-xs sm:text-sm transition-all"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Play Now</span>
          </button>
          <span className="text-xs font-semibold text-slate-400 group-hover:text-white transition-colors">
            Click to explore →
          </span>
        </div>
      </div>

      {/* Slide Navigation Buttons */}
      {featuredGames.length > 1 && (
        <div className="absolute bottom-5 right-5 z-20 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrev}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-colors cursor-pointer"
            title="Previous Featured Game"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex gap-1 px-1">
            {featuredGames.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  currentIndex === i ? 'bg-cyan-400 w-4' : 'bg-slate-600'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleNext}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-colors cursor-pointer"
            title="Next Featured Game"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
