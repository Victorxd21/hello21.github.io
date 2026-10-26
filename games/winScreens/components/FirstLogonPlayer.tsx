import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AnimationMode, ColorPalette, DeviceFrame, LocalizedStrings } from '../types/windowsAnim';
import { Maximize2, Minimize2, Play, Pause, RotateCcw, Volume2, VolumeX, Sparkles, Hand, MousePointer } from 'lucide-react';

interface FirstLogonPlayerProps {
  mode: AnimationMode;
  palette: ColorPalette;
  strings: LocalizedStrings;
  isRTL: boolean;
  speed: number;
  deviceFrame: DeviceFrame;
  interactiveGestureEnabled: boolean;
  onSequenceComplete?: () => void;
}

export const FirstLogonPlayer: React.FC<FirstLogonPlayerProps> = ({
  mode,
  palette,
  strings,
  isRTL,
  speed,
  deviceFrame,
  interactiveGestureEnabled,
  onSequenceComplete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Animation timeline state
  const [stage, setStage] = useState<'intro' | 'action' | 'hold' | 'color_cycle' | 'zdp' | 'wrap_up' | 'done'>('intro');
  const [activeMessageIndex, setActiveMessageIndex] = useState(0);
  const [currentBgColor, setCurrentBgColor] = useState<string>(palette.color1);
  const [gestureCharmsOpen, setGestureCharmsOpen] = useState(false);
  const [charmsHovered, setCharmsHovered] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Audio Context for authentic soft atmospheric drone
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.4); // E5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch {
      // Audio autoplay policy
    }
  }, [soundEnabled]);

  // Color Cycling loop (simulates cycleToTargetColor() from original file)
  useEffect(() => {
    if (!isPlaying) return;
    if (mode !== 'color_cycle' && mode !== 'full' && mode !== 'zdp' && stage !== 'color_cycle') {
      setCurrentBgColor(palette.color1);
      return;
    }

    let frameId: number;
    let colorIndex = 0;
    let nextIndex = 1;
    let step = 0;
    const totalSteps = Math.max(60, Math.round(240 / speed));

    const cycleColors = () => {
      const paletteColors = palette.cyclePalette;
      if (!paletteColors || paletteColors.length < 2) return;

      const fromRGB = paletteColors[colorIndex % paletteColors.length];
      const toRGB = paletteColors[nextIndex % paletteColors.length];

      const r = Math.round(fromRGB[0] + (toRGB[0] - fromRGB[0]) * (step / totalSteps));
      const g = Math.round(fromRGB[1] + (toRGB[1] - fromRGB[1]) * (step / totalSteps));
      const b = Math.round(fromRGB[2] + (toRGB[2] - fromRGB[2]) * (step / totalSteps));

      setCurrentBgColor(`rgb(${r}, ${g}, ${b})`);

      step++;
      if (step >= totalSteps) {
        step = 0;
        colorIndex = nextIndex;
        nextIndex = (nextIndex + 1) % paletteColors.length;
      }

      frameId = requestAnimationFrame(cycleColors);
    };

    frameId = requestAnimationFrame(cycleColors);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, mode, stage, palette, speed]);

  // Reset animation when mode or palette changes
  useEffect(() => {
    setElapsedTime(0);
    setGestureCharmsOpen(false);
    if (mode === 'touch' || mode === 'mouse' || mode === 'full') {
      setStage('intro');
      setActiveMessageIndex(0);
    } else if (mode === 'color_cycle' || mode === 'win11_orbs') {
      setStage('color_cycle');
      setActiveMessageIndex(0);
    } else if (mode === 'zdp') {
      setStage('zdp');
    } else if (mode === 'wrap_up') {
      setStage('wrap_up');
    }
  }, [mode, palette]);

  // Main Timeline Sequencer
  useEffect(() => {
    if (!isPlaying) return;

    const baseInterval = 1000 / speed;
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, baseInterval);

    return () => clearInterval(timer);
  }, [isPlaying, speed]);

  // Timeline progression based on elapsed time & mode
  useEffect(() => {
    if (!isPlaying) return;

    if (mode === 'touch' || mode === 'mouse') {
      if (elapsedTime === 2) {
        setStage('action');
        playChime();
      } else if (elapsedTime === 7) {
        setStage('hold');
      } else if (elapsedTime >= 10) {
        setStage('done');
        onSequenceComplete?.();
      }
    } else if (mode === 'full') {
      if (elapsedTime === 2) {
        setStage('action'); // Gesture demo
      } else if (elapsedTime === 8) {
        setStage('color_cycle'); // Transition to OOBE color cycle
        playChime();
      } else if (elapsedTime === 13) {
        setActiveMessageIndex(1); // "Getting your apps ready"
      } else if (elapsedTime === 18) {
        setActiveMessageIndex(2); // "Don't turn off your PC"
      } else if (elapsedTime === 23) {
        setActiveMessageIndex(3); // "Getting your PC ready"
      } else if (elapsedTime === 28) {
        setActiveMessageIndex(4); // "Almost ready"
      } else if (elapsedTime === 33) {
        setStage('wrap_up'); // "[Let's start]"
        playChime();
      } else if (elapsedTime >= 37) {
        setStage('done');
        onSequenceComplete?.();
      }
    } else if (mode === 'color_cycle' || mode === 'win11_orbs') {
      // Rotate messages every 6 seconds
      const nextIndex = Math.floor(elapsedTime / 5) % strings.messages.length;
      if (nextIndex !== activeMessageIndex) {
        setActiveMessageIndex(nextIndex);
      }
    }
  }, [elapsedTime, isPlaying, mode, strings.messages.length, activeMessageIndex, playChime, onSequenceComplete]);

  // Fullscreen Handler
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Interactive mouse corner detection
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactiveGestureEnabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Corner trigger (top-right or bottom-right in LTR, or left in RTL)
    const isRightCorner = isRTL ? x < 50 : x > rect.width - 50;
    const isCornerY = y < 50 || y > rect.height - 50;

    if (isRightCorner && isCornerY) {
      setGestureCharmsOpen(true);
    } else if (!charmsHovered && (isRTL ? x > 120 : x < rect.width - 120)) {
      setGestureCharmsOpen(false);
    }
  };

  // Restart sequence
  const handleRestart = () => {
    setElapsedTime(0);
    setGestureCharmsOpen(false);
    if (mode === 'touch' || mode === 'mouse' || mode === 'full') {
      setStage('intro');
      setActiveMessageIndex(0);
    } else if (mode === 'color_cycle' || mode === 'win11_orbs') {
      setStage('color_cycle');
      setActiveMessageIndex(0);
    } else if (mode === 'zdp') {
      setStage('zdp');
    } else if (mode === 'wrap_up') {
      setStage('wrap_up');
    }
  };

  const showCharms =
    gestureCharmsOpen ||
    (stage === 'action' && elapsedTime >= 4) ||
    stage === 'hold';

  return (
    <div className="flex flex-col items-center w-full">
      {/* Device Bezel / Screen Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className={`relative overflow-hidden select-none transition-all duration-500 shadow-2xl ${
          deviceFrame === 'monitor'
            ? 'w-full max-w-[960px] aspect-[16/10] rounded-xl border-[14px] border-slate-900 bg-black ring-1 ring-slate-800'
            : deviceFrame === 'tablet'
            ? 'w-full max-w-[880px] aspect-[16/9] rounded-2xl border-[18px] border-slate-950 bg-black ring-1 ring-slate-800'
            : 'w-full aspect-[16/9] rounded-lg border border-slate-800 bg-black'
        } ${isFullscreen ? 'w-screen h-screen !max-w-none !rounded-none !border-0' : ''}`}
        style={{
          backgroundColor:
            mode === 'win11_orbs'
              ? '#000000'
              : mode === 'color_cycle' || stage === 'color_cycle' || mode === 'full'
              ? currentBgColor
              : palette.color1,
        }}
      >
        {/* Tablet Camera dot & Start Sensor */}
        {deviceFrame === 'tablet' && !isFullscreen && (
          <>
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-slate-800 ring-1 ring-slate-700/50 z-50" />
            <div
              className={`absolute bottom-2 ${
                isRTL ? 'left-4' : 'right-4'
              } w-4 h-4 opacity-40 hover:opacity-100 transition-opacity z-50`}
            >
              <svg viewBox="0 0 16 16" fill="white" className="w-full h-full">
                <rect x="0" y="0" width="7" height="7" />
                <rect x="9" y="0" width="7" height="7" />
                <rect x="0" y="9" width="7" height="7" />
                <rect x="9" y="9" width="7" height="7" />
              </svg>
            </div>
          </>
        )}

        {/* ============================================================== */}
        {/* LAYER 1: WINDOWS 11 AMBIENT GLOWING ORBS (from lines 125-170) */}
        {/* ============================================================== */}
        {(mode === 'win11_orbs' || (mode === 'full' && stage === 'color_cycle')) && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {/* Circle 1 */}
            <div
              className="absolute rounded-full opacity-70 animate-pulse"
              style={{
                width: '65vw',
                height: '65vw',
                left: '20%',
                top: '10%',
                background: 'radial-gradient(circle, rgba(12, 119, 255, 0.4) 0%, rgba(12, 119, 255, 0) 70%)',
                animation: 'floatOrb1 16s ease-in-out infinite alternate',
              }}
            />
            {/* Circle 2 */}
            <div
              className="absolute rounded-full opacity-60"
              style={{
                width: '70vw',
                height: '70vw',
                left: '40%',
                top: '25%',
                background: 'radial-gradient(circle, rgba(0, 56, 255, 0.35) 0%, rgba(12, 119, 255, 0) 70%)',
                animation: 'floatOrb2 14s ease-in-out infinite alternate',
              }}
            />
            {/* Circle 3 */}
            <div
              className="absolute rounded-full opacity-70"
              style={{
                width: '90vw',
                height: '90vw',
                left: '25%',
                top: '20%',
                background: 'radial-gradient(circle, rgba(65, 56, 210, 0.45) 0%, rgba(65, 56, 210, 0) 70%)',
                animation: 'floatOrb3 18s ease-in-out infinite alternate',
              }}
            />
          </div>
        )}

        {/* ============================================================== */}
        {/* LAYER 2: WINDOWS 8 GESTURE TUTORIAL (TOUCH & MOUSE MODES)     */}
        {/* ============================================================== */}
        {(mode === 'touch' || mode === 'mouse' || (mode === 'full' && (stage === 'intro' || stage === 'action' || stage === 'hold'))) && (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-8 z-10">
            {/* Instruction Typography */}
            <div className="absolute top-12 left-0 right-0 text-center px-4 transition-all duration-700">
              {stage === 'intro' ? (
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-wide animate-fadeIn">
                  {mode === 'mouse' ? strings.mouseIntro : strings.touchIntro}
                </h2>
              ) : (
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-wide animate-fadeIn">
                  {mode === 'mouse' ? strings.mouseInstruction : strings.touchInstruction}
                </h2>
              )}
            </div>

            {/* Gesture Stage Canvas */}
            <div className="relative w-[340px] sm:w-[460px] md:w-[540px] aspect-[16/10] flex items-center justify-center">
              {/* Screen Preview Graphic */}
              <div
                className="relative w-[75%] h-[75%] border border-white/20 rounded shadow-inner overflow-hidden transition-colors duration-500"
                style={{ backgroundColor: palette.color1 }}
              >
                {/* Embedded Charms Bar inside the preview screen */}
                <div
                  className={`absolute top-0 bottom-0 ${
                    isRTL ? 'left-0' : 'right-0'
                  } w-9 sm:w-11 bg-[#1A1A1A] flex flex-col items-center justify-between py-6 transition-transform duration-500 shadow-2xl z-20 ${
                    showCharms
                      ? 'translate-x-0'
                      : isRTL
                      ? '-translate-x-full'
                      : 'translate-x-full'
                  }`}
                  onMouseEnter={() => setCharmsHovered(true)}
                  onMouseLeave={() => setCharmsHovered(false)}
                >
                  {/* Search Icon */}
                  <div className="text-white hover:text-white/80 transition-colors p-1" title="Search">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="w-5 h-5">
                      <circle cx="11" cy="11" r="7" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>

                  {/* Windows 8 Flag Logo (Colored with user_color2) */}
                  <div className="p-1 hover:scale-105 transition-transform" title="Start">
                    <svg viewBox="0 0 24 24" className="w-5 h-5" style={{ fill: palette.color2 }}>
                      <path d="M0 3.449L9.75 2.1v9.451H0V3.449zm0 17.102L9.75 21.9v-9.45H0v8.101zm10.9-18.663L24 0v11.551H10.9V1.888zm13.1 10.562V24l-13.1-1.887v-9.664H24z" />
                    </svg>
                  </div>

                  {/* Settings Gear */}
                  <div className="text-white hover:text-white/80 transition-colors p-1" title="Settings">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </div>
                </div>

                {/* Touch Hand & Thumb Representation (if touch mode) */}
                {mode !== 'mouse' && (
                  <div
                    className={`absolute inset-0 pointer-events-none transition-all duration-700 ${
                      stage === 'action' ? 'opacity-100' : 'opacity-80'
                    }`}
                  >
                    {/* Swipe Inward Arrow Indicator */}
                    {stage === 'action' && !showCharms && (
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 ${
                          isRTL ? 'left-2' : 'right-2'
                        } flex items-center text-white/90 animate-bounce`}
                      >
                        <div
                          className={`w-8 h-2 bg-white/80 rounded ${
                            isRTL ? 'rotate-180' : ''
                          }`}
                        />
                        <div
                          className={`w-0 h-0 border-y-6 border-y-transparent ${
                            isRTL
                              ? 'border-r-8 border-r-white'
                              : 'border-l-8 border-l-white'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Mouse Cursor Representation (if mouse mode) */}
                {mode === 'mouse' && (
                  <div
                    className="absolute pointer-events-none transition-all duration-1000 ease-out z-30"
                    style={{
                      top: stage === 'action' || stage === 'hold' ? '8%' : '55%',
                      left: isRTL
                        ? stage === 'action' || stage === 'hold'
                          ? '8%'
                          : '50%'
                        : stage === 'action' || stage === 'hold'
                        ? '88%'
                        : '50%',
                    }}
                  >
                    {/* Windows 8 Metro styled Cursor */}
                    <svg viewBox="0 0 24 24" className="w-8 h-8 drop-shadow-md">
                      <path
                        d="M3 2l6 18 3-7 7-3L3 2z"
                        fill={palette.color1}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    </svg>

                    {/* Corner Target Flash indicator */}
                    {stage === 'action' && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 border-2 border-dashed border-white/80 rounded-full animate-ping pointer-events-none" />
                    )}
                  </div>
                )}
              </div>

              {/* Tablet Device Frame border preview */}
              <div className="absolute inset-0 border-2 border-white/40 rounded-lg pointer-events-none flex items-center justify-between px-3">
                <div className="w-2 h-2 rounded-full bg-white/40" />
                <div className="w-3 h-3 border border-white/40 rounded-sm" />
              </div>
            </div>

            {/* Hint for Interactive Corner / Edge gesture */}
            {interactiveGestureEnabled && (
              <div className="absolute bottom-6 flex items-center gap-2 text-xs text-white/60 bg-black/40 backdrop-blur px-3 py-1.5 rounded-full border border-white/10">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  Interactive Gesture Mode active:{' '}
                  {isRTL
                    ? 'Move mouse to top-left corner or swipe left'
                    : 'Move mouse to top-right corner or swipe right'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* LAYER 3: COLOR CYCLING / OOBE PROFILE SETUP PROGRESS          */}
        {/* ============================================================== */}
        {(mode === 'color_cycle' || mode === 'win11_orbs' || (mode === 'full' && stage === 'color_cycle')) && (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-8 z-10 transition-opacity duration-700 animate-fadeIn">
            {/* Center Status Text */}
            <div className="text-center max-w-xl px-4 space-y-4">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-light text-white tracking-tight leading-tight">
                {strings.messages[activeMessageIndex] || strings.messages[0]}
              </h1>

              {strings.subMessages[activeMessageIndex] && (
                <p className="text-lg sm:text-xl text-white/80 font-normal tracking-wide">
                  {strings.subMessages[activeMessageIndex]}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* LAYER 4: ZERO DAY PATCHING (ZDP) OVERLAY                      */}
        {/* ============================================================== */}
        {mode === 'zdp' && (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-8 z-10 animate-fadeIn">
            <div className="text-center max-w-lg space-y-3">
              <h2 className="text-3xl sm:text-4xl font-light text-white tracking-wide">
                {strings.zdpMessage}
              </h2>
              <p className="text-lg text-white/80 font-normal">
                {strings.zdpSubMessage}
              </p>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* LAYER 5: WRAP UP / DRAPE / "LET'S START"                      */}
        {/* ============================================================== */}
        {(mode === 'wrap_up' || (mode === 'full' && stage === 'wrap_up')) && (
          <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-40 animate-fadeIn">
            <div className="text-center space-y-3">
              <h1 className="text-4xl sm:text-5xl font-light text-white tracking-tight animate-bounce">
                {strings.finishText}
              </h1>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* INTERACTIVE POP-OUT CHARMS BAR (When triggered on outer frame) */}
        {/* ============================================================== */}
        <div
          className={`absolute top-0 bottom-0 ${
            isRTL ? 'left-0' : 'right-0'
          } w-16 sm:w-20 bg-neutral-900/95 backdrop-blur-md border-${
            isRTL ? 'r' : 'l'
          } border-neutral-800 flex flex-col items-center justify-center gap-10 py-8 transition-transform duration-300 z-50 shadow-2xl ${
            gestureCharmsOpen
              ? 'translate-x-0'
              : isRTL
              ? '-translate-x-full'
              : 'translate-x-full'
          }`}
          onMouseEnter={() => setCharmsHovered(true)}
          onMouseLeave={() => setCharmsHovered(false)}
        >
          {/* Search Charm */}
          <button
            className="flex flex-col items-center gap-1.5 text-white/70 hover:text-white transition-colors group"
            onClick={() => alert('Search Charm triggered (Windows 8 Charms Bar)')}
          >
            <div className="p-2.5 rounded-full group-hover:bg-white/10 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <span className="text-[11px] font-medium tracking-wide">Search</span>
          </button>

          {/* Start Charm */}
          <button
            className="flex flex-col items-center gap-1.5 text-white/70 hover:text-white transition-colors group"
            onClick={() => alert('Start Charm triggered (Opens Windows 8 Start Screen)')}
          >
            <div className="p-2.5 rounded-full group-hover:bg-white/10 transition-colors">
              <svg viewBox="0 0 24 24" className="w-7 h-7" style={{ fill: palette.color2 }}>
                <path d="M0 3.449L9.75 2.1v9.451H0V3.449zm0 17.102L9.75 21.9v-9.45H0v8.101zm10.9-18.663L24 0v11.551H10.9V1.888zm13.1 10.562V24l-13.1-1.887v-9.664H24z" />
              </svg>
            </div>
            <span className="text-[11px] font-medium tracking-wide">Start</span>
          </button>

          {/* Settings Charm */}
          <button
            className="flex flex-col items-center gap-1.5 text-white/70 hover:text-white transition-colors group"
            onClick={() => alert('Settings Charm triggered (Opens PC Settings pane)')}
          >
            <div className="p-2.5 rounded-full group-hover:bg-white/10 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <span className="text-[11px] font-medium tracking-wide">Settings</span>
          </button>
        </div>
      </div>

      {/* Screen Embedded Quick-Controls Strip */}
      <div className="w-full max-w-[960px] flex items-center justify-between mt-3 px-2 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            onClick={handleRestart}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            title="Restart current animation sequence"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restart</span>
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
              soundEnabled
                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="Toggle atmospheric audio chime"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-blue-400" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{soundEnabled ? 'Chime ON' : 'Chime Muted'}</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-slate-500 hidden sm:inline">
            Status: <strong className="text-slate-300 uppercase tracking-wider">{stage}</strong> ({elapsedTime}s)
          </span>

          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            title="Toggle full screen playback"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
