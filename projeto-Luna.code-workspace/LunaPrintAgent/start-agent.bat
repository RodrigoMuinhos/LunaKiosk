@echo off
REM Script para iniciar o Luna Print Agent no Windows

REM Configurações (edite conforme necessário)
set TERMINAL_ID=TOTEM-001
set BACKEND_URL=http://localhost:8081
set PRINTER_NAME=

echo ================================================
echo    Luna Print Agent - Iniciando...
echo ================================================
echo Terminal ID: %TERMINAL_ID%
echo Backend URL: %BACKEND_URL%
echo ================================================

REM Inicia o Agent
java -jar target\luna-print-agent.jar

pause
