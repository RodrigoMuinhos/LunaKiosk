# 🚀 GUIA DE INICIALIZAÇÃO RÁPIDA

## ⚡ Uso Simples (3 comandos)

### 1️⃣ **Iniciar Backend**
```powershell
cd C:\Users\RODRIGO\Desktop\OrquestradorLuna
.\START-BACKEND.ps1
```
Isso irá:
- ✅ Matar processos Java antigos
- ✅ Compilar LunaCore (se necessário)
- ✅ Iniciar LunaCore na porta 8080
- ✅ Iniciar TotemAPI na porta 8081
- ✅ Testar se tudo está funcionando
- ✅ Mostrar credenciais de acesso

**Aguarde ~1 minuto para tudo iniciar**

---

### 2️⃣ **Iniciar Frontend**
Abra um novo terminal:
```powershell
cd C:\Users\RODRIGO\Desktop\OrquestradorLuna
.\START-FRONTEND.ps1
```

Ou manualmente:
```powershell
cd projeto-Luna.code-workspace\LunaTotem\TotemUI
npm run dev
```

---

### 3️⃣ **Acessar o Sistema**
Abra o navegador em: **http://localhost:3000**

**Credenciais:**
- Email: `adm@luna.com`
- Senha: `123456`

---

## 🛑 Parar Tudo

```powershell
cd C:\Users\RODRIGO\Desktop\OrquestradorLuna
.\STOP-BACKEND.ps1
```

Depois pressione `Ctrl+C` na janela do frontend (TotemUI)

---

## 🔧 Troubleshooting

### ❌ Problema: "Port already in use"
**Solução:**
```powershell
.\STOP-BACKEND.ps1
# Aguarde 5 segundos
.\START-BACKEND.ps1
```

### ❌ Problema: Login funciona mas 403 nos dados
**Solução:**
1. Verifique se as duas janelas (LunaCore e TotemAPI) estão abertas
2. Veja se há erros nas janelas
3. Se houver erro de "RestTemplate bean not found":
   ```powershell
   cd projeto-Luna.code-workspace\LunaCore\lunacore
   mvn clean package -DskipTests
   ```
4. Depois execute `.\START-BACKEND.ps1` novamente

### ❌ Problema: TotemAPI não inicia
**Solução:**
1. Verifique a janela do TotemAPI
2. Se houver erro de conexão com banco:
   - Banco: Neon PostgreSQL (remoto, deve funcionar)
3. Se houver erro de JWT_SECRET:
   - O script já configura automaticamente
4. Tente reiniciar:
   ```powershell
   .\STOP-BACKEND.ps1
   Start-Sleep 5
   .\START-BACKEND.ps1
   ```

---

## 📊 Status dos Serviços

Verifique manualmente se estão online:
- LunaCore: http://localhost:8080/actuator/health
- TotemAPI: http://localhost:8081/actuator/health
- TotemUI: http://localhost:3000

Todos devem retornar status 200 OK

---

## 📝 Estrutura dos Serviços

```
┌─────────────────────────────────────────┐
│  TotemUI (Frontend)                     │
│  http://localhost:3000                  │
│  React + Next.js                        │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  LunaCore (Gateway)                     │
│  http://localhost:8080                  │
│  - Autenticação JWT                     │
│  - Proxy Controllers                    │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  TotemAPI (Data Layer)                  │
│  http://localhost:8081                  │
│  - Pacientes, Médicos, Agendamentos    │
│  - CRUD Operations                      │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Neon PostgreSQL (Database)             │
│  Schema: luna                           │
│  - Dados: 10 pacientes, 5 médicos      │
└─────────────────────────────────────────┘
```

---

## 🎯 Checklist de Inicialização

Antes de começar a desenvolver:
- [ ] Executar `.\START-BACKEND.ps1` ✅
- [ ] Ver duas janelas PowerShell abertas (LunaCore e TotemAPI)
- [ ] Aguardar mensagem "SISTEMA PRONTO!"
- [ ] Executar `.\START-FRONTEND.ps1` ✅
- [ ] Abrir http://localhost:3000
- [ ] Fazer login com adm@luna.com / 123456
- [ ] Dashboard carrega sem erros 403

---

## 🆘 Suporte

Se algo não funcionar após seguir este guia:
1. Execute `.\STOP-BACKEND.ps1`
2. Aguarde 10 segundos
3. Execute `.\START-BACKEND.ps1` novamente
4. Leia as mensagens de erro nas janelas que abrirem
5. Se persistir, tire print do erro e reporte

---

**Última atualização:** 2026-01-05  
**Versão:** 1.0 - Scripts Automatizados
