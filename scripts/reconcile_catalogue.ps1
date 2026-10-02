# Stable current catalogue; Git retains the observation history.
function Merge-Catalogue {
  param($FreshSites, $PriorSites)
  $oldById = @{}
  $oldComponents = @{}
  $oldLocations = @{}
  $maxIndex = @{}
  foreach ($s in $PriorSites) {
    if ($oldById.ContainsKey($s.site_id)) { throw "Duplicate prior ID: $($s.site_id)" }
    $oldById[$s.site_id] = $s
    if ($s.site_scope -eq 'component') {
      $key = "$($s.parent_site_id)|$($s.component_ref)"
      $oldComponents[$key] = @($oldComponents[$key]) + @($s) | Where-Object { $null -ne $_ }
      $locationKey = "$($s.parent_site_id)|$($s.lat)|$($s.lon)|$(@($s.aliases)[0])"
      $oldLocations[$locationKey] = @($oldLocations[$locationKey]) + @($s) | Where-Object { $null -ne $_ }
      $index = [int]($s.site_id -replace '^.*-', '')
      $maxIndex[$s.parent_site_id] = [Math]::Max([int]$maxIndex[$s.parent_site_id], $index)
    }
  }
  $result = New-Object System.Collections.Generic.List[object]
  $used = @{}
  foreach ($s in $FreshSites) {
    if ($s.site_scope -eq 'component' -and $PriorSites.Count -gt 0) {
      $key = "$($s.parent_site_id)|$($s.component_ref)"
      $candidates = @($oldComponents[$key] | Where-Object { $null -ne $_ })
      if ($candidates.Count -eq 0) {
        # UNESCO can revise a reference on an extension (bis/ter/etc.). Preserve
        # identity only when BOTH the component label and location match exactly.
        $locationKey = "$($s.parent_site_id)|$($s.lat)|$($s.lon)|$(@($s.aliases)[0])"
        $candidates = @($oldLocations[$locationKey] | Where-Object { $null -ne $_ })
      }
      if ($candidates.Count -gt 1) {
        # Some official references repeat. Only an exact location disambiguates them.
        $candidates = @($candidates | Where-Object { $_.lat -eq $s.lat -and $_.lon -eq $s.lon })
        if ($candidates.Count -ne 1) { throw "Ambiguous component reference: $key" }
      }
      if ($candidates.Count -eq 1) {
        $s.site_id = $candidates[0].site_id
        $s.component_index = [int]($s.site_id -replace '^.*-', '')
      } else {
        if ([string]::IsNullOrWhiteSpace($s.component_ref)) { throw "Component lacks stable reference: $($s.site_id)" }
        $index = [int]$maxIndex[$s.parent_site_id] + 1
        if ($index -gt 999) { throw "Component ID capacity exceeded: $($s.parent_site_id)" }
        $maxIndex[$s.parent_site_id] = $index
        $s.site_id = 'MWH {0}-{1:000}' -f ($s.parent_site_id -replace '^WHS ', ''), $index
        $s.component_index = $index
      }
    }
    if ($used.ContainsKey($s.site_id)) { throw "Ambiguous or duplicate fresh ID: $($s.site_id)" }
    $used[$s.site_id] = $true
    $result.Add($s)
  }
  foreach ($s in $PriorSites) {
    if (-not $used.ContainsKey($s.site_id)) {
      $s.status = 'retired'
      $result.Add($s)
    }
  }
  return $result.ToArray()
}
