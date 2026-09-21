import asyncio
import base64
import datetime
import os
import random
import re
import time
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple
import httpx
from google import genai
from google.genai import types
from openai import AsyncOpenAI

from ..config import settings
from .tools import tool_registry
from .tts import tts_service
from .mcp_service import mcp_manager

# Known local OpenAI-compatible servers, probed in priority order
LOCAL_SERVER_CANDIDATES = [
    ("LM Studio", "http://127.0.0.1:1234/v1"),
    ("Ollama", "http://127.0.0.1:11434/v1"),
    ("Jan", "http://127.0.0.1:1337/v1"),
    ("llama.cpp", "http://127.0.0.1:8080/v1"),
]
LOCAL_RECHECK_SECS = 60.0  # re-probe this often if no server was found

def _normalize_local_url(url: Optional[str]) -> str:
    """Ensure local base URL always targets the OpenAI-compatible /v1 endpoint."""
    u = (url or "").strip().rstrip("/")
    if not u:
        return ""
    if not u.endswith("/v1"):
        u = f"{u}/v1"
    return u

# Some small local models hallucinate JSON tool-calls instead of speaking.
# This matches outputs that start with JSON containing call-like keys.
_DEGENERATE_JSON_RE = re.compile(
    r'^\s*(?:```[a-zA-Z]*\s*)?\{\s*"(?:name|function|tool|tool_calls|parameters|arguments|input_text)"\s*:',
    re.IGNORECASE,
)

# Appended to prompts so models know the required output format up front
NO_JSON_INSTRUCTION = (
    "\n\nCRITICAL OUTPUT FORMAT RULE: You are a VOICE assistant. Respond ONLY with plain, "
    "conversational English sentences that will be spoken aloud. NEVER output JSON, code, "
    "function calls, tool calls, or any structured markup. Never describe actions — just answer."
)


def is_degenerate_tool_output(text: Optional[str]) -> bool:
    """Detect LLM outputs that are JSON tool/function calls instead of spoken text."""
    t = (text or "").strip()
    if not (t.startswith("{") or t.startswith("```")):
        return False
    return bool(_DEGENERATE_JSON_RE.match(t))

def build_mcp_args(schema: Optional[Dict[str, Any]], query: str) -> Dict[str, Any]:
    """Build MCP tool arguments from the tool's inputSchema.

    String properties are filled with the user query; numeric/boolean properties
    get sensible defaults so required parameters always pass validation.
    """
    schema = schema or {}
    properties = schema.get("properties") or {}
    required = schema.get("required") or []
    args: Dict[str, Any] = {}

    def prop_type(name: str) -> str:
        prop = properties.get(name)
        return prop.get("type", "string") if isinstance(prop, dict) else "string"

    for prop_name in properties:
        ptype = prop_type(prop_name)
        if ptype == "string":
            args[prop_name] = query
        elif ptype in ("number", "integer"):
            num_match = re.search(r'-?\d+(?:\.\d+)?', query)
            if num_match:
                args[prop_name] = float(num_match.group()) if ptype == "number" else int(float(num_match.group()))
        elif ptype == "boolean":
            args[prop_name] = True

    for req_name in required:
        if req_name not in args:
            ptype = prop_type(req_name)
            if ptype in ("number", "integer"):
                args[req_name] = 0
            elif ptype == "boolean":
                args[req_name] = True
            else:
                args[req_name] = query
    return args


