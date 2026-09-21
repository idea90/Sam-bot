import base64
import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from ..config import settings
from ..services.llm import llm_service
from ..services.tts import tts_service
from ..services.tools import tool_registry
from ..services.mcp_service import mcp_manager

router = APIRouter(tags=["Voice & Chat"])

class MessageItem(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[MessageItem]] = []
    voice: Optional[str] = None
    rate: Optional[str] = None
    pitch: Optional[str] = None
    provider: Optional[str] = None
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    model_name: Optional[str] = None
    system_prompt: Optional[str] = None
    generate_audio: Optional[bool] = True
    enable_tools: Optional[bool] = True
    enable_web_search: Optional[bool] = True
    enable_weather: Optional[bool] = True
    local_base_url: Optional[str] = None

class SourceItem(BaseModel):
    title: str
    url: str
    domain: str

class ChatResponse(BaseModel):
    response: str
    audio_base64: Optional[str] = None
    provider_used: str
    tool_used: Optional[str] = None
    sources: Optional[List[SourceItem]] = []
    image: Optional[Dict[str, str]] = None
    media: Optional[Dict[str, Any]] = None

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None
    rate: Optional[str] = None
    pitch: Optional[str] = None

class MCPConnectRequest(BaseModel):
    name: str
    command: str
    args: Optional[List[str]] = []

@router.get("/api/voices")
async def get_voices(all: bool = False):
    """Get list of available voices."""
    if all:
        voices = await tts_service.get_all_voices()
    else:
        voices = tts_service.get_popular_voices()
    return {"voices": voices}

@router.get("/api/tools")
async def get_tools():
    """List all available tools and connected MCP tools."""
    builtin = tool_registry.get_definitions()
    mcp_tools = mcp_manager.get_all_tools()
    return {
        "builtin_tools": builtin,
        "mcp_tools": mcp_tools,
        "total_active": len(builtin) + len(mcp_tools)
    }

@router.post("/api/mcp/connect")
async def connect_mcp_server(req: MCPConnectRequest):
    """Connect a new Model Context Protocol (MCP) server."""
    success = await mcp_manager.register_server(req.name, req.command, req.args or [])
    if not success:
        raise HTTPException(status_code=500, detail=f"Failed to initialize MCP server '{req.name}'")
    tools = mcp_manager.get_all_tools()
    return {"status": "connected", "server": req.name, "tools_count": len(tools)}

@router.get("/api/local/status")
async def local_status():
    """Report whether a local OpenAI-compatible AI server (LM Studio, Ollama, ...) is reachable."""
    base_url = await llm_service.detect_local_server()
    return {
        "available": bool(base_url),
        "server": llm_service.local_server_name,
        "base_url": base_url,
    }

@router.get("/api/local/models")
async def local_models():
    """List models installed on the detected local AI server."""
    models = await llm_service.get_local_models()
    return {"models": models}

@router.get("/api/settings")
async def get_settings():
    """Return backend status, available providers, and tools."""
    active_provider = llm_service.get_provider()
    tools_count = len(tool_registry.get_definitions()) + len(mcp_manager.get_all_tools())
    return {
        "assistant_name": "Sam",
        "default_voice": settings.DEFAULT_VOICE,
        "active_provider": active_provider,
        "has_groq_key": bool(settings.GROQ_API_KEY),
        "has_gemini_key": bool(settings.GEMINI_API_KEY),
        "has_openai_key": bool(settings.OPENAI_API_KEY),
        "system_prompt": settings.SYSTEM_PROMPT,
        "tools_active": tools_count,
        "default_models": {
            "groq": settings.DEFAULT_MODEL_GROQ,
            "gemini": settings.DEFAULT_MODEL_GEMINI,
            "openai": settings.DEFAULT_MODEL_OPENAI,
        }
    }

