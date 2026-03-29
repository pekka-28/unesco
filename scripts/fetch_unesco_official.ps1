# fetch_unesco_official.ps1 0.1.4
param(
  [string]$SourceUrl = "https://data.unesco.org/api/explore/v2.1/catalog/datasets/whc001/exports/json",
  [string]$RawOutputFile = "data/staging/unesco_source_raw.txt"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

if (-not [string]::IsNullOrWhiteSpace($env:UNESCO_SOURCE_URL)) {
  $SourceUrl = $env:UNESCO_SOURCE_URL
}

$rawDir = Split-Path -Parent $RawOutputFile
if ($rawDir -and -not (Test-Path -LiteralPath $rawDir)) {
  New-Item -ItemType Directory -Path $rawDir -Force | Out-Null
}

$resp = Invoke-WebRequest -UseBasicParsing -Uri $SourceUrl -TimeoutSec 240 -UserAgent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
$resp.RawContentStream.Position = 0
$reader = New-Object System.IO.StreamReader($resp.RawContentStream, [System.Text.Encoding]::UTF8, $true)
$raw = $reader.ReadToEnd()
$reader.Dispose()

$trim = $raw.TrimStart()
if ($trim -match "^(<html|<!doctype html)") {
  throw "UNESCO source returned HTML, not data payload."
}
if (-not ($trim.StartsWith("[") -or $trim.StartsWith("{") -or $trim.StartsWith("<dataset") -or $trim.StartsWith("<?xml"))) {
  $head = $trim.Substring(0, [Math]::Min(120, $trim.Length))
  throw "UNESCO source has unexpected payload prefix: $head"
}

$raw | Set-Content -LiteralPath $RawOutputFile -Encoding utf8
Write-Host "Wrote staged source $RawOutputFile (chars: $($raw.Length))."


