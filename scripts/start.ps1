# xhs-studio one-liner start (Windows)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"
Set-Location $Backend

if (-not (Test-Path ".venv")) {
  python -m venv .venv
}
& ".\.venv\Scripts\Activate.ps1"
pip install -q -r requirements.txt
if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
  Copy-Item ".env.example" ".env"
}
Write-Host "Starting xhs-studio at http://127.0.0.1:8765/"
python main.py
