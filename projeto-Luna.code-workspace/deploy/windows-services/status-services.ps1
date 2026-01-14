<#
Mostra status dos serviços LunaCore/TotemAPI e as portas configuradas.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here 'config.ps1')

$services = @('LunaCoreService','TotemAPIService')
foreach ($s in $services) {
    $svc = Get-Service -Name $s -ErrorAction SilentlyContinue
    if ($null -eq $svc) {
        Write-Host ($s + ' - (não instalado)') -ForegroundColor Yellow
    } else {
        Write-Host ($s + ' - ' + [string]$svc.Status) -ForegroundColor Cyan
    }
}

Write-Host "LunaCore esperado: http://localhost:$LunaCorePort" -ForegroundColor Green
Write-Host "TotemAPI esperado: http://localhost:$TotemApiPort" -ForegroundColor Green
