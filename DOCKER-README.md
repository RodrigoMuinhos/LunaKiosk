# 🐳 Docker Setup - Sistema Luna

Guia completo para executar o Sistema Luna com Docker.

## 📋 Pré-requisitos

- Docker Desktop 4.0+ instalado
- Docker Compose 2.0+
- 4GB RAM disponível (mínimo)
- 10GB espaço em disco

## 🚀 Quick Start

### Opção 1: PowerShell (Recomendado)

```powershell
# Build e iniciar todos os serviços
.\docker-build.ps1 build
.\docker-build.ps1 start

# Ver status
.\docker-build.ps1 status

# Ver logs
.\docker-build.ps1 logs

# Testar webhook GHL
.\docker-build.ps1 test-ghl
```

### Opção 2: Make (se tiver Make instalado)

```bash
# Build e iniciar
make build
make start

# Ver status
make status

# Modo desenvolvimento (com logs)
make dev
```

### Opção 3: Docker Compose direto

```bash
# Build
docker-compose build

# Iniciar
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar
docker-compose down
```

## 📦 Serviços Disponíveis

| Serviço | Porta | URL | Descrição |
|---------|-------|-----|-----------|
| **LunaCore** | 8080 | http://localhost:8080 | Core backend service |
| **TotemAPI** | 8081 | http://localhost:8081 | API backend com webhook GHL |
| **LunaPay** | 8082 | http://localhost:8082 | Payment service |
| **TotemUI** | 3000 | http://localhost:3000 | Frontend React |

### 🔗 Endpoints Importantes

- **LunaCore Health**: http://localhost:8080/actuator/health
- **TotemAPI Health**: http://localhost:8081/actuator/health
- **TotemAPI Swagger**: http://localhost:8081/swagger-ui.html
- **GHL Webhook**: http://localhost:8081/api/webhooks/ghl/patients

## 🔧 Configuração

### 1. Arquivo .env

Crie ou edite o arquivo `.env` na raiz:

```env
# Database (Neon PostgreSQL)
NEON_TOTEMAPI_URL=jdbc:postgresql://ep-lingering-paper-adck7igg-pooler.us-west-2.aws.neon.tech/luna?sslmode=require
SPRING_DATASOURCE_URL=jdbc:postgresql://ep-lingering-paper-adck7igg-pooler.us-west-2.aws.neon.tech/luna?sslmode=require
SPRING_DATASOURCE_USERNAME=luna_owner
SPRING_DATASOURCE_PASSWORD=<sua-senha>

# JWT
JWT_SECRET=<sua-chave-jwt>

# GoHighLevel Webhook
WEBHOOK_GHL_TOKEN=ln16012x26

# ASAAS
ASAAS_API_KEY=<sua-chave-asaas>
ASAAS_WEBHOOK_TOKEN=<seu-token-webhook>
```

### 2. Variáveis Sensíveis

**⚠️ NUNCA commite credenciais reais!**

As variáveis no `.env` são substituídas no build. Para produção, use:

- **Railway**: Configure no dashboard
- **Docker Secrets**: Para orquestração avançada
- **Vault**: Para ambientes enterprise

## 🏗️ Build Process

### Build Normal

```bash
docker-compose build
```

### Build sem Cache (forçar rebuild)

```bash
docker-compose build --no-cache
```

### Build de um serviço específico

```bash
docker-compose build totemapi
```

## 🎯 Comandos Úteis

### Ver Status

```bash
docker-compose ps
```

### Ver Logs

```bash
# Todos os serviços
docker-compose logs -f

# Serviço específico
docker-compose logs -f totemapi

# Últimas 100 linhas
docker-compose logs --tail=100 totemapi
```

### Reiniciar Serviço

```bash
docker-compose restart totemapi
```

### Entrar no Container

```bash
docker-compose exec totemapi sh
```

### Health Check Completo

```powershell
.\healthcheck.ps1

# Com detalhes
.\healthcheck.ps1 -Detailed

# Output JSON
.\healthcheck.ps1 -Json
```

## 🧪 Testando o Sistema

### 1. Verificar se tudo está rodando

```powershell
.\healthcheck.ps1
```

