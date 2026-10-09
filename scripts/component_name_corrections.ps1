# Only explicitly reviewed mappings are applied. No encoding detection or conversion.
function Apply-ComponentNameCorrections {
  [CmdletBinding()]
  param($Sites, $Corrections)
  $changed = 0
  foreach ($entry in $Corrections.entries) {
    $from = [string]$entry.source_name
    $to = [string]$entry.corrected_name
    if (-not $entry.parent_site_id -or -not $entry.component_ref -or -not $from -or -not $to -or $from -ceq $to) {
      throw 'Invalid component-name correction mapping.'
    }
    $parent = $Sites | Where-Object { $_.site_id -ceq $entry.parent_site_id } | Select-Object -First 1
    if (-not $parent) { continue }
    foreach ($site in $Sites) {
      if ($site.site_scope -cne 'component' -or $site.parent_site_id -cne $entry.parent_site_id -or $site.component_ref -cne $entry.component_ref) { continue }
      $recognised = $false
      foreach ($field in @('name', 'name_en')) {
        $value = [string]$site.$field
        $suffix = ' - ' + $from
        if ($value -ceq $from -or $value.EndsWith($suffix, [StringComparison]::Ordinal)) {
          $site.$field = $value.Substring(0, $value.Length - $from.Length) + $to
          $changed++
          $recognised = $true
        } elseif ($value -ceq $to -or $value.EndsWith((' - ' + $to), [StringComparison]::Ordinal)) {
          $recognised = $true
        }
      }
      for ($i = 0; $i -lt @($site.aliases).Count; $i++) {
        if ($site.aliases[$i] -ceq $from) { $site.aliases[$i] = $to; $changed++ }
      }
      if (-not $recognised) {
        Write-Warning "Component-name mapping mismatch for $($site.site_id) / $($entry.component_ref): unexpected name left unchanged; manual review needed."
      }
    }
    # Parent search aliases refer to components but the parent title stays intact.
    $matchedPoint = $false
    foreach ($point in @($parent.alias_points)) {
      if ($point.ref -cne $entry.component_ref) { continue }
      if ($point.name -ceq $from) { $point.name = $to; $changed++; $matchedPoint = $true }
      elseif ($point.name -ceq $to) { $matchedPoint = $true }
    }
    if ($matchedPoint) {
      for ($i = 0; $i -lt @($parent.aliases).Count; $i++) {
        if ($parent.aliases[$i] -ceq $from) { $parent.aliases[$i] = $to; $changed++ }
      }
    }
  }
  Write-Host "Component-name corrections: $changed field(s) updated from explicit mappings."
}
