# LunaVita Docker - Guia Rápido

## 🚀 Início Rápido

### 1. Configuração Inicial
```powershell
# Copiar arquivo de exemplo de variáveis de ambiente
Copy-Item .env.docker.example .env

# Editar .env com suas credenciais
notepad .env
```

### 2. Iniciar Serviços
```powershell
./docker.ps1 start
```

Aguarde 60 segundos para todos os serviços ficarem prontos.

**URLs dos Serviços:**
- TotemUI (Frontend): http://localhost:3000
- LunaCore (Auth): http://localhost:8080
- TotemAPI (Clinical): http://localhost:8081
- LunaPay (Payment): http://localhost:8082

### 3. Health Check
```powershell
./docker.ps1 health
```

## 📋 Comandos Principais

### Gerenciamento Básico
```powershell
./docker.ps1 start       # Iniciar todos os serviços
./docker.ps1 stop        # Parar todos os serviços
./docker.ps1 restart     # Reiniciar todos os serviços
./docker.ps1 status      # Ver status dos containers
```

### Logs e Debugging
```powershell
./docker.ps1 logs              # Ver logs de todos os serviços
./docker.ps1 logs lunacore     # Ver logs de um serviço específico
./docker.ps1 health            # Verificar health de todos os serviços
./docker-maintenance.ps1 check # Diagnóstico completo
```

### Build e Atualizações
```powershell
./docker.ps1 build              # Build dos serviços
./docker.ps1 rebuild            # Rebuild sem cache + restart
./docker.ps1 rebuild lunacore   # Rebuild de serviço específico
./docker.ps1 update             # Pull + Build + Restart
```

### Manutenção
```powershell
./docker-maintenance.ps1 check   # Verificar saúde do sistema
./docker-maintenance.ps1 fix     # Limpar espaço e corrigir problemas
./docker-maintenance.ps1 backup  # Backup dos volumes
./docker-maintenance.ps1 inspect # Inspecionar serviço específico
```

### Limpeza
```powershell
./docker.ps1 prune       # Limpar recursos não utilizados
./docker.ps1 clean       # Parar e remover tudo (⚠️ apaga volumes)
./docker-maintenance.ps1 reset  # Reset completo do sistema
```

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────┐
│          TotemUI (Next.js)                  │
│         http://localhost:3000               │
└──────────────┬──────────────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼──────┐      ┌──────▼───────┐      ┌────────────┐
│ LunaCore │      │  TotemAPI    │      │  LunaPay   │
│  :8080   │◄─────│    :8081     │      │   :8082    │
└──────────┘      └──────────────┘      └─────┬──────┘
     │                   │                     │
     │                   │                     │
┌────▼───────────────────▼─────────────────────▼─────┐
│         Neon PostgreSQL (Cloud)                    │
│  lunacore DB | totemapi DB | lunapay DB           │
└───────────────────────────────────────────────────┘
```

## 📦 Volumes Persistentes

Os seguintes dados são persistidos em volumes Docker:

- `lunacore-logs` - Logs do LunaCore
- `lunapay-logs` - Logs do LunaPay
- `totemapi-logs` - Logs do TotemAPI
- `totemapi-uploads` - Arquivos enviados (vídeos, documentos)

**Backup dos volumes:**
```powershell
./docker-maintenance.ps1 backup
```

**Restaurar backup:**
```powershell
./docker-maintenance.ps1 restore
```

## 🔧 Troubleshooting

### Serviço não inicia
```powershell
# Verificar logs
./docker.ps1 logs lunacore

# Inspecionar container
./docker-maintenance.ps1 inspect

# Rebuild sem cache
./docker.ps1 rebuild lunacore
```

### Erro de conexão com banco de dados
1. Verificar `.env` com credenciais corretas
2. Verificar se URLs do Neon estão corretas
3. Verificar se `sslmode=require` está presente nas URLs

### Falta de espaço em disco
```powershell
# Ver uso de espaço
docker system df

# Limpar recursos não utilizados
./docker-maintenance.ps1 fix
```

### Porta já em uso
```powershell
# Windows - Verificar processos usando portas
netstat -ano | findstr :8080
netstat -ano | findstr :8081
netstat -ano | findstr :8082
netstat -ano | findstr :3000

# Matar processo (substitua PID)
taskkill /PID <PID> /F
```

### Reset completo
```powershell
# Parar tudo e remover volumes
./docker.ps1 clean

# Ou reset mais profundo
./docker-maintenance.ps1 reset
```

## 🔒 Segurança

### Variáveis de Ambiente Obrigatórias
```env
JWT_SECRET=<mínimo 256 bits>
NEON_LUNACORE_URL=jdbc:postgresql://...?sslmode=require
NEON_TOTEMAPI_URL=jdbc:postgresql://...?sslmode=require
NEON_LUNAPAY_URL=jdbc:postgresql://...?sslmode=require
```

### Produção
1. ⚠️ **NUNCA** commitar arquivo `.env`
2. ⚠️ Usar JWT secret forte e único
3. ⚠️ Mudar `ASAAS_ENVIRONMENT=production` apenas em produção
4. ✅ Manter credenciais de produção seguras
5. ✅ Usar SSL para banco de dados (sslmode=require)

## 📊 Monitoramento

### Health Checks
Todos os serviços têm health checks automáticos:
- Intervalo: 30 segundos
- Timeout: 5 segundos  
- Start period: 60 segundos
- Retries: 3

### Endpoints de Health
- LunaCore: http://localhost:8080/actuator/health
- TotemAPI: http://localhost:8081/actuator/health
- LunaPay: http://localhost:8082/actuator/health
- TotemUI: http://localhost:3000/api/health

## 🐳 Atualizações Implementadas

### Imagens Base
- ✅ Java 21.0.2_13 (Eclipse Temurin)
- ✅ Node.js 22 LTS
- ✅ Maven 3.9.9

### Otimizações
- ✅ Multi-stage builds para tamanho reduzido
- ✅ Melhor caching de dependências
- ✅ G1 Garbage Collector para Java
- ✅ Graceful shutdown configurado
- ✅ Health checks com curl (mais confiável)
- ✅ Volumes persistentes para logs e uploads
- ✅ Restart automático (unless-stopped)
- ✅ Usuários não-root por segurança

### Scripts
- ✅ `docker.ps1` - Gerenciamento principal
- ✅ `docker-maintenance.ps1` - Manutenção e troubleshooting
- ✅ `.dockerignore` otimizados
- ✅ `.env.docker.example` com documentação

## 📚 Recursos Adicionais

- **Documentação Docker**: https://docs.docker.com
- **Docker Compose**: https://docs.docker.com/compose
- **Neon PostgreSQL**: https://neon.tech/docs
- **Spring Boot Docker**: https://spring.io/guides/topicals/spring-boot-docker
- **Next.js Docker**: https://nextjs.org/docs/deployment#docker-image

## 🆘 Suporte

Em caso de problemas:

1. Execute diagnóstico completo:
   ```powershell
   ./docker-maintenance.ps1 check
   ```

2. Verifique logs dos serviços:
   ```powershell
   ./docker.ps1 logs
   ```

3. Tente correções automáticas:
   ```powershell
   ./docker-maintenance.ps1 fix
   ```

4. Se persistir, faça reset:
   ```powershell
   ./docker-maintenance.ps1 reset
   ./docker.ps1 start
   ```
