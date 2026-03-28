param(
  [string]$InputJsonFile = "data/current/unesco_official_sites.json",
  [int]$RetryIntervalDays = 30,
  [string]$SourceUrl = "",
  [string]$ErrorMessage = "UNESCO fetch failed"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $InputJsonFile)) {
  throw "Cannot update extract status; file not found: $InputJsonFile"
}

$data = Get-Content -Raw -LiteralPath $InputJsonFile | ConvertFrom-Json
if (-not $data -or $data.schema -ne "my-world-heritage-sites/v1") {
  throw "Input JSON is not canonical schema my-world-heritage-sites/v1"
}

if (-not $data.metadata) { $data | Add-Member -NotePropertyName metadata -NotePropertyValue @{} }
if (-not $data.metadata.extract_status) { $data.metadata | Add-Member -NotePropertyName extract_status -NotePropertyValue @{} }

$attemptAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$source = if ([string]::IsNullOrWhiteSpace($SourceUrl)) { [string]$data.metadata.source_url } else { $SourceUrl }
$count = @($data.sites).Count
$datasetBytes = (Get-Item -LiteralPath $InputJsonFile).Length

$data.metadata.extract_status.result = "failed"
$data.metadata.extract_status.source = $source
$data.metadata.extract_status.count = $count
$data.metadata.extract_status.input_bytes = $null
$data.metadata.extract_status.dataset_bytes = $datasetBytes
$data.metadata.extract_status.most_recent_data = [string]$data.metadata.generated_at
$data.metadata.extract_status.most_recent_attempt = $attemptAt
$data.metadata.extract_status.retry_interval_days = $RetryIntervalDays
$data.metadata.extract_status.error = $ErrorMessage
$data.metadata.extract_status.note_fragment = "WHS extract status: failed. Source: $source. Count: $count. Dataset size: $datasetBytes bytes. Most recent data: $($data.metadata.generated_at). Most recent attempt: $attemptAt. Retry interval: every $RetryIntervalDays days."

$data | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $InputJsonFile -Encoding utf8
Write-Host "Updated extract status in $InputJsonFile"
