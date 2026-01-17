# 📋 Configuração do Webhook GoHighLevel → LunaVita

**Data:** 17/01/2026  
**Versão:** 2.0 (com validação de templates)

---

## 🔗 Dados para Configuração

### 1. URL do Webhook
```
https://totemapi.up.railway.app/api/webhooks/ghl/patients
```

### 2. Token de Autenticação
```
ln16012x26
```
**⚠️ IMPORTANTE:** Enviar este token no header `X-Webhook-Token`

### 3. Método HTTP
```
POST
```

---

## 📝 Formato JSON Esperado

O webhook **deve enviar** os seguintes campos (com valores reais, não templates):

```json
{
  "contact_id": "abc123xyz",
  "full_name": "João da Silva",
  "email": "joao@email.com",
  "phone": "+5511987654321",
  "cpf": "12345678900",
  "birth_date": "1990-05-15",
  "tenant_id": "default"
}
```

---

## ✅ Campos Obrigatórios

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `contact_id` | String | ID único do contato no GHL | `"abc123xyz"` |
| `full_name` | String | Nome completo do paciente | `"João da Silva"` |
| `phone` | String | Telefone com DDD (com ou sem +55) | `"+5511987654321"` |
| `cpf` | String | CPF com 11 dígitos (sem formatação) | `"12345678900"` |

## 🔸 Campos Opcionais

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `email` | String | Email do paciente | `"joao@email.com"` |
| `birth_date` | String | Data de nascimento (YYYY-MM-DD) | `"1990-05-15"` |
| `tenant_id` | String | ID do tenant (padrão: "default") | `"default"` |

---

## ⚙️ Configuração no GoHighLevel

### Passo 1: Acessar Webhooks
1. Acesse **Settings** > **Integrations** > **Webhooks**
2. Clique em **Add Webhook**

### Passo 2: Configurar Trigger
- **Trigger Event:** `Contact Created` ou `Contact Updated`
- **URL:** `https://totemapi.up.railway.app/api/webhooks/ghl/patients`
- **Method:** `POST`

### Passo 3: Adicionar Header de Autenticação
Adicione um **Custom Header**:
- **Key:** `X-Webhook-Token`
- **Value:** `ln16012x26`

### Passo 4: Mapear Campos Customizados

**⚠️ ATENÇÃO:** Não usar templates como `{{contact.name}}`. O GHL deve enviar os **valores reais**.

Configure o **Request Body** (JSON):

```json
{
  "contact_id": "{{contact.id}}",
  "full_name": "{{contact.name}}",
  "email": "{{contact.email}}",
  "phone": "{{contact.phone}}",
  "cpf": "{{contact.custom_field.cpf}}",
  "birth_date": "{{contact.custom_field.birth_date}}",
  "tenant_id": "default"
}
```

**📌 Importante sobre CPF:**
- O campo `cpf` deve vir de um **Custom Field** no GHL
- Criar um campo customizado chamado `cpf` ou similar
- O CPF deve ter **11 dígitos** (sem pontos, traços ou formatação)

---

## 🧪 Como Testar

### 1. Teste Manual com cURL

```bash
curl -X POST https://totemapi.up.railway.app/api/webhooks/ghl/patients \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Token: ln16012x26" \
  -d '{
    "contact_id": "teste123",
    "full_name": "João Teste",
    "email": "joao@teste.com",
    "phone": "+5511987654321",
    "cpf": "12345678900",
    "birth_date": "1990-05-15",
    "tenant_id": "default"
  }'
```

**Response esperado (sucesso):**
```json
{
  "status": "success",
  "message": "Patient created successfully",
  "patientId": "27fffa6e-379d-430a-a8c2-5de6b0de699f"
}
```

### 2. Teste no GHL
1. Crie um contato de teste no GoHighLevel
2. Preencha todos os campos (incluindo CPF no custom field)
3. Verifique se o paciente apareceu no sistema LunaVita

---

## ❌ Erros Comuns

### Erro 401: Unauthorized
**Causa:** Token inválido ou ausente  
**Solução:** Verificar se o header `X-Webhook-Token` está correto: `ln16012x26`

### Erro 400: CPF inválido
**Causa:** CPF com formatação (pontos/traços) ou menos de 11 dígitos  
**Solução:** Enviar CPF com **11 dígitos numéricos**: `12345678900`

### Erro 400: Templates não substituídos
**Causa:** GHL enviando `{{contact.name}}` em vez do valor real  
**Solução:** Verificar mapeamento de campos no webhook do GHL

### Erro 409: Paciente já existe
**Causa:** CPF já cadastrado no sistema  
**Solução:** 
- O sistema **atualiza** os dados automaticamente
- Se quiser forçar novo cadastro, alterar o CPF

---

## 📊 Validações Implementadas

O webhook valida automaticamente:

✅ Token de autenticação  
✅ Formato do JSON  
✅ CPF com 11 dígitos  
✅ Campos obrigatórios presentes  
✅ Templates não substituídos (rejeita `{{...}}`)  
✅ Duplicatas de CPF (atualiza em vez de duplicar)

---

## 🔒 Segurança

- ✅ Autenticação via token único
- ✅ HTTPS obrigatório
- ✅ Validação de dados antes de salvar
- ✅ Proteção contra templates malformados
- ✅ Log de auditoria LGPD

---

## 📞 Suporte

**Em caso de dúvidas:**
- Verifique os logs do webhook no GoHighLevel
- Teste primeiro com cURL antes de ativar o webhook
- Entre em contato com o suporte técnico

---

## 📋 Checklist de Configuração

- [ ] URL do webhook configurada no GHL
- [ ] Token `ln16012x26` no header `X-Webhook-Token`
- [ ] Método POST selecionado
- [ ] Trigger event configurado (Contact Created/Updated)
- [ ] Campos mapeados (especialmente CPF no custom field)
- [ ] Teste realizado com contato real
- [ ] Paciente apareceu no sistema LunaVita

---

**✅ Configuração completa! O webhook estará ativo assim que salvo no GoHighLevel.**

**Última atualização:** 17/01/2026  
**Versão do sistema:** v2.0 (com validação de templates)
