# Configuração dos serviços Windows (LunaCore + TotemAPI)
# Ajuste estes valores antes de instalar no cliente.

# Portas locais
$LunaCorePort = 18080
$TotemApiPort = 18081

# JWT (mesmo secret nos serviços para facilitar integração)
# IMPORTANTE: em produção, usar um secret forte (>= 256 bits) e NÃO comitar no repo.
$JwtSecret = if ($env:JWT_SECRET) { $env:JWT_SECRET } else { 'dev-only-change-me' }

# Banco (se não setar, cada app usa os defaults do próprio application.yml/properties)
# Exemplo (Neon / Postgres):
# $SpringDatasourceUrl = 'jdbc:postgresql://.../neondb?sslmode=require&currentSchema=luna'
# $SpringDatasourceUsername = 'neondb_owner'
# $SpringDatasourcePassword = '...'
$SpringDatasourceUrl = $null
$SpringDatasourceUsername = $null
$SpringDatasourcePassword = $null

# Integração
$TotemApiBaseUrlFromCore = "http://localhost:$TotemApiPort"

# TotemAPI -> LunaPay
$LunaPayBaseUrl = 'http://localhost:8082'

# URL do Core que o Kiosk deve usar (se você for fixar em config)
$CoreBaseUrl = "http://localhost:$LunaCorePort"
