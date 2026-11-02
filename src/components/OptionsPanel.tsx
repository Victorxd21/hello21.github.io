import React from 'react';
import { HubOptions, Season, TimeOfDay } from '../types/game';
import { Settings, X, Sparkles, Sliders, Eye, RefreshCw, Zap } from 'lucide-react';
import { playUiSound } from '../utils/audio';

interface OptionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  options: HubOptions;
  setOptions: React.Dispatch<React.SetStateAction<HubOptions>>;
  onShakeCubes: () => void;
  onResetOptions: () => void;
}

export const OptionsPanel: React.FC<OptionsPanelProps> = ({
  isOpen,
  onClose,
  options,
  setOptions,
  onShakeCubes,
  onResetOptions
}) => {
  if (!isOpen) return null;

  const toggleOption = (key: keyof HubOptions) => {
    if (options.sound) playUiSound('click');
    setOptions((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSeasonChange = (val: Season) => {
    if (options.sound) playUiSound('click');
    setOptions((prev) => ({ ...prev, season: val }));
  };

  const handleTimeChange = (val: TimeOfDay) => {
    if (options.sound) playUiSound('click');
    setOptions((prev) => ({ ...prev, timeOfDay: val }));
  };

  return (
    <div
      className="fixed inset-0 z-[650] flex items-start justify-end p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (options.sound) playUiSound('close');
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-sm max-h-[85vh] bg-slate-900/95 border border-purple-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-400 shadow-sm">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Hub Options</h3>
              <p className="text-[11px] text-slate-400">Atmosphere, Physics & Visual Controls</p>
            </div>
          </div>

          <button
            onClick={() => {
              if (options.sound) playUiSound('close');
              onClose();
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-300">
          {/* Fun Section */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">Fun & Interaction</h4>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Cursor Trail</span>
                <span className="text-[11px] text-slate-400">Particles follow mouse movements</span>
              </div>
              <button
                type="button"
                onClick={() => toggleOption('trail')}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  options.trail ? 'bg-purple-600 shadow-[0_0_10px_#a855f7]' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 absolute top-1 ${
                    options.trail ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Party Mode</span>
                <span className="text-[11px] text-slate-400">Playful wiggles on card hover</span>
              </div>
              <button
                type="button"
                onClick={() => toggleOption('party')}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  options.party ? 'bg-purple-600 shadow-[0_0_10px_#a855f7]' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 absolute top-1 ${
                    options.party ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Click Confetti</span>
                <span className="text-[11px] text-slate-400">Burst when clicking into games</span>
              </div>
              <button
                type="button"
                onClick={() => toggleOption('confetti')}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  options.confetti ? 'bg-purple-600 shadow-[0_0_10px_#a855f7]' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 absolute top-1 ${
                    options.confetti ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">UI Sounds</span>
                <span className="text-[11px] text-slate-400">Procedural audio clicks and pops</span>
              </div>
              <button
                type="button"
                onClick={() => toggleOption('sound')}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  options.sound ? 'bg-purple-600 shadow-[0_0_10px_#a855f7]' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 absolute top-1 ${
                    options.sound ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Atmosphere & Season */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h4 className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">Atmosphere & Time</h4>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-semibold block">Seasonal Theme</label>
              <select
                value={options.season}
                onChange={(e) => handleSeasonChange(e.target.value as Season)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-400"
              >
                <option value="auto">Auto (by calendar date)</option>
                <option value="default">🌌 Hub Default</option>
                <option value="halloween">🎃 Halloween</option>
                <option value="winter">❄️ Winter</option>
                <option value="spring">🌸 Spring</option>
                <option value="summer">☀️ Summer</option>
                <option value="autumn">🍂 Autumn</option>
                <option value="christmas">🎄 Christmas</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-semibold block">Time of Day</label>
              <select
                value={options.timeOfDay}
                onChange={(e) => handleTimeChange(e.target.value as TimeOfDay)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-400"
              >
                <option value="auto">Auto (by local clock)</option>
                <option value="morning">🌅 Morning (Dawn)</option>
                <option value="afternoon">☀️ Afternoon (Daylight)</option>
                <option value="sunset">🌇 Sunset (Golden Dusk)</option>
                <option value="night">🌙 Night (Midnight)</option>
              </select>
            </div>
          </div>

          {/* Visual & Physics */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h4 className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">Visual & Physics</h4>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Background Weather FX</span>
                <span className="text-[11px] text-slate-400">Snowflakes, falling petals, fireflies</span>
              </div>
              <button
                type="button"
                onClick={() => toggleOption('fx')}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  options.fx ? 'bg-purple-600 shadow-[0_0_10px_#a855f7]' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 absolute top-1 ${
                    options.fx ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Physics Cubes</span>
                <span className="text-[11px] text-slate-400">Interactive rigid cubes in hero banner</span>
              </div>
              <button
                type="button"
                onClick={() => toggleOption('cubes')}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  options.cubes ? 'bg-purple-600 shadow-[0_0_10px_#a855f7]' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 absolute top-1 ${
                    options.cubes ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Grid Overlay</span>
                <span className="text-[11px] text-slate-400">Retro arcade perspective grid</span>
              </div>
              <button
                type="button"
                onClick={() => toggleOption('grid')}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  options.grid ? 'bg-purple-600 shadow-[0_0_10px_#a855f7]' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 absolute top-1 ${
                    options.grid ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">FPS Counter</span>
                <span className="text-[11px] text-slate-400">Display render performance</span>
              </div>
              <button
                type="button"
                onClick={() => toggleOption('fps')}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  options.fps ? 'bg-purple-600 shadow-[0_0_10px_#a855f7]' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 absolute top-1 ${
                    options.fps ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (options.sound) playUiSound('pop');
                onShakeCubes();
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Shake & Fling Cubes</span>
            </button>
          </div>

          {/* Reset */}
          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onResetOptions}
              className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
