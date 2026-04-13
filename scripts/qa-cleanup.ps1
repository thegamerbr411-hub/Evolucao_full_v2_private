param(
  [switch]$PurgeLegacySnapshots = $false,
  [int]$KeepDetoxLogs = 20
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$removed = New-Object System.Collections.Generic.List[string]
$skipped = New-Object System.Collections.Generic.List[string]

function Remove-IfExists([string]$targetPath) {
  if (Test-Path $targetPath) {
    try {
      Remove-Item -Path $targetPath -Recurse -Force -ErrorAction Stop
      $removed.Add($targetPath)
    } catch {
      $skipped.Add("$targetPath -> $($_.Exception.Message)")
    }
  }
}

$safeGeneratedDirs = @(
  'android\build',
  'android\app\build',
  'android\.gradle',
  '.gradle',
  'build-output',
  'test-results',
  'dashboard\test-results'
)

foreach ($rel in $safeGeneratedDirs) {
  Remove-IfExists (Join-Path $repoRoot $rel)
}

$detoxDir = Join-Path $repoRoot 'artifacts\detox'
if (Test-Path $detoxDir) {
  $items = Get-ChildItem -Path $detoxDir -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
  if ($items.Count -gt $KeepDetoxLogs) {
    $toDelete = $items | Select-Object -Skip $KeepDetoxLogs
    foreach ($item in $toDelete) {
      Remove-IfExists $item.FullName
    }
  }
}

if ($PurgeLegacySnapshots) {
  Remove-IfExists (Join-Path $repoRoot '_export_zip')
  Remove-IfExists (Join-Path $repoRoot 'dist_clean_project')
}

$reportPath = Join-Path $repoRoot 'artifacts\cleanup-report.json'
$payload = [PSCustomObject]@{
  removed = @($removed)
  skipped = @($skipped)
  generatedAt = (Get-Date).ToString('o')
  purgeLegacySnapshots = [bool]$PurgeLegacySnapshots
}

$json = $payload | ConvertTo-Json -Depth 6
$json | Out-File -FilePath $reportPath -Encoding utf8
Write-Host "[qa-cleanup] report=$reportPath removed=$($removed.Count) skipped=$($skipped.Count)"
