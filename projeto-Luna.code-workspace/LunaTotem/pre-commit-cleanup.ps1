# Script para limpar dados sensíveis antes do commit
# Execute: .\pre-commit-cleanup.ps1

Write-Host "`n🧹 LIMPANDO DADOS SENSÍVEIS..." -ForegroundColor Cyan

$errorsFound = $false

# Função para verificar se arquivo existe e contém padrões sensíveis
function Check-SensitiveData {
    param($path, $patterns)
    
    if (Test-Path $path) {
        $content = Get-Content $path -Raw
        foreach ($pattern in $patterns) {
            if ($content -match $pattern) {
                Write-Host "  ❌ Encontrado padrão sensível em: $path" -ForegroundColor Red
                Write-Host "     Padrão: $pattern" -ForegroundColor Yellow
                $script:errorsFound = $true
            }
        }
    }
}

Write-Host "`n📁 Verificando arquivos .env..." -ForegroundColor Yellow

# Padrões sensíveis
$sensitivePatterns = @(
    'JWT_SECRET=(?!your_|xxxxx)',
    'TOTEM_ENCRYPTION_KEY=(?!your_|xxxxx)',
    'ASAAS_API_KEY=(?!your_|\$|xxxxx)',
    'RESEND_API_KEY=(?!your_|re_xxx)',
    'SPRING_DATASOURCE_PASSWORD=(?!your_|postgres)',
    'access_token=[a-zA-Z0-9]{20,}'
)

# Verificar arquivos .env
$envFiles = Get-ChildItem -Path . -Recurse -Filter ".env*" -File | Where-Object { $_.Name -notmatch ".example$" }

foreach ($file in $envFiles) {
    Write-Host "  🔍 Verificando: $($file.FullName)" -ForegroundColor Gray
    Check-SensitiveData -path $file.FullName -patterns $sensitivePatterns
}

Write-Host "`n📝 Verificando se .gitignore está completo..." -ForegroundColor Yellow

$gitignorePaths = @(
    "TotemAPI/.gitignore",
    "TotemUI/.gitignore"
)

foreach ($path in $gitignorePaths) {
    if (Test-Path $path) {
        $content = Get-Content $path -Raw
        if ($content -match "\.env" -and $content -match "\.env\.local") {
            Write-Host "  ✅ $path está OK" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $path está incompleto!" -ForegroundColor Red
            $errorsFound = $true
        }
    } else {
        Write-Host "  ❌ $path não encontrado!" -ForegroundColor Red
        $errorsFound = $true
    }
}

Write-Host "`n🔍 Verificando arquivos trackeados no Git..." -ForegroundColor Yellow

$trackedEnvFiles = git ls-files | Select-String "\.env$|\.env\.local$|\.env\.production$"

if ($trackedEnvFiles) {
    Write-Host "  ❌ ARQUIVOS .ENV TRACKEADOS NO GIT:" -ForegroundColor Red
    $trackedEnvFiles | ForEach-Object { Write-Host "     - $_" -ForegroundColor Yellow }
    Write-Host "`n  💡 Para remover do Git (mas manter localmente):" -ForegroundColor Cyan
    Write-Host "     git rm --cached <arquivo>" -ForegroundColor White
    $errorsFound = $true
} else {
    Write-Host "  ✅ Nenhum arquivo .env trackeado no Git" -ForegroundColor Green
}

Write-Host "`n📦 Verificando arquivos grandes..." -ForegroundColor Yellow

$largeFiles = Get-ChildItem -Path . -Recurse -File | Where-Object { 
    $_.Length -gt 10MB -and 
    $_.Extension -match '\.(jar|war|zip|tar|gz|log)$'
}

if ($largeFiles) {
    Write-Host "  ⚠️  Arquivos grandes encontrados:" -ForegroundColor Yellow
    $largeFiles | ForEach-Object { 
        $sizeMB = [math]::Round($_.Length / 1MB, 2)
        Write-Host "     - $($_.Name) ($sizeMB MB)" -ForegroundColor Gray
    }
} else {
    Write-Host "  ✅ Nenhum arquivo grande encontrado" -ForegroundColor Green
}

Write-Host "`n" + "="*60 -ForegroundColor Cyan

if ($errorsFound) {
    Write-Host "❌ ERROS ENCONTRADOS! Corrija antes de commitar." -ForegroundColor Red
    Write-Host "`n📋 Checklist:" -ForegroundColor Yellow
    Write-Host "  1. Remover dados sensíveis dos arquivos" -ForegroundColor White
    Write-Host "  2. Mover valores reais para .env.local" -ForegroundColor White
    Write-Host "  3. Verificar .gitignore" -ForegroundColor White
    Write-Host "  4. git rm --cached para arquivos sensíveis" -ForegroundColor White
    exit 1
} else {
    Write-Host "✅ TUDO LIMPO! Seguro para commit." -ForegroundColor Green
    Write-Host "`n📝 Próximos passos:" -ForegroundColor Cyan
    Write-Host "  git add ." -ForegroundColor White
    Write-Host "  git commit -m 'feat: prepara para deploy seguro'" -ForegroundColor White
    Write-Host "  git push origin main" -ForegroundColor White
    exit 0
}
