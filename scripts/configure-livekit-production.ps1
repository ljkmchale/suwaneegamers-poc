param(
  [switch]$RotateCredentials
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$liveKitRoot = Join-Path $env:LOCALAPPDATA "SuwaneeGamers\LiveKit"
$credentialPath = Join-Path $liveKitRoot "credentials.env"
$configPath = Join-Path $liveKitRoot "livekit.yaml"
$certificateRoot = Join-Path $liveKitRoot "certificates"
$turnCertificate = Join-Path $certificateRoot "turn.suwaneegamers.net.crt"
$turnKey = Join-Path $certificateRoot "turn.suwaneegamers.net.key"

New-Item -ItemType Directory -Force -Path $liveKitRoot, $certificateRoot | Out-Null

function New-RandomHex([int]$bytes) {
  $buffer = New-Object byte[] $bytes
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($buffer)
  } finally {
    $generator.Dispose()
  }
  return ([BitConverter]::ToString($buffer) -replace "-", "").ToLowerInvariant()
}

if ($RotateCredentials -or -not (Test-Path -LiteralPath $credentialPath)) {
  $apiKey = "SG" + (New-RandomHex 12)
  $apiSecret = New-RandomHex 32
  [IO.File]::WriteAllLines(
    $credentialPath,
    @(
      "LIVEKIT_API_KEY=$apiKey",
      "LIVEKIT_API_SECRET=$apiSecret"
    ),
    [Text.UTF8Encoding]::new($false)
  )
} else {
  $credentials = @{}
  foreach ($line in [IO.File]::ReadAllLines($credentialPath)) {
    if ($line -match "^([^=]+)=(.*)$") {
      $credentials[$Matches[1]] = $Matches[2]
    }
  }
  $apiKey = $credentials["LIVEKIT_API_KEY"]
  $apiSecret = $credentials["LIVEKIT_API_SECRET"]
}

if (-not $apiKey -or -not $apiSecret) {
  throw "LiveKit credentials could not be loaded."
}

$turnReady =
  (Test-Path -LiteralPath $turnCertificate) -and
  (Test-Path -LiteralPath $turnKey)
$turnEnabled = $turnReady.ToString().ToLowerInvariant()

# node_ip is pinned below, so it has to be the current public address.
$publicAddress = (Invoke-RestMethod -Uri "https://api.ipify.org?format=json" -TimeoutSec 30).ip
if (-not $publicAddress) {
  throw "The public IP could not be determined; LiveKit node_ip cannot be pinned."
}

$config = @"
port: 7880
log_level: info

rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: true
  # STUN finds the public IP fine, but LiveKit then validates it by reaching
  # itself through that address, which requires NAT hairpinning. The eero does
  # not hairpin, so validation races the IPv6 STUN lookups and loses with
  # "context canceled"; LiveKit then drops the public IP and advertises the
  # private LAN address, leaving remote callers with no routable ICE candidate
  # while the LAN keeps working. The race is nondeterministic, so this fails
  # intermittently across restarts. Do not remove without restoring hairpin.
  skip_external_ip_validation: true
  # Clients MUST get a reachable STUN server. With TURN enabled LiveKit
  # otherwise hands out only the two TURN URLs, and both need inbound to this
  # house. An off-network client (especially on cellular CGNAT) then offers
  # nothing but unroutable host candidates and ICE fails with "could not
  # establish pc connection". This NAT is address/port-restricted, so the hole
  # is punched by our outbound probe to the client's reflexive address -- with
  # no STUN there is no reflexive address to probe.
  stun_servers:
    - stun.l.google.com:19302
    - stun1.l.google.com:19302
  # LiveKit builds its external-IP map concurrently and the ordering varies per
  # start. When an IPv6 entry wins, the TURN relay finds no matching node IP and
  # the server exits with "no matching node IP for relay". Pinning kills that
  # race. Must track the public IP -- see update-livekit-turn-dns.ps1.
  node_ip: ${publicAddress}

keys:
  ${apiKey}: ${apiSecret}

turn:
  enabled: ${turnEnabled}
  domain: turn.suwaneegamers.net
  tls_port: 443
  udp_port: 3478
  cert_file: "$($turnCertificate -replace '\\','/')"
  key_file: "$($turnKey -replace '\\','/')"
"@
[IO.File]::WriteAllText($configPath, $config, [Text.UTF8Encoding]::new($false))

function Set-EnvironmentValues([string]$path, [hashtable]$values) {
  $lines = [Collections.Generic.List[string]]::new()
  if (Test-Path -LiteralPath $path) {
    foreach ($line in [IO.File]::ReadAllLines($path)) {
      $lines.Add($line)
    }
  }

  foreach ($name in $values.Keys) {
    $replacement = "$name=$($values[$name])"
    $found = $false
    for ($index = 0; $index -lt $lines.Count; $index += 1) {
      if ($lines[$index].StartsWith("$name=")) {
        $lines[$index] = $replacement
        $found = $true
      }
    }
    if (-not $found) {
      $lines.Add($replacement)
    }
  }

  [IO.File]::WriteAllLines($path, $lines, [Text.UTF8Encoding]::new($false))
}

Set-EnvironmentValues (Join-Path $repoRoot "apps\web\.env.local") @{
  LIVEKIT_URL = "wss://voice.suwaneegamers.net"
  LIVEKIT_API_KEY = $apiKey
  LIVEKIT_API_SECRET = $apiSecret
  LIVEKIT_SCHEDULE_AGENT_NAME = "myra"
}

Set-EnvironmentValues (Join-Path $repoRoot "services\livekit-schedule-agent\.env.local") @{
  LIVEKIT_URL = "ws://127.0.0.1:7880"
  LIVEKIT_API_KEY = $apiKey
  LIVEKIT_API_SECRET = $apiSecret
}

Write-Output "LiveKit production configuration written."
Write-Output "Public signaling URL: wss://voice.suwaneegamers.net"
Write-Output "TURN enabled: $turnEnabled"
if (-not $turnReady) {
  Write-Output "TURN will remain disabled until its trusted certificate and key are installed."
}
