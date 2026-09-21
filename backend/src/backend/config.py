import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env if present in backend root or project root
backend_root = Path(__file__).resolve().parent.parent.parent
load_dotenv(backend_root / ".env")
load_dotenv(backend_root.parent / ".env")

class Settings:
    # Default to loopback: this API can control the local system (apps, volume, lock PC)
    # and has no authentication, so it must not be exposed to the network by accident.
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # LLM Settings
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "")
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "auto")  # auto, groq, gemini, openai, local, demo

    # Local AI (LM Studio / Ollama / llama.cpp — any OpenAI-compatible local server)
    LOCAL_BASE_URL: str = os.getenv("LOCAL_BASE_URL", "")  # empty = auto-detect known ports
    LOCAL_API_KEY: str = os.getenv("LOCAL_API_KEY", "local")  # local servers ignore this, but the client needs a value

    # Default Ultra-Fast Models
    DEFAULT_MODEL_GROQ: str = os.getenv("DEFAULT_MODEL_GROQ", "llama-3.1-8b-instant")
    DEFAULT_MODEL_GEMINI: str = os.getenv("DEFAULT_MODEL_GEMINI", "gemini-3.6-flash")
    DEFAULT_MODEL_OPENAI: str = os.getenv("DEFAULT_MODEL_OPENAI", "gpt-4o-mini")
    DEFAULT_MODEL_LOCAL: str = os.getenv("DEFAULT_MODEL_LOCAL", "")  # empty = first model reported by the server
    
    # TTS Voice Settings
    DEFAULT_VOICE: str = os.getenv("DEFAULT_VOICE", "en-US-GuyNeural")
    DEFAULT_RATE: str = os.getenv("DEFAULT_RATE", "+0%")
    DEFAULT_PITCH: str = os.getenv("DEFAULT_PITCH", "+0Hz")
    
    # Persona & Voice Guidance
    SYSTEM_PROMPT: str = os.getenv(
        "SYSTEM_PROMPT",
        (
            "You are Sam, a friendly, witty, and highly capable web-based voice assistant. "
            "Respond in a natural, warm, and conversational tone. "
            "Keep your answers concise and direct—typically 1 to 3 sentences—since your words are spoken aloud via text-to-speech. "
            "Avoid markdown symbols such as asterisks, bullet points, headers, or long URLs that sound awkward when read aloud. "
            "Be enthusiastic, supportive, and sound like a helpful companion. "
            "CRITICAL: Never reply with empty promises like 'I am on it' or 'Let me look that up for you'. "
            "Always deliver the actual answer, news headlines, or facts immediately in your response."
        )
    )

settings = Settings()
