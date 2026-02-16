@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "TASK_NAME=DiscordAdhanBot-DailyDataBackup"
set "BACKUP_TIME=%~1"
if "%BACKUP_TIME%"=="" set "BACKUP_TIME=03:15"

set "BACKUP_SCRIPT=%~dp0scripts\backup-data.ps1"
set "SOURCE_DIR=%~dp0data"
set "BACKUP_DIR=%~dp0backups\data"
set "RETENTION_DAYS=30"

if not exist "%BACKUP_SCRIPT%" (
  echo Missing script: %BACKUP_SCRIPT%
  exit /b 1
)

set "TASK_COMMAND=powershell -NoProfile -ExecutionPolicy Bypass -File \"%BACKUP_SCRIPT%\" -SourceDir \"%SOURCE_DIR%\" -BackupDir \"%BACKUP_DIR%\" -RetentionDays %RETENTION_DAYS%"

set "TASK_MODE=SYSTEM"
schtasks /Create /F /SC DAILY /ST %BACKUP_TIME% /TN "%TASK_NAME%" /TR "%TASK_COMMAND%" /RU SYSTEM /RL HIGHEST >nul 2>&1
if errorlevel 1 (
  set "TASK_MODE=INTERACTIVE"
  schtasks /Create /F /SC DAILY /ST %BACKUP_TIME% /TN "%TASK_NAME%" /TR "%TASK_COMMAND%"
  if errorlevel 1 (
    echo Failed to create scheduled task. Try running this as Administrator.
    exit /b 1
  )
)

echo Scheduled daily backup task created:
echo   Task Name: %TASK_NAME%
echo   Time: %BACKUP_TIME%
echo   Mode: %TASK_MODE%
echo.
schtasks /Query /TN "%TASK_NAME%" /FO LIST
endlocal
