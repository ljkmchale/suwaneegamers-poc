<#
.SYNOPSIS
Runs Myra's repeatable visitor-impression evaluation.

.DESCRIPTION
Checks the compact Karpathy-style reference brain and the live, authenticated,
player-safe Chronicles retrieval path. The suite intentionally spans site
guidance, campaigns, gods, Gazetteer entries, characters, sessions, quests,
world lore, and honest unknown handling.
#>

[CmdletBinding()]
param(
  [string]$BaseUrl = "http://127.0.0.1:4652",
  [int]$MaxKnowledgeResponseMs = 15000
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$casesPath = Join-Path $repoRoot "content\myra-showcase-eval.json"
$brainPath = Join-Path $repoRoot "content\assistant-brain.md"
$mishearingsPath = Join-Path $repoRoot "content\assistant-mishearings.json"
$pronunciationsPath = Join-Path $repoRoot "content\assistant-pronunciations.json"
$agentEnvPath = Join-Path $repoRoot "services\livekit-schedule-agent\.env.local"
$remediationPath = Join-Path $repoRoot "content\assistant-remediation.json"

function Read-EnvValue {
  param([string]$Path, [string]$Name)
  $line = Get-Content -LiteralPath $Path |
    Where-Object { $_ -match ("^{0}=" -f [regex]::Escape($Name)) } |
    Select-Object -First 1
  if (-not $line) { return "" }
  return (($line -split "=", 2)[1]).Trim().Trim('"').Trim("'")
}

function Contains-Text {
  param([string]$Value, [string]$Expected)
  return $Value.IndexOf($Expected, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
}

$cases = Get-Content -LiteralPath $casesPath -Raw | ConvertFrom-Json
$brain = Get-Content -LiteralPath $brainPath -Raw
$mishearings = Get-Content -LiteralPath $mishearingsPath -Raw | ConvertFrom-Json
$pronunciations = Get-Content -LiteralPath $pronunciationsPath -Raw | ConvertFrom-Json
$machineSecret = Read-EnvValue -Path $agentEnvPath -Name "LIVEKIT_API_SECRET"
if (-not $machineSecret) {
  throw "LIVEKIT_API_SECRET is missing from $agentEnvPath."
}

$headers = @{
  "Content-Type" = "application/json"
  "Authorization" = "Bearer $machineSecret"
}
$results = [System.Collections.Generic.List[object]]::new()
$queueCandidates = [System.Collections.Generic.List[object]]::new()

foreach ($case in $cases) {
  $errors = [System.Collections.Generic.List[string]]::new()
  $answer = ""
  $sources = @()
  $elapsedMs = 0

  if ($case.mode -eq "brain") {
    $answer = $brain
  } elseif ($case.mode -eq "speech") {
    $speechMap = if ($case.map -eq "pronunciations") { $pronunciations } else { $mishearings }
    $mapProperty = $speechMap.PSObject.Properties[[string]$case.heard]
    $actual = if ($mapProperty) { [string]$mapProperty.Value } else { "" }
    $answer = $actual
    if ($actual -cne [string]$case.canonical) {
      $errors.Add("speech map expected '$($case.heard)' -> '$($case.canonical)', received '$actual'")
    }
  } elseif ($case.mode -eq "knowledge") {
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    try {
      $body = @{
        question = [string]$case.question
        visibility = "players"
        answerMode = "direct"
        quality = "fast"
      } | ConvertTo-Json
      $response = Invoke-RestMethod `
        -Uri "$($BaseUrl.TrimEnd('/'))/api/brain/ask" `
        -Method Post `
        -Headers $headers `
        -Body $body `
        -TimeoutSec ([Math]::Ceiling($MaxKnowledgeResponseMs / 1000) + 5)
      $answer = [string]$response.answer
      $sources = @($response.sources | ForEach-Object { [string]$_.title })
    } catch {
      $errors.Add("request failed: $($_.Exception.Message)")
    } finally {
      $timer.Stop()
      $elapsedMs = [int]$timer.ElapsedMilliseconds
    }
    if ($elapsedMs -gt $MaxKnowledgeResponseMs) {
      $errors.Add("response took ${elapsedMs}ms (limit ${MaxKnowledgeResponseMs}ms)")
    }
  } else {
    $errors.Add("unknown evaluation mode: $($case.mode)")
  }

  foreach ($expected in @($case.mustInclude) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }) {
    if (-not (Contains-Text $answer ([string]$expected))) {
      $errors.Add("missing answer text: $expected")
    }
  }
  $allowedMarkers = @($case.mustIncludeAny) |
    Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }
  if ($allowedMarkers.Count -gt 0) {
    $foundAny = $allowedMarkers |
      Where-Object { Contains-Text $answer ([string]$_) } |
      Select-Object -First 1
    if (-not $foundAny) {
      $errors.Add("missing every allowed answer marker: $($allowedMarkers -join ', ')")
    }
  }
  foreach ($forbidden in @($case.mustNotInclude) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }) {
    if (Contains-Text $answer ([string]$forbidden)) {
      $errors.Add("forbidden answer text: $forbidden")
    }
  }
  foreach ($source in @($case.sourceIncludes) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }) {
    if (-not (@($sources) | Where-Object { Contains-Text $_ ([string]$source) })) {
      $errors.Add("missing source: $source")
    }
  }
  if ($case.mode -eq "knowledge" -and $case.expectSources -ne $false -and $sources.Count -eq 0) {
    $errors.Add("no player-safe source returned")
  }
  if ($case.expectSources -eq $false -and $sources.Count -gt 0) {
    $errors.Add("unknown answer unexpectedly returned sources")
  }

  $passed = $errors.Count -eq 0
  $remediation = ""
  if (-not $passed) {
    if ($case.mode -eq "brain") {
      $remediation = "brain-source-improvement"
    } elseif ($case.mode -eq "speech") {
      $remediation = "pronunciation-fix"
    } elseif ($errors -match "request failed|no player-safe source|not documented") {
      $remediation = "routing-correction"
    } else {
      $remediation = "learned-answer"
    }
    $queueCandidates.Add([pscustomobject]@{
      question = [string]$case.question
      category = $remediation
      proposedCorrection = "Correct the failed showcase expectations: $($errors -join '; ')"
      evidence = @($sources)
    })
  }
  $results.Add([pscustomobject]@{
    Result = if ($passed) { "PASS" } else { "FAIL" }
    Category = [string]$case.category
    Question = [string]$case.question
    Milliseconds = $elapsedMs
    Remediation = $remediation
    Errors = $errors -join "; "
  })
  Write-Host (
    "[{0}] [{1}] {2}{3}" -f
      $(if ($passed) { "PASS" } else { "FAIL" }),
      $case.category,
      $case.question,
      $(if ($elapsedMs) { " (${elapsedMs}ms)" } else { "" })
  ) -ForegroundColor $(if ($passed) { "Green" } else { "Red" })
  foreach ($failureDetail in $errors) {
    Write-Host "  - $failureDetail" -ForegroundColor Red
  }
  if ($remediation) {
    Write-Host "  -> remediation: $remediation" -ForegroundColor Yellow
  }
}

Write-Host ""
$results | Format-Table Result, Category, Milliseconds, Remediation, Question -AutoSize
$failed = @($results | Where-Object { $_.Result -eq "FAIL" })
$passedCount = $results.Count - $failed.Count
Write-Host ("Showcase score: {0}/{1} passed." -f $passedCount, $results.Count)

if ($failed.Count -gt 0) {
  $store = if (Test-Path -LiteralPath $remediationPath) {
    Get-Content -LiteralPath $remediationPath -Raw | ConvertFrom-Json
  } else {
    [pscustomobject]@{ entries = @(); updatedAt = "" }
  }
  $entries = [System.Collections.Generic.List[object]]::new()
  @($store.entries) | ForEach-Object { $entries.Add($_) }
  $now = (Get-Date).ToUniversalTime().ToString("o")
  foreach ($candidate in $queueCandidates) {
    $normalized = ([string]$candidate.question).ToLowerInvariant() -replace "[^\p{L}\p{N}\s]", " " -replace "\s+", " "
    $keyBytes = [Text.Encoding]::UTF8.GetBytes("$($normalized.Trim())|$($candidate.category)")
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
      $hash = $sha.ComputeHash($keyBytes)
    } finally {
      $sha.Dispose()
    }
    $digest = (($hash | Select-Object -First 8 | ForEach-Object { $_.ToString("x2") }) -join "")
    $id = "rem-$digest"
    $existing = @($entries | Where-Object { $_.id -eq $id -and $_.status -eq "pending" }) | Select-Object -First 1
    if ($existing) {
      $existing.timesSeen = [int]$existing.timesSeen + 1
      $existing.proposedCorrection = $candidate.proposedCorrection
      $existing.evidence = @($candidate.evidence)
    } else {
      $entries.Insert(0, [pscustomobject]@{
        id = $id
        question = $candidate.question
        normalized = $normalized.Trim()
        category = $candidate.category
        proposedCorrection = $candidate.proposedCorrection
        evidence = @($candidate.evidence)
        source = "showcase"
        timesSeen = 1
        status = "pending"
        createdAt = $now
      })
    }
  }
  [pscustomobject]@{ entries = @($entries); updatedAt = $now } |
    ConvertTo-Json -Depth 8 |
    Set-Content -LiteralPath $remediationPath -Encoding UTF8
  Write-Host ("Queued {0} remediation candidate(s)." -f $queueCandidates.Count) -ForegroundColor Yellow
  exit 1
}
exit 0
