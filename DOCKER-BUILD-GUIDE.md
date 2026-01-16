# 🐳 Docker Build & Deployment - Sistema Luna Completo

## 🎯 Overview

Sistema completo com 4 serviços orquestrados:
- **LunaCore** (8080): Backend principal
- **TotemAPI** (8081): API do Totem + **Webhook GHL** 
- **LunaPay** (8082): Gateway de pagamentos
- **TotemUI** (3000): Interface web do totem

## 🚀 Quick Start

### 1️⃣ Build & Start Todos os Serviços
```bash
docker-compose up -d --build
```

### 2️⃣ Verificar Status
```bash
docker-compose ps
```

### 3️⃣ Ver Logs
```bash
# Todos os serviços
docker-compose logs -f

# Apenas TotemAPI (webhook GHL)
docker-compose logs -f totemapi

# Últimas 100 linhas
docker-compose logs --tail=100 -f
```

### 4️⃣ Parar Serviços
```bash
docker-compose down
```

---

## 📦 Comandos Úteis

### Build Individual
```bash
# Rebuild apenas TotemAPI
docker-compose build totemapi

# Rebuild sem cache
docker-compose build --no-cache totemapi
```

### Restart Individual
```bash
docker-compose restart totemapi
```

### Executar Comandos Dentro do Container
```bash
# Shell no TotemAPI
docker-compose exec totemapi sh

# Ver logs do Java
docker-compose exec totemapi tail -f /app/logs/application.log
```

### Limpeza
```bash
# Parar e remover containers
docker-compose down

# Remover volumes também (CUIDADO: apaga dados!)
docker-compose down -v

# Limpar tudo (containers, networks, volumes)
docker system prune -a --volumes
```

---

## 🔧 Configuração

### Variáveis de Ambiente

Edite `.env` na raiz do projeto:

```bash
# Database
SPRING_DATASOURCE_URL=jdbc:postgresql://ep-lingering-paper-adck7igg-pooler.c-2.us-east-1.aws.neon.tech/neondb?currentSchema=luna
SPRING_DATASOURCE_USERNAME=neondb_owner
SPRING_DATASOURCE_PASSWORD=npg_8ILmFPEdxr5J

# JWT
JWT_SECRET=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9_ABCD1234efgh5678IJKL91011MNOP121314QRSTUV151617WXYZ181990

# GHL Webhook
WEBHOOK_GHL_TOKEN=ln16012x26

# Asaas
ASAAS_ENVIRONMENT=production
ASAAS_PROD_API_KEY='$aact_prod_...'
ASAAS_PROD_WALLET_ID=8d250b71-b36b-4af9-922a-756674910df0
```

### Portas Expostas

| Serviço | Porta | Endpoint |
|---------|-------|----------|
| LunaCore | 8080 | http://localhost:8080 |
| TotemAPI | 8081 | http://localhost:8081 |
| LunaPay | 8082 | http://localhost:8082 |
| TotemUI | 3000 | http://localhost:3000 |

---

## 🌐 Webhook GHL no Docker

### Testar Webhook (container rodando)
```powershell
$headers = @{
    'Content-Type' = 'application/json'
    'x-webhook-token' = 'ln16012x26'
}

$body = @{
    contact_id = 'docker_test_' + (Get-Date -Format 'yyyyMMddHHmmss')
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

### Monitorar Logs do Webhook
```bash
docker-compose logs -f totemapi | grep "\[GHL\]"
```

---

## 🔍 Healthcheck

Todos os serviços têm healthcheck configurado:

```bash
# Ver status de saúde
docker-compose ps

# Testar manualmente
curl http://localhost:8081/actuator/health
```

Resposta esperada:
```json
{
  "status": "UP",
  "components": {
    "db": {"status": "UP"},
    "diskSpace": {"status": "UP"},
    "ping": {"status": "UP"}
  }
}
```

---

## 📊 Monitoramento

### Logs Estruturados
```bash
# JSON logs
docker-compose logs totemapi --since 5m | jq .

# Filtrar erros
docker-compose logs totemapi | grep ERROR

# Filtrar webhooks GHL
docker-compose logs totemapi | grep "\[GHL\]"
```

### Métricas (Actuator)
```bash
# Metrics
curl http://localhost:8081/actuator/metrics

# Specific metric
curl http://localhost:8081/actuator/metrics/jvm.memory.used
```

---

## 🔒 Segurança

### Secrets Management
Nunca commite `.env` com secrets reais. Use:

1. **Local Development**: `.env` local (gitignored)
2. **Docker Secrets**: Para produção
3. **Railway/Cloud**: Variables de ambiente na plataforma

### Network Isolation
```yaml
# Serviços se comunicam por rede interna
networks:
  luna-network:
    driver: bridge
```

---

## 🚢 Deploy para Produção

### Railway (Recomendado)
```bash
# Railway detecta Dockerfile automaticamente
railway up
```

### Docker Swarm
```bash
docker stack deploy -c docker-compose.yml luna
```

### Kubernetes
```bash
# Gerar manifests
kompose convert

# Deploy
kubectl apply -f kubernetes/
```

---

## 🐛 Troubleshooting

### Container não inicia
```bash
# Ver logs completos
docker-compose logs totemapi

# Inspecionar container
docker inspect luna-totemapi

# Ver processos
docker-compose top totemapi
```

### Erro de conexão com banco
```bash
# Verificar variáveis
docker-compose config

# Testar conexão manualmente
docker-compose exec totemapi sh
apk add postgresql-client
psql $SPRING_DATASOURCE_URL
```

### Porta já em uso
```bash
# Encontrar processo usando a porta
netstat -ano | findstr :8081

# Matar processo
taskkill /PID <process_id> /F
```

---

## 📈 Performance

### Otimizações Aplicadas
- ✅ Multi-stage build (imagem final ~200MB)
- ✅ Layer caching para Maven dependencies
- ✅ JRE Alpine (base mínima)
- ✅ Container limits (70% RAM)
- ✅ G1GC garbage collector
- ✅ Graceful shutdown
- ✅ Health checks configurados

### Recursos Recomendados

**Desenvolvimento:**
```yaml
deploy:
  resources:
    limits:
      cpus: '1'
      memory: 1G
```

**Produção:**
```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '1'
      memory: 1G
```

---

## 🔄 CI/CD

### GitHub Actions (exemplo)
```yaml
name: Docker Build & Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build TotemAPI
        run: |
          cd projeto-Luna.code-workspace/LunaTotem/TotemAPI
          docker build -t totemapi:latest .
      
      - name: Push to Registry
        run: docker push totemapi:latest
```

---

## ✅ Checklist de Deploy

- [ ] Variáveis de ambiente configuradas
- [ ] Secrets seguros (não commitados)
- [ ] Healthchecks funcionando
- [ ] Logs visíveis e estruturados
- [ ] Webhook GHL testado
- [ ] Database migrations aplicadas
- [ ] Backups configurados
- [ ] Monitoring configurado
- [ ] Alertas configurados

---

## 📚 Referências

- [Docker Compose Docs](https://docs.docker.com/compose/)
- [Spring Boot Docker](https://spring.io/guides/topicals/spring-boot-docker/)
- [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Railway Deploy](https://docs.railway.app/)

---

## 🆘 Suporte

**Ver todos os comandos:**
```bash
docker-compose --help
```

**Status completo:**
```bash
docker-compose ps -a
docker-compose logs --tail=50
docker stats
```

**Reset completo (development only):**
```bash
docker-compose down -v --remove-orphans
docker system prune -af --volumes
docker-compose up -d --build
```
