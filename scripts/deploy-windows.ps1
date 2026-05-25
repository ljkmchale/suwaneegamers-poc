$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$AppRoot = "C:\apps\suwaneegamers"
$WebRoot = Join-Path $AppRoot "apps\web"
$StandaloneRoot = Join-Path $WebRoot ".next\standalone\apps\web"

Set-Location $AppRoot

git pull origin main

pnpm install --frozen-lockfile
pnpm --filter web build

$StaticSource = Join-Path $WebRoot ".next\static"
$StaticTarget = Join-Path $StandaloneRoot ".next\static"
$PublicSource = Join-Path $WebRoot "public"
$PublicTarget = Join-Path $StandaloneRoot "public"

New-Item -ItemType Directory -Force -Path $StaticTarget | Out-Null
Copy-Item -Path (Join-Path $StaticSource "*") -Destination $StaticTarget -Recurse -Force

if (Test-Path $PublicSource) {
  New-Item -ItemType Directory -Force -Path $PublicTarget | Out-Null
  Copy-Item -Path (Join-Path $PublicSource "*") -Destination $PublicTarget -Recurse -Force
}

pm2 describe suwaneegamers-web *> $null
if ($LASTEXITCODE -eq 0) {
  pm2 reload ecosystem.config.js --update-env
} else {
  pm2 start ecosystem.config.js
}

pm2 save

Write-Host "Deploy complete."
