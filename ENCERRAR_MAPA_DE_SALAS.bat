@echo off
setlocal
cd /d "%~dp0"
if not exist ".server.pid" (
  echo O Mapa de Salas nao parece estar aberto.
  pause
  exit /b 0
)
set /p MAPA_PID=<.server.pid
taskkill /PID %MAPA_PID% /T /F >nul 2>nul
del /q ".server.pid" >nul 2>nul
echo Mapa de Salas encerrado.
timeout /t 2 /nobreak >nul
