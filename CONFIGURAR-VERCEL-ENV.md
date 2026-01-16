# 🚀 Configurar Variáveis de Ambiente no Vercel

## 📋 Instruções

Acesse o dashboard do Vercel e configure as seguintes variáveis de ambiente:

**URL:** https://vercel.com/rodrigomuinhos/luna-kiosk/settings/environment-variables

---

## ⚙️ Variáveis de Ambiente Necessárias

### 🔗 URLs dos Serviços (Railway)

```
NEXT_PUBLIC_LUNACORE_URL=https://appealing-appreciation-production.up.railway.app
NEXT_PUBLIC_LUNATOTEM_API_URL=https://appealing-appreciation-production.up.railway.app
NEXT_PUBLIC_LUNAPAY_URL=https://appealing-appreciation-production.up.railway.app
NEXT_PUBLIC_API_URL=https://appealing-appreciation-production.up.railway.app
```

### ☁️ Cloudflare R2

```
R2_PUBLIC_URL=https://pub-59812e445a4c4fd38663f7cb852f3c24.r2.dev
VIDEO_PLAYLIST_URL=https://luna-kiosk.vercel.app/api/videos/playlist-r2
NEXT_PUBLIC_VIDEO_PLAYLIST_URL=https://luna-kiosk.vercel.app/api/videos/playlist-r2
```

### 🔐 Credenciais Auto-Login Totem

```
NEXT_PUBLIC_TOTEM_EMAIL=totem@lunavita.com.br
NEXT_PUBLIC_TOTEM_PASSWORD=totem123
```

---

## 📸 Passo a Passo

### 1️⃣ Acessar Settings
1. Vá para https://vercel.com/rodrigomuinhos/luna-kiosk
2. Clique em **Settings**
3. Clique em **Environment Variables**

### 2️⃣ Adicionar Variáveis
Para cada variável:
1. Clique em **Add New**
2. Cole o **nome** (ex: `NEXT_PUBLIC_LUNACORE_URL`)
3. Cole o **valor** (ex: `https://appealing-appreciation-production.up.railway.app`)
4. Selecione **Production, Preview, Development**
5. Clique em **Save**

### 3️⃣ Redeployar
Após adicionar todas as variáveis:
1. Vá em **Deployments**
2. Clique nos **...** do último deployment
3. Clique em **Redeploy**
4. Aguarde o build completar (~2 minutos)

---

## ✅ Verificar

Após redeploy, acesse https://luna-kiosk.vercel.app e verifique no console:
- ✅ `[TOTEM AUTO-LOGIN] ✅ Login automático realizado com sucesso`
- ❌ Não deve mais aparecer "Internal Server Error"

---

## 🔧 Comandos Úteis

### Verificar variáveis localmente
```bash
cd projeto-Luna.code-workspace/LunaTotem/TotemUI
cat .env.production
```

### Testar build local com env de produção
```bash
npm run build
npm run start
```

---

## 📝 Notas Importantes

- ⚠️ O arquivo `.env.production` **NÃO** é commitado (está no `.gitignore`)
- ⚠️ Variáveis `NEXT_PUBLIC_*` são expostas no browser (não use secrets)
- ⚠️ Após adicionar/mudar variáveis, **sempre redesploy**
- ✅ As credenciais do totem são seguras pois é um usuário de serviço limitado

---

## 🐛 Troubleshooting

### Erro "Internal Server Error" no login
- Verifique se `NEXT_PUBLIC_LUNACORE_URL` está configurada
- Confirme que o Railway está rodando (https://railway.app/project/appealing-appreciation)
- Teste o endpoint: `curl https://appealing-appreciation-production.up.railway.app/health`

### Erro 401 Unauthorized
- Verifique se o usuário `totem@lunavita.com.br` existe no banco
- Execute: `node scripts-nodejs/criar-usuario-totem-simples.js`
- Confirme password: `totem123`

### Vídeos não carregam
- Verifique `R2_PUBLIC_URL`
- Teste: `curl https://pub-59812e445a4c4fd38663f7cb852f3c24.r2.dev`

---

## ✨ Pronto!

Após configurar tudo, o TotemUI no Vercel irá:
1. ✅ Fazer auto-login automaticamente
2. ✅ Conectar no LunaCore/TotemAPI no Railway
3. ✅ Carregar vídeos do Cloudflare R2
4. ✅ Processar pagamentos via Asaas

🎉 Sistema totalmente funcional em produção!
