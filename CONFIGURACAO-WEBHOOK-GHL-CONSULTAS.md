# 📋 Configuração do Webhook GoHighLevel → Consultas LunaVita

**Data:** 17/01/2026  
**Versão:** 1.0 (webhook separado para consultas)

---

## 🔗 Dados para Configuração

### 1. URL do Webhook
```
https://totemapi.up.railway.app/api/webhooks/ghl/appointments
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

O webhook **cria CONSULTA + PACIENTE** em uma única chamada:

```json
{
  "cpf": "12345678900",
  "full_name": "João da Silva",
  "phone": "+5511987654321",
  "email": "joao@email.com",
  "birth_date": "1990-05-15",
  "appointment_date": "2026-01-25",
  "appointment_time": "14:30",
  "appointment_type": "Consulta",
  "amount": 150.00,
  "paid": false,
  "status": "agendada",
  "doctor_id": "abc-123-xyz",
  "tenant_id": "default",
  "contact_id": "ghl_contact_123"
}
```

---

## ✅ Campos Obrigatórios

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `cpf` | String | CPF com 11 dígitos (sem formatação) | `"12345678900"` |
| `full_name` | String | Nome completo do paciente | `"João da Silva"` |
| `phone` | String | Telefone com DDD | `"+5511987654321"` |
| `appointment_date` | String | Data da consulta (YYYY-MM-DD) | `"2026-01-25"` |
| `appointment_time` | String | Hora da consulta (HH:mm) | `"14:30"` |
| `appointment_type` | String | Tipo da consulta | `"Consulta"` |

## 🔸 Campos Opcionais

| Campo | Tipo | Descrição | Exemplo | Padrão |
|-------|------|-----------|---------|--------|
| `email` | String | Email do paciente | `"joao@email.com"` | - |
| `birth_date` | String | Data nascimento (YYYY-MM-DD) | `"1990-05-15"` | - |
| `amount` | Number | Valor da consulta | `150.00` | - |
| `paid` | Boolean | Consulta já paga? | `true` ou `false` | `false` |
| `status` | String | Status da consulta | `"agendada"` | `"agendada"` |
| `doctor_id` | String | ID do médico no sistema | `"abc-123-xyz"` | - |
| `tenant_id` | String | ID do tenant | `"default"` | `"default"` |
| `contact_id` | String | ID do contato no GHL | `"ghl_123"` | - |

---

## ⚙️ Configuração no GoHighLevel

### Passo 1: Acessar Webhooks
1. Acesse **Settings** > **Integrations** > **Webhooks**
2. Clique em **Add Webhook**

### Passo 2: Configurar Trigger
- **Trigger Event:** `Appointment Booked` ou `Appointment Created`
- **URL:** `https://totemapi.up.railway.app/api/webhooks/ghl/appointments`
- **Method:** `POST`

### Passo 3: Adicionar Header de Autenticação
Adicione um **Custom Header**:
- **Key:** `x-webhook-token`
- **Value:** `ln16012x26`

### Passo 4: Mapear Campos

**⚠️ ATENÇÃO:** O GHL deve enviar os **valores reais**, não templates.

Configure o **Request Body** (JSON):

```json
{
  "cpf": "{{contact.custom_field.cpf}}",
  "full_name": "{{contact.name}}",
  "phone": "{{contact.phone}}",
  "email": "{{contact.email}}",
  "birth_date": "{{contact.custom_field.birth_date}}",
  "appointment_date": "{{appointment.start_date}}",
  "appointment_time": "{{appointment.start_time}}",
  "appointment_type": "{{appointment.title}}",
  "amount": "{{appointment.custom_field.amount}}",
  "paid": false,
  "status": "agendada",
  "doctor_id": "{{appointment.assigned_user_id}}",
  "tenant_id": "default",
  "contact_id": "{{contact.id}}"
}
```

**📌 Campos Customizados Necessários:**
- `cpf` - Campo customizado do contato (11 dígitos sem formatação)
- `birth_date` - Campo customizado do contato (opcional)
- `amount` - Campo customizado do appointment (opcional)

---

## 🔄 Comportamento do Sistema

### Quando paciente JÁ EXISTE:
1. Sistema busca paciente por CPF
2. **Atualiza** dados do paciente (se fornecidos)
3. Cria nova consulta vinculada ao paciente
4. Retorna `patientCreated: false`

### Quando paciente NÃO EXISTE:
1. Sistema **cria novo paciente** com dados fornecidos
2. Cria consulta vinculada ao novo paciente
3. Retorna `patientCreated: true`

### Médico (opcional):
- Se `doctor_id` fornecido → busca médico e vincula consulta
- Se `doctor_id` não fornecido → consulta criada sem médico
- Se `doctor_id` inválido → consulta criada sem médico (log de warning)

