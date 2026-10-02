param([int]$DelaySeconds = 1800, [int]$MaxAttempts = 4)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot '..')
$resultPath = Join-Path (Get-Location) '.local/supabase-mail-test.json'
function Save-Result($state, $detail, $attempt, $requestId) {
    @{ state = $state; detail = $detail; attempt = $attempt; requestId = $requestId;
       updatedAt = [DateTime]::UtcNow.ToString('o') } |
        ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath $resultPath
}
function Invoke-DatabaseQuery([string[]]$QueryArguments) {
    $ErrorActionPreference = 'Continue'
    $raw = & npx.cmd --yes supabase db query --linked @QueryArguments 2>$null
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($code -ne 0) { throw 'Supabase verification query failed' }
    return (($raw | Out-String) | ConvertFrom-Json)
}
Save-Result 'waiting' 'Waiting for Exchange permission propagation before the next test' 0 $null
try {
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        Start-Sleep -Seconds $DelaySeconds
        $queued = Invoke-DatabaseQuery -QueryArguments @('--file', 'supabase/test_notification_delivery.sql')
        $requestId = [long]$queued.rows[0].request_id
        if ($requestId -le 0) { throw 'Supabase did not return a test request ID' }
        Save-Result 'checking' 'Test dispatched; checking provider acceptance' $attempt $requestId
        $response = $null
        for ($poll = 0; $poll -lt 8; $poll++) {
            Start-Sleep -Seconds 10
            $query = Invoke-DatabaseQuery -QueryArguments @("select status_code, timed_out, content from net._http_response where id = $requestId")
            if ($query.rows.Count) { $response = $query.rows[0]; break }
        }
        if (-not $response -or $response.timed_out) {
            Save-Result 'unknown' 'Delivery outcome is ambiguous; stopped to avoid sending duplicate test emails' $attempt $requestId
            exit 1
        }
        $body = $response.content | ConvertFrom-Json
        if ($response.status_code -eq 202 -and $body.accepted -eq $true) {
            Save-Result 'accepted' 'Exchange accepted the Supabase delivery test; owner receipt confirmation pending' $attempt $requestId
            exit 0
        }
        if ($body.error -notmatch '^Exchange rejected message: 403') {
            Save-Result 'failed' 'Test rejected for a reason other than pending Exchange permission; inspect the private worker response' $attempt $requestId
            exit 1
        }
        Save-Result 'waiting' 'Exchange still denies access; next test after the propagation interval' $attempt $requestId
    }
    Save-Result 'failed' 'Exchange still denies access after four spaced attempts; administrator review required' $MaxAttempts $requestId
} catch {
    Save-Result 'failed' 'Local retry helper stopped; inspect its execution environment before retrying' 0 $null
    exit 1
}
