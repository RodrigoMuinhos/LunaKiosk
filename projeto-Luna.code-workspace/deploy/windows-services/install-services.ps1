<#
Instala LunaCore + TotemAPI como serviços do Windows (auto-start).

Requisitos:
- Rodar PowerShell como Administrador
- Java 21 no PATH

Este script:
1) Baixa WinSW (service wrapper)
2) Builda os JARs (mvnw package -DskipTests)
3) Copia JARs para deploy/windows-services/_runtime
4) Gera .xml do WinSW com env vars/ports
5) Instala e inicia os serviços
#>

[CmdletBinding()]
param(
    # Gera _runtime + XML/EXE do WinSW, mas NÃO instala/inicia serviços.
    [switch]$GenerateOnly,
    # Pula build Maven (usa JARs já existentes em target/)
    [switch]$SkipBuild,
    # Após instalar (ou se já estiver rodando), tenta checar /actuator/health
    [switch]$VerifyHttp
)

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

function Test-JavaAvailable {
    try {
        Get-Command java -ErrorAction Stop | Out-Null
    } catch {
        throw 'Java não encontrado no PATH. Instale Java 21 e garanta que `java` funcione no terminal.'
    }
}

function Invoke-DownloadFile([string]$Url, [string]$OutFile) {
    if (Test-Path $OutFile) { return }

    Write-Host "Baixando: $Url" -ForegroundColor Cyan
    Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing
}

