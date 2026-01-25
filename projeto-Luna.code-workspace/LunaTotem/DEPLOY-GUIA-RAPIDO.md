# 🚀 GUIA RÁPIDO DE DEPLOY - MODO SIMULADO

## 🎯 Objetivo

Fazer deploy do sistema Luna Totem **sem precisar de chave Asaas**, usando apenas o **modo simulado** de impressão.

---

## 📋 PRÉ-REQUISITOS

- [ ] Conta no Railway (backend)
- [ ] Conta no Vercel (frontend)
- [ ] Repositório GitHub conectado
- [ ] Git instalado localmente

---

## 🔧 PASSO 1: Preparar Repositório

### 1.1 Limpar dados sensíveis

Verifique se não há arquivos sensíveis commitados:

```bash
# Procurar por .env
git status

# Remover do cache se necessário
git rm --cached .env
git rm --cached **/.env.local
```

### 1.2 Garantir .gitignore

Arquivos criados:
- ✅ `TotemAPI/.gitignore`
- ✅ `TotemUI/.gitignore`

### 1.3 Commit e Push

```bash
cd projeto-Luna.code-workspace/LunaTotem

git add .
git commit -m "feat: adiciona .gitignore e prepara para deploy simulado"
git push origin main
```

---

## 🚂 PASSO 2: Deploy TotemAPI (Railway)

### 2.1 Criar Projeto

1. Acesse: https://railway.app
2. **New Project** → **Deploy from GitHub repo**
3. Selecione o repositório: `LunaTotem`
4. Root directory: `projeto-Luna.code-workspace/LunaTotem/TotemAPI`

### 2.2 Adicionar PostgreSQL

1. Na dashboard do projeto: **+ New** → **Database** → **PostgreSQL**
2. Aguardar provisionamento

### 2.3 Configurar Variáveis

Clique no serviço **TotemAPI** → Aba **Variables**

**Copie as variáveis do PostgreSQL automaticamente:**
- `DATABASE_URL` (já está conectado)

**Adicione manualmente:**

```bash
# JWT (gerar chave)
JWT_SECRET=AbC123XyZ789...32caracteres...

# Criptografia (gerar chave)
TOTEM_ENCRYPTION_KEY=XyZ987AbC321...32caracteres...

# CORS (ajustar depois do deploy Vercel)
CORS_ALLOWED_ORIGINS=*

# Email (opcional)
RESEND_API_KEY=re_xxxxxxxx
RESEND_FROM_EMAIL=noreply@seudominio.com
```

**📝 Gerar chaves:**
```bash
# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Linux/Mac
openssl rand -base64 32
```

### 2.4 Deploy

Railway faz deploy automático. Aguarde ~3 minutos.

### 2.5 Testar

Copie a URL gerada (ex: `https://totemapi-production-abc123.up.railway.app`)

Teste:
```bash
curl https://sua-url.railway.app/actuator/health
```

Resposta esperada:
```json
{"status":"UP"}
```

---

## ▲ PASSO 3: Deploy TotemUI (Vercel)

### 3.1 Criar Projeto

1. Acesse: https://vercel.com
2. **Add New** → **Project**
3. Import do GitHub: Selecione repositório `LunaTotem`

### 3.2 Configurar Build

- **Framework Preset:** Next.js
- **Root Directory:** `projeto-Luna.code-workspace/LunaTotem/TotemUI`
- **Build Command:** `npm run build` (automático)
- **Output Directory:** `.next` (automático)

### 3.3 Variáveis de Ambiente

Antes de fazer deploy, clique em **Environment Variables**:

```bash
# URL do backend Railway (COPIAR DO PASSO 2.5)
NEXT_PUBLIC_API_URL=https://sua-url.railway.app

# Modo simulado (IMPORTANTE!)
NEXT_PUBLIC_ENABLE_SIMULATED_PIX=true

# Timeout PIX (opcional)
NEXT_PUBLIC_PIX_POLL_TIMEOUT_MS=300000
```

**Aplicar para:** Production, Preview, Development

