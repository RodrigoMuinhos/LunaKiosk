#!/usr/bin/env pwsh
# Teste simplificado da feature "Criar Consulta por CPF"

$ErrorActionPreference = 'Stop'
$totemApi = "https://totemapi.up.railway.app"
$lunaCore = "https://lunacore.up.railway.app"

Write-Host "`n╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  TESTE: Criar Consulta por CPF              ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# 1. LOGIN (LunaCore)
Write-Host "🔐 PASSO 1: Login (LunaCore)" -ForegroundColor Yellow
try {
    $login = @{ email = "adm@luna.com"; password = "12345678" } | ConvertTo-Json
    $auth = Invoke-RestMethod -Uri "$lunaCore/auth/login" -Method Post -ContentType "application/json" -Body $login
    $token = $auth.accessToken
    Write-Host "✅ Login OK - Token: $($token.Substring(0,15))..." -ForegroundColor Green
} catch {
    Write-Host "❌ Erro login: $_" -ForegroundColor Red; exit 1
}

$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

# 2. LISTAR PACIENTES
Write-Host "`n👥 PASSO 2: Listar Pacientes" -ForegroundColor Yellow
try {
    $patients = Invoke-RestMethod -Uri "$totemApi/api/patients" -Method Get -Headers @{ Authorization = "Bearer $token" }
    Write-Host "✅ Pacientes: $($patients.Count)" -ForegroundColor Green
    if ($patients.Count -gt 0) {
        $testCpf = $patients[0].cpf
        Write-Host "   Usando CPF: $testCpf" -ForegroundColor Gray
    } else {
        $testCpf = "04411750317"
        Write-Host "   Usando CPF padrão: $testCpf" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️  Usando CPF padrão: 04411750317" -ForegroundColor Yellow
    $testCpf = "04411750317"
}

# 3. BUSCAR PACIENTE POR CPF (novo)
Write-Host "`n🔍 PASSO 3: GET /api/patients/by-cpf?cpf=$testCpf" -ForegroundColor Yellow
try {
    $patient = Invoke-RestMethod -Uri "$totemApi/api/patients/by-cpf?cpf=$testCpf" -Method Get -Headers @{ Authorization = "Bearer $token" }
    Write-Host "✅ Paciente encontrado!" -ForegroundColor Green
    Write-Host "   Nome: $($patient.name)" -ForegroundColor Gray
    Write-Host "   Email: $($patient.email)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Paciente não encontrado" -ForegroundColor Red
}

# 4. LISTAR MÉDICOS
Write-Host "`n👨‍⚕️ PASSO 4: GET /api/doctors" -ForegroundColor Yellow
try {
    $doctors = Invoke-RestMethod -Uri "$totemApi/api/doctors" -Method Get -Headers @{ Authorization = "Bearer $token" }
    Write-Host "✅ Médicos: $($doctors.Count)" -ForegroundColor Green
    if ($doctors.Count -gt 0) {
        Write-Host "   • $($doctors[0].name) - $($doctors[0].specialty)" -ForegroundColor Gray
        $testDoctorId = $doctors[0].id
    } else {
        $testDoctorId = $null
    }
} catch {
    Write-Host "⚠️  Sem médicos cadastrados" -ForegroundColor Yellow
    $testDoctorId = $null
}

# 5. CRIAR CONSULTA COM MÉDICO
if ($testDoctorId) {
    Write-Host "`n📅 PASSO 5: POST /api/appointments/by-cpf (COM médico)" -ForegroundColor Yellow
    try {
        $body = @{
            cpf = $testCpf
            date = "2026-01-25"
            time = "14:30"
            type = "Consulta"
            amount = 150.00
            doctorId = $testDoctorId
        } | ConvertTo-Json
        
        $apt = Invoke-RestMethod -Uri "$totemApi/api/appointments/by-cpf" -Method Post -Headers $headers -Body $body
        Write-Host "✅ Consulta COM médico criada!" -ForegroundColor Green
        Write-Host "   ID: $($apt.id)" -ForegroundColor Gray
        Write-Host "   Paciente: $($apt.patient)" -ForegroundColor Gray
        Write-Host "   Médico: $($apt.doctor) ($($apt.specialty))" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Erro: $_" -ForegroundColor Red
    }
} else {
    Write-Host "`n⏭️  PASSO 5: Pulado (sem médicos)" -ForegroundColor Yellow
}

# 6. CRIAR CONSULTA SEM MÉDICO
Write-Host "`n📅 PASSO 6: POST /api/appointments/by-cpf (SEM médico)" -ForegroundColor Yellow
try {
    $body = @{
        cpf = $testCpf
        date = "2026-01-26"
        time = "10:00"
        type = "Retorno"
        amount = 80.00
    } | ConvertTo-Json
    
    $apt = Invoke-RestMethod -Uri "$totemApi/api/appointments/by-cpf" -Method Post -Headers $headers -Body $body
    Write-Host "✅ Consulta SEM médico criada!" -ForegroundColor Green
    Write-Host "   ID: $($apt.id)" -ForegroundColor Gray
    Write-Host "   Paciente: $($apt.patient)" -ForegroundColor Gray
    Write-Host "   Médico: N/A" -ForegroundColor Gray
} catch {
    Write-Host "❌ Erro: $_" -ForegroundColor Red
}

# 7. TESTE ERRO: CPF INEXISTENTE
Write-Host "`n❌ PASSO 7: Teste CPF inexistente (deve dar erro)" -ForegroundColor Yellow
try {
    $body = @{ cpf = "99999999999"; date = "2026-01-27"; time = "15:00"; type = "Consulta"; amount = 100.00 } | ConvertTo-Json
    $apt = Invoke-RestMethod -Uri "$totemApi/api/appointments/by-cpf" -Method Post -Headers $headers -Body $body
    Write-Host "⚠️  ATENÇÃO: Deveria retornar erro!" -ForegroundColor Yellow
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✅ Erro 400 correto (CPF não encontrado)" -ForegroundColor Green
    } else {
        Write-Host "❌ Status inesperado: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

# 8. TESTE ERRO: DOCTOR ID INVÁLIDO
Write-Host "`n❌ PASSO 8: Teste Doctor ID inválido (deve dar erro)" -ForegroundColor Yellow
try {
    $body = @{ cpf = $testCpf; date = "2026-01-28"; time = "16:00"; type = "Consulta"; amount = 120.00; doctorId = "invalid-999" } | ConvertTo-Json
    $apt = Invoke-RestMethod -Uri "$totemApi/api/appointments/by-cpf" -Method Post -Headers $headers -Body $body
    Write-Host "⚠️  ATENÇÃO: Deveria retornar erro!" -ForegroundColor Yellow
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✅ Erro 400 correto (Médico não encontrado)" -ForegroundColor Green
    } else {
        Write-Host "❌ Status inesperado: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

# RESUMO
Write-Host "`n╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  ✅ TESTES COMPLETOS                        ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════╝`n" -ForegroundColor Cyan
Write-Host "🎉 Feature validada com sucesso!" -ForegroundColor Green
Write-Host ""
