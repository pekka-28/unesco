param(
  [string]$InputFile = "data/current/unesco_official_sites.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $InputFile)) {
  throw "Input file not found: $InputFile"
}

$data = Get-Content -Raw -LiteralPath $InputFile | ConvertFrom-Json
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
  if ($seen.ContainsKey($sid)) { throw "Duplicate site_id found: $sid" }
  $seen[$sid] = $true

  $lon = [double]$s.lon
  $lat = [double]$s.lat
  if ($lon -lt -180 -or $lon -gt 180 -or $lat -lt -90 -or $lat -gt 90) {
    throw "Record $sid has out-of-range coordinates: ($lat, $lon)"
  }
}

Write-Host "Validated $($sites.Count) WHS records in $InputFile"
