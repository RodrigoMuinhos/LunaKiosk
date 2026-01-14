<#
Remove LunaCore + TotemAPI services installed via WinSW.
Execute como Administrador.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

function Test-RunningAsAdmin {
    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Execute este script em PowerShell **como Administrador**.'
    }
}

Test-RunningAsAdmin

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtime = Join-Path $here '_runtime'

$lc = Join-Path $runtime 'LunaCoreService'
$ta = Join-Path $runtime 'TotemAPIService'

if (Test-Path (Join-Path $lc 'LunaCoreService.exe')) {
    Push-Location $lc
    try {
        .\LunaCoreService.exe stop | Out-Null
    } catch { }
    try {
        .\LunaCoreService.exe uninstall
    } catch { }
    Pop-Location
}

if (Test-Path (Join-Path $ta 'TotemAPIService.exe')) {
    Push-Location $ta
    try {
        .\TotemAPIService.exe stop | Out-Null
    } catch { }
    try {
        .\TotemAPIService.exe uninstall
    } catch { }
    Pop-Location
}

Write-Host 'OK. Serviços removidos.' -ForegroundColor Green
