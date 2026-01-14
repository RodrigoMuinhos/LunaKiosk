# Kiosk PDV V2 — State Machine + Bridges

Este documento descreve o novo módulo **Kiosk V2** (em paralelo ao legado), com foco no core (state machine + orquestração) e nas integrações via bridges locais.

## O que existe hoje (legado)

- O app [LunaKiosk/kiosk-app/App.tsx](../LunaKiosk/kiosk-app/App.tsx) implementa um fluxo simples de **login + busca de consulta + PIX** via TotemAPI, com polling.
- O [LunaKiosk/kiosk-electron/main.cjs](../LunaKiosk/kiosk-electron/main.cjs) sobe/embute uma UI (TotemUI standalone) e abre em modo kiosk.
- Não existe ainda: TEF Stone (cartão), impressão local, persistência SQLite e state machine de PDV.

## Por que a documentação ajuda

- **Convivência segura:** define claramente o que é legado vs. o que é V2 (sem quebrar o antigo).
- **Contrato entre módulos:** interfaces (`PaymentProvider`, `Printer`) e APIs HTTP das bridges deixam o core desacoplado de hardware.
- **Resiliência e idempotência:** descreve responsabilidades do orchestrator (retry, polling status, reidratação após restart).
- **Base para QA:** estados/eventos viram casos de teste previsíveis.

## Visão do V2 (novo)

- Core: [LunaKiosk/kiosk-core/src/kiosk/KioskMachine.ts](../LunaKiosk/kiosk-core/src/kiosk/KioskMachine.ts)
- Orchestrator: [LunaKiosk/kiosk-core/src/kiosk/KioskOrchestrator.ts](../LunaKiosk/kiosk-core/src/kiosk/KioskOrchestrator.ts)
- Bridges:
  - TEF: [LunaKiosk/tef-bridge/src/index.ts](../LunaKiosk/tef-bridge/src/index.ts)
  - Print: [LunaKiosk/print-bridge/src/index.ts](../LunaKiosk/print-bridge/src/index.ts)

## Estados e eventos (mínimo)

Estados (exemplos): `BOOT`, `ATTRACT`, `CART`, `PAYMENT_METHOD`, `PAYMENT_INIT`, `PAYMENT_IN_PROGRESS`, `PAYMENT_APPROVED`, `PRINTING`, `PRINT_ERROR`, `SUCCESS`, ...

Eventos (exemplos): `KIOSK_STARTED`, `PRODUCT_ADDED`, `CART_CONFIRMED`, `PAYMENT_SELECTED_CARD`, `TEF_PROCESSING`, `TEF_APPROVED`, `PRINT_OK`, `PRINT_FAIL`, `RETRY_PRINT`, ...

## Diagrama (alto nível)

```text
BOOT -> ATTRACT -> CART -> PAYMENT_METHOD -> PAYMENT_INIT -> PAYMENT_IN_PROGRESS
                                               |                   |
                                               |                   +-> TEF_APPROVED -> PRINTING -> SUCCESS
                                               |                   +-> TEF_DECLINED -> PAYMENT_DECLINED
                                               |                   +-> TEF_ERROR    -> PAYMENT_ERROR
                                               +-> CANCELLED
```

## Contratos HTTP (localhost)

### TefBridge

- `POST /tef/charge` → `202 { saleId, status: "IN_PROGRESS" }`
- `GET /tef/status/:saleId` → `{ saleId, status, approvedData?, error? }`

### PrintBridge

- `POST /print/receipt` → `{ ok: true, receiptId }`
  - Idempotente por `saleId` (se já imprimiu, retorna o mesmo `receiptId`, a menos que `force=true`).

## Como rodar a demo (dev)

1) Subir bridges:

```bash
cd LunaKiosk/tef-bridge
npm install
npm run dev
```

```bash
cd LunaKiosk/print-bridge
npm install
npm run dev
```

Opcional (Windows/PowerShell): para subir as bridges “destacadas” (sem prender o terminal), rode:

```powershell
Start-Process -FilePath node -WorkingDirectory "$PWD\LunaKiosk\tef-bridge" -ArgumentList @('--enable-source-maps','--loader','ts-node/esm','src/index.ts')
Start-Process -FilePath node -WorkingDirectory "$PWD\LunaKiosk\print-bridge" -ArgumentList @('--enable-source-maps','--loader','ts-node/esm','src/index.ts')
```

Health checks:

- `http://127.0.0.1:7071/api/health`
- `http://127.0.0.1:7072/api/health`

2) Rodar o demo do core (em outro terminal):

```bash
cd LunaKiosk/kiosk-core
npm install
npm run dev:demo
```

Alternativa (V2 com persistência por padrão + bridges com health-check):

```bash
cd LunaKiosk/kiosk-core
npm install
npm run dev:sync-mock   # em um terminal (mock de destino do outbox)

# em outro terminal
set KIOSK_V2_ENABLED=true
npm run dev:v2          # sobe bridges (com health-check) e engine V2
```

Variáveis úteis:

- `USE_PERSISTENT_DB=true|false` (default true)
- `DB_FILE_PATH=./data/kiosk.db`
- `OUTBOX_ENABLED=true|false` (default true)
- `OUTBOX_SYNC_URL=http://127.0.0.1:7090/sync/outbox`
- `TEF_BRIDGE_URL=http://127.0.0.1:7071`
- `PRINT_BRIDGE_URL=http://127.0.0.1:7072`
- `KIOSK_V2_ENABLED=true|false` (default false)

Flags de conveniência:

- `npm run dev:demo -- --reset-db` para apagar o arquivo da base e iniciar do zero.

## Feature Flag

O V2 será ativado por `KIOSK_V2_ENABLED=true` quando integrarmos a UI/roteamento.
