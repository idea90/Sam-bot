import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Square,
  Play,
  AlertCircle,
  Clock,
  FileCode2,
  ChevronDown,
  ChevronUp,
  X,
  Maximize2,
  Minimize2,
  Cpu,
  Loader2,
} from 'lucide-react';
import type { AgentStatusPayload, AgentModel } from '../types';

interface AgentCockpitProps {
  status: AgentStatusPayload;
  isOpen: boolean;
  onClose: () => void;
  onDispatch: (instruction: string, model?: string) => Promise<void>;
  onCancel: () => Promise<void>;
  models: AgentModel[];
  onSelectModel?: (modelId: string) => void;
}

export const AgentCockpit: React.FC<AgentCockpitProps> = ({
  status,
  isOpen,
  onClose,
  onDispatch,
  onCancel,
  models,
  onSelectModel,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showFiles, setShowFiles] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(status.model || 'gemini-3.8-flash-high');
  const [isDispatching, setIsDispatching] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Sync selected model with status model if updated externally
  useEffect(() => {
    if (status.model) {
      setSelectedModel(status.model);
    }
  }, [status.model]);

  if (!isOpen) return null;

  const isRunning = status.state === 'running';
  const isCompleted = status.state === 'completed';
  const isError = status.state === 'error';
  const isCancelled = status.state === 'cancelled';

  const handleDispatch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = taskInput.trim();
    if (!trimmed || isRunning || isDispatching) return;
    try {
      setIsDispatching(true);
      await onDispatch(trimmed, selectedModel);
      setTaskInput('');
    } finally {
      setIsDispatching(false);
    }
  };

  const handleCancel = async () => {
    if (!isRunning || isCancelling) return;
    try {
      setIsCancelling(true);
      await onCancel();
    } finally {
      setIsCancelling(false);
    }
  };

  // State styling helper
  const getBadgeStyle = () => {
    if (isRunning) {
      return {
        bg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
        dot: 'bg-cyan-400 animate-ping',
        text: 'AGENT ACTIVE',
      };
    }
    if (isCompleted) {
      return {
        bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
        dot: 'bg-emerald-400',
        text: 'COMPLETED',
      };
    }
    if (isError) {
      return {
        bg: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
        dot: 'bg-rose-400',
        text: 'ERROR',
      };
    }
    if (isCancelled) {
      return {
        bg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
        dot: 'bg-amber-400',
        text: 'CANCELLED',
      };
    }
    return {
      bg: 'bg-[#16161F] border-[#232330] text-[#8C8C9C]',
      dot: 'bg-[#5A5A68]',
      text: 'READY',
    };
  };

  const badge = getBadgeStyle();

  return (
    <div className="fixed top-5 right-5 z-40 w-96 max-w-[calc(100vw-40px)] animate-fade-up select-none">
      <div className="relative rounded-2xl bg-[#121218]/95 backdrop-blur-md border border-[#232330] shadow-[0_12px_40px_rgba(0,0,0,0.7)] overflow-hidden transition-all duration-300 hover:border-[#AAB4FF]/30">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-[#232330]/60 bg-[#0E0E14]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#16161F] border border-[#232330] flex items-center justify-center text-[#AAB4FF] shrink-0">
              <Terminal className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-semibold text-[#EDEDF2] tracking-tight leading-none">
                Antigravity Agent
              </span>
              <span className="text-[10px] font-mono text-[#5A5A68] uppercase tracking-wider mt-0.5">
                Cockpit HUD
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Status Pill */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-medium tracking-wide ${badge.bg}`}
            >
              <span className="relative flex h-1.5 w-1.5">
                {isRunning && (
                  <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${badge.dot}`} />
                )}
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${badge.dot.split(' ')[0]}`} />
              </span>
              <span>{badge.text}</span>
            </span>

            {/* Minimize / Expand Toggle */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-lg text-[#5A5A68] hover:text-[#EDEDF2] hover:bg-[#1C1C26] transition-colors"
              title={isExpanded ? 'Collapse HUD' : 'Expand HUD'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-[#5A5A68] hover:text-[#EDEDF2] hover:bg-[#1C1C26] transition-colors"
              title="Close HUD"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Expanded Content View */}
        {isExpanded && (
          <div className="p-3.5 flex flex-col gap-3">
            {/* Task Description */}
            {status.current_task ? (
              <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-[#0A0A0E] border border-[#1E1E28]">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#5A5A68]">
                  <span className="uppercase tracking-wider">Active Task</span>
                  {status.duration_seconds > 0 && (
                    <span className="flex items-center gap-1 text-[#8C8C9C]">
                      <Clock className="w-3 h-3" />
                      {status.duration_seconds}s
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-[#EDEDF2] font-medium line-clamp-2 leading-relaxed">
                  {status.current_task}
                </p>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-[#0A0A0E] border border-[#1E1E28] text-center">
                <p className="text-[12px] text-[#5A5A68] font-mono">
                  No task active. Ready for coding assignment.
                </p>
              </div>
            )}

            {/* Active Action / Tool Summary */}
            {isRunning && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#16161F] border border-cyan-500/20 text-[11px] text-cyan-200">
                <Loader2 className="w-3 h-3 animate-spin shrink-0 text-cyan-400" />
                <span className="font-mono truncate">
                  {status.active_tool_summary || status.active_tool || 'Analyzing and planning steps...'}
                </span>
              </div>
            )}

            {/* Error Display */}
            {isError && status.error && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="font-mono leading-tight">{status.error}</span>
              </div>
            )}

            {/* Live Console Output Snippet */}
            {status.latest_output && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#5A5A68]">
                  Live Stream Output
                </span>
                <div className="p-2 rounded-lg bg-[#07070A] border border-[#1C1C26] max-h-24 overflow-y-auto font-mono text-[11px] text-[#AAB4FF] leading-snug whitespace-pre-wrap select-text">
                  {status.latest_output}
                </div>
              </div>
            )}

            {/* Modified Files Section */}
            {status.files_modified && status.files_modified.length > 0 && (
              <div className="flex flex-col gap-1 border border-[#232330] rounded-xl overflow-hidden bg-[#0D0D12]">
                <button
                  type="button"
                  onClick={() => setShowFiles(!showFiles)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] text-[#8C8C9C] hover:text-[#EDEDF2] transition-colors"
                >
                  <span className="flex items-center gap-1.5 font-mono">
                    <FileCode2 className="w-3 h-3 text-[#AAB4FF]" />
                    {status.files_modified.length} File{status.files_modified.length > 1 ? 's' : ''} Modified
                  </span>
                  {showFiles ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {showFiles && (
                  <div className="p-2 pt-0 max-h-24 overflow-y-auto flex flex-col gap-1">
                    {status.files_modified.map((f, i) => (
                      <span key={i} className="text-[10px] font-mono text-[#AAB4FF] truncate bg-[#16161F] px-2 py-0.5 rounded">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Model Selector and Status Footer */}
            <div className="flex items-center justify-between gap-2 text-[11px] pt-1 border-t border-[#232330]/40">
              <div className="flex items-center gap-1.5 text-[#5A5A68]">
                <Cpu className="w-3 h-3 text-[#AAB4FF]" />
                {models.length > 0 ? (
                  <select
                    value={selectedModel}
                    onChange={(e) => {
                      setSelectedModel(e.target.value);
                      if (onSelectModel) onSelectModel(e.target.value);
                    }}
                    disabled={isRunning}
                    aria-label="Select Coding Agent Model"
                    className="bg-transparent text-[11px] font-mono text-[#EDEDF2] focus:outline-none cursor-pointer disabled:opacity-50"
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#16161F] text-[#EDEDF2]">
                        {m.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="font-mono text-[#8C8C9C]">{status.model}</span>
                )}
              </div>

              {/* Running Cancel button */}
              {isRunning && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isCancelling}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-[11px] font-mono transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                  <span>{isCancelling ? 'Stopping...' : 'Cancel'}</span>
                </button>
              )}
            </div>

            {/* Dispatch New Task Input (when not busy) */}
            {!isRunning && (
              <form onSubmit={handleDispatch} className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  placeholder="Assign task to Antigravity..."
                  disabled={isDispatching}
                  className="flex-1 bg-[#0A0A0E] border border-[#232330] rounded-xl px-2.5 py-1.5 text-[12px] text-[#EDEDF2] placeholder-[#5A5A68] focus:outline-none focus:border-[#AAB4FF]/40 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!taskInput.trim() || isDispatching}
                  className="px-3 py-1.5 rounded-xl bg-[#AAB4FF] text-[#08080B] font-medium text-[11px] flex items-center gap-1 hover:bg-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isDispatching ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Dispatch</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
