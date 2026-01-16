#!/usr/bin/env pwsh
# Health Check Script para Sistema Luna
# Verifica se todos os serviços estão respondendo corretamente

param(
    [switch]$Detailed,
    [switch]$Json,
    [int]$Timeout = 5
)

$ErrorActionPreference = 'Continue'

# Cores
$colors = @{
    OK = 'Green'
    ERROR = 'Red'
    WARN = 'Yellow'
    INFO = 'Cyan'
}

# Serviços para checar
$services = @(
    @{
        Name = 'LunaCore'
        Url = 'http://localhost:8080/actuator/health'
        Port = 8080
        Container = 'lunacore'
    },
    @{
        Name = 'TotemAPI'
        Url = 'http://localhost:8081/actuator/health'
        Port = 8081
        Container = 'totemapi'
    },
    @{
        Name = 'LunaPay'
        Url = 'http://localhost:8082/actuator/health'
        Port = 8082
        Container = 'lunapay'
    },
    @{
        Name = 'TotemUI'
        Url = 'http://localhost:3000'
        Port = 3000
        Container = 'totemui'
    }
)

function Test-ServiceHealth {
    param($Service)
    
    $result = @{
        Name = $Service.Name
        Status = 'UNKNOWN'
        ResponseTime = 0
        HttpStatus = 0
        ContainerStatus = 'NOT_FOUND'
        Error = $null
    }
    
    # Check container status
    try {
        $containerInfo = docker ps --filter "name=$($Service.Container)" --format "{{.Status}}" 2>$null
        if ($containerInfo) {
            $result.ContainerStatus = if ($containerInfo -match 'Up') { 'RUNNING' } else { 'STOPPED' }
        }
    } catch {
        $result.ContainerStatus = 'ERROR'
    }
    
    # Check HTTP endpoint
    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        
        $response = Invoke-WebRequest -Uri $Service.Url -TimeoutSec $Timeout -ErrorAction Stop
        
        $stopwatch.Stop()
        $result.ResponseTime = $stopwatch.ElapsedMilliseconds
        $result.HttpStatus = $response.StatusCode
        
        if ($response.StatusCode -eq 200) {
            # Try to parse JSON for detailed health
            try {
                $health = $response.Content | ConvertFrom-Json
                if ($health.status -eq 'UP' -or $Service.Name -eq 'TotemUI') {
                    $result.Status = 'OK'
                } else {
                    $result.Status = 'DEGRADED'
                }
            } catch {
                # TotemUI doesn't return JSON health
                $result.Status = 'OK'
            }
        } else {
            $result.Status = 'ERROR'
            $result.Error = "HTTP $($response.StatusCode)"
        }
        
    } catch {
        $result.Status = 'ERROR'
        $result.Error = $_.Exception.Message
        
        # Try to get more info from container logs if container is running
        if ($result.ContainerStatus -eq 'RUNNING') {
            try {
                $logs = docker logs --tail 5 $Service.Container 2>&1
                if ($logs -match 'error|exception|failed' -join '|') {
                    $result.Error += " (check logs)"
                }
            } catch {}
        }
    }
    
    return $result
}

function Show-Results {
    param($Results)
    
    Write-Host "`n╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor $colors.INFO
    Write-Host "║          Sistema Luna - Health Check Report               ║" -ForegroundColor $colors.INFO
    Write-Host "╚═══════════════════════════════════════════════════════════════╝`n" -ForegroundColor $colors.INFO
    
    $allOk = $true
    
    foreach ($result in $Results) {
        $statusColor = switch ($result.Status) {
            'OK' { $colors.OK }
            'ERROR' { $colors.ERROR; $allOk = $false }
            'DEGRADED' { $colors.WARN; $allOk = $false }
            default { $colors.WARN }
        }
        
        Write-Host "🔹 $($result.Name.PadRight(12))" -NoNewline
        Write-Host " Status: " -NoNewline
        Write-Host $result.Status.PadRight(10) -ForegroundColor $statusColor -NoNewline
        
        if ($result.ResponseTime -gt 0) {
            Write-Host " ⚡ $($result.ResponseTime)ms" -NoNewline
        }
        
        Write-Host ""
        
        if ($Detailed) {
            Write-Host "   Container: $($result.ContainerStatus)" -ForegroundColor Gray
            Write-Host "   HTTP Status: $($result.HttpStatus)" -ForegroundColor Gray
            if ($result.Error) {
                Write-Host "   Error: $($result.Error)" -ForegroundColor Red
            }
            Write-Host ""
        }
    }
    
    Write-Host "`n" -NoNewline
    if ($allOk) {
        Write-Host "✅ All services are healthy!" -ForegroundColor $colors.OK
    } else {
        Write-Host "⚠️  Some services have issues!" -ForegroundColor $colors.WARN
    }
    
    # Webhook status
    Write-Host "`n🔗 Webhook GHL:" -ForegroundColor $colors.INFO
    Write-Host "   URL: http://localhost:8081/api/webhooks/ghl/patients" -ForegroundColor Gray
    Write-Host "   Token: ln16012x26" -ForegroundColor Gray
    
    Write-Host ""
}

# Main
Write-Host "🏥 Checking service health..." -ForegroundColor $colors.INFO

$results = @()
foreach ($service in $services) {
    Write-Host "   Checking $($service.Name)..." -ForegroundColor Gray
    $result = Test-ServiceHealth -Service $service
    $results += $result
}

if ($Json) {
    $results | ConvertTo-Json -Depth 3
} else {
    Show-Results -Results $results
}

# Exit code
$errorCount = ($results | Where-Object { $_.Status -eq 'ERROR' }).Count
exit $errorCount
