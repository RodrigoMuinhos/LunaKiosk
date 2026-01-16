# 🔧 Configurar CORS no Railway (TotemAPI)

## 🚨 Problema

Erro de CORS ao acessar o Vercel:
```
Access to fetch at 'https://appealing-appreciation-production.up.railway.app/api/auth/login' 
from origin 'https://luna-kiosk.vercel.app' has been blocked by CORS policy
```

## ✅ Solução

Configurar a variável `ALLOWED_ORIGINS` no Railway para permitir o domínio do Vercel.

---

## 📋 Passo a Passo

### 1️⃣ Acessar Railway
https://railway.app/project/appealing-appreciation

### 2️⃣ Selecionar o Serviço
- Clique no serviço **TotemAPI** (ou o container que roda o backend)

### 3️⃣ Ir em Variables
- Clique na aba **Variables**

### 4️⃣ Configurar ALLOWED_ORIGINS

**Nome da variável:**
```
ALLOWED_ORIGINS
```

**Valor:**
```
https://luna-kiosk.vercel.app,http://localhost:3000
```

> ⚠️ **Importante:** Sem espaços entre as vírgulas!

### 5️⃣ Salvar e Redesploy
1. Clique em **Save** (ou Add Variable)
2. O Railway vai redesployar automaticamente
3. Aguarde ~1-2 minutos

---

## 🔍 Como Verificar

Após redesploy, abra o console do navegador em https://luna-kiosk.vercel.app:

✅ **DEVE funcionar:**
```
[TOTEM AUTO-LOGIN] Iniciando login automático...
[API] Login response: {status: 200, statusText: 'OK'}
[TOTEM AUTO-LOGIN] ✅ Login automático realizado com sucesso
```

❌ **NÃO deve aparecer:**
```
has been blocked by CORS policy
```

---

## 🐛 Troubleshooting

### CORS ainda bloqueado
- Verifique se `ALLOWED_ORIGINS` está exatamente: `https://luna-kiosk.vercel.app,http://localhost:3000`
- Verifique se não há espaços extras
- Redesploy manualmente: Clique em **Deployments** → **...** → **Redeploy**

### Railway não aceita variável
- Certifique-se de estar editando o serviço correto (TotemAPI, não LunaCore)
- Verifique se você tem permissões de administrador

### Erro persiste após redesploy
- Limpe o cache do navegador: **Ctrl+Shift+R** (Windows) ou **Cmd+Shift+R** (Mac)
- Teste em janela anônima

---

## 📝 Código de Referência

Arquivo: `TotemAPI/src/main/java/br/lunavita/totemapi/config/CorsConfig.java`

```java
@Value("${ALLOWED_ORIGINS:https://lunavitatotem.vercel.app,http://localhost:3000}")
private String allowedOrigins; // comma-separated list of origins
```

Isso lê a variável de ambiente `ALLOWED_ORIGINS` e separa por vírgula.

---

## ✨ Resultado

Após configurar, o TotemUI no Vercel conseguirá:
- ✅ Fazer auto-login
- ✅ Buscar appointments
- ✅ Criar pagamentos
- ✅ Todas as operações de API

🎉 Sistema totalmente funcional cross-origin!
