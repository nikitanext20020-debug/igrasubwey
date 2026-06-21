@echo off
setlocal
title Vanya Runner

cd /d "%~dp0"

if not exist package.json (
  echo Файл package.json не найден. Запусти батник из папки игры.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js не найден. Установи Node.js, затем запусти этот файл снова.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Устанавливаю зависимости...
  call npm install
  if errorlevel 1 (
    echo Не удалось установить зависимости.
    pause
    exit /b 1
  )
)

echo Запускаю игру...
echo Если браузер не открылся сам, открой адрес:
echo http://127.0.0.1:5173/
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:5173/'"
call npm run dev -- --host 127.0.0.1

pause
