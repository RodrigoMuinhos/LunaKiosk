# 🔗 Integração LunaTotem ↔ LunaPay

Guia completo de como o **LunaTotem** deve se comunicar com o **LunaPay** para processar pagamentos.

---

## 🎯 Fluxo Completo de Pagamento

### 1️⃣ **Totem faz login no LunaCore**

```bash
POST http://localhost:8080/auth/login
Content-Type: application/json

{
  "email": "usuario@clinica.com",
  "password": "senha123"
}
```

**Resposta:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "tenantId": "tenant-uuid",
    "modules": ["LUNATOTEM", "LUNAPAY"]
  }
}
```

> ⚠️ **Importante**: O tenant precisa ter o módulo `LUNAPAY` habilitado!

---

### 2️⃣ **Totem cria pagamento no LunaPay**

```bash
POST http://localhost:8082/payments
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "amount": 150.00,
  "description": "Consulta médica - Dr. João Silva",
  "gateway": "ASAAS",
  "paymentMethod": "PIX",
  "pixExpirationMinutes": 30,
  "customer": {
    "name": "Maria Santos",
    "email": "maria@email.com",
    "cpfCnpj": "12345678900",
    "phone": "11999999999"
  }
}
```

**Resposta (modo STUB atual):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "tenant-uuid",
  "amount": 150.00,
  "description": "Consulta médica - Dr. João Silva",
  "status": "PENDING",
  "gateway": "ASAAS",
  "gatewayPaymentId": "asaas_stub_abc123",
  "paymentMethod": "PIX",
  "pixQrCode": "00020126580014br.gov.bcb.pix0136abc123...",
  "pixCopyPaste": "00020126580014br.gov.bcb.pix0136abc123...",
  "pixQrCodeBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB...",
  "pixExpiresAt": "2025-12-07T16:30:00Z",
  "createdAt": "2025-12-07T16:00:00Z",
  "updatedAt": "2025-12-07T16:00:00Z"
}
```

---

### 3️⃣ **Totem exibe QR Code para o paciente**

```typescript
// Exemplo React/React Native
interface PaymentData {
  id: string;
  pixQrCode: string;
  pixCopyPaste: string;
  pixQrCodeBase64: string;
  pixExpiresAt: string;
  amount: number;
}

function PaymentScreen({ payment }: { payment: PaymentData }) {
  return (
    <div>
      <h2>Pagamento PIX - R$ {payment.amount.toFixed(2)}</h2>
      
      {/* QR Code */}
      <QRCode value={payment.pixQrCode} size={256} />
      
      {/* Pix Copia e Cola */}
      <button onClick={() => navigator.clipboard.writeText(payment.pixCopyPaste)}>
        Copiar código PIX
      </button>
      
      {/* Timer de expiração */}
      <CountdownTimer expiresAt={payment.pixExpiresAt} />
      
      {/* Status do pagamento */}
      <PaymentStatusMonitor paymentId={payment.id} />
    </div>
  );
}
```

---

### 4️⃣ **Totem monitora o status do pagamento**

Enquanto o QR Code está na tela, o Totem deve **consultar o status** periodicamente:

```bash
GET http://localhost:8082/payments/{id}/status
Authorization: Bearer {token}
```

