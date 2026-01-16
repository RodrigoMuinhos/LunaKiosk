# 🔧 Solução: Erro "JWT não autorizado" no Totem

## ❌ Problema

Ao abrir o totem (TotemUI), aparece erro "JWT não autorizado" antes de conseguir usar o sistema.

## ✅ Solução Implementada

### 1. **Usuário de Serviço Criado**

Foi criado um usuário especial para o totem fazer login automático:

```
📧 Email:    totem@lunavita.com.br
🔑 Password: totem123
👤 Role:     RECEPCAO
🗄️  Tabela:  luna.totem_users
```

### 2. **Auto-Login Configurado**

O TotemUI já está programado para fazer login automático com essas credenciais.

**Arquivo**: `TotemUI/src/app/page.tsx`

O sistema:
1. Verifica se existe token JWT válido no localStorage
2. Se não existir, faz login automático com `totem@lunavita.com.br`
3. Salva o token e permite uso do sistema

### 3. **Como Testar**

#### Passo 1: Limpar cache (se necessário)
```javascript
// No console do browser (F12):
localStorage.clear();
location.reload();
```

#### Passo 2: Abrir TotemUI
```
http://localhost:3000
```

#### Passo 3: Verificar logs
Abra DevTools (F12) e procure por:
```
[TOTEM AUTO-LOGIN] Iniciando login automático...
[TOTEM AUTO-LOGIN] ✅ Login automático realizado com sucesso
```

## 🔍 Troubleshooting

### Erro persiste após limpar cache?

#### 1. Verificar se LunaCore está rodando
```powershell
curl http://localhost:8080/actuator/health
```

**Deve retornar**: `{"status":"UP"}`

Se não estiver rodando:
```powershell
cd C:\Users\RODRIGO\Desktop\OrquestradorLuna\projeto-Luna.code-workspace\LunaCore\lunacore
mvn spring-boot:run
```

#### 2. Verificar se usuário existe no banco
```powershell
cd C:\Users\RODRIGO\Desktop\OrquestradorLuna\scripts-nodejs
node criar-usuario-totem-simples.js
```

#### 3. Verificar se TotemAPI está rodando
```powershell
curl http://localhost:8081/actuator/health
```

#### 4. Testar login manualmente
```powershell
$headers = @{
    'Content-Type' = 'application/json'
}

$body = @{
    email = 'totem@lunavita.com.br'
    password = 'totem123'
} | ConvertTo-Json

$response = Invoke-RestMethod `
    -Uri 'http://localhost:8080/api/auth/login' `
    -Method POST `
    -Headers $headers `
    -Body $body

Write-Host "Token: $($response.accessToken)"
```

**Resultado esperado**:
```json
{
  "accessToken": "eyJhbGc...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "role": "RECEPCAO",
  "userId": "..."
}
```

### Erro 401 no login manual?

**Possível causa**: Senha incorreta no banco

**Solução**: Recriar usuário
```powershell
cd C:\Users\RODRIGO\Desktop\OrquestradorLuna\scripts-nodejs
node criar-usuario-totem-simples.js
```

### Auto-login não executa?

**Verificar variáveis de ambiente** em `TotemUI/.env.local`:
```env
NEXT_PUBLIC_TOTEM_EMAIL=totem@lunavita.com.br
NEXT_PUBLIC_TOTEM_PASSWORD=totem123
```

Se não existir, criar o arquivo.

### Login funciona mas perde após recarregar?

**Causa**: localStorage não está persistindo o token

**Solução**:
1. Verificar se TotemUI está rodando em `http://localhost:3000` (não HTTPS)
2. Limpar cookies e cache do browser
3. Desabilitar extensões do browser que bloqueiam localStorage

## 📊 Estrutura de Autenticação

```
┌─────────────────────────────────────────┐
│  TotemUI (Frontend)                     │
│  http://localhost:3000                  │
│                                         │
│  1. Verifica localStorage['lv_token']  │
│  2. Se vazio → Auto-login               │
│  3. authAPI.login(totem@luna, totem123) │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  LunaCore (Auth Gateway)                │
│  http://localhost:8080/api/auth/login   │
│                                         │
│  1. Valida credenciais                  │
│  2. Consulta luna.totem_users           │
│  3. Gera JWT token                      │
│  4. Retorna accessToken                 │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Neon PostgreSQL                        │
│  Database: neondb                       │
│  Schema: luna                           │
│  Table: totem_users                     │
│                                         │
│  • email: totem@lunavita.com.br         │
│  • password_hash: $2b$10$...            │
│  • role: RECEPCAO                       │
└─────────────────────────────────────────┘
```

## 🎯 Verificação Final

Execute este checklist completo:

```powershell
# 1. Verificar LunaCore
Write-Host "1. LunaCore Health:" -ForegroundColor Yellow
curl http://localhost:8080/actuator/health

# 2. Verificar TotemAPI
Write-Host "`n2. TotemAPI Health:" -ForegroundColor Yellow
curl http://localhost:8081/actuator/health

# 3. Verificar usuário no banco
Write-Host "`n3. Verificando usuário totem..." -ForegroundColor Yellow
cd C:\Users\RODRIGO\Desktop\OrquestradorLuna\scripts-nodejs
node criar-usuario-totem-simples.js

# 4. Testar login
Write-Host "`n4. Testando login..." -ForegroundColor Yellow
$headers = @{ 'Content-Type' = 'application/json' }
$body = @{ email = 'totem@lunavita.com.br'; password = 'totem123' } | ConvertTo-Json
try {
    $response = Invoke-RestMethod -Uri 'http://localhost:8080/api/auth/login' -Method POST -Headers $headers -Body $body
    Write-Host "✅ Login OK! Token: $($response.accessToken.Substring(0,20))..." -ForegroundColor Green
} catch {
    Write-Host "❌ Login falhou: $_" -ForegroundColor Red
}

# 5. Abrir TotemUI
Write-Host "`n5. Abrindo TotemUI..." -ForegroundColor Yellow
Start-Process "http://localhost:3000"
Write-Host "✅ TotemUI aberto! Verifique o console (F12) para logs de auto-login" -ForegroundColor Green
```

## 📝 Notas Importantes

1. **Senha**: O usuário `totem@lunavita.com.br` tem senha `totem123`. Esta é uma senha de desenvolvimento. **Em produção, use uma senha forte e armazene em secret manager**.

2. **Role**: O usuário tem role `RECEPCAO`, que tem permissões limitadas (não pode acessar configurações administrativas).

3. **Token Expiration**: JWT tokens expiram após 1 hora. O auto-login renova automaticamente quando necessário.

4. **Múltiplos Terminais**: Se você abrir múltiplos navegadores/abas com o totem, todos compartilharão o mesmo token (via localStorage).

## 🚀 Próximos Passos

Após resolver o auto-login:

1. **Docker**: Empacotar tudo em containers
2. **Electron**: Criar versão desktop instalável
3. **Produção**: Configurar usuário totem em ambiente de produção

---

**✅ Problema resolvido! O totem agora faz login automaticamente.**

Se ainda houver problemas, execute o checklist de verificação acima e reporte qual etapa falhou.