### 3.4 Deploy

Clique em **Deploy**. Aguarde ~2 minutos.

### 3.5 Atualizar CORS no Railway

Após deploy Vercel, copie a URL (ex: `https://luna-totem.vercel.app`)

**Voltar ao Railway:**
1. TotemAPI → Variables
2. Editar `CORS_ALLOWED_ORIGINS`
3. Trocar `*` por: `https://luna-totem.vercel.app`
4. Salvar (redeploy automático)

---

## ✅ PASSO 4: Testar Sistema Completo

### 4.1 Acessar Frontend

```
https://sua-url.vercel.app
```

### 4.2 Fazer Login

Use credenciais de teste ou crie usuário.

### 4.3 Fluxo de Teste

1. **Selecionar agendamento**
   - Clique em "Buscar agendamento"
   - Digite CPF ou nome
   - Selecione da lista

2. **Escolher pagamento**
   - Selecione qualquer método (débito, crédito, PIX)
   - Clique em **"Simular pagamento"**

3. **Verificar impressão**
   - Console deve mostrar: `[PRINT] ✅ Recibo enfileirado`
   - Backend registra o job na fila

4. **Verificar backend**
   ```bash
   curl https://sua-url.railway.app/api/print-queue/jobs
   ```

### 4.4 Logs

**Vercel:**
- Dashboard → Seu projeto → Deployments → Último → Runtime Logs

**Railway:**
- Dashboard → TotemAPI → Deployments → Último → View Logs

---

## 🖨️ PASSO 5: Impressão Real (Opcional)

Se quiser testar impressão localmente conectando ao deploy:

```bash
cd projeto-Luna.code-workspace/LunaPrintAgent

# Configurar
$env:TERMINAL_ID='TOTEM-001'
$env:BACKEND_URL='https://sua-url.railway.app'
$env:PRINTER_NAME='POS-58'

# Executar
java -jar target/luna-print-agent.jar
```

O agent vai:
- Conectar no backend Railway
- Buscar jobs a cada 3s
- Imprimir recibos da fila

---

## 🎯 RESULTADO FINAL

✅ **Frontend:** https://sua-url.vercel.app
✅ **Backend:** https://sua-url.railway.app
✅ **Modo:** Simulado (sem Asaas)
✅ **Funciona:** Pagamento simulado + Impressão (se agent rodando)
❌ **Não funciona:** PIX real (erro 502, mas OK para testes)

---

## 🐛 TROUBLESHOOTING

### Erro CORS

**Problema:** `blocked by CORS policy`

**Solução:**
1. Railway → TotemAPI → Variables
2. Verificar `CORS_ALLOWED_ORIGINS` tem URL correta do Vercel
3. Redeploy

### Erro 503 Service Unavailable

**Problema:** Backend não está respondendo

**Solução:**
1. Railway → TotemAPI → Deployments → Ver logs
2. Procurar por erros de inicialização
3. Verificar variáveis de banco de dados

### Build failed no Vercel

**Problema:** Erro de compilação TypeScript

**Solução:**
1. Verificar código localmente: `npm run build`
2. Corrigir erros TypeScript
3. Commit e push
4. Vercel redeploy automático

### Database connection failed

**Problema:** TotemAPI não conecta no PostgreSQL

**Solução:**
1. Railway → PostgreSQL → Connect
2. Copiar `DATABASE_URL` exata
3. Verificar se está em `SPRING_DATASOURCE_URL`

---

## 📚 PRÓXIMOS PASSOS

Depois do deploy simulado funcionando:

1. ✅ Testar fluxo completo de agendamento
2. ✅ Verificar persistência de dados
3. ✅ Configurar domínio customizado (Vercel + Railway)
4. ✅ Adicionar monitoring (Vercel Analytics, Railway Observability)
5. 🔒 Configurar chave Asaas para PIX real (quando necessário)

---

**Tempo estimado:** 30-45 minutos
**Custo:** Grátis (planos free do Railway e Vercel)
**Dificuldade:** ⭐⭐⭐ Intermediário
