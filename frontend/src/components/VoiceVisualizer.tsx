import React, { useEffect, useRef } from 'react';
import type { AssistantState } from '../types';

interface VoiceVisualizerProps {
  state: AssistantState;
  analyserRef: React.RefObject<AnalyserNode | null>;
  interimTranscript?: string;
  isListening?: boolean;
  onToggleListening?: () => void;
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({
  state,
  analyserRef,
  interimTranscript,
  isListening,
  onToggleListening,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Soundwave canvas animation in pure monochrome
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const bufferLength = 28;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameId = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (state === 'speaking' && analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);

        const barWidth = (width / bufferLength) * 1.4;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height * 0.8;

          // Pure white to silver monochrome gradient
          const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
          gradient.addColorStop(0, '#ffffff');
          gradient.addColorStop(1, '#71717a');

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(
            x,
            (height - barHeight) / 2,
            Math.max(1.5, barWidth - 3),
            Math.max(3, barHeight),
            2
          );
          ctx.fill();

          x += barWidth;
        }
      } else if (state === 'listening') {
        // Minimal ambient listening wave in pure white
        const time = Date.now() * 0.005;
        const barWidth = (width / bufferLength) * 1.4;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const sine = Math.sin(time + i * 0.35);
          const barHeight = Math.max(4, (sine + 1) * 10);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.beginPath();
          ctx.roundRect(
            x,
            (height - barHeight) / 2,
            Math.max(1.5, barWidth - 3),
            barHeight,
            2
          );
          ctx.fill();

          x += barWidth;
        }
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [state, analyserRef]);

  // Monochrome Orb styles
  const getOrbClasses = () => {
    switch (state) {
      case 'listening':
        return 'from-white via-zinc-200 to-zinc-400 shadow-[0_0_60px_rgba(255,255,255,0.45)] animate-orb-listening';
      case 'thinking':
        return 'from-zinc-100 via-zinc-400 to-zinc-700 shadow-[0_0_50px_rgba(255,255,255,0.3)] animate-spin duration-1000';
      case 'speaking':
        return 'from-white via-zinc-100 to-zinc-300 shadow-[0_0_80px_rgba(255,255,255,0.65)] animate-orb-speaking';
      case 'error':
        return 'from-zinc-400 via-zinc-600 to-zinc-900 border border-zinc-600';
      case 'idle':
      default:
        return 'from-white via-zinc-200 to-zinc-400 shadow-[0_0_35px_rgba(255,255,255,0.2)] animate-orb-idle';
    }
  };

  const getStatusLabel = () => {
    switch (state) {
      case 'listening':
        return 'LISTENING';
      case 'thinking':
        return 'THINKING';
      case 'speaking':
        return 'SPEAKING';
      case 'error':
        return 'DISCONNECTED';
      case 'idle':
      default:
        return 'READY';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center relative py-6">
      {/* Outer concentric hairline rings */}
      <div className="relative flex items-center justify-center">
        {state === 'speaking' && (
          <div className="absolute w-72 h-72 rounded-full border border-white/10 animate-ping opacity-50 pointer-events-none" />
        )}
        {state === 'listening' && (
          <div className="absolute w-72 h-72 rounded-full border border-white/15 animate-pulse pointer-events-none" />
        )}

        {/* Outer ring */}
        <div className="w-56 h-56 rounded-full border border-zinc-900 flex items-center justify-center p-4 bg-black/40">
          {/* Middle ring */}
          <div className="w-48 h-48 rounded-full border border-zinc-800/80 flex items-center justify-center p-3">
            {/* The Minimal Monochrome Orb */}
            <div
              onClick={onToggleListening}
              title={
                isListening
                  ? "Click to stop listening"
                  : state === 'speaking'
                  ? "Click to interrupt"
                  : "Click to speak with Sam"
              }
              className={`w-36 h-36 rounded-full bg-gradient-to-tr transition-all duration-700 flex items-center justify-center cursor-pointer select-none hover:scale-[1.03] active:scale-[0.98] ${getOrbClasses()}`}
            >
              {/* Inner core depth */}
              <div className="w-24 h-24 rounded-full bg-white/40 blur-[1px] flex items-center justify-center pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-white/80 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time soundwave bar canvas */}
      <div className="h-12 mt-4 flex items-center justify-center w-full max-w-xs">
        <canvas
          ref={canvasRef}
          width={280}
          height={40}
          className={`transition-opacity duration-300 ${
            state === 'speaking' || state === 'listening' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>

      {/* Minimal State Label and Live Transcript preview */}
      <div className="flex flex-col items-center gap-3 mt-1">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-950/80 text-[11px] font-mono tracking-widest text-zinc-400">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              state === 'listening'
                ? 'bg-white animate-ping'
                : state === 'speaking'
                ? 'bg-white animate-pulse'
                : state === 'thinking'
                ? 'bg-zinc-400 animate-bounce'
                : 'bg-zinc-600'
            }`}
          />
          <span>{getStatusLabel()}</span>
        </div>

        {/* Live interim text bubble */}
        {isListening && interimTranscript && (
          <div className="max-w-md mx-4 mt-2 px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200 text-xs font-mono tracking-wide text-center animate-fade-in shadow-xl">
            "{interimTranscript}..."
          </div>
        )}
      </div>
    </div>
  );
};
