# Restarts ONLY the Suwanee Gamers LiveKit voice agent, leaving the rest of the
# local voice stack (LiveKit server, Speaches, Ollama) untouched.
#
# The agent runs as a bare detached process (python -m schedule_agent.agent start),
# not a Windows service, so "restart" = stop it, then re-run the idempotent stack
# launcher (scripts/start-local-voice-stack.ps1), which relaunches only what is not
# already listening — i.e. just the agent.
#
# Usage (no elevation needed):
#   powershell -ExecutionPolicy Bypass -File scripts\restart-voice-agent.ps1
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $PSScriptRoot "start-local-voice-stack.ps1"

function Get-AgentProcesses {
  Get-CimInstance Win32_Process | Where-Object {
    $_.Name -match "^python" -and $_.CommandLine -match "schedule_agent\.agent"
  }
}

# --- Stop the running agent (worker + its child subprocess) ---
$before = Get-AgentProcesses
if ($before) {
  Write-Host "Stopping voice agent (PIDs: $($before.ProcessId -join ', '))..."
  $before | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
} else {
  Write-Host "No voice agent process was running."
}

# Wait for full exit so the idempotent launcher does not see a lingering process
# and skip the relaunch.
for ($i = 0; $i -lt 10; $i++) {
  Start-Sleep -Milliseconds 1000
  if (-not (Get-AgentProcesses)) { break }
}
if (Get-AgentProcesses) {
  throw "Voice agent did not exit; aborting relaunch to avoid duplicates."
}
Write-Host "Voice agent stopped."

# --- Relaunch via the idempotent stack launcher (starts only the agent) ---
Write-Host "Relaunching voice agent..."
& $launcher

# --- Verify it came back and stayed up ---
Start-Sleep -Seconds 5
$after = Get-AgentProcesses
if ($after) {
  Write-Host "Voice agent restarted (PIDs: $($after.ProcessId -join ', '))."
  # 8767 is Parakeet STT (primary). If it is not listening the agent still works
  # via the Whisper fallback, but it is worth seeing in the readout.
  foreach ($port in @(7880, 8000, 8767, 11434)) {
    $up = [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
    Write-Host ("  stack port {0} listening: {1}" -f $port, $up)
  }
} else {
  throw "Voice agent failed to start. Check the agent logs under $repoRoot\services\livekit-schedule-agent."
}
