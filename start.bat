@echo off
echo ===================================================
echo Starting Sam Voice Assistant (Backend + Frontend)
echo ===================================================

start "Sam Backend (uv)" cmd /k "cd backend && uv run backend"
start "Sam Frontend (pnpm)" cmd /k "cd frontend && pnpm dev"

echo Backend running on http://localhost:8000
echo Frontend running on http://localhost:5173
echo.
pause
