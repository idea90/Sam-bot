import asyncio
import json
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    print("[OK] Root endpoint OK:", data)

def test_settings():
    response = client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert data["assistant_name"] == "Sam"
    print("[OK] Settings endpoint OK:", data)

def test_voices():
    response = client.get("/api/voices")
    assert response.status_code == 200
    data = response.json()
    assert len(data["voices"]) > 0
    print(f"[OK] Voices endpoint OK: found {len(data['voices'])} popular voices")

def test_chat_demo():
    payload = {
        "message": "Hello Sam, what time is it?",
        "provider": "demo",
        "generate_audio": True
    }
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert data["audio_base64"] is not None
    print("[OK] Chat endpoint OK:")
    print("  Response:", data["response"])
    print("  Audio bytes length (b64):", len(data["audio_base64"]))

def test_chat_web_search_sources():
    payload = {
        "message": "search the web for James Webb Space Telescope discoveries",
        "provider": "demo",
        "generate_audio": False,
        "enable_tools": True
    }
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert data["tool_used"] == "web_search"
    assert "sources" in data
    assert len(data["sources"]) > 0
    print("[OK] Chat Web Search Sources OK:")
    for s in data["sources"]:
        print(f"  Source: {s['domain']} -> {s['url']}")

def test_tts():
    payload = {
        "text": "Hello, this is Sam speaking.",
        "voice": "en-US-GuyNeural"
    }
    response = client.post("/api/tts", json=payload)
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert len(response.content) > 1000
    print(f"[OK] TTS endpoint OK: generated {len(response.content)} audio bytes")

def test_websocket():
    with client.websocket_connect("/ws/chat") as websocket:
        # Send ping
        websocket.send_json({"type": "ping"})
        msg = websocket.receive_json()
        assert msg["type"] == "pong"

        # Send user text
        websocket.send_json({
            "type": "user_speech",
            "text": "Tell me a joke",
            "settings": {"provider": "demo", "voice": "en-US-GuyNeural"}
        })

        # We should receive status, text_complete, and audio
        received_types = []
        for _ in range(5):
            try:
                data = websocket.receive_json()
                received_types.append(data.get("type"))
                if data.get("type") == "text_complete":
                    print("  WS Text complete:", data.get("text"))
                if data.get("type") == "status" and data.get("status") == "idle":
                    break
            except Exception:
                break

        assert "text_complete" in received_types
        print("[OK] WebSocket chat OK! Received message flow:", received_types)

def test_local_endpoints():
    res_status = client.get("/api/local/status")
    assert res_status.status_code == 200
    data_status = res_status.json()
    assert "available" in data_status
    print("[OK] Local status endpoint OK:", data_status)

    res_models = client.get("/api/local/models")
    assert res_models.status_code == 200
    data_models = res_models.json()
    assert "models" in data_models
    print("[OK] Local models endpoint OK:", data_models)

def test_chat_stream():
    payload = {
        "message": "Hello Sam, tell me a quick joke",
        "provider": "demo",
        "generate_audio": False,
    }
    response = client.post("/api/chat/stream", json=payload)
    assert response.status_code == 200
    events = [json.loads(line) for line in response.text.strip().split("\n") if line.strip()]
    event_types = [e.get("type") for e in events]
    assert "done" in event_types
    print(f"[OK] Chat stream endpoint OK! Received {len(events)} events: {event_types}")

if __name__ == "__main__":
    print("Running Sam Backend Verification Suite...")
    test_root()
    test_settings()
    test_voices()
    test_chat_demo()
    test_chat_web_search_sources()
    test_tts()
    test_websocket()
    test_local_endpoints()
    test_chat_stream()
    print("\nALL TESTS PASSED SUCCESSFULLY!")
