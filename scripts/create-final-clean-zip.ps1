# Gera zip limpo com o essencial do projeto
# Uso: powershell -ExecutionPolicy Bypass -File scripts/create-final-clean-zip.ps1

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$zipName = 'evolucao_v2_clean_final.zip'
$zipPath = Join-Path $repoRoot $zipName

if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

$foldersToInclude = @(
  'src',
  'backend',
  'functions',
  'assets',
  'scripts',
  '__tests__',
  'e2e',
  'docs',
  'android'
)

$filesToInclude = @(
  'App.js',
  'index.js',
  'app.json',
  'babel.config.js',
  'metro.config.js',
  'eas.json',
  'firestore.rules',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'README.md',
  'MASTER_GUIDE.md',
  'FINAL_CLEAN_REPORT.md',
  'FINAL_RUNTIME_VALIDATION.md',
  'RUNTIME_FULL_ANALYSIS.md'
)

$items = @()
foreach ($folder in $foldersToInclude) {
  $target = Join-Path $repoRoot $folder
  if (Test-Path $target) {
    $items += $target
  }
}

foreach ($file in $filesToInclude) {
  $target = Join-Path $repoRoot $file
  if (Test-Path $target) {
    $items += $target
  }
}

if ($items.Count -eq 0) {
  throw 'Nenhum item encontrado para compactar.'
}

Compress-Archive -Path $items -DestinationPath $zipPath -CompressionLevel Optimal -Force

$info = Get-Item $zipPath
$sizeMb = [math]::Round($info.Length / 1MB, 2)
Write-Host "[zip-clean] arquivo: $zipName" -ForegroundColor Green
Write-Host "[zip-clean] tamanho: $sizeMb MB" -ForegroundColor Green
