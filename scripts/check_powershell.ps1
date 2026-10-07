$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$failures = @()
$files = @(Get-ChildItem -LiteralPath (Join-Path $repoRoot 'scripts'), (Join-Path $repoRoot 'tests') -Filter '*.ps1' -File -Recurse)
foreach ($file in $files) {
    $tokens = $null
    $parseErrors = $null
    $null = [System.Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$tokens, [ref]$parseErrors)
    foreach ($parseError in $parseErrors) {
        $failures += ('{0}:{1}: {2}' -f $file.Name, $parseError.Extent.StartLineNumber, $parseError.Message)
    }
}
if ($failures.Count) { throw ($failures -join [Environment]::NewLine) }
Write-Output ("Parsed {0} active PowerShell files. This is syntax validation, not static typechecking." -f $files.Count)
