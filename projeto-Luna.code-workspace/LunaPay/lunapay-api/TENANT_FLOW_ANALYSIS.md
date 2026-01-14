# 📊 Análise de Fluxo Multi-Tenant - LunaPay

## ✅ Status Atual: **IMPLEMENTADO E FUNCIONAL**

---

## 🔐 1. Autenticação e Extração do TenantId

### **Fluxo de Entrada:**
```
1. Request HTTP → Authorization: Bearer <JWT_TOKEN>
2. JwtAuthenticationFilter (intercepta TODAS as requisições)
3. JwtUtil.getTenantId(token) → extrai "tenantId" do JWT
4. UserContext criado com: userId, tenantId, role, modules
5. SecurityContext.setAuthentication(UserContext)
```

### **Implementação:**

**JwtAuthenticationFilter.java** (linha 34-48):
```java
String userId = jwtUtil.getUserId(token);
String tenantId = jwtUtil.getTenantId(token);  // ✅ EXTRAÇÃO DO TENANT
String role = jwtUtil.getRole(token);
List<String> modules = jwtUtil.getModules(token);

if (!modules.contains("LUNAPAY")) {
    response.sendError(403, "Módulo LUNAPAY não habilitado");
    return;
}

UserContext userContext = new UserContext(userId, tenantId, role, modules);
var auth = new UsernamePasswordAuthenticationToken(userContext, null, authorities);
SecurityContextHolder.getContext().setAuthentication(auth);
```

**JwtUtil.java** (linha 41-44):
```java
public String getTenantId(String token) {
    Claims claims = getClaims(token);
    return claims != null ? (String) claims.get("tenantId") : null;
}
```

**✅ VALIDADO:**
- TenantId é extraído do JWT em TODAS as requisições
- Validação de módulo "LUNAPAY" garante acesso autorizado
- UserContext contém tenantId disponível em toda a aplicação

---

## 🎯 2. Injeção do TenantId nos Controllers

### **Fluxo:**
```
1. @AuthenticationPrincipal UserContext user
2. user.getTenantId() → obtém tenant da requisição
3. Passa tenantId para Service Layer
```

### **Implementação:**

**PaymentController.java** (linha 29-33):
```java
@PostMapping
public ResponseEntity<PaymentResponse> createPayment(
        @Valid @RequestBody CreatePaymentRequest request,
        @AuthenticationPrincipal UserContext user) {  // ✅ INJEÇÃO AUTOMÁTICA

    PaymentResponse response = paymentService.createPayment(
        request, 
        user.getTenantId()  // ✅ TENANT PROPAGADO
    );
    return ResponseEntity.status(HttpStatus.CREATED).body(response);
}
```

**✅ VALIDADO:**
- `@AuthenticationPrincipal` injeta UserContext automaticamente
- TenantId é passado explicitamente para Services
- Não há risco de vazamento entre tenants

---

## 💼 3. Service Layer - Isolamento de Dados

### **Fluxo:**
```
1. PaymentService.createPayment(request, tenantId)
2. Cria Payment entity com tenantId
3. PaymentRepository.save(payment) → BD com tenant_id
4. Gateway API recebe tenantId via header X-Tenant-ID
```

### **Implementação:**

**PaymentService.java** (linha 37-66):
```java
@Transactional
public PaymentResponse createPayment(CreatePaymentRequest request, String tenantId) {
    log.info("Criando pagamento para tenant {} via gateway {}", tenantId, request.getGateway());
    
    // Gateway recebe tenantId
    GatewayPaymentResult gatewayResult = gateway.createPayment(request, tenantId);
    
    // Salva no banco com tenantId
    Payment payment = new Payment();
    payment.setTenantId(tenantId);  // ✅ ISOLAMENTO POR TENANT
    payment.setAmount(request.getAmount());
    payment.setDescription(request.getDescription());
    payment.setGateway(gatewayName);
    payment.setGatewayPaymentId(gatewayResult.getGatewayPaymentId());
    payment.setPaymentMethod(request.getPaymentMethod().toUpperCase());
    payment.setStatus(PaymentStatus.PENDING);
    
    Payment saved = paymentRepository.save(payment);
    return mapToResponse(saved);
}
```

**✅ VALIDADO:**
- TenantId é armazenado em TODAS as entidades Payment
- Consultas ao banco filtram por tenantId
- Gateway APIs recebem tenantId para tracking

