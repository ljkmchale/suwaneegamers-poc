# Registers (or updates) the SuwaneeGamersVoiceWatchdog scheduled task.
#
# Run this ONCE, in an ELEVATED PowerShell. Task creation requires elevation on
# this box (same as the SuwaneeGamersVoiceStack task). The watchdog itself runs
# user-level and needs no elevation once registered.
#
#   Right-click PowerShell -> Run as administrator, then:
#   & "C:\Users\Larry McHale\Desktop\suwaneegamers-poc\scripts\install-voice-watchdog.ps1"

$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "This installer must be run from an elevated (Administrator) PowerShell."
}

$taskName = "SuwaneeGamersVoiceWatchdog"
$script   = "C:\Users\Larry McHale\Desktop\suwaneegamers-poc\scripts\watchdog-voice-stack.ps1"
if (-not (Test-Path $script)) { throw "Watchdog script not found: $script" }

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""

# Runs as the interactive user (the voice stack needs Larry's session + GPU), no
# elevation, only while logged on -- matching SuwaneeGamersVoiceStack.
$principal = New-ScheduledTaskPrincipal -UserId "Larry McHale" -LogonType Interactive -RunLevel Limited

$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

# Start with the session, then re-check every 2 minutes. 3650-day duration is the
# max the Task Scheduler XML accepts for "effectively indefinite" ([TimeSpan]::MaxValue overflows).
$tLogon  = New-ScheduledTaskTrigger -AtLogOn
$tRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes 2) -RepetitionDuration (New-TimeSpan -Days 3650)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $tLogon, $tRepeat `
  -Principal $principal -Settings $settings -Force `
  -Description "Self-healing watchdog for the Myra voice stack. Every 2 min checks LiveKit, Speaches, Parakeet, and the agent worker process; if any is down (or the worker is hung/unregistered) it triggers the idempotent SuwaneeGamersVoiceStack task to relaunch only what is missing. Logs to %LOCALAPPDATA%\SuwaneeGamers\logs\watchdog.log." | Out-Null

Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 3
Write-Host "Registered and started '$taskName'." -ForegroundColor Green
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State | Format-Table -AutoSize
Get-ScheduledTaskInfo -TaskName $taskName | Select-Object LastRunTime, LastTaskResult, NextRunTime | Format-List
Write-Host "Watchdog log: $env:LOCALAPPDATA\SuwaneeGamers\logs\watchdog.log"
