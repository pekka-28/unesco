# build_local_name_table_from_policy.ps1 0.1.4
param(
  [string]$InputFile = "data/staging/unesco_source_raw.txt",
  [string]$OverpassCacheDir = "archive/overpass_legacy/data/cache",
  [string]$JurisdictionPolicyFile = "data/mappings/jurisdiction_language_policy.json",
  [string]$ExistingTableFile = "data/mappings/local_name_table.json",
  [string]$OutputTableFile = "data/mappings/local_name_table.json",
  [string]$ReportOutputFile = "data/mappings/local_name_build_report.json"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

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

function Has-StrongScript {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return $false }
  return [regex]::IsMatch($Value, '[\u0370-\u03FF\u0400-\u052F\u0590-\u08FF\u0900-\u0DFF\u0E00-\u0E7F\u1100-\u11FF\u2D30-\u2D7F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]')
}

function Is-Mojibake {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return $false }
  return $Value.Contains("ï¿½") -or $Value.Contains("Ã¯Â¿Â½")
}

function Normalize-LangTag {
  param([string]$Tag)
  $t = (Clean-Text -Value $Tag).ToLowerInvariant()
  if ([string]::IsNullOrWhiteSpace($t)) { return "" }
  return $t.Replace("_", "-")
}

function Get-BaseLangTag {
  param([string]$Tag)
  $t = Normalize-LangTag -Tag $Tag
  if ([string]::IsNullOrWhiteSpace($t)) { return "" }
  $parts = @($t -split "-")
  if ($parts.Count -eq 0) { return "" }
  return [string]$parts[0]
}

function Get-IsoCodesFromRow {
  param([object]$Row)
  $set = New-Object System.Collections.Generic.HashSet[string]
  $text = Clean-Text -Value ([string]$Row.iso_codes)
  if ([string]::IsNullOrWhiteSpace($text)) { return @() }
  foreach ($part in @($text -split ",")) {
    $iso = (Clean-Text -Value $part).ToUpperInvariant()
    if ([string]::IsNullOrWhiteSpace($iso)) { continue }
    if ($iso.Length -ne 2) { continue }
    [void]$set.Add($iso)
  }
  return @($set | Sort-Object)
}

function Get-RootIdFromRefWhc {
  param([string]$RefWhc)
  $m = [regex]::Match((Clean-Text -Value $RefWhc), '^\d+')
  return [string]$m.Value
}

function Overpass-ConfidenceForLangTag {
  param([string]$LangTag)
  $tag = Normalize-LangTag -Tag $LangTag
  if ([string]::IsNullOrWhiteSpace($tag)) { return 0.0 }
  if ($tag -in @("zgh","ber","tzm")) { return 0.995 }
  if ($tag -eq "ary") { return 0.99 }
  if ($tag -eq "ar") { return 0.985 }
  if ($tag.Contains("-")) { return 0.98 }
  return 0.975
}

function Load-ExistingEntries {
  param([string]$Path)
  $entries = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $entries }
  $obj = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  if ($null -eq $obj -or $null -eq $obj.entries) { return $entries }
  foreach ($p in $obj.entries.PSObject.Properties) {
    $sid = Clean-Text -Value ([string]$p.Name)
    if ([string]::IsNullOrWhiteSpace($sid)) { continue }
    $entries[$sid] = [ordered]@{
      english_name = Clean-Text -Value ([string]$p.Value.english_name)
      local_name = Clean-Text -Value ([string]$p.Value.local_name)
      local_language_tag = Normalize-LangTag -Tag ([string]$p.Value.local_language_tag)
      source = Clean-Text -Value ([string]$p.Value.source)
      confidence = if ($null -eq $p.Value.confidence) { 0.0 } else { [double]$p.Value.confidence }
      evidence = Clean-Text -Value ([string]$p.Value.evidence)
      updated_at = Clean-Text -Value ([string]$p.Value.updated_at)
    }
  }
  return $entries
}

