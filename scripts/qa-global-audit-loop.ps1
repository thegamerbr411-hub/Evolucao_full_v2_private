param(
  [ValidateSet('quick', 'standard', 'max', 'attached-strict')]
  [string]$Profile = 'standard',
  [switch]$IncludeEmulator,
  [switch]$SkipZip,
  [switch]$DryRun,
  [string[]]$TestFiles = @(
    'e2e/14-full-visual-functional.e2e.js',
    'e2e/16-treino-tab-smoke.e2e.js',
    'e2e/17-social-tab-smoke.e2e.js'
  )
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $projectRoot

$qaDir = Join-Path $projectRoot 'qa'
if (-not (Test-Path $qaDir)) {
  New-Item -Path $qaDir -ItemType Directory | Out-Null
}

$reportJson = Join-Path $qaDir 'qa-global-audit-loop-report.json'
$reportMd = Join-Path $qaDir 'QA_GLOBAL_AUDIT_LOOP_REPORT.md'

switch ($Profile) {
  'quick' {
    $innerCycles = 1
    $outerCycles = 1
  }
  'standard' {
    $innerCycles = 4
    $outerCycles = 10
  }
  'max' {
    $innerCycles = 4
    $outerCycles = 10
    if (-not $IncludeEmulator) {
      $IncludeEmulator = $true
    }
  }
  'attached-strict' {
    $innerCycles = 1
    $outerCycles = 5
    $IncludeEmulator = $false
    $TestFiles = @(
      'e2e/14-full-visual-functional.e2e.js'
    )
  }
  default {
    $innerCycles = 4
    $outerCycles = 10
  }
}

$configurations = @('android.attached.debug')
if ($IncludeEmulator) {
  $configurations += 'android.emulator.debug'
}

if ($Profile -eq 'attached-strict') {
  $configurations = @('android.attached.debug')
}

$results = @()

function Invoke-DetoxCycle([string]$Configuration, [string]$TestFile, [int]$OuterIndex, [int]$InnerIndex, [string]$Phase) {
  $entry = [PSCustomObject]@{
    timestamp = (Get-Date).ToString('o')
    configuration = $Configuration
    testFile = $TestFile
    outerCycle = $OuterIndex
    innerCycle = $InnerIndex
    phase = $Phase
    exitCode = 0
    dryRun = [bool]$DryRun
  }

  if ($DryRun) {
    Write-Host "[qa-global] dry-run configuration=$Configuration phase=$Phase outer=$OuterIndex inner=$InnerIndex file=$TestFile"
    return $entry
  }

  $env:DETOX_CONFIGURATION = $Configuration
  $env:DETOX_TEST_FILE = $TestFile
  $env:QA_PERSONA = 'iniciante'

  Write-Host "[qa-global] configuration=$Configuration phase=$Phase outer=$OuterIndex/$outerCycles inner=$InnerIndex/$innerCycles file=$TestFile"
  # Stream command output to console without polluting function return value.
  & node scripts/run-detox-cycle.js | Out-Host
  $entry.exitCode = $LASTEXITCODE
  return $entry
}

for ($outer = 1; $outer -le $outerCycles; $outer++) {
  for ($inner = 1; $inner -le $innerCycles; $inner++) {
    foreach ($configuration in $configurations) {
      foreach ($testFile in $TestFiles) {
        $results += Invoke-DetoxCycle -Configuration $configuration -TestFile $testFile -OuterIndex $outer -InnerIndex $inner -Phase 'main'
      }
    }
  }

  # Checkpoint por ciclo externo para validar persistencia longa sem ampliar muito o tempo.
  foreach ($configuration in $configurations) {
    $results += Invoke-DetoxCycle -Configuration $configuration -TestFile 'e2e/14-full-visual-functional.e2e.js' -OuterIndex $outer -InnerIndex 0 -Phase 'stability'
  }
}

if (-not $SkipZip -and -not $DryRun) {
  Write-Host '[qa-global] generating analysis zip'
  & powershell -ExecutionPolicy Bypass -File scripts/make-analysis-zip.ps1 -OutputZip 'analysis-clean.zip'
  $zipExit = $LASTEXITCODE
} else {
  $zipExit = 0
}

$total = $results.Count
$failed = @($results | Where-Object { $_.exitCode -ne 0 }).Count
$passed = $total - $failed

$coverageGate = [PSCustomObject]@{
  checked = $false
  reportFile = 'qa/mobile-full-visual-functional.last.json'
  missingStep1Count = $null
  missingScreensCount = $null
  missingActionsCount = $null
  coveragePercent = $null
  screenshotCount = $null
  screenshotMinimum = $null
  safeModeDetected = $false
  failed = $false
  reason = $null
}

if (-not $DryRun) {
  $coverageFile = Join-Path $qaDir 'mobile-full-visual-functional.last.json'
  if (Test-Path $coverageFile) {
    try {
      $coverageRaw = Get-Content -Path $coverageFile -Raw -Encoding UTF8
      $coverageJson = $coverageRaw | ConvertFrom-Json
      $missingCount = @($coverageJson.coverageChecklist.missingStep1Contexts).Count
      $missingScreensCount = @($coverageJson.tracking.missingScreens).Count
      $missingActionsCount = @($coverageJson.tracking.missingActions).Count
      $coveragePercent = [int]($coverageJson.coverage.overallPercent)
      $screenshotCount = [int]($coverageJson.gates.screenshotCount)
      $screenshotMinimum = [int]($coverageJson.gates.screenshotMinimum)
      $safeModeDetected = @($coverageJson.workflow) -contains 'attached-safe-minimal-skip-interactions'

      $coverageGate.checked = $true
      $coverageGate.missingStep1Count = $missingCount
      $coverageGate.missingScreensCount = $missingScreensCount
      $coverageGate.missingActionsCount = $missingActionsCount
      $coverageGate.coveragePercent = $coveragePercent
      $coverageGate.screenshotCount = $screenshotCount
      $coverageGate.screenshotMinimum = $screenshotMinimum
      $coverageGate.safeModeDetected = [bool]$safeModeDetected

      if ($missingCount -gt 0) {
        $coverageGate.failed = $true
        $coverageGate.reason = "missing_step1_contexts=$missingCount"
      }

      if ($missingScreensCount -gt 0) {
        $coverageGate.failed = $true
        if ($coverageGate.reason) {
          $coverageGate.reason += ";missing_screens=$missingScreensCount"
        } else {
          $coverageGate.reason = "missing_screens=$missingScreensCount"
        }
      }

      if ($missingActionsCount -gt 0) {
        $coverageGate.failed = $true
        if ($coverageGate.reason) {
          $coverageGate.reason += ";missing_actions=$missingActionsCount"
        } else {
          $coverageGate.reason = "missing_actions=$missingActionsCount"
        }
      }

      if ($coveragePercent -lt 100) {
        $coverageGate.failed = $true
        if ($coverageGate.reason) {
          $coverageGate.reason += ";coverage_percent=$coveragePercent"
        } else {
          $coverageGate.reason = "coverage_percent=$coveragePercent"
        }
      }

      if ($screenshotMinimum -gt 0 -and $screenshotCount -lt $screenshotMinimum) {
        $coverageGate.failed = $true
        if ($coverageGate.reason) {
          $coverageGate.reason += ";insufficient_screenshots=$screenshotCount/$screenshotMinimum"
        } else {
          $coverageGate.reason = "insufficient_screenshots=$screenshotCount/$screenshotMinimum"
        }
      }

      if ($safeModeDetected) {
        $coverageGate.failed = $true
        if ($coverageGate.reason) {
          $coverageGate.reason += ';safe_mode_minimal_detected'
        } else {
          $coverageGate.reason = 'safe_mode_minimal_detected'
        }
      }
    } catch {
      $coverageGate.checked = $true
      $coverageGate.failed = $true
      $coverageGate.reason = "coverage_report_parse_error: $($_.Exception.Message)"
    }
  } else {
    $coverageGate.checked = $true
    $coverageGate.failed = $true
    $coverageGate.reason = 'coverage_report_not_found'
  }
}

$coverageGateFailed = [bool]$coverageGate.failed

$payload = [PSCustomObject]@{
  generatedAt = (Get-Date).ToString('o')
  config = [PSCustomObject]@{
    profile = $Profile
    innerCycles = $innerCycles
    outerCycles = $outerCycles
    includeEmulator = [bool]$IncludeEmulator
    configurations = $configurations
    testFiles = $TestFiles
    dryRun = [bool]$DryRun
    skipZip = [bool]$SkipZip
  }
  totals = [PSCustomObject]@{
    totalRuns = $total
    passed = $passed
    failed = $failed
    zipExit = $zipExit
  }
  coverageGate = $coverageGate
  results = $results
}

$payload | ConvertTo-Json -Depth 8 | Set-Content -Path $reportJson -Encoding UTF8

$md = @(
  '# QA Global Audit Loop Report',
  '',
  "Data: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))",
  '',
  '## Configuracao',
  "- Profile: $Profile",
  "- Inner cycles: $innerCycles",
  "- Outer cycles: $outerCycles",
  "- Configurations: $($configurations -join ', ')",
  "- Test files: $($TestFiles -join ', ')",
  "- Dry run: $([bool]$DryRun)",
  "- Skip zip: $([bool]$SkipZip)",
  '',
  '## Resultado',
  "- Total runs: $total",
  "- Passed: $passed",
  "- Failed: $failed",
  "- Zip exit: $zipExit",
  "- Coverage gate checked: $($coverageGate.checked)",
  "- Coverage gate failed: $($coverageGate.failed)",
  "- Coverage missingStep1: $($coverageGate.missingStep1Count)",
  "- Coverage missingScreens: $($coverageGate.missingScreensCount)",
  "- Coverage missingActions: $($coverageGate.missingActionsCount)",
  "- Coverage percent: $($coverageGate.coveragePercent)",
  "- Coverage screenshots: $($coverageGate.screenshotCount)/$($coverageGate.screenshotMinimum)",
  "- Coverage safe-mode-detected: $($coverageGate.safeModeDetected)",
  "- Coverage reason: $($coverageGate.reason)",
  '',
  '## Artefatos',
  '- Relatorio detalhado: qa/qa-global-audit-loop-report.json',
  '- Relatorio markdown: qa/QA_GLOBAL_AUDIT_LOOP_REPORT.md',
  '- Zip leve: analysis-clean.zip'
)

$md -join "`n" | Set-Content -Path $reportMd -Encoding UTF8

if ($failed -gt 0 -or $zipExit -ne 0 -or $coverageGateFailed) {
  Write-Host "[qa-global] finished with failures ($failed/$total)" -ForegroundColor Red
  if ($coverageGateFailed) {
    Write-Host "[qa-global] coverage gate failed: $($coverageGate.reason)" -ForegroundColor Red
  }
  exit 1
}

Write-Host '[qa-global] finished successfully' -ForegroundColor Green
exit 0