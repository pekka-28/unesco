param(
  [string]$InputFile = "data/current/whs_sites_used.geojson",
  [string]$SnapshotRoot = "data/snapshots"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $InputFile)) {
  throw "Input file not found: $InputFile"
}

$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
$targetDir = Join-Path $SnapshotRoot $stamp
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

$targetFile = Join-Path $targetDir "whs_sites_used.geojson"
Copy-Item -LiteralPath $InputFile -Destination $targetFile -Force

Write-Host "Snapshot written to $targetFile"
