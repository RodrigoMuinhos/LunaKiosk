@echo off
REM Build all services with unified schema

echo.
echo [BUILDING ALL SERVICES FOR UNIFIED SCHEMA]
echo.

setlocal enabledelayedexpansion

REM Set environment variables (NUNCA commite credenciais reais)
REM Dica: defina SPRING_DATASOURCE_URL/USERNAME/PASSWORD e JWT_SECRET no seu ambiente antes de rodar.
if "%SPRING_DATASOURCE_URL%"=="" set "SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/lunadb?currentSchema=luna"
if "%SPRING_DATASOURCE_USERNAME%"=="" set "SPRING_DATASOURCE_USERNAME=postgres"
REM Não define senha por padrão
if "%JWT_SECRET%"=="" set "JWT_SECRET=dev-only-change-me"

echo [1] Building LunaCore...
cd "C:\Users\RODRIGO\Desktop\OrquestradorLuna\projeto-Luna.code-workspace\LunaCore\lunacore"
call mvn clean package -DskipTests -q
if errorlevel 1 (
    echo ERROR building LunaCore
    exit /b 1
)
echo OK - LunaCore compiled

echo.
echo [2] Building TotemAPI...
cd "C:\Users\RODRIGO\Desktop\OrquestradorLuna\projeto-Luna.code-workspace\LunaTotem\TotemAPI"
call mvn clean package -DskipTests -q
if errorlevel 1 (
    echo ERROR building TotemAPI
    exit /b 1
)
echo OK - TotemAPI compiled

echo.
echo [3] Building LunaPay...
cd "C:\Users\RODRIGO\Desktop\OrquestradorLuna\projeto-Luna.code-workspace\LunaPay\lunapay-api"
call mvn clean package -DskipTests -q
if errorlevel 1 (
    echo ERROR building LunaPay
    exit /b 1
)
echo OK - LunaPay compiled

echo.
echo ====================================
echo SUCCESS - All services compiled
echo Schema: luna (unified)
echo Env vars set for unified deployment
echo ====================================
echo.