function New-DirectoryIfMissing([string]$Path) {
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function Invoke-BuildJar([string]$ProjectDir) {
    Write-Host "Buildando JAR em $ProjectDir" -ForegroundColor Cyan
    Push-Location $ProjectDir
    try {
        $mvnw = Join-Path $ProjectDir 'mvnw.cmd'
        $wrapperProps = Join-Path $ProjectDir '.mvn\wrapper\maven-wrapper.properties'

        if ((Test-Path $mvnw) -and (Test-Path $wrapperProps)) {
            & $mvnw -q -DskipTests package
        } else {
            # Neste repo, o wrapper pode não estar completo (sem .mvn/wrapper).
            # Faz fallback para o Maven do sistema.
            & mvn -q -DskipTests package
        }
    } finally {
        Pop-Location
    }
}

function Copy-SingleJar([string]$TargetDir, [string]$JarGlob) {
    $jars = @(Get-ChildItem -Path $JarGlob -ErrorAction Stop | Where-Object { $_.Name -notlike '*.original' })
    if ($jars.Count -eq 0) {
        throw "Nenhum JAR encontrado em: $JarGlob"
    }

    # pega o primeiro (normalmente o correto)
    $jar = $jars | Select-Object -First 1
    New-DirectoryIfMissing $TargetDir

    $dest = Join-Path $TargetDir 'app.jar'
    Copy-Item -Force $jar.FullName $dest
    return $dest
}

function Write-WinSwConfig(
    [string]$ServiceDir,
    [string]$BaseName,
    [string]$DisplayName,
    [string]$Description,
    [string[]]$Arguments,
    [hashtable]$Env
) {
    $exePath = Join-Path $ServiceDir ("$BaseName.exe")
    $xmlPath = Join-Path $ServiceDir ("$BaseName.xml")

    $argXml = ($Arguments | ForEach-Object { "<argument>$($_.Replace('&','&amp;').Replace('<','&lt;').Replace('>','&gt;'))</argument>" }) -join "`n    "

    $envXml = ''
    if ($Env) {
        $envLines = @()
        foreach ($k in $Env.Keys) {
            $v = [string]$Env[$k]
            if ($null -eq $v -or $v -eq '') { continue }
            $vEsc = $v.Replace('&','&amp;').Replace('<','&lt;').Replace('>','&gt;')
            $envLines += ('<env name="{0}" value="{1}"/>' -f $k, $vEsc)
        }
        if ($envLines.Count -gt 0) {
            $envXml = "`n  <env>\n    $($envLines -join "`n    ")\n  </env>"
        }
    }

    $content = @"
<service>
  <id>$BaseName</id>
  <name>$DisplayName</name>
  <description>$Description</description>

  <executable>java</executable>
  <arguments>
    $argXml
  </arguments>

  <log mode="roll-by-size">
    <directory>logs</directory>
    <sizeThreshold>10240</sizeThreshold>
    <keepFiles>8</keepFiles>
  </log>

  <onfailure action="restart" delay="5 sec"/>
  <onfailure action="restart" delay="15 sec"/>
  <onfailure action="restart" delay="30 sec"/>

  <stoptimeout>20 sec</stoptimeout>$envXml
</service>
"@

    Set-Content -Path $xmlPath -Value $content -Encoding UTF8

    # baixa e renomeia WinSW pro nome do serviço
    $winswUrl = 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe'
    $tmpExe = Join-Path $ServiceDir 'WinSW-x64.exe'
    Invoke-DownloadFile -Url $winswUrl -OutFile $tmpExe
    Copy-Item -Force $tmpExe $exePath

    return @{ Exe = $exePath; Xml = $xmlPath }
}

if (-not $GenerateOnly) {
    Test-RunningAsAdmin
}
Test-JavaAvailable

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $here '..\..')

. (Join-Path $here 'config.ps1')

$runtime = Join-Path $here '_runtime'
New-DirectoryIfMissing $runtime

# 1) Build JARs
$lcProject = Join-Path $repoRoot 'LunaCore\lunacore'
$taProject = Join-Path $repoRoot 'LunaTotem\TotemAPI'

if (-not $SkipBuild) {
    Invoke-BuildJar -ProjectDir $lcProject
    Invoke-BuildJar -ProjectDir $taProject
} else {
    Write-Host 'SkipBuild: usando JARs existentes em target/' -ForegroundColor Yellow
}

# 2) Copiar JARs para runtime
$lunaCoreSvcDir = Join-Path $runtime 'LunaCoreService'
$totemApiSvcDir = Join-Path $runtime 'TotemAPIService'
New-DirectoryIfMissing $lunaCoreSvcDir
New-DirectoryIfMissing $totemApiSvcDir
New-DirectoryIfMissing (Join-Path $lunaCoreSvcDir 'app')
New-DirectoryIfMissing (Join-Path $totemApiSvcDir 'app')
New-DirectoryIfMissing (Join-Path $lunaCoreSvcDir 'logs')
New-DirectoryIfMissing (Join-Path $totemApiSvcDir 'logs')

$lcJar = Copy-SingleJar -TargetDir (Join-Path $lunaCoreSvcDir 'app') -JarGlob (Join-Path $lcProject 'target\lunacore-*.jar')
$taJar = Copy-SingleJar -TargetDir (Join-Path $totemApiSvcDir 'app') -JarGlob (Join-Path $taProject 'target\totem-api-*.jar')

Write-Host "LunaCore JAR: $lcJar" -ForegroundColor Green
Write-Host "TotemAPI JAR: $taJar" -ForegroundColor Green

# 3) Gerar configs WinSW
$commonEnv = @{
    'JWT_SECRET' = $JwtSecret
    'SPRING_DATASOURCE_URL' = $SpringDatasourceUrl
    'SPRING_DATASOURCE_USERNAME' = $SpringDatasourceUsername
    'SPRING_DATASOURCE_PASSWORD' = $SpringDatasourcePassword
}

$lcEnv = $commonEnv.Clone()
$lcEnv['TOTEM_API_BASE_URL'] = $TotemApiBaseUrlFromCore
$lcEnv['SERVER_PORT'] = [string]$LunaCorePort

$taEnv = $commonEnv.Clone()
$taEnv['PORT'] = [string]$TotemApiPort
$taEnv['LUNAPAY_BASE_URL'] = $LunaPayBaseUrl

Write-WinSwConfig \
  -ServiceDir $lunaCoreSvcDir \
  -BaseName 'LunaCoreService' \
  -DisplayName 'LunaCore (Luna)' \
  -Description 'LunaCore backend (Spring Boot) - always-on' \
  -Arguments @('-Xms128m','-Xmx512m','-Dfile.encoding=UTF-8','-jar','app\\app.jar',"--server.port=$LunaCorePort") \
  -Env $lcEnv | Out-Null

Write-WinSwConfig \
  -ServiceDir $totemApiSvcDir \
  -BaseName 'TotemAPIService' \
  -DisplayName 'TotemAPI (Luna)' \
  -Description 'TotemAPI backend (Spring Boot) - always-on' \
  -Arguments @('-Xms128m','-Xmx512m','-Dfile.encoding=UTF-8','-jar','app\\app.jar') \
  -Env $taEnv | Out-Null

if ($GenerateOnly) {
    Write-Host 'OK. Runtime gerado (modo GenerateOnly). Nenhum serviço foi instalado.' -ForegroundColor Green
    Write-Host "Runtime: $runtime" -ForegroundColor Green
    Write-Host "LunaCore esperado: http://localhost:$LunaCorePort" -ForegroundColor Green
    Write-Host "TotemAPI esperado: http://localhost:$TotemApiPort" -ForegroundColor Green
    return
}

# 4) Instalar e iniciar serviços
Write-Host 'Instalando serviços...' -ForegroundColor Cyan
Push-Location $lunaCoreSvcDir
try { .\LunaCoreService.exe uninstall | Out-Null } catch { }
.\LunaCoreService.exe install
.\LunaCoreService.exe start
Pop-Location

Push-Location $totemApiSvcDir
try { .\TotemAPIService.exe uninstall | Out-Null } catch { }
.\TotemAPIService.exe install
.\TotemAPIService.exe start
Pop-Location

Write-Host 'OK. Serviços instalados e iniciados.' -ForegroundColor Green
Write-Host "LunaCore: http://localhost:$LunaCorePort" -ForegroundColor Green
Write-Host "TotemAPI: http://localhost:$TotemApiPort" -ForegroundColor Green

if ($VerifyHttp) {
    Write-Host 'Verificando /actuator/health...' -ForegroundColor Cyan
    foreach ($url in @(
        "http://localhost:$LunaCorePort/actuator/health",
        "http://localhost:$TotemApiPort/actuator/health"
    )) {
        try {
            $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
            Write-Host ("OK: {0} ({1})" -f $url, $resp.StatusCode) -ForegroundColor Green
        } catch {
            Write-Host ("Falhou: {0} - {1}" -f $url, $_.Exception.Message) -ForegroundColor Yellow
        }
    }
}
