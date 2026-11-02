import React, { useState, useEffect, useMemo } from 'react';
import { Game } from '../types/game';
import {
  X,
  Play,
  ExternalLink,
  RotateCw,
  Maximize2,
  Minimize2,
  Eye,
  Gamepad2,
  Tag,
  ArrowLeft
} from 'lucide-react';
import { playUiSound } from '../utils/audio';

interface GameDetailModalProps {
  game: Game | null;
  onClose: () => void;
  onRecordPlay: (gameId: string) => void;
  soundEnabled: boolean;
}

export const GameDetailModal: React.FC<GameDetailModalProps> = ({
  game,
  onClose,
  onRecordPlay,
  soundEnabled
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    setIsPlaying(false);
    setIsFullscreen(false);
    setIframeKey(0);
  }, [game]);

  const relativeGamePath = game
    ? game.folder
      ? `games/${game.folder}/${game.file}`
      : `games/${game.file}`
    : '';

  let resolvedGameUrl = `./${relativeGamePath}`;
  if (typeof window !== 'undefined' && game) {
    try {
      let baseHref = window.location.href;
      const urlObj = new URL(baseHref);
      if (!urlObj.pathname.endsWith('/') && !urlObj.pathname.split('/').pop()?.includes('.')) {
        urlObj.pathname += '/';
        baseHref = urlObj.href;
      }
      resolvedGameUrl = new URL(relativeGamePath, baseHref).href;
    } catch {
      resolvedGameUrl = `./${relativeGamePath}`;
    }
  }

  if (!game) return null;

  const handleStartPlay = () => {
    if (soundEnabled) playUiSound('pop');
    onRecordPlay(game.id);
    setIsPlaying(true);
  };

  const handleOpenNewTab = () => {
    if (soundEnabled) playUiSound('click');
    onRecordPlay(game.id);
    window.open(resolvedGameUrl, '_blank', 'noopener,noreferrer');
  };

  const handleReload = () => {
    if (soundEnabled) playUiSound('click');
    setIframeKey((prev) => prev + 1);
  };

  const toggleFullscreen = () => {
    if (soundEnabled) playUiSound('click');
    setIsFullscreen((prev) => !prev);
  };

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPlaying) {
          if (soundEnabled) playUiSound('close');
          onClose();
        }
      }}
    >
      <div
        className={`relative w-full bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
          isPlaying
            ? isFullscreen
              ? 'h-full max-w-none rounded-none'
              : 'max-w-6xl h-[88vh]'
            : 'max-w-2xl max-h-[90vh]'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            {isPlaying && (
              <button
                onClick={() => setIsPlaying(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 text-xs"
                title="Back to Details"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Details</span>
              </button>
            )}
            <span className="text-xl shrink-0">{game.icon}</span>
            <div className="truncate">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">{game.name}</h3>
              <p className="text-[11px] text-slate-400 font-mono truncate">{relativeGamePath}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isPlaying && (
              <>
                <button
                  onClick={handleReload}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="Reload Game"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </>
            )}
            <button
              onClick={handleOpenNewTab}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Open in New Tab"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (soundEnabled) playUiSound('close');
                onClose();
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {isPlaying ? (
          <div className="flex-1 w-full h-full bg-black relative">
            <iframe
              key={iframeKey}
              src={resolvedGameUrl}
              title={game.name}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; cross-origin-isolated"
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Banner / Header Art */}
            {game.banner && (
              <div className="relative h-44 rounded-xl overflow-hidden bg-gradient-to-r from-blue-900/40 via-purple-900/40 to-slate-900 border border-slate-800">
                <img
                  src={game.banner}
                  alt={game.name}
                  className="w-full h-full object-cover opacity-60"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-900/90 border border-slate-700 flex items-center justify-center text-2xl shadow-lg">
                    {game.icon}
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      {game.tags[0] || 'Game'}
                    </span>
                    <h2 className="text-xl font-extrabold text-white">{game.name}</h2>
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">About This Game</h4>
              <p className="text-sm text-slate-200 leading-relaxed">{game.description}</p>
            </div>

            {/* Controls Guide */}
            {game.controls && (
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  <Gamepad2 className="w-4 h-4" />
                  <span>Controls & How to Play</span>
                </div>
                <p className="text-xs text-slate-300 font-mono leading-relaxed">{game.controls}</p>
              </div>
            )}

            {/* Photos & Screenshots Gallery */}
            {game.photos && game.photos.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Screenshots & Media</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {game.photos.map((src, i) => (
                    <div
                      key={i}
                      className="h-28 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 group relative cursor-pointer"
                      onClick={() => window.open(src, '_blank')}
                    >
                      <img
                        src={src}
                        alt={`Screenshot ${i + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags and Stats */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Tag className="w-3.5 h-3.5 text-slate-500" />
                {game.tags.map((t) => (
                  <span key={t} className="px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300 capitalize">
                    {t}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1 font-mono text-cyan-400">
                <Eye className="w-3.5 h-3.5" />
                <span>{game.views === 1 ? '1 play' : `${game.views} plays`}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleStartPlay}
                className="flex-1 py-3 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Play in Hub</span>
              </button>
              <button
                onClick={handleOpenNewTab}
                className="py-3 px-6 rounded-xl font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in Tab</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
