# ==================================================
# LunaVita - Docker Maintenance Script
# ==================================================
# Script para manutenção e troubleshooting do Docker

param(
    [Parameter(Position=0)]
    [ValidateSet('check', 'fix', 'reset', 'backup', 'restore', 'inspect')]
    [string]$Action = 'check'
)

$ErrorActionPreference = "Stop"

function Write-Header {
    param([string]$Text)
    Write-Host "`n$('=' * 60)" -ForegroundColor Cyan
    Write-Host $Text -ForegroundColor Cyan
    Write-Host "$('=' * 60)`n" -ForegroundColor Cyan
}

function Check-DockerInstallation {
    Write-Host "🔍 Verificando instalação do Docker..." -ForegroundColor Yellow
    
    try {
        $dockerVersion = docker --version
        Write-Host "✅ Docker instalado: $dockerVersion" -ForegroundColor Green
    } catch {
        Write-Host "❌ Docker não encontrado! Instale o Docker Desktop." -ForegroundColor Red
        exit 1
    }
    
    try {
        $composeVersion = docker-compose --version
        Write-Host "✅ Docker Compose instalado: $composeVersion" -ForegroundColor Green
    } catch {
        Write-Host "❌ Docker Compose não encontrado!" -ForegroundColor Red
        exit 1
    }
}

function Check-DockerRunning {
    Write-Host "🔍 Verificando se Docker está rodando..." -ForegroundColor Yellow
    
    try {
        docker ps | Out-Null
        Write-Host "✅ Docker está rodando" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "❌ Docker não está rodando! Inicie o Docker Desktop." -ForegroundColor Red
        return $false
    }
}

function Check-DiskSpace {
    Write-Host "🔍 Verificando espaço em disco..." -ForegroundColor Yellow
    
    $systemInfo = docker system df
    Write-Host $systemInfo
    
    Write-Host "`n💡 Use './docker-maintenance.ps1 fix' para limpar espaço" -ForegroundColor Cyan
}

function Check-Containers {
    Write-Host "🔍 Verificando containers..." -ForegroundColor Yellow
    
    docker-compose ps
    
    $exitedContainers = docker ps -a --filter "status=exited" --format "{{.Names}}"
    if ($exitedContainers) {
        Write-Host "`n⚠️  Containers parados encontrados:" -ForegroundColor Yellow
        $exitedContainers | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    }
}

function Check-Networks {
    Write-Host "🔍 Verificando redes Docker..." -ForegroundColor Yellow
    
    $networks = docker network ls --filter "name=lunavita" --format "{{.Name}}"
    if ($networks) {
        Write-Host "✅ Rede lunavita-network encontrada" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Rede lunavita-network não encontrada" -ForegroundColor Yellow
    }
}

function Check-Volumes {
    Write-Host "🔍 Verificando volumes Docker..." -ForegroundColor Yellow
    
    $volumes = docker volume ls --filter "name=orquestradorluna" --format "{{.Name}}"
    if ($volumes) {
        Write-Host "✅ Volumes encontrados:" -ForegroundColor Green
        $volumes | ForEach-Object { 
            $size = docker volume inspect $_ --format '{{.Mountpoint}}'
            Write-Host "  - $_" -ForegroundColor Green
        }
    } else {
        Write-Host "ℹ️  Nenhum volume encontrado (será criado no primeiro start)" -ForegroundColor Cyan
    }
}

function Fix-DockerIssues {
    Write-Host "🔧 Iniciando correções automáticas..." -ForegroundColor Yellow
    
    Write-Host "`n1. Removendo containers parados..." -ForegroundColor Cyan
    docker container prune -f
    
    Write-Host "`n2. Removendo imagens não utilizadas..." -ForegroundColor Cyan
    docker image prune -f
    
    Write-Host "`n3. Removendo redes não utilizadas..." -ForegroundColor Cyan
    docker network prune -f
    
    Write-Host "`n4. Removendo build cache..." -ForegroundColor Cyan
    docker builder prune -f
    
    Write-Host "`n✅ Correções aplicadas!" -ForegroundColor Green
    Write-Host "💡 Espaço liberado. Execute 'docker system df' para verificar." -ForegroundColor Cyan
}

function Reset-Docker {
    Write-Host "⚠️  ATENÇÃO: Isso vai parar e remover todos os containers e volumes!" -ForegroundColor Red
    Write-Host "⚠️  Seus dados serão perdidos!" -ForegroundColor Red
    $confirm = Read-Host "`nTem certeza? Digite 'RESET' para confirmar"
    
    if ($confirm -ne 'RESET') {
        Write-Host "Operação cancelada." -ForegroundColor Yellow
        return
    }
    
    Write-Host "`n🗑️  Parando e removendo tudo..." -ForegroundColor Yellow
    docker-compose down -v
    
    Write-Host "🧹 Limpando sistema..." -ForegroundColor Yellow
    docker system prune -af --volumes
    
    Write-Host "`n✅ Reset completo!" -ForegroundColor Green
    Write-Host "Execute './docker.ps1 start' para recriar tudo." -ForegroundColor Cyan
}