---

## 🧪 Como Testar

### 1. Teste Manual com cURL

```bash
curl -X POST https://totemapi.up.railway.app/api/webhooks/ghl/appointments \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: ln16012x26" \
  -d '{
    "cpf": "12345678900",
    "full_name": "João Teste",
    "phone": "+5511987654321",
    "email": "joao@teste.com",
    "birth_date": "1990-05-15",
    "appointment_date": "2026-01-25",
    "appointment_time": "14:30",
    "appointment_type": "Consulta",
    "amount": 150.00,
    "paid": false,
    "status": "agendada",
    "tenant_id": "default"
  }'
```

**Response esperado (sucesso):**
```json
{
  "status": "success",
  "message": "Appointment created successfully",
  "patientId": "abc-123-xyz",
  "appointmentId": "def-456-uvw",
  "patientCreated": true
}
```

### 2. Teste no GHL
1. Crie um agendamento de teste no GoHighLevel
2. Preencha todos os campos (incluindo CPF no custom field)
3. Verifique se a consulta apareceu no sistema LunaVita

---

## ❌ Erros Comuns

### Erro 401: Unauthorized
**Causa:** Token inválido ou ausente  
**Solução:** Verificar se o header `x-webhook-token` está correto: `ln16012x26`

### Erro 400: CPF inválido
**Causa:** CPF com formatação (pontos/traços) ou menos de 11 dígitos  
**Solução:** Enviar CPF com **11 dígitos numéricos**: `12345678900`

### Erro 400: Data inválida
**Causa:** Data não está no formato YYYY-MM-DD  
**Solução:** Enviar data como `"2026-01-25"` (não `"25/01/2026"`)

### Erro 400: Hora inválida
**Causa:** Hora não está no formato HH:mm  
**Solução:** Enviar hora como `"14:30"` (não `"2:30 PM"`)

### Erro 400: Templates não substituídos
**Causa:** GHL enviando `{{contact.name}}` em vez do valor real  
**Solução:** Verificar mapeamento de campos no webhook do GHL

---

## 📊 Validações Implementadas

O webhook valida automaticamente:

✅ Token de autenticação  
✅ Formato do JSON  
✅ CPF com 11 dígitos  
✅ Campos obrigatórios presentes  
✅ Formato de data (YYYY-MM-DD)  
✅ Formato de hora (HH:mm)  
✅ Templates não substituídos (rejeita `{{...}}`)

---

## 🔒 Segurança

- ✅ Autenticação via token único
- ✅ HTTPS obrigatório
- ✅ Validação de dados antes de salvar
- ✅ Proteção contra templates malformados
- ✅ Log de auditoria LGPD
- ✅ Deduplicação automática de pacientes (por CPF)

---

## 💡 Diferença entre Webhooks

### Webhook de PACIENTES (`/api/webhooks/ghl/patients`)
- **Função:** Criar/atualizar apenas PACIENTE
- **Trigger GHL:** Contact Created, Contact Updated
- **Retorna:** `patientId`

### Webhook de CONSULTAS (`/api/webhooks/ghl/appointments`) ⭐ NOVO
- **Função:** Criar/atualizar PACIENTE + criar CONSULTA
- **Trigger GHL:** Appointment Booked, Appointment Created
- **Retorna:** `patientId`, `appointmentId`, `patientCreated`

**💡 Recomendação:** Use o webhook de CONSULTAS quando quiser automatizar o agendamento completo a partir do GoHighLevel.

---

## 📞 Suporte

**Em caso de dúvidas:**
- Verifique os logs do webhook no GoHighLevel
- Teste primeiro com cURL antes de ativar o webhook
- Certifique-se de que os custom fields `cpf`, `birth_date` e `amount` estão criados no GHL
- Entre em contato com o suporte técnico

---

## 📋 Checklist de Configuração

- [ ] URL do webhook configurada no GHL
- [ ] Token `ln16012x26` no header `x-webhook-token`
- [ ] Método POST selecionado
- [ ] Trigger event configurado (Appointment Booked/Created)
- [ ] Custom field `cpf` criado e mapeado
- [ ] Custom field `birth_date` criado e mapeado (opcional)
- [ ] Custom field `amount` criado e mapeado (opcional)
- [ ] Campos mapeados no request body
- [ ] Teste realizado com agendamento real
- [ ] Consulta apareceu no sistema LunaVita

---

**✅ Configuração completa! O webhook estará ativo assim que salvo no GoHighLevel.**

**Última atualização:** 17/01/2026  
**Versão do sistema:** v1.0 (webhook separado para consultas)
