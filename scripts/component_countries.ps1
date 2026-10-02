# Components have their own State Party; a parent's countries are not evidence.
function Get-ComponentCountry {
  param([string]$Reference, [string]$ParentCountry, $CountryMap)
  $entry = $CountryMap.PSObject.Properties[$Reference]
  if ($entry) { return [string]$entry.Value }
  if ($ParentCountry -notmatch ',') { return $ParentCountry }
  # Do not guess a country from a bounding box or inherit a transnational list.
  return ''
}
