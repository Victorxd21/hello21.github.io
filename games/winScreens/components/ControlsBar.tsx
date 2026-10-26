import React from 'react';
import { AnimationMode, ColorPalette, DeviceFrame } from '../types/windowsAnim';
import { COLOR_PALETTES, LOCALIZED_LANGUAGES } from '../data/windowsAnimData';
import { Monitor, Tablet, Smartphone, Sparkles, Layers, Sliders, Globe, FastForward } from 'lucide-react';

interface ControlsBarProps {
  mode: AnimationMode;
  setMode: (m: AnimationMode) => void;
  palette: ColorPalette;
  setPalette: (p: ColorPalette) => void;
  language: string;
  setLanguage: (lang: string) => void;
  speed: number;
  setSpeed: (s: number) => void;
  deviceFrame: DeviceFrame;
  setDeviceFrame: (f: DeviceFrame) => void;
  interactiveGestureEnabled: boolean;
  setInteractiveGestureEnabled: (e: boolean) => void;
}

export const ControlsBar: React.FC<ControlsBarProps> = ({
  mode,
  setMode,
  palette,
  setPalette,
  language,
  setLanguage,
  speed,
  setSpeed,
  deviceFrame,
  setDeviceFrame,
  interactiveGestureEnabled,
  setInteractiveGestureEnabled,
}) => {
  const modes: { id: AnimationMode; label: string; desc: string }[] = [
    { id: 'full', label: 'Full OOBE Sequence', desc: 'Complete first sign-in flow (Tutorial → Apps → Setup → Start)' },
    { id: 'touch', label: 'Touch Swipe Tutorial', desc: 'Windows 8 Surface tablet swipe edge to Charms' },
    { id: 'mouse', label: 'Mouse Corner Tutorial', desc: 'Windows 8 Desktop mouse flick to screen corners' },
    { id: 'color_cycle', label: 'Accent Color Cycle', desc: 'Windows 8/8.1 smooth gradient color lerp loop' },
    { id: 'win11_orbs', label: 'Windows 11 Glowing Orbs', desc: 'Modern ambient radial blur circles (.circle1, 2, 3)' },
    { id: 'zdp', label: 'Zero Day Patching (ZDP)', desc: 'Windows Day-One update download overlay' },
    { id: 'wrap_up', label: "Wrap Up ('Let's start')", desc: 'Drape sequence handoff into Windows shell' },
  ];

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-6 text-sm text-slate-300">
      {/* 1. Mode Selector Tabs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-blue-400" />
            <span>Animation Mode</span>
          </label>
          <span className="text-xs text-slate-500">
            {modes.find((m) => m.id === mode)?.desc}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-3 py-2 text-xs font-medium rounded-lg text-left transition-all border ${
                mode === m.id
                  ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                  : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="font-semibold">{m.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Customizer Grid: Theme Color, Device Frame, Language, Speed */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-800/80">
        {/* Accent Color Palette */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            <span>User Accent Theme</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTES.map((p) => (
              <button
                key={p.id}
                onClick={() => setPalette(p)}
                title={p.name}
                className={`w-7 h-7 rounded-md transition-all flex items-center justify-center ring-offset-2 ring-offset-slate-900 ${
                  palette.id === p.id ? 'ring-2 ring-white scale-110 shadow-md' : 'opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: p.color2 }}
              >
                {palette.id === p.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-slate-400 mt-1.5 block truncate">{palette.name}</span>
        </div>

        {/* Device Frame */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
            Device Display Frame
          </label>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setDeviceFrame('monitor')}
              className={`flex-1 py-1.5 px-2 text-xs rounded font-medium flex items-center justify-center gap-1 transition-colors ${
                deviceFrame === 'monitor' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Desktop Monitor frame"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>PC</span>
            </button>
            <button
              onClick={() => setDeviceFrame('tablet')}
              className={`flex-1 py-1.5 px-2 text-xs rounded font-medium flex items-center justify-center gap-1 transition-colors ${
                deviceFrame === 'tablet' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Surface Tablet frame"
            >
              <Tablet className="w-3.5 h-3.5" />
              <span>Tablet</span>
            </button>
            <button
              onClick={() => setDeviceFrame('borderless')}
              className={`flex-1 py-1.5 px-2 text-xs rounded font-medium flex items-center justify-center gap-1 transition-colors ${
                deviceFrame === 'borderless' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Frameless pure screen"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Clean</span>
            </button>
          </div>
        </div>

        {/* Language / RTL Selector */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>MUI Language Pack</span>
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            {Object.entries(LOCALIZED_LANGUAGES).map(([key, val]) => (
              <option key={key} value={key}>
                {val.name}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {LOCALIZED_LANGUAGES[language]?.isRTL ? 'RTL Layout active' : 'LTR Layout'}
          </span>
        </div>

        {/* Simulation Speed & Interactive Toggle */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2 flex items-center gap-1.5">
            <FastForward className="w-3.5 h-3.5 text-blue-400" />
            <span>Playback Speed</span>
          </label>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {[0.5, 1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`flex-1 py-1 text-xs rounded font-mono font-medium transition-colors ${
                  speed === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={interactiveGestureEnabled}
              onChange={(e) => setInteractiveGestureEnabled(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
            />
            <span className="text-xs text-slate-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Interactive Gestures</span>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};
