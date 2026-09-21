import React, { useEffect, useRef, useState } from 'react';
import { Activity, Sparkles, Sliders } from 'lucide-react';
import type { AssistantState } from '../types';

interface AudioMonitorPanelProps {
  state: AssistantState;
  activeAnalyserRef: React.RefObject<AnalyserNode | null>;
  onExecutePrompt: (prompt: string) => void;
  voice: string;
}

const PRODUCT_DIRECTIVES = [
  {
    title: 'Executive Summary',
    prompt: 'Summarize the core points of our conversation into structured takeaways and action items.',
    desc: 'Extract key decisions & next steps',
  },
  {
    title: 'System Architecture',
    prompt: 'Analyze the architectural trade-offs and potential bottlenecks of this design.',
    desc: 'Deep-dive into scalability & latency',
  },
  {
    title: 'Critical Review',
    prompt: 'Critique my reasoning, identify blind spots, and propose high-leverage alternatives.',
    desc: 'Stress-test hypotheses & assumptions',
  },
  {
    title: 'Mock Interview',
    prompt: 'Conduct a technical interview session with me. Ask one focused question at a time.',
    desc: 'Interactive voice technical assessment',
  },
];

export const AudioMonitorPanel: React.FC<AudioMonitorPanelProps> = ({
  state,
  activeAnalyserRef,
  onExecutePrompt,
  voice,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [vuLevel, setVuLevel] = useState(0); // 0 to 8 segments

  // Real Hardware Oscilloscope & Frequency Spectral Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const bufferLength = 64;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameId = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Draw oscilloscope grid lines
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 1;
      // Horizontal reference datum lines (-12dB, 0dB, +12dB)
      ctx.beginPath();
      ctx.moveTo(0, height * 0.25);
      ctx.lineTo(width, height * 0.25);
      ctx.moveTo(0, height * 0.5);
      ctx.lineTo(width, height * 0.5);
      ctx.moveTo(0, height * 0.75);
      ctx.lineTo(width, height * 0.75);
      ctx.stroke();

      const analyser = activeAnalyserRef.current;

      if ((state === 'speaking' || state === 'listening') && analyser) {
        analyser.getByteFrequencyData(dataArray);

        // Calculate average RMS for VU Meter
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        setVuLevel(Math.min(8, Math.round((avg / 255) * 8 * 1.6)));

        // Draw frequency bars / oscilloscope waveform
        const barWidth = (width / bufferLength) * 1.2;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * (height * 0.85);

          // Color based on active state (Red for REC, White for Output)
          if (state === 'listening') {
            ctx.fillStyle = i > bufferLength * 0.8 ? '#ef4444' : '#f87171';
          } else {
            ctx.fillStyle = '#fafafa';
          }

          ctx.fillRect(x, height - barHeight, Math.max(1.5, barWidth - 1), barHeight);
          x += barWidth;
        }
      } else if (state === 'thinking') {
        // DSP processing scan pulse
        setVuLevel(0);
        const t = (Date.now() * 0.003) % 1;
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(t * width, 0, 4, height);
      } else {
        // Flat baseline datum
        setVuLevel(0);
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, height - 2);
        ctx.lineTo(width, height - 2);
        ctx.stroke();
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [state, activeAnalyserRef]);

  return (
    <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-zinc-800 bg-zinc-950 flex flex-col p-4 shrink-0 select-none overflow-y-auto">
      {/* Visual Anchor: Oscilloscope & Audio Signal Monitor */}
      <div className="border border-zinc-800 bg-zinc-900/50 rounded-lg p-3">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80 mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-300 font-semibold">
              Signal Monitor
            </span>
          </div>
          {/* Dynamic State Tally */}
          {state === 'listening' ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-950/80 border border-red-800/80 text-[10px] font-mono text-red-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              REC LIVE
            </span>
          ) : state === 'thinking' ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800/80 text-[10px] font-mono text-amber-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              DSP ACTIVE
            </span>
          ) : state === 'speaking' ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-white font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              OUTPUT
            </span>
          ) : (
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
              STANDBY
            </span>
          )}
        </div>

        {/* Real Oscilloscope Canvas */}
        <div className="w-full bg-black border border-zinc-800 rounded p-1 mb-2 relative overflow-hidden">
          <canvas ref={canvasRef} width={280} height={70} className="w-full h-16 block" />
          <div className="absolute top-1 right-2 text-[9px] font-mono text-zinc-600">
            {state === 'listening' ? 'MIC IN' : state === 'speaking' ? 'SPEECH OUT' : 'REF 0dB'}
          </div>
        </div>

        {/* VU Meter & Signal Gain */}
        <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-zinc-500">
          <span>VU</span>
          <div className="flex-1 flex gap-1 h-2">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className={`flex-1 rounded-xs transition-colors duration-75 ${
                  i < vuLevel
                    ? i >= 6
                      ? 'bg-red-500'
                      : i >= 4
                      ? 'bg-amber-400'
                      : 'bg-zinc-200'
                    : 'bg-zinc-800'
                }`}
              />
            ))}
          </div>
          <span>{vuLevel > 0 ? `-${(8 - vuLevel) * 6}dB` : '-INF'}</span>
        </div>
      </div>

      {/* Audio Engine Specs */}
      <div className="border border-zinc-800 bg-zinc-900/40 rounded-lg p-3 mt-3 text-[11px] font-mono space-y-2">
        <div className="flex items-center justify-between text-zinc-400 pb-1.5 border-b border-zinc-800/60">
          <span className="flex items-center gap-1.5">
            <Sliders className="w-3 h-3 text-zinc-500" />
            <span>Format</span>
          </span>
          <span className="text-zinc-200">24kHz 16-bit MP3</span>
        </div>
        <div className="flex items-center justify-between text-zinc-400">
          <span>Voice Node</span>
          <span className="text-zinc-300 truncate max-w-[140px]">{voice}</span>
        </div>
      </div>

      {/* Real Productive Directives (Replacing filler jokes & time chips) */}
      <div className="mt-4 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-2 px-1">
          <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-xs font-semibold text-zinc-300 tracking-tight">
            Workflow Directives
          </span>
        </div>

        <div className="space-y-2 flex-1">
          {PRODUCT_DIRECTIVES.map((item) => (
            <button
              key={item.title}
              onClick={() => onExecutePrompt(item.prompt)}
              className="w-full text-left p-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-800/60 hover:border-zinc-700 transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-medium text-zinc-200 group-hover:text-white">
                  {item.title}
                </span>
                <span className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-400">
                  EXEC &rarr;
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 line-clamp-1 leading-snug">
                {item.desc}
              </p>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};
