param()

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$agentRoot = Join-Path $repoRoot "services\livekit-schedule-agent"
$logRoot = Join-Path $env:LOCALAPPDATA "SuwaneeGamers\logs"
$stdoutLog = Join-Path $logRoot "myra-avatar-poc.log"
$stderrLog = Join-Path $logRoot "myra-avatar-poc.err.log"
$pidPath = Join-Path $logRoot "myra-avatar-poc.pid"

if (Test-Path -LiteralPath $pidPath) {
  $existingPid = [int](Get-Content -Raw -LiteralPath $pidPath)
  if (Get-Process -Id $existingPid -ErrorAction SilentlyContinue) {
    Write-Output "Myra avatar POC worker is already running (PID $existingPid)."
    exit 0
  }
}

$uv = Get-Command uv -ErrorAction Stop
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null

# These values are inherited only by the child POC worker. The existing Myra
# process keeps its original environment and remains registered as `myra`.
$env:LIVEKIT_AGENT_NAME = "myra-avatar-poc"
$env:MYRA_AVATAR_PROVIDER = "lemonslice"
# LemonSlice joins the room from outside this machine, so this POC worker must
# advertise the public LiveKit endpoint. The normal Myra worker keeps using its
# existing local endpoint.
$env:LIVEKIT_URL = "wss://voice.suwaneegamers.net"

$process = Start-Process `
  -FilePath $uv.Source `
  -ArgumentList @("run", "python", "-m", "schedule_agent.agent", "start") `
  -WorkingDirectory $agentRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutLog `
  -RedirectStandardError $stderrLog `
  -PassThru

Start-Sleep -Seconds 4
if ($process.HasExited) {
  throw "The avatar POC worker exited during startup. Check $stderrLog"
}
[IO.File]::WriteAllText($pidPath, [string]$process.Id)

Write-Output "Myra avatar POC worker started (PID $($process.Id))."
Write-Output "Logs: $stdoutLog"
