import React, { useState } from 'react';
import { Check, BarChart2, Scale, Copy } from 'lucide-react';
import type { AssistantSettings } from '../types';

interface FloatingCardsProps {
  settings: AssistantSettings;
  onOpenSettings: () => void;
  onSelectPrompt: (prompt: string) => void;
  lastLatencyMs?: number | null;
}

export const FloatingCards: React.FC<FloatingCardsProps> = ({
  settings,
  onOpenSettings,
  onSelectPrompt,
  lastLatencyMs,
}) => {
  const [copied, setCopied] = useState(false);

  const curlCode = `curl -X POST http://localhost:8000/api/chat \\
  -H "Content-Type: application/json" \\
  -d '{"message": "What is the weather in Tokyo?"}'`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(curlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeModelDisplay = settings.modelName || 'llama-3.1-8b-instant';
  const isGroq = settings.provider === 'groq' || (!settings.provider && settings.groqApiKey);

  return (
    <div className="flex flex-col gap-3.5 w-72 lg:w-80 select-none pointer-events-auto">
      {/* 1. Get Started Card with Glowing Neon Halo (from screenshot) */}
      <div className="relative group">
        {/* Neon magenta/purple glow border halo */}
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-pink-500/60 via-purple-600/50 to-indigo-500/40 blur-[3px] opacity-90 group-hover:opacity-100 transition-opacity" />

        <div className="relative bg-[#101014]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-xs shadow-2xl">
          <div className="text-[11px] font-medium text-zinc-400 mb-3 tracking-wide">
            Get Started
          </div>

          <div className="space-y-2.5">
            {/* Step 1 */}
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-zinc-800/90 border border-zinc-700/60 flex items-center justify-center text-white shrink-0">
                <Check className="w-3 h-3 text-white" />
              </div>
              <span className="text-zinc-200 font-medium text-[11px] truncate">
                1. Connect Engine ({isGroq ? 'Groq LPU' : 'Auto / Gemini'})
              </span>
            </div>

            {/* Step 2 */}
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-zinc-800/90 border border-zinc-700/60 flex items-center justify-center text-white shrink-0">
                <Check className="w-3 h-3 text-white" />
              </div>
              <span className="text-zinc-200 font-medium text-[11px] truncate">
                2. Microsoft Neural Voice ({settings.voice.split('-')[2] || 'Guy'})
              </span>
            </div>

            {/* Step 3 */}
            <div
              onClick={() => onSelectPrompt("What's the weather in Tokyo?")}
              className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity"
            >
              <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-black shrink-0 shadow-sm">
                <BarChart2 className="w-3 h-3 text-black" />
              </div>
              <span className="text-zinc-100 font-medium text-[11px] underline decoration-zinc-600 underline-offset-2">
                3. Ask live weather or search
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Model Card (matching Kimi-K2 style from screenshot) */}
      <div
        onClick={onOpenSettings}
        className="bg-[#18181c]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 shadow-xl transition-all hover:-translate-y-0.5 hover:border-white/20 cursor-pointer"
        title="Click to configure models"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-full bg-black border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-white shadow-xs">
            K
          </div>
          <span className="text-[11px] text-zinc-300 font-medium truncate">
            {activeModelDisplay.includes('llama') ? 'Groq-LPU' : 'Kimi-K2.5'}
          </span>
        </div>

        <div className="text-xs font-semibold text-zinc-100 mb-1.5 truncate">
          {activeModelDisplay}
        </div>

        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/40 text-[10px] text-zinc-300 font-mono mb-3">
          <Scale className="w-3 h-3 text-zinc-400" />
          <span>Sparse LPU • ~800 tok/s</span>
        </div>

        <div className="flex items-baseline justify-between pt-1 border-t border-zinc-800/60">
          <span className="text-[10px] text-zinc-400">Input</span>
          <span className="text-sm font-semibold text-white font-mono">
            {lastLatencyMs ? `${lastLatencyMs}ms` : '$1.50'}
          </span>
        </div>
      </div>

      {/* 3. Second Model Card (Gemini / Fallback) */}
      <div
        onClick={onOpenSettings}
        className="bg-[#18181c]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 shadow-xl transition-all hover:-translate-y-0.5 hover:border-white/20 cursor-pointer"
        title="Click to configure models"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-full bg-black border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-white shadow-xs">
            G
          </div>
          <span className="text-[11px] text-zinc-300 font-medium truncate">
            Gemini-3.6
          </span>
        </div>

        <div className="text-xs font-semibold text-zinc-100 mb-1.5 truncate">
          gemini-3.6-flash
        </div>

        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/40 text-[10px] text-zinc-300 font-mono mb-3">
          <Scale className="w-3 h-3 text-zinc-400" />
          <span>Real-Time Voice Agent</span>
        </div>

        <div className="flex items-baseline justify-between pt-1 border-t border-zinc-800/60">
          <span className="text-[10px] text-zinc-400">Input</span>
          <span className="text-sm font-semibold text-white font-mono">
            $1.50
          </span>
        </div>
      </div>

      {/* 4. Copy & Run Code Card (from screenshot) */}
      <div className="bg-[#18181c]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-zinc-400">
            Copy & Run
          </span>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Copy curl command"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 font-mono">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        <div className="bg-black/80 rounded-xl p-2.5 font-mono text-[10px] leading-relaxed text-zinc-300 overflow-x-auto border border-white/5">
          <div className="flex gap-2.5">
            <div className="text-zinc-600 select-none text-right">
              <div>1</div>
              <div>2</div>
              <div>3</div>
              <div>4</div>
            </div>
            <div className="text-zinc-300 overflow-x-auto">
              <div><span className="text-purple-400 font-semibold">curl</span> -X POST http://...</div>
              <div>&nbsp;&nbsp;-H <span className="text-emerald-400">"Content-Type: ..."</span></div>
              <div>&nbsp;&nbsp;-d <span className="text-amber-300">'&#123;"message": "..."&#125;'</span></div>
              <div className="text-zinc-500"># streaming response</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