---

## 🗄️ 4. Persistência - Banco de Dados

### **Schema:**

**Payment.java** (linha 18-19):
```java
@Column(name = "tenant_id", nullable = false)
private String tenantId;
```

**PaymentRepository.java** (linha 11):
```java
List<Payment> findByTenantId(String tenantId);
```

**✅ VALIDADO:**
- Coluna `tenant_id` NOT NULL garante integridade
- Todos os SELECTs incluem WHERE tenant_id = ?
- Índice recomendado: `CREATE INDEX idx_payments_tenant ON payments(tenant_id);`

---

## 🌐 5. Gateway Integration - Propagação do TenantId

### **Fluxo:**
```
1. PaymentService → Gateway.createPayment(request, tenantId)
2. C6Gateway/AsaasGateway → HTTP POST com X-Tenant-ID header
3. Gateway externo pode usar tenantId para tracking/auditoria
```

### **Implementação:**

**C6Gateway.java** (linha 82-84):
```java
C6CreatePaymentResponse response = c6WebClient.post()
        .uri("/payments")
        .header("Authorization", "Bearer " + gatewayConfig.getC6().getApiKey())
        .header("X-Tenant-ID", tenantId)  // ✅ TENANT NO HEADER
        .bodyValue(c6Request)
        .retrieve()
        // ...
```

**AsaasGateway.java** (linha 55-62):
```java
// Cria cliente no Asaas com externalReference contendo tenantId
AsaasCustomerRequest customerRequest = AsaasCustomerRequest.builder()
        .name(request.getCustomer().getName())
        .cpfCnpj(request.getCustomer().getCpfCnpj())
        .email(request.getCustomer().getEmail())
        .phone(request.getCustomer().getPhone())
        .mobilePhone(request.getCustomer().getPhone())
        .externalReference(tenantId + "_" + request.getCustomer().getCpfCnpj())  // ✅ TENANT NA REFERÊNCIA
        .build();
```

**✅ VALIDADO:**
- C6: TenantId enviado via header HTTP
- Asaas: TenantId incluído no externalReference do cliente
- Permite rastreamento cross-system

---

## 🔍 6. Consultas - Isolamento Garantido

### **Todos os Endpoints:**

```java
// GET /payments - Lista pagamentos do tenant
@GetMapping
public ResponseEntity<List<PaymentResponse>> listPayments(
        @AuthenticationPrincipal UserContext user) {
    List<PaymentResponse> payments = paymentService.findByTenant(user.getTenantId());
    return ResponseEntity.ok(payments);
}

// GET /payments/{id} - Busca pagamento específico
@GetMapping("/{id}")
public ResponseEntity<PaymentResponse> getPayment(
        @PathVariable String id,
        @AuthenticationPrincipal UserContext user) {
    return paymentService.findById(id, user.getTenantId())  // ✅ FILTRO DUPLO
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
}
```

**PaymentService.java** (linha 100-104):
```java
@Transactional(readOnly = true)
public List<PaymentResponse> findByTenant(String tenantId) {
    return paymentRepository.findByTenantId(tenantId).stream()  // ✅ WHERE tenant_id = ?
            .map(this::mapToResponse)
            .toList();
}
```

**✅ VALIDADO:**
- Todas as queries incluem tenantId
- Busca por ID + TenantId impede acesso cross-tenant
- 404 retornado se ID existe mas pertence a outro tenant

---

## 🚨 7. Pontos de Atenção e Melhorias

### **✅ Implementado Corretamente:**
1. ✅ JWT contém tenantId
2. ✅ Filter extrai e injeta tenantId
3. ✅ Controllers recebem UserContext
4. ✅ Services propagam tenantId
5. ✅ Entities armazenam tenant_id
6. ✅ Repository filtra por tenantId
7. ✅ Gateways recebem tenantId

### **⚠️ Recomendações de Segurança:**

#### **A. Adicionar índice no banco:**
```sql
CREATE INDEX idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX idx_payments_tenant_status ON payments(tenant_id, status);
CREATE INDEX idx_payments_tenant_created ON payments(tenant_id, created_at DESC);
```

