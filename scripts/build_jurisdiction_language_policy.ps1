param(
  [string]$UnescoInputFile = "data/staging/unesco_source_raw.txt",
  [string]$CldrTerritoryLanguageFile = "data/staging/cldr_language_territory_information.txt",
  [string]$CldrLikelySubtagsFile = "data/staging/cldr_likelySubtags.json",
  [string]$OutputFile = "data/mappings/jurisdiction_language_policy.json",
  [string]$AnomalyOutputFile = "data/mappings/jurisdiction_language_policy_anomalies.json",
  [int]$MaxPrimarySelectors = 4,
  [double]$MinShareForNonOfficial = 0.03,
  [double]$DistinctiveMinShare = 0.02,
  [int]$MaxDistinctiveSelectors = 1
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Clean-Text {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return "" }
  return ([string]$Value).Trim()
}

function To-Double {
  param([object]$Value)
  $text = Clean-Text -Value ([string]$Value)
  if ([string]::IsNullOrWhiteSpace($text)) { return 0.0 }
  $num = 0.0
  if ([double]::TryParse($text, [ref]$num)) { return [double]$num }
  return 0.0
}

function Status-Rank {
  param([string]$Status)
  $s = (Clean-Text -Value $Status).ToLowerInvariant()
  if ($s -eq "official") { return 4 }
  if ($s -eq "de_facto_official") { return 3 }
  if ($s -eq "official_regional") { return 2 }
  return 1
}

function Parse-LanguageCode {
  param(
    [string]$Code,
    [hashtable]$LikelyScriptByLanguage
  )
  $raw = Clean-Text -Value $Code
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return [ordered]@{
      cldr_code = ""
      language = ""
      script = ""
      language_script = ""
      script_source = "none"
    }
  }

  $normalized = $raw.Replace("_", "-")
  $parts = @($normalized -split "-")
  $language = if ($parts.Count -gt 0) { (Clean-Text -Value ([string]$parts[0])).ToLowerInvariant() } else { "" }
  $script = ""
  $scriptSource = "none"

  if ($parts.Count -gt 1 -and [regex]::IsMatch([string]$parts[1], '^[A-Za-z]{4}$')) {
    $script = (Get-Culture).TextInfo.ToTitleCase(([string]$parts[1]).ToLowerInvariant())
    $scriptSource = "cldr_code"
  } elseif (-not [string]::IsNullOrWhiteSpace($language) -and $LikelyScriptByLanguage.ContainsKey($language)) {
    $script = [string]$LikelyScriptByLanguage[$language]
    $scriptSource = "likely_subtags"
  }

  $languageScript = if ([string]::IsNullOrWhiteSpace($language) -or [string]::IsNullOrWhiteSpace($script)) { "" } else { "$language-$script" }
  return [ordered]@{
    cldr_code = $raw
    language = $language
    script = $script
    language_script = $languageScript
    script_source = $scriptSource
  }
}

function Build-LikelyScriptMap {
  param([string]$Path)
  $map = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $map }
  $obj = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  if ($null -eq $obj -or $null -eq $obj.supplemental -or $null -eq $obj.supplemental.likelySubtags) { return $map }
  foreach ($p in $obj.supplemental.likelySubtags.PSObject.Properties) {
    $key = (Clean-Text -Value ([string]$p.Name)).ToLowerInvariant()
    if ([string]::IsNullOrWhiteSpace($key)) { continue }
    if ($key.Contains("-") -or $key.Contains("_")) { continue }
    $value = (Clean-Text -Value ([string]$p.Value)).Replace("_", "-")
    $parts = @($value -split "-")
    if ($parts.Count -lt 2) { continue }
    $script = [string]$parts[1]
    if (-not [regex]::IsMatch($script, '^[A-Za-z]{4}$')) { continue }
    $map[$key] = (Get-Culture).TextInfo.ToTitleCase($script.ToLowerInvariant())
  }
  return $map
}

function Get-FileFingerprint {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    return [ordered]@{
      path = $Path
      size_bytes = 0
      sha256 = ""
    }
  }
  $fi = Get-Item -LiteralPath $Path
  $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $Path
  return [ordered]@{
    path = $Path
    size_bytes = [int64]$fi.Length
    sha256 = ([string]$hash.Hash).ToLowerInvariant()
  }
}

