import React from 'react';
import {
  Mic,
  MessageSquare,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface MinimalSidebarProps {
  isListening: boolean;
  isMuted: boolean;
  onToggleListening: () => void;
  onToggleMute: () => void;
  onOpenDrawer: () => void;
  onOpenSettings: () => void;
}

const SidebarButton: React.FC<{
  onClick: () => void;
  isActive?: boolean;
  title: string;
  ariaLabel: string;
  children: React.ReactNode;
}> = ({ onClick, isActive, title, ariaLabel, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group relative w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-200 cursor-pointer ${
      isActive
        ? 'bg-[#16161F] text-[#EDEDF2] border-[#AAB4FF]/50 shadow-[0_0_12px_rgba(170,180,255,0.15)]'
        : 'bg-[#121218]/80 text-[#5A5A68] border-[#232330]/60 hover:text-[#EDEDF2] hover:border-[#AAB4FF]/30 hover:bg-[#16161F]/80 hover:shadow-[0_0_8px_rgba(170,180,255,0.08)]'
    }`}
    title={title}
    aria-label={ariaLabel}
  >
    {children}
    {/* Active indicator dot */}
    {isActive && (
      <span className="absolute -right-[5px] w-1 h-1 rounded-full bg-[#AAB4FF] shadow-[0_0_4px_rgba(170,180,255,0.6)]" />
    )}
  </button>
);

export const ArcSidebar: React.FC<MinimalSidebarProps> = ({
  isListening,
  isMuted,
  onToggleListening,
  onToggleMute,
  onOpenDrawer,
  onOpenSettings,
}) => {
  return (
    <aside className="relative z-30 h-full w-14 flex flex-col items-center justify-between py-5 select-none border-r border-[#232330]/50 shrink-0 glass-subtle">
      {/* Top: Brand glyph & primary actions */}
      <div className="flex flex-col items-center gap-5 w-full">
        {/* Brand Glyph */}
        <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-1">
          <span
            className="text-[15px] font-semibold tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #EDEDF2 0%, #AAB4FF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            S
          </span>
        </div>

        {/* Microphone */}
        <SidebarButton
          onClick={onToggleListening}
          isActive={isListening}
          title={isListening ? 'Stop Listening' : 'Start Listening (Space)'}
          ariaLabel="Toggle Voice Listening"
        >
          <Mic className="w-4 h-4" />
        </SidebarButton>

        {/* History */}
        <SidebarButton
          onClick={onOpenDrawer}
          title="Conversation history (H)"
          ariaLabel="Open History"
        >
          <MessageSquare className="w-4 h-4" />
        </SidebarButton>
      </div>

      {/* Subtle center divider */}
      <div className="w-5 h-px bg-gradient-to-r from-transparent via-[#232330] to-transparent" />

      {/* Bottom: Audio & settings */}
      <div className="flex flex-col items-center gap-5 w-full">
        {/* Mute toggle */}
        <SidebarButton
          onClick={onToggleMute}
          isActive={isMuted}
          title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
          ariaLabel="Toggle Mute"
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </SidebarButton>

        {/* Settings */}
        <SidebarButton
          onClick={onOpenSettings}
          title="Preferences (S)"
          ariaLabel="Open Settings"
        >
          <Settings className="w-4 h-4" />
        </SidebarButton>
      </div>
    </aside>
  );
};
