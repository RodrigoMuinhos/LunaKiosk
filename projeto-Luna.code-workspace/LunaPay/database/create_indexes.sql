-- ========================================
-- INSTRUÇÕES DE EXECUÇÃO
-- ========================================
-- Este arquivo contém índices de performance para o banco LunaPay
-- 
-- Como executar:
-- Opção 1: Neon Console (Recomendado)
--   1. Acesse https://console.neon.tech
--   2. Selecione seu projeto
--   3. Vá em SQL Editor
--   4. Cole e execute cada comando abaixo
--
-- Opção 2: psql (se instalado)
--   psql "postgresql://neondb_owner:xxx@ep-muddy-meadow-a5dpcj2a-pooler.us-east-2.aws.neon.tech/lunapay_db?sslmode=require" -f create_indexes.sql
--
-- Opção 3: DBeaver / pgAdmin
--   Conecte no banco e execute este arquivo
--
-- ========================================

-- 1. Índice principal para queries por tenant
-- Benefício: 10x-100x mais rápido nas queries findByTenantId()
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id 
ON payments(tenant_id);

-- 2. Índice composto para queries com filtro de status
-- Benefício: Otimiza queries como "pagamentos pendentes do tenant X"
CREATE INDEX IF NOT EXISTS idx_payments_tenant_status 
ON payments(tenant_id, status);

-- 3. Índice para ordenação cronológica
-- Benefício: Queries como "últimos 10 pagamentos" ficam instantâneas
CREATE INDEX IF NOT EXISTS idx_payments_tenant_created 
ON payments(tenant_id, created_at DESC);

-- 4. Índice para lookup de webhooks
-- Benefício: Otimiza processamento de webhooks que chegam com gateway_payment_id
CREATE INDEX IF NOT EXISTS idx_payments_gateway_payment_id 
ON payments(gateway_payment_id);

-- 5. Índice para relatórios por gateway
-- Benefício: Dashboards com filtros "pagamentos do C6" ou "pagamentos do Asaas"
CREATE INDEX IF NOT EXISTS idx_payments_tenant_gateway 
ON payments(tenant_id, gateway);

-- 6. Índice para relatórios por método
-- Benefício: Análises como "quantos PIX vs Boleto vs Cartão por tenant"
CREATE INDEX IF NOT EXISTS idx_payments_tenant_method 
ON payments(tenant_id, payment_method);

-- 7. Índice para auditoria
-- Benefício: Rastreamento de quem criou/modificou pagamentos
CREATE INDEX IF NOT EXISTS idx_payments_created_by 
ON payments(created_by);

-- ========================================
-- VERIFICAÇÃO
-- ========================================
-- Execute para confirmar que os índices foram criados:
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'payments'
ORDER BY indexname;

-- ========================================
-- MONITORAMENTO
-- ========================================
-- Execute periodicamente para verificar uso dos índices:
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes 
WHERE tablename = 'payments'
ORDER BY idx_scan DESC;

-- ========================================
-- TESTE DE PERFORMANCE
-- ========================================
-- Antes e depois dos índices, execute:
EXPLAIN ANALYZE 
SELECT * FROM payments 
WHERE tenant_id = 'clinic_123' 
  AND status = 'PAID'
ORDER BY created_at DESC 
LIMIT 10;

-- Resultado esperado COM índice:
-- Planning Time: ~0.5ms
-- Execution Time: ~2ms
-- Rows: 10

-- Resultado esperado SEM índice:
-- Planning Time: ~1ms
-- Execution Time: ~50-500ms (dependendo do volume)
-- Rows: 10
