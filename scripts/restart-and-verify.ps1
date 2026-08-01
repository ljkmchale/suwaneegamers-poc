<#
.SYNOPSIS
Restarts the Suwanee Gamers website and Myra voice stack, then verifies them.

.DESCRIPTION
This is the operational restart entrypoint. It performs a real voice-stack
restart (the normal voice launcher is intentionally start-only), restarts the
NSSM website service, waits for every listener, and exercises both the sign-in
page and Myra's authenticated player-safe knowledge path.

Run an elevated PowerShell when restarting the website:

  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\restart-and-verify.ps1

Use -SkipWebsite when only the voice stack should be restarted and elevation is
not available. Use -SkipVoice to restart and verify only the website.
#>

[CmdletBinding()]
param(
  [switch]$SkipWebsite,
  [switch]$SkipVoice,
  [switch]$SkipKnowledgeQuery,
  [ValidateRange(10, 180)]
  [int]$TimeoutSeconds = 60
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$webRoot = Join-Path $repoRoot "apps\web"
$legacyBuild = Join-Path $webRoot ".next-prod"
$activePointer = Join-Path $webRoot ".next-prod-active.json"
$readyPointer = Join-Path $webRoot ".next-prod-ready.json"
$rollbackPointer = Join-Path $webRoot ".next-prod-rollback.json"
$allowedSlots = @(".next-prod", ".next-prod-a", ".next-prod-b")
$voiceLauncher = Join-Path $PSScriptRoot "start-local-voice-stack.ps1"
$agentRoot = Join-Path $repoRoot "services\livekit-schedule-agent"
$agentEnv = Join-Path $agentRoot ".env.local"
# Parakeet STT (primary speech recognition) runs from a venv outside the repo.
# When it is not installed on this machine the stack runs Whisper-only, so its
# checks below are skipped rather than failed.
$parakeetVenv = Join-Path $env:LOCALAPPDATA "SuwaneeGamers\Parakeet\.venv\Scripts\python.exe"
$serviceName = "SuwaneeGamers"
$websiteBaseUrl = "http://127.0.0.1:4652"

$results = [System.Collections.Generic.List[object]]::new()

function Add-Result {
  param(
    [string]$Component,
    [bool]$Passed,
    [string]$Detail
  )
  $results.Add([pscustomobject]@{
    Component = $Component
    Result = if ($Passed) { "PASS" } else { "FAIL" }
    Detail = $Detail
  })
  if ($Passed) {
    Write-Host ("[PASS] {0}: {1}" -f $Component, $Detail) -ForegroundColor Green
  } else {
    Write-Host ("[FAIL] {0}: {1}" -f $Component, $Detail) -ForegroundColor Red
  }
}

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Wait-Until {
  param(
    [scriptblock]$Condition,
    [string]$Description,
    [int]$Seconds = $TimeoutSeconds
  )
  $deadline = (Get-Date).AddSeconds($Seconds)
  do {
    if (& $Condition) { return $true }
    Start-Sleep -Milliseconds 750
  } while ((Get-Date) -lt $deadline)
  Write-Verbose "Timed out waiting for $Description."
  return $false
}

function Test-ListeningPort {
  param([int]$Port)
  return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Assert-SafeSlot {
  param([string]$Slot)
  if ($Slot -notin $allowedSlots) {
    throw "Unsafe production build slot: $Slot"
  }
}

function Get-ActiveSlot {
  if (Test-Path -LiteralPath $activePointer) {
    $slot = [string](Get-Content -LiteralPath $activePointer -Raw | ConvertFrom-Json).slot
    Assert-SafeSlot $slot
    return $slot
  }
  return ".next-prod"
}

function Get-SlotPath {
  param([string]$Slot)
  Assert-SafeSlot $Slot
  return Join-Path $webRoot $Slot
}

function Write-SlotPointer {
  param([string]$Path, [string]$Slot, [string]$BuildId)
  Assert-SafeSlot $Slot
  $json = @{
    slot = $Slot
    buildId = $BuildId
  } | ConvertTo-Json
  [IO.File]::WriteAllText($Path, "$json`r`n")
}

function Activate-StagedBuild {
  if (-not (Test-Path -LiteralPath $readyPointer)) {
    return $false
  }
  $ready = Get-Content -LiteralPath $readyPointer -Raw | ConvertFrom-Json
  $newSlot = [string]$ready.slot
  $newBuildId = [string]$ready.buildId
  Assert-SafeSlot $newSlot
  if ($newSlot -eq ".next-prod") {
    throw "The ready pointer cannot target the legacy production directory."
  }
  $newBuildPath = Get-SlotPath $newSlot
  $actualBuildId = if (Test-Path -LiteralPath (Join-Path $newBuildPath "BUILD_ID")) {
    (Get-Content -LiteralPath (Join-Path $newBuildPath "BUILD_ID") -Raw).Trim()
  } else { "" }
  if (-not $actualBuildId -or $actualBuildId -ne $newBuildId) {
    throw "The ready production slot is missing or its BUILD_ID does not match."
  }

  $oldSlot = Get-ActiveSlot
  $oldBuildPath = Get-SlotPath $oldSlot
  $oldBuildId = (Get-Content -LiteralPath (Join-Path $oldBuildPath "BUILD_ID") -Raw).Trim()
  Write-Host "Activating immutable production slot $newSlot..." -ForegroundColor Cyan
  Write-SlotPointer -Path $rollbackPointer -Slot $oldSlot -BuildId $oldBuildId
  Write-SlotPointer -Path $activePointer -Slot $newSlot -BuildId $newBuildId
  Remove-Item -LiteralPath $readyPointer -Force
  return $true
}

function Restore-RollbackBuild {
  if (-not (Test-Path -LiteralPath $rollbackPointer)) {
    return $false
  }
  $rollback = Get-Content -LiteralPath $rollbackPointer -Raw | ConvertFrom-Json
  $slot = [string]$rollback.slot
  $buildId = [string]$rollback.buildId
  Assert-SafeSlot $slot
  $buildPath = Get-SlotPath $slot
  if (-not (Test-Path -LiteralPath (Join-Path $buildPath "BUILD_ID"))) {
    return $false
  }
  Write-Host "Restoring previous production slot $slot..." -ForegroundColor Yellow
  Write-SlotPointer -Path $activePointer -Slot $slot -BuildId $buildId
  return $true
}

function Test-HttpOk {
  param(
    [string]$Uri,
    [int]$RequestTimeoutSeconds = 5
  )
  try {
    $response = Invoke-WebRequest `
      -Uri $Uri `
      -UseBasicParsing `
      -TimeoutSec $RequestTimeoutSeconds
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Get-MyraProcesses {
  return Get-CimInstance Win32_Process | Where-Object {
    $_.Name -match "^python" -and
    $_.CommandLine -match "schedule_agent\.agent"
  }
}

function Get-VoiceStackProcesses {
  return Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -match "^python" -and
      $_.CommandLine -match "schedule_agent\.agent|speaches\.main:create_app|uvicorn\.exe.*--port 8000|parakeet-stt") -or
    $_.Name -in @(
      "livekit-server.exe",
      "ollama.exe",
      "ollama app.exe",
      "llama-server.exe",
      "uvicorn.exe"
    )
  }
}

function Read-EnvValue {
  param(
    [string]$Path,
    [string]$Name
  )
  if (-not (Test-Path -LiteralPath $Path)) { return "" }
  $line = Get-Content -LiteralPath $Path |
    Where-Object { $_ -match ("^{0}=" -f [regex]::Escape($Name)) } |
    Select-Object -First 1
  if (-not $line) { return "" }
  return (($line -split "=", 2)[1]).Trim().Trim('"').Trim("'")
}

if (-not $SkipWebsite -and -not (Test-IsAdministrator)) {
  throw @"
Restarting the $serviceName Windows service requires an elevated PowerShell.
Open PowerShell with Run as administrator, change to:
  $repoRoot
then run:
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\restart-and-verify.ps1

For a voice-only restart, add -SkipWebsite.
"@
}

Write-Host ""
Write-Host "Suwanee Gamers restart and verification" -ForegroundColor Cyan
Write-Host "Workspace: $repoRoot"

if (-not $SkipVoice) {
  Write-Host ""
  Write-Host "Restarting Myra voice stack..." -ForegroundColor Cyan

  $voiceProcesses = @(Get-VoiceStackProcesses)
  if ($voiceProcesses.Count -gt 0) {
    Write-Host ("Stopping voice processes: {0}" -f ($voiceProcesses.ProcessId -join ", "))
    # Child Python/model processes first, then their launchers.
    $voiceProcesses |
      Sort-Object { if ($_.Name -match "python|uvicorn|llama-server") { 0 } else { 1 } } |
      ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
      }
  }

  $voiceStopped = Wait-Until -Description "voice ports to close" -Seconds 20 -Condition {
    -not (Test-ListeningPort 7880) -and
    -not (Test-ListeningPort 8000) -and
    -not (Test-ListeningPort 8767) -and
    -not (Test-ListeningPort 11434) -and
    -not (Get-MyraProcesses)
  }
  if (-not $voiceStopped) {
    # Some processes did not stop. The usual cause is that the stack was started
    # by the elevated SuwaneeGamersVoiceStack scheduled task (a different session
    # / higher integrity), so a non-elevated Stop-Process silently fails on them.
    # Do NOT leave the stack half-dead: run the idempotent launcher to restore
    # anything that DID go down (it only starts what is not already listening),
    # then fail with an actionable message.
    Write-Host "Some voice processes could not be stopped; restoring service before failing..." -ForegroundColor Yellow
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $voiceLauncher
    throw @"
Could not fully restart the voice stack: some processes could not be stopped
(most likely started elevated by the SuwaneeGamersVoiceStack scheduled task).
The idempotent launcher was run to restore any services that went down, so the
stack should be back up — but processes that could not be stopped are still on
their previous code. For a clean full restart, run this script from an ELEVATED
PowerShell.
"@
  }

  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $voiceLauncher
  if ($LASTEXITCODE -ne 0) {
    throw "The voice stack launcher exited with code $LASTEXITCODE."
  }
}

if (-not $SkipWebsite) {
  Write-Host ""
  Write-Host "Restarting $serviceName website service..." -ForegroundColor Cyan

  $service = Get-Service -Name $serviceName -ErrorAction Stop
  if ($service.Status -ne "Stopped") {
    Stop-Service -Name $serviceName -Force
    if (-not (Wait-Until -Description "$serviceName to stop" -Seconds 30 -Condition {
      (Get-Service -Name $serviceName).Status -eq "Stopped"
    })) {
      throw "$serviceName did not stop."
    }
  }

  $activatedStaging = Activate-StagedBuild
  $activeBuildPath = Get-SlotPath (Get-ActiveSlot)
  $buildIdPath = Join-Path $activeBuildPath "BUILD_ID"
  if (-not (Test-Path -LiteralPath $buildIdPath)) {
    throw "Cannot restart the website: $buildIdPath is missing. Run pnpm --filter web build:prod first."
  }

  try {
    Start-Service -Name $serviceName
  } catch {
    if ($activatedStaging -and (Restore-RollbackBuild)) {
      Start-Service -Name $serviceName
    }
    throw
  }
}

Write-Host ""
Write-Host "Verifying components..." -ForegroundColor Cyan

if (-not $SkipWebsite) {
  $websiteListening = Wait-Until -Description "website port 4652" -Condition {
    (Get-Service -Name $serviceName).Status -eq "Running" -and
    (Test-ListeningPort 4652)
  }
  Add-Result "Website service" $websiteListening $(
    if ($websiteListening) { "Running on port 4652" } else { "Service or port did not become ready" }
  )
  if (-not $websiteListening -and $activatedStaging) {
    Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
    if (Restore-RollbackBuild) {
      Start-Service -Name $serviceName
    }
    throw "The staged website failed to start; the previous bundle was restored."
  }

  try {
    $signInResponse = Invoke-WebRequest `
      -Uri "$websiteBaseUrl/signin" `
      -UseBasicParsing `
      -TimeoutSec 15
    $signInOk = $signInResponse.StatusCode -eq 200 -and
      $signInResponse.Content -match "Google"
    Add-Result "Website sign-in" $signInOk $(
      if ($signInOk) { "HTTP 200 with Google sign-in" } else { "Unexpected sign-in response" }
    )
    if (-not $signInOk -and $activatedStaging) {
      throw "The staged website failed its sign-in check; the previous bundle was restored."
    }
  } catch {
    if ($activatedStaging) {
      Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
      if (Restore-RollbackBuild) {
        Start-Service -Name $serviceName
      }
    }
    Add-Result "Website sign-in" $false $_.Exception.Message
    throw
  }
}

if (-not $SkipVoice) {
  $liveKitOk = Wait-Until -Description "LiveKit port 7880" -Condition {
    Test-ListeningPort 7880
  }
  Add-Result "LiveKit" $liveKitOk $(
    if ($liveKitOk) { "Listening on port 7880" } else { "Port 7880 is not listening" }
  )

  $speachesOk = Wait-Until -Description "Speaches models endpoint" -Condition {
    Test-HttpOk "http://127.0.0.1:8000/v1/models"
  }
  Add-Result "Speaches" $speachesOk $(
    if ($speachesOk) { "Models endpoint responding" } else { "Models endpoint did not become ready" }
  )

  $ollamaOk = Wait-Until -Description "Ollama model registry" -Condition {
    Test-HttpOk "http://127.0.0.1:11434/api/tags"
  }
  Add-Result "Ollama" $ollamaOk $(
    if ($ollamaOk) { "Model registry responding" } else { "Model registry did not become ready" }
  )

  # Parakeet is the primary STT but the agent falls back to Whisper if it is
  # down, so only fail the restart when it is installed and did not come up. It
  # loads a model on start (~10s), so give it the full timeout.
  if (Test-Path -LiteralPath $parakeetVenv) {
    $parakeetOk = Wait-Until -Description "Parakeet STT health" -Condition {
      Test-HttpOk "http://127.0.0.1:8767/health"
    }
    Add-Result "Parakeet STT" $parakeetOk $(
      if ($parakeetOk) { "Health endpoint responding on 8767" }
      else { "Health endpoint did not become ready (agent falls back to Whisper)" }
    )
  } else {
    Write-Host "[skip] Parakeet STT: venv not installed; running Whisper-only." -ForegroundColor DarkGray
  }

  $myraOk = Wait-Until -Description "Myra worker and health port" -Condition {
    [bool](Get-MyraProcesses) -and (Test-ListeningPort 8081)
  }
  Add-Result "Myra worker" $myraOk $(
    if ($myraOk) { "Worker running and port 8081 listening" } else { "Worker or health port is missing" }
  )
}

if (-not $SkipWebsite -and -not $SkipKnowledgeQuery) {
  $machineSecret = Read-EnvValue -Path $agentEnv -Name "LIVEKIT_API_SECRET"
  if (-not $machineSecret) {
    Add-Result "Myra knowledge" $false "LIVEKIT_API_SECRET is missing from the agent environment"
  } else {
    try {
      $headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $machineSecret"
      }
      $body = @{
        question = "What are Diverra's commandments?"
        visibility = "players"
        answerMode = "direct"
        quality = "fast"
      } | ConvertTo-Json
      $knowledgeResponse = Invoke-RestMethod `
        -Uri "$websiteBaseUrl/api/brain/ask" `
        -Method Post `
        -Headers $headers `
        -Body $body `
        -TimeoutSec 45
      $answer = [string]$knowledgeResponse.answer
      $knowledgeOk = $answer -match "Diverra" -and $answer -match "love"
      Add-Result "Myra knowledge" $knowledgeOk $(
        if ($knowledgeOk) { "Authenticated player-safe Diverra query passed" } else { "Knowledge answer was not grounded correctly" }
      )
    } catch {
      Add-Result "Myra knowledge" $false $_.Exception.Message
    }
  }
}

Write-Host ""
$results | Format-Table -AutoSize

$failures = @($results | Where-Object { $_.Result -eq "FAIL" })
if ($failures.Count -gt 0) {
  Write-Host ("Restart verification failed: {0} check(s) failed." -f $failures.Count) -ForegroundColor Red
  exit 1
}

Write-Host "Restart verification passed." -ForegroundColor Green
exit 0
