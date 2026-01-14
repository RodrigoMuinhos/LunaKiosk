-- ================================================
-- ÍNDICES DE PERFORMANCE PARA MULTI-TENANCY
-- LunaPay API - PostgreSQL
-- ================================================

-- 1. ÍNDICE PRINCIPAL: Filtro por Tenant
-- Usado em: findByTenantId(), todas as queries com WHERE tenant_id = ?
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id 
ON payments(tenant_id);

-- 2. ÍNDICE COMPOSTO: Tenant + Status
-- Usado em: Consultas de pagamentos pendentes, confirmados, etc.
-- Exemplo: SELECT * FROM payments WHERE tenant_id = ? AND status = 'PENDING'
CREATE INDEX IF NOT EXISTS idx_payments_tenant_status 
ON payments(tenant_id, status);

-- 3. ÍNDICE COMPOSTO: Tenant + Data de Criação (DESC)
-- Usado em: Listagem de pagamentos ordenados por mais recentes
-- Exemplo: SELECT * FROM payments WHERE tenant_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_payments_tenant_created 
ON payments(tenant_id, created_at DESC);

-- 4. ÍNDICE COMPOSTO: Tenant + Gateway
-- Usado em: Relatórios por gateway, consultas específicas de gateway
-- Exemplo: SELECT * FROM payments WHERE tenant_id = ? AND gateway = 'C6'
CREATE INDEX IF NOT EXISTS idx_payments_tenant_gateway 
ON payments(tenant_id, gateway);

-- 5. ÍNDICE: Gateway Payment ID (para webhooks e consultas externas)
-- Usado em: Busca por gatewayPaymentId ao processar webhooks
-- Exemplo: SELECT * FROM payments WHERE gateway_payment_id = ?
CREATE INDEX IF NOT EXISTS idx_payments_gateway_payment_id 
ON payments(gateway_payment_id);

-- 6. ÍNDICE COMPOSTO: Tenant + Método de Pagamento
-- Usado em: Relatórios por método (PIX, BOLETO, CARTÃO)
-- Exemplo: SELECT * FROM payments WHERE tenant_id = ? AND payment_method = 'PIX'
CREATE INDEX IF NOT EXISTS idx_payments_tenant_method 
ON payments(tenant_id, payment_method);

-- 7. ÍNDICE COMPOSTO: Tenant + Status + Data Atualização
-- Usado em: Monitoramento de pagamentos pendentes antigos
-- Exemplo: SELECT * FROM payments WHERE tenant_id = ? AND status = 'PENDING' AND updated_at < ?
CREATE INDEX IF NOT EXISTS idx_payments_tenant_status_updated 
ON payments(tenant_id, status, updated_at);

-- ================================================
-- VERIFICAR ÍNDICES CRIADOS
-- ================================================
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'payments'
ORDER BY indexname;

-- ================================================
-- ANÁLISE DE PERFORMANCE
-- ================================================

-- Habilitar track de estatísticas (se não estiver habilitado)
-- ALTER DATABASE neondb SET track_activities = on;
-- ALTER DATABASE neondb SET track_counts = on;

-- Ver estatísticas de uso dos índices
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

-- Ver tamanho dos índices
SELECT 
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE tablename = 'payments'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ================================================
-- QUERIES DE TESTE (para validar uso dos índices)
-- ================================================

-- EXPLAIN ANALYZE mostra se os índices estão sendo usados

-- Teste 1: Busca por tenant (deve usar idx_payments_tenant_id)
EXPLAIN ANALYZE
SELECT * FROM payments WHERE tenant_id = 'tenant_123';

-- Teste 2: Busca por tenant + status (deve usar idx_payments_tenant_status)
EXPLAIN ANALYZE
SELECT * FROM payments WHERE tenant_id = 'tenant_123' AND status = 'PENDING';

-- Teste 3: Busca por tenant ordenado (deve usar idx_payments_tenant_created)
EXPLAIN ANALYZE
SELECT * FROM payments 
WHERE tenant_id = 'tenant_123' 
ORDER BY created_at DESC 
LIMIT 10;

-- Teste 4: Busca por gateway_payment_id (webhook)
EXPLAIN ANALYZE
SELECT * FROM payments WHERE gateway_payment_id = 'c6_pay_12345';

-- ================================================
-- MANUTENÇÃO: ATUALIZAR ESTATÍSTICAS
-- ================================================

-- Executar após carga massiva de dados ou periodicamente
ANALYZE payments;

-- Reindexar se houver fragmentação (raramente necessário no PostgreSQL)
-- REINDEX TABLE payments;

-- ================================================
-- MONITORAMENTO: ÍNDICES NÃO UTILIZADOS
-- ================================================

-- Identificar índices que nunca foram usados (candidatos para remoção)
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'payments' AND idx_scan = 0;

-- ================================================
-- LIMPEZA (se necessário remover índices)
-- ================================================

-- DROP INDEX IF EXISTS idx_payments_tenant_id;
-- DROP INDEX IF EXISTS idx_payments_tenant_status;
-- DROP INDEX IF EXISTS idx_payments_tenant_created;
-- DROP INDEX IF EXISTS idx_payments_tenant_gateway;
-- DROP INDEX IF EXISTS idx_payments_gateway_payment_id;
-- DROP INDEX IF EXISTS idx_payments_tenant_method;
-- DROP INDEX IF EXISTS idx_payments_tenant_status_updated;
