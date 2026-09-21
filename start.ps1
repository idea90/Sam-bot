# Launch Sam Voice Assistant (Backend + Frontend)
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "   Starting Sam Voice Assistant (AI + Agent)  " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

Write-Host "`n[1/2] Starting Backend on http://127.0.0.1:8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; uv run uvicorn backend.main:app --reload"

Start-Sleep -Seconds 2

Write-Host "[2/2] Starting Frontend on http://localhost:5173..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; pnpm dev"

Write-Host "`nReady! Head to http://localhost:5173 in your browser." -ForegroundColor Cyan
