# Deploy: TotemUI no Vercel + Back no Railway

Este guia é o caminho mais rápido e confiável para subir o **Plano B**:

- **Frontend (TotemUI / Next.js)** no **Vercel**
- **Backends (Spring Boot)** no **Railway**

A estratégia recomendada é **same-origin no browser**:

- O browser chama `https://SEU_TOTEMUI.vercel.app/api/...`
- O TotemUI (Vercel) faz proxy via `rewrites()` para o TotemAPI no Railway

Assim você evita CORS, e não precisa expor LunaCore/LunaPay diretamente para o navegador.

---

## 1) Railway (Backends)

### Monorepo no Railway (1 repo → 3 services)

Você **não precisa dividir o repositório** no GitHub.

No Railway você cria **vários Services apontando para o mesmo repo**, e em **cada Service** você configura o **Root Directory** (pasta base) para o backend correspondente.

> Se o Root Directory ficar vazio, o Railway vai tentar buildar o **repo root**.
> Como o repo root tem `package.json`, ele pode detectar **Node** e falhar com:
> `Detected Node` / `No start command was found`.

Passo-a-passo (Railway UI):

1. Railway → Project → **New Service**
2. **GitHub Repo** → selecione `RodrigoMuinhos/LunaKiosk` (branch `main`)
3. Depois de criar o Service: **Settings → Source → Root Directory**
4. Cole o path correto (abaixo) e salve
5. Faça **Redeploy** do service

### Serviços recomendados

Crie **3 services** no Railway (pode ser no mesmo Project):

1. `lunacore`
2. `totemapi`
3. `lunapay`

> Observação: o TotemUI usa o TotemAPI como **facade** (`/api/*`). O TotemAPI integra com LunaCore/LunaPay via URLs internas (Railway domains).

### Root directory / build

Como é monorepo, em cada Service do Railway configure o **Root Directory**:

- `projeto-Luna.code-workspace/LunaCore/lunacore`
- `projeto-Luna.code-workspace/LunaTotem/TotemAPI`
- `projeto-Luna.code-workspace/LunaPay/lunapay-api`

Checklist rápido se der erro de build:

- Se aparecer `Detected Node` / `No start command was found` → o **Root Directory está errado/vazio**.
- Se o Railway não detectar Java/Docker mesmo com Root Directory correto:
  - confira se o path existe exatamente (sem espaços a mais)
  - confirme que dentro da pasta há `pom.xml` e/ou `Dockerfile`
  - redeploy após salvar o Root Directory

Se o Railway detectar Dockerfile, ok; caso use buildpack, também funciona, mas Docker tende a ser mais previsível.

### Variáveis de ambiente (Railway)

Em **cada** service, configure (mínimo):

- `JWT_SECRET` (igual em todos)
- `SPRING_DATASOURCE_URL` (JDBC Neon do service)

E também:

#### `totemapi`

- `SPRING_PROFILES_ACTIVE=production` (ou `docker`, conforme sua config)
- `LUNACORE_URL=https://<dominio-do-lunacore-no-railway>`
- `LUNAPAY_URL=https://<dominio-do-lunapay-no-railway>`

#### `lunapay`

- `SPRING_PROFILES_ACTIVE=production`
- `ASAAS_ENVIRONMENT=production` (ou sandbox)
- `ASAAS_PROD_API_KEY=...`
- `ASAAS_PROD_WALLET_ID=...`
- (se usar sandbox: `ASAAS_SANDBOX_API_KEY`, `ASAAS_SANDBOX_WALLET_ID`)

> Porta: o código já aceita `PORT` do Railway (e também `SERVER_PORT`).

### Healthcheck

Depois do deploy, valide:

- `https://<lunacore>/actuator/health`
- `https://<totemapi>/actuator/health`
- `https://<lunapay>/actuator/health`

---

## 2) Vercel (TotemUI)

### Projeto

Crie um projeto no Vercel e aponte para o diretório:

- `projeto-Luna.code-workspace/LunaTotem/TotemUI`

O `vercel.json` já existe e define build/install.

### Environment Variables (Vercel)

Configure em **Production** (e Preview se precisar):

- `NEXT_PUBLIC_LUNATOTEM_API_URL=/`
- `TOTEM_API_PROXY_URL=https://<dominio-do-totemapi-no-railway>`
- `LUNACORE_PROXY_URL=https://<dominio-do-lunacore-no-railway>`

> Dica: deixe `TOTEM_API_PROXY_URL` **sem barra no final**.
> Dica: deixe `LUNACORE_PROXY_URL` **sem barra no final**.

### Como validar

- Abrir: `https://SEU_TOTEMUI.vercel.app`
- Testar health do frontend:
  - `https://SEU_TOTEMUI.vercel.app/api/health`

E testar um endpoint real do backend via proxy:

- `https://SEU_TOTEMUI.vercel.app/api/auth/login` (espera 401/400 se sem payload, mas não pode dar CORS/404)

---

## 3) O que entregar pro cliente

- URL do TotemUI (Vercel)
- Credenciais de acesso
- Checklist de teste:
  - Login
  - Fluxo de agendamento
  - Pagamento (se habilitado)

---

## Troubleshooting rápido

### 404 em /api/*

- Verifique `TOTEM_API_PROXY_URL` no Vercel
- Verifique se o TotemAPI está UP no Railway

### 502/504 no proxy

- TotemAPI demorando para responder (cold start) ou derrubando
- Veja logs do service `totemapi` no Railway

### Login funciona, pagamento não

- Confirme `LUNAPAY_URL` no TotemAPI apontando pro domínio correto
- Confirme variáveis do Asaas no `lunapay`
