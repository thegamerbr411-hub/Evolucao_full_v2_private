param(
  [int]$InnerCycles = 4,
  [int]$OuterCycles = 10,
  [switch]$IncludeEmulator,
  [switch]$SkipZip
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $projectRoot

$qaDir = Join-Path $projectRoot 'qa'
if (-not (Test-Path $qaDir)) {
  New-Item -Path $qaDir -ItemType Directory | Out-Null
}

$reportJson = Join-Path $qaDir 'global-qa-loop-report.json'
$reportMd = Join-Path $qaDir 'GLOBAL_QA_LOOP_REPORT.md'

$configurations = @('android.attached.debug')
if ($IncludeEmulator) {
  $configurations += 'android.emulator.debug'
}

$results = @()

function Run-QACycle([string]$Configuration, [int]$OuterIndex, [int]$InnerIndex) {
  $env:DETOX_CONFIGURATION = $Configuration
  Write-Host "[global-qa] outer=$OuterIndex/$OuterCycles inner=$InnerIndex/$InnerCycles configuration=$Configuration"

  & node scripts/full-visual-qa.js --cycles=1 --stability-cycles=0 --mobile-only --skip-zip
  $exitCode = $LASTEXITCODE

  return [PSCustomObject]@{
    timestamp = (Get-Date).ToString('o')
    configuration = $Configuration
    outerCycle = $OuterIndex
    innerCycle = $InnerIndex
    exitCode = $exitCode
  }
}

for ($outer = 1; $outer -le $OuterCycles; $outer++) {
  for ($inner = 1; $inner -le $InnerCycles; $inner++) {
    foreach ($configuration in $configurations) {
      $result = Run-QACycle -Configuration $configuration -OuterIndex $outer -InnerIndex $inner
      $results += $result
    }
  }

  foreach ($configuration in $configurations) {
    $env:DETOX_CONFIGURATION = $configuration
    Write-Host "[global-qa] stability checkpoint outer=$outer/$OuterCycles configuration=$configuration"
    & node scripts/full-visual-qa.js --cycles=1 --stability-cycles=1 --mobile-only --skip-zip
    $results += [PSCustomObject]@{
      timestamp = (Get-Date).ToString('o')
      configuration = $configuration
      outerCycle = $outer
      innerCycle = 0
      exitCode = $LASTEXITCODE
      phase = 'stability'
    }
  }
}

if (-not $SkipZip) {
  Write-Host '[global-qa] generating analysis zip'
  & powershell -ExecutionPolicy Bypass -File scripts/make-analysis-zip.ps1 -OutputZip 'analysis-clean.zip'
}

$total = $results.Count
$failed = ($results | Where-Object { $_.exitCode -ne 0 }).Count
$passed = $total - $failed

$payload = [PSCustomObject]@{
  generatedAt = (Get-Date).ToString('o')
  config = [PSCustomObject]@{
    innerCycles = $InnerCycles
    outerCycles = $OuterCycles
    includeEmulator = [bool]$IncludeEmulator
    configurations = $configurations
  }
  totals = [PSCustomObject]@{
    totalRuns = $total
    passed = $passed
    failed = $failed
  }
  results = $results
}

$payload | ConvertTo-Json -Depth 8 | Set-Content -Path $reportJson -Encoding UTF8

$md = @(
  '# Global QA Loop Report',
  '',
  "Data: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))",
  '',
  '## Configuracao',
  "- Inner cycles: $InnerCycles",
  "- Outer cycles: $OuterCycles",
  "- Configurations: $($configurations -join ', ')",
  '',
  '## Resultado',
  "- Total runs: $total",
  "- Passed: $passed",
  "- Failed: $failed",
  '',
  '## Artefatos',
  '- Mobile screenshots: artifacts/detox/**',
  '- Relatorio detalhado: qa/global-qa-loop-report.json',
  '- Zip leve: analysis-clean.zip'
)

$md -join "`n" | Set-Content -Path $reportMd -Encoding UTF8

if ($failed -gt 0) {
  Write-Host "[global-qa] finished with failures ($failed/$total)" -ForegroundColor Red
  exit 1
}

Write-Host '[global-qa] finished successfully' -ForegroundColor Green
exit 0
