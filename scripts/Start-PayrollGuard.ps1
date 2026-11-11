param(
  [switch]$InstallDependencies,
  [switch]$GenerateData
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "[1/4] Checking MongoDB on localhost:27017..." -ForegroundColor Cyan
$mongo = Test-NetConnection -ComputerName 127.0.0.1 -Port 27017 -WarningAction SilentlyContinue
if (-not $mongo.TcpTestSucceeded) {
  $mongoService = Get-Service -Name MongoDB -ErrorAction SilentlyContinue
  if ($mongoService -and $mongoService.Status -ne 'Running') {
    Write-Host "Starting the MongoDB Windows service..." -ForegroundColor Yellow
    try { Start-Service -Name MongoDB -ErrorAction Stop; Start-Sleep -Seconds 4 } catch { Write-Warning "Could not start MongoDB service automatically: $($_.Exception.Message)" }
  }
  $mongo = Test-NetConnection -ComputerName 127.0.0.1 -Port 27017 -WarningAction SilentlyContinue
  if (-not $mongo.TcpTestSucceeded) {
    Write-Warning "MongoDB is not listening on port 27017. Start MongoDB Community Server (Services > MongoDB Server), then run this script again."
    exit 1
  }
}

if ($InstallDependencies) {
  Write-Host "[2/4] Installing backend dependencies..." -ForegroundColor Cyan
  py -3.11 -m venv backend\.venv
  & backend\.venv\Scripts\python.exe -m pip install --upgrade pip
  & backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
  Write-Host "[3/4] Installing frontend dependencies..." -ForegroundColor Cyan
  npm install
}

if (-not (Test-Path 'backend\.venv\Scripts\python.exe')) {
  throw "Backend virtual environment not found. Run: .\scripts\Start-PayrollGuard.ps1 -InstallDependencies"
}
if (-not (Test-Path 'backend\.env')) { Copy-Item 'backend\.env.example' 'backend\.env' }
$env:PYTHONPATH = Join-Path $Root 'backend'

if ($GenerateData) {
  Write-Host "Generating 3,000 employees and 100,000+ payroll records in the local MongoDB..." -ForegroundColor Yellow
  & backend\.venv\Scripts\python.exe backend\scripts\init_db.py
  if ($LASTEXITCODE -ne 0) { throw 'MongoDB schema initialization failed.' }
  & backend\.venv\Scripts\python.exe backend\scripts\generate_synthetic_data.py --reset --seed 20261022
  if ($LASTEXITCODE -ne 0) { throw 'Synthetic data generation failed.' }
}

Write-Host "Starting PayrollGuard API at http://127.0.0.1:8001 ..." -ForegroundColor Green
Start-Process -FilePath (Join-Path $Root 'backend\.venv\Scripts\python.exe') -ArgumentList @('-m','uvicorn','app.main:app','--app-dir','backend','--reload','--port','8001') -WorkingDirectory $Root
Start-Sleep -Seconds 3
try { Invoke-RestMethod 'http://127.0.0.1:8001/api/v1/payrollguard/health' | Format-List } catch { Write-Warning "API health check failed: $($_.Exception.Message)" }
Write-Host "Starting Naxpayroll frontend at http://localhost:8443 ..." -ForegroundColor Green
npm run dev
