import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Volume2,
  VolumeX,
  MessageSquare,
  Send,
  RotateCcw,
  Terminal,
  Settings,
  ChevronDown,
} from 'lucide-react';
import type { AssistantState } from '../types';

interface ControlsProps {
  state?: AssistantState;
  isListening: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  onToggleListening: () => void;
  onStopPlayback: () => void;
  onToggleMute: () => void;
  onSendMessage: (text: string) => void;
  onClearHistory: () => void;
  onOpenDrawer: () => void;
  onOpenSettings?: () => void;
  unreadCount?: number;
}

export const Controls: React.FC<ControlsProps> = ({
  isListening,
  isPlaying,
  isMuted,
  onToggleListening,
  onStopPlayback,
  onToggleMute,
  onSendMessage,
  onClearHistory,
  onOpenDrawer,
  onOpenSettings,
  unreadCount = 0,
}) => {
  const [inputText, setInputText] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const isForceVisible = showTextInput || isPinned;

  return (
    <div className="fixed bottom-0 inset-x-0 pb-6 pt-10 flex flex-col items-center justify-end group/dock z-30 pointer-events-none">
      {/* Sleek minimal peek indicator when dock is hidden */}
      {!isForceVisible && (
        <div className="pointer-events-auto flex flex-col items-center gap-1 cursor-pointer transition-all duration-300 group-hover/dock:opacity-0 group-hover/dock:translate-y-2 mb-1">
          <div className="w-12 h-1 rounded-full bg-zinc-800 hover:bg-zinc-600 transition-colors" />
        </div>
      )}

      {/* Dock Content Container - hidden by default, smoothly reveals on hover or when pinned/typing */}
      <div
        className={`pointer-events-auto flex flex-col items-center gap-3 transition-all duration-300 ease-out ${
          isForceVisible
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-4 scale-95 group-hover/dock:opacity-100 group-hover/dock:translate-y-0 group-hover/dock:scale-100'
        }`}
      >
        {/* Minimal text input fallback */}
        {showTextInput && (
          <form
            onSubmit={handleSend}
            className="w-80 sm:w-96 flex items-center gap-2 bg-black border border-zinc-800 rounded-2xl p-2 shadow-2xl transition-all duration-200"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask Sam..."
              className="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-600 px-3 focus:outline-none font-mono"
              autoFocus
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="px-3 py-1.5 rounded-xl bg-white text-black hover:bg-zinc-200 disabled:opacity-30 disabled:hover:bg-white text-xs font-semibold transition-all cursor-pointer"
              title="Send"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* Floating Minimal Action Dock */}
        <div className="flex items-center gap-3 sm:gap-4 bg-black/95 border border-zinc-800/90 rounded-full px-5 py-2 shadow-2xl backdrop-blur-md">
          {/* Reset conversation */}
          <button
            onClick={onClearHistory}
            className="p-2 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
            title="Reset conversation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Mute toggle */}
          <button
            onClick={onToggleMute}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              isMuted
                ? 'text-white bg-zinc-900'
                : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Primary Action Button (Mic / Interrupt) */}
          {isPlaying ? (
            <button
              onClick={onStopPlayback}
              className="w-12 h-12 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow-lg"
              title="Stop speaking"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              onClick={onToggleListening}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                isListening
                  ? 'bg-black text-white border-2 border-white shadow-[0_0_20px_rgba(255,255,255,0.4)] animate-pulse'
                  : 'bg-white text-black hover:bg-zinc-200 shadow-md'
              }`}
              title={isListening ? 'Stop listening' : 'Speak'}
            >
              {isListening ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Toggle Text Input */}
          <button
            onClick={() => setShowTextInput((prev) => !prev)}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              showTextInput
                ? 'text-white bg-zinc-900'
                : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
            }`}
            title="Text input"
          >
            <Terminal className="w-4 h-4" />
          </button>

          {/* Transcript Drawer Toggle */}
          <button
            onClick={onOpenDrawer}
            className="relative p-2 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
            title="Transcript"
          >
            <MessageSquare className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-white ring-2 ring-black" />
            )}
          </button>

          {/* Settings button */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* Pin/Dismiss toggle */}
          <button
            onClick={() => setIsPinned((prev) => !prev)}
            className={`p-1.5 rounded-full text-[10px] transition-colors cursor-pointer ${
              isPinned ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'
            }`}
            title={isPinned ? 'Unpin dock (auto-hide)' : 'Pin dock (keep visible)'}
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${isPinned ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