function Load-JurisdictionPolicy {
  param([string]$Path)
  $policy = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $policy }
  $doc = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  if ($null -eq $doc -or $null -eq $doc.jurisdictions) { return $policy }
  foreach ($p in $doc.jurisdictions.PSObject.Properties) {
    $iso = (Clean-Text -Value ([string]$p.Name)).ToUpperInvariant()
    if ([string]::IsNullOrWhiteSpace($iso)) { continue }
    $selectors = New-Object System.Collections.Generic.List[object]
    foreach ($s in @($p.Value.selectors)) {
      if (-not $s) { continue }
      $ls = Normalize-LangTag -Tag ([string]$s.language_script)
      $lang = Normalize-LangTag -Tag ([string]$s.language)
      if ([string]::IsNullOrWhiteSpace($ls) -and [string]::IsNullOrWhiteSpace($lang)) { continue }
      $selectors.Add([ordered]@{
        language_script = $ls
        language = if ([string]::IsNullOrWhiteSpace($lang)) { Get-BaseLangTag -Tag $ls } else { $lang }
        official_status = (Clean-Text -Value ([string]$s.official_status)).ToLowerInvariant()
        selection_reason = (Clean-Text -Value ([string]$s.selection_reason)).ToLowerInvariant()
        writing_share = if ($null -eq $s.writing_share) { 0.0 } else { [double]$s.writing_share }
      })
    }
    $policy[$iso] = @($selectors | Sort-Object @{Expression = { [double]$_.writing_share }; Descending = $true }, @{Expression = { [string]$_.language_script }; Descending = $false })
  }
  return $policy
}

function Get-PreferredLanguageTagsForRow {
  param(
    [object]$Row,
    [hashtable]$PolicyByIso
  )
  $ordered = New-Object System.Collections.Generic.List[string]
  $seen = New-Object System.Collections.Generic.HashSet[string]
  $isoCodes = Get-IsoCodesFromRow -Row $Row
  foreach ($iso in $isoCodes) {
    if (-not $PolicyByIso.ContainsKey($iso)) { continue }
    foreach ($sel in @($PolicyByIso[$iso])) {
      $full = Normalize-LangTag -Tag ([string]$sel.language_script)
      $base = Normalize-LangTag -Tag ([string]$sel.language)
      if (-not [string]::IsNullOrWhiteSpace($full) -and -not $seen.Contains($full)) { [void]$seen.Add($full); $ordered.Add($full) }
      if (-not [string]::IsNullOrWhiteSpace($base) -and -not $seen.Contains($base)) { [void]$seen.Add($base); $ordered.Add($base) }
    }
  }
  return @($ordered)
}

function Is-TagAllowedForPreferredSet {
  param(
    [string]$LanguageTag,
    [string[]]$PreferredTags
  )
  $tag = Normalize-LangTag -Tag $LanguageTag
  if ([string]::IsNullOrWhiteSpace($tag)) { return $false }
  $base = Get-BaseLangTag -Tag $tag
  foreach ($p in @($PreferredTags)) {
    $pt = Normalize-LangTag -Tag $p
    if ([string]::IsNullOrWhiteSpace($pt)) { continue }
    if ($pt -eq $tag) { return $true }
    if ($pt -eq $base) { return $true }
    if ((Get-BaseLangTag -Tag $pt) -eq $base) { return $true }
  }
  return $false
}

function Build-OverpassIndex {
  param([string]$CacheDir)
  $index = @{}
  if (-not (Test-Path -LiteralPath $CacheDir)) { return $index }
  $files = Get-ChildItem -LiteralPath $CacheDir -Filter *.json -File -ErrorAction SilentlyContinue
  foreach ($f in @($files)) {
    $cache = $null
    try { $cache = Get-Content -Raw -LiteralPath $f.FullName | ConvertFrom-Json } catch { continue }
    foreach ($el in @($cache.elements)) {
      if (-not $el -or -not $el.tags) { continue }
      $siteId = Get-RootIdFromRefWhc -RefWhc ([string]$el.tags."ref:whc")
      if ([string]::IsNullOrWhiteSpace($siteId)) { continue }
      if (-not $index.ContainsKey($siteId)) { $index[$siteId] = @{} }
      foreach ($tp in $el.tags.PSObject.Properties) {
        $k = [string]$tp.Name
        if (-not $k.StartsWith("name:")) { continue }
        $langTag = Normalize-LangTag -Tag ($k.Substring(5))
        if ([string]::IsNullOrWhiteSpace($langTag)) { continue }
        $value = Clean-Text -Value ([string]$tp.Value)
        if ([string]::IsNullOrWhiteSpace($value)) { continue }
        if (-not (Has-StrongScript -Value $value)) { continue }
        if (Is-Mojibake -Value $value) { continue }
        $cand = [ordered]@{
          local_name = $value
          language_tag = $langTag
          source = "overpass:$k"
          confidence = Overpass-ConfidenceForLangTag -LangTag $langTag
          evidence = ("{0}#{1}" -f $f.Name, [string]$el.id)
        }
        $existing = if ($index[$siteId].ContainsKey($langTag)) { $index[$siteId][$langTag] } else { $null }
        if ($null -eq $existing -or [double]$cand.confidence -gt [double]$existing.confidence) {
          $index[$siteId][$langTag] = $cand
        }
      }
    }
  }
  return $index
}

