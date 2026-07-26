$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$webEnvironment = Join-Path $repoRoot "apps\web\.env.local"
$values = @{}
foreach ($line in [IO.File]::ReadAllLines($webEnvironment)) {
  if ($line -match "^([^#=]+)=(.*)$") {
    $values[$Matches[1].Trim()] = $Matches[2].Trim()
  }
}

$env:CLOUDFLARE_DNS_API_TOKEN = $values["CLOUDFLARE_API_TOKEN"]
if (-not $env:CLOUDFLARE_DNS_API_TOKEN) {
  throw "CLOUDFLARE_API_TOKEN is required for TURN certificate renewal."
}

$email = ($values["ADMIN_EMAILS"] -split ",")[0].Trim()
if (-not $email) {
  throw "ADMIN_EMAILS must contain an ACME contact address."
}

$lego = Get-ChildItem `
  -LiteralPath (Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages") `
  -Recurse `
  -Filter "lego.exe" |
  Select-Object -First 1 -ExpandProperty FullName
if (-not $lego) {
  throw "The lego ACME client is not installed."
}

& $lego run `
  --accept-tos `
  --email $email `
  --dns cloudflare `
  --domains turn.suwaneegamers.net `
  --path (Join-Path $env:LOCALAPPDATA "SuwaneeGamers\LiveKit")
if ($LASTEXITCODE -ne 0) {
  throw "TURN certificate renewal failed."
}

& (Join-Path $repoRoot "scripts\configure-livekit-production.ps1")

$liveKit = Get-CimInstance Win32_Process |
  Where-Object { $_.Name -eq "livekit-server.exe" }
if ($liveKit) {
  Stop-Process -Id @($liveKit.ProcessId) -Force
}
& (Join-Path $repoRoot "scripts\start-local-voice-stack.ps1")

