import React, { useState, useEffect } from 'react';
import { X, Check, Eye, EyeOff } from 'lucide-react';
import type { AssistantSettings, VoiceOption } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AssistantSettings;
  onUpdateSettings: (newSettings: Partial<AssistantSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [localStatus, setLocalStatus] = useState<{ available: boolean; server: string | null; base_url: string | null } | null>(null);
  const [localModels, setLocalModels] = useState<{ id: string }[]>([]);

  // Form state
  const [formState, setFormState] = useState<AssistantSettings>(settings);

  useEffect(() => {
    setFormState(settings);
  }, [settings, isOpen]);

  useEffect(() => {
    if (isOpen) {
      // Probe the local AI server and list its models
      fetch('/api/local/status')
        .then((res) => res.json())
        .then((data) => setLocalStatus(data))
        .catch(() => setLocalStatus({ available: false, server: null, base_url: null }));
      fetch('/api/local/models')
        .then((res) => res.json())
        .then((data) => {
          const list = Array.isArray(data.models) ? data.models : [];
          setLocalModels(list);
          if (list.length > 0) {
            setFormState((prev) => {
              if (!prev.localModel || prev.localModel === 'local-model') {
                return { ...prev, localModel: list[0].id };
              }
              return prev;
            });
          }
        })
        .catch(() => setLocalModels([]));

      setLoadingVoices(true);
      fetch('/api/voices')
        .then((res) => res.json())
        .then((data) => {
          if (data.voices && Array.isArray(data.voices)) {
            setVoices(data.voices);
          }
        })
        .catch((err) => console.error('Failed to load voices', err))
        .finally(() => setLoadingVoices(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    onUpdateSettings(formState);

    const mcpTrimmed = formState.mcpCommand?.trim();
    if (mcpTrimmed && mcpTrimmed !== settings.mcpCommand?.trim()) {
      try {
        const parts = mcpTrimmed.split(/\s+/);
        const command = parts[0];
        const args = parts.slice(1);
        await fetch('/api/mcp/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'custom',
            command,
            args,
          }),
        });
      } catch (err) {
        console.error('Failed to connect MCP server:', err);
      }
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#08080B]/80"
        onClick={onClose}
      />

      {/* Modal Dialog: elevated surface #121218, border #232330, rounded-[16px] */}
      <div className="relative w-full max-w-lg bg-[#121218] border border-[#232330] rounded-[16px] overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#232330]">
          <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#5A5A68]">
            PREFERENCES
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-[#121218] border border-[#232330] flex items-center justify-center text-[#8C8C9C] hover:text-[#EDEDF2] transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-[15px] font-normal text-[#8C8C9C]">
          {/* Section: Voice Synthesis */}
          <div className="space-y-4">
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#5A5A68] block">
              VOICE SYNTHESIS
            </span>

            <div>
              <label className="block text-[13px] text-[#EDEDF2] mb-1.5 flex items-center justify-between">
                <span>Model Voice</span>
                {loadingVoices && (
                  <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#5A5A68]">
                    LOADING...
                  </span>
                )}
              </label>
              <select
                value={formState.voice}
                onChange={(e) => setFormState({ ...formState, voice: e.target.value })}
                className="w-full bg-[#16161F] border border-[#232330] rounded-[16px] px-4 py-2.5 text-[#EDEDF2] focus:outline-none cursor-pointer text-[13px]"
              >
                {voices.map((v) => (
                  <option key={v.id} value={v.id} className="bg-[#121218]">
                    {v.name} ({v.locale})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#5A5A68]">
                    Rate
                  </span>
                  <span className="text-[11px] font-mono text-[#AAB4FF] bg-[#16161F] px-2 py-0.5 rounded-full border border-[#232330]">
                    {formState.rate}
                  </span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="40"
                  step="5"
                  value={parseInt(formState.rate.replace('%', '') || '0')}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    const sign = val >= 0 ? '+' : '';
                    setFormState({ ...formState, rate: `${sign}${val}%` });
                  }}
                  className="custom-slider"
                  style={{
                    background: `linear-gradient(to right, #6366F1 0%, #AAB4FF ${((parseInt(formState.rate.replace('%', '') || '0') + 30) / 70) * 100}%, #232330 ${((parseInt(formState.rate.replace('%', '') || '0') + 30) / 70) * 100}%, #232330 100%)`,
                  }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#5A5A68]">
                    Pitch
                  </span>
                  <span className="text-[11px] font-mono text-[#AAB4FF] bg-[#16161F] px-2 py-0.5 rounded-full border border-[#232330]">
                    {formState.pitch}
                  </span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="30"
                  step="5"
                  value={parseInt(formState.pitch.replace('Hz', '') || '0')}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    const sign = val >= 0 ? '+' : '';
                    setFormState({ ...formState, pitch: `${sign}${val}Hz` });
                  }}
                  className="custom-slider"
                  style={{
                    background: `linear-gradient(to right, #6366F1 0%, #AAB4FF ${((parseInt(formState.pitch.replace('Hz', '') || '0') + 20) / 50) * 100}%, #232330 ${((parseInt(formState.pitch.replace('Hz', '') || '0') + 20) / 50) * 100}%, #232330 100%)`,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[13px] text-[#EDEDF2]">Auto-speak responses</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={formState.autoSpeak}
                  onChange={(e) =>
                    setFormState({ ...formState, autoSpeak: e.target.checked })
                  }
                />
                <span className="toggle-track" />
              </label>
            </div>
          </div>

          <div className="h-[1px] bg-[#232330]" />

          {/* Section: Intelligence Engine */}
          <div className="space-y-4">
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#5A5A68] block">
              INTELLIGENCE ENGINE
            </span>

            {/* Provider Selection */}
            <div>
              <label className="block text-[13px] text-[#EDEDF2] mb-1.5">
                Inference Provider
              </label>
              <select
                value={formState.provider}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    provider: e.target.value as any,
                  })
                }
                className="w-full bg-[#16161F] border border-[#232330] rounded-[16px] px-4 py-2.5 text-[#EDEDF2] focus:outline-none cursor-pointer text-[13px]"
              >
                <option value="auto" className="bg-[#121218]">Auto (Groq / Gemini / OpenAI / Demo)</option>
                <option value="groq" className="bg-[#121218]">Groq (Ultra-Fast LPUs)</option>
                <option value="gemini" className="bg-[#121218]">Google Gemini (3.6 Flash)</option>
                <option value="openai" className="bg-[#121218]">OpenAI / Compatible (GPT-4o-mini)</option>
                <option value="local" className="bg-[#121218]">Local AI (LM Studio / Ollama — Private, Offline)</option>
                <option value="demo" className="bg-[#121218]">Local Demo Mode (Offline / No Key)</option>
              </select>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-[13px] text-[#EDEDF2] mb-1.5 flex items-center justify-between">
                <span>Model</span>
                <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#5A5A68]">
                  LOW-LATENCY
                </span>
              </label>
              <select
                value={
                  ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gpt-4o-mini', 'gpt-4o'].includes(formState.modelName)
                    ? formState.modelName
                    : 'custom'
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    setFormState({ ...formState, modelName: '' });
                  } else {
                    setFormState({ ...formState, modelName: val });
                  }
                }}
                className="w-full bg-[#16161F] border border-[#232330] rounded-[16px] px-4 py-2.5 text-[#EDEDF2] focus:outline-none cursor-pointer text-[13px] font-mono"
              >
                <optgroup label="Groq LPUs" className="bg-[#121218]">
                  <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Fastest)</option>
                  <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
                </optgroup>
                <optgroup label="Google Gemini" className="bg-[#121218]">
                  <option value="gemini-3.6-flash">gemini-3.6-flash (Recommended & Ultra-Fast)</option>
                  <option value="gemini-3.8-flash">gemini-3.8-flash (High Performance)</option>
                  <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Ultra-Low Latency)</option>
                </optgroup>
                <optgroup label="OpenAI" className="bg-[#121218]">
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4o">gpt-4o</option>
                </optgroup>
                <option value="custom" className="bg-[#121218]">Custom Model Name...</option>
              </select>

              {!['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gpt-4o-mini', 'gpt-4o'].includes(formState.modelName) && (
                <div className="mt-2">
                  <input
                    type="text"
                    name="sam_custom_model_identifier"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-form-type="other"
                    placeholder="Enter model name..."
                    value={formState.modelName}
                    onChange={(e) =>
                      setFormState({ ...formState, modelName: e.target.value })
                    }
                    className="w-full bg-[#16161F] border border-[#232330] rounded-[16px] px-4 py-2 text-[#EDEDF2] focus:outline-none text-[13px] font-mono placeholder-[#5A5A68]"
                  />
                </div>
              )}
            </div>

            {/* Local AI panel */}
            {formState.provider === 'local' && (
              <div className="space-y-3 p-4 rounded-[16px] border border-[#232330] bg-[#16161F]/50">
                {/* Connection status */}
                <div className="flex items-center gap-2 text-[12px] font-mono uppercase tracking-[0.14em]">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      localStatus?.available ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                    }`}
                  />
                  <span className={localStatus?.available ? 'text-emerald-300' : 'text-red-300'}>
                    {localStatus?.available
                      ? `CONNECTED · ${localStatus.server?.toUpperCase()}`
                      : 'NO LOCAL SERVER FOUND'}
                  </span>
                </div>
                {!localStatus?.available && (
                  <p className="text-[11px] text-[#5A5A68]">
                    Open LM Studio → Developer tab → Start Server (port 1234), or start Ollama. Sam auto-detects it.
                  </p>
                )}

                {/* Local model selection */}
                <div>
                  <label className="block text-[13px] text-[#EDEDF2] mb-1.5">Local Model</label>
                  {localModels.length > 0 ? (
                    <select
                      value={formState.localModel || localModels[0]?.id || ''}
                      onChange={(e) => setFormState({ ...formState, localModel: e.target.value })}
                      className="w-full bg-[#16161F] border border-[#232330] rounded-[16px] px-4 py-2.5 text-[#EDEDF2] focus:outline-none cursor-pointer text-[13px] font-mono"
                    >
                      {localModels.map((m) => (
                        <option key={m.id} value={m.id} className="bg-[#121218]">
                          {m.id}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Model name (optional — auto-picks first loaded)"
                      value={formState.localModel || ''}
                      onChange={(e) => setFormState({ ...formState, localModel: e.target.value })}
                      className="w-full bg-[#16161F] border border-[#232330] rounded-[16px] px-4 py-2 text-[#EDEDF2] focus:outline-none text-[13px] font-mono placeholder-[#5A5A68]"
                    />
                  )}
                </div>

                {/* Base URL override */}
                <div>
                  <label className="block text-[13px] text-[#EDEDF2] mb-1.5">Server URL (optional)</label>
                  <input
                    type="text"
                    placeholder={localStatus?.base_url || 'http://127.0.0.1:1234/v1'}
                    value={formState.localBaseUrl || ''}
                    onChange={(e) => setFormState({ ...formState, localBaseUrl: e.target.value })}
                    className="w-full bg-[#16161F] border border-[#232330] rounded-[16px] px-4 py-2 text-[#EDEDF2] focus:outline-none text-[13px] font-mono placeholder-[#5A5A68]"
                  />
                  <p className="text-[11px] text-[#5A5A68] mt-1">
                    Leave empty to auto-detect LM Studio (1234), Ollama (11434), Jan (1337), or llama.cpp (8080).
                  </p>
                </div>
              </div>
            )}

            {/* Groq API Key */}
            <div>
              <label className="block text-[13px] text-[#EDEDF2] mb-1 flex items-center justify-between">
                <span>Groq API Key</span>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-[#AAB4FF] hover:underline"
                >
                  Get free key
                </a>
              </label>
              <div className="relative flex items-center">
                <input
                  type={showGroqKey ? 'text' : 'password'}
                  name="sam_groq_api_token"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-form-type="other"
                  placeholder="gsk_..."
                  value={formState.groqApiKey || ''}
                  onChange={(e) =>
                    setFormState({ ...formState, groqApiKey: e.target.value })
                  }
                  className="w-full bg-[#16161F] border border-[#232330] rounded-[16px] pl-4 pr-10 py-2 text-[#EDEDF2] focus:outline-none text-[13px] font-mono placeholder-[#5A5A68]"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowGroqKey(!showGroqKey)}
                  className="absolute right-3 text-[#5A5A68] hover:text-[#8C8C9C] transition-colors cursor-pointer"
                  title={showGroqKey ? 'Hide key' : 'Show key'}
                >
                  {showGroqKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Gemini API Key */}
            <div>
              <label className="block text-[13px] text-[#EDEDF2] mb-1 flex items-center justify-between">
                <span>Gemini API Key</span>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-[#AAB4FF] hover:underline"
                >
                  Get key
                </a>
              </label>
              <div className="relative flex items-center">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  name="sam_gemini_api_token"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-form-type="other"
                  placeholder="AIzaSy..."
                  value={formState.geminiApiKey}
                  onChange={(e) =>
                    setFormState({ ...formState, geminiApiKey: e.target.value })
                  }
                  className="w-full bg-[#16161F] border border-[#232330] rounded-[16px] pl-4 pr-10 py-2 text-[#EDEDF2] focus:outline-none text-[13px] font-mono placeholder-[#5A5A68]"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-3 text-[#5A5A68] hover:text-[#8C8C9C] transition-colors cursor-pointer"
                  title={showGeminiKey ? 'Hide key' : 'Show key'}
                >
                  {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* OpenAI API Key */}
            <div>
              <label className="block text-[13px] text-[#EDEDF2] mb-1">
                OpenAI API Key
              </label>
              <div className="relative flex items-center">
                <input
                  type={showOpenaiKey ? 'text' : 'password'}
                  name="sam_openai_api_token"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-form-type="other"
                  placeholder="sk-..."
                  value={formState.openaiApiKey}
                  onChange={(e) =>
                    setFormState({ ...formState, openaiApiKey: e.target.value })
                  }
                  className="w-full bg-[#16161F] border border-[#232330] rounded-[16px] pl-4 pr-10 py-2 text-[#EDEDF2] focus:outline-none text-[13px] font-mono placeholder-[#5A5A68]"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  className="absolute right-3 text-[#5A5A68] hover:text-[#8C8C9C] transition-colors cursor-pointer"
                  title={showOpenaiKey ? 'Hide key' : 'Show key'}
                >
                  {showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="h-[1px] bg-[#232330]" />

          {/* Section: Abilities & MCP */}
          <div className="space-y-4">
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#5A5A68] block">
              ABILITIES &amp; MCP
            </span>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] text-[#EDEDF2]">Hands-Free Wake Word ("Hey Sam")</div>
                  <div className="text-[11px] text-[#5A5A68]">Microphone stays active; activates when you say "Hey Sam"</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={formState.wakeWordEnabled ?? false}
                    onChange={(e) =>
                      setFormState({ ...formState, wakeWordEnabled: e.target.checked })
                    }
                  />
                  <span className="toggle-track" />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] text-[#EDEDF2]">Audio Chimes &amp; Sound Effects</div>
                  <div className="text-[11px] text-[#5A5A68]">Subtle procedural audio tones for wake, tools, and response</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={formState.soundEffectsEnabled ?? true}
                    onChange={(e) =>
                      setFormState({ ...formState, soundEffectsEnabled: e.target.checked })
                    }
                  />
                  <span className="toggle-track" />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] text-[#EDEDF2]">Live Web Search</div>
                  <div className="text-[11px] text-[#5A5A68]">DuckDuckGo search for live news &amp; facts</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={formState.enableWebSearch}
                    onChange={(e) =>
                      setFormState({ ...formState, enableWebSearch: e.target.checked })
                    }
                  />
                  <span className="toggle-track" />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] text-[#EDEDF2]">Live Weather &amp; Geocoding</div>
                  <div className="text-[11px] text-[#5A5A68]">Real-time global weather via Open-Meteo</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={formState.enableWeather}
                    onChange={(e) =>
                      setFormState({ ...formState, enableWeather: e.target.checked })
                    }
                  />
                  <span className="toggle-track" />
                </label>
              </div>

              <div>
                <label className="block text-[13px] text-[#EDEDF2] mb-1">
                  MCP Server Command (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. npx -y @modelcontextprotocol/server-filesystem C:\..."
                  value={formState.mcpCommand || ''}
                  onChange={(e) =>
                    setFormState({ ...formState, mcpCommand: e.target.value })
                  }
                  className="w-full bg-[#16161F] border border-[#232330] rounded-[16px] px-4 py-2 text-[#EDEDF2] focus:outline-none text-[13px] font-mono placeholder-[#5A5A68]"
                />
                <p className="text-[11px] text-[#5A5A68] mt-1">
                  Connect any standard MCP stdio server to expand Sam's tools.
                </p>
              </div>
            </div>
          </div>

          <div className="h-[1px] bg-[#232330]" />

          {/* Section: Persona Prompt */}
          <div className="space-y-4">
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#5A5A68] block">
              SYSTEM PERSONA
            </span>

            <div>
              <textarea
                rows={3}
                placeholder="Instructions for voice behavior..."
                value={formState.systemPrompt}
                onChange={(e) =>
                  setFormState({ ...formState, systemPrompt: e.target.value })
                }
                className="w-full bg-[#16161F] border border-[#232330] rounded-[16px] px-4 py-2 text-[#EDEDF2] focus:outline-none text-[13px] font-mono placeholder-[#5A5A68]"
              />
            </div>
          </div>
        </div>

        {/* Footer: Secondary and Primary buttons */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#232330] bg-[#121218]">
          {/* Secondary button: transparent bg, primary text, bordered #232330, pill radius */}
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full border border-[#232330] bg-transparent text-[#EDEDF2] hover:border-[#EDEDF2]/40 text-[13px] font-normal transition-colors cursor-pointer"
          >
            Cancel
          </button>
          {/* Primary button: #EDEDF2 fill, dark text #08080B, pill radius, no border */}
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-6 py-2 rounded-full bg-[#EDEDF2] text-[#08080B] hover:bg-white text-[13px] font-medium transition-colors cursor-pointer"
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Saved</span>
              </>
            ) : (
              <span>Save</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