**Resposta:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PENDING",
  "gatewayPaymentId": "asaas_stub_abc123"
}
```

#### Exemplo de Polling (TypeScript)

```typescript
async function monitorPaymentStatus(paymentId: string, token: string) {
  const maxAttempts = 60; // 5 minutos (60 x 5 segundos)
  let attempts = 0;

  const interval = setInterval(async () => {
    try {
      const response = await fetch(
        `http://localhost:8082/payments/${paymentId}/status`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (data.status === 'PAID') {
        clearInterval(interval);
        showSuccessScreen();
      } else if (data.status === 'FAILED' || data.status === 'CANCELED') {
        clearInterval(interval);
        showErrorScreen();
      }

      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        showTimeoutScreen();
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  }, 5000); // consulta a cada 5 segundos
}
```

---

### 5️⃣ **Quando o pagamento é confirmado**

Quando o webhook do gateway (Asaas/C6) notificar o LunaPay, o status muda para `PAID`:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PAID",
  "gatewayPaymentId": "asaas_stub_abc123"
}
```

O Totem então:
- ✅ Para o polling
- ✅ Exibe tela de sucesso
- ✅ Pode liberar o serviço/consulta
- ✅ Imprime comprovante (opcional)

---

## 📊 Estados do Pagamento

| Status | Descrição | O que o Totem deve fazer |
|--------|-----------|--------------------------|
| `PENDING` | Aguardando pagamento | Continuar monitorando |
| `PAID` | Pagamento confirmado | Mostrar sucesso e liberar serviço |
| `FAILED` | Falhou | Mostrar erro e oferecer nova tentativa |
| `CANCELED` | Cancelado pelo usuário | Voltar para tela inicial |

---

## 🔄 Fluxo Alternativo: Cancelar Pagamento

Se o paciente desistir ou o tempo expirar:

```bash
DELETE http://localhost:8082/payments/{id}
Authorization: Bearer {token}
```

**Resposta:** `204 No Content`

---

## 🎨 Interface Sugerida para o Totem

### Tela 1: Seleção de Serviço
```
┌────────────────────────────────┐
│  Selecione o serviço:          │
│                                │
│  ○ Consulta médica - R$ 150    │
│  ○ Exame de sangue - R$ 80     │
│  ○ Retorno - R$ 50             │
│                                │
│  [Continuar]                   │
└────────────────────────────────┘
```

### Tela 2: Pagamento PIX
```
┌────────────────────────────────┐
│  Pagamento PIX                 │
│  R$ 150,00                     │
│                                │
│  ┌──────────────────┐          │
│  │                  │          │
│  │   [QR CODE]      │          │
│  │                  │          │
│  └──────────────────┘          │
│                                │
│  [Copiar código PIX]           │
│                                │
│  ⏱ Expira em: 29:45            │
│                                │
│  🔄 Aguardando pagamento...    │
│                                │
│  [Cancelar]                    │
└────────────────────────────────┘
```

### Tela 3: Pagamento Confirmado
```
┌────────────────────────────────┐
│  ✅ Pagamento Confirmado!      │
│                                │
│  R$ 150,00                     │
│  Consulta médica               │
│                                │
│  ID: 550e8400-e29b-41d4        │
│                                │
│  [Imprimir Comprovante]        │
│  [Finalizar]                   │
└────────────────────────────────┘
```

---

## 🧪 Testando a Integração

### Passo 1: Iniciar os serviços

```bash
# Terminal 1 - LunaCore
cd lunacore-api
mvn spring-boot:run

# Terminal 2 - LunaPay
cd lunapay-api
mvn spring-boot:run

# Terminal 3 - LunaTotem
cd lunatotem-api
mvn spring-boot:run
```

### Passo 2: Testar com Postman/cURL

```bash
# 1. Login no Core
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123"}'

# Copiar o accessToken da resposta

# 2. Criar pagamento
curl -X POST http://localhost:8082/payments \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 150.00,
    "description": "Teste",
    "gateway": "ASAAS",
    "paymentMethod": "PIX"
  }'

# 3. Consultar status
curl http://localhost:8082/payments/{PAYMENT_ID}/status \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

---

## 🔧 Configuração no Totem

### Environment Variables (.env)

```bash
# LunaCore URL
LUNACORE_API_URL=http://localhost:8080

# LunaPay URL
LUNAPAY_API_URL=http://localhost:8082

# Polling config
PAYMENT_STATUS_POLL_INTERVAL=5000  # 5 segundos
PAYMENT_STATUS_MAX_ATTEMPTS=60     # 5 minutos total
```

### Serviço de Pagamento (exemplo TypeScript)

```typescript
// services/paymentService.ts
import axios from 'axios';

const lunapayApi = axios.create({
  baseURL: process.env.LUNAPAY_API_URL
});

export interface CreatePaymentRequest {
  amount: number;
  description: string;
  gateway: 'ASAAS' | 'C6';
  paymentMethod: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  customer?: {
    name: string;
    email: string;
    cpfCnpj: string;
    phone: string;
  };
}

export interface Payment {
  id: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED';
  amount: number;
  pixQrCode?: string;
  pixCopyPaste?: string;
  pixQrCodeBase64?: string;
  pixExpiresAt?: string;
}

export class PaymentService {
  constructor(private token: string) {
    lunapayApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  async createPayment(request: CreatePaymentRequest): Promise<Payment> {
    const { data } = await lunapayApi.post('/payments', request);
    return data;
  }

  async getPaymentStatus(paymentId: string): Promise<Payment> {
    const { data } = await lunapayApi.get(`/payments/${paymentId}/status`);
    return data;
  }

  async cancelPayment(paymentId: string): Promise<void> {
    await lunapayApi.delete(`/payments/${paymentId}`);
  }
}
```

---

## ⚠️ Tratamento de Erros

### Erro: Módulo LUNAPAY não habilitado

```json
{
  "status": 403,
  "error": "Forbidden",
  "message": "Módulo LUNAPAY não habilitado"
}
```

**Solução:** Verificar se o tenant tem o módulo LUNAPAY ativo no LunaCore.

### Erro: Gateway não habilitado

```json
{
  "status": 503,
  "error": "Gateway Not Enabled",
  "message": "Gateway não habilitado: ASAAS"
}
```

**Solução:** Configurar as credenciais do gateway no LunaPay.

### Erro: Token inválido ou expirado

```json
{
  "status": 401,
  "error": "Unauthorized"
}
```

**Solução:** Fazer novo login no LunaCore para obter novo token.

---

## 🚀 Próximos Passos

1. ✅ Implementar tela de pagamento no Totem
2. ✅ Adicionar polling de status
3. ✅ Testar fluxo completo
4. ⏳ Aguardar integração real com Asaas/C6
5. ⏳ Implementar impressão de comprovante

---

## 📞 Suporte

Em caso de dúvidas sobre a integração:
- Verifique os logs do LunaPay: `logs/lunapay.log`
- Verifique os logs do LunaCore: `logs/lunacore.log`
- Consulte: `API_EXAMPLES.md` para mais exemplos
