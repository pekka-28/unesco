$ErrorActionPreference = 'Stop'
$resultPath = Join-Path $PSScriptRoot '../.local/exchange-test-result.json'
New-Item -ItemType Directory -Force -Path (Split-Path $resultPath) | Out-Null
try {
    Connect-MgGraph -Scopes 'Mail.Send' -ContextScope Process -NoWelcome
    $context = Get-MgContext
    if ($context.Account -ne 'pekka@data.co.za') {
        throw 'Please sign in with pekka@data.co.za, then run this script again.'
    }
    $message = @{
        message = @{
            subject = 'My World Heritage - Exchange delivery test'
            body = @{
                contentType = 'Text'
                content = "This is the test message you requested for My World Heritage monitoring.`n`nIt verifies delivery through your Exchange 365 mailbox to pekka@data.co.za. It was sent using your interactive Microsoft session; unattended Supabase sending still requires its own authorisation.`n`nPlease confirm receipt in the chat. No new-user event was created."
            }
            toRecipients = @(@{ emailAddress = @{ address = 'pekka@data.co.za' } })
        }
        saveToSentItems = $true
    }
    Invoke-MgGraphRequest -Method POST -Uri 'https://graph.microsoft.com/v1.0/me/sendMail' -Body ($message | ConvertTo-Json -Depth 6) -ContentType 'application/json'
    @{ accepted = $true; recipient = 'pekka@data.co.za'; subject = $message.message.subject; acceptedAt = [DateTime]::UtcNow.ToString('o') } |
        ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath $resultPath
    Write-Host 'Exchange accepted the test message. Please check your mailbox and confirm receipt in the chat.'
} catch {
    @{ accepted = $false; message = 'Microsoft sign-in or test delivery failed. See the interactive window.' } |
        ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath $resultPath
    Write-Error $_
} finally {
    Disconnect-MgGraph -ErrorAction SilentlyContinue | Out-Null
}
