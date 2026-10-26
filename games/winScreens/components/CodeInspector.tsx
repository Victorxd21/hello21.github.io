import React, { useState } from 'react';
import { CODE_ANNOTATIONS } from '../data/windowsAnimData';
import { Code2, Sparkles, ChevronRight, Copy, Check } from 'lucide-react';

export const CodeInspector: React.FC = () => {
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string>(CODE_ANNOTATIONS[0].id);
  const [copied, setCopied] = useState(false);

  const selected = CODE_ANNOTATIONS.find((a) => a.id === selectedAnnotationId) || CODE_ANNOTATIONS[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(selected.snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl text-slate-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-2.5">
          <Code2 className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Source Code Anatomy & Quirks</h3>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          File: <span className="text-cyan-300">FirstLogonAnim_600d6151.html</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800">
        {/* Annotation Selector Sidebar */}
        <div className="p-3 bg-slate-950/60 space-y-1">
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Annotated Code Blocks
          </div>

          {CODE_ANNOTATIONS.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedAnnotationId(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between text-xs ${
                selectedAnnotationId === item.id
                  ? 'bg-blue-600/20 text-white font-medium border border-blue-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <div className="space-y-0.5 truncate pr-2">
                <div className="truncate text-slate-200 font-medium">{item.title}</div>
                <div className="text-[11px] text-slate-400 font-mono">{item.lines}</div>
              </div>
              <ChevronRight
                className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                  selectedAnnotationId === item.id ? 'rotate-90 text-blue-400' : 'text-slate-600'
                }`}
              />
            </button>
          ))}
        </div>

        {/* Selected Annotation Details & Code Snippet */}
        <div className="md:col-span-2 p-5 space-y-4 bg-slate-900/40 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-base font-semibold text-white">{selected.title}</h4>
                <span className="text-xs text-blue-400 font-mono">{selected.lines}</span>
              </div>
              <span className="text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60 font-semibold">
                {selected.category}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
              {selected.details}
            </p>
          </div>

          {/* Code Snippet Box */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-[11px]">Excerpt from FirstLogonAnim.html:</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 hover:text-white transition-colors text-[11px]"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy Snippet'}</span>
              </button>
            </div>

            <div className="relative rounded-lg bg-slate-950 border border-slate-800 p-3.5 overflow-x-auto">
              <pre className="text-xs font-mono text-cyan-200/90 whitespace-pre leading-relaxed">
                {selected.snippet}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
