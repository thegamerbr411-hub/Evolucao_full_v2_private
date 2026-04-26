param(
  [int]$Cycles = 5,
  [string]$Configuration = 'android.attached.debug',
  [switch]$SkipZip
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $projectRoot

$qaDir = Join-Path $projectRoot 'qa'
if (-not (Test-Path $qaDir)) {
  New-Item -Path $qaDir -ItemType Directory | Out-Null
}

$reportJson = Join-Path $qaDir 'visual-audit-loop-report.json'
$reportMd = Join-Path $qaDir 'VISUAL_AUDIT_LOOP_REPORT.md'
$testFile = 'e2e/18-visual-map-audit.e2e.js'

$results = @()

for ($i = 1; $i -le $Cycles; $i++) {
  $env:DETOX_CONFIGURATION = $Configuration
  $env:DETOX_TEST_FILE = $testFile
  $env:QA_SEED = "visual-audit-$i-$(Get-Date -Format yyyyMMddHHmmss)"

  Write-Host "[visual-audit] cycle=$i/$Cycles configuration=$Configuration"
  & node scripts/run-detox-cycle.js
  $exitCode = $LASTEXITCODE

  $results += [PSCustomObject]@{
    timestamp = (Get-Date).ToString('o')
    cycle = $i
    configuration = $Configuration
    testFile = $testFile
    exitCode = $exitCode
  }

  if ($exitCode -ne 0) {
    Write-Host "[visual-audit] cycle failed at $i" -ForegroundColor Red
    break
  }
}

if (-not $SkipZip) {
  Write-Host '[visual-audit] generating analysis zip'
  & powershell -ExecutionPolicy Bypass -File scripts/make-analysis-zip.ps1 -OutputZip 'analysis-clean.zip'
  $zipExit = $LASTEXITCODE
} else {
  $zipExit = 0
}

$total = $results.Count
$failed = @($results | Where-Object { $_.exitCode -ne 0 }).Count
$passed = $total - $failed

$payload = [PSCustomObject]@{
  generatedAt = (Get-Date).ToString('o')
  config = [PSCustomObject]@{
    cycles = $Cycles
    configuration = $Configuration
    testFile = $testFile
    skipZip = [bool]$SkipZip
  }
  totals = [PSCustomObject]@{
    totalRuns = $total
    passed = $passed
    failed = $failed
    zipExit = $zipExit
  }
  results = $results
}

$payload | ConvertTo-Json -Depth 8 | Set-Content -Path $reportJson -Encoding UTF8

$md = @(
  '# Visual Audit Loop Report',
  '',
  "Data: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))",
  '',
  '## Configuracao',
  "- Cycles: $Cycles",
  "- Configuration: $Configuration",
  "- Test file: $testFile",
  "- Skip zip: $([bool]$SkipZip)",
  '',
  '## Resultado',
  "- Total runs: $total",
  "- Passed: $passed",
  "- Failed: $failed",
  "- Zip exit: $zipExit",
  '',
  '## Evidencias',
  '- Screenshots: artifacts/detox/**/visual-map-*',
  '- Relatorio JSON: qa/visual-audit-loop-report.json',
  '- Relatorio E2E: qa/visual-map-audit.last.json',
  '- Zip leve: analysis-clean.zip'
)

$md -join "`n" | Set-Content -Path $reportMd -Encoding UTF8

if ($failed -gt 0 -or $zipExit -ne 0 -or $total -lt $Cycles) {
  Write-Host "[visual-audit] finished with issues passed=$passed failed=$failed total=$total" -ForegroundColor Red
  exit 1
}

Write-Host '[visual-audit] finished successfully' -ForegroundColor Green
exit 0
