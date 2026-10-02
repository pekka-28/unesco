# validate_whs_dataset.ps1 0.1.4
param(
  [string]$InputFile = "data/current/unesco_official_sites.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $InputFile)) {
  throw "Input file not found: $InputFile"
}

$data = Get-Content -Raw -Encoding utf8 -LiteralPath $InputFile | ConvertFrom-Json
$sites = @()

if ($data -and $data.schema -eq "my-world-heritage-sites/v1" -and $data.sites) {
  $sites = @($data.sites)
}
elseif ($data -and $data.type -eq "FeatureCollection" -and $data.features) {
  foreach ($f in @($data.features)) {
    if (-not $f.properties -or -not $f.geometry -or $f.geometry.type -ne "Point" -or -not $f.geometry.coordinates -or $f.geometry.coordinates.Count -lt 2) {
      throw "Invalid feature in GeoJSON input."
    }
    $sites += [pscustomobject]@{
      site_id = [string]$f.properties.site_id
      site_scope = [string]$f.properties.site_scope
      parent_site_id = [string]$f.properties.parent_site_id
      status = [string]$f.properties.status
      lat = [double]$f.geometry.coordinates[1]
      lon = [double]$f.geometry.coordinates[0]
    }
  }
}
else {
  throw "Input must be canonical JSON (my-world-heritage-sites/v1) or GeoJSON FeatureCollection."
}

if (-not $sites.Count) { throw "Dataset is empty." }

$seen = @{}
foreach ($s in $sites) {
  $sid = [string]$s.site_id
  if ([string]::IsNullOrWhiteSpace($sid)) { throw "Record missing site_id." }
  if ($sid -notmatch '^(WHS \d{1,6}|MWH \d{1,6}-\d{3})$') { throw "Record has invalid site_id format: $sid" }
  if ($seen.ContainsKey($sid)) { throw "Duplicate site_id found: $sid" }
  $seen[$sid] = $true
  if ($s.status -notin @('active', 'retired')) { throw "Invalid catalogue status for $sid" }
  if ($null -eq $s.lon -or $null -eq $s.lat) { throw "Missing coordinates: $sid" }

  $lon = [double]$s.lon
  $lat = [double]$s.lat
  if ([double]::IsNaN($lon) -or [double]::IsNaN($lat) -or [double]::IsInfinity($lon) -or [double]::IsInfinity($lat) -or $lon -lt -180 -or $lon -gt 180 -or $lat -lt -90 -or $lat -gt 90) {
    throw "Record $sid has out-of-range coordinates: ($lat, $lon)"
  }

  $scope = [string]$s.site_scope
  $parentSiteId = [string]$s.parent_site_id
  if ($scope -eq "component") {
    if ($sid -notmatch '^MWH \d{1,6}-\d{3}$') { throw "Component record has invalid site_id: $sid" }
    if ($parentSiteId -notmatch '^WHS \d{1,6}$') { throw "Component record has invalid parent_site_id: $parentSiteId for $sid" }
  }
  elseif ($scope -eq "whs") {
    if ($sid -notmatch '^WHS \d{1,6}$') { throw "WHS record has invalid site_id: $sid" }
    if (-not [string]::IsNullOrWhiteSpace($parentSiteId)) { throw "WHS record must not have parent_site_id: $sid -> $parentSiteId" }
  }
  else {
    throw "Record has invalid site_scope '$scope' for $sid"
  }
}

foreach ($s in $sites) {
  if ($s.site_scope -eq 'component' -and -not $seen.ContainsKey([string]$s.parent_site_id)) {
    throw "Missing parent for $($s.site_id): $($s.parent_site_id)"
  }
}

Write-Host "Validated $($sites.Count) WHS records in $InputFile"


