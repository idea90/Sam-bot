# Walkthrough - Expanding Sam's Abilities (Web Search, Tools & MCP)

We have expanded **Sam** with dynamic real-time capabilities: **Live Web Search**, **Real-Time Global Weather**, **Wikipedia Knowledge Lookup**, **Safe Math Evaluation**, and an extensible **Model Context Protocol (MCP)** client.

---

## ⚡ Real-Time Abilities & Tool Calling Architecture

```
User Voice / Text
       │
       ▼
 ┌────────────────────────────────────────────────────────┐
 │            Sam Tool Registry & Intent Router           │
 └───────────────────────────┬────────────────────────────┘
                             │
       ┌─────────────────────┼─────────────────────┐
       ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  Web Search   │     │ Global Weather│     │  MCP Client   │
│  DuckDuckGo   │     │  Open-Meteo   │     │ JSON-RPC/stdio│
└──────┬────────┘     └──────┬────────┘     └──────┬────────┘
       │                     │                     │
       └─────────────────────┼─────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │        Conversational Voice Response Synthesis         │
 │              (Microsoft Neural TTS)                    │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
              Spoken Response to User & Siri Screen
```

### 1. Live Web Search (`web_search`)
- Searches the live web using DuckDuckGo to answer questions about recent events, current developments, and factual queries.
- Results are automatically synthesized into natural, concise spoken sentences.

### 2. Real-Time Global Weather (`get_weather`)
- Geocodes any city worldwide and fetches real-time temperature, condition (sunny, cloudy, rain, snow), apparent temperature, humidity, and wind speed using Open-Meteo.
- 100% free with zero API keys required.

### 3. Wikipedia Knowledge Lookup (`get_wikipedia`)
- Pulls encyclopedic summaries for historical figures, science, geography, and concepts.

### 4. Calculator & Unit Evaluation (`calculate`)
- Safely evaluates arithmetic, percentages, and unit calculations.

### 5. Model Context Protocol (MCP) Client Manager
- Lightweight native MCP client supporting JSON-RPC 2.0 over `stdio`.
- Discovers external tools (`tools/list`) and dynamically invokes them (`tools/call`), exposing them to Sam's voice assistant reasoning.
- Configurable via `/api/mcp/connect` or the Settings panel.

### 6. Interactive Siri-Style Frontend Updates
- **Dynamic Status**: While executing a tool, the Siri orb status displays:
  - `SEARCHING WEB...`
  - `CHECKING WEATHER...`
  - `CALCULATING...`
- **Abilities & MCP Settings**: Toggle Web Search, Weather, and specify custom MCP server commands.
- **Actionable Suggestion Chips**:
  - *"What's the weather in Tokyo?"*
  - *"Search the web for latest AI news"*
  - *"Who was Alan Turing?"*
  - *"Help me brainstorm"*

---

## 🧪 Verification & Test Results

### 1. Tool Verification Suite (`tests/test_tools.py`)
- `[OK] Weather Test`: Retrieved Tokyo current weather (20.0°C, mainly clear, humidity 78%).
- `[OK] Calculator Test`: Evaluated `15 * 8 = 120`.
- `[OK] Wikipedia Test`: Retrieved Alan Turing summary.
- `[OK] Web Search Test`: Fetched live web results for James Webb Telescope.
- `[OK] Intent Detection Test`: Detected weather query intent.
- `[OK] LLM Tool-augmented Response`: Synthesized Rome live weather response.
- **Result: 100% Tests Passed**.

### 2. Backend API Suite (`tests/test_api.py`)
- Validated all REST, TTS audio generation, and WebSocket streaming endpoints (`4 active tools`).
- **Result: 100% Tests Passed**.

### 3. Frontend Production Build (`pnpm build`)
- TypeScript checking (`tsc -b`) and Vite compilation passed with 0 errors.
