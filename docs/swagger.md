# Swagger / OpenAPI (Springdoc)

Este repositório expõe documentação Swagger UI e OpenAPI JSON nos serviços Spring Boot.

## URLs

### LunaCore (porta 8080)
- Swagger UI: http://localhost:8080/swagger-ui/index.html
- OpenAPI JSON: http://localhost:8080/v3/api-docs

### TotemAPI (porta 8081)
- Swagger UI: http://localhost:8081/swagger-ui/index.html
- OpenAPI JSON: http://localhost:8081/v3/api-docs

### LunaPay (porta 8082)
- Swagger UI: http://localhost:8082/swagger-ui/index.html
- OpenAPI JSON: http://localhost:8082/v3/api-docs

## Observações

- Os endpoints do Swagger/OpenAPI foram liberados no Spring Security (permitAll) para facilitar uso em ambiente local.
- Se você quiser restringir em produção, podemos condicionar por profile (ex.: somente `dev`).
