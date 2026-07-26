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

$config = @"
port: 7880
log_level: info

rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: true

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
  LIVEKIT_SCHEDULE_AGENT_NAME = "suwanee-schedule-assistant"
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
