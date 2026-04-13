# Script para criar ZIP otimizado
# Run: powershell -ExecutionPolicy Bypass -File create-clean-zip.ps1

$zipName = 'EVOLUCAO_v2_AUDITED_CLEAN.zip'
$workingDir = Get-Location

Write-Host "Creating clean ZIP for production..." -ForegroundColor Cyan

# Remove old ZIP
if (Test-Path $zipName) {
    Remove-Item $zipName -Force
    Write-Host "Old ZIP removed" -ForegroundColor Green
}

# Folders to include
$foldersToInclude = @('src', 'backend', 'e2e', '__tests__', 'scripts', 'assets', 'docs')
$filesToInclude = @(
    'App.js', 'app.json', 'metro.config.js', 'babel.config.js', 'eas.json',
    'package.json', 'package-lock.json', 'index.js', 'firestore.rules', '.env.example',
    'README.md', 'README_ENTREGA_FINAL.md', 'LEIA-ME-PRIMEIRO.md', 'VOCÊ_TEM_TUDO.md',
    'ÍNDICE_MASTER_TUDO_AQUI.md', 'PROJECT_REPORT.md', 'DEV_GUIDE.md',
    'FASE_13_VALIDACAO_COMPLETA.md', 'FASE_14_ROADMAP_48_HORAS.md',
    'LAUNCH_STRATEGY.md', 'QUICK_START_ACTION_MODE.sh', 'CERTIFICADO_CONCLUSAO.txt'
)

$itemsToCompress = @()

# Add folders
foreach ($folder in $foldersToInclude) {
    if (Test-Path $folder) {
        $itemsToCompress += $folder
        Write-Host "  + Added folder: $folder" -ForegroundColor Gray
    }
}

# Add files
foreach ($file in $filesToInclude) {
    if (Test-Path $file) {
        $itemsToCompress += $file
        Write-Host "  + Added file: $file" -ForegroundColor Gray
    }
}

Write-Host "Total items: $($itemsToCompress.Count)" -ForegroundColor Yellow

# Create ZIP
Compress-Archive -Path $itemsToCompress -DestinationPath $zipName -CompressionLevel Optimal -Force

if (Test-Path $zipName) {
    $zipInfo = Get-Item $zipName
    $sizeMB = [math]::Round($zipInfo.Length / 1MB, 2)
    
    Write-Host "`n✅ ZIP created successfully!" -ForegroundColor Green
    Write-Host "   Name: $zipName" -ForegroundColor Cyan
    Write-Host "   Size: $sizeMB MB" -ForegroundColor Cyan
    Write-Host "   Files: $($itemsToCompress.Count)" -ForegroundColor Cyan
} else {
    Write-Host "ERROR: ZIP creation failed" -ForegroundColor Red
}
