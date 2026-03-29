# build_native_name_map.ps1 0.1.4
param(
  [string]$InputFile = "data/staging/unesco_source_raw.txt",
  [string]$OverpassCacheDir = "archive/overpass_legacy/data/cache",
  [string]$OutputFile = "data/mappings/native_name_map.json"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

if (-not (Test-Path -LiteralPath $InputFile)) { throw "Input source file not found: $InputFile" }

$outDir = Split-Path -Parent $OutputFile
if ($outDir -and -not (Test-Path -LiteralPath $outDir)) {
  New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$raw = Get-Content -Raw -LiteralPath $InputFile
$trim = $raw.TrimStart()
if ($trim -match "^(<html|<!doctype html)") { throw "Input source file contains HTML/challenge content, not dataset payload." }

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

function Has-StrongScript {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return $false }
  return [regex]::IsMatch($Value, '[\u0370-\u03FF\u0400-\u052F\u0590-\u08FF\u0900-\u0DFF\u0E00-\u0E7F\u1100-\u11FF\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]')
}

function Is-Mojibake {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return $false }
  return $Value.Contains("�")
}

function Add-PreferredLocalName {
  param(
    [hashtable]$Index,
    [string]$SiteId,
    [object]$Tags
  )
  if ([string]::IsNullOrWhiteSpace($SiteId) -or $null -eq $Tags) { return }
  $priorityKeys = @("name", "name:zgh", "name:ber", "name:tzm", "name:ary", "name:ar")
  $excludedLangKeys = @("name:en", "name:fr", "name:es", "name:ru", "name:zh")
  $candidate = ""
  foreach ($k in $priorityKeys) {
    $v = Clean-Text -Value ([string]$Tags.$k)
    if ([string]::IsNullOrWhiteSpace($v)) { continue }
    if (Is-Mojibake -Value $v) { continue }
    if (-not (Has-StrongScript -Value $v)) { continue }
    $candidate = $v
    break
  }
  if ([string]::IsNullOrWhiteSpace($candidate)) {
    foreach ($prop in $Tags.PSObject.Properties) {
      $k = [string]$prop.Name
      if (-not $k.StartsWith("name:")) { continue }
      if ($excludedLangKeys -contains $k) { continue }
      $v = Clean-Text -Value ([string]$prop.Value)
      if ([string]::IsNullOrWhiteSpace($v)) { continue }
      if (Is-Mojibake -Value $v) { continue }
      if (-not (Has-StrongScript -Value $v)) { continue }
      $candidate = $v
      break
    }
  }
  if ([string]::IsNullOrWhiteSpace($candidate)) { return }
  if (-not $Index.ContainsKey($SiteId)) { $Index[$SiteId] = $candidate }
}

try {
  $rows = $raw | ConvertFrom-Json
} catch {
  throw "Failed to parse source file as JSON: $($_.Exception.Message)"
}

if (-not ($rows -is [System.Array])) { throw "Expected source file to contain a JSON array of UNESCO rows." }

$localBySiteId = @{}
if (Test-Path -LiteralPath $OverpassCacheDir) {
  $cacheFiles = Get-ChildItem -LiteralPath $OverpassCacheDir -Filter *.json -File -ErrorAction SilentlyContinue
  foreach ($cf in @($cacheFiles)) {
    $cacheRaw = Get-Content -Raw -LiteralPath $cf.FullName
    if ([string]::IsNullOrWhiteSpace($cacheRaw)) { continue }
    try {
      $cacheObj = $cacheRaw | ConvertFrom-Json
    } catch {
      continue
    }
    foreach ($el in @($cacheObj.elements)) {
      if (-not $el -or -not $el.tags) { continue }
      $refWhc = Clean-Text -Value ([string]$el.tags."ref:whc")
      if ([string]::IsNullOrWhiteSpace($refWhc)) { continue }
      $rootId = [regex]::Match($refWhc, '^\d+').Value
      if ([string]::IsNullOrWhiteSpace($rootId)) { continue }
      Add-PreferredLocalName -Index $localBySiteId -SiteId $rootId -Tags $el.tags
    }
  }
}

$fields = @("name_ar")
$names = [ordered]@{}
foreach ($row in @($rows)) {
  if (-not $row) { continue }
  $siteId = [string]$row.id_no
  if ([string]::IsNullOrWhiteSpace($siteId)) { throw "UNESCO source row missing required field id_no." }
  if ($siteId -notmatch '^\d{1,6}$') { throw "UNESCO source row has invalid id_no: $siteId" }
  $entry = [ordered]@{}
  $local = if ($localBySiteId.ContainsKey($siteId)) { Clean-Text -Value ([string]$localBySiteId[$siteId]) } else { "" }
  if (-not [string]::IsNullOrWhiteSpace($local)) { $entry["name_ar"] = $local }
  else {
    $fallback = Clean-Text -Value ([string]$row.name_ar)
    if (-not [string]::IsNullOrWhiteSpace($fallback)) { $entry["name_ar"] = $fallback }
  }
  if ($entry.Count -gt 0) { $names[$siteId] = $entry }
}

$doc = [ordered]@{
  schema = "my-world-heritage-native-map/v1"
  generator = "scripts/build_native_name_map.ps1"
  generated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  source_input = $InputFile
  overpass_cache_dir = $OverpassCacheDir
  fields = $fields
  site_count = $names.Count
  names = $names
}

$doc | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $OutputFile -Encoding utf8
Write-Host "Wrote $OutputFile with $($names.Count) mapped WHS ids."



