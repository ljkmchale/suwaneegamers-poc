# Voice-stack watchdog for Myra.
#
# Runs on a short interval (scheduled task SuwaneeGamersVoiceWatchdog). Each tick
# it health-checks every piece of the voice stack and, if anything is missing,
# self-heals by triggering the idempotent stack task -- which relaunches ONLY the
# down components (each block in start-local-voice-stack.ps1 is guarded by a
# port/process test).
#
# Why this exists: the stack task fires once and never re-checks. When the LiveKit
# *agent worker* (schedule_agent.agent) dies mid-session, port 7880 stays up (that
# is the LiveKit *server*), so Myra connects but never answers and nothing notices.
# The port-only health probe in lib/myraHealth.ts cannot see this. This watchdog
# checks the worker PROCESS, and also catches a hung worker (alive but not
# registered with LiveKit).
#
# User-level, no elevation: it only calls Start-ScheduledTask on the user-owned
# stack task. See CLAUDE.md "Who restarts what".

$ErrorActionPreference = "Stop"

$logRoot   = Join-Path $env:LOCALAPPDATA "SuwaneeGamers\logs"
$logPath   = Join-Path $logRoot "watchdog.log"
$statePath = Join-Path $logRoot "watchdog-state.json"
$stackTask = "SuwaneeGamersVoiceStack"

# Don't fire a second restart while the last one is still bringing services up
# (Parakeet GPU load is the slowest, ~20-40s). At a 2-min tick this mainly guards
# against back-to-back restarts when a service is genuinely slow to bind.
$restartCooldownSec = 150
# A worker that is alive but unregistered for this many consecutive checks
# (~4 min at a 2-min tick) is treated as hung and force-restarted. Normal
# startup-to-registration is a few seconds, well inside one tick.
$hungThreshold = 2

New-Item -ItemType Directory -Force -Path $logRoot | Out-Null

# Rotate at ~2MB so the log can't grow without bound.
if ((Test-Path $logPath) -and ((Get-Item $logPath).Length -gt 2MB)) {
  Move-Item -LiteralPath $logPath -Destination "$logPath.1" -Force -ErrorAction SilentlyContinue
}

function Write-Log([string]$level, [hashtable]$fields) {
  $rec = [ordered]@{ ts = (Get-Date).ToString("o"); level = $level }
  foreach ($k in $fields.Keys) { $rec[$k] = $fields[$k] }
  ($rec | ConvertTo-Json -Compress -Depth 5) | Add-Content -LiteralPath $logPath -Encoding utf8
}

function Test-Port([int]$port) {
  return [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}

# ---- load persisted state ----
$lastRestart = $null
$hungCount = 0
if (Test-Path $statePath) {
  try {
    $s = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    if ($s.lastRestart) { $lastRestart = [datetime]$s.lastRestart }
    if ($s.hungCount)   { $hungCount = [int]$s.hungCount }
  } catch { }
}

# ---- health checks ----
$livekit  = Test-Port 7880
$speaches = Test-Port 8000
$parakeet = Test-Port 8767

# The worker runs as two python processes: a uv launcher and the .venv child, and
# which one holds the LiveKit socket varies. Match ALL of them by command line, and
# test registration against the whole set -- attributing the connection to one pick
# gave false "hung" readings. Note port 7880 is shared with other local LiveKit
# agents (e.g. ziggy_agent), so we must filter by *our* pids, not "any python".
$workerPids = @(
  Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match "schedule_agent\.agent" } |
    ForEach-Object { $_.ProcessId }
) | Where-Object { $_ }   # drop the lone $null an empty match otherwise yields (@($null).Count == 1)
$workerPids = @($workerPids)
$workerAlive = $workerPids.Count -gt 0

# "Registered" = one of our worker processes holds a live connection to the LiveKit
# server. Alive but with no such connection = hung; it won't take a session.
$workerRegistered = $false
if ($workerAlive) {
  $conn = Get-NetTCPConnection -RemotePort 7880 -State Established -ErrorAction SilentlyContinue |
    Where-Object { $workerPids -contains $_.OwningProcess }
  $workerRegistered = [bool]$conn
}

$status = @{
  livekit          = $livekit
  speaches         = $speaches
  parakeet         = $parakeet
  worker           = $workerAlive
  workerRegistered = $workerRegistered
}

# ---- decide ----
$hung = $workerAlive -and (-not $workerRegistered)
if ($hung) { $hungCount = $hungCount + 1 } else { $hungCount = 0 }

$anyDown = (-not $livekit) -or (-not $speaches) -or (-not $parakeet) -or (-not $workerAlive)
$forceHung = $hung -and ($hungCount -ge $hungThreshold)
$needRecovery = $anyDown -or $forceHung

$now = Get-Date
$inCooldown = $lastRestart -and (($now - $lastRestart).TotalSeconds -lt $restartCooldownSec)

if (-not $needRecovery) {
  Write-Log "INFO" (@{ event = "heartbeat"; healthy = $true } + $status)
}
elseif ($inCooldown) {
  Write-Log "WARN" (@{ event = "recovery_suppressed_cooldown"; hungCount = $hungCount;
    cooldownRemainingSec = [int]($restartCooldownSec - ($now - $lastRestart).TotalSeconds) } + $status)
}
else {
  $down = @()
  if (-not $livekit)  { $down += "livekit" }
  if (-not $speaches) { $down += "speaches" }
  if (-not $parakeet) { $down += "parakeet" }
  if (-not $workerAlive) { $down += "worker" }
  if ($forceHung) { $down += "worker-hung" }

  # A hung worker won't be relaunched by the idempotent stack script (the processes
  # still exist), so kill all of ours first, then let the stack restart bring it back.
  if ($forceHung -and $workerAlive) {
    try {
      Stop-Process -Id $workerPids -Force -ErrorAction Stop
      Write-Log "WARN" @{ event = "killed_hung_worker"; pids = ($workerPids -join ","); hungCount = $hungCount }
    } catch {
      Write-Log "ERROR" @{ event = "kill_hung_worker_failed"; pids = ($workerPids -join ","); error = $_.Exception.Message }
    }
  }

  Write-Log "WARN" (@{ event = "recovery_triggered"; down = ($down -join ","); hungCount = $hungCount } + $status)
  try {
    Start-ScheduledTask -TaskName $stackTask -ErrorAction Stop
    $lastRestart = Get-Date
    $hungCount = 0

    # Confirm the worker actually came back (the piece that matters most).
    Start-Sleep -Seconds 10
    $recovered = Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -match "schedule_agent\.agent" } | Select-Object -First 1
    Write-Log "WARN" @{ event = "recovery_result"; workerBack = [bool]$recovered;
      livekit = (Test-Port 7880); speaches = (Test-Port 8000); parakeet = (Test-Port 8767) }
  } catch {
    Write-Log "ERROR" @{ event = "recovery_failed"; error = $_.Exception.Message }
  }
}

# ---- persist state ----
$out = @{
  lastRestart = if ($lastRestart) { $lastRestart.ToString("o") } else { $null }
  hungCount   = $hungCount
}
($out | ConvertTo-Json -Compress) | Set-Content -LiteralPath $statePath -Encoding utf8
