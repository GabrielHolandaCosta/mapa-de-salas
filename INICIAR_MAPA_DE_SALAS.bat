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
if exist "server.log" del /q "server.log"
if exist "server-error.log" del /q "server-error.log"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','start' -WorkingDirectory '%CD%' -WindowStyle Hidden -RedirectStandardOutput 'server.log' -RedirectStandardError 'server-error.log' -PassThru; Set-Content -Path '.server.pid' -Value $p.Id"
if errorlevel 1 goto :erro_servidor

for /L %%I in (1,1,20) do (
  powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing 'http://localhost:3000/api/auth/me' -TimeoutSec 1 | Out-Null; exit 0 } catch { if ($_.Exception.Response.StatusCode.value__ -eq 401) { exit 0 }; exit 1 }"
  if not errorlevel 1 goto :pronto
  ping 127.0.0.1 -n 2 >nul
)

:erro_servidor
echo.
echo O servidor nao conseguiu iniciar.
if exist "server-error.log" type "server-error.log"
if exist "server.log" type "server.log"
echo.
echo Feche outro sistema que esteja usando a porta 3000 e tente novamente.
pause
exit /b 1

:pronto
start "" "http://localhost:3000"
echo Sistema iniciado corretamente.
echo Esta janela pode ser fechada; o servidor continuara funcionando.
echo Para encerrar depois, use ENCERRAR_MAPA_DE_SALAS.bat.
exit /b 0

:erro
echo.
echo Nao foi possivel iniciar o Mapa de Salas. Leia a mensagem acima e confira o README.md.
pause
exit /b 1
