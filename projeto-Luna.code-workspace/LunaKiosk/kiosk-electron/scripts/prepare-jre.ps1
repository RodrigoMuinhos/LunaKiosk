$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$electronDir = Resolve-Path (Join-Path $scriptDir '..')
$resourcesDir = Join-Path $electronDir 'resources'
$jreDir = Join-Path $resourcesDir 'jre'
$javaExe = Join-Path $jreDir 'bin\\java.exe'

if (Test-Path -LiteralPath $javaExe) {
  Write-Host "JRE ja existe: $javaExe"
  exit 0
}

if (!(Test-Path -LiteralPath $resourcesDir)) {
  New-Item -ItemType Directory -Path $resourcesDir -Force | Out-Null
}

$uri = 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse'
$tmp = Join-Path $env:TEMP ("lunakiosk-jre-" + [Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
$zipPath = Join-Path $tmp 'jre.zip'

Write-Host 'Baixando JRE 21 (Temurin)...'
Invoke-WebRequest -Uri $uri -OutFile $zipPath

Write-Host 'Extraindo JRE...'
Expand-Archive -Path $zipPath -DestinationPath $tmp -Force

$inner = Get-ChildItem -Path $tmp | Where-Object { $_.PSIsContainer } | Select-Object -First 1
if (-not $inner) {
  throw 'Falha ao extrair JRE: pasta interna nao encontrada.'
}

if (Test-Path -LiteralPath $jreDir) {
  Remove-Item -LiteralPath $jreDir -Recurse -Force
}

Move-Item -LiteralPath $inner.FullName -Destination $jreDir
Remove-Item -LiteralPath $tmp -Recurse -Force

Write-Host "JRE pronto em: $jreDir"