### 2. Testar Webhook GHL

```powershell
.\docker-build.ps1 test-ghl
```

Ou manualmente:

```powershell
$headers = @{
    'Content-Type' = 'application/json'
    'x-webhook-token' = 'ln16012x26'
}

$body = @{
    contact_id = 'test_123'
    event_type = 'contact.create'
    full_name = 'Teste Docker'
    cpf = '12345678900'
    phone = '11999999999'
    email = 'teste@docker.local'
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri 'http://localhost:8081/api/webhooks/ghl/patients' `
    -Method POST `
    -Headers $headers `
    -Body $body
```

### 3. Verificar Logs do Webhook

```bash
docker-compose logs totemapi | grep "\[GHL\]"
```

## 🔍 Troubleshooting

### Problema: Container não inicia

```bash
# Ver logs detalhados
docker-compose logs totemapi

# Verificar se porta está ocupada
netstat -ano | findstr :8081

# Remover e recriar
docker-compose down
docker-compose up -d
```

### Problema: Erro de conexão com banco

```bash
# Verificar variáveis de ambiente
docker-compose exec totemapi env | grep SPRING

# Testar conexão manualmente
docker-compose exec totemapi curl -v telnet://ep-lingering-paper-adck7igg-pooler.us-west-2.aws.neon.tech:5432
```

### Problema: Build muito lento

```bash
# Verificar .dockerignore
cat .dockerignore

# Limpar cache do Docker
docker builder prune -af

# Build com output verboso
docker-compose build --progress=plain totemapi
```

### Problema: "port already in use"

```powershell
# Parar todos os containers
docker-compose down

# Matar processos Java locais
Get-Process | Where-Object {$_.ProcessName -like '*java*'} | Stop-Process -Force

# Reiniciar
docker-compose up -d
```

## 🧹 Limpeza

### Parar tudo

```bash
docker-compose down
```

### Parar e remover volumes

```bash
docker-compose down -v
```

### Limpeza completa (cuidado!)

```powershell
.\docker-build.ps1 clean
```

Ou:

```bash
docker-compose down -v --remove-orphans
docker system prune -af --volumes
```

## 🚀 Deploy em Produção

### Railway

```bash
# Usar Dockerfile do projeto
railway up

# Ou via git
git push railway main
```

### Docker Swarm

```bash
docker stack deploy -c docker-compose.yml -c docker-compose.prod.yml luna
```

### Kubernetes

```bash
# Converter docker-compose para k8s
kompose convert

# Deploy
kubectl apply -f .
```

## 📊 Monitoramento

### Métricas

- **Spring Actuator**: http://localhost:8081/actuator/metrics
- **Prometheus**: Adicionar prometheus.yml
- **Grafana**: Dashboards pré-configurados

### Health Checks

```bash
# LunaCore
curl http://localhost:8080/actuator/health

# TotemAPI
curl http://localhost:8081/actuator/health

# LunaPay
curl http://localhost:8082/actuator/health
```

## 🔐 Segurança

### Boas Práticas

1. ✅ Use `.env` para secrets (nunca commite!)
2. ✅ Configure firewall/security groups
3. ✅ Use HTTPS em produção
4. ✅ Limite recursos (memory/CPU)
5. ✅ Configure log rotation
6. ✅ Use health checks
7. ✅ Monitore containers

### Scan de Vulnerabilidades

```bash
# Trivy (recomendado)
trivy image totemapi:latest

# Docker Scan
docker scan totemapi:latest
```

## 📚 Recursos Adicionais

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Spring Boot Docker Guide](https://spring.io/guides/topicals/spring-boot-docker/)
- [CONFIGURAR-GHL-WEBHOOK.md](./CONFIGURAR-GHL-WEBHOOK.md) - Configuração do webhook GHL

## 🆘 Suporte

### Logs Detalhados

```bash
# Exportar logs para análise
docker-compose logs > logs-$(date +%Y%m%d-%H%M%S).txt
```

### Informações do Sistema

```bash
docker version
docker-compose version
docker info
docker-compose config
```

---

**✅ Sistema validado com webhook GHL funcionando perfeitamente!**

Desenvolvido com ❤️ para Sistema Luna
