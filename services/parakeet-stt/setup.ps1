# Creates the Parakeet STT service venv and installs its dependencies.
#
# The venv lives outside the repo, next to the other voice services under
# %LOCALAPPDATA%\SuwaneeGamers, and is NOT committed. Re-run this to rebuild it.
#
# Requires Python 3.12 (NeMo does not support 3.13). torch is installed from the
# cu128 index first so the Blackwell sm_120 kernels are present; the rest come
# from PyPI.
$ErrorActionPreference = "Stop"

$venv = Join-Path $env:LOCALAPPDATA "SuwaneeGamers\Parakeet\.venv"
$reqs = Join-Path $PSScriptRoot "requirements.txt"

# Find a Python 3.12 interpreter via the py launcher.
$py312 = $null
try { & py -3.12 --version *> $null; if ($LASTEXITCODE -eq 0) { $py312 = "py -3.12" } } catch {}
if (-not $py312) {
  $cand = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"
  if (Test-Path $cand) { $py312 = "`"$cand`"" }
}
if (-not $py312) { throw "Python 3.12 not found (NeMo requires 3.10-3.12)." }

if (-not (Test-Path $venv)) {
  Write-Host "Creating venv at $venv"
  Invoke-Expression "$py312 -m venv `"$venv`""
}
$vpy = Join-Path $venv "Scripts\python.exe"

& $vpy -m pip install --upgrade pip
Write-Host "Installing torch (cu128, Blackwell sm_120)..."
& $vpy -m pip install torch --index-url https://download.pytorch.org/whl/cu128
Write-Host "Installing NeMo ASR + server deps..."
& $vpy -m pip install -r $reqs

Write-Host "Done. Venv: $venv"
