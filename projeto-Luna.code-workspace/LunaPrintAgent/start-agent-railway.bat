@echo off
REM ==============================================================
REM   Luna Print Agent - Startup Script para Railway
REM ==============================================================

REM Configuração para Railway Backend
set TERMINAL_ID=TOTEM-001
set BACKEND_URL=https://totemapi.up.railway.app
set PRINTER_NAME=
set POLLING_INTERVAL_MS=3000

echo ========================================================
echo   Iniciando Luna Print Agent
echo ========================================================
echo.
echo   Terminal ID:     %TERMINAL_ID%
echo   Backend URL:     %BACKEND_URL%
echo   Impressora:      %PRINTER_NAME%
echo   Polling Interval: %POLLING_INTERVAL_MS%ms
echo.
echo ========================================================
echo.

REM Inicia o agente
java -jar target\luna-print-agent.jar

pause
