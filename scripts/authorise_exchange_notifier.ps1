param(
    [string]$ProjectRef = 'fjqhgcegnphavatrchjb',
    [ValidateSet('All','Register','Grant')][string]$Phase = 'All'
)
$ErrorActionPreference = 'Stop'
if ($ProjectRef -notmatch '^[a-z]{10,40}$') { throw 'Invalid project reference' }
$mailbox = 'pekka@data.co.za'
$name = "MWH Supabase notifier $ProjectRef"
$marker = "mwh-supabase-$ProjectRef"
$scopeName = "MWH sender $ProjectRef"
$assignmentName = "MWH Mail.Send $ProjectRef"
$resultPath = Join-Path $PSScriptRoot '../.local/exchange-authorisation-result.json'
$registrationPath = Join-Path $PSScriptRoot '../.local/exchange-notifier-registration.json'
$secretFile = $null
if ($Phase -eq 'All') {
    @{ configured = $false; pending = $true } | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath $resultPath
    Write-Host 'Microsoft Graph and Exchange run in separate processes to avoid authentication-library conflicts.'
    foreach ($step in @('Register','Grant')) {
        & "$PSHOME\powershell.exe" -NoProfile -File $PSCommandPath -ProjectRef $ProjectRef -Phase $step
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    Write-Host 'Unattended Supabase sending is configured. Tell the assistant setup completed.'
    exit 0
}
try {
    if ($Phase -eq 'Register') {
        Write-Host 'Register the dedicated application with a Microsoft administrator account.'
        $metadata = Invoke-RestMethod -Uri 'https://login.microsoftonline.com/data.co.za/v2.0/.well-known/openid-configuration'
        if ($metadata.issuer -notmatch '^https://login\.microsoftonline\.com/([a-f0-9-]{36})/v2\.0$') { throw 'Microsoft did not return the mailbox tenant' }
        $tenantId = $Matches[1]
        Connect-MgGraph -TenantId $tenantId -Scopes 'Application.ReadWrite.All' -ContextScope Process -NoWelcome
    $filter = [uri]::EscapeDataString("displayName eq '$name'")
    $apps = @( (Invoke-MgGraphRequest -Method GET -Uri "https://graph.microsoft.com/v1.0/applications?`$filter=$filter").value )
    if ($apps.Count -gt 1) { throw 'Multiple notifier registrations found; review before continuing' }
    if ($apps.Count -eq 1) {
        $app = $apps[0]
        if ($app.tags -notcontains $marker -or @($app.requiredResourceAccess).Count -gt 0) {
            throw 'Existing registration does not match this restricted notifier; review it before proceeding'
        }
    } else {
        $body = @{ displayName = $name; signInAudience = 'AzureADMyOrg'; tags = @($marker); requiredResourceAccess = @() }
        $app = Invoke-MgGraphRequest -Method POST -Uri 'https://graph.microsoft.com/v1.0/applications' -Body ($body | ConvertTo-Json -Depth 5) -ContentType 'application/json'
    }
    $filter = [uri]::EscapeDataString("appId eq '$($app.appId)'")
    $principals = @((Invoke-MgGraphRequest -Method GET -Uri "https://graph.microsoft.com/v1.0/servicePrincipals?`$filter=$filter").value)
    if ($principals.Count) { $principal = $principals[0] }
    else {
        $principal = Invoke-MgGraphRequest -Method POST -Uri 'https://graph.microsoft.com/v1.0/servicePrincipals' -Body (@{ appId = $app.appId } | ConvertTo-Json) -ContentType 'application/json'
    }
    $expiry = [DateTime]::UtcNow.AddYears(1).ToString('o')
    $credential = Invoke-MgGraphRequest -Method POST -Uri "https://graph.microsoft.com/v1.0/applications/$($app.id)/addPassword" -ContentType 'application/json' -Body (
        @{ passwordCredential = @{ displayName = 'Supabase notifier'; endDateTime = $expiry } } | ConvertTo-Json -Depth 4)
    $settings = [ordered]@{ MWH_MS_TENANT_ID = $tenantId; MWH_MS_CLIENT_ID = $app.appId; MWH_MS_CLIENT_SECRET = $credential.secretText; MWH_MS_MAIL_FROM = $mailbox }
    $secretFile = [IO.Path]::GetTempFileName()
    $lines = foreach ($entry in $settings.GetEnumerator()) { '{0}={1}' -f $entry.Key, (ConvertTo-Json -Compress -InputObject ([string]$entry.Value)) }
    [IO.File]::WriteAllLines($secretFile, [string[]]$lines, [Text.UTF8Encoding]::new($false))
    $ErrorActionPreference = 'Continue'
    $cliResult = & npx.cmd --yes supabase secrets set --env-file $secretFile --project-ref $ProjectRef 2>&1
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) { throw 'Microsoft authorisation succeeded but Supabase secret configuration failed; rerun setup' }
    @{ tenantId = $tenantId; clientId = $app.appId; principalId = $principal.id; mailbox = $mailbox; credentialExpires = $expiry; projectRef = $ProjectRef } |
        ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath $registrationPath
    Write-Host 'Application registered and credential stored in Supabase. Next: mailbox-scoped Exchange permission.'
    } else {
        Write-Host 'Sign in to Exchange as an administrator to grant send-only access to pekka@data.co.za.'
        $registration = Get-Content -Raw -LiteralPath $registrationPath | ConvertFrom-Json
        if ($registration.projectRef -ne $ProjectRef -or $registration.mailbox -ne $mailbox) { throw 'Registration does not match this project and mailbox' }
        $app = @{ appId = $registration.clientId }
        $principal = @{ id = $registration.principalId }
        Connect-ExchangeOnline -ShowBanner:$false
        $recipient = Get-EXOMailbox -Identity $mailbox
        if ([string]$recipient.PrimarySmtpAddress -ne $mailbox) { throw 'Expected Exchange mailbox not found' }
    if (-not (Get-ServicePrincipal -Identity $principal.id -ErrorAction SilentlyContinue)) {
        New-ServicePrincipal -AppId $app.appId -ObjectId $principal.id -DisplayName $name | Out-Null
    }
    $scope = Get-ManagementScope -Identity $scopeName -ErrorAction SilentlyContinue
    if (-not $scope) {
        $scope = New-ManagementScope -Name $scopeName -RecipientRestrictionFilter "PrimarySmtpAddress -eq '$mailbox'"
    }
    $allowed = @(Get-Recipient -RecipientPreviewFilter $scope.RecipientFilter)
    if ($allowed.Count -ne 1 -or [string]$allowed[0].PrimarySmtpAddress -ne $mailbox) { throw 'Mailbox scope is not restricted to the owner' }
    if (-not (Get-ManagementRoleAssignment -Identity $assignmentName -ErrorAction SilentlyContinue)) {
        New-ManagementRoleAssignment -Name $assignmentName -App $principal.id -Role 'Application Mail.Send' -CustomResourceScope $scopeName | Out-Null
    }
    $permission = @(Test-ServicePrincipalAuthorization -Identity $principal.id -Resource $mailbox |
        Where-Object { $_.RoleName -eq 'Application Mail.Send' -and $_.InScope -eq $true -and $_.AllowedResourceScope -eq $scopeName })
    if (-not $permission.Count) { throw 'Mailbox-scoped send authorisation did not pass verification' }
        @{ configured = $true; tenantId = $registration.tenantId; clientId = $registration.clientId; mailbox = $mailbox; credentialExpires = $registration.credentialExpires } |
            ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath $resultPath
        Write-Host 'Mailbox-scoped sending permission verified. Microsoft may take time to propagate it.'
    }
} catch {
    $safeMessage = $_.Exception.Message
    if ($credential -and $credential.secretText) { $safeMessage = $safeMessage.Replace($credential.secretText, '[redacted]') }
    @{ configured = $false; phase = $Phase; message = $safeMessage } | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath $resultPath
    Write-Error $safeMessage -ErrorAction Continue
    exit 1
} finally {
    if ($secretFile) { Remove-Item -LiteralPath $secretFile -Force -ErrorAction SilentlyContinue }
    $credential = $null; $settings = $null; $lines = $null; $cliResult = $null
    if ($Phase -eq 'Register') { Disconnect-MgGraph -ErrorAction SilentlyContinue | Out-Null }
    if ($Phase -eq 'Grant') { Disconnect-ExchangeOnline -Confirm:$false -ErrorAction SilentlyContinue }
}
