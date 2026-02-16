param(
  [string]$SourceDir = (Join-Path $PSScriptRoot "..\data"),
  [string]$BackupDir = (Join-Path $PSScriptRoot "..\backups\data"),
  [int]$RetentionDays = 30,
  [string]$SessionStorePath = "",
  [string]$EnvFilePath = (Join-Path $PSScriptRoot "..\.env")
)

$ErrorActionPreference = "Stop"

function Resolve-SafePath([string]$PathValue) {
  if ([string]::IsNullOrWhiteSpace($PathValue)) {
    return ""
  }
  return [System.IO.Path]::GetFullPath($PathValue)
}

function Get-EnvFileValue([string]$FilePath, [string]$Key) {
  if (-not (Test-Path -LiteralPath $FilePath)) {
    return ""
  }

  foreach ($line in Get-Content -LiteralPath $FilePath) {
    $trimmed = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed)) {
      continue
    }
    if ($trimmed.StartsWith("#")) {
      continue
    }
    if ($trimmed -notmatch "=") {
      continue
    }
    $parts = $trimmed.Split("=", 2)
    if ($parts[0].Trim() -ne $Key) {
      continue
    }
    return $parts[1].Trim().Trim('"').Trim("'")
  }
  return ""
}

$resolvedSourceDir = Resolve-SafePath $SourceDir
$resolvedBackupDir = Resolve-SafePath $BackupDir
$projectRoot = Resolve-SafePath (Join-Path $PSScriptRoot "..")
$resolvedEnvFilePath = Resolve-SafePath $EnvFilePath

$rawSessionStorePath = $SessionStorePath
if ([string]::IsNullOrWhiteSpace($rawSessionStorePath)) {
  $rawSessionStorePath = Get-EnvFileValue -FilePath $resolvedEnvFilePath -Key "SESSION_STORE_PATH"
}
if (-not [string]::IsNullOrWhiteSpace($rawSessionStorePath) -and -not [System.IO.Path]::IsPathRooted($rawSessionStorePath)) {
  $rawSessionStorePath = Join-Path $projectRoot $rawSessionStorePath
}
$resolvedSessionStorePath = Resolve-SafePath $rawSessionStorePath

if (-not (Test-Path -LiteralPath $resolvedSourceDir)) {
  throw "SourceDir not found: $resolvedSourceDir"
}

if (-not (Test-Path -LiteralPath $resolvedBackupDir)) {
  New-Item -ItemType Directory -Path $resolvedBackupDir -Force | Out-Null
}

$requiredFiles = @("guildConfigs.json", "userConfigs.json")
foreach ($fileName in $requiredFiles) {
  $fullPath = Join-Path $resolvedSourceDir $fileName
  if (-not (Test-Path -LiteralPath $fullPath)) {
    Write-Warning "Expected file not found in data backup source: $fullPath"
  }
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$zipPath = Join-Path $resolvedBackupDir ("data-backup-{0}.zip" -f $timestamp)
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("adhan-data-backup-{0}" -f ([guid]::NewGuid().ToString("N")))

try {
  New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

  $stageDataDir = Join-Path $tempRoot "data"
  New-Item -ItemType Directory -Path $stageDataDir -Force | Out-Null
  Copy-Item -Path (Join-Path $resolvedSourceDir "*") -Destination $stageDataDir -Recurse -Force -ErrorAction SilentlyContinue

  if (-not [string]::IsNullOrWhiteSpace($resolvedSessionStorePath) -and (Test-Path -LiteralPath $resolvedSessionStorePath)) {
    $sourceNormalized = $resolvedSourceDir.TrimEnd("\", "/")
    $sessionNormalized = $resolvedSessionStorePath.TrimEnd("\", "/")
    if (-not $sessionNormalized.StartsWith($sourceNormalized, [System.StringComparison]::OrdinalIgnoreCase)) {
      $stageSessionDir = Join-Path $tempRoot "session-store"
      New-Item -ItemType Directory -Path $stageSessionDir -Force | Out-Null
      Copy-Item -Path (Join-Path $resolvedSessionStorePath "*") -Destination $stageSessionDir -Recurse -Force -ErrorAction SilentlyContinue
    }
  }

  Compress-Archive -Path (Join-Path $tempRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal -Force
} finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}

$cutoff = (Get-Date).AddDays(-1 * [Math]::Abs($RetentionDays))
Get-ChildItem -Path $resolvedBackupDir -Filter "data-backup-*.zip" -File |
  Where-Object { $_.LastWriteTime -lt $cutoff } |
  Remove-Item -Force -ErrorAction SilentlyContinue

$zipInfo = Get-Item -LiteralPath $zipPath
Write-Output ("Backup created: {0} ({1} bytes)" -f $zipInfo.FullName, $zipInfo.Length)
