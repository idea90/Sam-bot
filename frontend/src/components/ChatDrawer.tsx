import React, { useEffect, useRef } from 'react';
import { X, Volume2, Copy, Check, Trash2, ExternalLink, Globe, Loader2, MessageSquare, Music, Disc3 } from 'lucide-react';
import { getToolConfig } from './ToolStatusBadge';
import type { Message } from '../types';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onClearHistory: () => void;
  onPlayMessage?: (text: string) => void;
  isThinking?: boolean;
  thinkingDetail?: string | null;
  activeToolName?: string | null;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  onClearHistory,
  onPlayMessage,
  isThinking,
  thinkingDetail,
  activeToolName,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages, isThinking]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#08080B]/80 animate-backdrop-fade"
        onClick={onClose}
      />

      {/* Drawer Container — slides in from right */}
      <div className="relative w-full max-w-md glass border-l border-[#232330]/50 rounded-l-2xl flex flex-col h-full z-10 animate-slide-in-right shadow-[-8px_0_40px_rgba(0,0,0,0.5)]">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#232330]/50">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#5A5A68]">
            TRANSCRIPT
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClearHistory}
              className="w-8 h-8 rounded-xl bg-transparent border border-[#232330]/60 flex items-center justify-center text-[#5A5A68] hover:text-[#EDEDF2] hover:border-[#AAB4FF]/30 hover:bg-[#16161F]/50 transition-all duration-200 cursor-pointer"
              title="Clear transcript"
              aria-label="Clear Transcript"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-transparent border border-[#232330]/60 flex items-center justify-center text-[#5A5A68] hover:text-[#EDEDF2] hover:border-[#AAB4FF]/30 hover:bg-[#16161F]/50 transition-all duration-200 cursor-pointer"
              title="Close drawer"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4">
              <div className="w-12 h-12 rounded-2xl border border-[#232330]/50 flex items-center justify-center glass">
                <MessageSquare className="w-5 h-5 text-[#5A5A68]" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-medium text-[#5A5A68]">
                  No conversations yet
                </span>
                <span className="text-[11px] font-mono text-[#5A5A68]/60">
                  Start talking or typing to begin
                </span>
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  {/* Attribution */}
                  <div className="flex items-center gap-2 mb-1.5 px-1 text-[11px] font-mono text-[#5A5A68] uppercase tracking-[0.14em]">
                    <span className={isUser ? 'text-[#8C8C9C]' : 'text-[#AAB4FF]/80'}>{isUser ? 'YOU' : 'SAM'}</span>
                    <span className="text-[#232330]">·</span>
                    <span>
                      {new Date(m.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-[15px] font-normal leading-relaxed border transition-all ${
                      isUser
                        ? 'bg-[#16161F]/80 border-[#232330]/60 text-[#EDEDF2]'
                        : 'bg-[#121218]/50 border-[#232330]/40 text-[#8C8C9C] border-l-2 border-l-[#AAB4FF]/20'
                    }`}
                  >
                    {/* Tool badge */}
                    {!isUser && m.toolUsed && (() => {
                      const { icon: ToolIcon, label } = getToolConfig(m.toolUsed);
                      return (
                        <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#232330]/60 bg-[#16161F]/60 text-[11px] font-mono uppercase tracking-[0.14em] text-[#8C8C9C]">
                          <ToolIcon className="w-3.5 h-3.5 text-[#AAB4FF]" />
                          <span>VIA {label}</span>
                        </div>
                      );
                    })()}
                    <p className="whitespace-pre-wrap">{m.text}</p>

                    {/* Fetched Image */}
                    {!isUser && m.image && (
                      <a
                        href={m.image.source_url || m.image.data_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={m.image.title}
                        className="block mt-3"
                      >
                        <img
                          src={m.image.data_url}
                          alt={m.image.title}
                          className="w-full rounded-xl border border-[#232330]/50 hover:border-[#AAB4FF]/30 transition-colors"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      </a>
                    )}

                    {/* Played Track Card (YouTube Music) */}
                    {!isUser && m.media && (
                      <div className="mt-3 p-2.5 rounded-xl bg-[#16161F]/80 border border-[#232330] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-[#121218] shrink-0 border border-[#232330]">
                            <img
                              src={m.media.thumbnail}
                              alt={m.media.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                              <Disc3 className="w-4 h-4 text-white/80" />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-[12px] font-medium text-[#EDEDF2] truncate" title={m.media.title}>
                              {m.media.title}
                            </h5>
                            <p className="text-[10px] text-[#8C8C9C] truncate flex items-center gap-1">
                              <Music className="w-2.5 h-2.5 text-[#AAB4FF]" />
                              <span>{m.media.channel}</span>
                            </p>
                          </div>
                        </div>
                        <a
                          href={m.media.music_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-[#121218] border border-red-500/30 hover:border-red-500/60 text-red-400 text-[10px] font-mono shrink-0 flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          <span>YT MUSIC</span>
                        </a>
                      </div>
                    )}

                    {/* Cited Sources */}
                    {!isUser && m.sources && m.sources.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-[#232330]/40">
                        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-[#5A5A68] mb-2">
                          <Globe className="w-3 h-3 text-[#AAB4FF]/70" />
                          <span>SOURCES CONSULTED</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {m.sources.map((s, idx) => (
                            <a
                              key={idx}
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={s.title}
                              className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#16161F]/50 hover:bg-[#16161F] border border-[#232330]/50 hover:border-[#AAB4FF]/30 text-[11px] font-mono text-[#8C8C9C] hover:text-[#EDEDF2] transition-all duration-200"
                            >
                              <img
                                src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=32`}
                                alt=""
                                className="w-3 h-3 rounded-full shrink-0 object-contain"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                }}
                              />
                              <span className="truncate max-w-[130px]">{s.domain || s.title}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-[#5A5A68] group-hover:text-[#AAB4FF]" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Message Actions */}
                    <div className="mt-3 pt-2 border-t border-[#232330]/30 flex items-center gap-3">
                      {!isUser && onPlayMessage && (
                        <button
                          type="button"
                          onClick={() => onPlayMessage(m.text)}
                          className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-[0.14em] text-[#5A5A68] hover:text-[#EDEDF2] transition-colors cursor-pointer"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>PLAY</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopy(m.id, m.text)}
                        className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-[0.14em] text-[#5A5A68] hover:text-[#EDEDF2] transition-colors cursor-pointer"
                      >
                        {copiedId === m.id ? (
                          <>
                            <Check className="w-3 h-3 text-[#AAB4FF]" />
                            <span className="text-[#AAB4FF]">COPIED</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>COPY</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Live Thinking Bubble */}
          {isThinking && (
            <div className="flex flex-col items-start animate-badge-enter">
              <div className="flex items-center gap-2 mb-1.5 px-1 text-[11px] font-mono uppercase tracking-[0.14em]">
                <span className="text-[#AAB4FF]/80">SAM</span>
                <span className="text-[#232330]">·</span>
                <span className="text-[#AAB4FF] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#AAB4FF] animate-pulse" />
                  <span>THINKING NOW</span>
                </span>
              </div>

              <div className="max-w-[88%] rounded-2xl px-4 py-3 text-[14px] font-normal leading-relaxed glass border border-[#AAB4FF]/20 text-[#EDEDF2] border-l-2 border-l-[#AAB4FF]/40">
                {activeToolName && (() => {
                  const { icon: ToolIcon, label } = getToolConfig(activeToolName);
                  return (
                    <div className="mb-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#AAB4FF]/20 bg-[#16161F]/60 text-[11px] font-mono uppercase tracking-[0.14em] text-[#AAB4FF]">
                      <ToolIcon className="w-3.5 h-3.5 text-[#AAB4FF] animate-pulse" />
                      <span>VIA {label}</span>
                    </div>
                  );
                })()}

                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-4 h-4 text-[#AAB4FF] animate-spin shrink-0" />
                  <span className="text-[14px] text-[#EDEDF2] font-normal">
                    {thinkingDetail || 'Thinking about your request...'}
                  </span>
                </div>

                <div className="flex items-center gap-1 mt-2.5 pl-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#AAB4FF] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#AAB4FF] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#AAB4FF] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
};