@router.post("/api/tts")
async def text_to_speech(req: TTSRequest):
    """Stream synthesized speech audio for given text."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    audio_bytes = await tts_service.generate_speech(
        text=req.text,
        voice=req.voice,
        rate=req.rate,
        pitch=req.pitch
    )
    if not audio_bytes:
        raise HTTPException(status_code=500, detail="Failed to synthesize speech")

    return Response(content=audio_bytes, media_type="audio/mpeg")

@router.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    """Main REST endpoint for voice and text chat with Sam."""
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    messages = [{"role": m.role, "content": m.content} for m in (req.history or [])]
    messages.append({"role": "user", "content": req.message})

    # 1. Generate text response with real-time tool calling
    llm_result = await llm_service.get_response(
        messages=messages,
        system_prompt=req.system_prompt,
        provider=req.provider,
        gemini_key=req.gemini_api_key,
        openai_key=req.openai_api_key,
        groq_key=req.groq_api_key,
        model_name=req.model_name,
        enable_tools=bool(req.enable_tools),
        enable_web_search=req.enable_web_search if req.enable_web_search is not None else True,
        enable_weather=req.enable_weather if req.enable_weather is not None else True,
        local_base_url=req.local_base_url,
    )

    response_text = llm_result["response"]
    tool_used = llm_result.get("tool_used")
    provider_used = llm_result.get("provider_used", "demo")
    sources = llm_result.get("sources", [])

    # 2. Synthesize audio if requested
    audio_base64 = None
    if req.generate_audio and response_text:
        try:
            audio_bytes = await tts_service.generate_speech(
                text=response_text,
                voice=req.voice,
                rate=req.rate,
                pitch=req.pitch
            )
            if audio_bytes:
                audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
        except Exception as e:
            print(f"TTS synthesis error in /api/chat: {e}")

    return ChatResponse(
        response=response_text,
        audio_base64=audio_base64,
        provider_used=provider_used,
        tool_used=tool_used,
        sources=sources,
        image=llm_result.get("image"),
        media=llm_result.get("media")
    )

@router.post("/api/chat/stream")
async def chat_stream_endpoint(req: ChatRequest):
    """Streaming chat: emits NDJSON events as they happen.

    Event flow per request:
      {"type": "sentence", "text": "...", "audio": "<base64 mp3>"}   (one per sentence)
      {"type": "done", "response": "...", "tool_used": ..., "sources": [...], "image": ...}
      {"type": "error", "message": "..."}                              (on failure)

    The client can start playing each sentence's audio while later sentences
    are still being generated — the key latency win for local AI models.
    """
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    messages = [{"role": m.role, "content": m.content} for m in (req.history or [])]
    messages.append({"role": "user", "content": req.message})

    async def event_stream():
        try:
            async for evt in llm_service.stream_response(
                messages=messages,
                system_prompt=req.system_prompt,
                provider=req.provider,
                gemini_key=req.gemini_api_key,
                openai_key=req.openai_api_key,
                groq_key=req.groq_api_key,
                model_name=req.model_name,
                enable_tools=bool(req.enable_tools),
                enable_web_search=req.enable_web_search if req.enable_web_search is not None else True,
                enable_weather=req.enable_weather if req.enable_weather is not None else True,
                local_base_url=req.local_base_url,
                voice=req.voice,
                rate=req.rate,
                pitch=req.pitch,
            ):
                yield json.dumps(evt, ensure_ascii=False) + "\n"
        except Exception as e:
            print(f"Stream endpoint error: {e}")
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")

@router.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket endpoint for real-time speech interaction."""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)

            msg_type = payload.get("type", "message")
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            user_text = payload.get("text", "").strip()
            if not user_text:
                continue

            history = payload.get("history", [])
            settings_payload = payload.get("settings", {})

            # Inform client we are thinking or searching
            await websocket.send_json({"type": "status", "status": "thinking"})

            messages = [{"role": m.get("role", "user"), "content": m.get("content", "")} for m in history]
            messages.append({"role": "user", "content": user_text})

            llm_result = await llm_service.get_response(
                messages=messages,
                system_prompt=settings_payload.get("system_prompt"),
                provider=settings_payload.get("provider"),
                gemini_key=settings_payload.get("gemini_api_key"),
                openai_key=settings_payload.get("openai_api_key"),
                groq_key=settings_payload.get("groq_api_key"),
                model_name=settings_payload.get("model_name"),
                enable_tools=settings_payload.get("enable_tools", True),
                enable_web_search=settings_payload.get("enable_web_search", True),
                enable_weather=settings_payload.get("enable_weather", True),
                local_base_url=settings_payload.get("local_base_url"),
            )

            response_text = llm_result["response"]
            tool_used = llm_result.get("tool_used")
            sources = llm_result.get("sources", [])

            # Send back the completed text, tool metadata, and sources
            await websocket.send_json({
                "type": "text_complete",
                "text": response_text,
                "tool_used": tool_used,
                "sources": sources,
                "image": llm_result.get("image"),
                "media": llm_result.get("media")
            })

            # Synthesize voice and stream audio
            await websocket.send_json({"type": "status", "status": "speaking"})
            try:
                audio_bytes = await tts_service.generate_speech(
                    text=response_text,
                    voice=settings_payload.get("voice"),
                    rate=settings_payload.get("rate"),
                    pitch=settings_payload.get("pitch")
                )
                if audio_bytes:
                    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
                    await websocket.send_json({
                        "type": "audio",
                        "audio": audio_base64
                    })
            except Exception as e:
                print(f"WS TTS error: {e}")
                await websocket.send_json({
                    "type": "error",
                    "message": f"Audio synthesis failed: {str(e)}"
                })

            await websocket.send_json({"type": "status", "status": "idle"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket exception: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