if (-not (Test-Path -LiteralPath $UnescoInputFile)) { throw "UNESCO source file not found: $UnescoInputFile" }
if (-not (Test-Path -LiteralPath $CldrTerritoryLanguageFile)) { throw "CLDR territory-language file not found: $CldrTerritoryLanguageFile" }
if (-not (Test-Path -LiteralPath $CldrLikelySubtagsFile)) { throw "CLDR likely-subtags file not found: $CldrLikelySubtagsFile" }
if ($MaxPrimarySelectors -lt 1) { throw "MaxPrimarySelectors must be >= 1." }
if ($MinShareForNonOfficial -lt 0.0 -or $MinShareForNonOfficial -gt 1.0) { throw "MinShareForNonOfficial must be between 0 and 1." }
if ($DistinctiveMinShare -lt 0.0 -or $DistinctiveMinShare -gt 1.0) { throw "DistinctiveMinShare must be between 0 and 1." }
if ($MaxDistinctiveSelectors -lt 0) { throw "MaxDistinctiveSelectors must be >= 0." }

$outDir = Split-Path -Parent $OutputFile
if ($outDir -and -not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
$anomalyDir = Split-Path -Parent $AnomalyOutputFile
if ($anomalyDir -and -not (Test-Path -LiteralPath $anomalyDir)) { New-Item -ItemType Directory -Path $anomalyDir -Force | Out-Null }

$unescoFingerprint = Get-FileFingerprint -Path $UnescoInputFile
$cldrTerritoryFingerprint = Get-FileFingerprint -Path $CldrTerritoryLanguageFile
$cldrLikelySubtagsFingerprint = Get-FileFingerprint -Path $CldrLikelySubtagsFile

$likelyScriptByLanguage = Build-LikelyScriptMap -Path $CldrLikelySubtagsFile

$unescoRows = Get-Content -Raw -LiteralPath $UnescoInputFile | ConvertFrom-Json
$isoSet = New-Object System.Collections.Generic.HashSet[string]
foreach ($row in @($unescoRows)) {
  if (-not $row) { continue }
  $codesText = Clean-Text -Value ([string]$row.iso_codes)
  if ([string]::IsNullOrWhiteSpace($codesText)) { continue }
  foreach ($part in @($codesText -split ",")) {
    $iso = (Clean-Text -Value $part).ToUpperInvariant()
    if ([string]::IsNullOrWhiteSpace($iso)) { continue }
    if ($iso.Length -ne 2) { continue }
    [void]$isoSet.Add($iso)
  }
}

$cldrRows = Import-Csv -Path $CldrTerritoryLanguageFile -Delimiter "`t" -Header language_name,language_code,territory_name,territory_code,official_status,language_population,writing_population
$cldrByIso = @{}
foreach ($r in @($cldrRows)) {
  if (-not $r) { continue }
  $iso = (Clean-Text -Value ([string]$r.territory_code)).ToUpperInvariant()
  if ([string]::IsNullOrWhiteSpace($iso) -or $iso.Length -ne 2) { continue }
  if (-not $cldrByIso.ContainsKey($iso)) { $cldrByIso[$iso] = New-Object System.Collections.Generic.List[object] }
  $parsed = Parse-LanguageCode -Code ([string]$r.language_code) -LikelyScriptByLanguage $likelyScriptByLanguage
  $cldrByIso[$iso].Add([ordered]@{
    territory_name = Clean-Text -Value ([string]$r.territory_name)
    official_status = (Clean-Text -Value ([string]$r.official_status)).ToLowerInvariant()
    language_name = Clean-Text -Value ([string]$r.language_name)
    language = [string]$parsed.language
    script = [string]$parsed.script
    language_script = [string]$parsed.language_script
    cldr_code = [string]$parsed.cldr_code
    script_source = [string]$parsed.script_source
    language_population = To-Double -Value $r.language_population
    writing_population = To-Double -Value $r.writing_population
  })
}

$jurisdictions = [ordered]@{}
$anomalies = New-Object System.Collections.Generic.List[object]
$isoList = @($isoSet | Sort-Object)

foreach ($iso in $isoList) {
  $candidates = New-Object System.Collections.Generic.List[object]
  if ($cldrByIso.ContainsKey($iso)) {
    foreach ($item in $cldrByIso[$iso]) { $candidates.Add($item) }
  }
  if ($candidates.Count -eq 0) {
    $anomalies.Add([ordered]@{
      type = "missing_cldr_territory"
      jurisdiction_iso = $iso
      message = "No CLDR territory-language data found for this jurisdiction."
    })
    $jurisdictions[$iso] = [ordered]@{
      territory_name = ""
      selectors = @()
      stats = [ordered]@{
        candidate_count = 0
        selected_count = 0
      }
    }
    continue
  }

  $territoryName = @($candidates | ForEach-Object { [string]$_.territory_name } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1)
  $totalWriting = 0.0
  $totalLanguage = 0.0
  foreach ($c in $candidates) {
    $totalWriting += [double]$c.writing_population
    $totalLanguage += [double]$c.language_population
  }

  $rows = New-Object System.Collections.Generic.List[object]
  foreach ($c in $candidates) {
    $share = 0.0
    if ($totalWriting -gt 0.0) { $share = [double]$c.writing_population / $totalWriting }
    elseif ($totalLanguage -gt 0.0) { $share = [double]$c.language_population / $totalLanguage }
    $rows.Add([ordered]@{
      territory_name = [string]$c.territory_name
      official_status = [string]$c.official_status
      language_name = [string]$c.language_name
      language = [string]$c.language
      script = [string]$c.script
      language_script = [string]$c.language_script
      cldr_code = [string]$c.cldr_code
      script_source = [string]$c.script_source
      language_population = [double]$c.language_population
      writing_population = [double]$c.writing_population
      writing_share = [double]$share
      status_rank = Status-Rank -Status ([string]$c.official_status)
    })
  }

  $sorted = @($rows | Sort-Object @{Expression = { [double]$_.writing_share }; Descending = $true }, @{Expression = { [int]$_.status_rank }; Descending = $true }, @{Expression = { [double]$_.writing_population }; Descending = $true }, @{Expression = { [string]$_.language_script }; Descending = $false })

  $selected = New-Object System.Collections.Generic.List[object]
  $selectedKeys = New-Object System.Collections.Generic.HashSet[string]
  $selectedScripts = New-Object System.Collections.Generic.HashSet[string]
  foreach ($entry in $sorted) {
    if ($selected.Count -ge $MaxPrimarySelectors) { break }
    $status = [string]$entry.official_status
    $isOfficialLike = $status -in @("official", "de_facto_official", "official_regional")
    if (-not $isOfficialLike -and [double]$entry.writing_share -lt $MinShareForNonOfficial) { continue }
    $key = [string]$entry.language_script
    if ([string]::IsNullOrWhiteSpace($key)) { $key = ("{0}|{1}" -f [string]$entry.language, [string]$entry.script) }
    if ($selectedKeys.Contains($key)) { continue }
    [void]$selectedKeys.Add($key)
    if (-not [string]::IsNullOrWhiteSpace([string]$entry.script)) { [void]$selectedScripts.Add([string]$entry.script) }
    $entry.selection_reason = "top_share"
    $selected.Add($entry)
  }

  $distinctiveAdded = 0
  if ($MaxDistinctiveSelectors -gt 0) {
    foreach ($entry in $sorted) {
      if ($distinctiveAdded -ge $MaxDistinctiveSelectors) { break }
      $key = [string]$entry.language_script
      if ([string]::IsNullOrWhiteSpace($key)) { $key = ("{0}|{1}" -f [string]$entry.language, [string]$entry.script) }
      if ($selectedKeys.Contains($key)) { continue }
      $script = [string]$entry.script
      if ([string]::IsNullOrWhiteSpace($script)) { continue }
      if ($selectedScripts.Contains($script)) { continue }
      if ([double]$entry.writing_share -lt $DistinctiveMinShare) { continue }
      $entry.selection_reason = "distinctive_script"
      $selected.Add($entry)
      [void]$selectedKeys.Add($key)
      [void]$selectedScripts.Add($script)
      $distinctiveAdded++
    }
  }

  $officialCandidates = @($rows | Where-Object { $_.official_status -in @("official", "de_facto_official", "official_regional") })
  $officialSelected = @($selected | Where-Object { $_.official_status -in @("official", "de_facto_official", "official_regional") })
  if ($officialCandidates.Count -gt $officialSelected.Count) {
    $anomalies.Add([ordered]@{
      type = "official_languages_truncated"
      jurisdiction_iso = $iso
      message = "Selection cap omitted some CLDR official/de-facto/regional official languages."
      official_candidate_count = $officialCandidates.Count
      official_selected_count = $officialSelected.Count
    })
  }

  $unknownScript = @($rows | Where-Object { [string]::IsNullOrWhiteSpace([string]$_.script) })
  if ($unknownScript.Count -gt 0) {
    $anomalies.Add([ordered]@{
      type = "unknown_script"
      jurisdiction_iso = $iso
      message = "One or more candidate languages have no resolved script."
      count = $unknownScript.Count
    })
  }

  $scriptDiverseCandidates = @($rows | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_.script) } | Group-Object script)
  if ($scriptDiverseCandidates.Count -gt 1 -and $distinctiveAdded -eq 0) {
    $bestMissingDistinctive = @($sorted | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_.script) -and -not $selectedScripts.Contains([string]$_.script) } | Select-Object -First 1)
    if ($bestMissingDistinctive.Count -gt 0 -and [double]$bestMissingDistinctive[0].writing_share -ge $DistinctiveMinShare) {
      $anomalies.Add([ordered]@{
        type = "distinctive_script_not_selected"
        jurisdiction_iso = $iso
        message = "Jurisdiction has a significant additional script not selected."
        script = [string]$bestMissingDistinctive[0].script
        writing_share = [math]::Round([double]$bestMissingDistinctive[0].writing_share, 6)
      })
    }
  }

  $selectorRows = @($selected | Sort-Object @{Expression = { [double]$_.writing_share }; Descending = $true }, @{Expression = { [int]$_.status_rank }; Descending = $true }, @{Expression = { [string]$_.language_script }; Descending = $false })
  $selectors = New-Object System.Collections.Generic.List[object]
  foreach ($s in $selectorRows) {
    $selectors.Add([ordered]@{
      language = [string]$s.language
      script = [string]$s.script
      language_script = [string]$s.language_script
      language_name = [string]$s.language_name
      cldr_code = [string]$s.cldr_code
      official_status = [string]$s.official_status
      writing_population = [int64][math]::Round([double]$s.writing_population, 0)
      writing_share = [math]::Round([double]$s.writing_share, 6)
      selection_reason = [string]$s.selection_reason
      script_source = [string]$s.script_source
    })
  }

  $jurisdictions[$iso] = [ordered]@{
    territory_name = if ($territoryName.Count -gt 0) { [string]$territoryName[0] } else { "" }
    selectors = $selectors.ToArray()
    stats = [ordered]@{
      candidate_count = $rows.Count
      selected_count = $selectors.Count
      official_candidate_count = $officialCandidates.Count
      official_selected_count = $officialSelected.Count
      total_writing_population = [int64][math]::Round($totalWriting, 0)
      total_language_population = [int64][math]::Round($totalLanguage, 0)
    }
  }
}

$generatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$doc = [ordered]@{
  schema = "my-world-heritage-jurisdiction-language-policy/v1"
  generated_at = $generatedAt
  deterministic_for_fixed_inputs = $true
  sources = [ordered]@{
    unesco_input = $unescoFingerprint
    cldr_territory_language = $cldrTerritoryFingerprint
    cldr_likely_subtags = $cldrLikelySubtagsFingerprint
  }
  selection_rules = [ordered]@{
    max_primary_selectors = $MaxPrimarySelectors
    min_share_for_non_official = $MinShareForNonOfficial
    distinctive_min_share = $DistinctiveMinShare
    max_distinctive_selectors = $MaxDistinctiveSelectors
    rationale = "Use top writing-population languages per jurisdiction, capped for practicality, with optional additional distinctive script support."
    cap_reasoning = "Cap set to 4 because cap 3 dropped materially relevant official languages in jurisdictions such as Switzerland (fr-Latn) and Fiji (fj-Latn)."
  }
  jurisdiction_count = $jurisdictions.Count
  jurisdictions = $jurisdictions
}

$anomalyDoc = [ordered]@{
  schema = "my-world-heritage-jurisdiction-language-policy-anomalies/v1"
  generated_at = $generatedAt
  deterministic_for_fixed_inputs = $true
  sources = [ordered]@{
    unesco_input = $unescoFingerprint
    cldr_territory_language = $cldrTerritoryFingerprint
    cldr_likely_subtags = $cldrLikelySubtagsFingerprint
  }
  anomaly_count = $anomalies.Count
  anomalies = $anomalies
}

$doc | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $OutputFile -Encoding utf8
$anomalyDoc | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $AnomalyOutputFile -Encoding utf8

Write-Host ("Wrote {0} ({1} jurisdictions)" -f $OutputFile, $jurisdictions.Count)
Write-Host ("Wrote {0} ({1} anomalies)" -f $AnomalyOutputFile, $anomalies.Count)
