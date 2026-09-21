@echo off
title Sam Voice Assistant Launcher
echo ==============================================
echo    Starting Sam Voice Assistant (AI + Agent)
echo ==============================================
echo.
echo [1/2] Launching Backend on http://127.0.0.1:8000 ...
start "Sam Backend (FastAPI)" cmd /k "cd backend && uv run uvicorn backend.main:app --reload"

timeout /t 2 /nobreak >nul

echo [2/2] Launching Frontend on http://localhost:5173 ...
start "Sam Frontend (Vite)" cmd /k "cd frontend && pnpm dev"

echo.
echo Both servers are starting in separate windows.
echo Open http://localhost:5173 in your browser when ready.
