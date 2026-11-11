# Start Naxpayroll full stack: Backend (FastAPI) and Frontend (Vite)
Write-Host "Checking MongoDB connection..." -ForegroundColor Cyan
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", 27017)
    $tcp.Close()
    Write-Host "[OK] MongoDB is running on 127.0.0.1:27017" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] MongoDB is not responding on 127.0.0.1:27017. Please ensure MongoDB Community Server is started." -ForegroundColor Yellow
}

Write-Host "`nStarting FastAPI backend on port 8001..." -ForegroundColor Cyan
$backend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PYTHONPATH='backend'; python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8001 --reload" -PassThru

Write-Host "Starting Vite frontend dev server on port 8443..." -ForegroundColor Cyan
$frontend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -PassThru

Write-Host "`nAll services launched!" -ForegroundColor Green
Write-Host "Frontend:  http://localhost:8443" -ForegroundColor White
Write-Host "Backend:   http://localhost:8001" -ForegroundColor White
Write-Host "API Docs:  http://localhost:8001/docs" -ForegroundColor White
Write-Host "Database:  mongodb://127.0.0.1:27017/naxpayroll_guard" -ForegroundColor White