class LLMService:
    def __init__(self):
        self._gemini_client: Optional[genai.Client] = None
        self._openai_client: Optional[AsyncOpenAI] = None
        self._local_base_url: Optional[str] = None
        self._local_server_name: Optional[str] = None
        self._local_check_ts: float = -1e9

    @property
    def local_server_name(self) -> Optional[str]:
        return self._local_server_name

    async def detect_local_server(
        self,
        explicit: Optional[str] = None,
        force: bool = False,
    ) -> Optional[str]:
        """Find a running local OpenAI-compatible server and cache its base URL.

        Priority: explicit override (from the UI) > LOCAL_BASE_URL env > port probe.
        Failed probes are cached for LOCAL_RECHECK_SECS so we don't add latency to
        every message while no server is running.
        """
        if explicit:
            self._local_base_url = _normalize_local_url(explicit)
            self._local_server_name = "Custom"
            self._local_check_ts = time.monotonic()
            return self._local_base_url

        if self._local_base_url and not force:
            return self._local_base_url
        if not force and (time.monotonic() - self._local_check_ts) < LOCAL_RECHECK_SECS:
            return self._local_base_url

        env_base = _normalize_local_url(settings.LOCAL_BASE_URL)
        candidates = [("Custom", env_base)] if env_base else LOCAL_SERVER_CANDIDATES

        # Probe all candidate ports concurrently so the worst case is one timeout,
        # not one timeout per candidate
        async def _probe(name: str, url: str) -> Optional[Tuple[str, str]]:
            target_url = _normalize_local_url(url)
            try:
                async with httpx.AsyncClient(timeout=1.5) as client:
                    r = await client.get(f"{target_url}/models")
                if r.status_code == 200:
                    return (name, target_url)
            except Exception:
                return None
            return None

        results = await asyncio.gather(*(_probe(name, url) for name, url in candidates))
        for hit in results:
            if hit:
                name, url = hit
                self._local_base_url = url
                self._local_server_name = name
                print(f"Local AI server detected: {name} at {url}")
                break

        self._local_check_ts = time.monotonic()
        return self._local_base_url

    async def get_local_models(self) -> List[Dict[str, str]]:
        """List models installed on the detected local server."""
        base_url = await self.detect_local_server()
        if not base_url:
            return []
        try:
            target_url = _normalize_local_url(base_url)
            async with httpx.AsyncClient(timeout=3.0) as client:
                r = await client.get(f"{target_url}/models")
            if r.status_code == 200:
                data = r.json().get("data", [])
                # Prioritize chat/instruct models over text-embedding models
                chat_models = [
                    {"id": m.get("id", ""), "owned_by": m.get("owned_by", "local")}
                    for m in data
                    if m.get("id") and "embed" not in m.get("id", "").lower()
                ]
                if chat_models:
                    return chat_models
                return [
                    {"id": m.get("id", ""), "owned_by": m.get("owned_by", "local")}
                    for m in data
                    if m.get("id")
                ]
        except Exception as e:
            print(f"Local model listing error: {e}")
        return []

    def get_provider(
        self,
        override_provider: Optional[str] = None,
        override_gemini_key: Optional[str] = None,
        override_openai_key: Optional[str] = None,
        override_groq_key: Optional[str] = None,
    ) -> str:
        provider = (override_provider or settings.LLM_PROVIDER).lower()
        if provider == "local":
            return "local"
        if provider != "auto":
            return provider

        groq_key = override_groq_key or settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY", "")
        gemini_key = override_gemini_key or settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
        openai_key = override_openai_key or settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY", "")

        # Groq prioritized for real-time speed (~800+ tok/s), then Gemini, OpenAI, Demo
        if groq_key:
            return "groq"
        elif gemini_key:
            return "gemini"
        elif openai_key:
            return "openai"
        elif self._local_base_url:
            return "local"
        return "demo"

    async def detect_and_execute_tool(
        self,
        query: str,
        history: Optional[List[Dict[str, str]]] = None,
        enable_web_search: bool = True,
        enable_weather: bool = True,
    ) -> Optional[Tuple[str, str]]:
        """Determine if query requires real-time tools and execute if needed."""
        lowered = query.lower().strip()

        # 0. Local Time & Date Intent
        if re.search(r'^(?:what(?:\'s| is) (?:the )?time(?:\s+is it)?(?:\s+now)?|what time is it|current time)$', lowered):
            now = datetime.datetime.now().strftime("%I:%M %p")
            return ("world_clock", f"The current local time is {now}.")
        if re.search(r'^(?:what(?:\'s| is) (?:today\'s|the) date|what day is it|today\'s date|what is the date)$', lowered):
            today = datetime.datetime.now().strftime("%A, %B %d, %Y")
            return ("world_clock", f"Today is {today}.")

        # 1. Live News & Headlines Intent (e.g. read me some news, world news, tech news, latest headlines)
        news_keywords = ['news', 'headline', 'headlines', 'breaking news', 'current events', 'what is happening', "what's happening"]
        is_news_direct = any(w in lowered for w in news_keywords)

        # Contextual check: Did Sam previously ask what kind of news/headlines?
        is_news_contextual = False
        if history and len(history) > 0:
            last_assistant_msg = ""
            for msg in reversed(history):
                if msg.get("role") in ["assistant", "sam"]:
                    last_assistant_msg = msg.get("content", "").lower()
                    break
            if any(w in last_assistant_msg for w in ["headline", "news"]):
                if any(w in lowered for w in ["world", "tech", "technology", "sports", "business", "finance", "science", "politics", "local", "top", "general"]):
                    is_news_contextual = True

        if is_news_direct or is_news_contextual:
            if 'world' in lowered:
                topic = 'world'
            elif any(w in lowered for w in ['tech', 'technology', 'ai', 'gadgets']):
                topic = 'technology'
            elif any(w in lowered for w in ['business', 'finance', 'stock', 'market', 'economy']):
                topic = 'business'
            elif 'science' in lowered or 'space' in lowered:
                topic = 'science'
            elif any(w in lowered for w in ['sport', 'sports', 'game', 'football', 'basketball', 'soccer']):
                topic = 'sports'
            elif 'politics' in lowered or 'government' in lowered:
                topic = 'politics'
            else:
                topic = 'top'
            res = await tool_registry.get_news(topic)
            return ("news", res)

        # 2. World Time intent (e.g. time in London, what time is it in Tokyo)
        time_match = re.search(r'(?:time (?:is it )?(?:in|for|at)|(?:current )?time in)\s+([a-zA-Z\s]+)', lowered)
        if time_match:
            city = time_match.group(1).strip(' ?.')
            if city and city not in ['now', 'today']:
                res = await tool_registry.get_world_time(city)
                return ("world_clock", res)

        # 3. Currency & Unit Conversion (e.g. 100 USD to EUR, 50 miles to km, 75 F to C)
        if any(w in lowered for w in ['convert', 'to eur', 'to usd', 'to gbp', 'to jpy', 'in km', 'in miles', 'in celsius', 'in fahrenheit', 'how many km', 'how many miles', 'how many pounds']):
            res = await tool_registry.convert_units_or_currency(query)
            return ("converter", res)

        # 4. Quick Notes (e.g. take a note: ..., read my notes, clear notes)
        if any(w in lowered for w in ['take a note', 'save note', 'add note', 'remember that']):
            content = re.sub(r'^(?:take a note(?::| that)?|save note(?::)?|add note(?::)?|remember that)\s*', '', query, flags=re.IGNORECASE).strip()
            res = tool_registry.manage_notes("add", content)
            return ("notes", res)
        elif any(w in lowered for w in ['read my notes', 'what are my notes', 'show my notes', 'list notes']):
            res = tool_registry.manage_notes("list")
            return ("notes", res)
        elif any(w in lowered for w in ['clear notes', 'delete notes', 'erase notes']):
            res = tool_registry.manage_notes("clear")
            return ("notes", res)

        # 5. Random Decisions & Fun (e.g. flip a coin, roll a die, pick a number)
        if any(w in lowered for w in ['flip a coin', 'roll a die', 'roll dice', 'pick a number', 'heads or tails']):
            res = tool_registry.random_decision(query)
            return ("randomizer", res)

        # 6. System Diagnostics & Info (e.g. system status, system info, OS specs)
        if any(w in lowered for w in ['system info', 'system status', 'specs', 'what os are you running', 'what system are you running']):
            res = tool_registry.get_system_info()
            return ("system_info", res)

        # 6b. Image fetch (e.g. show me a picture of a red panda, what does Paris look like)
        #     Must run before the dictionary intent, which also matches "what does ..."
        img_match = re.search(
            r'(?:show|get|fetch|find|send|give)(?:\s+me)?(?:\s+(?:a|an|the))?\s+(?:pic|pics|picture|pictures|photo|photos|image|images|photograph)s?\s+(?:of|for|showing)\s+(.+)',
            lowered,
        )
        look_match = re.search(r'what does\s+(.+?)\s+look like', lowered)
        if img_match or look_match:
            target = (img_match.group(1) if img_match else look_match.group(1)).strip(' ?.”\'')
            if target:
                res = await tool_registry.fetch_image(target)
                return ("image", res)

        # 7. Dictionary & Definitions (e.g. define serendipity, meaning of ephemeral)
        def_match = re.search(r'(?:define|what does|meaning of)\s+([a-zA-Z\-]+)(?:\s+mean)?', lowered)
        if def_match and 'weather' not in lowered and 'calculate' not in lowered:
            word = def_match.group(1).strip(' ?.')
            res = await tool_registry.get_wikipedia(word)
            return ("dictionary", res)

        # 8. Weather intent (if enabled)
        if enable_weather:
            weather_match = re.search(r'(?:what(?:\'s| is) the )?weather (?:like )?(?:in|for|at) ([a-zA-Z\s]+)', lowered)
            if weather_match or 'weather' in lowered:
                if weather_match:
                    city = weather_match.group(1).strip(' ?.').title()
                    if city and city not in ['like', 'today', 'tomorrow', 'there']:
                        res = await tool_registry.get_weather(city)
                        return ("weather", res)
                # No parseable city: ask for one instead of silently guessing a default
                return ("weather", "Which city would you like the weather for? Please tell me a location.")

        # 9a. Percentage of a number (e.g. what is 50% of 100, 15 percent of 200)
        pct_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:%|percent(?:age)?)\s*of\s*(\d+(?:\.\d+)?)', lowered)
        if pct_match:
            pct = float(pct_match.group(1))
            total = float(pct_match.group(2))
            return ("calculator", f"{pct:g} percent of {total:g} is {pct / 100 * total:g}.")

        # 9. Math / Calculation intent (percent handled separately above)
        calc_match = re.search(r'(?:calculate|what is|how much is)\s+([0-9+\-*/().^ %]+)', lowered)
        if calc_match and '%' not in calc_match.group(1) and any(op in calc_match.group(1) for op in ['+', '-', '*', '/']):
            expr = calc_match.group(1).strip()
            res = tool_registry.calculate(expr)
            return ("calculator", res)

        # 10. Explicit Web Search intent (if enabled)
        if enable_web_search:
            search_match = re.search(r'(?:search the web for|search for|google|look up on the web)\s+(.+)', lowered)
            if search_match:
                search_query = search_match.group(1).strip(' ?.')
                res = await tool_registry.web_search(search_query)
                return ("web_search", res)

            # Live / Current event queries (e.g. who is the current..., latest news, stock price)
            if any(w in lowered for w in ['latest news', 'current price', 'stock price', 'recent news', 'who won', 'score of']):
                res = await tool_registry.web_search(query)
                return ("web_search", res)

        # 11a. Antigravity Coding Agent: Dispatch (explicit agent instructions)
        agent_dispatch_match = re.search(
            r'^(?:can you\s+)?(?:please\s+)?(?:tell|ask|have|get|instruct|dispatch\s+to)\s+(?:the\s+)?(?:coding\s+agent|antigravity|agent)\s+(?:to\s+)?(.+)',
            query,
            flags=re.IGNORECASE
        )
        if agent_dispatch_match:
            task_instruction = agent_dispatch_match.group(1).strip(' ?.')
            res = await tool_registry.antigravity_control("dispatch", task_instruction)
            return ("antigravity_control", res)

        # Agent prefix prompt: e.g. "Antigravity: create a script..." or "Coding agent, add tests"
        agent_prefix_match = re.search(
            r'^(?:antigravity|coding\s+agent)\s*[:,-]\s*(?:please\s+)?(?:to\s+)?(.+)',
            query,
            flags=re.IGNORECASE
        )
        if agent_prefix_match:
            task_instruction = agent_prefix_match.group(1).strip(' ?.')
            res = await tool_registry.antigravity_control("dispatch", task_instruction)
            return ("antigravity_control", res)

        # Direct coding & file creation requests (e.g. "create a python script in scratch called hello_sam.py...")
        code_action_match = re.search(
            r'^(?:can you\s+)?(?:please\s+)?(?:create|write|make|generate|build|add)\s+(?:a\s+)?(?:new\s+)?(?:python\s+|javascript\s+|typescript\s+|bash\s+|shell\s+|test\s+)?(?:script|file|endpoint|module|function|component)\s+(?:in|at|called|named)\s+(.+)',
            query,
            flags=re.IGNORECASE
        )
        if code_action_match:
            res = await tool_registry.antigravity_control("dispatch", query.strip(' ?.'))
            return ("antigravity_control", res)

        # 11b. Antigravity Coding Agent: Cancel / Stop
        if any(w in lowered for w in ['stop the agent', 'cancel the agent', 'stop coding agent', 'cancel coding agent', 'stop antigravity', 'cancel antigravity', 'abort the agent', 'kill the agent', 'stop agent', 'cancel agent']) or (
            any(w in lowered for w in ['antigravity', 'coding agent']) and any(w in lowered for w in ['stop', 'cancel', 'abort', 'kill'])
        ):
            res = await tool_registry.antigravity_control("cancel")
            return ("antigravity_control", res)

        # 11c. Antigravity Coding Agent: Models
        if any(w in lowered for w in ['antigravity', 'coding agent']) and any(w in lowered for w in ['models', 'model']):
            res = await tool_registry.antigravity_control("models")
            return ("antigravity_control", res)

        # 11d. Antigravity Coding Agent: Status & Monitoring
        if any(w in lowered for w in ['coding agent', 'antigravity', 'agent status', 'check the agent', 'check agent', 'agent progress', 'is the agent running']):
            res = await tool_registry.antigravity_control("status")
            return ("antigravity_control", res)

        # 11b. Gaming Mode (auto-launch Roblox + Discord) — must run before generic
        #      app-launch and media-playback intents so "play Roblox" doesn't hit YouTube
        if re.search(r"gaming mode|game mode|start gaming|gaming setup|let'?s game|play (?:some )?roblox", lowered):
            res = tool_registry.launch_gaming_mode()
            return ("gaming_mode", res)

        # 11. Media Controls (pause, resume, skip, next track, previous track)
        if any(w in lowered for w in ['pause music', 'stop music', 'resume music', 'pause video', 'next song', 'next track', 'skip song', 'skip track', 'previous track', 'previous song']):
            if any(w in lowered for w in ['next', 'skip']):
                res = tool_registry.media_player("next")
            elif any(w in lowered for w in ['previous', 'prev', 'back']):
                res = tool_registry.media_player("previous")
            else:
                res = tool_registry.media_player("play_pause")
            return ("media_player", res)

        # 12. Music Playback ("play [song/artist/genre]", "put on ...", "listen to ...")
        if re.search(r'^(?:can you\s+)?(?:play|put on|listen to)\s+(.+)', lowered) and not any(w in lowered for w in ['a game', 'game', 'with me', 'around']):
            music_query = re.sub(r'^(?:can you\s+)?(?:play|put on|listen to)\s+(?:some\s+)?(?:music\s+by\s+|songs?\s+by\s+|the\s+song\s+)?', '', query, flags=re.IGNORECASE)
            # Strip trailing platform clauses like "on youtube", "on yt music", "on youtube music", etc.
            music_query = re.sub(r'\s+(?:on\s+)?(?:youtube\s+music|yt\s+music|youtube|yt|spotify)$', '', music_query, flags=re.IGNORECASE).strip(' ?.')
            if music_query:
                res = tool_registry.media_player("search_play", music_query)
                return ("media_player", res)

        # 13. System Volume Controls
        if re.search(r'(?:turn\s+up|increase|raise)\s+(?:the\s+)?volume|volume\s+up|louder', lowered):
            res = tool_registry.system_control("volume_up")
            return ("system_control", res)
        elif re.search(r'(?:turn\s+down|lower|decrease)\s+(?:the\s+)?volume|volume\s+down|quieter', lowered):
            res = tool_registry.system_control("volume_down")
            return ("system_control", res)
        elif re.search(r'^(?:mute|unmute)(?:\s+(?:the\s+)?(?:volume|audio|sound))?$', lowered) or any(w in lowered for w in ['mute audio', 'mute sound', 'unmute audio', 'mute volume']):
            res = tool_registry.system_control("mute")
            return ("system_control", res)

        # 14. Lock Workstation / PC
        if any(w in lowered for w in ['lock pc', 'lock my pc', 'lock computer', 'lock my computer', 'lock workstation']):
            res = tool_registry.system_control("lock_pc")
            return ("system_control", res)

        # 15. Launch Applications
        app_launch_match = re.search(r'^(?:can you\s+)?(?:open|launch|start)\s+(?:the\s+)?([a-zA-Z0-9\s\-]+)', lowered)
        if app_launch_match:
            raw_target = app_launch_match.group(1).strip(' ?.')
            known_apps = ['code', 'vs code', 'vscode', 'visual studio code', 'chrome', 'browser', 'google chrome',
                          'notepad', 'calculator', 'calc', 'terminal', 'cmd', 'powershell', 'command prompt',
                          'explorer', 'files', 'file explorer', 'task manager', 'taskmgr', 'settings',
                          'roblox', 'discord']
            if any(k in raw_target or raw_target in k for k in known_apps):
                res = tool_registry.system_control("launch_app", raw_target)
                return ("system_control", res)

        # 16. Check connected MCP tools
        for tool in mcp_manager.get_all_tools():
            tool_name = tool.get("original_name", "").lower()
            if tool_name and tool_name in lowered:
                res = await mcp_manager.call_mcp_tool(tool["name"], build_mcp_args(tool.get("inputSchema", {}), query))
                if res:
                    return (f"mcp:{tool_name}", res)

        return None

    async def get_response(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        provider: Optional[str] = None,
        gemini_key: Optional[str] = None,
        openai_key: Optional[str] = None,
        groq_key: Optional[str] = None,
        model_name: Optional[str] = None,
        enable_tools: bool = True,
        enable_web_search: bool = True,
        enable_weather: bool = True,
        local_base_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get text response and any tool execution metadata."""
        requested_provider = (provider or settings.LLM_PROVIDER).lower()
        if requested_provider in ("auto", "local"):
            # Probe (or reuse the cached probe of) the local server before choosing
            await self.detect_local_server(explicit=local_base_url)
        active_provider = self.get_provider(provider, gemini_key, openai_key, groq_key)
        sys_prompt = system_prompt or settings.SYSTEM_PROMPT
        last_user_msg = messages[-1].get("content", "") if messages else ""

        tool_used = None
        tool_result = None
        tool_registry.clear_last_sources()
        tool_registry.clear_last_image()
        tool_registry.clear_last_media()

        # Check for tools if enabled
        if enable_tools and last_user_msg:
            detected = await self.detect_and_execute_tool(
                last_user_msg,
                history=messages[:-1],
                enable_web_search=enable_web_search,
                enable_weather=enable_weather,
            )
            if detected:
                tool_used, tool_result = detected

        # Directly return concrete confirmation for system actions, media playback, randomizers, and coding agent
        if tool_used in ["system_control", "media_player", "randomizer", "gaming_mode", "image", "antigravity_control"]:
            text = tool_result
        elif active_provider == "groq":
            text = await self._call_groq(messages, sys_prompt, groq_key, model_name, tool_result)
        elif active_provider == "gemini":
            text = await self._call_gemini(messages, sys_prompt, gemini_key, model_name, tool_result)
        elif active_provider == "openai":
            text = await self._call_openai(messages, sys_prompt, openai_key, model_name, tool_result)
        elif active_provider == "local":
            text = await self._call_local(messages, sys_prompt, model_name, tool_result)
        else:
            text = self._call_demo(messages, tool_result)

        # Guard: small local models sometimes emit JSON tool-calls instead of speech.
        # Retry once with a hardened prompt, then give a friendly spoken fallback.
        if is_degenerate_tool_output(text):
            print(f"Degenerate tool-call output detected: {text[:100]}")
            text = await self._generate_fallback(
                active_provider, messages, sys_prompt + NO_JSON_INSTRUCTION,
                groq_key, gemini_key, openai_key, model_name, tool_result,
            )
            if is_degenerate_tool_output(text):
                text = "Sorry, I had trouble with that one. Could you say it another way?"

        sources = tool_registry.get_last_sources()

        return {
            "response": text,
            "tool_used": tool_used,
            "provider_used": active_provider,
            "sources": sources,
            "image": tool_registry.last_image if tool_used == "image" else None,
            "media": tool_registry.last_media if tool_used == "media_player" else None,
        }

    @staticmethod
    def _build_chat_messages(
        system_prompt: str,
        messages: List[Dict[str, str]],
        tool_data: Optional[str] = None,
    ) -> List[Dict[str, str]]:
        """Build the OpenAI-style message list with real-time context and tool data."""
        now_str = datetime.datetime.now().strftime("%A, %B %d, %Y at %I:%M %p")
        sys_content = f"{system_prompt}{NO_JSON_INSTRUCTION}\n\n[Real-Time System Context]: Current local date and time is {now_str}."

        formatted_messages = [{"role": "system", "content": sys_content}]
        for msg in messages[-6:]:
            formatted_messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })

        if tool_data:
            formatted_messages.append({
                "role": "system",
                "content": (
                    f"[Live Real-Time Data from Tools/Web]:\n{tool_data}\n\n"
                    "INSTRUCTION: Incorporate these facts directly and summarize them aloud for the user in 1 to 3 spoken sentences. "
                    "Never say you will pull them up or check later—deliver the actual information immediately."
                )
            })
        return formatted_messages

    async def _call_groq(
        self,
        messages: List[Dict[str, str]],
        system_prompt: str,
        api_key: Optional[str],
        model: Optional[str],
        tool_data: Optional[str] = None,
    ) -> str:
        key = (api_key or settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY") or "").strip()
        if not key:
            return self._call_demo(messages, tool_data)

        # Groq runs via OpenAI-compatible endpoint at ultra-high speed (~800+ tok/s)
        client = AsyncOpenAI(api_key=key, base_url="https://api.groq.com/openai/v1")
        if not model or model.lower().startswith("gemini") or model.lower().startswith("gpt"):
            target_model = settings.DEFAULT_MODEL_GROQ
        else:
            target_model = model

        formatted_messages = self._build_chat_messages(system_prompt, messages, tool_data)

        try:
            completion = await client.chat.completions.create(
                model=target_model,
                messages=formatted_messages,
                max_tokens=600,
                temperature=0.6,
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            print(f"Groq API error: {e}")
            if tool_data:
                return f"Based on live data: {tool_data}"
            return "I'm having trouble reaching Groq right now. Please try again in a moment."

    async def _call_gemini(
        self,
        messages: List[Dict[str, str]],
        system_prompt: str,
        api_key: Optional[str],
        model: Optional[str],
        tool_data: Optional[str] = None,
    ) -> str:
        key = (api_key or settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or "").strip()
        if not key:
            return self._call_demo(messages, tool_data)

        client = genai.Client(api_key=key)
        # Fast default: gemini-3.6-flash. Ensure model is valid for Gemini (filter out llama/gpt models)
        if not model or not model.lower().startswith("gemini"):
            target_model = settings.DEFAULT_MODEL_GEMINI
        else:
            target_model = model.strip()

        # Automatically alias retired legacy models (2.0, 1.5, 1.0 series) to active Gemini models
        lowered_target = target_model.lower()
        if any(r in lowered_target for r in ["2.0", "1.5", "1.0"]) or lowered_target in ["gemini-flash", "gemini-pro"]:
            target_model = "gemini-3.6-flash"

        now_str = datetime.datetime.now().strftime("%A, %B %d, %Y at %I:%M %p")
        conversation_context = f"System Instructions: {system_prompt}\n[Real-Time System Context]: Current local date and time is {now_str}.\n\nRecent conversation:\n"
        for msg in messages[-6:]:
            role = "User" if msg.get("role") == "user" else "Sam"
            conversation_context += f"{role}: {msg.get('content')}\n"

        if tool_data:
            conversation_context += f"\n[Live Real-Time Data from Tools/Web]:\n{tool_data}\n"

        prompt = (
            f"{conversation_context}\n"
            "Respond naturally as Sam in 1 to 3 short, conversational, spoken sentences without markdown formatting. "
            "NEVER output JSON, code, or function/tool calls — plain spoken sentences only. "
            "CRITICAL: Never reply with empty promises like 'I am on it' or 'Let me check that right now'. "
            "Always deliver the actual answer, news headlines, or facts immediately in your response! "
            "If live tool data or headlines were provided, summarize them clearly out loud. "
            "Never claim you cannot access the computer, open apps, or access information when tool data is already provided above."
        )

        # Fallback list of official active Google Gemini models
        candidate_models = [target_model]
        for fallback in ["gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"]:
            if fallback not in candidate_models:
                candidate_models.append(fallback)

        primary_error = None
        last_error = None
        for i, current_model in enumerate(candidate_models):
            try:
                # Disable thinking budget for ultra-fast voice responses with ample 800-token budget
                gen_config = types.GenerateContentConfig(
                    max_output_tokens=800,
                    temperature=0.7,
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                )
                response = await client.aio.models.generate_content(
                    model=current_model,
                    contents=prompt,
                    config=gen_config
                )
                text = getattr(response, "text", "") or ""
                if text.strip():
                    return text.strip()
            except Exception as e:
                # If model rejects thinking_config, retry with standard 800 token config
                try:
                    fallback_config = types.GenerateContentConfig(
                        max_output_tokens=800,
                        temperature=0.7,
                    )
                    response = await client.aio.models.generate_content(
                        model=current_model,
                        contents=prompt,
                        config=fallback_config
                    )
                    text = getattr(response, "text", "") or ""
                    if text.strip():
                        return text.strip()
                except Exception as inner_e:
                    last_error = inner_e
                    if i == 0:
                        primary_error = inner_e
                    print(f"Gemini API error for model '{current_model}': {inner_e}")
                    continue

        if tool_data:
            return f"Here is the latest data: {tool_data}"
        print(f"Gemini API failed on all candidate models: {primary_error or last_error}")
        return "I'm having trouble reaching Gemini right now. Please try again in a moment."

    async def _call_openai(
        self,
        messages: List[Dict[str, str]],
        system_prompt: str,
        api_key: Optional[str],
        model: Optional[str],
        tool_data: Optional[str] = None,
    ) -> str:
        key = (api_key or settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY") or "").strip()
        if not key:
            return self._call_demo(messages, tool_data)

        base_url = settings.OPENAI_BASE_URL or None
        client = AsyncOpenAI(api_key=key, base_url=base_url)
        # Filter out gemini/llama models if passed to standard OpenAI
        if not model or model.lower().startswith("gemini") or model.lower().startswith("llama"):
            target_model = settings.DEFAULT_MODEL_OPENAI
        else:
            target_model = model

        now_str = datetime.datetime.now().strftime("%A, %B %d, %Y at %I:%M %p")
        sys_content = f"{system_prompt}\n\n[Real-Time System Context]: Current local date and time is {now_str}."

        formatted_messages = [{"role": "system", "content": sys_content}]
        for msg in messages[-6:]:
            formatted_messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })

        if tool_data:
            formatted_messages.append({
                "role": "system",
                "content": (
                    f"[Live Real-Time Data from Tools/Web]:\n{tool_data}\n\n"
                    "INSTRUCTION: Incorporate these facts directly and summarize them aloud for the user in 1 to 3 spoken sentences. "
                    "Never say you will pull them up or check later—deliver the actual information immediately."
                )
            })

        try:
            completion = await client.chat.completions.create(
                model=target_model,
                messages=formatted_messages,
                max_tokens=600,
                temperature=0.7,
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            print(f"OpenAI API error: {e}")
            if tool_data:
                return f"Based on live data: {tool_data}"
            return "I'm having trouble reaching OpenAI right now. Please try again in a moment."

    async def _call_local(
        self,
        messages: List[Dict[str, str]],
        system_prompt: str,
        model: Optional[str],
        tool_data: Optional[str] = None,
    ) -> str:
        """Call a local OpenAI-compatible server (LM Studio, Ollama, llama.cpp, Jan)."""
        base_url = await self.detect_local_server()
        if not base_url:
            if tool_data:
                return f"Based on live data: {tool_data}"
            return "No local AI server is running. Start LM Studio's server (Developer tab) or set LOCAL_BASE_URL."

        client = AsyncOpenAI(api_key=settings.LOCAL_API_KEY, base_url=base_url)
        target_model = await self._pick_local_model(model)
        formatted_messages = self._build_chat_messages(system_prompt, messages, tool_data)

        try:
            completion = await client.chat.completions.create(
                model=target_model,
                messages=formatted_messages,
                max_tokens=800,
                temperature=0.7,
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            print(f"Local AI error: {e}")
            if tool_data:
                return f"Based on live data: {tool_data}"
            return "I couldn't reach the local AI server. Is LM Studio's server running?"

    async def _pick_local_model(self, model: Optional[str]) -> str:
        """Resolve the local model: requested > env default > first available model on the server."""
        models = await self.get_local_models()
        available_ids = [m["id"] for m in models]

        # 1. Exact match with an available model on the server
        if model and model in available_ids:
            return model

        # 2. Custom model requested that isn't a dummy string or cloud model
        if model and not model.lower().startswith(("gemini", "gpt", "local-model")) and model != "local-model":
            for mid in available_ids:
                if model.lower() in mid.lower():
                    return mid
            return model

        # 3. Env default model
        if settings.DEFAULT_MODEL_LOCAL:
            return settings.DEFAULT_MODEL_LOCAL

        # 4. Pick the first available chat model from the server
        return available_ids[0] if available_ids else "meta-llama-3.1-8b-instruct"

    # ------------------------------------------------------------------
    # Streaming: token generator + sentence assembler for low-latency voice
    # ------------------------------------------------------------------

    @staticmethod
    async def _split_sentences(token_gen: AsyncGenerator[str, None]) -> AsyncGenerator[str, None]:
        """Merge token deltas and yield complete sentences as soon as they form."""
        buffer = ""
        async for chunk in token_gen:
            if not chunk:
                continue
            buffer += chunk
            while True:
                m = re.search(r'^(.+?[.!?…])(\s+|$)', buffer, re.DOTALL)
                if m and len(m.group(1).strip()) >= 3:
                    sentence = m.group(1).strip()
                    buffer = buffer[m.end():]
                    if sentence:
                        yield sentence
                elif len(buffer.strip()) >= 300:
                    # Long run without punctuation (lists, code) — flush at a word boundary
                    cut = buffer.rfind(' ')
                    if cut <= 0:
                        cut = len(buffer)
                    sentence = buffer[:cut].strip()
                    buffer = buffer[cut:].lstrip()
                    if sentence:
                        yield sentence
                else:
                    break
        if buffer.strip():
            yield buffer.strip()

    @staticmethod
    async def _stream_openai_compatible(
        client: AsyncOpenAI,
        model: str,
        formatted_messages: List[Dict[str, str]],
        max_tokens: int = 600,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """Yield content deltas from an OpenAI-compatible streaming chat completion."""
        stream = await client.chat.completions.create(
            model=model,
            messages=formatted_messages,  # type: ignore[arg-type]
            max_tokens=max_tokens,
            temperature=temperature,
            stream=True,
        )
        emitted = False
        try:
            async for chunk in stream:
                if chunk.choices:
                    delta = chunk.choices[0].delta.content
                    if delta:
                        emitted = True
                        yield delta
        except Exception as e:
            if not emitted:
                raise  # nothing spoken yet — caller falls back to non-streaming
            print(f"Stream interrupted mid-response: {e}")

    async def _stream_tokens(
        self,
        active_provider: str,
        messages: List[Dict[str, str]],
        sys_prompt: str,
        groq_key: Optional[str],
        gemini_key: Optional[str],
        openai_key: Optional[str],
        model_name: Optional[str],
        tool_data: Optional[str],
    ) -> AsyncGenerator[str, None]:
        """Yield raw response text tokens for the active provider."""
        if active_provider == "groq":
            key = (groq_key or settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY") or "").strip()
            if not key:
                yield self._call_demo(messages, tool_data)
                return
            client = AsyncOpenAI(api_key=key, base_url="https://api.groq.com/openai/v1")
            if not model_name or model_name.lower().startswith(("gemini", "gpt")):
                target_model = settings.DEFAULT_MODEL_GROQ
            else:
                target_model = model_name
            formatted = self._build_chat_messages(sys_prompt, messages, tool_data)
            async for token in self._stream_openai_compatible(client, target_model, formatted, max_tokens=600, temperature=0.6):
                yield token

        elif active_provider == "openai":
            key = (openai_key or settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY") or "").strip()
            if not key:
                yield self._call_demo(messages, tool_data)
                return
            client = AsyncOpenAI(api_key=key, base_url=settings.OPENAI_BASE_URL or None)
            if not model_name or model_name.lower().startswith(("gemini", "llama")):
                target_model = settings.DEFAULT_MODEL_OPENAI
            else:
                target_model = model_name
            formatted = self._build_chat_messages(sys_prompt, messages, tool_data)
            async for token in self._stream_openai_compatible(client, target_model, formatted, max_tokens=600, temperature=0.7):
                yield token

        elif active_provider == "local":
            base_url = await self.detect_local_server()
            if not base_url:
                yield "No local AI server is running. Start LM Studio's server (Developer tab) or pick another provider."
                return
            client = AsyncOpenAI(api_key=settings.LOCAL_API_KEY, base_url=base_url)
            target_model = await self._pick_local_model(model_name)
            formatted = self._build_chat_messages(sys_prompt, messages, tool_data)
            async for token in self._stream_openai_compatible(client, target_model, formatted, max_tokens=800, temperature=0.7):
                yield token

        elif active_provider == "gemini":
            key = (gemini_key or settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or "").strip()
            if not key:
                yield self._call_demo(messages, tool_data)
                return
            client = genai.Client(api_key=key)
            if not model_name or not model_name.lower().startswith("gemini"):
                target_model = settings.DEFAULT_MODEL_GEMINI
            else:
                target_model = model_name.strip()
            lowered = target_model.lower()
            if any(r in lowered for r in ["2.0", "1.5", "1.0"]) or lowered in ["gemini-flash", "gemini-pro"]:
                target_model = "gemini-3.6-flash"

            now_str = datetime.datetime.now().strftime("%A, %B %d, %Y at %I:%M %p")
            conversation_context = f"System Instructions: {sys_prompt}\n[Real-Time System Context]: Current local date and time is {now_str}.\n\nRecent conversation:\n"
            for msg in messages[-6:]:
                role = "User" if msg.get("role") == "user" else "Sam"
                conversation_context += f"{role}: {msg.get('content')}\n"
            if tool_data:
                conversation_context += f"\n[Live Real-Time Data from Tools/Web]:\n{tool_data}\n"
            prompt = (
                f"{conversation_context}\n"
                "Respond naturally as Sam in 1 to 3 short, conversational, spoken sentences without markdown formatting. "
                "NEVER output JSON, code, or function/tool calls — plain spoken sentences only. "
                "CRITICAL: Never reply with empty promises like 'I am on it' or 'Let me check that right now'. "
                "Always deliver the actual answer, news headlines, or facts immediately in your response! "
                "If live tool data or headlines were provided, summarize them clearly out loud. "
                "Never claim you cannot access the computer, open apps, or access information when tool data is already provided above."
            )

            gen_config = types.GenerateContentConfig(
                max_output_tokens=800,
                temperature=0.7,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            )
            try:
                stream = await client.aio.models.generate_content_stream(
                    model=target_model, contents=prompt, config=gen_config
                )
                emitted = False
                async for chunk in stream:
                    text = getattr(chunk, "text", "") or ""
                    if text:
                        emitted = True
                        yield text
                if not emitted:
                    raise RuntimeError("Gemini stream produced no text")
            except Exception:
                # Some models reject thinking_config — retry with a plain config
                fallback_config = types.GenerateContentConfig(max_output_tokens=800, temperature=0.7)
                stream = await client.aio.models.generate_content_stream(
                    model=target_model, contents=prompt, config=fallback_config
                )
                async for chunk in stream:
                    text = getattr(chunk, "text", "") or ""
                    if text:
                        yield text

        else:
            yield self._call_demo(messages, tool_data)

    async def _generate_fallback(
        self,
        active_provider: str,
        messages: List[Dict[str, str]],
        sys_prompt: str,
        groq_key: Optional[str],
        gemini_key: Optional[str],
        openai_key: Optional[str],
        model_name: Optional[str],
        tool_data: Optional[str],
    ) -> str:
        """Non-streaming fallback used when streaming fails before any output."""
        if active_provider == "groq":
            return await self._call_groq(messages, sys_prompt, groq_key, model_name, tool_data)
        if active_provider == "gemini":
            return await self._call_gemini(messages, sys_prompt, gemini_key, model_name, tool_data)
        if active_provider == "openai":
            return await self._call_openai(messages, sys_prompt, openai_key, model_name, tool_data)
        if active_provider == "local":
            return await self._call_local(messages, sys_prompt, model_name, tool_data)
        return self._call_demo(messages, tool_data)

    async def stream_response(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        provider: Optional[str] = None,
        gemini_key: Optional[str] = None,
        openai_key: Optional[str] = None,
        groq_key: Optional[str] = None,
        model_name: Optional[str] = None,
        enable_tools: bool = True,
        enable_web_search: bool = True,
        enable_weather: bool = True,
        local_base_url: Optional[str] = None,
        voice: Optional[str] = None,
        rate: Optional[str] = None,
        pitch: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Yield NDJSON-ready events: {type:'sentence', text, audio} ... then {type:'done', ...}.

        Each completed sentence is synthesized to speech immediately, so the client
        can start playing audio while the rest of the response is still generating.
        """
        requested_provider = (provider or settings.LLM_PROVIDER).lower()
        if requested_provider in ("auto", "local"):
            await self.detect_local_server(explicit=local_base_url)
        active_provider = self.get_provider(provider, gemini_key, openai_key, groq_key)
        sys_prompt = system_prompt or settings.SYSTEM_PROMPT
        last_user_msg = messages[-1].get("content", "") if messages else ""

        tool_used = None
        tool_result = None
        tool_registry.clear_last_sources()
        tool_registry.clear_last_image()
        tool_registry.clear_last_media()

        if enable_tools and last_user_msg:
            detected = await self.detect_and_execute_tool(
                last_user_msg,
                history=messages[:-1],
                enable_web_search=enable_web_search,
                enable_weather=enable_weather,
            )
            if detected:
                tool_used, tool_result = detected

        async def emit_sentence(text: str) -> AsyncGenerator[Dict[str, Any], None]:
            audio_b64 = None
            try:
                audio_bytes = await tts_service.generate_speech(text=text, voice=voice, rate=rate, pitch=pitch)
                if audio_bytes:
                    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
            except Exception as e:
                print(f"Streaming TTS error: {e}")
            event: Dict[str, Any] = {"type": "sentence", "text": text}
            if audio_b64:
                event["audio"] = audio_b64
            yield event

        if tool_used in ["system_control", "media_player", "randomizer", "gaming_mode", "image", "antigravity_control"]:
            # Concrete tool confirmations are returned verbatim as a single sentence
            async for evt in emit_sentence(tool_result or ""):
                yield evt
            full_text = tool_result or ""
        else:
            full_text = ""
            try:
                token_gen = self._stream_tokens(
                    active_provider, messages, sys_prompt,
                    groq_key, gemini_key, openai_key, model_name, tool_result,
                )

                # PIPELINED: the producer consumes tokens and pushes sentences into a
                # queue while this loop synthesizes audio — so the model keeps
                # generating during TTS instead of stalling on every sentence.
                sentence_queue: asyncio.Queue = asyncio.Queue()

                async def _produce() -> None:
                    try:
                        async for sentence in self._split_sentences(token_gen):
                            await sentence_queue.put(sentence)
                    finally:
                        await sentence_queue.put(None)  # sentinel: stream ended

                producer_task = asyncio.create_task(_produce())
                try:
                    while True:
                        sentence = await sentence_queue.get()
                        if sentence is None:
                            break

                        # Catch JSON tool-call hallucinations BEFORE speaking them
                        if not full_text and is_degenerate_tool_output(sentence):
                            raise RuntimeError(f"Degenerate tool-call output: {sentence[:80]}")

                        full_text = f"{full_text} {sentence}".strip() if full_text else sentence
                        # 1. Emit text immediately — the UI updates at LLM speed
                        yield {"type": "sentence", "text": sentence}
                        # 2. Then emit audio as a separate event once synthesized
                        try:
                            audio_bytes = await tts_service.generate_speech(text=sentence, voice=voice, rate=rate, pitch=pitch)
                            if audio_bytes:
                                yield {"type": "audio", "audio": base64.b64encode(audio_bytes).decode("utf-8")}
                        except Exception as te:
                            print(f"Streaming TTS error: {te}")
                finally:
                    if not producer_task.done():
                        producer_task.cancel()
                        await asyncio.gather(producer_task, return_exceptions=True)
                    elif not producer_task.cancelled() and producer_task.exception() is not None:
                        # Surface producer failures (e.g. provider error before output)
                        raise producer_task.exception()  # type: ignore[misc]
            except Exception as e:
                print(f"Streaming failed, falling back: {e}")
                if not full_text:
                    full_text = await self._generate_fallback(
                        active_provider, messages, sys_prompt + NO_JSON_INSTRUCTION,
                        groq_key, gemini_key, openai_key, model_name, tool_result,
                    )
                    if is_degenerate_tool_output(full_text):
                        full_text = "Sorry, I had trouble with that one. Could you say it another way?"
                    async for evt in emit_sentence(full_text):
                        yield evt
            if not full_text:
                full_text = "I'm sorry, I could not formulate a response."
                async for evt in emit_sentence(full_text):
                    yield evt

        yield {
            "type": "done",
            "response": full_text,
            "tool_used": tool_used,
            "provider_used": active_provider,
            "sources": tool_registry.get_last_sources(),
            "image": tool_registry.last_image if tool_used == "image" else None,
            "media": tool_registry.last_media if tool_used == "media_player" else None,
        }

    def _call_demo(self, messages: List[Dict[str, str]], tool_data: Optional[str] = None) -> str:
        """Smart fallback responses with live tool synthesis."""
        if tool_data:
            if "Headlines:" in tool_data:
                lines = [line.strip('• ').strip() for line in tool_data.split('\n') if line.strip().startswith('•')]
                if lines:
                    return f"Here are the latest headlines: {'; '.join(lines[:3])}."
            return f"Here is what I found: {tool_data}"

        last_msg = messages[-1].get("content", "").strip().lower() if messages else ""

        # Time & Date in demo fallback (exact phrases only, so casual 'today' conversation is not hijacked)
        if any(w in last_msg for w in ["what time is it", "current time", "what's the time", "tell me the time"]):
            now = datetime.datetime.now().strftime("%I:%M %p")
            return f"The current time is {now}."
        if any(w in last_msg for w in ["what day is it", "what is today's date", "today's date", "what's the date", "what date is it", "current date"]):
            today = datetime.datetime.now().strftime("%A, %B %d, %Y")
            return f"Today is {today}."

        # Greetings
        if any(w in last_msg for w in ["hello", "hi sam", "hey sam", "greetings"]):
            greetings = [
                "Hello there! I'm Sam. Ask me anything, or try checking the weather or searching the web!",
                "Hey! Sam here, ready to assist. You can ask for live weather, web search, or conversation.",
                "Hi! Great to hear you. What can I look up or help you with today?"
            ]
            return random.choice(greetings)

        # What can you do
        if "what can you do" in last_msg or "help" in last_msg:
            return "I can search the live web, check real-time weather worldwide, calculate math, look up facts, and chat with natural voice speech."

        # Jokes
        if "joke" in last_msg:
            jokes = [
                "Why don't scientists trust atoms? Because they make up everything!",
                "Why do programmers prefer dark mode? Because light attracts bugs!",
                "How do you comfort a JavaScript bug? You console it!"
            ]
            return random.choice(jokes)

        fallbacks = [
            f"You asked '{last_msg}'. In smart demo mode, I can check live weather, search the web, tell time, and converse. Add a Gemini or OpenAI key anytime for full deep reasoning!",
            "I heard your request loud and clear. Feel free to ask about live weather or search queries anytime."
        ]
        return random.choice(fallbacks)

llm_service = LLMService()