#### **B. Implementar Tenant Interceptor (OPCIONAL):**
```java
@Component
public class TenantInterceptor implements HandlerInterceptor {
    
    @Override
    public boolean preHandle(HttpServletRequest request, 
                             HttpServletResponse response, 
                             Object handler) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserContext user) {
            TenantContext.setCurrentTenant(user.getTenantId());
            MDC.put("tenantId", user.getTenantId()); // Para logs
        }
        return true;
    }
    
    @Override
    public void afterCompletion(HttpServletRequest request, 
                                 HttpServletResponse response, 
                                 Object handler, 
                                 Exception ex) {
        TenantContext.clear();
        MDC.remove("tenantId");
    }
}
```

#### **C. Adicionar Auditing com Tenant:**
```java
@EntityListeners(AuditingEntityListener.class)
@Entity
public class Payment {
    
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private String tenantId;
    
    @CreatedBy
    private String createdBy;
    
    @LastModifiedBy
    private String modifiedBy;
    
    // Implementar AuditorAware<String> com UserContext
}
```

---

## 📊 8. Diagrama de Fluxo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CLIENT REQUEST                                               │
│    POST /payments                                               │
│    Authorization: Bearer <JWT com tenantId>                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. JwtAuthenticationFilter                                      │
│    ✅ Extrai tenantId do JWT                                    │
│    ✅ Cria UserContext(userId, tenantId, role, modules)         │
│    ✅ Valida módulo "LUNAPAY"                                   │
│    ✅ Injeta no SecurityContext                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. PaymentController                                            │
│    ✅ @AuthenticationPrincipal UserContext user                 │
│    ✅ user.getTenantId() → "tenant_123"                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. PaymentService                                               │
│    ✅ createPayment(request, "tenant_123")                      │
│    ✅ payment.setTenantId("tenant_123")                         │
│    ✅ gateway.createPayment(request, "tenant_123")              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ├──────────────┬─────────────────────┐
                            ▼              ▼                     ▼
               ┌────────────────┐ ┌──────────────┐ ┌──────────────────┐
               │ 5a. DATABASE   │ │ 5b. C6 API   │ │ 5c. ASAAS API    │
               │ INSERT payment │ │ X-Tenant-ID  │ │ externalRef:     │
               │ tenant_id =    │ │ "tenant_123" │ │ "tenant_123_CPF" │
               │ "tenant_123"   │ │              │ │                  │
               └────────────────┘ └──────────────┘ └──────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. RESPONSE                                                     │
│    {                                                            │
│      "id": "uuid",                                              │
│      "tenantId": "tenant_123",  ✅ ISOLADO                      │
│      "amount": 100.00,                                          │
│      "status": "PENDING"                                        │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 9. Conclusão

### **Status: ✅ MULTI-TENANCY TOTALMENTE IMPLEMENTADO**

**Segurança:**
- ✅ TenantId extraído do JWT (imutável)
- ✅ Validação em todas as requisições
- ✅ Isolamento a nível de aplicação e banco
- ✅ Não há possibilidade de cross-tenant access

**Performance:**
- ⚠️ Adicionar índices recomendados (tenant_id, tenant_id+status)
- ✅ Queries otimizadas com WHERE tenant_id

**Auditoria:**
- ✅ Logs incluem tenantId (via log.info)
- 💡 Implementar MDC para contexto de logs
- 💡 Adicionar @CreatedBy/@ModifiedBy

**Integrações:**
- ✅ C6 recebe X-Tenant-ID header
- ✅ Asaas usa externalReference com tenant
- ✅ Webhooks podem incluir tenant para routing

---

## 📝 10. Checklist de Validação

- [x] JWT contém claim "tenantId"
- [x] JwtUtil.getTenantId() implementado
- [x] JwtAuthenticationFilter extrai tenant
- [x] UserContext armazena tenantId
- [x] Controllers injetam @AuthenticationPrincipal
- [x] Services recebem tenantId explícito
- [x] Payment entity tem campo tenant_id NOT NULL
- [x] PaymentRepository filtra por tenantId
- [x] Gateways propagam tenantId (header/reference)
- [ ] Índices de performance criados (PENDENTE - SQL acima)
- [ ] MDC logging com tenantId (OPCIONAL)
- [ ] Auditing com tenant (OPCIONAL)

---

**Gerado em:** 2025-12-08  
**Sistema:** LunaPay API - Multi-tenant Payment Gateway  
**Status:** ✅ PRODUÇÃO-READY com recomendações de otimização
