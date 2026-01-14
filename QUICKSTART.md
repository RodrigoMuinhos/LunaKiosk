# 🚀 INÍCIO RÁPIDO - LunaVita Docker

## ⚡ Comando Rápido

```powershell
cd C:\Users\RODRIGO\Desktop\OrquestradorLuna
.\docker.ps1 start
```

Aguarde 30-40 segundos e acesse: **http://localhost:3000**

## 📋 Pré-requisitos

- ✅ Docker Desktop instalado e rodando
- ✅ 8GB RAM disponível (recomendado)
- ✅ 5GB espaço em disco

## 🎯 Comandos Essenciais

```powershell
# Iniciar tudo
.\docker.ps1 start

# Ver logs em tempo real
.\docker.ps1 logs

# Verificar status
.\docker.ps1 status

# Health check
.\docker.ps1 health

# Parar tudo
.\docker.ps1 stop

# Reiniciar
.\docker.ps1 restart

# Rebuild completo
.\docker.ps1 build
```

## 🔐 Login

| Email | Senha | Perfil |
|-------|-------|--------|
| adm@lunavita.com | 123456 | Administração |
| recepcao@lunavita.com | 123456 | Recepção |
| medico@lunavita.com | 123456 | Médico |

## 🌐 URLs

- Frontend: http://localhost:3000
- LunaCore: http://localhost:8080
- TotemAPI: http://localhost:8081
- LunaPay: http://localhost:8082

## ⚠️ Troubleshooting

### Erro "port already in use"
```powershell
# Ver o que está usando a porta
netstat -ano | findstr :8080
netstat -ano | findstr :3000

# Parar processos locais
Get-Process | Where-Object {$_.ProcessName -like "*java*"} | Stop-Process -Force
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Stop-Process -Force

# Iniciar containers
.\docker.ps1 start
```

### Container não inicia
```powershell
# Ver logs específicos
docker-compose logs lunacore
docker-compose logs totemui

# Rebuild do serviço problemático
docker-compose up --build lunacore
```

### Resetar tudo
```powershell
.\docker.ps1 clean  # Atenção: apaga banco de dados!
.\docker.ps1 build
.\docker.ps1 start
```

## 📦 Deploy em Servidor

### Usando Docker
```bash
# Clonar projeto
git clone <seu-repo>
cd OrquestradorLuna

# Editar .env (IMPORTANTE: trocar senhas!)
nano .env

# Iniciar
docker-compose up -d

# Verificar
docker-compose ps
```

### Usando Cloud (Azure/AWS/GCP)
1. Push das imagens para registry
2. Configurar managed database (PostgreSQL)
3. Deploy dos containers
4. Configurar DNS e HTTPS

## 📊 Monitoramento

```powershell
# CPU e memória
docker stats

# Espaço em disco
docker system df

# Limpar cache (sem afetar volumes)
docker system prune -f
```

## 🔧 Customização

Edite `docker-compose.yml` para ajustar:
- Portas
- Limites de CPU/Memory
- Variáveis de ambiente
- Networks adicionais

Consulte `README.md` para detalhes completos.
