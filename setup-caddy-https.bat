@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM === Caddy Auto-HTTPS Setup (Windows) ===
REM - Downloads Caddy v2 (official build)
REM - Writes a Caddyfile for your domain -> reverse proxy to your Node app
REM - Opens Windows Firewall for 80/443
REM - Installs + starts Caddy as a Windows service
REM
REM Requirements:
REM - Run this as Administrator
REM - Your domain's A/AAAA DNS must point to this VPS IP
REM - Ports 80 and 443 must be free (nothing else listening) OR use one shared Caddy for all sites

REM ====== CONFIG (edit these) ======
set "DOMAIN=adhan-bot.online"
set "UPSTREAM=http://127.0.0.1:3010"
set "ACME_EMAIL="
set "CADDY_DIR=C:\caddy"
REM =================================

REM Admin check
net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo ERROR: Run this file as Administrator.
  exit /b 1
)

REM Basic port checks (80/443 must be available for automatic HTTPS)
powershell -NoProfile -Command ^
  "$p=@(80,443); foreach($port in $p){ $c=Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; if($c){ Write-Host ('ERROR: Port {0} is already in use by PID(s): {1}' -f $port, (($c|Select-Object -ExpandProperty OwningProcess -Unique) -join ',')); exit 2 } }"
if "%errorlevel%"=="2" (
  echo.
  echo Stop the service(s) using 80/443 (nginx/other web servers), OR host all projects inside a single Caddyfile.
  exit /b 2
)

REM Create directories
if not exist "%CADDY_DIR%" mkdir "%CADDY_DIR%" >nul
if not exist "%CADDY_DIR%\logs" mkdir "%CADDY_DIR%\logs" >nul

REM Download Caddy (official Windows amd64 build)
set "CADDY_ZIP=%CADDY_DIR%\caddy.zip"
set "CADDY_EXE=%CADDY_DIR%\caddy.exe"
echo Downloading Caddy...
curl.exe -fsSL -o "%CADDY_ZIP%" "https://caddyserver.com/api/download?os=windows&arch=amd64" || (
  echo ERROR: Failed to download Caddy.
  exit /b 3
)

REM Extract (zip contains caddy.exe)
echo Extracting...
powershell -NoProfile -Command ^
  "Expand-Archive -Force -Path '%CADDY_ZIP%' -DestinationPath '%CADDY_DIR%'" || (
  echo ERROR: Failed to extract Caddy zip.
  exit /b 4
)

if not exist "%CADDY_EXE%" (
  echo ERROR: caddy.exe not found after extraction.
  exit /b 5
)

REM Write Caddyfile
set "CADDYFILE=%CADDY_DIR%\Caddyfile"
echo Writing Caddyfile to %CADDYFILE% ...
(
  echo {
  if not "%ACME_EMAIL%"=="" echo   email %ACME_EMAIL%
  echo   admin off
  echo }
  echo.
  echo %DOMAIN% {
  echo   encode gzip zstd
  echo.
  echo   log {
  echo     output file %CADDY_DIR%\logs\access.log
  echo     format console
  echo   }
  echo.
  echo   header {
  echo     -Server
  echo     X-Content-Type-Options "nosniff"
  echo     Referrer-Policy "no-referrer"
  echo     Permissions-Policy "interest-cohort=()"
  echo   }
  echo.
  echo   reverse_proxy %UPSTREAM%
  echo }
) > "%CADDYFILE%"

REM Open firewall ports
echo Opening Windows Firewall ports 80/443...
netsh advfirewall firewall add rule name="Caddy HTTP (80)" dir=in action=allow protocol=TCP localport=80 >nul 2>&1
netsh advfirewall firewall add rule name="Caddy HTTPS (443)" dir=in action=allow protocol=TCP localport=443 >nul 2>&1

REM Install/Start service
echo Installing Caddy as a Windows service...
"%CADDY_EXE%" stop >nul 2>&1
"%CADDY_EXE%" uninstall >nul 2>&1
"%CADDY_EXE%" install --config "%CADDYFILE%" --adapter caddyfile || (
  echo ERROR: Failed to install Caddy service.
  echo Try: "%CADDY_EXE%" run --config "%CADDYFILE%" --adapter caddyfile
  exit /b 6
)

echo.
echo DONE.
echo - Your site should come up at: https://%DOMAIN%/
echo - Upstream: %UPSTREAM%
echo - Caddyfile: %CADDYFILE%
echo.
echo If your Node app is not running, start it now. Caddy will proxy to it.
exit /b 0

