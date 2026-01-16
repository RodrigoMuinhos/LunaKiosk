-- Atualizar tenantId do paciente Leonardo criado via webhook GHL
-- De: "default" → Para: "totemlunavita"

-- Verificar antes
SELECT id, name, cpf, email, tenant_id, ghl_contact_id 
FROM luna.patients 
WHERE cpf = '02375330307' OR ghl_contact_id = 'khtSMwmZxoKVJuQ2jPfv';

-- Atualizar
UPDATE luna.patients 
SET tenant_id = 'totemlunavita'
WHERE cpf = '02375330307' 
   OR ghl_contact_id = 'khtSMwmZxoKVJuQ2jPfv';

-- Verificar depois
SELECT id, name, cpf, email, tenant_id, ghl_contact_id 
FROM luna.patients 
WHERE cpf = '02375330307' OR ghl_contact_id = 'khtSMwmZxoKVJuQ2jPfv';
