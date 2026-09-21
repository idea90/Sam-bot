import { useState, useCallback, useEffect, useRef } from 'react';
import type { AssistantState, AssistantSettings, Message, SourceItem, MediaPayload } from '../types';
import type { ImagePayload } from '../types';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useAudioPlayer } from './useAudioPlayer';
import { playWakeChime, playCompleteChime, playToolChime } from '../utils/soundEffects';

const DEFAULT_SETTINGS: AssistantSettings = {
  voice: 'en-US-GuyNeural',
  rate: '+0%',
  pitch: '+0Hz',
  provider: 'auto',
  groqApiKey: '',
  geminiApiKey: '',
  openaiApiKey: '',
  modelName: '',
  systemPrompt: '',
  autoSpeak: true,
  continuousListening: false,
  wakeWordEnabled: false,
  soundEffectsEnabled: true,
  enableWebSearch: true,
  enableWeather: true,
  mcpCommand: '',
  localBaseUrl: '',
  localModel: '',
};

const deriveThinkingAction = (
  text: string,
  provider: string
): { tool: string | null; detail: string; isSearching: boolean } => {
  const lower = text.toLowerCase();

  // 1. Weather
  if (lower.includes('weather') || lower.includes('forecast') || lower.includes('temperature') || lower.includes('degrees')) {
    const match = text.match(/(?:weather|temperature|forecast)(?:\s+(?:in|for|at))?\s+([a-zA-Z\s]+)/i);
    const city = match && match[1] ? match[1].trim().replace(/[?!.,]/g, '') : '';
    return {
      tool: 'weather',
      detail: city ? `Checking live weather in ${city}...` : 'Checking live weather forecast...',
      isSearching: true,
    };
  }

  // 2. News
  if (lower.includes('news') || lower.includes('headline')) {
    return {
      tool: 'news',
      detail: 'Scanning latest news & headlines...',
      isSearching: true,
    };
  }

  // 2b. Image fetch
  if (
    /(?:pic|pics|picture|photo|image)s?\s+(?:of|for)\s+/.test(lower) ||
    lower.includes('look like')
  ) {
    const target = text.match(/(?:pic|pics|picture|photo|image)s?\s+(?:of|for)\s+(.+?)[?!.]*$/i);
    return {
      tool: 'image',
      detail: target?.[1] ? `Fetching an image of ${target[1].trim()}...` : 'Fetching an image...',
      isSearching: true,
    };
  }

  // 3. Web Search
  if (
    lower.includes('search') ||
    lower.includes('google') ||
    lower.includes('look up') ||
    lower.includes('who is') ||
    lower.includes('who won') ||
    lower.includes('what is the latest') ||
    lower.includes('latest on') ||
    lower.includes('find out')
  ) {
    const query = text.replace(/^(?:search(?:\s+the\s+web)?(?:\s+for)?|google|look\s+up)\s+/i, '').trim();
    return {
      tool: 'web_search',
      detail: query ? `Searching the web for "${query.slice(0, 30)}..."` : 'Searching the live web...',
      isSearching: true,
    };
  }

  // 4. Calculator
  if (
    lower.includes('calculate') ||
    lower.includes('how much is') ||
    /^(?:what(?:'s| is)\s+)?[\d\s\+\-\*\/\^\(\)\.\=]+$/.test(lower)
  ) {
    return {
      tool: 'calculator',
      detail: 'Computing mathematical calculation...',
      isSearching: false,
    };
  }

  // 5. World Clock
  if (lower.includes('time in') || lower.includes('time at') || lower.includes('what time is it') || lower.includes('current time')) {
    const match = text.match(/time\s+(?:in|at)\s+([a-zA-Z\s]+)/i);
    const city = match && match[1] ? match[1].trim().replace(/[?!.,]/g, '') : '';
    return {
      tool: 'world_clock',
      detail: city ? `Checking local time in ${city}...` : 'Checking current time...',
      isSearching: false,
    };
  }

  // 6. Currency / Unit converter
  if (lower.includes('convert') || lower.includes('usd') || lower.includes('eur') || lower.includes('miles to') || lower.includes('km to')) {
    return {
      tool: 'converter',
      detail: 'Converting units & exchange rates...',
      isSearching: false,
    };
  }

  // 7. Notes
  if (lower.includes('note') || lower.includes('memo') || lower.includes('reminder')) {
    return {
      tool: 'notes',
      detail: 'Accessing saved notes...',
      isSearching: false,
    };
  }

  // 7b. Gaming mode (Roblox + Discord)
  if (lower.includes('gaming mode') || lower.includes('game mode') || lower.includes('start gaming') || lower.includes('roblox')) {
    return {
      tool: 'gaming_mode',
      detail: 'Launching Roblox & Discord...',
      isSearching: false,
    };
  }

  // 8. System app / Control
  if (lower.startsWith('open ') || lower.startsWith('launch ') || lower.includes('volume') || lower.includes('mute') || lower.includes('lock')) {
    return {
      tool: 'system_control',
      detail: 'Executing desktop command...',
      isSearching: false,
    };
  }

  // 9. Media player & Music playback
  if (lower.includes('play ') || lower.includes('pause') || lower.includes('skip') || lower.includes('next track') || lower.includes('song') || lower.includes('music') || lower.startsWith('put on ') || lower.startsWith('listen to ')) {
    const song = text.replace(/^(?:can you\s+)?(?:play|put on|listen to)\s+(?:some\s+)?(?:music\s+by\s+|songs?\s+by\s+|the\s+song\s+)?/i, '').replace(/\s+(?:on\s+)?(?:youtube\s+music|yt\s+music|youtube|yt|spotify)$/i, '').trim();
    return {
      tool: 'media_player',
      detail: song ? `Finding "${song}" on YouTube Music...` : 'Controlling media playback...',
      isSearching: true,
    };
  }

  // 10. General conversational reasoning
  const providerDisplay =
    provider === 'gemini'
      ? 'Gemini'
      : provider === 'groq'
      ? 'Groq'
      : provider === 'openai'
      ? 'OpenAI'
      : provider === 'local'
      ? 'Local AI'
      : 'Sam';
  return {
    tool: null,
    detail: `Thinking with ${providerDisplay}...`,
    isSearching: false,
  };
};

export const useVoiceAssistant = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hello! I'm Sam. Ask me anything, or ask for live weather, web search, or facts!",
      timestamp: new Date(),
    },
  ]);
  const [state, setState] = useState<AssistantState>('idle');
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const [thinkingDetail, setThinkingDetail] = useState<string | null>(null);
  const [activeSources, setActiveSources] = useState<SourceItem[]>([]);
  const [activeMedia, setActiveMedia] = useState<MediaPayload | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  // Ref mirror of messages so in-flight requests always read the freshest history
  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;
  // Set when the mic is permanently unavailable (e.g. permission denied) so the
  // wake-word effect stops retrying and can't loop forever
  const micDeniedRef = useRef(false);
  const [settings, setSettings] = useState<AssistantSettings>(() => {
    try {
      const saved = localStorage.getItem('sam_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Sanitize model if invalid or deprecated
        if (parsed.provider === 'gemini') {
          if (!parsed.modelName || !parsed.modelName.startsWith('gemini') || parsed.modelName.includes('1.5') || parsed.modelName.includes('2.0') || parsed.modelName.includes('1.0')) {
            parsed.modelName = 'gemini-3.6-flash';
          }
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const {
    isPlaying,
    isMuted,
    enqueueAudio,
    stopPlayback,
    toggleMute,
    ensureAudioContext,
    analyserRef,
  } = useAudioPlayer();

  // Save settings when modified
  const updateSettings = useCallback((newSettings: Partial<AssistantSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('sam_settings', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Stop any current voice output before thinking (barge-in) and unlock audio context
      ensureAudioContext();
      stopPlayback();
      setActiveSources([]);

      // Add user message to history
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      // Detect immediate tool activity and thinking action for UI
      const { tool: detectedTool, detail: actionDetail, isSearching } = deriveThinkingAction(trimmed, settings.provider);
      setActiveToolName(detectedTool);
      setThinkingDetail(actionDetail);
      setState(isSearching ? 'searching' : 'thinking');

      const t0 = performance.now();

      try {
        // Streaming API: sentences (with audio) arrive while the rest is still generating
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            history: messagesRef.current.slice(-6).map((m) => ({
              role: m.role,
              content: m.text,
            })),
            voice: settings.voice,
            rate: settings.rate,
            pitch: settings.pitch,
            provider: settings.provider,
            groq_api_key: settings.groqApiKey || undefined,
            gemini_api_key: settings.geminiApiKey || undefined,
            openai_api_key: settings.openaiApiKey || undefined,
            model_name: settings.provider === 'local'
              ? (settings.localModel || undefined)
              : (settings.modelName || undefined),
            local_base_url: settings.localBaseUrl || undefined,
            system_prompt: settings.systemPrompt || undefined,
            generate_audio: settings.autoSpeak,
            enable_tools: true,
            enable_web_search: settings.enableWebSearch,
            enable_weather: settings.enableWeather,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server returned status ${response.status}`);
        }

        if (!response.ok || !response.body) {
          throw new Error(`Server returned status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantText = '';
        const assistantId = `sam-${Date.now()}`;
        let gotAudio = false;
        let finished = false;

        // Upsert the assistant message: created on first sentence, text grows after
        const upsertAssistant = (text: string, extra?: Partial<Message>) => {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === assistantId);
            if (!exists) {
              return [
                ...prev,
                { id: assistantId, role: 'assistant', text, timestamp: new Date(), ...extra },
              ];
            }
            return prev.map((m) => (m.id === assistantId ? { ...m, text, ...extra } : m));
          });
        };

        const handleEvent = (evt: any) => {
          if (evt.type === 'sentence') {
            assistantText = assistantText ? `${assistantText} ${evt.text}` : evt.text;
            setThinkingDetail(null);
            upsertAssistant(assistantText);
            if (evt.audio && settings.autoSpeak && !isMuted) {
              gotAudio = true;
              setState('speaking');
              enqueueAudio(evt.audio);
            }
          } else if (evt.type === 'audio') {
            // Audio arrives as its own event right after its sentence's text
            if (evt.audio && settings.autoSpeak && !isMuted) {
              gotAudio = true;
              setState('speaking');
              enqueueAudio(evt.audio);
            }
          } else if (evt.type === 'done') {
            finished = true;
            setLastLatencyMs(Math.round(performance.now() - t0));
            assistantText = evt.response || assistantText;

            if (evt.tool_used) {
              setActiveToolName(evt.tool_used);
              if (settings.soundEffectsEnabled) {
                playToolChime();
              }
            }

            const responseSources: SourceItem[] = Array.isArray(evt.sources) ? evt.sources : [];
            const imagePayload: ImagePayload | undefined = evt.image || undefined;
            const mediaPayload: MediaPayload | undefined = evt.media || undefined;

            if (mediaPayload) {
              setActiveMedia(mediaPayload);
            }

            upsertAssistant(assistantText, {
              toolUsed: evt.tool_used || undefined,
              sources: responseSources.length > 0 ? responseSources : undefined,
              image: imagePayload,
              media: mediaPayload,
            });

            if (responseSources.length > 0) {
              setActiveSources(responseSources);
            }
            if (settings.soundEffectsEnabled) {
              playCompleteChime();
            }
            setThinkingDetail(null);
          } else if (evt.type === 'error') {
            throw new Error(evt.message || 'Streaming error');
          }
        };

        // Read the NDJSON event stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            try {
              handleEvent(JSON.parse(trimmedLine));
            } catch (parseErr) {
              console.warn('Skipped unparseable stream event', parseErr);
            }
          }
        }

        if (!finished) {
          // Stream ended without a done event — finalize with what we have
          upsertAssistant(assistantText || 'I am sorry, I could not formulate a response.');
        }

        if (!gotAudio) {
          setState('idle');
          setActiveToolName(null);
        }
      } catch (err: any) {
        console.error('Chat error:', err);
        setState('error');
        setActiveToolName(null);
        setThinkingDetail(null);
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            text: `Oops! Encountered an error: ${err.message || 'Unable to connect to backend'}. Please ensure the backend is running.`,
            timestamp: new Date(),
          },
        ]);
        setTimeout(() => setState('idle'), 4000);
      }
    },
    [settings, isMuted, enqueueAudio, stopPlayback, ensureAudioContext]
  );

  // When speech recognition produces a final transcript, automatically send it
  const handleFinalTranscript = useCallback(
    (finalText: string) => {
      const trimmed = finalText.trim();
      if (!trimmed) return;

      // Handle Wake Word mode ("Hey Sam" / "Sam")
      if (settings.wakeWordEnabled) {
        const wakeMatch = trimmed.match(/^(?:hey\s+)?sam[,!?:.]?\s*(.*)$/i);
        if (wakeMatch) {
          if (settings.soundEffectsEnabled) {
            playWakeChime();
          }
          const command = wakeMatch[1]?.trim();
          if (!command) {
            // Acknowledge wake word alone
            const ackMsg: Message = {
              id: `sam-ack-${Date.now()}`,
              role: 'assistant',
              text: "I'm listening! What can I do for you?",
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, ackMsg]);
            return;
          }
          // Dispatch user command
          sendMessage(command);
          return;
        }
        // In wake word mode, ignore non-directed background talking
        return;
      }

      sendMessage(trimmed);
    },
    [sendMessage, settings.wakeWordEnabled, settings.soundEffectsEnabled]
  );

  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    error: speechError,
    startListening,
    stopListening,
    toggleListening: rawToggleListening,
    micAnalyserRef,
  } = useSpeechRecognition({
    onFinalTranscript: handleFinalTranscript,
    continuous: settings.continuousListening || settings.wakeWordEnabled,
  });

  // Track fatal mic errors so we stop auto-retrying (prevents an infinite start loop)
  useEffect(() => {
    if (speechError && /denied|not-allowed|service-not-allowed/i.test(speechError)) {
      micDeniedRef.current = true;
    }
  }, [speechError]);

  // Auto-activate listening when wake word is enabled, but never while Sam is speaking.
  // Retries are deferred via timeout so rapid failure cycles don't hammer the mic API.
  useEffect(() => {
    if (!settings.wakeWordEnabled || isListening || isPlaying || state === 'speaking') return;
    if (micDeniedRef.current) return;
    const timer = setTimeout(() => startListening(), 500);
    return () => clearTimeout(timer);
  }, [settings.wakeWordEnabled, isListening, isPlaying, state, startListening, speechError]);

  // Intercept mic toggle: stop Sam's speech when user starts talking
  const toggleListening = useCallback(() => {
    ensureAudioContext();
    if (isPlaying) {
      stopPlayback();
    }
    if (!isListening && settings.soundEffectsEnabled) {
      playWakeChime();
    }
    rawToggleListening();
  }, [isPlaying, isListening, stopPlayback, rawToggleListening, settings.soundEffectsEnabled, ensureAudioContext]);

  // Update assistant state based on recognition and audio playback
  useEffect(() => {
    if (isListening) {
      setState('listening');
      setActiveToolName(null);
    } else if (isPlaying) {
      setState('speaking');
    } else if (!isPlaying && state === 'speaking') {
      setState('idle');
      setActiveToolName(null);
    }
  }, [isListening, isPlaying, state]);

  const clearHistory = useCallback(() => {
    stopPlayback();
    setActiveToolName(null);
    setActiveSources([]);
    setMessages([
      {
        id: 'welcome-new',
        role: 'assistant',
        text: 'Chat history cleared. What would you like to explore next?',
        timestamp: new Date(),
      },
    ]);
  }, [stopPlayback]);

  return {
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
    // Speech Recognition
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    speechError,
    startListening,
    stopListening,
    toggleListening,
    micAnalyserRef,
    // Audio Player
    isPlaying,
    isMuted,
    stopPlayback,
    toggleMute,
    analyserRef,
    lastLatencyMs,
  };
};
