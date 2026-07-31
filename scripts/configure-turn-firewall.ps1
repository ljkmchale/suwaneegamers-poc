#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

& netsh.exe advfirewall firewall delete rule name="Suwanee LiveKit TURN TLS" | Out-Null
& netsh.exe advfirewall firewall delete rule name="Suwanee LiveKit TURN TLS 5349" | Out-Null
& netsh.exe advfirewall firewall delete rule name="Suwanee LiveKit TURN TLS 443" | Out-Null
& netsh.exe advfirewall firewall add rule `
  name="Suwanee LiveKit TURN TLS 443" `
  dir=in `
  action=allow `
  protocol=TCP `
  localport=443 `
  profile=any | Out-Null

if ($LASTEXITCODE -ne 0) {
  throw "Unable to install the TURN/TLS firewall rule."
}

Write-Output "TURN/TLS firewall rule installed on TCP 443."
