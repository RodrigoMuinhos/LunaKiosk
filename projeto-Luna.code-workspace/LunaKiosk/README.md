# LunaKiosk

App de modo **kiosk** (totem/tablet) do ecossistema Luna.

## Objetivo

- Rodar como **React Native** (Expo) em tablet/Android/iOS.
- Rodar em desktop Windows como **Electron** (kiosk fullscreen).
- Consumir **TotemAPI** para agendamentos e **TotemAPI** como BFF para pagamentos (TotemAPI chama LunaPay por trás).
- Login/Token: **LunaCore** (JWT). O token do LunaCore é enviado para o TotemAPI.

## Arquitetura (fluxo)

1. Kiosk faz login em `LunaCore` (`/auth/login`) e guarda o JWT.
2. Kiosk chama `TotemAPI` (ex.: `/api/appointments/search`) com `Authorization: Bearer ...`.
3. Para PIX, Kiosk chama `TotemAPI` (`POST /api/payments/pix`) com o mesmo JWT.
4. `TotemAPI` valida o JWT (emitido pelo LunaCore) e **chama LunaPay por trás**.
5. Kiosk faz polling em `TotemAPI` (`GET /api/payments/status/{paymentId}`) até `PAID`.
6. Quando pago, Kiosk atualiza o status da consulta no TotemAPI (`PUT /api/appointments/{id}/status`).

## Pastas

- `kiosk-app/` → Expo (React Native + web)
- `kiosk-electron/` → Electron wrapper (desktop kiosk)

## Rodar (dev)

### Pré-requisitos
- Node.js (>= 20)
- Java 21 + Maven (para subir TotemAPI)
- Subir os backends:
  - LunaCore: `http://localhost:8080`
  - TotemAPI: `http://localhost:8081`
  - LunaPay: `http://localhost:8082` (TotemAPI chama por trás)

### Se 8080/8081 já estiverem em uso

Em algumas máquinas, as portas `8080` e/ou `8081` já ficam ocupadas por outros processos (ex.: Docker/WSL ou outro backend local).

Para dev local, você pode usar:

- LunaCore em `http://localhost:18080`
- TotemAPI em `http://localhost:18081`
- LunaPay continua em `http://localhost:8082`

O LunaKiosk permite configurar `CORE_BASE_URL` e `TOTEM_BASE_URL` na primeira tela.

Também deixei tarefas do VS Code em `.vscode/tasks.json`:

- `Start Backend Stack (alt ports)`
- `Start LunaKiosk Desktop (web + electron)`

### Kiosk App

```bash
cd LunaKiosk/kiosk-app
npm install
npm run start
```

### Electron (dev)

1) Suba o web dev server do Expo:

```bash
cd LunaKiosk/kiosk-app
npm run web
```

2) Em outro terminal:

```bash
cd LunaKiosk/kiosk-electron
npm install
npm run dev
```

## Configuração

No app, configure:
- `CORE_BASE_URL` (ex.: `http://localhost:8080`)
- `TOTEM_BASE_URL` (ex.: `http://localhost:8081`)

> O `LUNAPAY_BASE_URL` é configuração do TotemAPI (`lunapay.base-url`).
