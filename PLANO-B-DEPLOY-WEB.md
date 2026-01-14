# Plano B — Deploy WEB (TotemUI) com Docker Compose

Objetivo: deixar o **TotemUI acessível via navegador** sem depender do Electron/Kiosk.

A ideia aqui é: **o navegador chama `http(s)://SEU_HOST/api/...`** e o TotemUI (Next.js) **faz proxy** para o TotemAPI por dentro da rede do Docker.

## ✅ O que já está preparado no código

- `TotemUI/src/lib/apiConfig.ts`: agora aceita `NEXT_PUBLIC_LUNATOTEM_API_URL=/` para usar **same-origin**.
- `TotemUI/next.config.js`: adiciona **rewrites (fallback)** para encaminhar:
  - `/api/*` -> `http://totemapi:8081/api/*`
  - `/actuator/*` -> `http://totemapi:8081/actuator/*`
  - (sem quebrar `/api/health` do próprio TotemUI)
- `docker-compose.yml`: TotemUI sobe com `NEXT_PUBLIC_LUNATOTEM_API_URL=/` e `TOTEM_API_PROXY_URL=http://totemapi:8081`.

## Pré-requisitos (máquina de deploy)

- Docker + Docker Compose (no Windows, **Docker Desktop**)
- Portas liberadas no firewall (no mínimo):
  - 3000 (TotemUI)
  - (opcional) 8080/8081/8082 se você quiser expor APIs diretamente — **não recomendado**

## Passo a passo (rápido)

1. **Subir Docker Desktop**

- No Windows: abrir o Docker Desktop e esperar ficar “Running”.

1. **Configurar `.env`**

- O arquivo `.env` na raiz é lido pelo `docker-compose.yml`.
- Garanta pelo menos: `JWT_SECRET`, `NEON_*_URL`, `ASAAS_*` (se for usar pagamento)

> Observação: se alguma chave começar com `$` (ex: Asaas), mantenha entre aspas simples `'...'`.

1. **Subir os serviços**

- Subir tudo (recomendado): `lunacore`, `totemapi`, `lunapay`, `totemui`.

1. **Validar health**

- TotemUI: `http://SEU_HOST:3000/api/health`
- LunaCore: `http://SEU_HOST:8080/actuator/health`
- TotemAPI: `http://SEU_HOST:8081/actuator/health`
- LunaPay: `http://SEU_HOST:8082/actuator/health`

## Como o cliente acessa

- URL principal: `http://SEU_HOST:3000`

Se você tiver um domínio (ideal):

- `https://totem.sua-clinica.com` apontando para a máquina
- (opcional) colocar um proxy HTTPS (Nginx/Caddy/Cloudflare Tunnel)

## Observações importantes

- Esse plano evita CORS porque o browser bate no TotemUI e o TotemUI encaminha para o TotemAPI.
- Se o TotemAPI estiver fora do docker (ex: rodando nativo), dá pra trocar o alvo do proxy com `TOTEM_API_PROXY_URL`.

## Checklist de “amanhã cedo”

- [ ] Docker Desktop rodando
- [ ] `.env` preenchido (principalmente banco e JWT)
- [ ] `docker-compose up -d --build`
- [ ] Acessar `http://SEU_HOST:3000`
- [ ] Login (usuários de teste ou usuário real)
