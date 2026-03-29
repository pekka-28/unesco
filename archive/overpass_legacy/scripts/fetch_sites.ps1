# fetch_sites.ps1 0.1.4
param(
  [string]$OutputFile = "data/staging/sites_candidate.geojson",
  [string]$CacheDir = "data/staging/cache",
  [int]$RetryCount = 4,
  [int]$RetryDelaySeconds = 6,
  [switch]$OverwriteExisting
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$overpassEndpoints = @(
  "https://overpass-api.de/api/interpreter",
  "https://lambert.openstreetmap.de/api/interpreter"
)

$regions = @(
  @{ name = "Oceania";          bbox = "-50,110,0,180"   },
  @{ name = "East_Asia_South";  bbox = "20,100,35,125"   },
  @{ name = "Americas_South";   bbox = "-60,-95,15,-30"  },
  @{ name = "Americas_North_W"; bbox = "15,-170,75,-100" },
  @{ name = "Americas_North_E"; bbox = "15,-100,75,-25"  },
  @{ name = "East_Asia_North";  bbox = "35,100,55,150"   },
  @{ name = "Southeast_Asia";   bbox = "-12,95,25,130"   },
  @{ name = "South_Asia";       bbox = "5,60,35,95"      },
  @{ name = "Central_Asia";     bbox = "30,55,56,90"     },
  @{ name = "Europe_West";      bbox = "34,-25,72,10"    },
  @{ name = "Europe_East";      bbox = "34,10,72,45"     },
  @{ name = "Middle_East";      bbox = "12,35,45,60"     },
  @{ name = "Africa";           bbox = "-35,-18,38,52"   }
)

$outDir = Split-Path -Parent $OutputFile
if ($outDir -and -not (Test-Path -LiteralPath $outDir)) {
  New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}
if (-not (Test-Path -LiteralPath $CacheDir)) {
  New-Item -ItemType Directory -Path $CacheDir -Force | Out-Null
}
if ((Test-Path -LiteralPath $OutputFile) -and (-not $OverwriteExisting)) {
  throw "Refusing to overwrite existing file: $OutputFile (use -OverwriteExisting to allow)."
}

function Invoke-Overpass {
  param([Parameter(Mandatory = $true)][string]$Query)

  $encoded = [uri]::EscapeDataString($Query)
  $lastError = $null

  for ($attempt = 1; $attempt -le $RetryCount; $attempt++) {
    foreach ($base in $overpassEndpoints) {
      $url = $base + "?data=" + $encoded
      try {
        $resp = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 240 -Headers @{
          "User-Agent" = "unesco-sites-fetch/1.0 (+https://github.com/)"
          "Accept" = "application/json,text/plain,*/*"
        }
        $resp.RawContentStream.Position = 0
        $reader = New-Object System.IO.StreamReader($resp.RawContentStream, [System.Text.Encoding]::UTF8, $true)
        $content = $reader.ReadToEnd()
        $reader.Dispose()
        return $content
      }
      catch {
        $lastError = $_
      }
    }
    Start-Sleep -Seconds ($RetryDelaySeconds * $attempt)
  }

  throw $lastError
}

$allElements = New-Object System.Collections.Generic.List[object]
$failedRegions = New-Object System.Collections.Generic.List[string]

foreach ($r in $regions) {
  $name = [string]$r.name
  $bbox = [string]$r.bbox
  $cacheFile = Join-Path $CacheDir ($name + ".json")
  Write-Host "Fetching region: $name"

  try {
    if (Test-Path -LiteralPath $cacheFile) {
      $json = Get-Content -Raw -LiteralPath $cacheFile | ConvertFrom-Json
    }
    else {
      $query = "[out:json][timeout:180];nwr[`"ref:whc`"]($bbox);out center tags qt;"
      $resp = Invoke-Overpass -Query $query
      $resp | Set-Content -LiteralPath $cacheFile -Encoding utf8
      $json = $resp | ConvertFrom-Json
    }

    if ($json.elements) {
      foreach ($el in $json.elements) {
        $allElements.Add($el)
      }
    }
  }
  catch {
    Write-Warning "Failed region: $name ($bbox)"
    $failedRegions.Add($name) | Out-Null
  }

  Start-Sleep -Seconds 2
}

$seen = @{}
$features = New-Object System.Collections.Generic.List[object]
$datasetDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd")
$checkedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

foreach ($el in $allElements) {
  $tags = @{}
  if ($el.tags) {
    foreach ($p in $el.tags.PSObject.Properties) {
      $tags[$p.Name] = [string]$p.Value
    }
  }

  $siteId = $null
  if ($tags.ContainsKey("ref:whc")) {
    $siteId = $tags["ref:whc"]
  }

  $dedupeKey = if ($siteId) { "whc:$siteId" } else { "osm:$($el.type)/$($el.id)" }
  if ($seen.ContainsKey($dedupeKey)) { continue }
  $seen[$dedupeKey] = $true

  $lat = $null
  $lon = $null
  if ($el.type -eq "node" -and $el.lat -and $el.lon) {
    $lat = [double]$el.lat
    $lon = [double]$el.lon
  }
  elseif ($el.center -and $el.center.lat -and $el.center.lon) {
    $lat = [double]$el.center.lat
    $lon = [double]$el.center.lon
  }
  else {
    continue
  }

  $props = [ordered]@{
    site_id                = $siteId
    name                   = if ($tags.ContainsKey("name:en")) { $tags["name:en"] } elseif ($tags.ContainsKey("name")) { $tags["name"] } else { $null }
    status                 = "active"
    status_changed_at      = $null
    unesco_url             = if ($siteId) { "https://whc.unesco.org/en/list/$siteId/" } else { $null }
    wikidata_qid           = if ($tags.ContainsKey("wikidata")) { $tags["wikidata"] } else { $null }
    osm_ref_whc            = $siteId
    osm_type               = [string]$el.type
    osm_id                 = [string]$el.id
    source_last_checked_at = $checkedAt
    dataset_version        = $datasetDate
  }

  foreach ($k in @("whc:inscription_date", "whc:criteria", "heritage", "name", "name:en", "wikipedia", "addr:country", "is_in:country", "country")) {
    if ($tags.ContainsKey($k) -and -not $props.Contains($k)) {
      $props[$k] = $tags[$k]
    }
  }

  $features.Add([ordered]@{
    type = "Feature"
    geometry = [ordered]@{
      type = "Point"
      coordinates = @($lon, $lat)
    }
    properties = $props
  })
}

$collection = [ordered]@{
  type = "FeatureCollection"
  metadata = [ordered]@{
    generator = "scripts/fetch_sites.ps1"
    generated_at = $checkedAt
    feature_count = $features.Count
    overpass_endpoints = ($overpassEndpoints -join ";")
    region_count = $regions.Count
    failed_regions = ($failedRegions -join ";")
  }
  features = $features.ToArray()
}

$collection | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $OutputFile -Encoding utf8
Write-Host "Wrote $OutputFile with $($features.Count) features."


