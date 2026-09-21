Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "Starting Sam Voice Assistant (Backend + Frontend)" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; uv run backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; pnpm dev"

Write-Host "Backend launching at http://localhost:8000" -ForegroundColor Green
Write-Host "Frontend launching at http://localhost:5173" -ForegroundColor Green
