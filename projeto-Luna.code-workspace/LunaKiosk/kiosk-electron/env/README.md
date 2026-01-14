# Pasta `env/`

Arquivos de exemplo para facilitar o teste do LunaKiosk (Electron) **sem depender de variáveis setadas em terminal**.

## Como usar

1) Escolha o exemplo (produção): `kiosk.production.env.example`
2) Copie/renomeie para `.env`
3) Coloque o `.env` em um destes locais:

### Portable

- Na **mesma pasta** do `LunaKiosk-Portable-...exe`

### Instalado (Setup)

- `%LOCALAPPDATA%\\Programs\\LunaKiosk\\.env`

### Alternativo (userData)

- `%LOCALAPPDATA%\\LunaKiosk\\userData\\.env`

## Importante

- Nunca commite segredos.
- Se você vazou uma API key (ex.: Asaas), o correto é **rotacionar/revogar** e atualizar os arquivos `.env`.
