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

