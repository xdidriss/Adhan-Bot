param(
  [Parameter(Mandatory = $true)]
  [string]$LogDir,
  [string]$NpmScript = "start:strict",
  [string]$Prefix = "bot-runtime",
  [int]$MaxFileSizeMB = 25
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

$env:NODE_OPTIONS = "--unhandled-rejections=strict"
$maxBytes = [int64][Math]::Max(1, $MaxFileSizeMB) * 1MB

& npm run $NpmScript 2>&1 | ForEach-Object {
  $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  $line = "$timestamp $($_.ToString())"
  $day = (Get-Date).ToString("yyyy-MM-dd")
  $baseName = "{0}-{1}" -f $Prefix, $day
  $file = Join-Path $LogDir ("{0}.log" -f $baseName)
  if ((Test-Path -LiteralPath $file) -and ((Get-Item -LiteralPath $file).Length -ge $maxBytes)) {
    $archiveStamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
    $archive = Join-Path $LogDir ("{0}.{1}.log" -f $baseName, $archiveStamp)
    Move-Item -LiteralPath $file -Destination $archive -Force
  }
  Add-Content -Path $file -Value $line
}

exit $LASTEXITCODE
