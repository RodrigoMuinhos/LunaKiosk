# 🖨️ GUIA DE INSTALAÇÃO - SISTEMA DE IMPRESSÃO

## 📋 REQUISITOS

### Hardware
- 💻 PC/Totem Windows 10/11
- 🖨️ Impressora Térmica 58mm USB (compatível ESC/POS)
- 📶 Conexão com internet/rede

### Software
- ☕ Java JDK 17 ou superior
- 🔨 Maven 3.6+ (para compilar)
- 🐘 PostgreSQL (banco de dados)

---

## 🚀 INSTALAÇÃO PASSO A PASSO

### PARTE 1: Instalar Backend (TotemAPI)

#### Opção A: Rodar no próprio totem

```powershell
# 1. Navegar até o projeto
cd C:\Users\RODRIGO\Desktop\OrquestradorLuna\projeto-Luna.code-workspace\LunaTotem\TotemAPI

# 2. Compilar
mvn clean package -DskipTests

# 3. Configurar banco de dados (criar arquivo .env ou variáveis de ambiente)
$env:SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/lunadb"
$env:SPRING_DATASOURCE_USERNAME="postgres"
$env:SPRING_DATASOURCE_PASSWORD="sua-senha"
$env:PORT="8081"

# 4. Iniciar
java -jar target\totem-api.jar
```

#### Opção B: Usar servidor remoto (Railway, Render, VPS)

Se o TotemAPI já está rodando em servidor remoto, apenas anote a URL:
```
Exemplo: https://totem-api.railway.app
```

---

### PARTE 2: Instalar Print Agent (no Totem)

O Print Agent DEVE rodar no totem onde a impressora está conectada.

#### 1. Compilar o Print Agent

```powershell
# Navegar até o projeto
cd C:\Users\RODRIGO\Desktop\OrquestradorLuna\projeto-Luna.code-workspace\LunaPrintAgent

# Compilar
mvn clean package

# Resultado: target\luna-print-agent.jar
```

#### 2. Verificar Impressora

```powershell
# Listar impressoras disponíveis no Windows
Get-Printer | Select-Object Name, DriverName, PortName

# Ou ver em:
# Painel de Controle > Dispositivos e Impressoras
```

Anote o **nome exato da impressora**, por exemplo:
- `POS-58`
- `Generic Thermal Printer`
- `USB001`
- Ou deixe vazio para usar a impressora padrão

#### 3. Configurar Print Agent

Crie um arquivo `start-agent-config.ps1`:

```powershell
# CONFIGURAÇÃO DO PRINT AGENT
# Edite os valores abaixo

# ID único deste totem (importante se tiver vários totems)
$env:TERMINAL_ID = "TOTEM-001"

# URL do backend (local ou remoto)
$env:BACKEND_URL = "http://localhost:8081"
# OU se estiver em servidor remoto:
# $env:BACKEND_URL = "https://totem-api.railway.app"

# Nome da impressora (vazio = impressora padrão do Windows)
$env:PRINTER_NAME = ""
# OU específica:
# $env:PRINTER_NAME = "POS-58"

# Intervalo de busca por jobs (em milissegundos)
$env:POLLING_INTERVAL_MS = "3000"

# Máximo de tentativas em caso de falha
$env:MAX_RETRIES = "5"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   Luna Print Agent - Iniciando..." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Terminal ID    : $env:TERMINAL_ID" -ForegroundColor Yellow
Write-Host "Backend URL    : $env:BACKEND_URL" -ForegroundColor Yellow
Write-Host "Impressora     : $(if($env:PRINTER_NAME){"$env:PRINTER_NAME"}else{"PADRÃO"})" -ForegroundColor Yellow
Write-Host "Polling        : $env:POLLING_INTERVAL_MS ms" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Cyan

# Iniciar o agent
java -jar target\luna-print-agent.jar
```

#### 4. Testar o Agent (primeira vez)

```powershell
# Executar o script
.\start-agent-config.ps1
```

Você verá algo assim:
```
==================================================
   Luna Print Agent v1.0.0
   Iniciando...
==================================================
Configuração carregada:
  - Terminal ID: TOTEM-001
  - Backend URL: http://localhost:8081
  - Impressora: POS-58
  - Intervalo de polling: 3000ms
==================================================
   Agent iniciado com sucesso!
   Aguardando jobs de impressão...
==================================================
```

#### 5. Testar Impressão

Em outro terminal, teste criando um job manualmente:

```powershell
# Criar um job de teste (ajuste a URL se necessário)
$body = @{
    terminalId = "TOTEM-001"
    tenantId = "teste"
    receiptType = "PAYMENT"
    payload = "REVNL0BpbmljLnByaW50ZXIKCg=="  # ESC/POS test
    priority = 0
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8081/api/print-queue/enqueue" `
    -Method POST `
    -Body $body `
    -ContentType "application/json"
```

Se funcionou, você verá no terminal do agent:
```
Job recebido: abc-123 (tipo: PAYMENT, tentativa: 1/5)
Imprimindo em: POS-58
✅ Job abc-123 impresso com sucesso
```

---

### PARTE 3: Instalar como Serviço Windows (Produção)

Para o agent rodar sempre (mesmo após reiniciar o PC):

#### Opção A: Usar NSSM (Recomendado)

```powershell
# 1. Baixar NSSM
# https://nssm.cc/download
# Extrair para: C:\tools\nssm

# 2. Instalar como serviço
C:\tools\nssm\win64\nssm.exe install LunaPrintAgent

