#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$logPath = "C:\EaselLocal\suwanee-public-voice-admin.log"
Start-Transcript -Path $logPath -Force | Out-Null

& netsh.exe advfirewall firewall delete rule name="Suwanee LiveKit WebRTC TCP" | Out-Null
& netsh.exe advfirewall firewall delete rule name="Suwanee LiveKit WebRTC UDP" | Out-Null
& netsh.exe advfirewall firewall delete rule name="Suwanee LiveKit TURN UDP" | Out-Null
& netsh.exe advfirewall firewall delete rule name="Suwanee LiveKit TURN TLS" | Out-Null

& netsh.exe advfirewall firewall add rule name="Suwanee LiveKit WebRTC TCP" dir=in action=allow protocol=TCP localport=7881 profile=any | Out-Null
& netsh.exe advfirewall firewall add rule name="Suwanee LiveKit WebRTC UDP" dir=in action=allow protocol=UDP localport=7882 profile=any | Out-Null
& netsh.exe advfirewall firewall add rule name="Suwanee LiveKit TURN UDP" dir=in action=allow protocol=UDP localport=3478 profile=any | Out-Null
& netsh.exe advfirewall firewall add rule name="Suwanee LiveKit TURN TLS" dir=in action=allow protocol=TCP localport=443 profile=any | Out-Null

$startupCommand = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File C:\EaselLocal\start-suwanee-voice.ps1"
& schtasks.exe /Create /TN "SuwaneeGamersVoiceStack" /SC ONLOGON /TR $startupCommand /RL LIMITED /F | Out-Null

Restart-Service -Name Cloudflared
Restart-Service -Name SuwaneeGamers

& (Join-Path $repoRoot "scripts\start-local-voice-stack.ps1")

Write-Output "Cloudflare and Suwanee Gamers were restarted."
Write-Output "LiveKit firewall rules were installed."
Write-Output "The local voice stack startup task was installed."
Stop-Transcript | Out-Null
