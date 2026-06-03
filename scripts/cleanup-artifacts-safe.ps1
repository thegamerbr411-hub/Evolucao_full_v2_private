param(
  [switch]$Apply,
  [int]$OlderThanDays = 14,
  [string]$Root = "f:\projetos\evolucao app"
)

$ErrorActionPreference = "Stop"

$archiveRoot = Join-Path $Root "cleanup_archive"
$threshold = (Get-Date).AddDays(-1 * $OlderThanDays)
$extensions = @(".log", ".mp4", ".mov", ".tmp", ".bak", ".old")

$paths = @(
  (Join-Path $Root "artifacts"),
  (Join-Path $Root "qa_runs"),
  (Join-Path $Root "qa_phase8_production_readiness\QA_RUNS"),
  (Join-Path $Root "Evolucaomidia"),
  (Join-Path $Root "eu analisando")
)

$files = @()
foreach ($path in $paths) {
  if (Test-Path $path) {
    $files += Get-ChildItem -Path $path -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object {
        $extensions -contains $_.Extension.ToLowerInvariant() -and $_.LastWriteTime -lt $threshold
      }
  }
}

$files = $files | Sort-Object Length -Descending

if (-not $files -or $files.Count -eq 0) {
  Write-Host "Nenhum candidato encontrado para limpeza segura."
  exit 0
}

$totalBytes = ($files | Measure-Object -Property Length -Sum).Sum
$totalGb = [Math]::Round(($totalBytes / 1GB), 2)

Write-Host "Candidatos encontrados: $($files.Count)"
Write-Host "Volume total estimado: ${totalGb} GB"
Write-Host "Modo: $(if ($Apply) { 'APPLY (mover para cleanup_archive)' } else { 'DRY-RUN' })"
Write-Host ""

$files | Select-Object FullName, Length, LastWriteTime | Format-Table -AutoSize

if (-not $Apply) {
  Write-Host ""
  Write-Host "Dry-run concluido. Para aplicar:"
  Write-Host ".\scripts\cleanup-artifacts-safe.ps1 -Apply -OlderThanDays $OlderThanDays"
  exit 0
}

if (-not (Test-Path $archiveRoot)) {
  New-Item -ItemType Directory -Path $archiveRoot | Out-Null
}

$runFolder = Join-Path $archiveRoot ("run_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
New-Item -ItemType Directory -Path $runFolder | Out-Null

foreach ($file in $files) {
  $relative = $file.FullName.Substring($Root.Length).TrimStart('\\')
  $target = Join-Path $runFolder $relative
  $targetDir = Split-Path $target -Parent
  if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
  }
  Move-Item -Path $file.FullName -Destination $target -Force
}

Write-Host ""
Write-Host "Limpeza aplicada com sucesso. Arquivos movidos para: $runFolder"