# Na janela que abrir, configure:
# Path: C:\Program Files\Java\jdk-17\bin\java.exe
# Startup directory: C:\caminho\para\LunaPrintAgent
# Arguments: -jar target\luna-print-agent.jar

# 3. Configurar variáveis de ambiente no NSSM
C:\tools\nssm\win64\nssm.exe set LunaPrintAgent AppEnvironmentExtra ^
    TERMINAL_ID=TOTEM-001 ^
    BACKEND_URL=http://localhost:8081 ^
    PRINTER_NAME=

# 4. Iniciar serviço
C:\tools\nssm\win64\nssm.exe start LunaPrintAgent

# 5. Verificar status
C:\tools\nssm\win64\nssm.exe status LunaPrintAgent
```

#### Opção B: Task Scheduler (Alternativa)

```powershell
# Criar tarefa agendada que inicia no boot
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -File C:\caminho\para\start-agent-config.ps1"

$trigger = New-ScheduledTaskTrigger -AtStartup

$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest

Register-ScheduledTask -TaskName "LunaPrintAgent" `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Description "Luna Print Agent - Sistema de Impressão"
```

---

## 🧪 TESTE COMPLETO DO FLUXO

### 1. Backend rodando
```powershell
curl http://localhost:8081/actuator/health
# Deve retornar: {"status":"UP"}
```

### 2. Agent rodando
Verifique o terminal do agent ou logs:
```
logs/luna-print-agent.log
```

### 3. Fazer um pagamento no Totem UI

O fluxo automático será:
1. ✅ Usuário paga no totem
2. ✅ Backend enfileira job de impressão
3. ✅ Agent detecta job (polling)
4. ✅ Agent imprime recibo
5. ✅ Agent reporta sucesso
6. ✅ Job marcado como PRINTED

### 4. Verificar jobs no banco

```sql
-- Jobs pendentes
SELECT * FROM luna.print_jobs WHERE status = 'PENDING';

-- Jobs impressos hoje
SELECT * FROM luna.print_jobs 
WHERE status = 'PRINTED' 
AND DATE(printed_at) = CURRENT_DATE;

-- Jobs falhados
SELECT * FROM luna.print_jobs WHERE status = 'FAILED';
```

---

## 📊 MONITORAMENTO

### Logs do Agent
```
logs/luna-print-agent.log
```

### Endpoints úteis

```powershell
# Contar jobs pendentes
curl "http://localhost:8081/api/print-queue/count-pending?terminalId=TOTEM-001"

# Listar jobs pendentes
curl "http://localhost:8081/api/print-queue/pending?terminalId=TOTEM-001"

# Listar jobs falhados
curl "http://localhost:8081/api/print-queue/failed?terminalId=TOTEM-001"

# Liberar jobs travados (manutenção)
curl -X POST "http://localhost:8081/api/print-queue/maintenance/release-stale?minutesThreshold=10"
```

---

## ❌ TROUBLESHOOTING

### Erro: "Impressora não encontrada"

```powershell
# Verificar impressoras
Get-Printer | Select-Object Name

# Listar via Java
java -cp target/luna-print-agent.jar br.lunavita.printagent.service.ThermalPrintService

# Solução: Configurar PRINTER_NAME correto ou deixar vazio
```

### Erro: "Não conecta no backend"

```powershell
# Testar conectividade
curl http://localhost:8081/actuator/health

# Ou se remoto:
curl https://totem-api.railway.app/actuator/health

# Verificar firewall
# Verificar BACKEND_URL no agent
```

### Jobs ficam em PENDING

```powershell
# 1. Verificar se agent está rodando
Get-Process java

# 2. Verificar logs
Get-Content logs\luna-print-agent.log -Tail 50

# 3. Verificar TERMINAL_ID
# Deve bater com os jobs no banco
```

### Impressora imprime caracteres estranhos

A impressora pode não ser compatível com ESC/POS padrão.
- Verificar manual da impressora
- Testar com driver específico
- Configurar emulação ESC/POS nas configurações da impressora

---

## 📝 CHECKLIST DE INSTALAÇÃO

- [ ] Java 17+ instalado
- [ ] PostgreSQL rodando
- [ ] TotemAPI compilado e rodando (porta 8081)
- [ ] Impressora térmica conectada via USB
- [ ] Driver da impressora instalado no Windows
- [ ] Print Agent compilado (luna-print-agent.jar)
- [ ] Configuração do agent ajustada (TERMINAL_ID, BACKEND_URL, PRINTER_NAME)
- [ ] Agent testado e imprimindo
- [ ] Agent instalado como serviço Windows
- [ ] Teste completo: pagamento → impressão automática

---

## 🎯 RESULTADO ESPERADO

Após a instalação completa:

1. ✅ Usuário realiza pagamento no totem
2. ✅ Recibo é **automaticamente enfileirado**
3. ✅ Agent **busca e imprime** em até 3 segundos
4. ✅ Usuário recebe recibo impresso
5. ✅ Sistema **nunca perde recibos** (mesmo com impressora off)
6. ✅ **Retry automático** em caso de falhas temporárias

---

## 📞 SUPORTE

Em caso de problemas:
1. Verificar logs do agent: `logs/luna-print-agent.log`
2. Verificar logs do backend (TotemAPI)
3. Testar impressora manualmente no Windows
4. Verificar conectividade de rede
5. Consultar documentação completa: `SISTEMA-IMPRESSAO-ASSINCRONA.md`
