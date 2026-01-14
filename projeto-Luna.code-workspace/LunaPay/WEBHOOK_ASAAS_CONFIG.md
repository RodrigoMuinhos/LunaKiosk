# ⚙️ CONFIGURAÇÃO DO WEBHOOK ASAAS - LUNAPAY

## 📋 Variáveis de Ambiente

Adicione ao seu ambiente (PowerShell, .env, ou docker-compose):

```bash
# Token de autenticação do webhook (crie um token forte)
ASAAS_WEBHOOK_SECRET=seu-token-secreto-aqui-12345
```

**Exemplo de token forte**:
```bash
ASAAS_WEBHOOK_SECRET=luna_wh_2024_a7f3e9c1b5d8f2e4a6c9b1d3e5f7a9c1
```

---

## 🌐 PASSO 1: Configurar no Painel Asaas

1. **Acesse**: https://www.asaas.com/config/webhook
2. **Clique**: "Adicionar Webhook"

### Configurações:

| Campo | Valor |
|-------|-------|
| **URL do Webhook** | `https://seu-dominio.com/webhooks/asaas` |
| **Authentication Token** | `luna_wh_2024_a7f3e9c1b5d8f2e4a6c9b1d3e5f7a9c1` |
| **Nome do Header** | `asaas-access-token` |

### Eventos para Habilitar:

Marque os seguintes eventos (recomendado):

- ✅ **PAYMENT_CONFIRMED** - Pagamento confirmado (PIX/boleto compensado)
- ✅ **PAYMENT_RECEIVED** - Pagamento recebido
- ✅ **PAYMENT_OVERDUE** - Cobrança vencida
- ✅ **PAYMENT_DELETED** - Cobrança deletada/cancelada
- ✅ **PAYMENT_REFUNDED** - Pagamento estornado

**Opcional** (para debugging):
- ☐ **PAYMENT_CREATED** - Cobrança criada
- ☐ **PAYMENT_AWAITING_RISK_ANALYSIS** - Aguardando análise de risco

---

## 🧪 PASSO 2: Testar Localmente (ngrok)

Para testes locais antes de colocar em produção:

```powershell
# 1. Instale o ngrok: https://ngrok.com/download
# 2. Inicie o túnel
ngrok http 8082

# 3. Copie a URL gerada (ex: https://abc123.ngrok.io)
# 4. Configure no Asaas: https://abc123.ngrok.io/webhooks/asaas
```

---

## ✅ PASSO 3: Verificar Funcionamento

### 1. Criar Pagamento

```powershell
$payload = '{"amount":10.00,"description":"Teste Webhook","paymentMethod":"PIX","gateway":"asaas","customer":{"cpfCnpj":"04411750317","name":"Joao Silva","email":"joao@email.com"}}'
$response = Invoke-WebRequest -Uri "http://localhost:8082/payments" -Method Post -Headers @{Authorization="Bearer $env:AUTH_TOKEN"} -Body $payload -ContentType "application/json" -UseBasicParsing
$payment = $response.Content | ConvertFrom-Json
Write-Host "Pagamento criado: $($payment.id) - Status: $($payment.status)"
```

### 2. Simular Webhook (Sandbox)

No painel Asaas, vá em **Webhooks → Logs** e clique em "Reenviar" para testar.

### 3. Ver Logs no Backend

```powershell
# Logs do webhook devem aparecer assim:
# INFO  Webhook Asaas recebido: event=PAYMENT_CONFIRMED, asaasPaymentId=pay_xxx
# INFO  Pagamento atualizado: id=xxx, tenantId=xxx, PENDING -> PAID
```

### 4. Consultar Status Atualizado

```powershell
Invoke-WebRequest -Uri "http://localhost:8082/payments/$($payment.id)/status" -Headers @{Authorization="Bearer $env:AUTH_TOKEN"} -UseBasicParsing
```

---

## 🔒 Segurança

### ✅ Implementado

