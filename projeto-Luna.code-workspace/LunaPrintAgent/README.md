# Luna Print Agent

Agente local de impressão para totens Luna Vita.

## 📋 Descrição

O Print Agent é uma aplicação Java standalone que roda localmente no totem e é responsável por:

- 🔄 Buscar jobs de impressão pendentes no backend (polling)
- 🖨️ Imprimir recibos na impressora térmica USB conectada
- ✅ Reportar o resultado da impressão ao backend
- 🔁 Retry automático em caso de falhas

## 🛠️ Requisitos

- Java 17 ou superior
- Maven 3.6+
- Impressora térmica 58mm USB (compatível com ESC/POS)
- Acesso à rede para comunicação com o backend

## 🚀 Como Compilar

```bash
mvn clean package
```

Isso gerará o arquivo `target/luna-print-agent.jar` com todas as dependências incluídas.

## ⚙️ Configuração

### 1. Variáveis de Ambiente

Crie um arquivo `.env` ou configure diretamente no sistema:

```env
TERMINAL_ID=TOTEM-001            # ID único do totem
BACKEND_URL=http://localhost:8081  # URL do backend TotemAPI
PRINTER_NAME=                    # Nome da impressora (vazio = padrão)
POLLING_INTERVAL_MS=3000         # Intervalo de busca (3 segundos)
MAX_RETRIES=3                    # Tentativas em caso de falha
```

### 2. Identificar Impressora

Para listar as impressoras disponíveis no sistema:

```bash
java -cp target/luna-print-agent.jar br.lunavita.printagent.service.ThermalPrintService
```

## ▶️ Como Executar

### Modo Desenvolvimento

```bash
java -jar target/luna-print-agent.jar
```

### Modo Produção (com variáveis de ambiente)

Windows PowerShell:
```powershell
$env:TERMINAL_ID="TOTEM-001"
$env:BACKEND_URL="http://localhost:8081"
java -jar target/luna-print-agent.jar
```

Linux/Mac:
```bash
TERMINAL_ID=TOTEM-001 BACKEND_URL=http://localhost:8081 java -jar target/luna-print-agent.jar
```

### Como Serviço (Windows)

Usar NSSM (Non-Sucking Service Manager):

```powershell
nssm install LunaPrintAgent "C:\Program Files\Java\jdk-17\bin\java.exe"
nssm set LunaPrintAgent AppParameters "-jar C:\path\to\luna-print-agent.jar"
nssm set LunaPrintAgent AppDirectory "C:\path\to"
nssm set LunaPrintAgent AppEnvironmentExtra TERMINAL_ID=TOTEM-001 BACKEND_URL=http://localhost:8081
nssm start LunaPrintAgent
```

### Como Serviço (Linux/systemd)

Criar arquivo `/etc/systemd/system/luna-print-agent.service`:

```ini
[Unit]
Description=Luna Print Agent
After=network.target

[Service]
Type=simple
User=luna
Environment="TERMINAL_ID=TOTEM-001"
Environment="BACKEND_URL=http://localhost:8081"
WorkingDirectory=/opt/luna-print-agent
ExecStart=/usr/bin/java -jar /opt/luna-print-agent/luna-print-agent.jar
Restart=always

[Install]
WantedBy=multi-user.target
```

Ativar:
```bash
sudo systemctl enable luna-print-agent
sudo systemctl start luna-print-agent
sudo systemctl status luna-print-agent
```

## 📊 Logs

Os logs são gravados em:
- Console (stdout)
- Arquivo: `logs/luna-print-agent.log` (rotacionado diariamente)

## 🔧 Troubleshooting

### Impressora não encontrada

1. Verifique se a impressora está conectada:
   - Windows: "Dispositivos e Impressoras"
   - Linux: `lpstat -p -d`

2. Liste impressoras disponíveis via Java:
   ```bash
   java -cp target/luna-print-agent.jar br.lunavita.printagent.service.ThermalPrintService
   ```

3. Configure `PRINTER_NAME` corretamente ou deixe vazio para usar a padrão

### Erro de conexão com backend

- Verifique se o TotemAPI está rodando
- Verifique firewall/rede
- Teste: `curl http://localhost:8081/api/print-queue/count-pending?terminalId=TOTEM-001`

### Jobs não são impressos

1. Verifique os logs do agent
2. Verifique se há jobs pendentes no backend:
   ```bash
   curl http://localhost:8081/api/print-queue/pending?terminalId=TOTEM-001
   ```
3. Verifique jobs falhados:
   ```bash
   curl http://localhost:8081/api/print-queue/failed?terminalId=TOTEM-001
   ```

## 🏗️ Arquitetura

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   TotemUI   │────────▶│  TotemAPI    │◀────────│ Print Agent │
│  (Frontend) │  REST   │  (Backend)   │  Polling│   (Local)   │
└─────────────┘         └──────────────┘         └─────────────┘
                               │                         │
                               ▼                         ▼
                        ┌──────────────┐         ┌─────────────┐
                        │  PostgreSQL  │         │  Impressora │
                        │  (PrintJobs) │         │     USB     │
                        └──────────────┘         └─────────────┘
```

### Fluxo de Impressão

1. **Backend**: Gera recibo ESC/POS → Salva como `PrintJob` (status: PENDING)
2. **Agent**: Faz polling → Busca job PENDING → Muda para PRINTING (lock)
3. **Agent**: Imprime na USB → Se sucesso: PRINTED / Se falha: FAILED
4. **Agent**: Reporta resultado ao backend

## 📝 Notas Importantes

- ✅ **Nunca perde recibos**: Jobs são persistidos no banco
- ✅ **Tolerante a falhas**: Retry automático até máximo de tentativas
- ✅ **Não bloqueia o usuário**: Impressão é assíncrona
- ✅ **Reconexão automática**: Imprime quando impressora voltar

## 🔐 Segurança

- O Agent não requer autenticação (roda localmente no totem)
- Comunica-se apenas com o backend configurado
- Logs não contêm dados sensíveis

## 📞 Suporte

Em caso de problemas, verificar:
1. Logs do Agent
2. Logs do backend (TotemAPI)
3. Status da impressora
4. Conectividade de rede