function Get-UnescoFieldCandidate {
  param(
    [object]$Row,
    [string[]]$PreferredTags,
    [string]$SourceUrl
  )
  $langToField = @{
    "ar" = "name_ar"
    "ru" = "name_ru"
    "zh" = "name_zh"
  }
  foreach ($tag in @($PreferredTags)) {
    $base = Get-BaseLangTag -Tag $tag
    if ([string]::IsNullOrWhiteSpace($base)) { continue }
    if (-not $langToField.ContainsKey($base)) { continue }
    $field = [string]$langToField[$base]
    $value = Clean-Text -Value ([string]$Row.$field)
    if ([string]::IsNullOrWhiteSpace($value)) { continue }
    if (-not (Has-StrongScript -Value $value)) { continue }
    if (Is-Mojibake -Value $value) { continue }
    $siteId = Clean-Text -Value ([string]$Row.id_no)
    if ([string]::IsNullOrWhiteSpace($siteId)) { $siteId = Clean-Text -Value ([string]$Row.number) }
    return [ordered]@{
      local_name = $value
      language_tag = $base
      source = "unesco:$field"
      confidence = 0.9
      evidence = ("{0}#{1}" -f $SourceUrl, $siteId)
    }
  }
  return $null
}

if (-not (Test-Path -LiteralPath $InputFile)) { throw "Input source file not found: $InputFile" }
if (-not (Test-Path -LiteralPath $JurisdictionPolicyFile)) { throw "Jurisdiction policy file not found: $JurisdictionPolicyFile" }