- **Validação de token**: Webhook só é processado se `asaas-access-token` header bater com `ASAAS_WEBHOOK_SECRET`
- **Logs de rejeição**: Tentativas com token inválido são logadas
- **Endpoint público**: `/webhooks/asaas` não requer JWT (Asaas não manda JWT)

### ⚠️ Recomendações

1. **Use HTTPS em produção** (obrigatório)
2. **Token forte**: Mínimo 32 caracteres aleatórios
3. **Monitore logs**: Verifique tentativas de acesso não autorizadas
4. **Rate limiting**: Configure firewall/nginx para limitar requisições

---

## 🐛 Troubleshooting

### Webhook não está chegando

1. **Verifique URL**: `https://seu-dominio.com/webhooks/asaas` deve estar acessível publicamente
2. **Verifique SSL**: Asaas requer HTTPS válido (não self-signed)
3. **Verifique logs Asaas**: Painel → Webhooks → Logs (mostra erros de envio)

### Webhook chegando mas sendo rejeitado (401)

```
WARN  Webhook Asaas REJEITADO (token inválido)
```

**Causa**: Token no header `asaas-access-token` diferente de `ASAAS_WEBHOOK_SECRET`

**Solução**: 
1. Verifique variável de ambiente: `echo $env:ASAAS_WEBHOOK_SECRET`
2. Verifique token no painel Asaas (deve ser idêntico)

### Pagamento não atualiza status

```
WARN  Pagamento local não encontrado para gatewayPaymentId=pay_xxx
```

**Causa**: `gatewayPaymentId` não foi salvo na criação do pagamento

**Solução**: Já implementado em `AsaasGateway.createPayment()` - campo `gatewayPaymentId` é preenchido automaticamente.

---

## 📊 Mapeamento de Eventos

| Evento Asaas | Status Local | Descrição |
|--------------|--------------|-----------|
| `PAYMENT_CREATED` | `PENDING` | Cobrança criada |
| `PAYMENT_AWAITING_RISK_ANALYSIS` | `PENDING` | Aguardando análise |
| `PAYMENT_APPROVED_BY_RISK_ANALYSIS` | `PENDING` | Aprovado |
| `PAYMENT_REPROVED_BY_RISK_ANALYSIS` | `FAILED` | Reprovado |
| `PAYMENT_CONFIRMED` | `PAID` | ✅ Confirmado |
| `PAYMENT_RECEIVED` | `PAID` | ✅ Recebido |
| `PAYMENT_OVERDUE` | `FAILED` | ❌ Vencido |
| `PAYMENT_DELETED` | `CANCELED` | ❌ Cancelado |
| `PAYMENT_REFUNDED` | `CANCELED` | ❌ Estornado |

---

## 🚀 Exemplo Completo (Produção)

```powershell
# 1. Definir variável de ambiente
$env:ASAAS_WEBHOOK_SECRET = "luna_wh_2024_a7f3e9c1b5d8f2e4a6c9b1d3e5f7a9c1"

# 2. Reiniciar LunaPay
cd C:\Users\RODRIGO\Desktop\OrquestradorLuna\projeto-Luna.code-workspace\LunaPay\lunapay-api
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=production

# 3. Configurar no Asaas (painel web)
# URL: https://api.lunavita.com.br/webhooks/asaas
# Token: luna_wh_2024_a7f3e9c1b5d8f2e4a6c9b1d3e5f7a9c1

# 4. Criar pagamento de teste
$payload = '{"amount":1.00,"description":"Teste Webhook Prod","paymentMethod":"PIX","gateway":"asaas","customer":{"cpfCnpj":"04411750317","name":"Teste","email":"teste@email.com"}}'
Invoke-WebRequest -Uri "https://api.lunavita.com.br/payments" -Method Post -Headers @{Authorization="Bearer $env:AUTH_TOKEN"} -Body $payload -ContentType "application/json"

# 5. Pagar o PIX e aguardar webhook automático
# Status será atualizado de PENDING -> PAID automaticamente
```

---

**Pronto para amanhã!** 🎉
