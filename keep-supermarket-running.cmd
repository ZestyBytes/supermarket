@echo off
rem Double-click this to keep Supermarket running and up to date.
rem It restarts the app if it stops or stops answering, and pulls new
rem versions from GitHub. Close this window to stop it.
rem
rem To have it start on its own when you log in, run instead:
rem   powershell -ExecutionPolicy Bypass -File scripts\install-service.ps1
title Supermarket - keeping it running
cd /d "%~dp0"
node scripts\keep-running.mjs %*
echo.
echo Supermarket has stopped. Press any key to close.
pause >nul
