-- Script para verificar consultas não pagas no banco
-- Execute no pgAdmin ou cliente PostgreSQL conectado ao Neon

-- 1. Ver todas as consultas e seus status de pagamento
SELECT 
    id,
    patient,
    cpf,
    date,
    time,
    amount,
    paid,
    status,
    tenant_id
FROM appointments
WHERE cpf LIKE '%044%'
ORDER BY date DESC, time DESC;

-- 2. Ver apenas as NÃO pagas
SELECT 
    id,
    patient,
    cpf,
    date,
    time,
    amount,
    paid,
    status
FROM appointments
WHERE paid = false
  AND cpf LIKE '%044%'
ORDER BY date DESC, time DESC;

-- 3. Contar total de pagas vs não pagas
SELECT 
    paid,
    COUNT(*) as total,
    SUM(amount) as valor_total
FROM appointments
GROUP BY paid;

-- 4. Se não houver nenhuma não paga, criar uma de teste
-- (descomente e ajuste os valores conforme necessário)
/*
INSERT INTO appointments (
    id, 
    tenant_id,
    patient_id,
    patient,
    cpf,
    doctor,
    specialty,
    date,
    time,
    status,
    type,
    paid,
    amount
) VALUES (
    'test-unpaid-001',
    'default',  -- ajuste conforme seu tenant_id
    '1',        -- ajuste conforme o ID do paciente
    'Rodrigo Muinhos Teste',
    '04411750317',
    'Dr. Roberto',
    'Cardiologia',
    '2026-01-15',
    '14:00',
    'AGENDADO',
    'CONSULTA',
    false,
    150.00
);
*/
