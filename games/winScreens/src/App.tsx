/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FirstLogonPlayer } from './components/FirstLogonPlayer';
import { ControlsBar } from './components/ControlsBar';
import { TechnicalAnalysis } from './components/TechnicalAnalysis';
import { CodeInspector } from './components/CodeInspector';
import { COLOR_PALETTES, LOCALIZED_LANGUAGES } from './data/windowsAnimData';
import { AnimationMode, DeviceFrame } from './types/windowsAnim';
import { Monitor, FileCode2, Info, Sparkles, ExternalLink, ShieldAlert, Cpu } from 'lucide-react';

export default function App() {
  const [mode, setMode] = useState<AnimationMode>('full');
  const [palette, setPalette] = useState(COLOR_PALETTES[0]);
  const [language, setLanguage] = useState('en');
  const [speed, setSpeed] = useState(1);
  const [deviceFrame, setDeviceFrame] = useState<DeviceFrame>('monitor');
  const [interactiveGestureEnabled, setInteractiveGestureEnabled] = useState(true);
  const [activeSection, setActiveSection] = useState<'emulator' | 'analysis' | 'code'>('emulator');

  const currentStrings = LOCALIZED_LANGUAGES[language]?.strings || LOCALIZED_LANGUAGES.en.strings;
  const isRTL = !!LOCALIZED_LANGUAGES[language]?.isRTL;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                <path d="M0 3.449L9.75 2.1v9.451H0V3.449zm0 17.102L9.75 21.9v-9.45H0v8.101zm10.9-18.663L24 0v11.551H10.9V1.888zm13.1 10.562V24l-13.1-1.887v-9.664H24z" />
              </svg>
            </div>
            <span className="font-semibold text-white tracking-tight text-sm sm:text-base">
              FirstLogonAnim Explorer
            </span>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
            <button
              onClick={() => {
                setActiveSection('emulator');
                document.getElementById('emulator-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Live Emulator
            </button>
            <button
              onClick={() => {
                setActiveSection('analysis');
                document.getElementById('analysis-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              System Analysis
            </button>
            <button
              onClick={() => {
                setActiveSection('code');
                document.getElementById('code-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Source Code Anatomy
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="/assets/aistudio/FirstLogonAnim_600d6151.html"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700/80 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <FileCode2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Raw HTML File</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* Editorial Hero & Direct Answer */}
        <div className="space-y-3">
          {/* Zero-Pill Unboxed Metadata */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Microsoft Windows OOBE</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-cyan-400">C:\Windows\System32\oobe\FirstLogonAnim.html</span>
            <span aria-hidden="true">·</span>
            <span>Windows 8 through 11</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white max-w-4xl text-balance">
            The Windows First Logon Animation
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-3xl leading-relaxed">
            This file is the official web application executed by Windows when any new user account
            logs in for the very first time. It taught users the signature Windows 8 touch and mouse
            gestures (swiping from edges and flicking to corners to summon the Charms Bar) while smoothly
            cycling through accent colors to mask background AppX package installations, profile hive
            generation, and Day-One updates.
          </p>
        </div>

        {/* Live Interactive Emulator Section */}
        <section id="emulator-section" className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Monitor className="w-4 h-4 text-blue-400" />
              <span>Interactive First Logon Simulator</span>
            </h2>
            <span className="text-xs text-slate-500 hidden sm:inline">
              Polyfilled Trident MSHTML Engine running in modern HTML5 & CSS3
            </span>
          </div>

          {/* Canvas Viewport Player */}
          <FirstLogonPlayer
            mode={mode}
            palette={palette}
            strings={currentStrings}
            isRTL={isRTL}
            speed={speed}
            deviceFrame={deviceFrame}
            interactiveGestureEnabled={interactiveGestureEnabled}
          />

          {/* Controls Bar for Testing Modes, Themes & Frames */}
          <ControlsBar
            mode={mode}
            setMode={setMode}
            palette={palette}
            setPalette={setPalette}
            language={language}
            setLanguage={setLanguage}
            speed={speed}
            setSpeed={setSpeed}
            deviceFrame={deviceFrame}
            setDeviceFrame={setDeviceFrame}
            interactiveGestureEnabled={interactiveGestureEnabled}
            setInteractiveGestureEnabled={setInteractiveGestureEnabled}
          />
        </section>

        {/* Technical Breakdown & Operating System Context */}
        <section id="analysis-section" className="space-y-4 pt-6 border-t border-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-400" />
              <span>Deep Technical Breakdown</span>
            </h2>
            <span className="text-xs text-slate-500">
              Execution architecture, background tasks, and registry keys
            </span>
          </div>

          <TechnicalAnalysis />
        </section>

        {/* Code Anatomy & Trident Engine Quirks */}
        <section id="code-section" className="space-y-4 pt-6 border-t border-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-blue-400" />
              <span>Source Code Anatomy</span>
            </h2>
            <span className="text-xs text-slate-500">
              Line-by-line inspection of functions, SVG assets, and legacy Trident vendor prefixes
            </span>
          </div>

          <CodeInspector />
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-800/80 bg-slate-950 px-6 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>Windows First Logon Animation Explorer</span>
            <span>·</span>
            <span>Trident & Web Standards Historical Archive</span>
          </div>
          <div>
            Referencing <code className="font-mono text-slate-400">FirstLogonAnim_600d6151.html</code>
          </div>
        </div>
      </footer>
    </div>
  );
}
