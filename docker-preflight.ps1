#!/usr/bin/env pwsh
# Pre-flight Check - Verifica se o ambiente está pronto para Docker

$ErrorActionPreference = 'Continue'

Write-Host "`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       Sistema Luna - Docker Pre-flight Check          ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$checks = @()
$warnings = @()
$errors = @()

# 1. Check Docker
Write-Host "🐳 Checking Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        $checks += "✅ Docker installed: $dockerVersion"
    } else {
        $errors += "❌ Docker not found or not running"
    }
} catch {
    $errors += "❌ Docker not installed"
}

# 2. Check Docker Compose
Write-Host "🔧 Checking Docker Compose..." -ForegroundColor Yellow
try {
    $composeVersion = docker-compose --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        $checks += "✅ Docker Compose installed: $composeVersion"
    } else {
        $errors += "❌ Docker Compose not found"
    }
} catch {
    $errors += "❌ Docker Compose not installed"
}

# 3. Check Docker daemon
Write-Host "🔍 Checking Docker daemon..." -ForegroundColor Yellow
try {
    docker ps >$null 2>&1
    if ($LASTEXITCODE -eq 0) {
        $checks += "✅ Docker daemon is running"
    } else {
        $errors += "❌ Docker daemon is not running. Start Docker Desktop!"
    }
} catch {
    $errors += "❌ Cannot connect to Docker daemon"
}

# 4. Check .env file
Write-Host "📄 Checking .env file..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $checks += "✅ .env file exists"
    
    # Check required variables
    $envContent = Get-Content ".env" -Raw
    $requiredVars = @(
        'SPRING_DATASOURCE_URL',
        'SPRING_DATASOURCE_USERNAME',
        'SPRING_DATASOURCE_PASSWORD',
        'WEBHOOK_GHL_TOKEN',
        'JWT_SECRET'
    )
    
    foreach ($var in $requiredVars) {
        if ($envContent -match "^$var=.+$") {
            $checks += "  ✅ $var is set"
        } else {
            $warnings += "  ⚠️  $var is not set or empty"
        }
    }
} else {
    $errors += "❌ .env file not found! Copy from .env.example"
}

# 5. Check docker-compose.yml
Write-Host "📝 Checking docker-compose.yml..." -ForegroundColor Yellow
if (Test-Path "docker-compose.yml") {
    $checks += "✅ docker-compose.yml exists"
    
    try {
        docker-compose config >$null 2>&1
        if ($LASTEXITCODE -eq 0) {
            $checks += "✅ docker-compose.yml is valid"
        } else {
            $warnings += "⚠️  docker-compose.yml has syntax issues"
        }
    } catch {
        $warnings += "⚠️  Cannot validate docker-compose.yml"
    }
} else {
    $errors += "❌ docker-compose.yml not found!"
}

# 6. Check available ports
Write-Host "🔌 Checking ports..." -ForegroundColor Yellow
$ports = @(8080, 8081, 8082, 3000)
foreach ($port in $ports) {
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue -InformationLevel Quiet
        if ($connection) {
            $warnings += "⚠️  Port $port is already in use"
        } else {
            $checks += "  ✅ Port $port is available"
        }
    } catch {
        $checks += "  ✅ Port $port is available"
    }
}

# 7. Check disk space
Write-Host "💾 Checking disk space..." -ForegroundColor Yellow
try {
    $drive = (Get-Location).Drive
    $freeSpace = [math]::Round($drive.Free / 1GB, 2)
    if ($freeSpace -gt 10) {
        $checks += "✅ Disk space: ${freeSpace}GB available"
    } elseif ($freeSpace -gt 5) {
        $warnings += "⚠️  Disk space: ${freeSpace}GB (low)"
    } else {
        $errors += "❌ Disk space: ${freeSpace}GB (insufficient - need 10GB+)"
    }
} catch {
    $warnings += "⚠️  Cannot check disk space"
}

# 8. Check memory
Write-Host "🧠 Checking available memory..." -ForegroundColor Yellow
try {
    $mem = Get-CimInstance Win32_OperatingSystem
    $freeMemGB = [math]::Round($mem.FreePhysicalMemory / 1MB, 2)
    if ($freeMemGB -gt 4) {
        $checks += "✅ Available RAM: ${freeMemGB}GB"
    } elseif ($freeMemGB -gt 2) {
        $warnings += "⚠️  Available RAM: ${freeMemGB}GB (low)"
    } else {
        $errors += "❌ Available RAM: ${freeMemGB}GB (insufficient - need 4GB+)"
    }
} catch {
    $warnings += "⚠️  Cannot check memory"
}

# 9. Check existing containers
Write-Host "📦 Checking existing containers..." -ForegroundColor Yellow
try {
    $containers = docker ps -a --filter "name=lunacore|totemapi|lunapay|totemui" --format "{{.Names}}" 2>$null
    if ($containers) {
        $warnings += "⚠️  Found existing Luna containers (will be reused)"
        foreach ($container in $containers -split "`n") {
            $status = docker inspect --format='{{.State.Status}}' $container 2>$null
            $warnings += "    - $container ($status)"
        }
    } else {
        $checks += "✅ No existing Luna containers"
    }
} catch {
    $warnings += "⚠️  Cannot check existing containers"
}

# 10. Check network connectivity
Write-Host "🌐 Checking network..." -ForegroundColor Yellow
try {
    $ping = Test-Connection -ComputerName 8.8.8.8 -Count 1 -Quiet
    if ($ping) {
        $checks += "✅ Internet connection available"
    } else {
        $warnings += "⚠️  No internet connection (may fail to pull images)"
    }
} catch {
    $warnings += "⚠️  Cannot test internet connection"
}

# Results
Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "RESULTS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

if ($checks.Count -gt 0) {
    Write-Host "✅ PASSED CHECKS:`n" -ForegroundColor Green
    foreach ($check in $checks) {
        Write-Host $check -ForegroundColor Green
    }
    Write-Host ""
}

if ($warnings.Count -gt 0) {
    Write-Host "⚠️  WARNINGS:`n" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host $warning -ForegroundColor Yellow
    }
    Write-Host ""
}

if ($errors.Count -gt 0) {
    Write-Host "❌ ERRORS:`n" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host $error -ForegroundColor Red
    }
    Write-Host ""
}

# Final verdict
Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

if ($errors.Count -eq 0) {
    if ($warnings.Count -eq 0) {
        Write-Host "🎉 ALL CHECKS PASSED! You're ready to deploy!" -ForegroundColor Green
        Write-Host "`nNext steps:" -ForegroundColor Cyan
        Write-Host "  1. .\docker-build.ps1 build" -ForegroundColor Gray
        Write-Host "  2. .\docker-build.ps1 start" -ForegroundColor Gray
        Write-Host "  3. .\docker-build.ps1 test-ghl" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  READY WITH WARNINGS - You can proceed but review warnings above" -ForegroundColor Yellow
        Write-Host "`nProceed with:" -ForegroundColor Cyan
        Write-Host "  .\docker-build.ps1 build" -ForegroundColor Gray
    }
    exit 0
} else {
    Write-Host "❌ NOT READY - Fix errors above before deploying!" -ForegroundColor Red
    Write-Host "`nCommon fixes:" -ForegroundColor Cyan
    Write-Host "  - Start Docker Desktop" -ForegroundColor Gray
    Write-Host "  - Copy .env.example to .env and fill credentials" -ForegroundColor Gray
    Write-Host "  - Free up disk space or memory" -ForegroundColor Gray
    Write-Host "  - Stop services using ports 8080-8082, 3000" -ForegroundColor Gray
    exit 1
}
