import re
from typing import AsyncGenerator, Dict, List
import edge_tts
from ..config import settings

# Curated list of popular natural voices for easy selection
POPULAR_VOICES = [
    {
        "id": "en-US-GuyNeural",
        "name": "Sam (Male / Natural US)",
        "locale": "en-US",
        "gender": "Male",
        "description": "Warm, confident, conversational American voice"
    },
    {
        "id": "en-US-JennyNeural",
        "name": "Samantha (Female / Friendly US)",
        "locale": "en-US",
        "gender": "Female",
        "description": "Clear, expressive, warm American voice"
    },
    {
        "id": "en-US-ChristopherNeural",
        "name": "Sam (Male / Deep US)",
        "locale": "en-US",
        "gender": "Male",
        "description": "Deep, authoritative, calm American voice"
    },
    {
        "id": "en-US-AriaNeural",
        "name": "Aria (Female / Crisp US)",
        "locale": "en-US",
        "gender": "Female",
        "description": "Intelligent, dynamic American voice"
    },
    {
        "id": "en-GB-RyanNeural",
        "name": "Oliver (Male / British)",
        "locale": "en-GB",
        "gender": "Male",
        "description": "Polite, articulate British voice"
    },
    {
        "id": "en-GB-SoniaNeural",
        "name": "Eleanor (Female / British)",
        "locale": "en-GB",
        "gender": "Female",
        "description": "Refined, friendly British voice"
    },
    {
        "id": "en-AU-WilliamNeural",
        "name": "Jack (Male / Australian)",
        "locale": "en-AU",
        "gender": "Male",
        "description": "Casual, energetic Australian voice"
    },
]

def clean_text_for_speech(text: str) -> str:
    """Strip markdown symbols, urls, and format weather/math symbols for clear speech."""
    if not text:
        return ""
    # Remove markdown links: [text](url) -> text
    cleaned = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    # Remove raw URLs
    cleaned = re.sub(r'https?://\S+', 'website link', cleaned)
    # Remove code blocks FIRST (before backticks are stripped individually)
    cleaned = re.sub(r'```[\s\S]*?```', 'code omitted', cleaned)
    # Remove bold, italics, code formatting: **text**, *text*, `code`
    cleaned = re.sub(r'[*_`#~]', '', cleaned)
    # Expand weather units & temperature symbols for natural pronunciation
    cleaned = re.sub(r'([0-9]+(?:\.[0-9]+)?)\s*(?:°C|℃)', r'\1 degrees Celsius', cleaned)
    cleaned = re.sub(r'([0-9]+(?:\.[0-9]+)?)\s*(?:°F|℉)', r'\1 degrees Fahrenheit', cleaned)
    cleaned = re.sub(r'°[Cc]', ' degrees Celsius', cleaned)
    cleaned = re.sub(r'°[Ff]', ' degrees Fahrenheit', cleaned)
    cleaned = re.sub(r'°', ' degrees ', cleaned)
    cleaned = re.sub(r'\bkm/h\b', 'kilometers per hour', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\bmph\b', 'miles per hour', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'([0-9]+)%(?!\w)', r'\1 percent', cleaned)
    cleaned = re.sub(r'&', ' and ', cleaned)
    cleaned = re.sub(r'[•·]', '', cleaned)
    # Remove emojis and miscellaneous symbols that could confuse TTS or sound awkward
    emoji_pattern = re.compile(
        r'[\U00010000-\U0010ffff'
        r'\u2600-\u26FF'
        r'\u2700-\u27BF'
        r'\u2300-\u23FF'
        r'\u2B50-\u2B55'
        r'\uFE00-\uFE0F'
        r']+',
        flags=re.UNICODE
    )
    cleaned = emoji_pattern.sub('', cleaned)
    # Normalize excessive spaces
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

class TTSService:
    @staticmethod
    def get_popular_voices() -> List[Dict]:
        return POPULAR_VOICES

    @staticmethod
    async def get_all_voices() -> List[Dict]:
        try:
            voices = await edge_tts.list_voices()
            return [
                {
                    "id": v["ShortName"],
                    "name": v["FriendlyName"],
                    "locale": v["Locale"],
                    "gender": v["Gender"],
                }
                for v in voices
            ]
        except Exception as e:
            print(f"Error fetching voices: {e}")
            return POPULAR_VOICES

    @staticmethod
    async def generate_speech(
        text: str,
        voice: str | None = None,
        rate: str | None = None,
        pitch: str | None = None
    ) -> bytes:
        """Synthesizes text into MP3 audio bytes using edge-tts."""
        cleaned = clean_text_for_speech(text)
        if not cleaned:
            return b""
            
        selected_voice = voice or settings.DEFAULT_VOICE
        selected_rate = rate or settings.DEFAULT_RATE
        selected_pitch = pitch or settings.DEFAULT_PITCH

        communicate = edge_tts.Communicate(
            cleaned,
            voice=selected_voice,
            rate=selected_rate,
            pitch=selected_pitch
        )
        
        audio_chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])
                
        return b"".join(audio_chunks)

    @staticmethod
    async def stream_speech(
        text: str,
        voice: str | None = None,
        rate: str | None = None,
        pitch: str | None = None
    ) -> AsyncGenerator[bytes, None]:
        """Stream MP3 audio chunks."""
        cleaned = clean_text_for_speech(text)
        if not cleaned:
            return

        selected_voice = voice or settings.DEFAULT_VOICE
        selected_rate = rate or settings.DEFAULT_RATE
        selected_pitch = pitch or settings.DEFAULT_PITCH

        communicate = edge_tts.Communicate(
            cleaned,
            voice=selected_voice,
            rate=selected_rate,
            pitch=selected_pitch
        )
        
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]

tts_service = TTSService()
