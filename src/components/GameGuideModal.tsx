import React, { useState } from 'react';
import { Game } from '../types/game';
import { Bot, Send, X, Sparkles, Play, Compass } from 'lucide-react';
import { playUiSound } from '../utils/audio';

interface GameGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  games: Game[];
  onSelectGame: (game: Game) => void;
  soundEnabled: boolean;
}

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  recommendedGames?: Game[];
}

export const GameGuideModal: React.FC<GameGuideModalProps> = ({
  isOpen,
  onClose,
  games,
  onSelectGame,
  soundEnabled
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: "👋 Welcome to the Game Guide! Ask me anything about the games in this arcade, or choose a recommendation below:"
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const SUGGESTIONS = [
    'Recommend a horror game',
    'What 3D games do you have?',
    'Recommend a multiplayer game',
    'Find me a game with a good story',
    'What should I play for a quick 10 minutes?',
    'Show me games like Monochrome',
    'What racing or driving games are there?'
  ];

  if (!isOpen) return null;

  const handleQuery = (queryText: string) => {
    if (!queryText.trim() || isTyping) return;

    if (soundEnabled) playUiSound('click');

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: queryText
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const q = queryText.toLowerCase();

      // Score games matching query
      const scored = games.map((g) => {
        let score = 0;
        const blob = `${g.name} ${g.folder || ''} ${g.description} ${g.tags.join(' ')}`.toLowerCase();

        q.split(/\s+/).forEach((term) => {
          if (term.length > 2 && blob.includes(term)) score += 2;
        });

        if (/horror|scary|siren|creepy|closet/.test(q) && /horror|siren|monochrome|fazbear|forsaken/.test(blob)) score += 5;
        if (/multi|friend|player|versus|coop/.test(q) && /multiplayer|blackjack|uno|gartic|werewolf|slither/.test(blob)) score += 5;
        if (/3d|explore|world|realistic|orbit/.test(q) && /3d|explore|race|storm|world|voxel|mesh|live-earth/.test(blob)) score += 5;
        if (/quick|short|minute|fast|casual|retro/.test(q) && /snake|cat|birds|arcade|heads/.test(blob)) score += 4;
        if (/race|racing|car|drive|speed/.test(q) && /race|rocket|storm/.test(blob)) score += 6;
        if (/story|rpg|undertale|dialogue/.test(q) && /story|rpg|determination|monochrome/.test(blob)) score += 5;
        if (/mario|bird|physics|demolition/.test(q) && /mario|angry-birds|physics/.test(blob)) score += 6;
        if (/draw|phone|art|party/.test(q) && /gartic|draw|party/.test(blob)) score += 6;

        return { game: g, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const topMatches = scored.filter((s) => s.score > 0).slice(0, 3).map((s) => s.game);

      let replyText = '';
      if (topMatches.length > 0) {
        replyText = `Here are the top games matching "${queryText}":`;
      } else {
        replyText = `I couldn't find a direct keyword match, but here are popular community favorites from the arcade:`;
        topMatches.push(...games.slice(0, 3));
      }

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: replyText,
        recommendedGames: topMatches
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
      if (soundEnabled) playUiSound('pop');
    }, 450);
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
      <div className="relative w-full max-w-xl h-[80vh] bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-sm">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>AI Game Guide</span>
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              </h3>
              <p className="text-[11px] text-slate-400">Library Explorer & Recommendation Engine</p>
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

        {/* Chat Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'} space-y-2`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-xs shadow-md'
                    : 'bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-bl-xs'
                }`}
              >
                {m.text}
              </div>

              {m.recommendedGames && m.recommendedGames.length > 0 && (
                <div className="w-full max-w-md space-y-2 pt-1">
                  {m.recommendedGames.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => {
                        if (soundEnabled) playUiSound('click');
                        onSelectGame(g);
                      }}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span className="text-2xl">{g.icon}</span>
                        <div className="truncate">
                          <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                            {g.name}
                          </h4>
                          <p className="text-[11px] text-slate-400 capitalize truncate">
                            {g.tags.slice(0, 2).join(' · ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs font-bold shrink-0 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors">
                        <Play className="w-3 h-3 fill-current" />
                        <span>Play</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-mono animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Analyzing game library...</span>
            </div>
          )}

          {/* Prompt Suggestions */}
          <div className="pt-2">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Suggested questions:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleQuery(s)}
                  className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-cyan-950 hover:text-cyan-300 hover:border-cyan-500/40 border border-slate-700/60 text-[11px] font-medium text-slate-300 transition-colors cursor-pointer text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleQuery(input);
          }}
          className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask for game recommendations..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Ask</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
