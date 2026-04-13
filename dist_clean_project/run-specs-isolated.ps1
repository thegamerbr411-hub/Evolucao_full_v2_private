# Script para rodar cada spec E2E isoladamente
# Evita problemas de sessão Detox entre múltiplos specs

$specs = @(
    "01-onboarding",
    "02-guided-workout",
    "03-create-routine",
    "04-coach-flow",
    "05-nutrition-quick-add",
    "06-errors",
    "07-save-progress",
    "08-navigation",
    "09-user-simulation",
    "10-retry-logic",
    "11-abandonment",
    "12-created-routine"
)

$results = @()
$passedSpecs = @()
$failedSpecs = @()

Write-Host "======================================"
Write-Host "E2E Specs Runner - Isolated Mode"
Write-Host "======================================`n"

foreach ($spec in $specs) {
    $specFile = "e2e/$spec.e2e.js"
    
    if (-not (Test-Path $specFile)) {
        Write-Host "❌ SKIP: $spec (arquivo não encontrado)" -ForegroundColor Yellow
        continue
    }
    
    Write-Host "▶️  Executando: $spec" -ForegroundColor Cyan
    $startTime = Get-Date
    
    # Run isolado
    $output = & npx detox test $specFile -c android.attached.debug 2>&1
    $exitCode = $LASTEXITCODE
    $duration = ((Get-Date) - $startTime).TotalSeconds
    
    if ($exitCode -eq 0) {
        Write-Host "✅ PASSED: $spec (${duration}s)" -ForegroundColor Green
        $passedSpecs += $spec
        $results += @{
            spec = $spec
            status = "PASSED"
            duration = $duration
        }
    } else {
        Write-Host "❌ FAILED: $spec (${duration}s)" -ForegroundColor Red
        $failedSpecs += $spec
        $results += @{
            spec = $spec
            status = "FAILED"
            duration = $duration
        }
    }
    
    Write-Host ""
}

Write-Host "======================================" -ForegroundColor Magenta
Write-Host "SUMMARY"  -ForegroundColor Magenta
Write-Host "======================================`n" -ForegroundColor Magenta

Write-Host "✅ PASSED ($($passedSpecs.Count)):" -ForegroundColor Green
foreach ($spec in $passedSpecs) {
    Write-Host "  - $spec"
}

Write-Host "`n❌ FAILED ($($failedSpecs.Count)):" -ForegroundColor Red
foreach ($spec in $failedSpecs) {
    Write-Host "  - $spec"
}

$totalTime = ($results | Measure-Object -Property duration -Sum).Sum
Write-Host "`nTempo total: ${totalTime}s" -ForegroundColor Magenta
Write-Host "Taxa de sucesso: $($passedSpecs.Count)/$($specs.Count) specs" -ForegroundColor Magenta
