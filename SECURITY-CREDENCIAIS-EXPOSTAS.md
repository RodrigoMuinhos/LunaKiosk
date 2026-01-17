# 🔐 Guia de Segurança - Credenciais Expostas

## ⚠️ Problema Detectado

O GitGuardian detectou credenciais expostas no repositório:
- **3x PostgreSQL Credentials** (commit 2d9a2a7)
- **1x Generic Database Assignment** (commit f77785a)
- **1x Company Email Password** (commit f77785a)

## ✅ Soluções (SEM mudar senhas)

### 1. **Remover .env do histórico do Git** 🧹

```powershell
# Remove .env do tracking do Git (mas mantém o arquivo local)
git rm --cached .env

# Commit a remoção
git add .env
git commit -m "chore: remove .env from git tracking (security)"
```

### 2. **Verificar .gitignore** ✓

O arquivo `.gitignore` já está correto:
```
.env
.env.*
!.env.example
```

### 3. **Force push para remover do histórico** ⚠️

**ATENÇÃO:** Isso reescreve o histórico. Use apenas se:
- O repositório for privado
- Você for o único desenvolvedor OU coordenar com a equipe

```powershell
# Opção A: Usando BFG Repo-Cleaner (recomendado)
# Download: https://rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force

# Opção B: Usando git filter-branch (mais lento)
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env" --prune-empty --tag-name-filter cat -- --all
git push --force --all
```

### 4. **Resolver alertas do GitGuardian** 🎯

Após remover do Git, marque os incidentes como resolvidos:
1. Acesse: https://dashboard.gitguardian.com
2. Marque como "Fixed" ou "Revoke & Rotate" (se quiser rotacionar depois)

### 5. **Prevenir futuros commits de credenciais** 🛡️

Instale o git-secrets ou pre-commit hooks:

```powershell
# Instalar git-secrets (Windows)
# Via Chocolatey:
choco install git-secrets

# Configurar para o repo
cd c:\Users\RODRIGO\Desktop\OrquestradorLuna
git secrets --install
git secrets --register-aws
git secrets --add 'password.*=.*'
git secrets --add 'npg_[A-Za-z0-9]+'
```

## 📋 Checklist

- [ ] Remover `.env` do cache do Git (`git rm --cached .env`)
- [ ] Commit e push da remoção
- [ ] (Opcional) Reescrever histórico com BFG ou filter-branch
- [ ] Marcar incidentes como resolvidos no GitGuardian
- [ ] Configurar git-secrets ou pre-commit hooks
- [ ] Educar equipe sobre não commitar arquivos `.env`

## 🔄 Rotação de Credenciais (Futura)

Se decidir rotacionar as senhas no futuro:

1. **Neon PostgreSQL:**
   - Acesse: https://console.neon.tech
   - Vá em: Settings → Reset Password
   - Atualize o `.env` local

2. **Asaas API Keys:**
   - Acesse: https://www.asaas.com/config/api
   - Gere novas chaves
   - Atualize o `.env` local

3. **JWT_SECRET:**
   ```powershell
   # Gerar novo secret (PowerShell)
   -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
   ```

## 📚 Referências

- [GitGuardian Docs](https://docs.gitguardian.com/)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [Git Filter-Branch](https://git-scm.com/docs/git-filter-branch)
- [git-secrets](https://github.com/awslabs/git-secrets)

---

**Nota:** Este guia resolve o problema de exposição **sem alterar as senhas atuais**. As credenciais continuam funcionando, mas não ficarão mais expostas em futuros commits.
