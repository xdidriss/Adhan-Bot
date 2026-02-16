@echo off
setlocal EnableExtensions

cd /d "%~dp0"

if not exist "logs" mkdir "logs"

set "WAIT_SECONDS=10"
set "LOG_DIR=%~dp0logs"
set "SUPERVISOR_LOG=%LOG_DIR%\bot-supervisor.log"
set "ROTATE_SCRIPT=%~dp0scripts\rotate-logs.ps1"
set "RUNNER_SCRIPT=%~dp0scripts\run-with-daily-logs.ps1"
set "MAX_LOG_MB=25"
set "LOG_RETENTION_DAYS=14"

if not exist "%RUNNER_SCRIPT%" (
  echo Missing script: %RUNNER_SCRIPT%
  exit /b 1
)

call :rotate_logs
echo [%date% %time%] Supervisor started. >> "%SUPERVISOR_LOG%"

:restart_loop
echo [%date% %time%] Launching bot process. >> "%SUPERVISOR_LOG%"
call powershell -NoProfile -ExecutionPolicy Bypass -File "%RUNNER_SCRIPT%" -LogDir "%LOG_DIR%" -NpmScript "start:strict" -Prefix "bot-runtime" -MaxFileSizeMB %MAX_LOG_MB%
set "EXIT_CODE=%ERRORLEVEL%"
echo [%date% %time%] Bot exited with code %EXIT_CODE%. >> "%SUPERVISOR_LOG%"
call :rotate_logs

if "%EXIT_CODE%"=="0" goto graceful_exit

echo Bot crashed (exit %EXIT_CODE%). Restarting in %WAIT_SECONDS% seconds...
timeout /t %WAIT_SECONDS% /nobreak >nul
goto restart_loop

:graceful_exit
echo [%date% %time%] Bot stopped cleanly. Supervisor exiting. >> "%SUPERVISOR_LOG%"
endlocal
goto :eof

:rotate_logs
if exist "%ROTATE_SCRIPT%" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%ROTATE_SCRIPT%" -LogDir "%LOG_DIR%" -MaxFileSizeMB %MAX_LOG_MB% -RetentionDays %LOG_RETENTION_DAYS% >nul 2>&1
)
exit /b 0
