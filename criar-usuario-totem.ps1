#!/usr/bin/env pwsh
# Script para criar usuário de serviço do TOTEM no banco de dados

$ErrorActionPreference = 'Stop'

# Carregar variáveis do .env
$envFile = Join-Path $PSScriptRoot '..' '.env'
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $name = $matches[1]
            $value = $matches[2]
            [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        }
    }
}

# Obter connection string
$connString = $env:NEON_TOTEMAPI_URL
if (-not $connString) {
    Write-Host "❌ Variável NEON_TOTEMAPI_URL não encontrada no .env" -ForegroundColor Red
    exit 1
}

Write-Host "`n🔐 Criando usuário de serviço do TOTEM..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Parse connection string
if ($connString -match 'postgresql://([^:]+):([^@]+)@([^/]+)/([^\?]+)') {
    $user = $matches[1]
    $password = $matches[2]
    $host = $matches[3]
    $database = $matches[4]
    
    Write-Host "📍 Servidor: $host" -ForegroundColor Gray
    Write-Host "🗄️  Database: $database" -ForegroundColor Gray
    Write-Host ""
}

# SQL para criar usuário
$sql = @"
-- Deletar usuário existente (se houver)
DELETE FROM luna.users WHERE email = 'totem@lunavita.com.br';

-- Criar usuário novo (senha: totem123)
INSERT INTO luna.users (
  id,
  email,
  name,
  cpf,
  password,
  role,
  tenant_id,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'totem@lunavita.com.br',
  'Usuário Totem',
  '00000000000',
  '\$2a\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'RECEPCAO',
  'default',
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  updated_at = NOW();

-- Verificar criação
SELECT 
  id,
  email,
  name,
  role,
  tenant_id,
  created_at
FROM luna.users 
WHERE email = 'totem@lunavita.com.br';
"@

# Salvar SQL em arquivo temporário
$tempSql = [System.IO.Path]::GetTempFileName() + ".sql"
$sql | Out-File -FilePath $tempSql -Encoding UTF8

try {
    # Executar com psql (se disponível)
    $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
    
    if ($psqlPath) {
        Write-Host "🚀 Executando SQL com psql..." -ForegroundColor Yellow
        $env:PGPASSWORD = $password
        psql -h $host -U $user -d $database -f $tempSql
        $env:PGPASSWORD = $null
    } else {
        # Fallback: usar Node.js
        Write-Host "🚀 psql não encontrado, usando Node.js..." -ForegroundColor Yellow
        
        $nodeScript = @"
const { Client } = require('pg');
const client = new Client({
  connectionString: '$connString',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    await client.connect();
    const result = await client.query(\`$($sql.Replace('"', '\"').Replace("'", "\'"))\`);
    console.log('✅ Usuário criado/atualizado:');
    if (result.rows && result.rows.length > 0) {
      console.log(JSON.stringify(result.rows[0], null, 2));
    }
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
"@
        
        $tempJs = [System.IO.Path]::GetTempFileName() + ".js"
        $nodeScript | Out-File -FilePath $tempJs -Encoding UTF8
        
        # Instalar pg se necessário
        $scriptsDir = Join-Path $PSScriptRoot '..' 'scripts-nodejs'
        if (Test-Path $scriptsDir) {
            Push-Location $scriptsDir
            if (-not (Test-Path node_modules\pg)) {
                npm install --no-save pg 2>$null | Out-Null
            }
            Pop-Location
        }
        
        node $tempJs
        Remove-Item $tempJs -Force
    }
    
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║           CREDENCIAIS DO TOTEM CONFIGURADAS           ║" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "📧 Email:    totem@lunavita.com.br" -ForegroundColor Cyan
    Write-Host "🔑 Password: totem123" -ForegroundColor Cyan
    Write-Host "👤 Role:     RECEPCAO" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "✅ O TotemUI agora deve fazer auto-login com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Para testar:" -ForegroundColor Yellow
    Write-Host "  1. Abrir TotemUI: http://localhost:3000" -ForegroundColor Gray
    Write-Host "  2. O auto-login deve acontecer automaticamente" -ForegroundColor Gray
    Write-Host "  3. Verificar console do browser (F12) para ver logs [TOTEM AUTO-LOGIN]" -ForegroundColor Gray
    Write-Host ""
    
} catch {
    Write-Host "❌ Erro ao executar SQL: $_" -ForegroundColor Red
    exit 1
} finally {
    if (Test-Path $tempSql) {
        Remove-Item $tempSql -Force
    }
}
