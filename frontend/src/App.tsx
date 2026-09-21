import React, { useState, useEffect } from 'react';
import { SiriOrb } from './components/SiriOrb';
import { ChatDrawer } from './components/ChatDrawer';
import { SettingsModal } from './components/SettingsModal';
import { ArcSidebar } from './components/ArcSidebar';
import { ToolStatusBadge } from './components/ToolStatusBadge';
import { MusicPlayerDock } from './components/MusicPlayerDock';
import { useVoiceAssistant } from './hooks/useVoiceAssistant';
import { Mic, ArrowUp, ExternalLink, Globe } from 'lucide-react';

const SUGGESTION_CHIPS = [
  'Start Gaming Mode',
  'Play Bohemian Rhapsody',
  'Open VS Code',
  'Volume up',
  "What's the weather in Tokyo?",
  'Convert 100 USD to EUR',
  'Flip a coin',
];

export function App() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [textInput, setTextInput] = useState('');

  const {
    state,
    messages,
    settings,
    activeToolName,
    thinkingDetail,
    activeSources,
    activeMedia,
    setActiveMedia,
    updateSettings,
    sendMessage,
    clearHistory,
    isListening,
    interimTranscript,
    toggleListening,
    isPlaying,
    isMuted,
    stopPlayback,
    toggleMute,
  } = useVoiceAssistant();

  // Keyboard Shortcuts (Space to talk, S for settings, H for history, Esc to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') {
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement)?.blur();
        }
        return;
      }

      if (e.code === 'Space') {
        // Let a focused button/link handle Space itself instead of also toggling the mic
        const focusedTag = (document.activeElement?.tagName || '').toLowerCase();
        if (focusedTag === 'button' || focusedTag === 'a') {
          return;
        }
        e.preventDefault();
        toggleListening();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setIsSettingsOpen(true);
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setIsDrawerOpen((prev) => !prev);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'Escape') {
        if (isPlaying) {
          stopPlayback();
        }
        setIsDrawerOpen(false);
        setIsSettingsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleListening, toggleMute, isPlaying, stopPlayback]);

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = textInput.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setTextInput('');
  };

  const handlePlayMessage = async (text: string) => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: settings.voice,
          rate: settings.rate,
          pitch: settings.pitch,
        }),
      });
      if (response.ok) {
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.onended = () => URL.revokeObjectURL(audioUrl);
        audio.onerror = () => URL.revokeObjectURL(audioUrl);
        audio.play();
      }
    } catch (e) {
      console.error('Audio playback error:', e);
    }
  };

  const latestMessage = messages[messages.length - 1];
  const latestToolUsed = latestMessage?.role === 'assistant' ? latestMessage.toolUsed : undefined;
  const displayedTool = activeToolName || latestToolUsed;
  const isActiveTool = Boolean(activeToolName) || state === 'searching' || state === 'thinking';
  const latestSources = latestMessage?.role === 'assistant' ? latestMessage.sources : undefined;
  const displayedSources = (activeSources && activeSources.length > 0) ? activeSources : (latestSources || []);
  const latestImage = latestMessage?.role === 'assistant' ? latestMessage.image : undefined;
  const latestMedia = latestMessage?.role === 'assistant' ? latestMessage.media : undefined;
  const displayedMedia = activeMedia || latestMedia;

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-[#08080B] text-[#EDEDF2] select-none font-sans">
      {/* 1. Left Minimal Rail */}
      <ArcSidebar
        isListening={isListening}
        isMuted={isMuted}
        onToggleListening={toggleListening}
        onToggleMute={toggleMute}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 2. Main Canvas */}
      <div className="relative flex-1 h-full flex flex-col justify-between items-center bg-[#08080B] px-6 py-6">
        {/* Ambient glow behind the orb — pure GPU radial gradient without costly blur filter */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%] w-[480px] h-[480px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.04) 0%, rgba(99, 102, 241, 0.015) 35%, transparent 70%)',
          }}
        />
        {/* Top Header Bar */}
        <header className="w-full flex items-center justify-end">
          <div className="flex items-center gap-2">
            {settings.wakeWordEnabled && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#16161F] border border-[#AAB4FF]/30 text-[11px] font-mono uppercase tracking-[0.14em] text-[#AAB4FF]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#AAB4FF] animate-pulse" />
                <span>WAKE WORD ACTIVE</span>
              </span>
            )}
            <span className="px-3 py-1 rounded-full bg-[#16161F] border border-[#232330] text-[11px] font-mono uppercase tracking-[0.14em] text-[#5A5A68]">
              {settings.provider === 'gemini'
                ? settings.modelName === 'gemini-3.8-flash'
                  ? 'Gemini 3.8 Flash'
                  : settings.modelName === 'gemini-3.5-flash-lite'
                  ? 'Gemini 3.5 Lite'
                  : 'Gemini 3.6 Flash'
                : settings.provider === 'groq'
                ? 'Groq Llama 3.1'
                : settings.provider === 'openai'
                ? 'OpenAI GPT-4o-mini'
                : settings.provider === 'local'
                ? (settings.localModel ? `Local · ${settings.localModel}` : 'Local AI')
                : settings.provider === 'demo'
                ? 'Local Demo Mode'
                : 'Auto Engine'}
            </span>
          </div>
        </header>

        {/* Center Stage: The Orb is the single bright element on screen */}
        <main className="flex-1 flex flex-col items-center justify-center -mt-4">
          <SiriOrb
            state={state}
            isListening={isListening}
            interimTranscript={interimTranscript}
            onToggleListening={toggleListening}
            activeToolName={activeToolName}
            thinkingDetail={thinkingDetail}
          />

          {/* Suggestion Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg mx-auto mt-6 px-4">
            {SUGGESTION_CHIPS.map((chip, i) => (
              <button
                key={chip}
                type="button"
                onClick={() => sendMessage(chip)}
                className="px-4 py-2 rounded-full bg-[#16161F]/80 border border-[#232330]/60 text-[13px] font-normal text-[#AAB4FF] hover:border-[#AAB4FF]/30 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(170,180,255,0.08)] active:translate-y-0 transition-all duration-200 cursor-pointer animate-fade-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {chip}
              </button>
            ))}
          </div>
        </main>

        {/* Bottom Zone: Status & Pill Input Bar */}
        <footer className="w-full flex flex-col items-center gap-3 pb-2">
          {/* Metrolist-style Music Player Dock */}
          {displayedMedia && (
            <MusicPlayerDock
              media={displayedMedia}
              onClose={() => setActiveMedia(null)}
            />
          )}

          {/* Fetched Image Display */}
          {latestImage && (
            <a
              href={latestImage.source_url || latestImage.data_url}
              target="_blank"
              rel="noopener noreferrer"
              title={latestImage.title}
              className="flex justify-center animate-badge-enter px-4"
            >
              <img
                src={latestImage.data_url}
                alt={latestImage.title}
                className="max-h-56 max-w-md rounded-2xl border border-[#232330] shadow-[0_8px_32px_rgba(0,0,0,0.6)] object-contain hover:border-[#AAB4FF]/40 transition-colors cursor-pointer"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </a>
          )}

          {/* Pop-up Sources Visited by Sam */}
          {displayedSources && displayedSources.length > 0 && (
            <div className="flex flex-col items-center gap-1.5 animate-badge-enter max-w-xl w-full px-4">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#5A5A68] uppercase tracking-[0.14em]">
                <Globe className="w-3 h-3 text-[#AAB4FF]" />
                <span>SOURCES CONSULTED</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {displayedSources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={src.title}
                    className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass border border-[#232330]/50 hover:border-[#AAB4FF]/30 text-[#8C8C9C] hover:text-[#EDEDF2] transition-all duration-200 cursor-pointer select-none text-[12px] hover:-translate-y-px"
                  >
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${src.domain}&sz=32`}
                      alt=""
                      className="w-3.5 h-3.5 rounded-full shrink-0 object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                    <span className="font-mono text-[11px] tracking-tight truncate max-w-[150px]">
                      {src.domain || src.title}
                    </span>
                    <ExternalLink className="w-3 h-3 text-[#5A5A68] group-hover:text-[#AAB4FF] shrink-0 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Enhanced Animated Tool Status Badge */}
          {(displayedTool || (state === 'thinking' || state === 'searching')) && (
            <ToolStatusBadge
              toolName={displayedTool || 'thinking'}
              isActive={isActiveTool}
              customDetail={thinkingDetail}
            />
          )}

          {/* Input bar — frosted glass with focus glow */}
          <form
            onSubmit={handleSendText}
            className="w-full max-w-xl flex items-center glass border border-[#232330]/50 rounded-full pl-5 pr-2 py-2 transition-all duration-300 focus-within:border-[#AAB4FF]/30 focus-within:shadow-[0_0_20px_rgba(170,180,255,0.08)]"
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Ask Sam anything..."
              className="flex-1 bg-transparent text-[15px] font-normal text-[#EDEDF2] placeholder-[#5A5A68] focus:outline-none"
            />

            <div className="flex items-center gap-2 shrink-0">
              {textInput.trim() && (
                <button
                  type="submit"
                  aria-label="Send message"
                  className="w-9 h-9 rounded-full bg-[#EDEDF2] text-[#08080B] flex items-center justify-center hover:bg-white hover:shadow-[0_0_12px_rgba(255,255,255,0.2)] hover:-translate-y-px active:translate-y-0 transition-all duration-200 cursor-pointer animate-fade-up"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </button>
              )}

              <button
                type="button"
                onClick={toggleListening}
                aria-label="Toggle Microphone"
                title={isListening ? 'Stop Listening' : 'Start Listening (Space)'}
                className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all duration-200 cursor-pointer ${
                  isListening
                    ? 'bg-[#16161F] text-[#EDEDF2] border-[#AAB4FF]/50 shadow-[0_0_12px_rgba(170,180,255,0.15)]'
                    : 'bg-transparent text-[#5A5A68] border-[#232330]/60 hover:text-[#EDEDF2] hover:border-[#AAB4FF]/30'
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>
          </form>
        </footer>
      </div>

      {/* Slide-over Conversation History Drawer */}
      <ChatDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        messages={messages}
        onClearHistory={clearHistory}
        onPlayMessage={handlePlayMessage}
        isThinking={state === 'thinking' || state === 'searching'}
        thinkingDetail={thinkingDetail}
        activeToolName={activeToolName}
      />

      {/* Settings / Preferences Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
      />
    </div>
  );
}

export default App;
