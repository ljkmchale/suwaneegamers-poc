# deploy-prod.ps1 — Build and restart the SuwaneeGamers production service.
# Run from an elevated PowerShell prompt for NSSM control.
# From a normal prompt it will build successfully but prompt you to restart manually.

param(
  [switch]$BuildOnly  # Skip the NSSM restart (useful when not elevated)
)

$ErrorActionPreference = "Stop"
$webDir = Join-Path $PSScriptRoot "..\apps\web"
$nssm    = "C:\EaselLocal\nssm.exe"
$service = "SuwaneeGamers"

# ── 1. Build ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "==> Building production bundle (.next-prod)..." -ForegroundColor Cyan
Push-Location $webDir
try {
  node scripts/build-prod.js
  if ($LASTEXITCODE -ne 0) { throw "Build failed (exit $LASTEXITCODE)" }
} finally {
  Pop-Location
}
Write-Host "==> Build complete." -ForegroundColor Green

if ($BuildOnly) {
  Write-Host ""
  Write-Host "BuildOnly flag set — skipping service restart." -ForegroundColor Yellow
  Write-Host "Run from an elevated prompt to restart: $nssm restart $service"
  exit 0
}

# ── 2. Check elevation ────────────────────────────────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)

if (-not $isAdmin) {
  Write-Host ""
  Write-Host "==> Build succeeded. Service restart requires elevation." -ForegroundColor Yellow
  Write-Host "    Run this from an elevated PowerShell to finish:" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "    C:\EaselLocal\nssm.exe restart $service" -ForegroundColor White
  Write-Host "    C:\EaselLocal\nssm.exe status  $service" -ForegroundColor White
  Write-Host ""
  exit 0
}

# ── 3. Restart NSSM service ───────────────────────────────────────────────────
Write-Host ""
Write-Host "==> Restarting $service service..." -ForegroundColor Cyan
& $nssm restart $service
Start-Sleep -Seconds 3

$status = & $nssm status $service
Write-Host "==> Service status: $status" -ForegroundColor $(if ($status -eq "SERVICE_RUNNING") { "Green" } else { "Red" })

if ($status -ne "SERVICE_RUNNING") {
  Write-Host ""
  Write-Host "ERROR: Service did not reach RUNNING state." -ForegroundColor Red
  Write-Host "Check NSSM logs: Get-EventLog -LogName Application -Source $service -Newest 5 | Format-List"
  exit 1
}

Write-Host ""
Write-Host "==> Production deployment complete. Running on port 4652." -ForegroundColor Green
