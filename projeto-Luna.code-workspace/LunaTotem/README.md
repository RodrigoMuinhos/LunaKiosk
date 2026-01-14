# LunaPay API

API de integração de pagamentos do ecossistema Luna, responsável por gerenciar pagamentos através de múltiplos gateways (Asaas, C6, etc).

## 🚀 Tecnologias

- Java 17
- Spring Boot 3.2.0
- Spring Security (JWT)
- Spring Data JPA
- PostgreSQL
- Lombok
- Maven

## 🔐 Segurança

A API utiliza JWT para autenticação, integrada com o LunaCore. Apenas usuários com o módulo **LUNAPAY** habilitado podem acessar os endpoints.

## 🏗️ Estrutura do Projeto

```
com.luna.pay
├── config          // Configurações (SecurityConfig, etc)
├── security        // JwtUtil, JwtAuthenticationFilter, UserContext
├── payment         // Entidades, repos, services e controllers de pagamentos
├── webhook         // Controllers para receber webhooks dos gateways
└── common          // Exceptions, utils compartilhados
```

## ⚙️ Configuração

### Banco de Dados

Crie o banco PostgreSQL:

```sql
CREATE DATABASE lunapay;
CREATE USER lunapay WITH PASSWORD 'secret';
GRANT ALL PRIVILEGES ON DATABASE lunapay TO lunapay;
```

### Variáveis de Ambiente

```bash
LUNACORE_JWT_SECRET=seu-secret-jwt-compartilhado-com-core
```

## 🔧 Como Executar

```bash
# Compilar
mvn clean install

# Executar
mvn spring-boot:run
```

A API estará disponível em: `http://localhost:8082`

## 🧪 Testando

### Health Check (sem autenticação)
```bash
curl http://localhost:8082/actuator/health
```

### Endpoint de Teste (com autenticação)
```bash
curl -H "Authorization: Bearer SEU_TOKEN_DO_LUNACORE" \
     http://localhost:8082/payments/ping
```

Resposta esperada:
```
LunaPay OK para tenant {tenantId} (user: {userId})
```

## 📦 Dependências Principais

- `spring-boot-starter-web` - REST API
- `spring-boot-starter-data-jpa` - Persistência
- `spring-boot-starter-security` - Segurança
- `spring-boot-starter-validation` - Validações
- `postgresql` - Driver PostgreSQL
- `jjwt` - JWT (validação de tokens)
- `lombok` - Redução de boilerplate

## 🎯 Status do Projeto

1. ✅ Estrutura base do projeto
2. ✅ Segurança e multi-tenant (JWT + módulo LUNAPAY)
3. ✅ Modelo de Payment completo
4. ✅ DTOs e validações
5. ✅ Serviço de pagamento
6. ✅ Endpoints REST (criar, listar, buscar, cancelar)
7. ✅ Estrutura de gateways (interface + stub)
8. ✅ Implementação STUB Asaas e C6
9. ✅ Webhooks (endpoints prontos)
10. ✅ Tratamento de exceções global
11. ⏳ **Aguardando credenciais** para integração real com Asaas e C6

## 📚 Documentação

Veja exemplos completos de uso da API em [API_EXAMPLES.md](./API_EXAMPLES.md)

## 🔐 Módulo LUNAPAY Obrigatório

Esta API só funciona se o tenant tiver o módulo **LUNAPAY** habilitado no LunaCore. O filtro JWT valida automaticamente se o token possui este módulo.

## 📝 Licença

Proprietary - LunaPay © 2024
