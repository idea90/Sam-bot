import React, { useState } from 'react';
import { ExternalLink, X, Music, Disc3, Maximize2, Minimize2 } from 'lucide-react';
import type { MediaPayload } from '../types';

interface MusicPlayerDockProps {
  media: MediaPayload | null;
  onClose: () => void;
}

export const MusicPlayerDock: React.FC<MusicPlayerDockProps> = ({ media, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!media) return null;

  return (
    <div className="w-full max-w-xl animate-badge-enter px-4 select-none">
      <div className="relative rounded-2xl bg-[#121218] border border-[#232330] shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-300 hover:border-[#AAB4FF]/30">
        {/* Top Header / Track Info Bar */}
        <div className="flex items-center justify-between p-3.5 gap-3">
          {/* Left: Thumbnail & Track Details */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Thumbnail with Vinyl Badge */}
            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#16161F] shrink-0 border border-[#232330]">
              <img
                src={media.thumbnail}
                alt={media.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <Disc3 className="w-5 h-5 text-white/90 animate-spin" style={{ animationDuration: '6s' }} />
              </div>
            </div>

            {/* Title & Artist */}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[10px] font-mono text-red-400 uppercase tracking-wider font-semibold">
                  YT MUSIC
                </span>
                {media.duration && (
                  <span className="text-[11px] font-mono text-[#5A5A68]">
                    {media.duration}
                  </span>
                )}
              </div>
              <h4 className="text-[13px] font-medium text-[#EDEDF2] truncate mt-0.5" title={media.title}>
                {media.title}
              </h4>
              <p className="text-[11px] text-[#8C8C9C] truncate flex items-center gap-1">
                <Music className="w-3 h-3 text-[#AAB4FF] shrink-0" />
                <span>{media.channel}</span>
              </p>
            </div>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Toggle Inline Player */}
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="px-2.5 py-1.5 rounded-xl bg-[#16161F] border border-[#232330] hover:border-[#AAB4FF]/30 text-[#8C8C9C] hover:text-[#EDEDF2] text-[11px] font-mono transition-colors flex items-center gap-1 cursor-pointer"
              title={isExpanded ? 'Hide inline player' : 'Watch & listen inline'}
            >
              {isExpanded ? (
                <>
                  <Minimize2 className="w-3 h-3" />
                  <span className="hidden sm:inline">HIDE</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3 h-3" />
                  <span className="hidden sm:inline">PLAYER</span>
                </>
              )}
            </button>

            {/* Direct Link to YouTube Music */}
            <a
              href={media.music_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-xl bg-[#16161F] border border-[#232330] hover:border-red-500/40 hover:text-red-400 text-[#8C8C9C] text-[11px] font-mono transition-colors flex items-center gap-1 cursor-pointer"
              title="Open in YouTube Music (Metrolist style)"
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">YT MUSIC</span>
            </a>

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-transparent border border-[#232330] hover:border-[#AAB4FF]/30 hover:bg-[#16161F] text-[#5A5A68] hover:text-[#EDEDF2] flex items-center justify-center transition-colors cursor-pointer"
              title="Close player"
              aria-label="Close music player"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Expandable Inline Player Iframe */}
        {isExpanded && (
          <div className="border-t border-[#232330] bg-black/40 p-2">
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-[#232330]/60">
              <iframe
                src={media.embed_url}
                title={media.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
