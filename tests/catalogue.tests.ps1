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
  Write-Host 'Catalogue tests passed.'
} finally {
  # Delete only the unique temporary fixture directory created by this test.
  $resolved = [IO.Path]::GetFullPath($temp)
  if ($resolved.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath())) -and (Split-Path -Leaf $resolved) -like 'mwh-catalogue-*') {
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}
