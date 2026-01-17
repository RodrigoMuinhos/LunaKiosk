# ========================================
# Bateria de Testes - Railway Deploy
# ========================================

Write-Host "`n╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   BATERIA DE TESTES - RAILWAY DEPLOY      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# URLs corretas do Railway (das screenshots)
$TOTEM_API_URL = "https://totemapi.up.railway.app"
$LUNACORE_URL = "https://lunacore.up.railway.app"
$LUNAPAY_URL = "https://lunapay.up.railway.app"

# Token JWT de exemplo (gerar via login primeiro)
$JWT_TOKEN = ""

# Webhook token (do Railway vars)
$WEBHOOK_TOKEN = "ln16012x26"

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$Body = $null
    )
    
    Write-Host "`n─────────────────────────────────────────" -ForegroundColor Gray
    Write-Host "🧪 TESTE: $Name" -ForegroundColor Yellow
    Write-Host "   Método: $Method" -ForegroundColor Gray
    Write-Host "   URL: $Url" -ForegroundColor Gray
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            TimeoutSec = 10
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.Body = $Body
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-WebRequest @params
        
        Write-Host "   ✅ Status: $($response.StatusCode)" -ForegroundColor Green
        
        # Parse JSON se possível
        try {
            $json = $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3
            Write-Host "   Resposta:" -ForegroundColor Gray
            Write-Host $json -ForegroundColor White
        } catch {
            Write-Host "   Resposta (raw):" -ForegroundColor Gray
            Write-Host $response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)) -ForegroundColor White
        }
        
        return @{ Success = $true; Status = $response.StatusCode }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   ❌ Status: $statusCode" -ForegroundColor Red
        Write-Host "   Erro: $($_.Exception.Message)" -ForegroundColor Red
        
        # Tentar ler corpo do erro
        try {
            $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            Write-Host "   Corpo do erro:" -ForegroundColor Red
            Write-Host $errorBody -ForegroundColor White
        } catch {}
        
        return @{ Success = $false; Status = $statusCode }
    }
}

# ========================================
# TESTE 1: Health Check
# ========================================
$result1 = Test-Endpoint `
    -Name "Health Check TotemAPI" `
    -Method "GET" `
    -Url "$TOTEM_API_URL/actuator/health"

# ========================================
# TESTE 2: Login (para obter JWT)
# ========================================
$loginBody = @{
    email = "adm@lunavita.com"
    password = "adm123"
} | ConvertTo-Json

$result2 = Test-Endpoint `
    -Name "Login TotemAPI" `
    -Method "POST" `
    -Url "$TOTEM_API_URL/api/auth/login" `
    -Body $loginBody

# Se login funcionou, extrair token
if ($result2.Success) {
    # TODO: Extrair token da resposta e usar nos próximos testes
}

# ========================================
# TESTE 3: Webhook GHL (sem autenticação JWT)
# ========================================
$webhookBody = @{
    contactId = "test-$(Get-Random)"
    eventType = "contact.created"
    name = "Teste Paciente Railway"
    email = "teste-railway@example.com"
    phone = "+5511999887766"
    cpf = "12345678901"
} | ConvertTo-Json

$webhookHeaders = @{
    "x-webhook-token" = $WEBHOOK_TOKEN
}

$result3 = Test-Endpoint `
    -Name "Webhook GHL - Criar Paciente" `
    -Method "POST" `
    -Url "$TOTEM_API_URL/api/webhooks/ghl/patients" `
    -Headers $webhookHeaders `
    -Body $webhookBody

# ========================================
# TESTE 4: Criar Usuário (requer JWT com role OWNER/ADMIN)
# ========================================
# Este teste só funciona se tivermos JWT válido do teste 2
Write-Host "`n⚠️  TESTE 4 (Criar Usuário) requer JWT - pule se não tiver login funcionando" -ForegroundColor Yellow

# ========================================
# TESTE 5: GET Patients (público ou sem auth?)
# ========================================
$result5 = Test-Endpoint `
    -Name "Listar Pacientes (sem auth)" `
    -Method "GET" `
    -Url "$TOTEM_API_URL/api/patients"

# ========================================
# RESUMO
# ========================================
Write-Host "`n╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║            RESUMO DOS TESTES               ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$tests = @(
    @{ Name = "Health Check"; Result = $result1 }
    @{ Name = "Login"; Result = $result2 }
    @{ Name = "Webhook GHL"; Result = $result3 }
    @{ Name = "GET Patients"; Result = $result5 }
)

foreach ($test in $tests) {
    $status = if ($test.Result.Success) { "✅ PASSOU" } else { "❌ FALHOU" }
    $color = if ($test.Result.Success) { "Green" } else { "Red" }
    Write-Host "  $($test.Name): $status (Status: $($test.Result.Status))" -ForegroundColor $color
}

Write-Host "`n════════════════════════════════════════════`n" -ForegroundColor Cyan
Write-Host "💡 Dica: Se todos os testes retornaram 404, verifique:" -ForegroundColor Yellow
Write-Host "   1. Se o deploy no Railway terminou com sucesso" -ForegroundColor White
Write-Host "   2. Se a URL está correta (veja Deployments > Settings > Domains)" -ForegroundColor White
Write-Host "   3. Se o serviço está 'Online' no painel do Railway" -ForegroundColor White
Write-Host "`n"
