import React from 'react';
import { Settings, RotateCcw, Volume2, VolumeX, Cpu, Radio } from 'lucide-react';
import type { AssistantSettings } from '../types';

interface HeaderProps {
  onOpenSettings: () => void;
  onClearHistory: () => void;
  onToggleMute: () => void;
  isMuted: boolean;
  settings: AssistantSettings;
  lastLatencyMs: number | null;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onClearHistory,
  onToggleMute,
  isMuted,
  settings,
  lastLatencyMs,
}) => {
  return (
    <header className="w-full h-14 border-b border-zinc-800 bg-zinc-950 px-5 flex items-center justify-between z-20 shrink-0 select-none">
      {/* Brand & Studio Identity */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-xs bg-white" />
          <span className="font-semibold text-sm tracking-tight text-white font-mono">
            SAM
          </span>
        </div>
        <span className="text-zinc-600 font-mono text-xs">/</span>
        <span className="text-xs font-mono tracking-wider text-zinc-400 uppercase">
          Voice Workstation
        </span>
      </div>

      {/* Real Hardware & Model Telemetry */}
      <div className="hidden md:flex items-center gap-4 text-[11px] font-mono text-zinc-400">
        {/* Model Engine */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-zinc-800 bg-zinc-900/60">
          <Cpu className="w-3 h-3 text-zinc-400" />
          <span className="text-zinc-500 uppercase">DSP:</span>
          <span className="text-zinc-200 capitalize">{settings.provider}</span>
        </div>

        {/* Voice Profile */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-zinc-800 bg-zinc-900/60">
          <Radio className="w-3 h-3 text-zinc-400" />
          <span className="text-zinc-500 uppercase">Voice:</span>
          <span className="text-zinc-200">{settings.voice.replace('en-US-', '').replace('Neural', '')}</span>
        </div>

        {/* Latency Meter */}
        {lastLatencyMs !== null && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded border border-zinc-800 bg-zinc-900/60">
            <span className="text-zinc-500 uppercase">RTT:</span>
            <span className="text-emerald-400 font-mono">{lastLatencyMs}ms</span>
          </div>
        )}
      </div>

      {/* Primary Studio Action Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleMute}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono transition-colors cursor-pointer ${
            isMuted
              ? 'border-red-900/60 bg-red-950/40 text-red-400 hover:bg-red-900/40'
              : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
          }`}
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{isMuted ? 'MUTED' : 'AUDIO ON'}</span>
        </button>

        <button
          onClick={onClearHistory}
          className="p-1.5 rounded border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors cursor-pointer"
          title="Reset Session History"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:text-white hover:border-zinc-700 text-xs font-mono transition-colors cursor-pointer"
          title="Workstation Settings"
        >
          <Settings className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">CONFIG</span>
        </button>
      </div>
    </header>
  );
};
