@echo off
cd /d "%~dp0"
title Ruleta Perks - Editor

where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js instalado. Instala Node.js desde https://nodejs.org e intenta de nuevo.
  pause
  exit /b
)

start /min "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:4002/editor"
node editor-ruleta-perks.js
pause
