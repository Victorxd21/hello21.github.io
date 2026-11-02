import React from 'react';
import { DockTab } from '../types/game';
import { Home, Compass, Sparkles, Mail, Info, FileText } from 'lucide-react';
import { playUiSound } from '../utils/audio';

interface DockNavigationProps {
  activeTab: DockTab;
  onSelectTab: (tab: DockTab) => void;
  hasNewAnnouncements?: boolean;
  soundEnabled: boolean;
}

export const DockNavigation: React.FC<DockNavigationProps> = ({
  activeTab,
  onSelectTab,
  hasNewAnnouncements = true,
  soundEnabled
}) => {
  const tabs = [
    { id: 'library' as DockTab, label: 'Library', icon: Home },
    { id: 'guide' as DockTab, label: 'Guide', icon: Compass },
    { id: 'whatsnew' as DockTab, label: 'New', icon: Sparkles, hasDot: hasNewAnnouncements },
    { id: 'feedback' as DockTab, label: 'Feedback', icon: Mail },
    { id: 'about' as DockTab, label: 'About', icon: Info },
    { id: 'logs' as DockTab, label: 'Logs', icon: FileText }
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-slate-950/85 backdrop-blur-xl border-t border-slate-800/80 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]"
      aria-label="Main Navigation"
    >
      <div className="flex items-center gap-1 sm:gap-2 px-2 py-1 bg-slate-900/60 rounded-2xl border border-slate-800/60 max-w-lg w-full justify-around">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;

          return (
            <button
              key={t.id}
              onClick={() => {
                if (soundEnabled) playUiSound('click');
                onSelectTab(t.id);
              }}
              className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'text-cyan-400 bg-cyan-500/10 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <div className="relative">
                <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                {t.hasDot && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_6px_#f43f5e]" />
                )}
              </div>
              <span className="text-[10px] tracking-tight">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
