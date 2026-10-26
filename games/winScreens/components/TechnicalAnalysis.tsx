import React, { useState } from 'react';
import { TECHNICAL_BREAKDOWN } from '../data/windowsAnimData';
import { BookOpen, HelpCircle, Cpu, Shield, Clock, Terminal, ChevronRight, FileCode, CheckCircle2 } from 'lucide-react';

export const TechnicalAnalysis: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'anatomy' | 'execution' | 'registry'>('overview');

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl text-slate-200">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-800 bg-slate-950/60 overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-blue-500 text-white bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <HelpCircle className="w-4 h-4 text-blue-400" />
          <span>Executive Summary</span>
        </button>

        <button
          onClick={() => setActiveTab('anatomy')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'anatomy'
              ? 'border-blue-500 text-white bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCode className="w-4 h-4 text-blue-400" />
          <span>File Anatomy & Win 8 vs 11</span>
        </button>

        <button
          onClick={() => setActiveTab('execution')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'execution'
              ? 'border-blue-500 text-white bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-4 h-4 text-blue-400" />
          <span>Under the Hood (Background Tasks)</span>
        </button>

        <button
          onClick={() => setActiveTab('registry')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'registry'
              ? 'border-blue-500 text-white bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4 text-blue-400" />
          <span>Registry & Group Policy</span>
        </button>
      </div>

      {/* Tab Content Panes */}
      <div className="p-6">
        {/* TAB 1: EXECUTIVE SUMMARY */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="border-l-2 border-blue-500 pl-4 py-1">
              <h3 className="text-lg font-semibold text-white">
                The Windows Out-of-Box First Logon Animation
              </h3>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                This HTML document is the authentic presentation file that Microsoft Windows runs
                whenever a user logs into a brand new user profile or finishes installing Windows.
              </p>
            </div>

            {/* Quick Fact Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Authentic Windows File Path
                </div>
                <code className="text-xs font-mono text-cyan-300 break-all select-all">
                  {TECHNICAL_BREAKDOWN.filePath}
                </code>
              </div>

              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Host Execution Process
                </div>
                <code className="text-xs font-mono text-cyan-300 break-all">
                  {TECHNICAL_BREAKDOWN.hostProcess}
                </code>
              </div>
            </div>

            {/* Core Purpose Grid */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                The 3 Core Purposes of this File
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="w-8 h-8 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <h5 className="font-semibold text-white text-sm">User Gesture Education</h5>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Taught users unfamiliar with Windows 8 how to access the Charms bar by swiping
                    from the screen edge (touch) or aiming at the corners (mouse).
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="w-8 h-8 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <h5 className="font-semibold text-white text-sm">App Provisioning Mask</h5>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Masked the lengthy disk-heavy initialization of AppX packages, local folders,
                    and NTUSER registry hives behind smooth color gradient transitions.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="w-8 h-8 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <h5 className="font-semibold text-white text-sm">Zero Day Patching (ZDP)</h5>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Provided a safe, non-interactive visual screen while Windows downloaded and
                    applied urgent day-one security hotfixes before desktop load.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ANATOMY & EVOLUTION */}
        {activeTab === 'anatomy' && (
          <div className="space-y-6">
            <div className="p-4 rounded-lg bg-blue-950/30 border border-blue-900/50 space-y-2">
              <h4 className="text-sm font-semibold text-blue-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>The Mystery: Why Windows 8 Charms AND Windows 11 Glow Orbs in One File?</span>
              </h4>
              <p className="text-xs text-blue-200/80 leading-relaxed">
                {TECHNICAL_BREAKDOWN.whyBothWin8AndWin11}
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Chronological Evolution of FirstLogonAnim
              </h4>

              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-4">
                  <div className="px-2.5 py-1 rounded bg-slate-800 text-blue-400 font-mono text-xs font-bold shrink-0">
                    Windows 8 (2012)
                  </div>
                  <div className="text-xs text-slate-300 space-y-1">
                    <div className="font-semibold text-white">Full Charms Tutorial & Accent Pulse</div>
                    <p className="text-slate-400">
                      Introduced the touch hand animations, SVG Charms bar, mouse cursor corner animations,
                      and RGB color blending with messages like "Installing apps" and "Let\'s start".
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-4">
                  <div className="px-2.5 py-1 rounded bg-slate-800 text-blue-400 font-mono text-xs font-bold shrink-0">
                    Windows 8.1 (2013)
                  </div>
                  <div className="text-xs text-slate-300 space-y-1">
                    <div className="font-semibold text-white">Updated Messaging & Start Tip</div>
                    <p className="text-slate-400">
                      Restored visible Start button cues and added refined phrasing ("Setting things up for you").
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-4">
                  <div className="px-2.5 py-1 rounded bg-slate-800 text-blue-400 font-mono text-xs font-bold shrink-0">
                    Windows 10 (2015)
                  </div>
                  <div className="text-xs text-slate-300 space-y-1">
                    <div className="font-semibold text-white">Charms Removed, Color Cycling Retained</div>
                    <p className="text-slate-400">
                      Charms were removed from the OS, so Windows stopped calling <code>initTouchSequence()</code> and jumped straight to <code>initEndSequence()</code> ("Hi / We\'re getting everything ready for you").
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-4">
                  <div className="px-2.5 py-1 rounded bg-slate-800 text-blue-400 font-mono text-xs font-bold shrink-0">
                    Windows 11 (2021)
                  </div>
                  <div className="text-xs text-slate-300 space-y-1">
                    <div className="font-semibold text-white">Ambient Fluid Radial Glow Orbs (.circle1, .circle2, .circle3)</div>
                    <p className="text-slate-400">
                      Microsoft appended the floating radial gradient circles with Segoe UI Variable typography, transitioning the first logon screen into a calm, glowing dark background.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: UNDER THE HOOD */}
        {activeTab === 'execution' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                What Windows was Doing Behind the Screen
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                While the user watched the calming color cycling animation and messages, the OS was executing several critical, resource-intensive operations in the background:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>AppX Package Staging & Registration</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Windows extracts provisioned modern apps (Mail, Calendar, Photos, Calculator, Store) from <code>C:\Program Files\WindowsApps</code> into the user profile and generates Start menu tiles.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>User Profile Hive Initialization</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Mounts <code>NTUSER.DAT</code> into <code>HKEY_CURRENT_USER</code>, applies user group policies, initializes user cryptographic keys, and sets up personal folders.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Security & Driver Baseline Checks</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Windows Defender checks definition updates, while Plug-and-Play (PnP) associates display adapters and audio peripherals to the new session.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Handoff to Windows Explorer</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Once all provisioning tasks return exit code 0, Winlogon signals the animation to execute <code>endAnimation()</code>, sets a 2-second timeout, kills the WWAHost process, and launches <code>explorer.exe</code>.
                  </p>
                </div>
              </div>
            </div>

            {/* Architecture Architecture Note */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Trident (MSHTML) Web Engine Quirks</span>
              </h5>
              <p className="text-xs text-slate-300 leading-relaxed">
                Notice the heavy use of <code>-ms-keyframes</code>, <code>-ms-transform</code>, and <code>MSAnimationEnd</code>. In 2011–2012 when Windows 8 was engineered, standard CSS3 animations and the Web Animations API were not finalized. Microsoft used its Trident engine (Internet Explorer 10) with vendor-prefixed properties and dynamic stylesheet injection via <code>stylesheet.insertRule()</code> to maintain strict hardware acceleration and 60 FPS performance on early ARM and Intel Atom devices.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: REGISTRY & GPO */}
        {activeTab === 'registry' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Disabling the Animation via Registry (Sysadmins & Speed Enthusiasts)
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Many enterprise IT administrators and gamers disabled this animation to speed up initial logon times by creating a DWORD value in the Windows Registry:
              </p>

              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs space-y-2 text-slate-300">
                <div className="text-slate-500">; Windows Registry Editor Version 5.00</div>
                <div className="text-cyan-300">[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System]</div>
                <div><span className="text-yellow-300">"EnableFirstLogonAnimation"</span>=dword:<span className="text-emerald-400">00000000</span></div>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-800">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Group Policy Object (GPO) Setting
              </h4>
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2">
                <div className="text-slate-400">
                  <strong>Path:</strong> Computer Configuration &gt; Administrative Templates &gt; System &gt; Logon
                </div>
                <div className="text-slate-400">
                  <strong>Policy Name:</strong> <span className="text-white font-medium">Show first sign-in animation</span>
                </div>
                <div className="text-slate-400">
                  <strong>Values:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1 text-slate-300">
                    <li><strong className="text-white">Disabled:</strong> Skips FirstLogonAnim.html completely; shows standard Windows circular spinner directly until desktop is ready.</li>
                    <li><strong className="text-white">Enabled / Not Configured:</strong> Plays the full animated sequence.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
