@echo off
REM Script simples para iniciar todos os serviços LunaVita localmente
REM Não precisa de Docker - roda tudo em localhost
REM Abre 4 janelas PowerShell separadas

echo ╔════════════════════════════════════════════╗
echo ║  LunaVita - Iniciando Localmente           ║
echo ║  4 Serviços + 1 Frontend                   ║
echo ╚════════════════════════════════════════════╝
echo.

REM Define variáveis de ambiente (NUNCA commite credenciais reais)
REM Dica: defina SPRING_DATASOURCE_URL/USERNAME/PASSWORD, JWT_SECRET e ASAAS_* no seu ambiente antes de rodar.
if "%JWT_SECRET%"=="" set "JWT_SECRET=dev-only-change-me"
if "%SPRING_DATASOURCE_URL%"=="" set "SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/lunadb?currentSchema=luna"
if "%SPRING_DATASOURCE_USERNAME%"=="" set "SPRING_DATASOURCE_USERNAME=postgres"
REM Não define SPRING_DATASOURCE_PASSWORD por padrão
if "%ASAAS_ENVIRONMENT%"=="" set "ASAAS_ENVIRONMENT=sandbox"
REM Não define ASAAS_PROD_API_KEY por padrão

REM 1. LunaCore (8080)
echo [1/4] Iniciando LunaCore (8080)...
start "LunaCore API" cmd /k "cd /d c:\Users\RODRIGO\Desktop\OrquestradorLuna\projeto-Luna.code-workspace\LunaCore\lunacore && mvn spring-boot:run"
timeout /t 3 /nobreak

REM 2. TotemAPI (8081)
echo [2/4] Iniciando TotemAPI (8081)...
start "TotemAPI Backend" cmd /k "cd /d c:\Users\RODRIGO\Desktop\OrquestradorLuna\projeto-Luna.code-workspace\LunaTotem\TotemAPI && mvn spring-boot:run"
timeout /t 3 /nobreak

REM 3. LunaPay (8082)
echo [3/4] Iniciando LunaPay (8082)...
start "LunaPay API" cmd /k "cd /d c:\Users\RODRIGO\Desktop\OrquestradorLuna\projeto-Luna.code-workspace\LunaPay\lunapay-api && mvn spring-boot:run"
timeout /t 3 /nobreak

REM 4. TotemUI (3000)
echo [4/4] Iniciando TotemUI (3000)...
start "TotemUI Frontend" cmd /k "cd /d c:\Users\RODRIGO\Desktop\OrquestradorLuna\projeto-Luna.code-workspace\LunaTotem\TotemUI && npm run dev"

echo.
echo ╔════════════════════════════════════════════╗
echo ║  ✅ Todos iniciados em janelas separadas!  ║
echo ╚════════════════════════════════════════════╝
echo.
echo Aguarde 30-40 segundos para inicialização...
echo.
echo 📋 Endpoints para testar:
echo    🔷 LunaCore:  http://localhost:8080/actuator/health
echo    🔷 TotemAPI:  http://localhost:8081/actuator/health
echo    🔷 LunaPay:   http://localhost:8082/actuator/health
echo    🔷 TotemUI:   http://localhost:3000
echo.
pause
