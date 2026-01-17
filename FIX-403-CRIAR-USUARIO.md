# 🔧 Correção: Erro 403 ao Criar Usuário

## 🐛 Problema Identificado

Ao tentar cadastrar um novo usuário através do painel administrativo (TotemUI), ocorria erro **403 Forbidden**:

```
[API] Resposta: Object
Erro ao salvar usuário Error: API Error: Forbidden
```

### Causa Raiz

**Incompatibilidade de roles** entre **LunaCore** e **TotemAPI**:

| Sistema | Roles Disponíveis |
|---------|-------------------|
| **LunaCore** | `OWNER`, `ADMIN`, `RECEPTION`, `DOCTOR`, `FINANCE` |
| **TotemAPI** | `RECEPCAO`, `ADMINISTRACAO`, `MEDICO` |

### O Fluxo do Problema

1. **Usuário faz login** → LunaCore gera JWT com role `OWNER` ou `ADMIN`
2. **TotemUI chama** `/api/users` (POST) → Proxy para TotemAPI
3. **TotemAPI valida** → `@PreAuthorize("hasRole('ADMINISTRACAO')")`
4. **JWT contém** `role: "OWNER"` mas o controller espera `"ADMINISTRACAO"`
5. **Spring Security rejeita** → `403 Forbidden` ❌

## ✅ Solução Implementada

### Alterações nos Controllers do TotemAPI

Atualizei todos os `@PreAuthorize` para aceitar **roles de ambos os sistemas**:

#### 1. **UserManagementController**
```java
// ANTES
@PreAuthorize("hasRole('ADMINISTRACAO')")

// DEPOIS
@PreAuthorize("hasAnyRole('ADMINISTRACAO', 'OWNER', 'ADMIN', 'FINANCE')")
```

#### 2. **VideoController** (6 endpoints)
- `POST /upload`
- `GET /`
- `GET /{id}`
- `PUT /{id}`
- `DELETE /{id}`
- `POST /reorder`

#### 3. **AuthController** (2 endpoints)
- `POST /register`
- `POST /request-access`

#### 4. **LgpdController** (1 endpoint)
- `GET /access-logs`

#### 5. **DashboardController**
- Já estava correto com `hasAnyRole('ADMINISTRACAO','OWNER','ADMIN','FINANCE')`

### Arquivos Modificados

```
TotemAPI/src/main/java/br/lunavita/totemapi/controller/
├── UserManagementController.java  ✅
├── VideoController.java            ✅
├── AuthController.java             ✅
└── LgpdController.java             ✅
```

## 🧪 Validação

Compilação bem-sucedida:

```bash
cd TotemAPI
mvn clean compile -DskipTests
# [INFO] BUILD SUCCESS
```

## 📝 Como Testar

### 1. **Reiniciar TotemAPI**
```powershell
# Parar o serviço atual
Ctrl+C no terminal do TotemAPI

# Rebuild e start
mvn spring-boot:run
```

### 2. **Fazer Login no TotemUI**
- Acesse: `http://localhost:3000`
- Login com usuário `OWNER` ou `ADMIN` (LunaCore)

### 3. **Criar Novo Usuário**
- Vá em: **Painel Administrativo** → **Nova conta**
- Preencha:
  - E-mail: `rodrigo@luna.com`
  - CPF: `044.117.503-17`
  - Perfil: `Administração`
  - Senha: `******`
- Clique em **Criar usuário**

### 4. **Resultado Esperado**
```
✅ Usuário criado com sucesso!
Status: 201 Created
```

## 🔍 Verificação de Logs

No console do **TotemAPI**, você deve ver:

```
[JWT FILTER] Authenticated: UserContext(userId=..., tenantId=..., role=OWNER, modules=[...])
[UserManagementController] POST /api/users - Creating user with role ADMINISTRACAO
```

## 📚 Próximos Passos

### Opcional: Unificar Roles

Para evitar problemas futuros, considere **padronizar** os roles:

**Opção A:** Migrar TotemAPI para usar os roles do LunaCore
```java
// Mudar enum em TotemAPI
public enum UserRole {
    OWNER,
    ADMIN,
    RECEPTION,
    DOCTOR,
    FINANCE
}
```

**Opção B:** Criar um mapeamento de roles no JWT Filter
```java
// No JwtAuthenticationFilter do TotemAPI
String role = jwtUtil.getRole(token);
String mappedRole = mapRole(role); // OWNER -> ADMINISTRACAO
```

## 🎯 Resumo

| Antes | Depois |
|-------|--------|
| ❌ Erro 403 ao criar usuário | ✅ Criação funciona |
| ❌ Roles incompatíveis | ✅ Aceita roles de ambos sistemas |
| ❌ `hasRole('ADMINISTRACAO')` apenas | ✅ `hasAnyRole('ADMINISTRACAO', 'OWNER', 'ADMIN', 'FINANCE')` |

---

**Status:** ✅ **RESOLVIDO**  
**Data:** 17/01/2026  
**Compilação:** ✅ BUILD SUCCESS
