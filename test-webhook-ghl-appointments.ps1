#!/usr/bin/env pwsh
# ====================================================================================
# TESTE COMPLETO: Webhook GHL de Consultas
# ====================================================================================
# Este script testa o novo endpoint POST /api/webhooks/ghl/appointments
# que cria paciente (se não existir) + consulta em uma única chamada
# ====================================================================================

$ErrorActionPreference = "Stop"
$baseUrl = "https://totemapi.up.railway.app"
$webhookToken = "ln16012x26"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   TESTE WEBHOOK GHL - CONSULTAS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ====================================================================================
# TESTE 1: Criar consulta COM médico (paciente existente)
# ====================================================================================
Write-Host "[TESTE 1] Criar consulta COM médico (paciente Rodrigo Muinhos já existe)..." -ForegroundColor Yellow

$body1 = @{
    cpf               = "04411750317"
    full_name         = "Rodrigo Muinhos"
    phone             = "(85) 99725-4989"
    email             = "rodrigo@luna.com"
    birth_date        = "1990-06-27"
    appointment_date  = "2026-01-20"
    appointment_time  = "14:00"
    appointment_type  = "Consulta"
    amount            = 150.00
    paid              = $false
    status            = "agendada"
    doctor_id         = "65289c24-ff0e-4aad-bc4e-a7a0e23e2c30"
    contact_id        = "ghl_teste_001"
    tenant_id         = "default"
} | ConvertTo-Json -Depth 10

try {
    $response1 = Invoke-RestMethod -Uri "$baseUrl/api/webhooks/ghl/appointments" `
        -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
            "x-webhook-token" = $webhookToken
        } `
        -Body $body1

    if ($response1.status -eq "success") {
        Write-Host "✅ SUCESSO!" -ForegroundColor Green
        Write-Host "   Patient ID: $($response1.patientId)" -ForegroundColor Gray
        Write-Host "   Appointment ID: $($response1.appointmentId)" -ForegroundColor Gray
        Write-Host "   Paciente criado? $($response1.patientCreated)" -ForegroundColor Gray
    } else {
        Write-Host "❌ FALHOU: $($response1.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ ERRO: $_" -ForegroundColor Red
    Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor DarkRed
}

Start-Sleep -Seconds 2

# ====================================================================================
# TESTE 2: Criar consulta SEM médico (paciente novo)
# ====================================================================================
Write-Host "`n[TESTE 2] Criar consulta SEM médico (paciente novo)..." -ForegroundColor Yellow

$body2 = @{
    cpf               = "12345678901"
    full_name         = "Maria Silva Teste"
    phone             = "(11) 98765-4321"
    email             = "maria@teste.com"
    birth_date        = "1985-03-15"
    appointment_date  = "2026-01-21"
    appointment_time  = "10:30"
    appointment_type  = "Primeira Consulta"
    amount            = 200.00
    paid              = $true
    status            = "confirmada"
    tenant_id         = "default"
} | ConvertTo-Json -Depth 10

try {
    $response2 = Invoke-RestMethod -Uri "$baseUrl/api/webhooks/ghl/appointments" `
        -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
            "x-webhook-token" = $webhookToken
        } `
        -Body $body2

    if ($response2.status -eq "success") {
        Write-Host "✅ SUCESSO!" -ForegroundColor Green
        Write-Host "   Patient ID: $($response2.patientId)" -ForegroundColor Gray
        Write-Host "   Appointment ID: $($response2.appointmentId)" -ForegroundColor Gray
        Write-Host "   Paciente criado? $($response2.patientCreated)" -ForegroundColor Gray
    } else {
        Write-Host "❌ FALHOU: $($response2.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ ERRO: $_" -ForegroundColor Red
    Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor DarkRed
}

Start-Sleep -Seconds 2

# ====================================================================================
# TESTE 3: Erro - CPF inválido
# ====================================================================================
Write-Host "`n[TESTE 3] Teste de validação - CPF inválido (deve falhar)..." -ForegroundColor Yellow

$body3 = @{
    cpf               = "123"
    full_name         = "João Teste"
    phone             = "(11) 91111-1111"
    appointment_date  = "2026-01-22"
    appointment_time  = "15:00"
    appointment_type  = "Consulta"
    tenant_id         = "default"
} | ConvertTo-Json -Depth 10

try {
    $response3 = Invoke-RestMethod -Uri "$baseUrl/api/webhooks/ghl/appointments" `
        -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
            "x-webhook-token" = $webhookToken
        } `
        -Body $body3

    Write-Host "❌ DEVERIA TER FALHADO mas retornou sucesso!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✅ VALIDAÇÃO CORRETA! Retornou 400 Bad Request" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro inesperado: $_" -ForegroundColor Red
    }
}

Start-Sleep -Seconds 2

# ====================================================================================
# TESTE 4: Erro - Token inválido
# ====================================================================================
Write-Host "`n[TESTE 4] Teste de segurança - Token inválido (deve falhar)..." -ForegroundColor Yellow

$body4 = @{
    cpf               = "11122233344"
    full_name         = "Pedro Teste"
    phone             = "(11) 92222-2222"
    appointment_date  = "2026-01-23"
    appointment_time  = "16:00"
    appointment_type  = "Consulta"
    tenant_id         = "default"
} | ConvertTo-Json -Depth 10

try {
    $response4 = Invoke-RestMethod -Uri "$baseUrl/api/webhooks/ghl/appointments" `
        -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
            "x-webhook-token" = "token_errado"
        } `
        -Body $body4

    Write-Host "❌ DEVERIA TER FALHADO mas retornou sucesso!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ SEGURANÇA OK! Retornou 401 Unauthorized" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro inesperado: $_" -ForegroundColor Red
    }
}

Start-Sleep -Seconds 2

# ====================================================================================
# TESTE 5: Erro - Data inválida
# ====================================================================================
Write-Host "`n[TESTE 5] Teste de validação - Data inválida (deve falhar)..." -ForegroundColor Yellow

$body5 = @{
    cpf               = "55566677788"
    full_name         = "Ana Teste"
    phone             = "(11) 93333-3333"
    appointment_date  = "31/01/2026"  # Formato errado (deve ser YYYY-MM-DD)
    appointment_time  = "17:00"
    appointment_type  = "Consulta"
    tenant_id         = "default"
} | ConvertTo-Json -Depth 10

try {
    $response5 = Invoke-RestMethod -Uri "$baseUrl/api/webhooks/ghl/appointments" `
        -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
            "x-webhook-token" = $webhookToken
        } `
        -Body $body5

    Write-Host "❌ DEVERIA TER FALHADO mas retornou sucesso!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✅ VALIDAÇÃO CORRETA! Retornou 400 Bad Request" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro inesperado: $_" -ForegroundColor Red
    }
}

# ====================================================================================
# SUMÁRIO
# ====================================================================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   TESTES FINALIZADOS!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Verifique no sistema LunaVita:" -ForegroundColor Yellow
Write-Host "1. Paciente 'Rodrigo Muinhos' deve ter nova consulta com Dr. Roberto" -ForegroundColor White
Write-Host "2. Novo paciente 'Maria Silva Teste' deve estar cadastrado com consulta" -ForegroundColor White
Write-Host "3. Validações de CPF, token e data devem ter bloqueado as tentativas" -ForegroundColor White
Write-Host ""
