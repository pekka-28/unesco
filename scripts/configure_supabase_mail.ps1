param([string]$ProjectRef = 'fjqhgcegnphavatrchjb')
$ErrorActionPreference = 'Stop'
Write-Host 'Configure the Microsoft application authorised to send from pekka@data.co.za.'
Write-Host 'Use the Entra application secret, not your mailbox password.'
$settings = [ordered]@{
    MWH_MS_TENANT_ID = (Read-Host 'Microsoft tenant ID')
    MWH_MS_CLIENT_ID = (Read-Host 'Application (client) ID')
    MWH_MS_MAIL_FROM = 'pekka@data.co.za'
}
if (-not $settings.MWH_MS_TENANT_ID -or -not $settings.MWH_MS_CLIENT_ID) { throw 'Tenant and application IDs are required' }
$secure = Read-Host 'Application client secret value (hidden)' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$secretFile = [IO.Path]::GetTempFileName()
try {
    $settings.MWH_MS_CLIENT_SECRET = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    if (-not $settings.MWH_MS_CLIENT_SECRET) { throw 'Client secret is required' }
    $lines = foreach ($entry in $settings.GetEnumerator()) {
        '{0}={1}' -f $entry.Key, (ConvertTo-Json -Compress -InputObject ([string]$entry.Value))
    }
    [IO.File]::WriteAllLines($secretFile, [string[]]$lines, [Text.UTF8Encoding]::new($false))
    $ErrorActionPreference = 'Continue'
    $result = & npx.cmd --yes supabase secrets set --env-file $secretFile --project-ref $ProjectRef 2>&1
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) { throw 'Configuration failed; CLI output withheld to protect credentials' }
    Write-Host 'Exchange application credentials saved in Supabase. Pending owner alerts can now be delivered.'
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    Remove-Item -LiteralPath $secretFile -Force -ErrorAction SilentlyContinue
    $settings.Clear()
    $lines = $null
    $result = $null
}
