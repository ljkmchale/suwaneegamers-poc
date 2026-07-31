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

# Everything here used to start hidden with no redirection, so when a service
# died or misbehaved its output went nowhere. That is what hid the off-network
# ICE failures: LiveKit was logging the cause every start and nothing kept it.
$logRoot = Join-Path $env:LOCALAPPDATA "SuwaneeGamers\logs"
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null

# stdout and stderr must be separate files -- Start-Process rejects redirecting
# both to one path. The previous run is kept as *.1 so a service that crashes
# and gets restarted does not erase the log explaining why it crashed.
function Start-Logged([string]$name, [hashtable]$processArgs) {
  $outPath = Join-Path $logRoot "$name.log"
  $errPath = Join-Path $logRoot "$name.err.log"
  foreach ($path in @($outPath, $errPath)) {
    if (Test-Path -LiteralPath $path) {
      Move-Item -LiteralPath $path -Destination "$path.1" -Force -ErrorAction SilentlyContinue
    }
  }
  Start-Process @processArgs `
    -RedirectStandardOutput $outPath `
    -RedirectStandardError $errPath `
    -WindowStyle Hidden
}

if (-not (Test-TcpPort 7880)) {
  # Read BOTH streams when debugging LiveKit: it logs normally to stderr, but
  # writes fatal startup failures to stdout -- "no matching node IP for relay"
  # only ever appeared there. The lines worth grepping in livekit.err.log are
  # "using external IPs" (must map the public IP, not the private one) and the
  # per-participant "ICE candidate pair stats".
  Start-Logged "livekit" @{
    FilePath = $liveKitExe
    ArgumentList = "--config=`"$liveKitConfig`""
    WorkingDirectory = (Split-Path -Parent $liveKitExe)
  }
}

if (-not (Test-TcpPort 8000)) {
  # STT speed. The distil-whisper weights ship as float16, which CTranslate2
  # cannot compute on CPU — it silently dequantizes and runs float32. Asking for
  # int8 and using all 16 threads measured 2181ms -> 1739ms on a 3.4s clip, with
  # a byte-identical transcript. End-of-utterance delay is the largest single
  # component of Myra's response time, so this comes straight off the top.
  $env:WHISPER__COMPUTE_TYPE = "int8"
  $env:WHISPER__CPU_THREADS = "16"
  Start-Logged "speaches" @{
    FilePath = (Join-Path $speachesRoot ".venv\Scripts\uvicorn.exe")
    ArgumentList = @(
      "--factory",
      "--host", "127.0.0.1",
      "--port", "8000",
      "speaches.main:create_app"
    )
    WorkingDirectory = $speachesRoot
  }
}

if (-not (Test-TcpPort 11434)) {
  $ollama = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
  $env:OLLAMA_KEEP_ALIVE = "-1"
  # Grant the GPU to Ollama only (the model runs 100% on the RTX 5060).
  $env:CUDA_VISIBLE_DEVICES = "0"
  Start-Logged "ollama" @{
    FilePath = $ollama
    ArgumentList = "serve"
    WorkingDirectory = (Split-Path -Parent $ollama)
  }
  # Restore CPU-only for anything launched after this (the agent).
  $env:CUDA_VISIBLE_DEVICES = "-1"
}

$agentRunning = Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -match "^python" -and
    $_.CommandLine -match "schedule_agent\.agent"
  }
if (-not $agentRunning) {
  # Myra's own log: STT/LLM/TTS metrics per turn, and the reason a session
  # closed. The agent.log next to the service source is a stale artifact of a
  # manual run -- this is the live one.
  Start-Logged "agent" @{
    FilePath = (Join-Path $agentRoot ".venv\Scripts\python.exe")
    ArgumentList = @("-m", "schedule_agent.agent", "start")
    WorkingDirectory = $agentRoot
  }
}
