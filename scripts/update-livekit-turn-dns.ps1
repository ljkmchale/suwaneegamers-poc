$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $repoRoot "apps\web\.env.local"
$values = @{}
foreach ($line in [IO.File]::ReadAllLines($environmentPath)) {
  if ($line -match "^([^#=]+)=(.*)$") {
    $values[$Matches[1].Trim()] = $Matches[2].Trim()
  }
}

$token = $values["CLOUDFLARE_API_TOKEN"]
if (-not $token) {
  throw "CLOUDFLARE_API_TOKEN is required to update TURN DNS."
}

$headers = @{
  Authorization = "Bearer $token"
  "Content-Type" = "application/json"
}
$zone = Invoke-RestMethod `
  -Uri "https://api.cloudflare.com/client/v4/zones?name=suwaneegamers.net&status=active" `
  -Headers $headers
if (-not $zone.success -or $zone.result.Count -ne 1) {
  throw "The suwaneegamers.net Cloudflare zone could not be resolved."
}

$recordName = "turn.suwaneegamers.net"
$zoneId = $zone.result[0].id
$record = Invoke-RestMethod `
  -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records?name=$recordName" `
  -Headers $headers
$publicAddress = (Invoke-RestMethod -Uri "https://api.ipify.org?format=json").ip
$payload = @{
  type = "A"
  name = $recordName
  content = $publicAddress
  ttl = 300
  proxied = $false
} | ConvertTo-Json

if ($record.result.Count -eq 0) {
  $updated = Invoke-RestMethod `
    -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records" `
    -Headers $headers `
    -Method Post `
    -Body $payload
} else {
  $recordId = $record.result[0].id
  $updated = Invoke-RestMethod `
    -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records/$recordId" `
    -Headers $headers `
    -Method Put `
    -Body $payload
}

if (-not $updated.success) {
  throw "The TURN DNS record could not be updated."
}

Write-Output "TURN DNS is current."

# livekit.yaml pins rtc.node_ip to the public address (see
# configure-livekit-production.ps1 for why). DNS alone being current is not
# enough -- a stale node_ip leaves Myra reachable on the LAN but dead from
# outside, which is exactly the failure this pinning was introduced to stop. So
# the address is reconciled here too, on the same hourly schedule.
$liveKitConfig = Join-Path $env:LOCALAPPDATA "SuwaneeGamers\LiveKit\livekit.yaml"
if (Test-Path -LiteralPath $liveKitConfig) {
  $configText = [IO.File]::ReadAllText($liveKitConfig)
  if ($configText -match "(?m)^\s*node_ip:\s*(\S+)\s*$") {
    $pinnedAddress = $Matches[1]
    if ($pinnedAddress -ne $publicAddress) {
      $rewritten = [regex]::Replace(
        $configText,
        "(?m)^(\s*node_ip:\s*)\S+\s*$",
        "`${1}$publicAddress"
      )
      [IO.File]::WriteAllText($liveKitConfig, $rewritten, [Text.UTF8Encoding]::new($false))
      Write-Output "LiveKit node_ip updated from $pinnedAddress to $publicAddress; restarting LiveKit."

      $liveKitExe = Join-Path $env:LOCALAPPDATA "SuwaneeGamers\LiveKit\1.13.4\livekit-server.exe"
      Get-Process livekit-server -ErrorAction SilentlyContinue | Stop-Process -Force
      Start-Sleep -Seconds 2
      Start-Process `
        -FilePath $liveKitExe `
        -ArgumentList "--config=`"$liveKitConfig`"" `
        -WorkingDirectory (Split-Path -Parent $liveKitExe) `
        -WindowStyle Hidden
    }
  }
}

