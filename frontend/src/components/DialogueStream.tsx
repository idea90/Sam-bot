import React, { useEffect, useRef } from 'react';
import { Volume2, Copy, Check, User, Bot, Mic, Terminal } from 'lucide-react';
import type { Message } from '../types';

interface DialogueStreamProps {
  messages: Message[];
  isListening: boolean;
  interimTranscript: string;
  onPlayMessage: (text: string) => void;
  isPlaying: boolean;
}

export const DialogueStream: React.FC<DialogueStreamProps> = ({
  messages,
  isListening,
  interimTranscript,
  onPlayMessage,
  isPlaying,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimTranscript]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950">
      {/* Session Header Banner */}
      <div className="h-9 border-b border-zinc-800/80 bg-zinc-900/30 px-6 flex items-center justify-between text-[11px] font-mono text-zinc-400 select-none shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
          <span>SESSION LOG ({messages.length} MESSAGES)</span>
        </div>
        <div className="flex items-center gap-4 text-zinc-500">
          <span>SHORTCUTS: [SPACE] TALK &bull; [ENTER] SEND &bull; [M] MUTE</span>
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              {/* Message Attribution Header */}
              <div className="flex items-center gap-2 mb-1.5 px-1 text-[11px] font-mono text-zinc-500">
                {isUser ? (
                  <>
                    <span className="text-zinc-300 font-semibold flex items-center gap-1">
                      <User className="w-3 h-3 text-zinc-400" />
                      USER
                    </span>
                    <span>&bull;</span>
                    <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </>
                ) : (
                  <>
                    <span className="text-zinc-100 font-semibold flex items-center gap-1">
                      <Bot className="w-3 h-3 text-white" />
                      SAM
                    </span>
                    <span>&bull;</span>
                    <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </>
                )}
              </div>

              {/* Message Bubble Body */}
              <div
                className={`max-w-2xl rounded-lg p-4 text-sm leading-relaxed border transition-all ${
                  isUser
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-100 font-normal shadow-xs'
                    : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-200'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>

                {/* Message Actions */}
                <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs font-mono text-zinc-400 select-none">
                  {!isUser ? (
                    <button
                      onClick={() => onPlayMessage(m.text)}
                      className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-[11px]"
                      title="Replay Voice Audio"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>{isPlaying ? 'PLAYING...' : 'REPLAY AUDIO'}</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                      <Terminal className="w-3 h-3" />
                      INPUT
                    </span>
                  )}

                  <button
                    onClick={() => handleCopy(m.id, m.text)}
                    className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-[11px]"
                    title="Copy Text"
                  >
                    {copiedId === m.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">COPIED</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>COPY</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Real-time Interim Streaming Transcript Bubble */}
        {isListening && (
          <div className="flex flex-col items-start animate-fade-in">
            <div className="flex items-center gap-2 mb-1.5 px-1 text-[11px] font-mono text-red-400">
              <Mic className="w-3 h-3 text-red-500 animate-pulse" />
              <span>LIVE CAPTURE IN PROGRESS</span>
            </div>
            <div className="max-w-2xl rounded-lg p-4 text-sm border border-red-900/60 bg-red-950/20 text-zinc-100 font-mono italic">
              {interimTranscript ? `"${interimTranscript}..."` : 'Listening for your voice...'}
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>
    </div>
  );
};
