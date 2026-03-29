# convert_unesco_source.ps1 0.1.5
param(
  [string]$InputFile = "data/staging/unesco_source_raw.txt",
  [string]$SourceUrl = "https://data.unesco.org/api/explore/v2.1/catalog/datasets/whc001/exports/json",
  [string]$LocalNameTableFile = "data/mappings/local_name_table.json",
  [string]$NativeNameMapFile = "",
  [string]$OutputFile = "data/current/unesco_official_sites.geojson",
  [string]$OutputJsonFile = "data/current/unesco_official_sites.json",
  [string]$ArchiveDir = "data/history",
  [int]$KeepVersions = 24,
  [int]$RetryIntervalDays = 30,
  [switch]$OverwriteExisting
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

if (-not (Test-Path -LiteralPath $InputFile)) { throw "Input source file not found: $InputFile" }
if ((Test-Path -LiteralPath $OutputFile) -and (-not $OverwriteExisting)) { throw "Refusing to overwrite existing file: $OutputFile (use -OverwriteExisting)." }
if ((Test-Path -LiteralPath $OutputJsonFile) -and (-not $OverwriteExisting)) { throw "Refusing to overwrite existing file: $OutputJsonFile (use -OverwriteExisting)." }

$outDir = Split-Path -Parent $OutputFile
if ($outDir -and -not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
$outJsonDir = Split-Path -Parent $OutputJsonFile
if ($outJsonDir -and -not (Test-Path -LiteralPath $outJsonDir)) { New-Item -ItemType Directory -Path $outJsonDir -Force | Out-Null }
if ($ArchiveDir -and -not (Test-Path -LiteralPath $ArchiveDir)) { New-Item -ItemType Directory -Path $ArchiveDir -Force | Out-Null }

$raw = Get-Content -Raw -LiteralPath $InputFile
$trim = $raw.TrimStart()
if ($trim -match "^(<html|<!doctype html)") { throw "Input source file contains HTML/challenge content, not dataset payload." }

function IsFiniteDouble { param([double]$Value) return (-not [double]::IsNaN($Value)) -and (-not [double]::IsInfinity($Value)) }

function To-WhsKey {
  param([string]$Value)
  $raw = [string]$Value
  if ([string]::IsNullOrWhiteSpace($raw)) { throw "Missing UNESCO source site id." }
  $m = [regex]::Match($raw.Trim(), '^(\d{1,6})$')
  if (-not $m.Success) { throw "Invalid UNESCO source site id: $raw" }
  $n = [int]$m.Groups[1].Value
  return "WHS $n"
}

function To-WhsNumber {
  param([string]$Value)
  $raw = [string]$Value
  if ([string]::IsNullOrWhiteSpace($raw)) { throw "Missing UNESCO source site id." }
  $m = [regex]::Match($raw.Trim(), '^(\d{1,6})$')
  if (-not $m.Success) { throw "Invalid UNESCO source site id: $raw" }
  $n = [int]$m.Groups[1].Value
  return [string]$n
}

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

function Parse-ComponentAliases {
  param([string]$ComponentsText)
  $aliases = New-Object System.Collections.Generic.List[string]
  if ([string]::IsNullOrWhiteSpace($ComponentsText)) { return @() }
  $matches = [regex]::Matches($ComponentsText, 'name:\s*([^,}]+)')
  foreach ($m in $matches) {
    $n = [string]$m.Groups[1].Value
    $n = $n.Trim().Trim("'").Trim('"')
    $n = Clean-Text -Value $n
    if ([string]::IsNullOrWhiteSpace($n)) { continue }
    if (-not $aliases.Contains($n)) { $aliases.Add($n) }
  }
  return $aliases.ToArray()
}

function Parse-ComponentPoints {
  param([string]$ComponentsText)
  $points = New-Object System.Collections.Generic.List[object]
  if ([string]::IsNullOrWhiteSpace($ComponentsText)) { return @() }
  $pattern = "name:\s*(?<name>.+?)\s*,\s*ref:\s*(?<ref>[^,}]+),\s*latitude:\s*(?<lat>-?\d+(?:\.\d+)?),\s*longitude:\s*(?<lon>-?\d+(?:\.\d+)?)"
  $matches = [regex]::Matches($ComponentsText, $pattern)
  foreach ($m in $matches) {
    $name = [string]$m.Groups["name"].Value
    $name = $name.Trim().Trim("'").Trim('"')
    $name = Clean-Text -Value $name
    $ref = [string]$m.Groups["ref"].Value
    $ref = $ref.Trim().Trim("'").Trim('"')
    $lat = [double]$m.Groups["lat"].Value
    $lon = [double]$m.Groups["lon"].Value
    if ((IsFiniteDouble $lat) -and (IsFiniteDouble $lon)) {
      $points.Add([ordered]@{ name = $name; ref = $ref; lat = $lat; lon = $lon })
    }
  }
  return $points.ToArray()
}

function Normalize-NativeNames {
  param([object]$Value)
  $fields = @("name_ar", "name_local")
  $out = [ordered]@{}
  if ($null -eq $Value) { return $out }
  foreach ($f in $fields) {
    $v = Clean-Text -Value ([string]$Value.$f)
    if ([string]::IsNullOrWhiteSpace($v)) { continue }
    $out[$f] = $v.Trim()
  }
  return $out
}

function Build-NativeDisplay {
  param([object]$NativeNames)
  $order = @("name_local", "name_ar")
  $values = New-Object System.Collections.Generic.List[string]
  foreach ($k in $order) {
    $v = [string]$NativeNames.$k
    if ([string]::IsNullOrWhiteSpace($v)) { continue }
    $clean = $v.Trim()
    if (-not $values.Contains($clean)) { $values.Add($clean) }
  }
  if ($values.Count -eq 0) { return "" }
  return ($values -join " | ")
}

function Load-NativeNameMap {
  param([string]$Path)
  $map = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $map }
  $text = Get-Content -Raw -LiteralPath $Path
  if ([string]::IsNullOrWhiteSpace($text)) { return $map }
  $obj = $text | ConvertFrom-Json
  if ($null -eq $obj) { return $map }
  if ($null -ne $obj.entries) {
    foreach ($p in $obj.entries.PSObject.Properties) {
      $siteId = [string]$p.Name
      if ([string]::IsNullOrWhiteSpace($siteId)) { continue }
      $local = Clean-Text -Value ([string]$p.Value.local_name)
      if ([string]::IsNullOrWhiteSpace($local)) { continue }
      $map[$siteId] = [ordered]@{ name_local = $local; name_ar = $local }
    }
    return $map
  }
  if ($null -ne $obj.names) {
    foreach ($p in $obj.names.PSObject.Properties) {
      $siteId = [string]$p.Name
      if ([string]::IsNullOrWhiteSpace($siteId)) { continue }
      $entry = Normalize-NativeNames -Value $p.Value
      if ($entry.Count -gt 0) { $map[$siteId] = $entry }
    }
    return $map
  }
  return $map
}

function Archive-ExistingOutputs {
  param([string]$JsonPath,[string]$GeoPath,[string]$HistoryDir)
  if (-not (Test-Path -LiteralPath $JsonPath) -and -not (Test-Path -LiteralPath $GeoPath)) { return }
  $stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
  if (Test-Path -LiteralPath $JsonPath) {
    $jsonName = [System.IO.Path]::GetFileNameWithoutExtension($JsonPath)
    $jsonExt = [System.IO.Path]::GetExtension($JsonPath)
    Copy-Item -LiteralPath $JsonPath -Destination (Join-Path $HistoryDir "$jsonName.$stamp$jsonExt") -Force
  }
  if (Test-Path -LiteralPath $GeoPath) {
    $geoName = [System.IO.Path]::GetFileNameWithoutExtension($GeoPath)
    $geoExt = [System.IO.Path]::GetExtension($GeoPath)
    Copy-Item -LiteralPath $GeoPath -Destination (Join-Path $HistoryDir "$geoName.$stamp$geoExt") -Force
  }
}

function Prune-Archive {
  param([string]$HistoryDir,[int]$KeepCount)
  if ($KeepCount -lt 1) { return }
  $groups = @{}
  foreach ($f in Get-ChildItem -LiteralPath $HistoryDir -File) {
    $name = $f.Name
    if ($name -match "^(unesco_official_sites)\.\d{8}T\d{6}Z(\.json|\.geojson)$") {
      $key = "$($matches[1])$($matches[2])"
      if (-not $groups.ContainsKey($key)) { $groups[$key] = New-Object System.Collections.Generic.List[object] }
      $groups[$key].Add($f)
    }
  }
  foreach ($k in $groups.Keys) {
    $ordered = @($groups[$k] | Sort-Object Name -Descending)
    if ($ordered.Count -le $KeepCount) { continue }
    $toDelete = $ordered[$KeepCount..($ordered.Count - 1)]
    foreach ($d in $toDelete) { Remove-Item -LiteralPath $d.FullName -Force }
  }
}

function Build-FeatureCollectionFromOdsArray {
  param(
    [Parameter(Mandatory = $true)]$Rows,
    [hashtable]$NativeNameMap = @{}
  )
  $features = New-Object System.Collections.Generic.List[object]
  foreach ($row in @($Rows)) {
    if (-not $row) { continue }
    $sourceSiteId = [string]$row.id_no
    if ([string]::IsNullOrWhiteSpace($sourceSiteId)) { throw "UNESCO source row missing required field id_no." }
    $siteId = To-WhsKey -Value $sourceSiteId

    $name = Clean-Text -Value ([string]$row.name_en)
    if ([string]::IsNullOrWhiteSpace($name)) { $name = Clean-Text -Value ([string]$row.name_fr) }
    if ([string]::IsNullOrWhiteSpace($name)) { $name = Clean-Text -Value ([string]$row.name_es) }

    $point = $null
    if ($row.coordinates -and $null -ne $row.coordinates.lon -and $null -ne $row.coordinates.lat) {
      $lon = [double]$row.coordinates.lon
      $lat = [double]$row.coordinates.lat
      if ((IsFiniteDouble $lat) -and (IsFiniteDouble $lon)) { $point = @{ lat = $lat; lon = $lon } }
    }
    if (-not $point -and $row.geo_point_2d -and $null -ne $row.geo_point_2d.lon -and $null -ne $row.geo_point_2d.lat) {
      $lon = [double]$row.geo_point_2d.lon
      $lat = [double]$row.geo_point_2d.lat
      if ((IsFiniteDouble $lat) -and (IsFiniteDouble $lon)) { $point = @{ lat = $lat; lon = $lon } }
    }
    if (-not $point) { continue }

    $componentPoints = @(Parse-ComponentPoints -ComponentsText ([string]$row.components_list))
    $nativeNames = $null
    if ($NativeNameMap.ContainsKey($sourceSiteId)) {
      $nativeNames = Normalize-NativeNames -Value $NativeNameMap[$sourceSiteId]
    } else {
      # Quality guard: avoid injecting uncurated multilingual text from source rows.
      # Only emit local-script text when a trusted table entry exists.
      $nativeNames = [ordered]@{}
    }
    $nativeDisplay = Build-NativeDisplay -NativeNames $nativeNames
    $features.Add([ordered]@{
      type = "Feature"
      geometry = [ordered]@{ type = "Point"; coordinates = @($point.lon, $point.lat) }
      properties = [ordered]@{
        site_id = $siteId
        name = $name
        name_en = $name
        site_scope = "whs"
        status = "active"
        unesco_url = "https://whc.unesco.org/en/list/$sourceSiteId/"
        country = if ($row.states_names) { Clean-Text -Value ((@($row.states_names) | ForEach-Object { Clean-Text -Value ([string]$_) }) -join ", ") } else { "" }
        inscription_date = Clean-Text -Value ([string]$row.date_inscribed)
        category = Clean-Text -Value ([string]$row.category)
        note = Clean-Text -Value ([string]$row.short_description_en)
        aliases = Parse-ComponentAliases -ComponentsText ([string]$row.components_list)
        alias_points = $componentPoints
        component_count = @($componentPoints).Count
        native_names = $nativeNames
        native_display = $nativeDisplay
        source = "unesco_official"
      }
    })

    if (@($componentPoints).Count -gt 1) {
      $idx = 1
      foreach ($cp in $componentPoints) {
        if (-not $cp) { continue }
        $componentId = ("MWH {0}-{1:000}" -f (To-WhsNumber -Value $sourceSiteId), $idx)
        $componentName = Clean-Text -Value ([string]$cp.name)
        if ([string]::IsNullOrWhiteSpace($componentName)) { $componentName = "$name component $idx" }
        $features.Add([ordered]@{
          type = "Feature"
          geometry = [ordered]@{ type = "Point"; coordinates = @([double]$cp.lon, [double]$cp.lat) }
          properties = [ordered]@{
            site_id = $componentId
            parent_site_id = $siteId
            component_ref = [string]$cp.ref
            component_index = $idx
            site_scope = "component"
            name = "$name - $componentName"
            name_en = "$name - $componentName"
            status = "active"
            unesco_url = "https://whc.unesco.org/en/list/$sourceSiteId/"
            country = if ($row.states_names) { Clean-Text -Value ((@($row.states_names) | ForEach-Object { Clean-Text -Value ([string]$_) }) -join ", ") } else { "" }
            inscription_date = Clean-Text -Value ([string]$row.date_inscribed)
            category = Clean-Text -Value ([string]$row.category)
            note = Clean-Text -Value ([string]$row.short_description_en)
            aliases = @($componentName, $name)
            alias_points = @()
            component_count = 1
            native_names = $nativeNames
            native_display = $nativeDisplay
            source = "unesco_official_component"
          }
        })
        $idx++
      }
    }
  }
  return [ordered]@{ type = "FeatureCollection"; features = $features.ToArray() }
}

function Convert-FeatureCollectionToCanonicalJson {
  param([Parameter(Mandatory = $true)]$Collection)
  $sites = New-Object System.Collections.Generic.List[object]
  foreach ($f in @($Collection.features)) {
    if (-not $f -or -not $f.geometry -or -not $f.properties) { continue }
    $lon = [double]$f.geometry.coordinates[0]
    $lat = [double]$f.geometry.coordinates[1]
    if (-not (IsFiniteDouble $lat) -or -not (IsFiniteDouble $lon)) { continue }
    $p = $f.properties
    $siteId = [string]$p.site_id
    if ([string]::IsNullOrWhiteSpace($siteId)) { throw "Feature missing site_id in canonical conversion." }
    if ($siteId -notmatch '^(WHS \d{1,6}|MWH \d{1,6}-\d{3})$') { throw "Invalid canonical site_id: $siteId" }
    $siteScope = [string]$p.site_scope
    $parentSiteId = [string]$p.parent_site_id
    if ($siteScope -eq "component") {
      if ($siteId -notmatch '^MWH \d{1,6}-\d{3}$') { throw "Component feature has invalid site_id: $siteId" }
      if ($parentSiteId -notmatch '^WHS \d{1,6}$') { throw "Component feature has invalid parent_site_id: $parentSiteId" }
    }
    elseif ($siteScope -eq "whs") {
      if ($siteId -notmatch '^WHS \d{1,6}$') { throw "WHS feature has invalid site_id: $siteId" }
      if (-not [string]::IsNullOrWhiteSpace($parentSiteId)) { throw "WHS feature must not have parent_site_id: $siteId -> $parentSiteId" }
    }
    else {
      throw "Feature has invalid site_scope '$siteScope' for site_id $siteId"
    }
    $sites.Add([ordered]@{
      site_id = $siteId
      name = Clean-Text -Value ([string]$p.name)
      name_en = Clean-Text -Value ([string]$p.name_en)
      parent_site_id = $parentSiteId
      component_ref = [string]$p.component_ref
      component_index = if ($null -eq $p.component_index) { $null } else { [int]$p.component_index }
      site_scope = [string]$p.site_scope
      status = if ([string]::IsNullOrWhiteSpace([string]$p.status)) { "active" } else { [string]$p.status }
      unesco_url = Clean-Text -Value ([string]$p.unesco_url)
      country = Clean-Text -Value ([string]$p.country)
      inscription_date = Clean-Text -Value ([string]$p.inscription_date)
      category = Clean-Text -Value ([string]$p.category)
      note = Clean-Text -Value ([string]$p.note)
      aliases = @(@($p.aliases) | ForEach-Object { Clean-Text -Value ([string]$_) })
      alias_points = @($p.alias_points)
      component_count = if ($null -eq $p.component_count) { $null } else { [int]$p.component_count }
      native_names = Normalize-NativeNames -Value $p.native_names
      native_display = if ([string]::IsNullOrWhiteSpace([string]$p.native_display)) { Build-NativeDisplay -NativeNames (Normalize-NativeNames -Value $p.native_names) } else { [string]$p.native_display }
      source = if ([string]::IsNullOrWhiteSpace([string]$p.source)) { "unesco_official" } else { [string]$p.source }
      lon = $lon
      lat = $lat
    })
  }

  $attemptAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  $inputBytes = [System.Text.Encoding]::UTF8.GetByteCount($raw)
  return [ordered]@{
    schema = "my-world-heritage-sites/v1"
    metadata = [ordered]@{
      generator = "scripts/convert_unesco_source.ps1"
      source_url = $SourceUrl
      generated_at = $attemptAt
      site_count = $sites.Count
      extract_status = [ordered]@{
        result = "success"
        source = $SourceUrl
        count = $sites.Count
        input_bytes = $inputBytes
        dataset_bytes = 0
        most_recent_data = $attemptAt
        most_recent_attempt = $attemptAt
        retry_interval_days = $RetryIntervalDays
        note_fragment = ""
      }
    }
    sites = $sites.ToArray()
  }
}

function Convert-CanonicalJsonToFeatureCollection {
  param([Parameter(Mandatory = $true)]$Canonical)
  $features = New-Object System.Collections.Generic.List[object]
  foreach ($s in @($Canonical.sites)) {
    if (-not $s) { continue }
    $lon = [double]$s.lon
    $lat = [double]$s.lat
    if (-not (IsFiniteDouble $lat) -or -not (IsFiniteDouble $lon)) { continue }
    $siteId = [string]$s.site_id
    if ([string]::IsNullOrWhiteSpace($siteId)) { throw "Canonical site entry missing site_id." }
    if ($siteId -notmatch '^(WHS \d{1,6}|MWH \d{1,6}-\d{3})$') { throw "Invalid canonical site_id in JSON: $siteId" }
    $siteScope = [string]$s.site_scope
    $parentSiteId = [string]$s.parent_site_id
    if ($siteScope -eq "component") {
      if ($siteId -notmatch '^MWH \d{1,6}-\d{3}$') { throw "Canonical component has invalid site_id: $siteId" }
      if ($parentSiteId -notmatch '^WHS \d{1,6}$') { throw "Canonical component has invalid parent_site_id: $parentSiteId" }
    }
    elseif ($siteScope -eq "whs") {
      if ($siteId -notmatch '^WHS \d{1,6}$') { throw "Canonical WHS has invalid site_id: $siteId" }
      if (-not [string]::IsNullOrWhiteSpace($parentSiteId)) { throw "Canonical WHS must not have parent_site_id: $siteId -> $parentSiteId" }
    }
    else {
      throw "Canonical site has invalid site_scope '$siteScope' for site_id $siteId"
    }
    $features.Add([ordered]@{
      type = "Feature"
      geometry = [ordered]@{ type = "Point"; coordinates = @($lon, $lat) }
      properties = [ordered]@{
        site_id = $siteId
      name = Clean-Text -Value ([string]$s.name)
      name_en = Clean-Text -Value ([string]$s.name_en)
        parent_site_id = $parentSiteId
        component_ref = [string]$s.component_ref
        component_index = if ($null -eq $s.component_index) { $null } else { [int]$s.component_index }
        site_scope = [string]$s.site_scope
        status = [string]$s.status
      unesco_url = Clean-Text -Value ([string]$s.unesco_url)
      country = Clean-Text -Value ([string]$s.country)
      inscription_date = Clean-Text -Value ([string]$s.inscription_date)
      category = Clean-Text -Value ([string]$s.category)
      note = Clean-Text -Value ([string]$s.note)
      aliases = @(@($s.aliases) | ForEach-Object { Clean-Text -Value ([string]$_) })
        alias_points = @($s.alias_points)
        component_count = if ($null -eq $s.component_count) { $null } else { [int]$s.component_count }
        native_names = Normalize-NativeNames -Value $s.native_names
        native_display = if ([string]::IsNullOrWhiteSpace([string]$s.native_display)) { Build-NativeDisplay -NativeNames (Normalize-NativeNames -Value $s.native_names) } else { [string]$s.native_display }
        source = [string]$s.source
      }
    })
  }
  return [ordered]@{
    type = "FeatureCollection"
    metadata = [ordered]@{
      generator = "scripts/convert_unesco_source.ps1"
      source_url = $SourceUrl
      generated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
      source_format = "canonical_json"
      feature_count = $features.Count
      extract_status = $Canonical.metadata.extract_status
    }
    features = $features.ToArray()
  }
}

function Build-NoteFragment {
  param([string]$Source,[int]$Count,[int64]$InputBytes,[int64]$OutputBytes,[string]$MostRecentData,[string]$MostRecentAttempt,[int]$RetryDays,[string]$Result)
  return "WHS extract status: $Result. Source: $Source. Count: $Count. Input size: $InputBytes bytes. Dataset size: $OutputBytes bytes. Most recent data: $MostRecentData. Most recent attempt: $MostRecentAttempt. Retry interval: every $RetryDays days."
}

$collection = $null
$nameMapPath = if ([string]::IsNullOrWhiteSpace($NativeNameMapFile)) { $LocalNameTableFile } else { $NativeNameMapFile }
$nativeNameMap = Load-NativeNameMap -Path $nameMapPath
try {
  $json = $raw | ConvertFrom-Json
  if ($json -is [System.Array]) {
    $collection = Build-FeatureCollectionFromOdsArray -Rows $json -NativeNameMap $nativeNameMap
  }
  elseif ($json.type -eq "FeatureCollection" -and $json.features) {
    $collection = $json
  }
  elseif ($json.schema -eq "my-world-heritage-sites/v1" -and $json.sites) {
    $collection = Convert-CanonicalJsonToFeatureCollection -Canonical $json
  }
} catch {
  throw "Failed to parse source file as JSON: $($_.Exception.Message)"
}

if (-not $collection -or -not $collection.features -or @($collection.features).Count -eq 0) {
  throw "Parsed source file but no geocoded WHS features were produced."
}

$canonical = Convert-FeatureCollectionToCanonicalJson -Collection $collection
$canonicalJson = $canonical | ConvertTo-Json -Depth 30
$datasetBytes = [System.Text.Encoding]::UTF8.GetByteCount($canonicalJson)
$canonical.metadata.extract_status.dataset_bytes = $datasetBytes
$canonical.metadata.extract_status.note_fragment = Build-NoteFragment -Source $canonical.metadata.extract_status.source -Count $canonical.metadata.extract_status.count -InputBytes $canonical.metadata.extract_status.input_bytes -OutputBytes $datasetBytes -MostRecentData $canonical.metadata.extract_status.most_recent_data -MostRecentAttempt $canonical.metadata.extract_status.most_recent_attempt -RetryDays $canonical.metadata.extract_status.retry_interval_days -Result $canonical.metadata.extract_status.result

Archive-ExistingOutputs -JsonPath $OutputJsonFile -GeoPath $OutputFile -HistoryDir $ArchiveDir

$canonical | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $OutputJsonFile -Encoding utf8
$geojson = Convert-CanonicalJsonToFeatureCollection -Canonical $canonical
$geojson | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $OutputFile -Encoding utf8

Prune-Archive -HistoryDir $ArchiveDir -KeepCount $KeepVersions

Write-Host "Wrote $OutputJsonFile with $($canonical.sites.Count) sites."
Write-Host "Wrote $OutputFile with $($geojson.features.Count) features."


