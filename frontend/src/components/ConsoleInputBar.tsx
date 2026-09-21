import React, { useState } from 'react';
import { Mic, MicOff, Square, CornerDownLeft, Volume2, VolumeX } from 'lucide-react';
import type { AssistantState } from '../types';

interface ConsoleInputBarProps {
  state: AssistantState;
  isListening: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  autoSpeak: boolean;
  onToggleListening: () => void;
  onStopPlayback: () => void;
  onToggleMute: () => void;
  onToggleAutoSpeak: () => void;
  onSendMessage: (text: string) => void;
}

export const ConsoleInputBar: React.FC<ConsoleInputBarProps> = ({
  state,
  isListening,
  isPlaying,
  isMuted,
  autoSpeak,
  onToggleListening,
  onStopPlayback,
  onToggleMute,
  onToggleAutoSpeak,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <footer className="w-full border-t border-zinc-800 bg-zinc-950 p-4 shrink-0 z-20">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center gap-3">
        {/* Main Mic / Action Button */}
        {isPlaying ? (
          <button
            onClick={onStopPlayback}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-zinc-200 hover:bg-white text-zinc-950 font-mono text-xs font-bold transition-all cursor-pointer shrink-0 shadow-xs"
            title="Interrupt voice playback [Esc]"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>INTERRUPT</span>
          </button>
        ) : isListening ? (
          <button
            onClick={onToggleListening}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold transition-all cursor-pointer shrink-0 shadow-md shadow-red-950 animate-pulse"
            title="Stop recording and send [Space]"
          >
            <MicOff className="w-4 h-4" />
            <span>STOP / SEND</span>
          </button>
        ) : (
          <button
            onClick={onToggleListening}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-white font-mono text-xs font-semibold transition-all cursor-pointer shrink-0"
            title="Start voice dictation [Space]"
          >
            <Mic className="w-4 h-4 text-red-500" />
            <span>RECORD [SPACE]</span>
          </button>
        )}

        {/* Text Input Terminal */}
        <form onSubmit={handleSubmit} className="flex-1 w-full flex items-center gap-2 relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              state === 'thinking'
                ? 'Sam is processing...'
                : 'Type a message or click Record to speak...'
            }
            disabled={state === 'thinking'}
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-500 rounded-md px-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || state === 'thinking'}
            className="absolute right-2 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-zinc-300 font-mono text-[11px] flex items-center gap-1 transition-all cursor-pointer"
            title="Send [Enter]"
          >
            <span className="hidden sm:inline">SEND</span>
            <CornerDownLeft className="w-3 h-3" />
          </button>
        </form>

        {/* Audio Console Switches */}
        <div className="flex items-center gap-3 shrink-0 text-xs font-mono text-zinc-400 select-none">
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-200 transition-colors">
            <input
              type="checkbox"
              checked={autoSpeak}
              onChange={onToggleAutoSpeak}
              className="accent-white rounded-xs cursor-pointer w-3.5 h-3.5"
            />
            <span className="text-[11px]">AUTO-VOICE</span>
          </label>

          <button
            onClick={onToggleMute}
            className={`p-2 rounded border transition-colors cursor-pointer ${
              isMuted
                ? 'border-red-900 bg-red-950/40 text-red-400'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </footer>
  );
};
