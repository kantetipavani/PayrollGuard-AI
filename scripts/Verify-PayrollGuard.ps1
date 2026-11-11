[CmdletBinding()]
param(
    [string]$ApiBaseUrl = "http://localhost:8001",
    [switch]$GenerateData,
    [switch]$RunPhase3,
    [int]$Seed = 20261022
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Passed = 0
$Failed = 0

function Test-Step([string]$Name, [scriptblock]$Action) {
    Write-Host "`n[TEST] $Name" -ForegroundColor Cyan
    try {
        & $Action
        Write-Host "[PASS] $Name" -ForegroundColor Green
        $script:Passed++
    }
    catch {
        Write-Host "[FAIL] $Name : $($_.Exception.Message)" -ForegroundColor Red
        $script:Failed++
    }
}

Set-Location $ProjectRoot

Test-Step "Python backend syntax" {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        py -3.11 -m compileall -q backend
    } else {
        python -m compileall -q backend
    }
    if ($LASTEXITCODE -ne 0) { throw "Python compileall returned $LASTEXITCODE" }
}

Test-Step "Frontend production build" {
    if (-not (Test-Path "node_modules")) { throw "node_modules missing. Run npm install first." }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build returned $LASTEXITCODE" }
    if (-not (Test-Path "dist/index.html")) { throw "dist/index.html was not created" }
}

$health = $null
Test-Step "PayrollGuard API and MongoDB health" {
    $health = Invoke-RestMethod -Uri "$ApiBaseUrl/api/v1/payrollguard/health" -TimeoutSec 10
    if ($health.status -ne "ok" -or $health.database -ne "connected") {
        throw "API did not report MongoDB connected: $($health | ConvertTo-Json -Compress)"
    }
}

if ($GenerateData) {
    Test-Step "Synthetic data generation" {
        Write-Warning "This resets PayrollGuard collections in the dedicated naxpayroll_guard database before generating data."
        $confirm = Read-Host "Type GENERATE to continue"
        if ($confirm -ne "GENERATE") { throw "Generation cancelled by user" }
        $null = Invoke-RestMethod -Method Post -Uri "$ApiBaseUrl/api/v1/payrollguard/generate?seed=$Seed" -TimeoutSec 600
    }
}

Test-Step "PayrollGuard dashboard and database counts" {
    $dashboard = Invoke-RestMethod -Uri "$ApiBaseUrl/api/v1/payrollguard/dashboard" -TimeoutSec 30
    if ($dashboard.database -ne "connected") { throw "Dashboard does not report database connected" }
    if ($dashboard.rules -ne 10) { throw "Expected 10 validation rules; found $($dashboard.rules)" }
    if ($GenerateData) {
        $expected = @{ employees=3000; pay_groups=1; pay_periods=3; time_entries=90000; leave_records=3000; allowance_transactions=5000; deduction_transactions=5000; exceptions=4; approvals=4; payroll_exports=0 }
        foreach ($key in $expected.Keys) {
            $actual = [int]$dashboard.counts.$key
            if ($actual -ne $expected[$key]) { throw "Expected $key=$($expected[$key]); found $actual" }
        }
    }
}

if ($RunPhase3) {
    $phase3Result = $null
    Test-Step "Phase 3 payroll calculation and reconciliation" {
        $periods = Invoke-RestMethod -Uri "$ApiBaseUrl/api/v1/payrollguard/periods" -TimeoutSec 30
        if (-not $periods -or $periods.Count -eq 0) { throw "No pay periods found. Generate Phase 2 data first." }
        $target = $periods | Where-Object { $_.pay_period_id -eq "PP-2026-01" } | Select-Object -First 1
        if (-not $target) { $target = $periods[0] }
        $phase3Result = Invoke-RestMethod -Method Post -Uri "$ApiBaseUrl/api/v1/payrollguard/calculate?pay_period_id=$($target.pay_period_id)" -TimeoutSec 300
        if ($phase3Result.status -ne "success") { throw "Calculation endpoint did not return success" }
        if ($phase3Result.reconciliation.status -ne "PASS") { throw "Reconciliation did not pass: $($phase3Result.reconciliation.status)" }
        if ($phase3Result.employee_count -le 0) { throw "No employees were processed" }
        if ($target.pay_period_id -eq "PP-2026-01" -and $phase3Result.unapproved_time_excluded -le 0) { throw "Expected unapproved time fixture to be excluded" }
        $report = Invoke-RestMethod -Uri "$ApiBaseUrl/api/v1/payrollguard/reconciliation/$($phase3Result.run_id)" -TimeoutSec 30
        if ($report.status -ne "PASS" -or [decimal]$report.difference -ne 0) { throw "Reconciliation report mismatch" }
    }
}

Write-Host "`nVerification summary: $Passed passed, $Failed failed" -ForegroundColor White
if ($Failed -gt 0) { exit 1 }
exit 0