$outDir = Split-Path -Parent $OutputTableFile
if ($outDir -and -not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
$repDir = Split-Path -Parent $ReportOutputFile
if ($repDir -and -not (Test-Path -LiteralPath $repDir)) { New-Item -ItemType Directory -Path $repDir -Force | Out-Null }

$rows = Get-Content -Raw -LiteralPath $InputFile | ConvertFrom-Json
if (-not ($rows -is [System.Array])) { throw "Expected UNESCO source file to contain JSON array." }

$policyByIso = Load-JurisdictionPolicy -Path $JurisdictionPolicyFile
$entries = Load-ExistingEntries -Path $ExistingTableFile
$overpassIndex = Build-OverpassIndex -CacheDir $OverpassCacheDir

$updatedCount = 0
$createdCount = 0
$retainedCount = 0
$removedCount = 0
$unresolved = New-Object System.Collections.Generic.List[object]
$sourceUrl = "https://data.unesco.org/api/explore/v2.1/catalog/datasets/whc001/exports/json"

foreach ($row in @($rows)) {
  if (-not $row) { continue }
  $siteId = Clean-Text -Value ([string]$row.id_no)
  if ([string]::IsNullOrWhiteSpace($siteId)) { throw "UNESCO source row missing required field id_no." }
  if ($siteId -notmatch '^\d{1,6}$') { throw "UNESCO source row has invalid id_no: $siteId" }

  $englishName = Clean-Text -Value ([string]$row.name_en)
  if ([string]::IsNullOrWhiteSpace($englishName)) { $englishName = Clean-Text -Value ([string]$row.name_fr) }
  if ([string]::IsNullOrWhiteSpace($englishName)) { $englishName = Clean-Text -Value ([string]$row.name_es) }

  $preferredTags = Get-PreferredLanguageTagsForRow -Row $row -PolicyByIso $policyByIso
  $candidate = $null
  if ($overpassIndex.ContainsKey($siteId)) {
    $byLang = $overpassIndex[$siteId]
    foreach ($tag in @($preferredTags)) {
      $t = Normalize-LangTag -Tag $tag
      if ($byLang.ContainsKey($t)) { $candidate = $byLang[$t]; break }
      $base = Get-BaseLangTag -Tag $t
      if ($byLang.ContainsKey($base)) { $candidate = $byLang[$base]; break }
    }
  }
  if ($null -eq $candidate) {
    $candidate = Get-UnescoFieldCandidate -Row $row -PreferredTags $preferredTags -SourceUrl $sourceUrl
  }

  $existing = if ($entries.ContainsKey($siteId)) { $entries[$siteId] } else { $null }
  $existingTag = if ($null -eq $existing) { "" } else { Normalize-LangTag -Tag ([string]$existing.local_language_tag) }
  $existingAllowed = if ($null -eq $existing) { $false } else { Is-TagAllowedForPreferredSet -LanguageTag $existingTag -PreferredTags $preferredTags }
  if ($null -eq $candidate) {
    if ($null -ne $existing) {
      if ($existingAllowed) {
        if ([string]::IsNullOrWhiteSpace([string]$existing.english_name)) { $existing.english_name = $englishName }
        $retainedCount++
      } else {
        $entries.Remove($siteId)
        $removedCount++
        $unresolved.Add([ordered]@{
          site_id = $siteId
          english_name = $englishName
          previous_local_name = [string]$existing.local_name
          previous_language_tag = [string]$existing.local_language_tag
          preferred_language_tags = $preferredTags
          reason = "existing_entry_outside_policy_and_no_replacement"
        })
      }
    } else {
      $unresolved.Add([ordered]@{
        site_id = $siteId
        english_name = $englishName
        preferred_language_tags = $preferredTags
      })
    }
    continue
  }

  $replace = $false
  if ($null -eq $existing) { $replace = $true }
  else {
    $existingName = Clean-Text -Value ([string]$existing.local_name)
    $existingConf = if ($null -eq $existing.confidence) { 0.0 } else { [double]$existing.confidence }
    if (-not $existingAllowed) { $replace = $true }
    elseif ([string]::IsNullOrWhiteSpace($existingName)) { $replace = $true }
    elseif ($existingName -ne [string]$candidate.local_name -and [double]$candidate.confidence -gt $existingConf) { $replace = $true }
  }

  if ($replace) {
    $entries[$siteId] = [ordered]@{
      english_name = $englishName
      local_name = [string]$candidate.local_name
      local_language_tag = [string]$candidate.language_tag
      source = [string]$candidate.source
      confidence = [double]$candidate.confidence
      evidence = [string]$candidate.evidence
      updated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    }
    if ($null -eq $existing) { $createdCount++ } else { $updatedCount++ }
  } else {
    if ([string]::IsNullOrWhiteSpace([string]$existing.english_name)) { $existing.english_name = $englishName }
    $retainedCount++
  }
}

$orderedEntries = [ordered]@{}
foreach ($k in @($entries.Keys | Sort-Object {[int]($_ -replace '[^\d]','')} , {$_})) { $orderedEntries[$k] = $entries[$k] }

$tableDoc = [ordered]@{
  schema = "my-world-heritage-local-name-table/v1"
  generated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  source_input = $InputFile
  jurisdiction_policy_file = $JurisdictionPolicyFile
  overpass_cache_dir = $OverpassCacheDir
  selection_mode = "policy_ordered_overpass_then_matching_unesco_fields"
  entries = $orderedEntries
}

$reportDoc = [ordered]@{
  schema = "my-world-heritage-local-name-build-report/v1"
  generated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  created_count = $createdCount
  updated_count = $updatedCount
  retained_count = $retainedCount
  removed_count = $removedCount
  unresolved_count = $unresolved.Count
  unresolved = $unresolved
}

$tableDoc | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $OutputTableFile -Encoding utf8
$reportDoc | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ReportOutputFile -Encoding utf8

Write-Host ("Wrote {0} with {1} entries (created {2}, updated {3}, retained {4}, removed {5})" -f $OutputTableFile, $entries.Count, $createdCount, $updatedCount, $retainedCount, $removedCount)
Write-Host ("Wrote {0} (unresolved {1})" -f $ReportOutputFile, $unresolved.Count)



