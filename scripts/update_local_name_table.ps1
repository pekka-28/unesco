# update_local_name_table.ps1 0.1.4
param(
  [string]$InputFile = "data/staging/unesco_source_raw.txt",
  [string]$SourceUrl = "https://data.unesco.org/api/explore/v2.1/catalog/datasets/whc001/exports/json",
  [string]$OverpassCacheDir = "archive/overpass_legacy/data/cache",
  [string]$LocalNameTableFile = "data/mappings/local_name_table.json",
  [string]$OutputTableFile = "data/mappings/local_name_table.proposed.json",
  [string]$SuggestionsOutputFile = "data/mappings/local_name_suggestions.json",
  [double]$MinConfidenceApply = 0.97,
  [switch]$Apply,
  [switch]$EnableWikipediaFallback,
  [int]$MaxWikipediaRequests = 80
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
  return $Value.Contains("�") -or $Value.Contains("ï¿½")
}

function Supports-UnescoArabicFallback {
  param([object]$IsoCodes)
  $arabicOfficialIso = @(
    "AE","BH","DJ","DZ","EG","EH","ER","IQ","JO","KM","KW","LB","LY","MA","MR","OM","PS","QA","SA","SD","SO","SY","TD","TN","YE"
  )
  foreach ($iso in @($IsoCodes)) {
    $code = (Clean-Text -Value ([string]$iso)).ToUpperInvariant()
    if ([string]::IsNullOrWhiteSpace($code)) { continue }
    if ($arabicOfficialIso -contains $code) { return $true }
  }
  return $false
}

function Get-RootIdFromRefWhc {
  param([string]$RefWhc)
  $m = [regex]::Match((Clean-Text -Value $RefWhc), '^\d+')
  return [string]$m.Value
}

function LangTagForKey {
  param([string]$Key)
  $k = (Clean-Text -Value $Key).ToLowerInvariant()
  if ($k -eq "name:zgh") { return "zgh" }
  if ($k -eq "name:ber") { return "ber" }
  if ($k -eq "name:tzm") { return "tzm" }
  if ($k -eq "name:ary") { return "ary" }
  if ($k -eq "name:ar") { return "ar" }
  if ($k -eq "name:fa") { return "fa" }
  if ($k -eq "name:he") { return "he" }
  if ($k.StartsWith("name:")) { return $k.Substring(5) }
  return "und"
}

function ConfidenceForKey {
  param([string]$Key)
  $k = (Clean-Text -Value $Key).ToLowerInvariant()
  if ($k -in @("name:zgh", "name:ber", "name:tzm")) { return 0.995 }
  if ($k -eq "name:ary") { return 0.99 }
  if ($k -eq "name:ar") { return 0.985 }
  if ($k -eq "name") { return 0.96 }
  if ($k.StartsWith("name:")) { return 0.94 }
  return 0.9
}

function New-Candidate {
  param(
    [string]$LocalName,
    [string]$LanguageTag,
    [string]$Source,
    [double]$Confidence,
    [string]$Evidence
  )
  return [ordered]@{
    local_name = $LocalName
    language_tag = $LanguageTag
    source = $Source
    confidence = [math]::Round($Confidence, 4)
    evidence = $Evidence
  }
}

function Load-TableEntries {
  param([string]$Path)
  $entries = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $entries }
  $obj = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  if ($null -eq $obj) { return $entries }
  if ($null -ne $obj.entries) {
    foreach ($p in $obj.entries.PSObject.Properties) {
      $sid = Clean-Text -Value ([string]$p.Name)
      if ([string]::IsNullOrWhiteSpace($sid)) { continue }
      $entries[$sid] = [ordered]@{
        english_name = Clean-Text -Value ([string]$p.Value.english_name)
        local_name = Clean-Text -Value ([string]$p.Value.local_name)
        local_language_tag = Clean-Text -Value ([string]$p.Value.local_language_tag)
        source = Clean-Text -Value ([string]$p.Value.source)
        confidence = if ($null -eq $p.Value.confidence) { 0.0 } else { [double]$p.Value.confidence }
        evidence = Clean-Text -Value ([string]$p.Value.evidence)
        updated_at = Clean-Text -Value ([string]$p.Value.updated_at)
      }
    }
    return $entries
  }
  if ($null -ne $obj.names) {
    foreach ($p in $obj.names.PSObject.Properties) {
      $sid = Clean-Text -Value ([string]$p.Name)
      if ([string]::IsNullOrWhiteSpace($sid)) { continue }
      $legacy = Clean-Text -Value ([string]$p.Value.name_ar)
      if ([string]::IsNullOrWhiteSpace($legacy)) { continue }
      $entries[$sid] = [ordered]@{
        english_name = ""
        local_name = $legacy
        local_language_tag = "ar"
        source = "legacy_native_name_map"
        confidence = 0.5
        evidence = ""
        updated_at = ""
      }
    }
  }
  return $entries
}

