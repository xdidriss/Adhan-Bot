@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "BACKUP_SCRIPT=%~dp0scripts\backup-data.ps1"
set "SOURCE_DIR=%~dp0data"
set "BACKUP_DIR=%~dp0backups\data"
set "RETENTION_DAYS=30"

if not exist "%BACKUP_SCRIPT%" (
  echo Missing script: %BACKUP_SCRIPT%
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%BACKUP_SCRIPT%" -SourceDir "%SOURCE_DIR%" -BackupDir "%BACKUP_DIR%" -RetentionDays %RETENTION_DAYS%
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo Backup failed with exit code %EXIT_CODE%.
  exit /b %EXIT_CODE%
)

echo Backup completed successfully.
endlocal
