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
  Copy,
  Check,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { AgentStatusPayload, AgentModel, AgentSkill } from '../types';

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
  const [showFiles, setShowFiles] = useState(true);
  const [taskInput, setTaskInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(status.model || 'gemini-2.5-flash');
  const [isDispatching, setIsDispatching] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Engine state
  const currentEngine = status.engine || 'hermes';
  const isHermes = currentEngine === 'hermes';
  const [isSwitchingEngine, setIsSwitchingEngine] = useState(false);
  const [skillsList, setSkillsList] = useState<AgentSkill[]>([]);
  const [showSkills, setShowSkills] = useState(false);

  // Command runner state
  const [commandInput, setCommandInput] = useState('');
  const [commandOutput, setCommandOutput] = useState<string | null>(null);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Auto-fill suggested command when agent creates/modifies files
  useEffect(() => {
    if (status.suggested_command && !commandInput) {
      setCommandInput(status.suggested_command);
    }
  }, [status.suggested_command]);

  // Sync selected model with status model if updated externally
  useEffect(() => {
    if (status.model) {
      setSelectedModel(status.model);
    }
  }, [status.model]);

  // Load Hermes skills list when Hermes is active
  useEffect(() => {
    if (isHermes && skillsList.length === 0) {
      fetch('/api/agent/skills')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.skills) && data.skills.length > 0) {
            setSkillsList(data.skills);
          }
        })
        .catch(() => {});
    }
  }, [isHermes]);

  if (!isOpen) return null;

  const isRunning = status.state === 'running';
  const isCompleted = status.state === 'completed';
  const isError = status.state === 'error';
  const isCancelled = status.state === 'cancelled';

  const handleSwitchEngine = async (engine: 'hermes' | 'coding_agent') => {
    if (isSwitchingEngine || isRunning || engine === currentEngine) return;
    try {
      setIsSwitchingEngine(true);
      const res = await fetch('/api/agent/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.models && data.models.length > 0) {
          const firstModel = data.models[0].id;
          setSelectedModel(firstModel);
          if (onSelectModel) onSelectModel(firstModel);
        }
      }
    } catch (err) {
      console.error('Failed to switch engine:', err);
    } finally {
      setIsSwitchingEngine(false);
    }
  };

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

  const handleRunCommand = async (cmdToRun?: string) => {
    const cmd = (cmdToRun || commandInput).trim();
    if (!cmd || isExecutingCommand) return;
    try {
      setIsExecutingCommand(true);
      setCommandOutput(null);
      const res = await fetch('/api/agent/run-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });
      if (res.ok) {
        const data = await res.json();
        setCommandOutput(data.output || (data.exit_code === 0 ? 'Command finished with 0 errors.' : `Exited with code ${data.exit_code}`));
      } else {
        setCommandOutput(`Failed to execute command: HTTP ${res.status}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCommandOutput(`Execution error: ${msg}`);
    } finally {
      setIsExecutingCommand(false);
    }
  };

  const copyFilePath = (filePath: string, idx: number) => {
    const ws = status.workspace_path || 'C:\\Users\\advice\\Downloads\\CODE\\Sam-bot';
    const fullPath = filePath.includes(':') || filePath.startsWith('/')
      ? filePath
      : `${ws}\\${filePath.replace(/\//g, '\\')}`;
    navigator.clipboard.writeText(fullPath);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
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
    <div className="fixed top-5 right-5 z-40 w-[440px] max-w-[calc(100vw-40px)] animate-fade-up select-none">
      <div className="relative rounded-2xl bg-[#121218]/95 backdrop-blur-md border border-[#232330] shadow-[0_12px_40px_rgba(0,0,0,0.7)] overflow-hidden transition-all duration-300 hover:border-[#AAB4FF]/30">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-[#232330]/60 bg-[#0E0E14]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
              isHermes
                ? 'bg-purple-500/15 border-purple-500/30 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                : 'bg-[#16161F] border-[#232330] text-[#AAB4FF]'
            }`}>
              {isHermes ? <Sparkles className="w-3.5 h-3.5 text-purple-300" /> : <Terminal className="w-3.5 h-3.5" />}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-semibold text-[#EDEDF2] tracking-tight leading-none flex items-center gap-1.5">
                {isHermes ? 'Hermes Agent' : 'Coding Agent'}
                {isHermes && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono font-normal">
                    Nous
                  </span>
                )}
              </span>
              <span className="text-[10px] font-mono text-[#5A5A68] uppercase tracking-wider mt-0.5">
                {isHermes ? '51+ Skills & Tools' : 'Terminal Engine'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Engine Switcher Toggle Pill */}
            <div className="flex items-center p-0.5 rounded-lg bg-[#07070A] border border-[#232330] mr-1">
              <button
                type="button"
                onClick={() => handleSwitchEngine('hermes')}
                disabled={isRunning || isSwitchingEngine}
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition-all cursor-pointer disabled:opacity-50 ${
                  isHermes
                    ? 'bg-purple-600/30 text-purple-200 font-medium border border-purple-500/40 shadow-sm'
                    : 'text-[#6C6C7E] hover:text-[#EDEDF2]'
                }`}
                title="Switch to Hermes Agent (Nous Research)"
              >
                ☤ Hermes
              </button>
              <button
                type="button"
                onClick={() => handleSwitchEngine('coding_agent')}
                disabled={isRunning || isSwitchingEngine}
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition-all cursor-pointer disabled:opacity-50 ${
                  !isHermes
                    ? 'bg-[#AAB4FF]/20 text-[#AAB4FF] font-medium border border-[#AAB4FF]/40 shadow-sm'
                    : 'text-[#6C6C7E] hover:text-[#EDEDF2]'
                }`}
                title="Switch to standard Coding Agent"
              >
                ⚙ Coding
              </button>
            </div>

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
              className="p-1 rounded-lg text-[#5A5A68] hover:text-[#EDEDF2] hover:bg-[#1C1C26] transition-colors cursor-pointer"
              title={isExpanded ? 'Collapse HUD' : 'Expand HUD'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-[#5A5A68] hover:text-[#EDEDF2] hover:bg-[#1C1C26] transition-colors cursor-pointer"
              title="Close HUD"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Expanded Content View */}
        {isExpanded && (
          <div className="p-3.5 flex flex-col gap-3 max-h-[85vh] overflow-y-auto">
            {/* Task Description */}
            {status.current_task ? (
              <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-[#0A0A0E] border border-[#1E1E28]">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#5A5A68]">
                  <span className="uppercase tracking-wider">Active Task ({isHermes ? 'Hermes' : 'Agent'})</span>
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
                  {isHermes ? 'Hermes Agent is idle. Ready for coding or automation.' : 'Coding Agent is idle. Ready for task.'}
                </p>
              </div>
            )}

            {/* Active Action / Tool Summary */}
            {isRunning && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#16161F] border border-cyan-500/20 text-[11px] text-cyan-200">
                <Loader2 className="w-3 h-3 animate-spin shrink-0 text-cyan-400" />
                <span className="font-mono truncate">
                  {status.active_tool_summary || status.active_tool || (isHermes ? 'Hermes reasoning and executing tools...' : 'Analyzing and planning steps...')}
                </span>
              </div>
            )}

            {/* Error Display */}
            {isError && (
              <div className="flex items-start justify-between gap-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px]">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="font-mono leading-tight">{status.error || 'The task encountered an error or was interrupted.'}</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await fetch('/api/agent/reset', { method: 'POST' });
                    } catch (e) {
                      console.error('Failed to reset agent status', e);
                    }
                  }}
                  className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[10px] font-mono shrink-0 cursor-pointer"
                  title="Clear error and reset HUD"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Hermes Skills Section (Only when Hermes is active) */}
            {isHermes && skillsList.length > 0 && (
              <div className="flex flex-col gap-1 border border-purple-500/20 rounded-xl overflow-hidden bg-purple-950/10 p-2">
                <div className="flex items-center justify-between text-[11px]">
                  <button
                    type="button"
                    onClick={() => setShowSkills(!showSkills)}
                    className="flex items-center gap-1.5 text-purple-300 font-mono hover:text-purple-200 transition-colors cursor-pointer"
                  >
                    <Wrench className="w-3 h-3" />
                    <span>Hermes Skills ({skillsList.length})</span>
                    {showSkills ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                  </button>
                  <span className="text-[10px] text-[#6C6C7E] font-mono">click to insert</span>
                </div>

                {showSkills && (
                  <div className="mt-1 flex flex-wrap gap-1 max-h-32 overflow-y-auto pt-1">
                    {skillsList.slice(0, 18).map((s) => (
                      <button
                        key={s.name}
                        type="button"
                        onClick={() => {
                          setTaskInput((prev) =>
                            prev ? `${prev} using skill ${s.name}` : `Use skill ${s.name} to `
                          );
                        }}
                        className="px-2 py-0.5 rounded-md bg-[#16161F] hover:bg-purple-500/20 border border-[#232330] hover:border-purple-500/40 text-[10px] font-mono text-[#C4C7E0] hover:text-purple-200 transition-colors cursor-pointer"
                        title={`Category: ${s.category}`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Live Console Output Snippet */}
            {status.latest_output && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#5A5A68]">
                  Live Stream Output
                </span>
                <div className="p-2 rounded-lg bg-[#07070A] border border-[#1C1C26] max-h-28 overflow-y-auto font-mono text-[11px] text-[#AAB4FF] leading-snug whitespace-pre-wrap select-text">
                  {status.latest_output}
                </div>
              </div>
            )}

            {/* Modified / Created Files Section with Exact Paths */}
            {status.files_modified && status.files_modified.length > 0 && (
              <div className="flex flex-col gap-1 border border-[#232330] rounded-xl overflow-hidden bg-[#0D0D12]">
                <button
                  type="button"
                  onClick={() => setShowFiles(!showFiles)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] text-[#8C8C9C] hover:text-[#EDEDF2] transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 font-mono">
                    <FileCode2 className="w-3 h-3 text-[#AAB4FF]" />
                    {status.files_modified.length} File{status.files_modified.length > 1 ? 's' : ''} Created / Modified
                  </span>
                  {showFiles ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {showFiles && (
                  <div className="p-2 pt-0 max-h-36 overflow-y-auto flex flex-col gap-1.5">
                    {status.files_modified.map((f, i) => {
                      const ws = status.workspace_path || 'C:\\Users\\advice\\Downloads\\CODE\\Sam-bot';
                      const fullPath = f.includes(':') || f.startsWith('/')
                        ? f
                        : `${ws}\\${f.replace(/\//g, '\\')}`;
                      return (
                        <div
                          key={f}
                          className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-[#14141C] border border-[#1F1F2B] text-[11px] font-mono"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-[#EDEDF2] truncate font-medium">{f}</span>
                            <span className="text-[10px] text-[#5A5A68] truncate select-all">{fullPath}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyFilePath(f, i)}
                            className="p-1 rounded hover:bg-[#232330] text-[#AAB4FF] transition-colors shrink-0 cursor-pointer"
                            title="Copy Full File Path"
                          >
                            {copiedIndex === i ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Terminal Command Runner */}
            <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-[#0A0A0E] border border-[#1E1E28]">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-[#8C8C9C] flex items-center gap-1">
                  <Terminal className="w-3 h-3 text-emerald-400" />
                  Terminal Command
                </span>
                {status.suggested_command && (
                  <button
                    type="button"
                    onClick={() => {
                      setCommandInput(status.suggested_command || '');
                      handleRunCommand(status.suggested_command || undefined);
                    }}
                    disabled={isExecutingCommand}
                    className="flex items-center gap-1 text-[10px] text-emerald-300 hover:text-emerald-200 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-2.5 h-2.5 fill-current" />
                    <span>Run Suggested</span>
                  </button>
                )}
              </div>

              {/* Command Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRunCommand();
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  placeholder="e.g. python scratch/hello_sam.py"
                  disabled={isExecutingCommand}
                  className="flex-1 bg-[#07070A] border border-[#232330] rounded-lg px-2 py-1 text-[11px] font-mono text-[#EDEDF2] placeholder-[#5A5A68] focus:outline-none focus:border-[#AAB4FF]/40 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!commandInput.trim() || isExecutingCommand}
                  className="px-2.5 py-1 rounded-lg bg-[#232330] hover:bg-[#2F2F40] text-[#EDEDF2] text-[11px] font-mono flex items-center gap-1 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {isExecutingCommand ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Play className="w-2.5 h-2.5 fill-current text-emerald-400" />
                      <span>Run</span>
                    </>
                  )}
                </button>
              </form>

              {/* Command Execution Output Console */}
              {commandOutput && (
                <div className="mt-1 p-2 rounded-lg bg-[#060608] border border-[#1A1A24] max-h-28 overflow-y-auto font-mono text-[10px] text-emerald-300 leading-snug whitespace-pre-wrap select-text">
                  {commandOutput}
                </div>
              )}
            </div>

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
                    aria-label="Select Agent Model"
                    className="bg-transparent text-[11px] font-mono text-[#EDEDF2] focus:outline-none cursor-pointer disabled:opacity-50 max-w-[240px] truncate"
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
                  placeholder={isHermes ? 'Ask Hermes to create, debug, automate...' : 'Assign task to coding agent...'}
                  disabled={isDispatching}
                  className="flex-1 bg-[#0A0A0E] border border-[#232330] rounded-xl px-2.5 py-1.5 text-[12px] text-[#EDEDF2] placeholder-[#5A5A68] focus:outline-none focus:border-[#AAB4FF]/40 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!taskInput.trim() || isDispatching}
                  className={`px-3 py-1.5 rounded-xl font-medium text-[11px] flex items-center gap-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                    isHermes
                      ? 'bg-purple-400 hover:bg-purple-300 text-[#08080B]'
                      : 'bg-[#AAB4FF] hover:bg-white text-[#08080B]'
                  }`}
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
