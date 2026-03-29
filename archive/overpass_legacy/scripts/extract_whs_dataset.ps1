# extract_whs_dataset.ps1 0.1.4
param(
  [string]$InputFile = "data/current/sites.geojson",
  [string]$OutputFile = "data/current/whs_sites_used.geojson",
  [switch]$OverwriteExisting
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $InputFile)) {
  throw "Input file not found: $InputFile"
}

if ((Test-Path -LiteralPath $OutputFile) -and (-not $OverwriteExisting)) {
  throw "Refusing to overwrite existing file: $OutputFile (use -OverwriteExisting to allow)."
}

$outDir = Split-Path -Parent $OutputFile
if ($outDir -and -not (Test-Path -LiteralPath $outDir)) {
  New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$src = Get-Content -Raw -LiteralPath $InputFile | ConvertFrom-Json
$groups = @{}

foreach ($f in $src.features) {
  $sid = [string]$f.properties.site_id
  if ($sid -notmatch '^(\d+)') { continue }
  $root = $matches[1]
  if (-not $groups.ContainsKey($root)) {
    $groups[$root] = New-Object System.Collections.Generic.List[object]
  }
  $groups[$root].Add($f)
}

$features = New-Object System.Collections.Generic.List[object]
$now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

foreach ($root in ($groups.Keys | Sort-Object {[int]$_})) {
  $items = $groups[$root]

  $selected = $items | Where-Object { [string]$_.properties.site_id -eq $root } | Select-Object -First 1
  if (-not $selected) {
    $selected = $items | Where-Object { $_.properties."name:en" } | Select-Object -First 1
  }
  if (-not $selected) {
    $selected = $items | Select-Object -First 1
  }

  $componentRefs = @($items | ForEach-Object { [string]$_.properties.site_id } | Sort-Object -Unique)
  $lon = $null
  $lat = $null
  if ($selected.geometry -and $selected.geometry.coordinates -and $selected.geometry.coordinates.Count -ge 2) {
    $lon = [double]$selected.geometry.coordinates[0]
    $lat = [double]$selected.geometry.coordinates[1]
  }
  $criteria = if ($selected.properties."whc:criteria") { [string]$selected.properties."whc:criteria" } else { $null }
  $heritage = if ($selected.properties.heritage) { [string]$selected.properties.heritage } else { $null }
  $inscriptionDate = if ($selected.properties."whc:inscription_date") { [string]$selected.properties."whc:inscription_date" } else { $null }
  $wikipedia = if ($selected.properties.wikipedia) { [string]$selected.properties.wikipedia } else { $null }
  $country = if ($selected.properties."addr:country") { [string]$selected.properties."addr:country" } elseif ($selected.properties."is_in:country") { [string]$selected.properties."is_in:country" } elseif ($selected.properties.country) { [string]$selected.properties.country } else { $null }
  $note = if ($selected.properties.note) { [string]$selected.properties.note } elseif ($selected.properties.description) { [string]$selected.properties.description } else { $null }
  $capsule = "WHS {0} | {1},{2}" -f $root, $lat, $lon
  $props = [ordered]@{
    site_id = $root
    name = if ($selected.properties.name) { [string]$selected.properties.name } else { $null }
    name_en = if ($selected.properties."name:en") { [string]$selected.properties."name:en" } else { $null }
    status = "active"
    unesco_url = "https://whc.unesco.org/en/list/$root/"
    source_ref_whc = [string]$selected.properties.site_id
    source_component_count = $componentRefs.Count
    source_component_refs = ($componentRefs -join ";")
    lat = $lat
    lon = $lon
    whc_criteria = $criteria
    heritage_tag = $heritage
    inscription_date = $inscriptionDate
    wikipedia = $wikipedia
    country = $country
    note = $note
    capsule = $capsule
    extracted_at = $now
  }

  $features.Add([ordered]@{
    type = "Feature"
    geometry = $selected.geometry
    properties = $props
  })
}

$out = [ordered]@{
  type = "FeatureCollection"
  metadata = [ordered]@{
    generator = "scripts/extract_whs_dataset.ps1"
    source_file = $InputFile
    generated_at = $now
    feature_count = $features.Count
    note = "One feature per root UNESCO ID extracted from ref:whc values in source."
  }
  features = $features.ToArray()
}

$out | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $OutputFile -Encoding utf8
Write-Host "Wrote $OutputFile with $($features.Count) features."


