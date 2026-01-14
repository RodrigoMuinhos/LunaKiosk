# 🔧 TODO: Integração Real dos Gateways

Este arquivo documenta o que precisa ser feito para substituir os STUBs por integrações reais.

---

## 📝 Checklist de Integração

### 1. **Asaas - Configuração**

#### Obter Credenciais
- [ ] Criar conta no Asaas (https://www.asaas.com)
- [ ] Obter API Key de produção ou sandbox
- [ ] Configurar webhook secret

#### Configurar Application.yml
```yaml
payment:
  gateways:
    config:
      asaas:
        enabled: true
        apiKey: ${ASAAS_API_KEY}
        baseUrl: https://api.asaas.com/v3  # ou sandbox
        webhookSecret: ${ASAAS_WEBHOOK_SECRET}
```

#### Implementar no AsaasGateway.java
- [ ] Adicionar dependência HTTP client (RestTemplate ou WebClient)
- [ ] Implementar `createPayment()` - POST /v3/payments
- [ ] Implementar `getPaymentStatus()` - GET /v3/payments/{id}
- [ ] Implementar `cancelPayment()` - DELETE /v3/payments/{id}
- [ ] Implementar validação de webhook (HMAC SHA256)
- [ ] Implementar processamento de webhook (mapear eventos)

#### Referências Asaas
- Documentação: https://docs.asaas.com
- Criar cobrança PIX: https://docs.asaas.com/reference/criar-nova-cobranca
- Webhooks: https://docs.asaas.com/docs/webhooks

---

### 2. **C6 Bank - Configuração**

#### Obter Credenciais
- [ ] Contatar C6 Bank para acesso à API
- [ ] Obter API Key e API Secret
- [ ] Configurar webhook secret
- [ ] Receber documentação da API

#### Configurar Application.yml
```yaml
payment:
  gateways:
    config:
      c6:
        enabled: true
        apiKey: ${C6_API_KEY}
        apiSecret: ${C6_API_SECRET}
        baseUrl: ${C6_BASE_URL}
        webhookSecret: ${C6_WEBHOOK_SECRET}
```

#### Implementar no C6Gateway.java
- [ ] Adicionar dependência HTTP client
- [ ] Implementar autenticação (verificar se usa OAuth2)
- [ ] Implementar `createPayment()`
- [ ] Implementar `getPaymentStatus()`
- [ ] Implementar `cancelPayment()`
- [ ] Implementar validação de webhook
- [ ] Implementar processamento de webhook

#### Referências C6
- Documentação: (solicitar ao C6)
- Certificados: verificar se precisa de certificado digital

---

### 3. **Dependências Maven**

Adicionar no `pom.xml`:

```xml
<!-- HTTP Client (escolher um) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-webflux</artifactId>
</dependency>

<!-- Ou usar RestTemplate (já incluído no spring-boot-starter-web) -->

<!-- Para processar JSON de webhooks -->
<dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
</dependency>
```

---

### 4. **Estrutura de Implementação Sugerida**

#### Criar Client HTTP genérico

```java
@Component
public class AsaasHttpClient {
    
    private final WebClient webClient;
    private final GatewayConfig gatewayConfig;

    public AsaasHttpClient(GatewayConfig config) {
        this.gatewayConfig = config;
        this.webClient = WebClient.builder()
            .baseUrl(config.getAsaas().getBaseUrl())
            .defaultHeader("access_token", config.getAsaas().getApiKey())
            .defaultHeader("Content-Type", "application/json")
            .build();
    }

    public Mono<AsaasPaymentResponse> createPayment(AsaasPaymentRequest request) {
        return webClient.post()
            .uri("/payments")
            .bodyValue(request)
            .retrieve()
            .bodyToMono(AsaasPaymentResponse.class);
    }
}
```

#### Criar DTOs específicos do gateway

```java
// AsaasPaymentRequest.java
// AsaasPaymentResponse.java
// AsaasWebhookPayload.java
```

---

### 5. **Mapeamento de Status**

Criar conversor entre status do gateway e PaymentStatus interno:

```java
public class AsaasStatusMapper {
    public static PaymentStatus map(String asaasStatus) {
        return switch (asaasStatus) {
            case "PENDING" -> PaymentStatus.PENDING;
            case "RECEIVED", "CONFIRMED" -> PaymentStatus.PAID;
            case "OVERDUE" -> PaymentStatus.FAILED;
            case "CANCELLED" -> PaymentStatus.CANCELED;
            default -> PaymentStatus.PENDING;
        };
    }
}
```

---

### 6. **Validação de Webhook**

#### Asaas (exemplo)
```java
private boolean validateAsaasWebhook(String signature, String payload) {
    String webhookSecret = gatewayConfig.getAsaas().getWebhookSecret();
    
    try {
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec secretKey = new SecretKeySpec(
            webhookSecret.getBytes(StandardCharsets.UTF_8), 
            "HmacSHA256"
        );
        mac.init(secretKey);
        
        byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        String calculatedSignature = Base64.getEncoder().encodeToString(hash);
        
        return calculatedSignature.equals(signature);
    } catch (Exception e) {
        log.error("Erro ao validar webhook", e);
        return false;
    }
}
```

---

### 7. **Processamento de Webhook**

Criar serviço para atualizar pagamentos:

```java
@Service
public class WebhookService {
    
    private final PaymentRepository paymentRepository;

    @Transactional
    public void updatePaymentStatus(String gatewayPaymentId, PaymentStatus newStatus) {
        Payment payment = paymentRepository
            .findByGatewayPaymentId(gatewayPaymentId)
            .orElseThrow(() -> new PaymentException("Pagamento não encontrado"));
        
        payment.setStatus(newStatus);
        paymentRepository.save(payment);
        
        log.info("Status do pagamento {} atualizado para {}", payment.getId(), newStatus);
    }
}
```

Adicionar no PaymentRepository:
```java
Optional<Payment> findByGatewayPaymentId(String gatewayPaymentId);
```

---

### 8. **Testes**

- [ ] Testar criação de PIX no Asaas sandbox
- [ ] Testar criação de Boleto no Asaas sandbox
- [ ] Simular webhook de confirmação Asaas
- [ ] Testar consulta de status
- [ ] Testar cancelamento
- [ ] Repetir para C6 quando disponível

---

### 9. **Monitoramento e Logs**

- [ ] Adicionar logs estruturados em todas operações de gateway
- [ ] Implementar métricas (opcional - Micrometer)
- [ ] Configurar alertas para falhas de gateway
- [ ] Salvar payload de webhooks em tabela de auditoria (opcional)

---

### 10. **Segurança**

- [ ] **NUNCA** commitar credenciais no código
- [ ] Usar variáveis de ambiente para API keys
- [ ] Validar TODAS as assinaturas de webhook
- [ ] Implementar rate limiting nos endpoints de webhook
- [ ] Adicionar retry logic para chamadas de gateway

---

## 🚀 Ordem Recomendada de Implementação

1. ✅ Estrutura completa já criada (FEITO)
2. Obter credenciais Asaas (sandbox)
3. Implementar AsaasHttpClient
4. Implementar createPayment() do Asaas - PIX
5. Testar criação de PIX
6. Implementar webhook Asaas
7. Testar fluxo completo (criar PIX → pagar → receber webhook)
8. Implementar outros métodos (boleto, cartão)
9. Repetir para C6 quando disponível

---

## 📞 Contatos

**Asaas**
- Site: https://www.asaas.com
- Suporte: suporte@asaas.com
- Documentação: https://docs.asaas.com

**C6 Bank**
- Contato comercial para API: (verificar site C6)

---

## 💡 Dicas

- Comece sempre pelo ambiente de **sandbox/homologação**
- Guarde os IDs de transação de teste para debugging
- Use ferramentas como Postman para testar as APIs dos gateways diretamente
- Configure webhooks locais usando ngrok: `ngrok http 8082`
- Leia toda a documentação do gateway antes de implementar
