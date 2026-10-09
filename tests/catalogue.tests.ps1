$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$temp = Join-Path ([IO.Path]::GetTempPath()) ('mwh-catalogue-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $temp | Out-Null
$source = Join-Path $temp 'source.json'
$canonical = Join-Path $temp 'sites.json'
$geo = Join-Path $temp 'sites.geojson'
function Assert($ok, $message) { if (-not $ok) { throw $message } }
function Convert-Fixture {
  & "$repo/scripts/convert_unesco_source.ps1" -InputFile $source -OutputJsonFile $canonical -OutputFile $geo -LocalNameTableFile "$temp/no-map" -OverwriteExisting -IngestionTimestamp '2026-10-01T00:00:00Z'
}
function Write-Rows($rows) { ConvertTo-Json -InputObject @($rows) -Depth 10 | Set-Content -LiteralPath $source -Encoding utf8 }
try {
  $rows = @(1..12 | ForEach-Object { [pscustomobject]@{ id_no = "$_"; name_en = "Site $_"; coordinates = @{ lat = 1; lon = 2 }; components_list = '' } })
  $a = 'name: A, ref: 1-a, latitude: 1, longitude: 2'
  $b = 'name: B, ref: 1-b, latitude: 3, longitude: 4'
  $rows[0].components_list = "$a; $b"
  Write-Rows $rows
  Convert-Fixture
  $first = Get-Content -Raw $canonical | ConvertFrom-Json
  Assert ($first.sites.Count -eq 14) 'Initial catalogue count'
  $rows[0].components_list = "$b; $a"
  Write-Rows $rows
  Convert-Fixture
  $reordered = Get-Content -Raw $canonical | ConvertFrom-Json
  Assert (($reordered.sites | Where-Object component_ref -eq '1-a').site_id -eq 'MWH 1-001') 'Reorder changed component identity'
  $rows[0].components_list = $b
  Write-Rows ($rows | Where-Object id_no -ne '12')
  Convert-Fixture
  $missing = Get-Content -Raw $canonical | ConvertFrom-Json
  Assert (($missing.sites | Where-Object site_id -eq 'WHS 12').status -eq 'retired') 'Root not retained'
  Assert (($missing.sites | Where-Object site_id -eq 'MWH 1-001').status -eq 'retired') 'Component not retained'
  Assert (($missing.sites | Where-Object site_id -eq 'MWH 1-002').status -eq 'active') 'Single remaining component lost'
  $before = Get-Content -Raw $canonical
  Convert-Fixture
  Assert ((Get-Content -Raw $canonical) -eq $before) 'Repeat conversion is not deterministic'
  $rows[0].components_list = "$a; $b"
  Write-Rows $rows
  Convert-Fixture
  $restored = Get-Content -Raw $canonical | ConvertFrom-Json
  Assert (@($restored.sites | Where-Object status -eq retired).Count -eq 0) 'Reappearance did not reactivate'
  # A source-present root with temporarily missing coordinates remains active.
  $rows[1].coordinates = $null
  Write-Rows $rows
  Convert-Fixture
  $known = (Get-Content -Raw $canonical | ConvertFrom-Json).sites | Where-Object site_id -eq 'WHS 2'
  Assert ($known.status -eq 'active' -and $known.lat -eq 1) 'Missing source coordinates wrongly retired known site'
  $features = (Get-Content -Raw $geo | ConvertFrom-Json).features
  Assert ($features.Count -eq $restored.sites.Count) 'GeoJSON count mismatch'
  foreach ($s in $restored.sites) {
    $f = $features | Where-Object { $_.properties.site_id -eq $s.site_id }
    Assert ($f.properties.status -eq $s.status) 'GeoJSON status mismatch'
  }
  $before = Get-Content -Raw $canonical
  Write-Rows @($rows[0])
  $failed = $false
  try { Convert-Fixture } catch { $failed = $true }
  Assert $failed 'Truncated response accepted'
  Assert ((Get-Content -Raw $canonical) -eq $before) 'Failed conversion overwrote current catalogue'
  Write-Rows $rows
  $failed = $false
  try { & "$repo/scripts/convert_unesco_source.ps1" -InputFile $source -OutputJsonFile $canonical -OutputFile $geo } catch { $failed = $true }
  Assert $failed 'Overwrite protection failed'
  Set-Content -LiteralPath $canonical -Value '{}'
  $failed = $false
  try { Convert-Fixture } catch { $failed = $true }
  Assert $failed 'Invalid prior catalogue accepted'
  . "$repo/scripts/reconcile_catalogue.ps1"
  $old = @(
    [pscustomobject]@{ site_id = 'MWH 1-001'; site_scope = 'component'; parent_site_id = 'WHS 1'; component_ref = 'same'; component_index = 1; lat = 1; lon = 2; status = 'active' },
    [pscustomobject]@{ site_id = 'MWH 1-002'; site_scope = 'component'; parent_site_id = 'WHS 1'; component_ref = 'same'; component_index = 2; lat = 3; lon = 4; status = 'active' }
  )
  $new = @([ordered]@{ site_id = 'MWH 1-001'; site_scope = 'component'; parent_site_id = 'WHS 1'; component_ref = 'same'; component_index = 1; lat = 3; lon = 4; status = 'active' })
  $merged = @(Merge-Catalogue -FreshSites $new -PriorSites $old)
  Assert ($merged[0].site_id -eq 'MWH 1-002') 'Duplicate source references not disambiguated by location'
  $new[0].lat = 99
  $failed = $false
  try { Merge-Catalogue -FreshSites $new -PriorSites $old | Out-Null } catch { $failed = $true }
  Assert $failed 'Ambiguous component identity accepted'
  $old[0] | Add-Member -NotePropertyName aliases -NotePropertyValue @('Known component')
  $revised = @([ordered]@{ site_id = 'MWH 1-001'; site_scope = 'component'; parent_site_id = 'WHS 1'; component_ref = 'revised-ref'; component_index = 1; lat = 1; lon = 2; status = 'active'; aliases = @('Known component') })
  $merged = @(Merge-Catalogue -FreshSites $revised -PriorSites $old)
  Assert ($merged[0].site_id -eq 'MWH 1-001') 'Reference revision lost exact matching component identity'
  Assert (-not (Test-Path "$temp/history")) 'Archive unexpectedly created'
  # Exact reviewed corrections run through ingestion; unrelated Unicode is intact.
  $corrections = Get-Content -Raw -Encoding utf8 "$repo/data/mappings/component_name_corrections.json" | ConvertFrom-Json
  $mappedJson = Join-Path $temp 'corrected.json'
  $mappedGeo = Join-Path $temp 'corrected.geojson'
  $unicode = 'Untouched ' + [char]0x00c3 + [char]0x00e5 + [char]0x4e2d + [char]0x0628
  $mappedRows = @($corrections.entries | ForEach-Object {
    [pscustomobject]@{
      id_no = $_.parent_site_id -replace '^WHS ', ''
      name_en = $unicode
      states_names = @('Sweden')
      coordinates = @{ lat = 1; lon = 2 }
      components_list = "name: $($_.source_name), ref: $($_.component_ref), latitude: 1, longitude: 2; name: $unicode, ref: $($_.component_ref)-other, latitude: 3, longitude: 4"
    }
  })
  Write-Rows $mappedRows
  $rawBefore = [IO.File]::ReadAllText($source)
  & "$repo/scripts/convert_unesco_source.ps1" -InputFile $source -OutputJsonFile $mappedJson -OutputFile $mappedGeo -LocalNameTableFile "$temp/no-map" -OverwriteExisting
  $mapped = Get-Content -Raw -Encoding utf8 $mappedJson | ConvertFrom-Json
  foreach ($entry in $corrections.entries) {
    $component = $mapped.sites | Where-Object component_ref -eq $entry.component_ref
    $parent = $mapped.sites | Where-Object site_id -eq $entry.parent_site_id
    Assert ($component.name_en -ceq "$unicode - $($entry.corrected_name)") 'Mapped component not corrected'
    Assert ($component.aliases[0] -ceq $entry.corrected_name) 'Component search alias not corrected'
    Assert ($parent.aliases -ccontains $entry.corrected_name) 'Parent search alias not corrected'
    Assert ($parent.alias_points[0].name -ceq $entry.corrected_name) 'Parent alias location not corrected'
    Assert ($parent.name_en -ceq $unicode) 'Valid Unicode changed'
  }
  Assert ([IO.File]::ReadAllText($source) -ceq $rawBefore) 'Correction changed raw source'
  # Reconciliation must retain the corrected ID and retired label when absent later.
  $retained = $mapped.sites | Where-Object component_ref -eq '352-004'
  $mappedRows[1].components_list = "name: $unicode, ref: 352-004-other, latitude: 3, longitude: 4"
  # Simulate a pre-correction retained record to cover historical repairs as well.
  $retained.name = "$unicode - $($corrections.entries[1].source_name)"
  $retained.name_en = $retained.name
  $retained.aliases[0] = $corrections.entries[1].source_name
  $mapped | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $mappedJson -Encoding utf8
  Write-Rows $mappedRows
  & "$repo/scripts/convert_unesco_source.ps1" -InputFile $source -OutputJsonFile $mappedJson -OutputFile $mappedGeo -LocalNameTableFile "$temp/no-map" -OverwriteExisting
  $retired = (Get-Content -Raw -Encoding utf8 $mappedJson | ConvertFrom-Json).sites | Where-Object site_id -eq $retained.site_id
  Assert ($retired.status -eq 'retired' -and $retired.aliases[0] -ceq $corrections.entries[1].corrected_name) 'Retired correction or identity lost'
  . "$repo/scripts/component_name_corrections.ps1"
  $retired.name = $unicode
  $retired.name_en = $unicode
  $warnings = @()
  $parents = @($mapped.sites | Where-Object site_scope -eq 'whs')
  Apply-ComponentNameCorrections -Sites ($parents + @($retired)) -Corrections $corrections -WarningVariable warnings -WarningAction SilentlyContinue
  Assert ($warnings.Count -eq 1 -and $retired.name_en -ceq $unicode) 'Unexpected mapped text should warn without rewriting it'
  $mapped = Get-Content -Raw -Encoding utf8 $mappedJson | ConvertFrom-Json
  $stable = $mapped | ConvertTo-Json -Depth 30
  Apply-ComponentNameCorrections -Sites $mapped.sites -Corrections $corrections
  Assert (($mapped | ConvertTo-Json -Depth 30) -ceq $stable) 'Corrections are not idempotent'
  Write-Host 'Catalogue tests passed.'
} finally {
  # Delete only the unique temporary fixture directory created by this test.
  $resolved = [IO.Path]::GetFullPath($temp)
  if ($resolved.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath())) -and (Split-Path -Leaf $resolved) -like 'mwh-catalogue-*') {
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}
