# 🎙️ Sam - Web-Based Voice Assistant

**Sam** is a real-time, interactive AI voice assistant for the web, powered by a **React** (TypeScript + Vite + Tailwind CSS) frontend and a **Python** (FastAPI) backend.

- **Frontend Package Manager**: `pnpm`
- **Backend Environment & Package Manager**: `uv`
- **Speech Recognition**: Browser Web Speech API (instant, streaming, zero latency)
- **Speech Synthesis**: Microsoft Neural Voices via `edge-tts` (lifelike, natural cadence, free)
- **Intelligence Providers**: Google Gemini, OpenAI-compatible APIs (GPT-4o mini, Groq, Ollama), and built-in smart offline demo mode

---

## 🚀 Quick Start

### 1. Start the Backend (`uv`)

```bash
cd backend
uv run backend
```
*The backend starts at `http://localhost:8000`.*

### 2. Start the Frontend (`pnpm`)

Open a new terminal:
```bash
cd frontend
pnpm dev
```
*The frontend starts at `http://localhost:5173`.*

---

## 🛠️ Configuration & API Keys

Sam works right out of the box in **Smart Demo Mode** without requiring any API keys!

To unlock full conversational intelligence:
1. Open the web app at `http://localhost:5173`.
2. Click the **Settings Gear** in the top right.
3. Choose your provider (**Google Gemini** or **OpenAI**) and paste your API key, or set them in `backend/.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```

---

## 🌟 Key Features

- **Dynamic Voice Orb**: Siri-inspired glowing 3D/fluid orb and real-time audio soundwave visualizer responding to voice states (*Idle*, *Listening*, *Thinking*, *Speaking*).
- **Interruption & Barge-in**: Tap the mic or interrupt Sam at any time—playback stops instantly and Sam listens to your new command.
- **Neural Voices**: Choose from multiple natural voices (Male, Female, US, British, Australian accents) with customizable speech rate and pitch.
- **Conversation Transcript**: Slide-over drawer with timestamped history, copy functionality, and audio re-synthesis.
- **Full Fallback Support**: Text input fallback and prompt suggestion pills.
