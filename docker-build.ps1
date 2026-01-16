# Docker Build & Deploy - Sistema Luna
# Script para facilitar build, deploy e testes com webhook GHL

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('build', 'start', 'stop', 'restart', 'logs', 'test-ghl', 'clean', 'status', 'help')]
    [string]$Action = 'help'
)

$ErrorActionPreference = 'Stop'

function Show-Help {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  Docker Build & Deploy - Sistema Luna" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    Write-Host "Comandos disponíveis:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  build       " -ForegroundColor Green -NoNewline
    Write-Host "- Build todos os serviços (com cache)"
    Write-Host "  start       " -ForegroundColor Green -NoNewline
    Write-Host "- Iniciar todos os serviços"
    Write-Host "  stop        " -ForegroundColor Green -NoNewline
    Write-Host "- Parar todos os serviços"
    Write-Host "  restart     " -ForegroundColor Green -NoNewline
    Write-Host "- Reiniciar todos os serviços"
    Write-Host "  logs        " -ForegroundColor Green -NoNewline
    Write-Host "- Ver logs em tempo real"
    Write-Host "  test-ghl    " -ForegroundColor Green -NoNewline
    Write-Host "- Testar webhook GHL"
    Write-Host "  status      " -ForegroundColor Green -NoNewline
    Write-Host "- Ver status dos containers"
    Write-Host "  clean       " -ForegroundColor Green -NoNewline
    Write-Host "- Limpar tudo (cuidado!)"
    Write-Host "  help        " -ForegroundColor Green -NoNewline
    Write-Host "- Mostrar esta ajuda"
    Write-Host ""
    Write-Host "Exemplos:" -ForegroundColor Yellow
    Write-Host "  .\docker-build.ps1 build" -ForegroundColor Gray
    Write-Host "  .\docker-build.ps1 start" -ForegroundColor Gray
    Write-Host "  .\docker-build.ps1 test-ghl" -ForegroundColor Gray
    Write-Host ""
}

function Build-Services {
    Write-Host "`n🔨 Building all services..." -ForegroundColor Cyan
    docker-compose build
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Build completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Build failed!" -ForegroundColor Red
        exit 1
    }
}

function Start-Services {
    Write-Host "`n🚀 Starting all services..." -ForegroundColor Cyan
    docker-compose up -d
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Services started!" -ForegroundColor Green
        Write-Host "`nWaiting for services to be healthy..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
        Show-Status
    } else {
        Write-Host "❌ Failed to start services!" -ForegroundColor Red
        exit 1
    }
}

function Stop-Services {
    Write-Host "`n🛑 Stopping all services..." -ForegroundColor Cyan
    docker-compose down
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Services stopped!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to stop services!" -ForegroundColor Red
        exit 1
    }
}

function Restart-Services {
    Write-Host "`n🔄 Restarting all services..." -ForegroundColor Cyan
    docker-compose restart
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Services restarted!" -ForegroundColor Green
        Start-Sleep -Seconds 5
        Show-Status
    } else {
        Write-Host "❌ Failed to restart services!" -ForegroundColor Red
        exit 1
    }
}

function Show-Logs {
    Write-Host "`n📋 Showing logs (Ctrl+C to exit)..." -ForegroundColor Cyan
    docker-compose logs -f --tail=100
}

function Test-GhlWebhook {
    Write-Host "`n🧪 Testing GHL Webhook..." -ForegroundColor Cyan
    
    # Verificar se TotemAPI está rodando
    $status = docker ps --filter "name=totemapi" --filter "status=running" --format "{{.Names}}"
    
    if ($status -ne "totemapi") {
        Write-Host "❌ TotemAPI não está rodando!" -ForegroundColor Red
        Write-Host "Execute: .\docker-build.ps1 start" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "TotemAPI está rodando ✅" -ForegroundColor Green
    Write-Host "`nEnviando requisição de teste..." -ForegroundColor Yellow
    
    $headers = @{
        'Content-Type' = 'application/json'
        'x-webhook-token' = 'ln16012x26'
    }
    
    $timestamp = Get-Date -Format 'yyyyMMddHHmmss'
    $body = @{
        contact_id = "docker_test_$timestamp"
        event_type = 'contact.create'
        full_name = 'Teste Docker Webhook'
        cpf = '12345678900'
        phone = '11999999999'
        email = "teste_$timestamp@docker.local"
        notes = "Teste via docker-build.ps1 em $(Get-Date)"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod `
            -Uri 'http://localhost:8081/api/webhooks/ghl/patients' `
            -Method POST `
            -Headers $headers `
            -Body $body
        
        Write-Host "`n✅ Webhook test successful!" -ForegroundColor Green
        Write-Host "`nResponse:" -ForegroundColor Yellow
        $response | ConvertTo-Json -Depth 5 | Write-Host -ForegroundColor Cyan
        
        Write-Host "`nVerificando logs..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        docker-compose logs --tail=20 totemapi | Select-String "\[GHL\]" | Write-Host -ForegroundColor Gray
        
    } catch {
        Write-Host "`n❌ Webhook test failed!" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        
        Write-Host "`nLogs do TotemAPI:" -ForegroundColor Yellow
        docker-compose logs --tail=50 totemapi
        exit 1
    }
}

function Show-Status {
    Write-Host "`n📊 Container Status:" -ForegroundColor Cyan
    docker-compose ps
    
    Write-Host "`n🌐 Service URLs:" -ForegroundColor Cyan
    Write-Host "  LunaCore:  http://localhost:8080" -ForegroundColor Green
    Write-Host "  TotemAPI:  http://localhost:8081" -ForegroundColor Green
    Write-Host "  LunaPay:   http://localhost:8082" -ForegroundColor Green
    Write-Host "  TotemUI:   http://localhost:3000" -ForegroundColor Green
    
    Write-Host "`n🔗 Webhook GHL:" -ForegroundColor Cyan
    Write-Host "  URL:   http://localhost:8081/api/webhooks/ghl/patients" -ForegroundColor Green
    Write-Host "  Token: ln16012x26" -ForegroundColor Green
}

function Clean-Everything {
    Write-Host "`n⚠️  WARNING: This will remove all containers, volumes, and images!" -ForegroundColor Red
    $confirm = Read-Host "Are you sure? (yes/no)"
    
    if ($confirm -eq 'yes') {
        Write-Host "`n🧹 Cleaning everything..." -ForegroundColor Yellow
        docker-compose down -v --remove-orphans
        docker system prune -af --volumes
        Write-Host "✅ Cleanup complete!" -ForegroundColor Green
    } else {
        Write-Host "❌ Cleanup cancelled" -ForegroundColor Yellow
    }
}

# Main Script
switch ($Action) {
    'build' { Build-Services }
    'start' { Start-Services }
    'stop' { Stop-Services }
    'restart' { Restart-Services }
    'logs' { Show-Logs }
    'test-ghl' { Test-GhlWebhook }
    'status' { Show-Status }
    'clean' { Clean-Everything }
    'help' { Show-Help }
    default { Show-Help }
}
