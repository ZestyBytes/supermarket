@echo off
rem Runs the supervisor, and starts it again when it replaces its own code.
rem
rem Node reads a script into memory once. When the supervisor pulls a new
rem version of itself it can only hand back here, with exit code 75, and this
rem is what picks the new one up. Without it an update to the supervisor lands
rem on disk and the old logic keeps running, which is exactly how a fix for a
rem restart loop arrived while the restart loop carried on.
cd /d "%~dp0.."

:run
node scripts\keep-running.mjs %*
if errorlevel 76 goto done
if errorlevel 75 goto run

:done
exit /b %errorlevel%
