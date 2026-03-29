# fetch_cldr_support.ps1 0.1.4
param(
  [string]$CldrChartVersion = "48",
  [string]$TerritoryLanguageOutputFile = "data/staging/cldr_language_territory_information.txt",
  [string]$LikelySubtagsOutputFile = "data/staging/cldr_likelySubtags.json",
  [string]$LikelySubtagsUrl = "https://raw.githubusercontent.com/unicode-org/cldr-json/48.0.0/cldr-json/cldr-core/supplemental/likelySubtags.json"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

if ([string]::IsNullOrWhiteSpace($CldrChartVersion)) { throw "CldrChartVersion is required." }

$territoryUrl = "https://www.unicode.org/cldr/charts/$CldrChartVersion/supplemental/language_territory_information.txt"

$dirs = @(
  (Split-Path -Parent $TerritoryLanguageOutputFile),
  (Split-Path -Parent $LikelySubtagsOutputFile)
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique
foreach ($d in $dirs) {
  if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

Invoke-WebRequest -UseBasicParsing -Uri $territoryUrl -OutFile $TerritoryLanguageOutputFile
Invoke-WebRequest -UseBasicParsing -Uri $LikelySubtagsUrl -OutFile $LikelySubtagsOutputFile

$territoryBytes = (Get-Item -LiteralPath $TerritoryLanguageOutputFile).Length
$likelyBytes = (Get-Item -LiteralPath $LikelySubtagsOutputFile).Length

Write-Host ("Wrote {0} ({1} bytes) from {2}" -f $TerritoryLanguageOutputFile, $territoryBytes, $territoryUrl)
Write-Host ("Wrote {0} ({1} bytes) from {2}" -f $LikelySubtagsOutputFile, $likelyBytes, $LikelySubtagsUrl)


