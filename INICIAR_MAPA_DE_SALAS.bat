@echo off
setlocal
title Mapa de Salas
cd /d "%~dp0"

echo.
echo ============================================
echo          MAPA DE SALAS - INICIALIZACAO
echo ============================================

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js nao foi encontrado.
  echo Instale a versao LTS em https://nodejs.org e execute este arquivo novamente.
  pause
  exit /b 1
)

if not exist ".env" (
  echo Criando a configuracao local automaticamente...
  copy /y ".env.example" ".env" >nul
)

if not exist "node_modules" (
  echo Instalando dependencias pela primeira vez...
  call npm install
  if errorlevel 1 goto :erro
)

echo Preparando o banco de dados...
call npx prisma generate
if errorlevel 1 goto :erro
call npx prisma db push
if errorlevel 1 goto :erro
call npm run db:seed
if errorlevel 1 goto :erro

echo.
echo Iniciando o servidor em http://localhost:3000
start "Mapa de Salas - Servidor" /min cmd /c "cd /d "%~dp0" ^&^& npm run dev"
timeout /t 3 /nobreak >nul
start "" "http://localhost:3000"
echo O servidor continua aberto em uma janela minimizada.
echo Para encerrar, feche a janela chamada Mapa de Salas - Servidor.
exit /b 0

:erro
echo.
echo Nao foi possivel iniciar o Mapa de Salas. Leia a mensagem acima e confira o README.md.
pause
exit /b 1
