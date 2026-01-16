# 🔧 Corrigir Paciente Leonardo - Webhook GHL

## 📋 Problema Identificado

O paciente **Leonardo da C. Marques** foi cadastrado via webhook GHL, mas **não está aparecendo na interface administrativa**.

### Causa
- O webhook não recebeu o campo `tenant_id` no payload
- O sistema usou o tenant padrão `"default"` 
- O usuário admin está logado com `tenant_id = "totemlunavita"`
- Por isso, o paciente não aparece na listagem (filtrado por tenant diferente)

---

## ✅ Correções Aplicadas

### 1. **Código atualizado** ✓

**Arquivo:** `GhlWebhookPatientService.java` (linha 147)
- **Antes:** `patient.setTenantId("default");`
- **Depois:** `patient.setTenantId("totemlunavita");`

**Arquivo:** `test-webhook-ghl.ps1` (linha 18)
- Adicionado campo `tenant_id = 'totemlunavita'` no payload de teste

### 2. **Banco de dados - PENDENTE** ⚠️

O paciente Leonardo já foi criado com `tenant_id = "default"`.
Precisa ser atualizado manualmente.

---

## 🔧 Como Corrigir no Banco Neon

### Opção 1: Console do Neon (Recomendado)

1. Acesse: https://console.neon.tech/app/projects/misty-math-70904285/branches/br-lively-darkness-adjr92/tables
2. Selecione a tabela **`patients`**
3. Localize o paciente Leonardo (CPF: `02375330307` ou `ghl_contact_id = 'khtSMwmZxoKVJuQ2jPfv'`)
4. Clique em "Edit" na linha
5. Altere `tenant_id` de `"default"` → `"totemlunavita"`
6. Salve

### Opção 2: SQL Editor do Neon

Execute no SQL Editor:

```sql
UPDATE luna.patients 
SET tenant_id = 'totemlunavita'
WHERE cpf = '02375330307' 
   OR ghl_contact_id = 'khtSMwmZxoKVJuQ2jPfv';
```

### Opção 3: Script Node.js (requer credenciais atualizadas)

```bash
cd scripts-nodejs
# Configurar DATABASE_URL como variável de ambiente
$env:DATABASE_URL="postgresql://usuario:senha@host/database?sslmode=require"
node fix-leonardo-tenant.js
```

---

## 🧪 Testar Novamente

Depois de corrigir o banco:

1. **Recompilar TotemAPI** (se necessário):
   ```bash
   cd projeto-Luna.code-workspace\LunaTotem\TotemAPI
   mvn clean compile
   ```

2. **Testar webhook com tenant_id correto**:
   ```powershell
   cd projeto-Luna.code-workspace\LunaTotem\TotemAPI
   .\test-webhook-ghl.ps1
   ```

3. **Recarregar interface administrativa**:
   - Fazer logout/login no painel admin
   - Verificar lista de pacientes
   - O paciente Leonardo deve aparecer agora ✓

---

## 📊 Verificação no Banco

Confirmar que os 2 pacientes estão com mesmo tenant:

```sql
SELECT id, name, cpf, email, tenant_id, ghl_contact_id 
FROM luna.patients 
ORDER BY created_at DESC;
```

Resultado esperado:
```
| name                    | cpf           | tenant_id      |
|-------------------------|---------------|----------------|
| Rodrigo Muinhos         | 04411750317   | totemlunavita  |
| Leonardo da C. Marques  | 02375330307   | totemlunavita  | ← corrigido
```

---

## 🎯 Próximos Webhooks

Novos webhooks GHL **já vão funcionar corretamente** porque:

1. ✅ Código atualizado para usar `"totemlunavita"` por padrão
2. ✅ Script de teste atualizado com `tenant_id` no payload
3. ✅ Documentação atualizada

**Importante:** Ao configurar o webhook no GoHighLevel, sempre incluir:
```json
{
  "tenant_id": "totemlunavita",
  "contact_id": "{{contact.id}}",
  "full_name": "{{contact.name}}",
  "cpf": "{{contact.customField.CPF}}",
  "email": "{{contact.email}}",
  "phone": "{{contact.phone}}",
  "birth_date": "{{contact.customField.DataNascimento}}"
}
```
