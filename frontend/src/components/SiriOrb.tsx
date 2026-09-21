import React from 'react';
import { Loader2 } from 'lucide-react';
import type { AssistantState } from '../types';

interface SiriOrbProps {
  state: AssistantState;
  isListening: boolean;
  interimTranscript: string;
  onToggleListening: () => void;
  activeToolName?: string | null;
  thinkingDetail?: string | null;
}

export const SiriOrb: React.FC<SiriOrbProps> = ({
  state,
  isListening,
  interimTranscript,
  onToggleListening,
  activeToolName,
  thinkingDetail,
}) => {
  const getStatusText = () => {
    if (isListening || state === 'listening') return 'LISTENING';
    if (state === 'thinking' || state === 'searching') {
      if (thinkingDetail) return thinkingDetail.toUpperCase();
      if (activeToolName) return `USING ${activeToolName.replace('mcp:', '').toUpperCase()}`;
      return 'THINKING';
    }
    if (state === 'speaking') return 'SPEAKING';
    if (state === 'error') return 'DISCONNECTED';
    return 'READY';
  };

  const isThinkingState = state === 'thinking' || state === 'searching';
  const isListeningState = isListening || state === 'listening';
  const isSpeakingState = state === 'speaking';

  // Orb radial gradient per state
  const getOrbStyle = (): React.CSSProperties => {
    if (isListeningState) {
      return {
        background:
          'radial-gradient(circle at 40% 38%, #FFFFFF 0%, #EEF2FF 30%, #C7D2FE 60%, #AAB4FF 85%, #818CF8 100%)',
        boxShadow:
          '0 0 60px rgba(170, 180, 255, 0.5), 0 0 120px rgba(129, 140, 248, 0.2), inset 0 -8px 24px rgba(99, 102, 241, 0.15)',
      };
    }
    if (isThinkingState) {
      return {
        background:
          'radial-gradient(circle at 45% 42%, #9CA3AF 0%, #6B7280 40%, #4B5563 70%, #374151 100%)',
        boxShadow: '0 0 30px rgba(156, 163, 175, 0.15), inset 0 -6px 20px rgba(0, 0, 0, 0.2)',
        opacity: 0.7,
      };
    }
    if (isSpeakingState) {
      return {
        background:
          'radial-gradient(circle at 42% 40%, #FFFFFF 0%, #F0F0FF 25%, #DDDDF8 50%, #C4C4E0 75%, #A5A5C0 100%)',
        boxShadow:
          '0 0 70px rgba(255, 255, 255, 0.45), 0 0 140px rgba(255, 255, 255, 0.15), inset 0 -6px 20px rgba(165, 165, 192, 0.15)',
      };
    }
    // Idle
    return {
      background:
        'radial-gradient(circle at 42% 40%, #FFFFFF 0%, #EDEDF2 35%, #D2D2DC 65%, #B0B0C0 90%, #8E8EA0 100%)',
      boxShadow:
        '0 0 40px rgba(255, 255, 255, 0.2), 0 0 80px rgba(255, 255, 255, 0.08), inset 0 -6px 18px rgba(0, 0, 0, 0.08)',
    };
  };

  // Halo ring styles per state
  const getHaloClasses = (ring: 'inner' | 'outer') => {
    const size = ring === 'inner' ? 'w-44 h-44' : 'w-52 h-52';
    if (isListeningState) {
      return `${size} rounded-full border absolute animate-halo-listen ${
        ring === 'inner' ? 'border-[#AAB4FF]/30' : 'border-[#AAB4FF]/15'
      }`;
    }
    if (isSpeakingState) {
      return `${size} rounded-full border absolute animate-halo-pulse ${
        ring === 'inner' ? 'border-white/20' : 'border-white/10'
      }`;
    }
    // Idle & thinking: subtle static hairline rings
    return `${size} rounded-full border absolute ${
      ring === 'inner' ? 'border-[#232330]/40' : 'border-[#232330]/20'
    }`;
  };

  return (
    <div className="flex flex-col items-center justify-center select-none">
      {/* Orb Container with halo rings */}
      <div className="relative flex items-center justify-center">
        {/* Outer halo ring */}
        <div className={getHaloClasses('outer')} />
        {/* Inner halo ring */}
        <div className={getHaloClasses('inner')} />

        {/* The Orb */}
        <button
          type="button"
          onClick={onToggleListening}
          aria-label="Voice Orb"
          style={getOrbStyle()}
          className={`relative w-36 h-36 rounded-full cursor-pointer transition-transform duration-300 outline-none focus:outline-none z-10 ${
            isListeningState ? 'animate-orb-pulse' : ''
          }`}
        >
          {/* Glass refraction highlight */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 60% 40% at 35% 30%, rgba(255, 255, 255, 0.35) 0%, transparent 70%)',
            }}
          />
        </button>
      </div>

      {/* Status label */}
      <div className="mt-8 flex flex-col items-center gap-2">
        <span className={`text-[11px] font-mono uppercase tracking-[0.14em] transition-colors duration-500 ${
          isListeningState ? 'text-[#AAB4FF]' : isThinkingState ? 'text-[#6B7280]' : 'text-[#5A5A68]'
        }`}>
          {getStatusText()}
        </span>

        {/* Live thinking indicator capsule — frosted glass */}
        {isThinkingState && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-full glass border border-[#AAB4FF]/20 text-[12px] font-mono text-[#AAB4FF] animate-badge-enter mt-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-[#AAB4FF]" />
            <span className="truncate max-w-[260px]">{thinkingDetail || 'Processing your request...'}</span>
            <div className="flex items-center gap-1 ml-0.5">
              <span className="w-1 h-1 rounded-full bg-[#AAB4FF] animate-pulse" />
              <span className="w-1 h-1 rounded-full bg-[#AAB4FF] animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 rounded-full bg-[#AAB4FF] animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {/* Live interim transcript */}
        {isListening && interimTranscript && (
          <p className="text-[15px] font-normal text-[#AAB4FF]/80 text-center max-w-md px-4 mt-2 animate-fade-up">
            &ldquo;{interimTranscript}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
};
