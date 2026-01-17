# 🔧 Diagnóstico: Webhook 404 no Railway

## ❌ Erro Observado

```
GET https://appealing-appreciation-production.up.railway.app/api/webhooks/ghl/patients
Status: 404
Code: 404
Message: Application not found
```

## ✅ Código do Endpoint

O endpoint **existe** e está correto no `GhlWebhookPatientController`:

```java
@RestController
@RequestMapping("/api/webhooks/ghl")
public class GhlWebhookPatientController {
    
    @PostMapping("/patients")  // ✅ Rota: POST /api/webhooks/ghl/patients
    public ResponseEntity<?> handleGhlPatientWebhook(
            @RequestHeader(value = "x-webhook-token", required = false) String token,
            @RequestBody GhlPatientWebhookDto payload) {
        // ...
    }
}
```

## 🔍 Causas Prováveis do 404

### 1. **Aplicação não iniciou corretamente no Railway**

O Railway mostra "Online" mas pode estar retornando uma página 404 padrão.

**Verificar:**
- Logs do Railway (aba "Logs")
- Se há erro de inicialização do Spring Boot
- Se a porta `$PORT` está sendo usada corretamente

### 2. **Variáveis de ambiente ausentes/incorretas**

Variáveis **obrigatórias** para o TotemAPI:

| Variável | Valor Esperado | Status nas Screenshots |
|----------|---------------|----------------------|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://...` | ✅ Configurada |
| `SPRING_DATASOURCE_USERNAME` | `neondb_owner` | ✅ Configurada |
| `SPRING_DATASOURCE_PASSWORD` | senha do Neon | ✅ Configurada |
| `JWT_SECRET` | mesmo do LunaCore | ✅ Configurada |
| `PORT` | (Railway define automaticamente) | ⚠️ Não visível |

### 3. **Aplicação TotemAPI não foi deployada**

Verifique se o serviço "appealing-appreciation" no Railway está configurado para:
- **Source:** Repositório correto
- **Root Directory:** `projeto-Luna.code-workspace/LunaTotem/TotemAPI`
- **Build Command:** `mvn clean package -DskipTests`
- **Start Command:** `java -jar target/totem-api-*.jar`

### 4. **Método HTTP incorreto**

O endpoint espera **POST**, mas você está testando com **GET**:

```
✅ Correto: POST /api/webhooks/ghl/patients
❌ Seu teste: GET /api/webhooks/ghl/patients
```

## 🛠️ Soluções

### Solução 1: Verificar Logs do Railway

1. Acesse: https://railway.com/dashboard
2. Clique em "appealing-appreciation"
3. Vá na aba **"Logs"**
4. Procure por:
   ```
   Started TotemApiApplication in X.XXX seconds
   Tomcat started on port(s): XXXX (http)
   ```

Se **não ver essas mensagens**, a aplicação não iniciou!

### Solução 2: Testar com POST (não GET)

Use **curl** ou **Postman**:

```bash
curl -X POST https://appealing-appreciation-production.up.railway.app/api/webhooks/ghl/patients \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: ln16012x26" \
  -d '{
    "contactId": "test123",
    "eventType": "contact.created",
    "name": "Teste",
    "email": "teste@example.com",
    "phone": "+5511999999999"
  }'
```

### Solução 3: Verificar Health Check

Teste se a aplicação está viva:

```bash
curl https://appealing-appreciation-production.up.railway.app/actuator/health
```

**Resposta esperada:**
```json
{
  "status": "UP"
}
```

Se retornar **404**, a aplicação **não está rodando**.

### Solução 4: Forçar Redeploy

No Railway:
1. Vá em "appealing-appreciation"
2. Clique em **"Deploy" → "Redeploy"**
3. Aguarde o build completar
4. Verifique os logs novamente

## 📋 Checklist de Diagnóstico

- [ ] Acessar logs do Railway e verificar se Spring Boot iniciou
- [ ] Confirmar que a porta `$PORT` está sendo usada
- [ ] Testar `/actuator/health` para confirmar que app está rodando
- [ ] Usar **POST** (não GET) para testar o webhook
- [ ] Verificar se todas as variáveis de ambiente estão corretas
- [ ] Confirmar que o build do Maven foi bem-sucedido
- [ ] Verificar se o arquivo JAR foi gerado corretamente

## 🎯 Próximos Passos

1. **Primeiro:** Acesse os logs do Railway
2. **Se a app não iniciou:** Verifique as variáveis de ambiente
3. **Se iniciou:** Use POST (não GET) para testar

---

**Nota:** O erro "Application not found" geralmente indica que o Railway está retornando uma página 404 padrão porque a aplicação Spring Boot não está rodando ou não está ouvindo na porta correta.
