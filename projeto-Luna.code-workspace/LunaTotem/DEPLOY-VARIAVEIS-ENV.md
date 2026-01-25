# 🚀 VARIÁVEIS DE AMBIENTE PARA DEPLOY

## 📋 TotemUI (Frontend Next.js) - Vercel

### Variáveis Obrigatórias

```bash
# API Backend
NEXT_PUBLIC_API_URL=https://seu-totem-api.railway.app

# Configuração PIX
NEXT_PUBLIC_PIX_POLL_TIMEOUT_MS=300000
```

### Configuração na Vercel

1. Acesse: https://vercel.com/seu-projeto/settings/environment-variables
2. Adicione cada variável acima
3. Selecione: `Production`, `Preview`, `Development`
4. Clique em **Save**

---

## 🚂 TotemAPI (Backend Spring Boot) - Railway

### Variáveis Obrigatórias

```bash
# Database (PostgreSQL - Railway)
SPRING_DATASOURCE_URL=jdbc:postgresql://postgres.railway.internal:5432/railway
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=<gerado-pelo-railway>

# JWT Security
JWT_SECRET=<gerar-chave-256-bits>
# Gerar: openssl rand -base64 32

# CORS - Frontend URL
CORS_ALLOWED_ORIGINS=https://seu-totem-ui.vercel.app

# LGPD - Criptografia de dados sensíveis
TOTEM_ENCRYPTION_KEY=<gerar-chave-256-bits>
# Gerar: openssl rand -base64 32

# Email (Resend)
RESEND_API_KEY=re_<sua-chave-resend>
RESEND_FROM_EMAIL=noreply@seudominio.com

# Webhook GHL (opcional)
GHL_WEBHOOK_SECRET=<seu-secret>
```

### Variáveis Opcionais (para impressão local)

```bash
# Print System (se usar impressão remota)
PRINT_ENABLED=false
```

### Configuração no Railway

1. Acesse: https://railway.app/project/seu-projeto
2. Clique no serviço **TotemAPI**
3. Aba **Variables**
4. Clique em **+ New Variable**
5. Adicione cada variável acima
6. Clique em **Deploy** para aplicar

---

## 🧪 MODO SIMULADO (Teste sem PIX Real)

Para testar impressão automática **sem** precisar de chave Asaas:

### No TotemUI (Vercel)

**Variável adicional:**
```bash
NEXT_PUBLIC_ENABLE_SIMULATED_PIX=true
```

Com essa variável:
- ✅ Botão "Simular pagamento" funciona normalmente
- ✅ Recibo é gerado e enfileirado
- ✅ Impressão automática funciona
- ❌ PIX real **não** funciona (erro 502, mas não importa para testes)

### Fluxo de Teste Simulado

1. **Deploy TotemUI na Vercel**
   ```bash
   NEXT_PUBLIC_API_URL=https://seu-totem-api.railway.app
   NEXT_PUBLIC_ENABLE_SIMULATED_PIX=true
   ```

2. **Deploy TotemAPI no Railway**
   - Configure todas as variáveis obrigatórias acima
   - **NÃO precisa** de chave Asaas

3. **Teste no navegador:**
   - Acesse: `https://seu-totem-ui.vercel.app`
   - Selecione um agendamento
   - Escolha qualquer método de pagamento
   - Clique em **"Simular pagamento"**
   - ✅ Recibo é enfileirado e impresso (se agent estiver rodando)

---

## 🖨️ LunaPrintAgent (Opcional - Local/Edge)

Se quiser impressão funcionando:

### Executar localmente (conectando ao Railway):

```bash
TERMINAL_ID=TOTEM-001
BACKEND_URL=https://seu-totem-api.railway.app
PRINTER_NAME=POS-58
```

**Comando:**
```bash
cd LunaPrintAgent
$env:TERMINAL_ID='TOTEM-001'
$env:BACKEND_URL='https://seu-totem-api.railway.app'
$env:PRINTER_NAME='POS-58'
java -jar target/luna-print-agent.jar
```

---

## 📝 CHECKLIST DE DEPLOY

### ✅ Antes do Deploy

- [ ] Criar chave JWT: `openssl rand -base64 32`
- [ ] Criar chave de criptografia: `openssl rand -base64 32`
- [ ] Criar conta Resend (email)
- [ ] Provisionar PostgreSQL no Railway
- [ ] Anotar URL do TotemAPI após deploy Railway
- [ ] Configurar CORS com URL do Vercel

### ✅ Deploy TotemAPI (Railway)

- [ ] Criar novo projeto no Railway
- [ ] Conectar repositório GitHub
- [ ] Adicionar PostgreSQL Database
- [ ] Configurar variáveis de ambiente
- [ ] Aguardar build e deploy
- [ ] Testar health: `https://xxx.railway.app/actuator/health`

### ✅ Deploy TotemUI (Vercel)

- [ ] Criar novo projeto no Vercel
- [ ] Conectar repositório GitHub
- [ ] Framework Preset: **Next.js**
- [ ] Root Directory: `projeto-Luna.code-workspace/LunaTotem/TotemUI`
- [ ] Adicionar variáveis de ambiente
- [ ] Deploy

### ✅ Teste Simulado

- [ ] Acessar URL do Vercel
- [ ] Login com usuário teste
- [ ] Selecionar agendamento
- [ ] Clicar em "Simular pagamento"
- [ ] Verificar console: `[PRINT] ✅ Recibo enfileirado`
- [ ] Verificar backend: `GET /api/print-queue/jobs`

---

## 🔐 SEGURANÇA - NUNCA COMMITAR

❌ **NÃO ADICIONAR AO GIT:**
- Chaves JWT
- Chaves de criptografia
- Senhas de banco de dados
- API Keys (Resend, Asaas, etc)
- Arquivos `.env`, `.env.local`, `.env.production`

✅ **PODE COMMITAR:**
- `.env.example` (sem valores reais)
- `.gitignore`
- Configurações públicas

---

## 🆘 TROUBLESHOOTING

### Erro 502 ao criar PIX

**Causa:** Falta chave Asaas ou LunaPay não configurado

**Solução:** Use modo simulado (`NEXT_PUBLIC_ENABLE_SIMULATED_PIX=true`)

### CORS Error

**Causa:** Frontend não está na whitelist do backend

**Solução:** Adicionar URL do Vercel em `CORS_ALLOWED_ORIGINS`

### Database Connection Failed

**Causa:** Variáveis do PostgreSQL incorretas

**Solução:** Copiar credenciais exatas do Railway (aba Connect)

### JWT Invalid

**Causa:** Chave JWT diferente entre deploys

**Solução:** Usar a mesma chave em todos os ambientes

---

## 📚 Links Úteis

- **Railway Dashboard:** https://railway.app
- **Vercel Dashboard:** https://vercel.com
- **PostgreSQL Railway:** Aba "Data" no projeto
- **Logs Railway:** Aba "Deployments" → Último deploy → Logs
- **Logs Vercel:** Aba "Deployments" → Último deploy → Runtime Logs

---

**Última atualização:** 25/01/2026
