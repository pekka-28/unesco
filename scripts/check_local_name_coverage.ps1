param(
  [string]$InputFile = "data/staging/unesco_source_raw.txt",
  [string]$LocalNameTableFile = "data/mappings/local_name_table.json",
  [string]$OutputFile = "data/mappings/local_name_coverage.json"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Clean-Text {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return "" }
  $t = [string]$Value
  $t = [regex]::Replace($t, '<\s*br\s*/?\s*>', ' - ')
  $t = [regex]::Replace($t, '<[^>]+>', '')
  $t = [System.Net.WebUtility]::HtmlDecode($t)
  $t = [regex]::Replace($t, '\s+', ' ')
  return $t.Trim()
}

if (-not (Test-Path -LiteralPath $InputFile)) { throw "Input source file not found: $InputFile" }
if (-not (Test-Path -LiteralPath $LocalNameTableFile)) { throw "Local name table not found: $LocalNameTableFile" }

$outDir = Split-Path -Parent $OutputFile
if ($outDir -and -not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

$raw = Get-Content -Raw -LiteralPath $InputFile
$rows = $raw | ConvertFrom-Json
if (-not ($rows -is [System.Array])) { throw "Expected UNESCO source file to contain JSON array." }

$table = Get-Content -Raw -LiteralPath $LocalNameTableFile | ConvertFrom-Json
if ($null -eq $table -or $null -eq $table.entries) { throw "Local name table schema missing 'entries'." }

$total = 0
$withLocal = 0
$bySource = @{}
foreach ($row in @($rows)) {
  if (-not $row) { continue }
  $siteId = Clean-Text -Value ([string]$row.id_no)
  if ([string]::IsNullOrWhiteSpace($siteId)) { $siteId = Clean-Text -Value ([string]$row.number) }
  if ([string]::IsNullOrWhiteSpace($siteId)) { continue }
  $total++
  $entry = $table.entries.$siteId
  if ($null -eq $entry) { continue }
  $local = Clean-Text -Value ([string]$entry.local_name)
  if ([string]::IsNullOrWhiteSpace($local)) { continue }
  $withLocal++
  $src = Clean-Text -Value ([string]$entry.source)
  if ([string]::IsNullOrWhiteSpace($src)) { $src = "unknown" }
  if (-not $bySource.ContainsKey($src)) { $bySource[$src] = 0 }
  $bySource[$src] = [int]$bySource[$src] + 1
}

$coveragePct = if ($total -gt 0) { [math]::Round((100.0 * $withLocal / $total), 2) } else { 0.0 }
$report = [ordered]@{
  schema = "my-world-heritage-local-name-coverage/v1"
  generated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  input_file = $InputFile
  local_name_table_file = $LocalNameTableFile
  total_sites = $total
  sites_with_local_name = $withLocal
  coverage_percent = $coveragePct
  missing_sites = [math]::Max(0, $total - $withLocal)
  by_source = $bySource
}

$report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $OutputFile -Encoding utf8
Write-Host ("Coverage: {0}/{1} ({2}%)" -f $withLocal, $total, $coveragePct)
Write-Host "Wrote $OutputFile"
