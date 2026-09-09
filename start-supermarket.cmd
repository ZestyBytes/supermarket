@echo off
rem Double-click this (or the desktop shortcut to it) to start Supermarket.
rem
rem It stays open and looks after the app while it runs: puts it back if it
rem stops or stops answering, and picks up new versions from GitHub without
rem you having to do anything. Close this window to stop it.
rem
rem To have it start on its own when you log in, run once:
rem   powershell -ExecutionPolicy Bypass -File scripts\install-service.ps1
title Supermarket
cd /d "%~dp0"

start "" http://127.0.0.1:5173
call scripts\supervise.cmd %*

echo.
echo Supermarket has stopped. Press any key to close.
pause >nul
