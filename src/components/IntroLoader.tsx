import React, { useEffect, useState } from 'react';

interface IntroLoaderProps {
  onComplete: () => void;
  targetRect?: DOMRect | null;
}

export const IntroLoader: React.FC<IntroLoaderProps> = ({ onComplete, targetRect }) => {
  const [phase, setPhase] = useState<'loading' | 'transitioning' | 'done'>('loading');
  const [dotCount, setDotCount] = useState(1);
  const [progress, setProgress] = useState(0);

  // Animated dots
  useEffect(() => {
    if (phase !== 'loading') return;
    const dotInterval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 380);
    return () => clearInterval(dotInterval);
  }, [phase]);

  // Loading progress & completion trigger
  useEffect(() => {
    const startTime = performance.now();
    const duration = 1400; // 1.4s comfortable load time

    const updateProgress = (now: number) => {
      const elapsed = now - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);

      if (pct < 100) {
        requestAnimationFrame(updateProgress);
      } else {
        // Switch to slow, graceful transition
        setPhase('transitioning');
        setTimeout(() => {
          setPhase('done');
          onComplete();
        }, 1150); // slow 1.15s smooth glide
      }
    };

    const id = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(id);
  }, [onComplete]);

  if (phase === 'done') return null;

  // Calculate destination transform if targetRect is available
  let transformStyle: React.CSSProperties = {};
  if (phase === 'transitioning' && targetRect) {
    const startX = window.innerWidth / 2;
    const startY = window.innerHeight / 2 - 16;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    const deltaX = targetCenterX - startX;
    const deltaY = targetCenterY - startY;

    transformStyle = {
      transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${Math.max(0.68, targetRect.height / 60)})`,
      transition: 'transform 1.15s cubic-bezier(0.16, 1, 0.3, 1), opacity 1.15s ease',
      transformOrigin: 'center center'
    };
  }

  return (
    <div
      className={`fixed inset-0 z-[700] flex flex-col items-center justify-center transition-all duration-1000 ${
        phase === 'transitioning'
          ? 'bg-slate-950/0 backdrop-blur-none pointer-events-none'
          : 'bg-slate-950 backdrop-blur-md'
      }`}
    >
      {/* Background ambient aurora aura */}
      <div
        className={`absolute w-[500px] h-[500px] rounded-full bg-cyan-500/20 blur-[100px] pointer-events-none transition-opacity duration-1000 ${
          phase === 'transitioning' ? 'opacity-0 scale-150' : 'opacity-100 scale-100'
        }`}
      />
      <div
        className={`absolute w-[400px] h-[400px] rounded-full bg-purple-500/15 blur-[90px] pointer-events-none transition-opacity duration-1000 ${
          phase === 'transitioning' ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {/* Main Center Stage */}
      <div className="relative flex flex-col items-center text-center z-10 px-4">
        {/* Rotating & Color-Shifting GH Emblem */}
        <div
          className={`mb-6 transition-all duration-700 ease-out ${
            phase === 'transitioning' ? 'opacity-0 scale-75 -translate-y-8' : 'opacity-100 scale-100'
          }`}
        >
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl gh-logo-animated p-1 shadow-[0_0_50px_rgba(56,189,248,0.5)]">
            <div className="w-full h-full bg-slate-950/90 rounded-2xl flex items-center justify-center border border-white/20 backdrop-blur-sm">
              <span className="text-4xl sm:text-5xl font-black bg-gradient-to-br from-cyan-300 via-indigo-200 to-pink-300 bg-clip-text text-transparent tracking-tight">
                GH
              </span>
            </div>
          </div>
        </div>

        {/* Game Hub Text (Transitions slowly and smoothly to the main page title) */}
        <div style={transformStyle}>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white drop-shadow-[0_0_30px_rgba(56,189,248,0.5)] whitespace-nowrap">
            Game Hub
          </h1>
        </div>

        {/* Loading text with animated dots */}
        <div
          className={`mt-5 space-y-3 flex flex-col items-center transition-all duration-700 ease-out ${
            phase === 'transitioning' ? 'opacity-0 translate-y-6 scale-90' : 'opacity-100'
          }`}
        >
          <p className="text-sm sm:text-base font-semibold text-cyan-400 tracking-wider font-mono">
            Loading{'.'.repeat(dotCount)}
          </p>

          {/* Sleek Micro Progress Bar */}
          <div className="w-52 sm:w-72 h-1.5 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/60 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 rounded-full transition-all duration-200 ease-out shadow-[0_0_12px_#38bdf8]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
