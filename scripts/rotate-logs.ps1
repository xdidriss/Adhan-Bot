param(
  [Parameter(Mandatory = $true)]
  [string]$LogDir,
  [int]$MaxFileSizeMB = 25,
  [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

$maxBytes = [int64][Math]::Max(1, $MaxFileSizeMB) * 1MB
$cutoff = (Get-Date).AddDays(-1 * [Math]::Abs($RetentionDays))

Get-ChildItem -Path $LogDir -Filter "*.log" -File | ForEach-Object {
  if ($_.Length -le $maxBytes) {
    return
  }

  $stamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
  $archive = Join-Path $LogDir ("{0}.{1}.log" -f $_.BaseName, $stamp)
  Move-Item -LiteralPath $_.FullName -Destination $archive -Force
  New-Item -ItemType File -Path $_.FullName -Force | Out-Null
}

Get-ChildItem -Path $LogDir -Filter "*.log" -File |
  Where-Object { $_.LastWriteTime -lt $cutoff } |
  Remove-Item -Force -ErrorAction SilentlyContinue
