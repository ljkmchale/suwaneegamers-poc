$ErrorActionPreference = "Stop"

# GPU policy for this stack: Ollama (the LLM) runs on the RTX 5060; everything
# else stays on CPU. faster-whisper / CTranslate2 in Speaches does NOT run on
# this Blackwell card and crashes on model load if the GPU is visible, so the
# default here is CPU-only and we grant the GPU to Ollama alone, just before it
# launches. Do NOT set CUDA_VISIBLE_DEVICES globally (User/Machine scope) — that
# takes Speaches down with it.
$env:CUDA_VISIBLE_DEVICES = "-1"

$repoRoot = Split-Path -Parent $PSScriptRoot
$liveKitRoot = Join-Path $env:LOCALAPPDATA "SuwaneeGamers\LiveKit"
$liveKitExe = Join-Path $liveKitRoot "1.13.4\livekit-server.exe"
$liveKitConfig = Join-Path $liveKitRoot "livekit.yaml"
$speachesRoot = Join-Path $env:LOCALAPPDATA "SuwaneeGamers\Speaches\source"
$agentRoot = Join-Path $repoRoot "services\livekit-schedule-agent"

function Test-TcpPort([int]$port) {
  return [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}

if (-not (Test-TcpPort 7880)) {
  Start-Process `
    -FilePath $liveKitExe `
    -ArgumentList "--config=`"$liveKitConfig`"" `
    -WorkingDirectory (Split-Path -Parent $liveKitExe) `
    -WindowStyle Hidden
}

if (-not (Test-TcpPort 8000)) {
  Start-Process `
    -FilePath (Join-Path $speachesRoot ".venv\Scripts\uvicorn.exe") `
    -ArgumentList @(
      "--factory",
      "--host", "127.0.0.1",
      "--port", "8000",
      "speaches.main:create_app"
    ) `
    -WorkingDirectory $speachesRoot `
    -WindowStyle Hidden
}

if (-not (Test-TcpPort 11434)) {
  $ollama = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
  $env:OLLAMA_KEEP_ALIVE = "-1"
  # Grant the GPU to Ollama only (the model runs 100% on the RTX 5060).
  $env:CUDA_VISIBLE_DEVICES = "0"
  Start-Process `
    -FilePath $ollama `
    -ArgumentList "serve" `
    -WorkingDirectory (Split-Path -Parent $ollama) `
    -WindowStyle Hidden
  # Restore CPU-only for anything launched after this (the agent).
  $env:CUDA_VISIBLE_DEVICES = "-1"
}

$agentRunning = Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -match "^python" -and
    $_.CommandLine -match "schedule_agent\.agent"
  }
if (-not $agentRunning) {
  Start-Process `
    -FilePath (Join-Path $agentRoot ".venv\Scripts\python.exe") `
    -ArgumentList @("-m", "schedule_agent.agent", "start") `
    -WorkingDirectory $agentRoot `
    -WindowStyle Hidden
}
