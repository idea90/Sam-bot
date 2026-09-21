from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from .config import settings
from .routers import chat, agent

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("--------------------------------------------------")
    print(f"🎙️  Sam Voice Assistant Backend running on http://{settings.HOST}:{settings.PORT}")
    print(f"🧠  LLM Provider: {settings.LLM_PROVIDER}")
    print(f"🔊  Default Voice: {settings.DEFAULT_VOICE}")
    print("--------------------------------------------------")
    yield

app = FastAPI(
    title="Sam Voice Assistant API",
    description="Backend API for Sam, an interactive web voice assistant.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration to allow the local web client (Vite dev + preview ports)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(chat.router)
app.include_router(agent.router)

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Sam Voice Assistant",
        "version": "1.0.0"
    }

def start():
    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )

if __name__ == "__main__":
    start()
