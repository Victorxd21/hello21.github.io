import React from 'react';
import { Announcement, ChangelogItem } from '../types/game';
import { Sparkles, X, Calendar, Tag } from 'lucide-react';
import { playUiSound } from '../utils/audio';

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcements: Announcement[];
  changelogs: ChangelogItem[];
  soundEnabled: boolean;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({
  isOpen,
  onClose,
  announcements,
  changelogs,
  soundEnabled
}) => {
  const [tab, setTab] = React.useState<'announcements' | 'changelogs'>('announcements');

  if (!isOpen) return null;

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
      <div className="relative w-full max-w-xl max-h-[82vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-pink-500/20 border border-pink-400/40 flex items-center justify-center text-pink-400 shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">What's New & Announcements</h3>
              <p className="text-[11px] text-slate-400">Latest updates, features, and release history</p>
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

        {/* Tabs */}
        <div className="flex px-4 pt-3 gap-2 border-b border-slate-800 bg-slate-950/40">
          <button
            onClick={() => {
              if (soundEnabled) playUiSound('click');
              setTab('announcements');
            }}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors border-b-2 cursor-pointer ${
              tab === 'announcements'
                ? 'border-pink-500 text-pink-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Announcements ({announcements.length})
          </button>
          <button
            onClick={() => {
              if (soundEnabled) playUiSound('click');
              setTab('changelogs');
            }}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors border-b-2 cursor-pointer ${
              tab === 'changelogs'
                ? 'border-pink-500 text-pink-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Changelogs ({changelogs.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === 'announcements' ? (
            announcements.map((a) => (
              <div key={a.id} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/30 text-[10px] font-bold">
                      {a.version}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3" />
                      {a.date}
                    </span>
                  </div>
                  {a.badge && (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-extrabold">
                      {a.badge}
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-bold text-white">{a.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{a.content}</p>
              </div>
            ))
          ) : (
            changelogs.map((c) => (
              <div key={c.version} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="text-cyan-400 font-mono">v{c.version}</span>
                    <span>·</span>
                    <span>{c.title}</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono">{c.date}</span>
                </div>
                <ul className="space-y-1 pl-4 list-disc text-xs text-slate-300">
                  {c.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