function Backup-Volumes {
    Write-Host "💾 Criando backup dos volumes..." -ForegroundColor Yellow
    
    $backupDir = ".\docker-backups\$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    
    $volumes = @('lunacore-logs', 'lunapay-logs', 'totemapi-logs', 'totemapi-uploads')
    
    foreach ($volume in $volumes) {
        $fullName = "orquestradorluna_$volume"
        Write-Host "  Backing up $fullName..." -ForegroundColor Cyan
        
        try {
            docker run --rm -v "${fullName}:/data" -v "${PWD}/${backupDir}:/backup" alpine tar czf "/backup/${volume}.tar.gz" -C /data .
            Write-Host "  ✅ $volume backed up" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠️  $volume não encontrado ou vazio" -ForegroundColor Yellow
        }
    }
    
    Write-Host "`n✅ Backup completo em: $backupDir" -ForegroundColor Green
}

function Restore-Volumes {
    $backups = Get-ChildItem -Path ".\docker-backups" -Directory | Sort-Object Name -Descending
    
    if (-not $backups) {
        Write-Host "❌ Nenhum backup encontrado!" -ForegroundColor Red
        return
    }
    
    Write-Host "📦 Backups disponíveis:" -ForegroundColor Cyan
    $backups | ForEach-Object -Begin { $i = 1 } -Process {
        Write-Host "  $i. $($_.Name)"
        $i++
    }
    
    $choice = Read-Host "`nEscolha o número do backup para restaurar"
    $backupDir = $backups[$choice - 1].FullName
    
    Write-Host "`n⚠️  Isso vai sobrescrever os volumes atuais!" -ForegroundColor Yellow
    $confirm = Read-Host "Confirma? (yes/no)"
    
    if ($confirm -ne 'yes') {
        Write-Host "Operação cancelada." -ForegroundColor Yellow
        return
    }
    
    Write-Host "`n📥 Restaurando volumes..." -ForegroundColor Yellow
    
    $volumes = Get-ChildItem -Path $backupDir -Filter "*.tar.gz"
    
    foreach ($archive in $volumes) {
        $volumeName = "orquestradorluna_$($archive.BaseName)"
        Write-Host "  Restoring $volumeName..." -ForegroundColor Cyan
        
        docker run --rm -v "${volumeName}:/data" -v "${backupDir}:/backup" alpine sh -c "cd /data && tar xzf /backup/$($archive.Name)"
        Write-Host "  ✅ $volumeName restaurado" -ForegroundColor Green
    }
    
    Write-Host "`n✅ Restore completo!" -ForegroundColor Green
}

function Inspect-Service {
    Write-Host "🔍 Selecione o serviço para inspecionar:" -ForegroundColor Cyan
    Write-Host "  1. lunacore"
    Write-Host "  2. totemapi"
    Write-Host "  3. lunapay"
    Write-Host "  4. totemui"
    
    $choice = Read-Host "`nEscolha (1-4)"
    
    $services = @('lunacore', 'totemapi', 'lunapay', 'totemui')
    $service = $services[$choice - 1]
    
    Write-Host "`n🔍 Inspecionando $service..." -ForegroundColor Yellow
    
    Write-Host "`n--- Status do Container ---" -ForegroundColor Cyan
    docker inspect $service | ConvertFrom-Json | Select-Object -ExpandProperty State
    
    Write-Host "`n--- Portas ---" -ForegroundColor Cyan
    docker port $service
    
    Write-Host "`n--- Variáveis de Ambiente ---" -ForegroundColor Cyan
    docker exec $service env | Select-String -Pattern "SPRING|JWT|NEON|ASAAS|NODE"
    
    Write-Host "`n--- Últimos 50 logs ---" -ForegroundColor Cyan
    docker logs --tail 50 $service
}

# ==================================================
# Main Script
# ==================================================

Write-Header "🛠️  LunaVita - Docker Maintenance"

switch ($Action) {
    'check' {
        Check-DockerInstallation
        if (Check-DockerRunning) {
            Check-Containers
            Check-Networks
            Check-Volumes
            Check-DiskSpace
        }
    }
    
    'fix' {
        if (Check-DockerRunning) {
            Fix-DockerIssues
        }
    }
    
    'reset' {
        if (Check-DockerRunning) {
            Reset-Docker
        }
    }
    
    'backup' {
        if (Check-DockerRunning) {
            Backup-Volumes
        }
    }
    
    'restore' {
        if (Check-DockerRunning) {
            Restore-Volumes
        }
    }
    
    'inspect' {
        if (Check-DockerRunning) {
            Inspect-Service
        }
    }
}

Write-Host "`n$('=' * 60)" -ForegroundColor Cyan
Write-Host "Comandos disponíveis:" -ForegroundColor White
Write-Host "  ./docker-maintenance.ps1 check   - Verificar tudo"
Write-Host "  ./docker-maintenance.ps1 fix     - Corrigir problemas e limpar espaço"
Write-Host "  ./docker-maintenance.ps1 reset   - Reset completo (⚠️ apaga tudo)"
Write-Host "  ./docker-maintenance.ps1 backup  - Backup dos volumes"
Write-Host "  ./docker-maintenance.ps1 restore - Restaurar backup"
Write-Host "  ./docker-maintenance.ps1 inspect - Inspecionar serviço"
Write-Host "$('=' * 60)`n" -ForegroundColor Cyan