function Get-WikipediaCandidate {
  param([string]$EnglishName)
  $title = Clean-Text -Value $EnglishName
  if ([string]::IsNullOrWhiteSpace($title)) { return $null }
  $url = "https://en.wikipedia.org/w/api.php?action=query&format=json&prop=langlinks&titles=$([uri]::EscapeDataString($title))&lllimit=max"
  try {
    $resp = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 20
  } catch {
    return $null
  }
  if ($null -eq $resp.query -or $null -eq $resp.query.pages) { return $null }
  $pages = @($resp.query.pages.PSObject.Properties | ForEach-Object { $_.Value })
  if ($pages.Count -eq 0) { return $null }
  $page = $pages[0]
  if ($null -eq $page.langlinks) { return $null }
  $preferred = @("zgh","ber","tzm","ary","ar","fa","he","hy","ka","am","th","hi","ta","bn","el","ja","ko","zh")
  foreach ($lang in $preferred) {
    $ll = @($page.langlinks | Where-Object { ([string]$_.'lang').ToLowerInvariant() -eq $lang }) | Select-Object -First 1
    if ($null -eq $ll) { continue }
    $value = Clean-Text -Value ([string]$ll.'*')
    if ([string]::IsNullOrWhiteSpace($value)) { continue }
    if (-not (Has-StrongScript -Value $value)) { continue }
    if (Is-Mojibake -Value $value) { continue }
    return New-Candidate -LocalName $value -LanguageTag $lang -Source ("wikipedia:{0}" -f $lang) -Confidence 0.75 -Evidence $url
  }
  return $null
}

if (-not (Test-Path -LiteralPath $InputFile)) { throw "Input source file not found: $InputFile" }

