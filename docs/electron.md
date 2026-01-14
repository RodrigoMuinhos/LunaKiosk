# Electron Desktop (LunaCore + TotemAPI + LunaPay + TotemUI embutido)

Este repositório já tem um app Electron em `projeto-Luna.code-workspace/LunaKiosk/kiosk-electron`.

Ajustes feitos para **empacotar e (opcionalmente) iniciar automaticamente**:

- `LunaCore` (8080)
- `TotemAPI` (8081)
- `LunaPay` (8082)
- `TotemUI` (Next.js standalone embutido no Electron, porta interna padrão 19007)

## Pré-requisitos (Windows)

- Node.js instalado
- Java (JDK/JRE) disponível no PATH (comando `java`)
- (Para gerar os JARs) Maven disponível (comando `mvn`)

## Variáveis de ambiente

- Use `.env` (ignorado pelo git) para configurar DB/JWT/Asaas.
- Use `.env.example` como referência (não contém segredos).

> Observação: o Electron tenta carregar `.env` automaticamente.

Locais suportados (em ordem de prioridade):

1. `KIOSK_ENV_FILE=C:\caminho\para\.env` (explícito)
2. `.env` ao lado do executável (`LunaKiosk.exe` / portable)
3. `.env` em `userData` (ex.: `%LOCALAPPDATA%\LunaKiosk\userData\.env`)
4. (dev) procura subindo diretórios a partir do `cwd`

### Asaas (pagamentos)

Em builds empacotados, o app valida as credenciais do Asaas na inicialização para evitar travar o fluxo do PIX.

- Produção: exige `ASAAS_PROD_API_KEY` e `ASAAS_PROD_WALLET_ID`
- Sandbox: exige `ASAAS_SANDBOX_API_KEY` e `ASAAS_SANDBOX_WALLET_ID`

Para desativar a validação (não recomendado em kiosk):

- `KIOSK_REQUIRE_ASAAS=false`

Se sua máquina tiver políticas/antivírus bloqueando escrita em `%LOCALAPPDATA%`, você pode forçar um diretório alternativo:

- `KIOSK_USERDATA_DIR=C:\Temp\LunaKiosk`

## Build dos serviços (gera JARs)

O Electron empacota os JARs **já compilados** (saem em `target/*.jar`).

Você pode compilar tudo pelo script do repositório:

- `build-all-unified.bat`

## Sincronizar JARs para o Electron

Antes de gerar o instalador, copie os JARs para dentro do projeto Electron:

- `projeto-Luna.code-workspace/LunaKiosk/kiosk-electron/backend-jars/`

Isso é feito por:

- `npm run sync:backend` (dentro de `kiosk-electron`)

## Sincronizar TotemUI (Next.js standalone) para o Electron

Para garantir que o instalador leve sempre a UI mais recente, o build também refaz o `next build` do TotemUI e copia o output standalone para dentro do Electron:

- `npm run sync:totemui` (dentro de `kiosk-electron`)

## Rodar em modo dev (para teste)

Dentro de `projeto-Luna.code-workspace/LunaKiosk/kiosk-electron`:

- `npm run start` (ou `electron .`)

O app:

- tenta subir os backends (se não estiverem respondendo)
- sobe TotemUI embutido
- abre a janela na Home do Totem (`/`)

### Se você já tem backend rodando fora

Defina:

- `KIOSK_SKIP_BACKENDS=true`

Assim o Electron só abre a UI embutida.

### Se o app estiver abrindo direto no CRM (/system)

Isso geralmente acontece por sessão antiga salva no `localStorage`.

Use:

- `KIOSK_CLEAR_SESSION_ON_START=true`

### Se der conflito de porta

Se algum serviço já estiver usando as portas 8080/8081/8082, você pode:

- parar os processos existentes **ou**
- ajustar as portas via env:
  - `LUNACORE_PORT=...`
  - `TOTEMAPI_PORT=...`
  - `LUNAPAY_PORT=...`

Para a UI embutida, a porta padrão é `KIOSK_PORT=19007`, mas o Electron pode escolher automaticamente uma porta livre (a partir da preferida) se detectar conflito.

### Se aparecer erro de cache/GPU ("Acesso negado")

Em alguns Windows o Chromium pode falhar ao criar/mover o cache. Nesse caso, habilite:

- `KIOSK_DISABLE_GPU=true`

### Se o login der "Failed to fetch" (CORS / preflight)

Quando o TotemUI embutido roda em uma porta local (ex.: `http://localhost:19007`) e o backend está em `http://localhost:8080`, o navegador pode bloquear chamadas por CORS.

Para ambiente kiosk/local, o Electron aplica um workaround para permitir essas chamadas.

Se você quiser **forçar o comportamento mais restrito** (webSecurity ligado), use:

- `KIOSK_ENABLE_WEB_SECURITY=true`

Se quiser desativar a tentativa de injetar headers CORS (raramente necessário), use:

- `KIOSK_DISABLE_CORS_WORKAROUND=true`

## Build do instalador (Windows)

Dentro de `projeto-Luna.code-workspace/LunaKiosk/kiosk-electron`:

- `npm run build`

Para **garantir que cada build saia com um nome diferente** (e fique óbvio qual é o mais novo), use:

- `npm run build:tagged`

Esse comando gera os artefatos com um nome “técnico”, no padrão:

- `LunaKiosk-Setup-vX.Y.Z-patch-YYYYMMDD-HHMMSS.exe`
- `LunaKiosk-Portable-vX.Y.Z-patch-YYYYMMDD-HHMMSS.exe`

O build faz:

- `npm run sync:backend`
- `npm run sync:totemui`
- `electron-builder --win --x64`

Saída em:

- `projeto-Luna.code-workspace/LunaKiosk/kiosk-electron/dist/`
