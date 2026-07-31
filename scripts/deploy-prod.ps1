param(
  [switch]$BuildOnly
)

$ErrorActionPreference = "Stop"
$webDir = Join-Path $PSScriptRoot "..\apps\web"
$restartScript = Join-Path $PSScriptRoot "restart-and-verify.ps1"

Write-Host "==> Building the inactive immutable production slot..." -ForegroundColor Cyan
Push-Location $webDir
try {
  node scripts/build-prod.js
  if ($LASTEXITCODE -ne 0) {
    throw "Build failed (exit $LASTEXITCODE)"
  }
} finally {
  Pop-Location
}
Write-Host "==> Inactive slot build complete. The live site has not been changed." -ForegroundColor Green

if ($BuildOnly) {
  Write-Host "BuildOnly set; activate later from elevated PowerShell with:" -ForegroundColor Yellow
  Write-Host "powershell -ExecutionPolicy Bypass -File `"$restartScript`" -SkipVoice"
  exit 0
}

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)

if (-not $isAdmin) {
  Write-Warning "The staged build is ready, but activation requires Administrator privileges."
  Write-Host "Run this from elevated PowerShell:"
  Write-Host "powershell -ExecutionPolicy Bypass -File `"$restartScript`" -SkipVoice"
  exit 1
}

Write-Host "==> Activating the staged build and verifying production..." -ForegroundColor Cyan
& $restartScript -SkipVoice
if ($LASTEXITCODE -ne 0) {
  throw "Production activation failed (exit $LASTEXITCODE)"
}

Write-Host "==> Production deployment completed and verified." -ForegroundColor Green
