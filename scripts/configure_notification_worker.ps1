param([string]$ProjectRef = 'fjqhgcegnphavatrchjb')
$ErrorActionPreference = 'Stop'
if ($ProjectRef -notmatch '^[a-z]{10,40}$') { throw 'Invalid project reference' }
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$workerToken = -join ($bytes | ForEach-Object { $_.ToString('x2') })
$secretFile = [IO.Path]::GetTempFileName()
$sqlFile = [IO.Path]::GetTempFileName()
try {
    [IO.File]::WriteAllText($secretFile, "MWH_NOTIFICATION_TOKEN=$workerToken`n", [Text.UTF8Encoding]::new($false))
    $ErrorActionPreference = 'Continue'
    $result = & npx.cmd --yes supabase secrets set --env-file $secretFile --project-ref $ProjectRef 2>&1
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) { throw 'Unable to configure worker secret; CLI output withheld to protect credentials' }
    $sql = @"
do `$`$
declare secret_id uuid;
begin
  select id into secret_id from vault.secrets where name = 'mwh_notification_token';
  if secret_id is null then
    perform vault.create_secret('$workerToken', 'mwh_notification_token');
  else
    perform vault.update_secret(secret_id, '$workerToken');
  end if;
  select id into secret_id from vault.secrets where name = 'mwh_notification_url';
  if secret_id is null then
    perform vault.create_secret('https://$ProjectRef.supabase.co/functions/v1/new-profile-notifications', 'mwh_notification_url');
  else
    perform vault.update_secret(secret_id, 'https://$ProjectRef.supabase.co/functions/v1/new-profile-notifications');
  end if;
end `$`$;
"@
    [IO.File]::WriteAllText($sqlFile, $sql, [Text.UTF8Encoding]::new($false))
    $ErrorActionPreference = 'Continue'
    $result = & npx.cmd --yes supabase db query --linked --project-ref $ProjectRef --file $sqlFile 2>&1
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) {
        Write-Warning (($result | Out-String).Replace($workerToken, '[redacted]'))
        throw 'Unable to configure scheduler credential; rerun this script to reconcile worker and Vault secrets'
    }
    Write-Host 'Worker authentication configured in Supabase Secrets and Vault; no credential was printed.'
} finally {
    Remove-Item -LiteralPath $secretFile, $sqlFile -Force -ErrorAction SilentlyContinue
    $workerToken = $null
    $sql = $null
    $result = $null
}
