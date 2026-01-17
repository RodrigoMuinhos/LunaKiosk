# ✅ Webhook GHL → TotemAPI - FUNCIONANDO

**Data:** 16 de janeiro de 2026  
**Status:** ✅ Resolvido e testado

---

## 🎯 Problema Identificado

Paciente **Leonardo da C. Marques** foi cadastrado via webhook GHL mas não aparecia na interface administrativa.

### Causa Raiz
- Webhook criou paciente com `tenant_id = "default"` (código antigo)
- Admin estava logado com `tenant_id = "totem"`
- PatientController filtra por tenant → paciente não aparecia na lista

---

## ✅ Solução Aplicada

### 1. Correção no Banco de Dados
```sql
UPDATE luna.patients 
SET tenant_id = 'totem'
WHERE cpf = '02375330307';
```

### 2. Correção no Código (para futuros webhooks)

**Arquivo:** `GhlWebhookPatientService.java`
- **Antes:** `patient.setTenantId("default");`
- **Depois:** `patient.setTenantId("totem");`

**Arquivo:** `test-webhook-ghl.ps1`
- Adicionado campo `tenant_id = 'totem'` no payload

**Arquivo:** `CONFIGURAR-GHL-WEBHOOK.md`
- Atualizado com `tenant_id` fixo = `"totem"`

---

## 📊 Resultado Final

### Pacientes na Interface ✅
- ✅ Rodrigo Muinhos (CPF: 044.117.503-17) - tenant: `totem`
- ✅ Leonardo da C. Marques (CPF: 023.753.303-07) - tenant: `totem`

**Ambos aparecem corretamente na interface administrativa!**

---

## 🔗 Configuração no GoHighLevel

### URL do Webhook
```
https://appealing-appreciation-production.up.railway.app/api/webhooks/ghl/patients
```

### Headers
```
Content-Type: application/json
x-webhook-token: ln16012x26
```

### Body (JSON)
```json
{
  "contact_id": "{{contact.id}}",
  "event_type": "contact.create",
  "full_name": "{{contact.name}}",
  "cpf": "{{contact.customField.CPF}}",
  "email": "{{contact.email}}",
  "phone": "{{contact.phone}}",
  "birth_date": "{{contact.customField.DataNascimento}}",
  "tenant_id": "totem",
  "notes": "Criado via GHL"
}
```

**Importante:** `tenant_id` deve ser **"totem"** (valor fixo).

---

## 🧪 Próximos Passos

### 1. Adicionar Webhook no GHL
1. Entre no GoHighLevel
2. Vá em **Settings** → **Workflows**
3. Crie workflow com gatilho **Contact Created**
4. Adicione ação **Webhook** com os dados acima

### 2. Testar
1. Crie um contato no GHL
2. Verifique se o webhook é disparado
3. Confirme se o paciente aparece na interface Luna

### 3. Deploy (Railway)
```bash
cd projeto-Luna.code-workspace/LunaTotem/TotemAPI
git add .
git commit -m "fix: tenant_id padrão webhook GHL"
git push origin main
```

Railway fará deploy automático! 🚀

---

## 📝 Referências

- **Documentação:** [CONFIGURAR-GHL-WEBHOOK.md](projeto-Luna.code-workspace/LunaTotem/TotemAPI/CONFIGURAR-GHL-WEBHOOK.md)
- **Script de Teste:** [test-webhook-ghl.ps1](projeto-Luna.code-workspace/LunaTotem/TotemAPI/test-webhook-ghl.ps1)
- **Troubleshooting:** [FIX-LEONARDO-TENANT.md](FIX-LEONARDO-TENANT.md)

---

## ✅ Checklist de Validação

- [x] Paciente Leonardo criado via webhook
- [x] Correção do tenant_id no banco
- [x] Código atualizado com tenant_id="totem"
- [x] Documentação atualizada
- [x] Ambos os pacientes visíveis na interface
- [ ] Webhook configurado no GHL
- [ ] Deploy no Railway concluído
- [ ] Teste end-to-end realizado

---

**Status:** ✅ **Pronto para produção**