$outDirs = @(
  (Split-Path -Parent $OutputTableFile),
  (Split-Path -Parent $SuggestionsOutputFile)
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique
foreach ($d in $outDirs) {
  if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

if ($Apply -and [string]::IsNullOrWhiteSpace($OutputTableFile)) { $OutputTableFile = $LocalNameTableFile }

$rows = Get-Content -Raw -LiteralPath $InputFile | ConvertFrom-Json
if (-not ($rows -is [System.Array])) { throw "Expected UNESCO source file to contain JSON array." }

$entries = Load-TableEntries -Path $LocalNameTableFile
$suggestions = New-Object System.Collections.Generic.List[object]

$overpassCandidateBySite = @{}
if (Test-Path -LiteralPath $OverpassCacheDir) {
  $priorityKeys = @("name:zgh","name:ber","name:tzm","name:ary","name:ar","name")
  $cacheFiles = Get-ChildItem -LiteralPath $OverpassCacheDir -Filter *.json -File -ErrorAction SilentlyContinue
  foreach ($cf in @($cacheFiles)) {
    $cache = $null
    try { $cache = Get-Content -Raw -LiteralPath $cf.FullName | ConvertFrom-Json } catch { continue }
    foreach ($el in @($cache.elements)) {
      if (-not $el -or -not $el.tags) { continue }
      $rootId = Get-RootIdFromRefWhc -RefWhc ([string]$el.tags."ref:whc")
      if ([string]::IsNullOrWhiteSpace($rootId)) { continue }

      $best = $null
      foreach ($k in $priorityKeys) {
        $v = Clean-Text -Value ([string]$el.tags.$k)
        if ([string]::IsNullOrWhiteSpace($v)) { continue }
        if (-not (Has-StrongScript -Value $v)) { continue }
        if (Is-Mojibake -Value $v) { continue }
        $cand = New-Candidate -LocalName $v -LanguageTag (LangTagForKey -Key $k) -Source ("overpass:{0}" -f $k) -Confidence (ConfidenceForKey -Key $k) -Evidence ("{0}#{1}" -f $cf.Name, [string]$el.id)
        $best = $cand
        break
      }
      if ($null -eq $best) { continue }
      if (-not $overpassCandidateBySite.ContainsKey($rootId) -or [double]$best.confidence -gt [double]$overpassCandidateBySite[$rootId].confidence) {
        $overpassCandidateBySite[$rootId] = $best
      }
    }
  }
}

$wikiBudget = [math]::Max(0, $MaxWikipediaRequests)
foreach ($row in @($rows)) {
  if (-not $row) { continue }
  $siteId = Clean-Text -Value ([string]$row.id_no)
  if ([string]::IsNullOrWhiteSpace($siteId)) { $siteId = Clean-Text -Value ([string]$row.number) }
  if ([string]::IsNullOrWhiteSpace($siteId)) { continue }
  $englishName = Clean-Text -Value ([string]$row.name_en)
  if ([string]::IsNullOrWhiteSpace($englishName)) { $englishName = Clean-Text -Value ([string]$row.name_fr) }
  if ([string]::IsNullOrWhiteSpace($englishName)) { $englishName = Clean-Text -Value ([string]$row.name_es) }

  $candidates = New-Object System.Collections.Generic.List[object]
  if ($overpassCandidateBySite.ContainsKey($siteId)) { $candidates.Add($overpassCandidateBySite[$siteId]) }

  $unescoAr = Clean-Text -Value ([string]$row.name_ar)
  $allowArabicFallback = Supports-UnescoArabicFallback -IsoCodes $row.iso_codes
  if ($allowArabicFallback -and -not [string]::IsNullOrWhiteSpace($unescoAr) -and (Has-StrongScript -Value $unescoAr) -and (-not (Is-Mojibake -Value $unescoAr))) {
    $candidates.Add((New-Candidate -LocalName $unescoAr -LanguageTag "ar" -Source "unesco:name_ar" -Confidence 0.92 -Evidence ("{0}#{1}" -f $SourceUrl, $siteId)))
  }

  if ($EnableWikipediaFallback -and $candidates.Count -eq 0 -and $wikiBudget -gt 0) {
    $wikiBudget--
    $wc = Get-WikipediaCandidate -EnglishName $englishName
    if ($null -ne $wc) { $candidates.Add($wc) }
  }

  if ($candidates.Count -eq 0) { continue }
  $best = @($candidates | Sort-Object @{Expression = { [double]$_.confidence }; Descending = $true })[0]

  $existing = if ($entries.ContainsKey($siteId)) { $entries[$siteId] } else { $null }
  $existingName = if ($null -eq $existing) { "" } else { Clean-Text -Value ([string]$existing.local_name) }
  $existingConfidence = if ($null -eq $existing) { 0.0 } else { [double]$existing.confidence }

  $replace = $false
  if ([string]::IsNullOrWhiteSpace($existingName)) { $replace = $true }
  elseif ($existingName -ne [string]$best.local_name -and [double]$best.confidence -gt $existingConfidence) { $replace = $true }

  if (-not $replace) {
    if ($entries.ContainsKey($siteId) -and [string]::IsNullOrWhiteSpace([string]$entries[$siteId].english_name)) { $entries[$siteId].english_name = $englishName }
    continue
  }

  $wouldApply = ([double]$best.confidence -ge $MinConfidenceApply)
  $suggestions.Add([ordered]@{
    site_id = $siteId
    english_name = $englishName
    old_local_name = $existingName
    old_confidence = [math]::Round($existingConfidence, 4)
    candidate_local_name = [string]$best.local_name
    candidate_language_tag = [string]$best.language_tag
    candidate_source = [string]$best.source
    candidate_confidence = [double]$best.confidence
    evidence = [string]$best.evidence
    action = if ($wouldApply) { "apply" } else { "review" }
  })

  if ($Apply -and $wouldApply) {
    $entries[$siteId] = [ordered]@{
      english_name = $englishName
      local_name = [string]$best.local_name
      local_language_tag = [string]$best.language_tag
      source = [string]$best.source
      confidence = [double]$best.confidence
      evidence = [string]$best.evidence
      updated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    }
  }
}

if ($Apply -and [string]::IsNullOrWhiteSpace($OutputTableFile)) { $OutputTableFile = $LocalNameTableFile }
if (-not $Apply) {
  foreach ($k in @($entries.Keys)) {
    if ([string]::IsNullOrWhiteSpace([string]$entries[$k].english_name)) { $entries[$k].english_name = "" }
  }
}

$orderedEntries = [ordered]@{}
foreach ($k in @($entries.Keys | Sort-Object {[int]($_ -replace '[^\d]','')} , {$_})) { $orderedEntries[$k] = $entries[$k] }
$tableDoc = [ordered]@{
  schema = "my-world-heritage-local-name-table/v1"
  generated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  source_input = $InputFile
  source_url = $SourceUrl
  overpass_cache_dir = $OverpassCacheDir
  apply_mode = [bool]$Apply
  min_confidence_apply = $MinConfidenceApply
  wikipedia_fallback = [bool]$EnableWikipediaFallback
  entries = $orderedEntries
}

$suggestionsDoc = [ordered]@{
  schema = "my-world-heritage-local-name-suggestions/v1"
  generated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  apply_mode = [bool]$Apply
  min_confidence_apply = $MinConfidenceApply
  suggestion_count = $suggestions.Count
  suggestions = $suggestions
}

$suggestionsDoc | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $SuggestionsOutputFile -Encoding utf8
$tableDoc | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $OutputTableFile -Encoding utf8

$applyCount = @($suggestions | Where-Object { $_.action -eq "apply" }).Count
Write-Host ("Suggestions: {0} (auto-eligible at threshold: {1})" -f $suggestions.Count, $applyCount)
Write-Host "Wrote $SuggestionsOutputFile"
Write-Host "Wrote $OutputTableFile"



