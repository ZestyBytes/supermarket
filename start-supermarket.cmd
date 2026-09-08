@echo off
rem Double-click this (or a shortcut to it) to start Supermarket.
rem It updates itself, opens both halves and the app, and stays open while
rem they run.
title Supermarket
cd /d "%~dp0"

echo Starting Supermarket...

rem A server left running from last time holds the port and stops this one.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:"TCP.*:8787 .*LISTENING"') do taskkill /f /pid %%p >nul 2>&1

rem Pick up the latest version, but never throw away work in progress: if
rem anything here has been edited, leave it alone and say so.
git diff --quiet && git diff --cached --quiet
if errorlevel 1 (
  echo   Local changes found - skipping update, starting what you have.
) else (
  echo   Checking for updates...
  git pull --ff-only >nul 2>&1 && (
    call npm install --silent >nul 2>&1
    echo   Up to date.
  ) || echo   Could not reach GitHub - starting the version you have.
)

start "" http://127.0.0.1:5173
call npm run start:host

echo.
echo Supermarket has stopped. Press any key to close.
pause >nul
