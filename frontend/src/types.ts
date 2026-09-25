export type AssistantState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'searching'
  | 'speaking'
  | 'error';

export interface SourceItem {
  title: string;
  url: string;
  domain: string;
}

export interface ImagePayload {
  data_url: string;
  source_url: string;
  title: string;
  domain: string;
}

export interface MediaPayload {
  video_id: string;
  title: string;
  channel: string;
  duration?: string;
  watch_url: string;
  music_url: string;
  embed_url: string;
  thumbnail: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  audioUrl?: string;
  toolUsed?: string;
  sources?: SourceItem[];
  image?: ImagePayload;
  media?: MediaPayload;
}

export interface VoiceOption {
  id: string;
  name: string;
  locale: string;
  gender: string;
  description?: string;
}

export interface AssistantSettings {
  voice: string;
  rate: string;
  pitch: string;
  provider: 'auto' | 'groq' | 'gemini' | 'openai' | 'local' | 'demo';
  groqApiKey: string;
  geminiApiKey: string;
  openaiApiKey: string;
  modelName: string;
  systemPrompt: string;
  autoSpeak: boolean;
  continuousListening: boolean;
  wakeWordEnabled: boolean;
  soundEffectsEnabled: boolean;
  enableWebSearch: boolean;
  enableWeather: boolean;
  mcpCommand: string;
  localBaseUrl: string;
  localModel: string;
}

export interface AgentEngineOption {
  id: string;
  name: string;
  available: boolean;
  description?: string;
}

export interface AgentSkill {
  name: string;
  category: string;
  status: string;
}

export interface AgentStatusPayload {
  state: 'idle' | 'running' | 'completed' | 'error' | 'cancelled';
  current_task: string | null;
  conversation_id: string | null;
  active_tool: string | null;
  active_tool_summary: string | null;
  files_modified: string[];
  suggested_command?: string | null;
  workspace_path?: string;
  latest_output: string;
  start_time: number | null;
  duration_seconds: number;
  error: string | null;
  model: string;
  engine?: 'hermes' | 'coding_agent';
  available_engines?: AgentEngineOption[];
  skills?: AgentSkill[];
}

export interface AgentModel {
  id: string;
  name: string;
}
