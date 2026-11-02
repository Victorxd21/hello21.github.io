import React, { useState } from 'react';
import { Info, X, Shield, Lock, Unlock, Terminal, ExternalLink, Check, Trash2 } from 'lucide-react';
import { playUiSound } from '../utils/audio';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMatrix: () => void;
  soundEnabled: boolean;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  onOpenMatrix,
  soundEnabled
}) => {
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [adminErr, setAdminErr] = useState('');
  const [submissions, setSubmissions] = useState<any[]>([]);

  if (!isOpen) return null;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPass.trim() === 'admin' || adminPass.trim() === 'gamehub' || adminPass.trim().length > 0) {
      setIsUnlocked(true);
      setAdminErr('');
      if (soundEnabled) playUiSound('pop');
      try {
        const raw = localStorage.getItem('hub_local_feedback');
        setSubmissions(raw ? JSON.parse(raw) : []);
      } catch {}
    } else {
      setAdminErr('Invalid password');
    }
  };

  const handleClearSubmissions = () => {
    localStorage.removeItem('hub_local_feedback');
    setSubmissions([]);
    if (soundEnabled) playUiSound('click');
  };

  return (
    <div
      className="fixed inset-0 z-[650] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (soundEnabled) playUiSound('close');
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-lg max-h-[85vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400 shadow-sm">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">About Game Hub</h3>
              <p className="text-[11px] text-slate-400">Arcade Collection & Platform Info</p>
            </div>
          </div>

          <button
            onClick={() => {
              if (soundEnabled) playUiSound('close');
              onClose();
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <p>
            <strong className="text-white">Game Hub</strong> is an open-source web arcade featuring over 30
            carefully crafted 2D and 3D browser games, ranging from physics sandboxes and retro platformers to
            first-person survival horror and real-time multiplayer card games.
          </p>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-bold">
              <Terminal className="w-4 h-4" />
              <span>Secret Matrix Void Mode</span>
            </div>
            <p className="text-xs text-slate-400">
              Press the <kbd className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-cyan-300 border border-slate-700">`</kbd> (backtick) key anywhere in the hub to launch the 3D retro neon terminal chamber.
            </p>
            <button
              onClick={() => {
                onClose();
                onOpenMatrix();
              }}
              className="mt-1 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Launch Matrix Void Now</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
            <a
              href="https://github.com/Victorxd21/hello21.github.io"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 font-semibold text-xs transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Original Repository</span>
            </a>
          </div>

          {/* Admin Section */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <button
              type="button"
              onClick={() => setIsAdminOpen((prev) => !prev)}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-xs font-bold text-slate-400 hover:text-white transition-colors flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" />
                <span>Admin Portal</span>
              </span>
              <span>{isAdminOpen ? '▲' : '▼'}</span>
            </button>

            {isAdminOpen && (
              <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3 animate-fadeIn">
                {!isUnlocked ? (
                  <form onSubmit={handleUnlock} className="space-y-3">
                    <p className="text-xs text-slate-400">Enter administrator password to inspect community submissions:</p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={adminPass}
                        onChange={(e) => setAdminPass(e.target.value)}
                        placeholder="Admin password (e.g. admin)"
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-400"
                      />
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Unlock</span>
                      </button>
                    </div>
                    {adminErr && <p className="text-xs text-red-400">{adminErr}</p>}
                  </form>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <Check className="w-4 h-4" />
                        <span>Admin Unlocked</span>
                      </span>
                      {submissions.length > 0 && (
                        <button
                          onClick={handleClearSubmissions}
                          className="px-2 py-1 rounded bg-red-500/20 text-red-300 text-[11px] font-semibold hover:bg-red-500/30 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Clear list</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {submissions.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No feedback submissions yet.</p>
                      ) : (
                        submissions.map((s, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
                            <div className="flex items-center justify-between text-slate-400 text-[10px]">
                              <span className="font-bold uppercase text-purple-400">{s.kind}</span>
                              <span>{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'Recent'}</span>
                            </div>
                            {s.gameName && <p className="font-semibold text-white">Target: {s.gameName}</p>}
                            <p className="text-slate-300">{s.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
