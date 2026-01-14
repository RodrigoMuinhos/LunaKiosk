# API LunaPay - Exemplos de Uso

## 🔑 Autenticação

Todas as requisições (exceto webhooks) exigem token JWT válido do LunaCore no header:

```bash
Authorization: Bearer {seu_token_jwt}
```

---

## 📋 Endpoints Disponíveis

### 1. **Health Check** (sem autenticação)

```bash
GET http://localhost:8082/actuator/health
```

### 2. **Ping** (teste de autenticação)

```bash
GET http://localhost:8082/payments/ping
Authorization: Bearer {token}
```

Resposta:
```
LunaPay OK para tenant {tenantId} (user: {userId})
```

---

## 💳 Criar Pagamento

### PIX

```bash
POST http://localhost:8082/payments
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount": 100.50,
  "description": "Pagamento de teste PIX",
  "gateway": "ASAAS",
  "paymentMethod": "PIX",
  "pixExpirationMinutes": 30,
  "customer": {
    "name": "João Silva",
    "email": "joao@example.com",
    "cpfCnpj": "12345678900",
    "phone": "11999999999"
  }
}
```

Resposta:
```json
{
  "id": "uuid-gerado",
  "tenantId": "tenant-123",
  "amount": 100.50,
  "description": "Pagamento de teste PIX",
  "status": "PENDING",
  "gateway": "ASAAS",
  "gatewayPaymentId": "asaas_stub_abc123",
  "paymentMethod": "PIX",
  "pixQrCode": "00020126580014br.gov.bcb.pix...",
  "pixCopyPaste": "00020126580014br.gov.bcb.pix...",
  "pixQrCodeBase64": "iVBORw0KGgoAAAANS...",
  "pixExpiresAt": "2025-12-07T15:30:00Z",
  "createdAt": "2025-12-07T15:00:00Z",
  "updatedAt": "2025-12-07T15:00:00Z"
}
```

### Boleto

```bash
POST http://localhost:8082/payments
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount": 250.00,
  "description": "Pagamento de teste Boleto",
  "gateway": "C6",
  "paymentMethod": "BOLETO",
  "customer": {
    "name": "Maria Santos",
    "email": "maria@example.com",
    "cpfCnpj": "98765432100",
    "phone": "11888888888"
  }
}
```

Resposta:
```json
{
  "id": "uuid-gerado",
  "tenantId": "tenant-123",
  "amount": 250.00,
  "description": "Pagamento de teste Boleto",
  "status": "PENDING",
  "gateway": "C6",
  "gatewayPaymentId": "c6_stub_xyz789",
  "paymentMethod": "BOLETO",
  "boletoBarCode": "33691.79001 01043.510047...",
  "boletoUrl": "https://api.c6bank.com.br/boleto/pdf/...",
  "boletoExpiresAt": "2025-12-10T23:59:59Z",
  "createdAt": "2025-12-07T15:00:00Z",
  "updatedAt": "2025-12-07T15:00:00Z"
}
```

### Cartão de Crédito

```bash
POST http://localhost:8082/payments
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount": 500.00,
  "description": "Compra de produto",
  "gateway": "ASAAS",
  "paymentMethod": "CREDIT_CARD",
  "cardData": {
    "holderName": "JOAO SILVA",
    "number": "4111111111111111",
    "expiryMonth": "12",
    "expiryYear": "2026",
    "cvv": "123"
  },
  "customer": {
    "name": "João Silva",
    "email": "joao@example.com",
    "cpfCnpj": "12345678900",
    "phone": "11999999999"
  }
}
```

---

## 📊 Listar Pagamentos do Tenant

```bash
GET http://localhost:8082/payments
Authorization: Bearer {token}
```

Resposta:
```json
[
  {
    "id": "uuid-1",
    "amount": 100.50,
    "description": "Pagamento PIX",
    "status": "PAID",
    "gateway": "ASAAS",
    "paymentMethod": "PIX",
    ...
  },
  {
    "id": "uuid-2",
    "amount": 250.00,
    "description": "Pagamento Boleto",
    "status": "PENDING",
    "gateway": "C6",
    "paymentMethod": "BOLETO",
    ...
  }
]
```

---

## 🔍 Buscar Pagamento Específico

```bash
GET http://localhost:8082/payments/{id}
Authorization: Bearer {token}
```

---

## ❌ Cancelar Pagamento

```bash
DELETE http://localhost:8082/payments/{id}
Authorization: Bearer {token}
```

Resposta: `204 No Content`

---

## 🔔 Webhooks (sem autenticação)

Os gateways enviarão notificações para:

- **Asaas**: `POST http://seu-dominio.com/webhooks/asaas`
- **C6**: `POST http://seu-dominio.com/webhooks/c6`

---

## 🚨 Status de Pagamento

- `PENDING` - Aguardando pagamento
- `PAID` - Pago com sucesso
- `FAILED` - Falhou
- `CANCELED` - Cancelado

---

## ⚙️ Gateways Suportados

| Gateway | Métodos Suportados |
|---------|-------------------|
| ASAAS   | PIX, BOLETO, CREDIT_CARD, DEBIT_CARD |
| C6      | PIX, BOLETO, CREDIT_CARD, DEBIT_CARD |

---

## 🔧 Configuração de Gateways

No `application.yml` ou variáveis de ambiente:

```yaml
payment:
  gateways:
    config:
      asaas:
        enabled: true
        apiKey: ${ASAAS_API_KEY}
        baseUrl: https://api.asaas.com/v3
        webhookSecret: ${ASAAS_WEBHOOK_SECRET}
      c6:
        enabled: true
        apiKey: ${C6_API_KEY}
        apiSecret: ${C6_API_SECRET}
        baseUrl: https://api.c6bank.com.br
        webhookSecret: ${C6_WEBHOOK_SECRET}
```

---

## ❗ Tratamento de Erros

### Gateway não habilitado

```json
{
  "status": 503,
  "error": "Gateway Not Enabled",
  "message": "Gateway não habilitado: ASAAS",
  "timestamp": "2025-12-07T15:00:00Z"
}
```

### Validação de campos

```json
{
  "status": 400,
  "error": "Validation Error",
  "errors": {
    "amount": "Valor é obrigatório",
    "gateway": "Gateway é obrigatório"
  },
  "timestamp": "2025-12-07T15:00:00Z"
}
```

### Erro no gateway

```json
{
  "status": 502,
  "error": "Gateway Error: ASAAS",
  "message": "Erro ao processar pagamento",
  "timestamp": "2025-12-07T15:00:00Z"
}
```
