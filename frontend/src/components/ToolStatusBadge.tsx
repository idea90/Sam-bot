import React from 'react';
import {
  Clock,
  CloudSun,
  Calculator,
  Globe,
  BookOpen,
  ArrowLeftRight,
  FileText,
  Dices,
  Cpu,
  Book,
  Sparkles,
  Bot,
  Loader2,
  Check,
  Newspaper,
  Music,
  Monitor,
  Gamepad2,
  Image as ImageIcon,
} from 'lucide-react';

interface ToolStatusBadgeProps {
  toolName: string;
  isActive: boolean;
  customDetail?: string | null;
}

interface ToolConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

export const getToolConfig = (rawName: string): ToolConfig => {
  const name = rawName.toLowerCase().replace('mcp:', '');

  if (name.includes('thinking') || name.includes('reason')) {
    return { icon: Sparkles, label: 'REASONING' };
  }
  if (name.includes('media') || name.includes('music') || name.includes('player')) {
    return { icon: Music, label: 'MEDIA PLAYER' };
  }
  if (name.includes('gaming') || name.includes('game')) {
    return { icon: Gamepad2, label: 'GAMING MODE' };
  }
  if (name.includes('image') || name.includes('photo') || name.includes('pic')) {
    return { icon: ImageIcon, label: 'IMAGE' };
  }
  if (name.includes('system_control') || name.includes('control') || name.includes('launch') || name.includes('vol')) {
    return { icon: Monitor, label: 'SYSTEM CONTROL' };
  }
  if (name.includes('news') || name.includes('headline')) {
    return { icon: Newspaper, label: 'NEWS' };
  }
  if (name.includes('clock') || name.includes('time')) {
    return { icon: Clock, label: 'WORLD CLOCK' };
  }
  if (name.includes('weather')) {
    return { icon: CloudSun, label: 'WEATHER' };
  }
  if (name.includes('calc')) {
    return { icon: Calculator, label: 'CALCULATOR' };
  }
  if (name.includes('search')) {
    return { icon: Globe, label: 'WEB SEARCH' };
  }
  if (name.includes('wiki')) {
    return { icon: BookOpen, label: 'WIKIPEDIA' };
  }
  if (name.includes('convert')) {
    return { icon: ArrowLeftRight, label: 'CONVERTER' };
  }
  if (name.includes('note')) {
    return { icon: FileText, label: 'NOTES' };
  }
  if (
    name.includes('random') ||
    name.includes('decision') ||
    name.includes('coin') ||
    name.includes('dice')
  ) {
    return { icon: Dices, label: 'DECISION' };
  }
  if (name.includes('system') || name.includes('diag') || name.includes('info')) {
    return { icon: Cpu, label: 'SYSTEM INFO' };
  }
  if (name.includes('dict') || name.includes('word')) {
    return { icon: Book, label: 'DICTIONARY' };
  }
  if (rawName.startsWith('mcp:')) {
    return { icon: Bot, label: name.toUpperCase() };
  }
  return { icon: Sparkles, label: name.replace(/_/g, ' ').toUpperCase() };
};

export const ToolStatusBadge: React.FC<ToolStatusBadgeProps> = ({ toolName, isActive, customDetail }) => {
  const { icon: ToolIcon, label } = getToolConfig(toolName);

  return (
    <div
      className={`relative inline-flex items-center gap-2.5 px-4 py-2 rounded-full glass border transition-all duration-300 select-none animate-badge-enter overflow-hidden ${
        isActive
          ? 'border-[#AAB4FF]/30 shadow-[0_0_16px_rgba(170,180,255,0.1)]'
          : 'border-[#232330]'
      }`}
    >
      {/* Shimmer sweep overlay when active */}
      {isActive && (
        <div
          className="absolute inset-0 animate-shimmer pointer-events-none rounded-full"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(170, 180, 255, 0.06) 45%, rgba(170, 180, 255, 0.12) 50%, rgba(170, 180, 255, 0.06) 55%, transparent 100%)',
            backgroundSize: '200% 100%',
          }}
        />
      )}

      {/* Tool Icon */}
      <ToolIcon
        className={`w-4 h-4 shrink-0 transition-colors relative z-10 ${
          isActive ? 'text-[#AAB4FF]' : 'text-[#8C8C9C]'
        }`}
      />

      {/* Text Hierarchy */}
      <div className="flex items-center gap-1.5 font-mono text-[12px] tracking-[0.14em] relative z-10">
        <span className="uppercase text-[#8C8C9C]">{isActive ? 'USING' : 'USED'}</span>
        <span className="uppercase font-semibold text-[#EDEDF2]">{label} TOOL</span>
        {customDetail && isActive && (
          <>
            <span className="text-[#5A5A68]">•</span>
            <span className="text-[#AAB4FF] normal-case font-normal truncate max-w-[220px]">
              {customDetail}
            </span>
          </>
        )}
      </div>

      {/* Activity Indicator */}
      <div className="shrink-0 flex items-center pl-0.5 relative z-10">
        {isActive ? (
          <Loader2 className="w-3.5 h-3.5 text-[#AAB4FF] animate-spin" />
        ) : (
          <Check className="w-3.5 h-3.5 text-[#AAB4FF] stroke-[2.5]" />
        )}
      </div>
    </div>
  );
};
