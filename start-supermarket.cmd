@echo off
rem Double-click this (or a shortcut to it) to start Supermarket.
rem It opens both halves and the app, and stays open while they run.
title Supermarket
cd /d "%~dp0"

echo Starting Supermarket...

rem A server left running from last time holds the port and stops this one.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:"TCP.*:8787 .*LISTENING"') do taskkill /f /pid %%p >nul 2>&1

start "" http://127.0.0.1:5173
call npm run start:host

echo.
echo Supermarket has stopped. Press any key to close.
pause >nul
