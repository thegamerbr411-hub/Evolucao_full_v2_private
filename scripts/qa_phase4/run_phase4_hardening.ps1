#Requires -Version 5.1
<#!
.SYNOPSIS
  Phase 4 hardening runner: continuous regression/stress/baseline evidence pipeline.
.DESCRIPTION
  Orchestrates repeated QA runs with restart, background/foreground, reconnect,
  and collects startup/memory/render metrics from a real Android device.
#>

param(
  [string]$AdbName = $env:DETOX_ADB_NAME,
  [int]$SmokeRuns = 2,
  [int]$CycleRuns = 2,
  [int]$RegressionRuns = 1,
  [int]$StressRuns = 2,
  [switch]$Reuse = $true,
  [switch]$SkipRegression = $false,
  [switch]$SkipAnalysis = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$PhaseRoot = Join-Path $ProjectRoot 'qa_phase4_hardening'
$RunStamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$SessionRoot = Join-Path $PhaseRoot ("QA_RUNS\run_" + $RunStamp)
$MetricsDir = Join-Path $PhaseRoot 'metrics'

foreach ($dir in @(
  $PhaseRoot,
  $SessionRoot,
  (Join-Path $SessionRoot 'logs'),
  (Join-Path $SessionRoot 'runs'),
  (Join-Path $SessionRoot 'summaries'),
  $MetricsDir,
  (Join-Path $ProjectRoot 'qa_runs'),
  (Join-Path $ProjectRoot 'stress_runs'),
  (Join-Path $ProjectRoot 'regression_runs'),
  (Join-Path $ProjectRoot 'nightly_runs'),
  (Join-Path $ProjectRoot 'baseline_runs')
)) {
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

$SessionLog = Join-Path $SessionRoot 'logs\phase4_runner.log'

function Write-Log {
  param([string]$Message, [string]$Level = 'INFO')
  $line = "[$Level] $(Get-Date -Format 'HH:mm:ss') $Message"
  Write-Host $line
  Add-Content -Path $SessionLog -Value $line
}

function Get-AdbPath {
  $candidate = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
  if (Test-Path $candidate) {
    return $candidate
  }
  return 'adb'
}

$AdbExe = Get-AdbPath
$PackageName = 'com.tipolt.evolucaofullv2'
$MainActivity = 'com.tipolt.evolucaofullv2/.MainActivity'

function Invoke-Adb {
  param([string[]]$Args)
  if ($AdbName) {
    & $AdbExe -s $AdbName @Args
  } else {
    & $AdbExe @Args
  }
}

function Ensure-Device {
  $raw = & $AdbExe devices
  $lines = @($raw | Select-String '\tdevice$')
  if (-not $AdbName) {
    if ($lines.Count -eq 0) {
      throw 'No Android device detected for phase4 hardening.'
    }
    $script:AdbName = (($lines | Select-Object -First 1).ToString() -replace '\tdevice$', '').Trim()
    Write-Log "Using device auto-detected: $AdbName"
  } else {
    $found = $false
    foreach ($line in $lines) {
      $lineStr = $line.ToString().Trim()
      if ($lineStr -match ('^' + [regex]::Escape($AdbName) + '\s')) {
        $found = $true
      }
    }
    if (-not $found) {
      Write-Log "Device '$AdbName' not found in '$($lines -join ', ')'; proceeding with best-effort auto-detect." 'WARN'
    }
    Write-Log "Using explicit device: $AdbName"
  }

  Invoke-Adb @('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP') | Out-Null
  Invoke-Adb @('shell', 'wm', 'dismiss-keyguard') | Out-Null
}

function Invoke-LifecycleTransition {
  param([string]$Mode)
  switch ($Mode) {
    'restart' {
      Write-Log 'Lifecycle transition: restart app process'
      Invoke-Adb @('shell', 'am', 'force-stop', $PackageName) | Out-Null
      Start-Sleep -Seconds 1
      Invoke-Adb @('shell', 'am', 'start', '-W', '-n', $MainActivity) | Out-Null
      Start-Sleep -Seconds 2
    }
    'background_foreground' {
      Write-Log 'Lifecycle transition: background -> foreground'
      Invoke-Adb @('shell', 'input', 'keyevent', '3') | Out-Null
      Start-Sleep -Seconds 1
      Invoke-Adb @('shell', 'monkey', '-p', $PackageName, '-c', 'android.intent.category.LAUNCHER', '1') | Out-Null
      Start-Sleep -Seconds 2
    }
    'reconnect' {
      Write-Log 'Lifecycle transition: network reconnect'
      Invoke-Adb @('shell', 'svc', 'wifi', 'disable') | Out-Null
      Start-Sleep -Seconds 2
      Invoke-Adb @('shell', 'svc', 'wifi', 'enable') | Out-Null
      Start-Sleep -Seconds 2
    }
    default {
      Write-Log "Lifecycle transition: none ($Mode)"
    }
  }
}

function Get-StartupMetrics {
  param(
    [string]$Scenario,
    [switch]$ForceStop
  )

  if ($ForceStop) {
    Invoke-Adb @('shell', 'am', 'force-stop', $PackageName) | Out-Null
    Start-Sleep -Seconds 1
  }

  $startOut = Invoke-Adb @('shell', 'am', 'start', '-W', '-n', $MainActivity) | Out-String
  Start-Sleep -Seconds 2
  $memOut = Invoke-Adb @('shell', 'dumpsys', 'meminfo', $PackageName) | Out-String
  $gfxOut = Invoke-Adb @('shell', 'dumpsys', 'gfxinfo', $PackageName) | Out-String

  $totalMs = 0
  $pssKb = 0
  $jankyPct = 0

  $m1 = [regex]::Match($startOut, 'TotalTime:\s*(\d+)')
  if ($m1.Success) { $totalMs = [int]$m1.Groups[1].Value }

  $m2 = [regex]::Match($memOut, 'TOTAL\s+(\d+)')
  if ($m2.Success) { $pssKb = [int]$m2.Groups[1].Value }

  $m3 = [regex]::Match($gfxOut, 'Janky frames:\s*\d+\s*\((\d+\.?\d*)%\)')
  if ($m3.Success) { $jankyPct = [double]$m3.Groups[1].Value }

  return [PSCustomObject]@{
    scenario = $Scenario
    timestamp = (Get-Date).ToString('o')
    startupTotalMs = $totalMs
    totalPssKb = $pssKb
    jankyFramesPct = $jankyPct
  }
}

function Invoke-Runner {
  param(
    [string]$RunnerScript,
    [string]$CategoryRoot,
    [string]$RunLabel,
    [string]$Scenario = 'none',
    [string]$SuiteFilter = ''
  )

  $targetRoot = Join-Path $ProjectRoot $CategoryRoot
  $runDir = Join-Path $targetRoot ("$RunLabel\run_" + (Get-Date -Format 'yyyyMMdd_HHmmss'))
  New-Item -ItemType Directory -Path $runDir -Force | Out-Null

  Invoke-LifecycleTransition -Mode $Scenario

  $params = @{
    AdbName = $AdbName
    ArtifactsDir = $runDir
  }

  if ($Reuse) {
    $params.Reuse = $true
  }

  if ($RunnerScript -like '*run_regression.ps1' -and $SuiteFilter) {
    $params.SuiteFilter = $SuiteFilter
  }

  Write-Log "Running $RunnerScript => $runDir"
  & $RunnerScript @params
  $exit = $LASTEXITCODE

  $reportFile = Join-Path $runDir 'report.md'
  $status = if ($exit -eq 0) { 'pass' } else { 'fail' }
  if (-not (Test-Path $reportFile)) {
    Set-Content -Path $reportFile -Encoding UTF8 -Value "# Report missing`n`nRunner: $RunnerScript`nExit: $exit"
  }

  return [PSCustomObject]@{
    runLabel = $RunLabel
    category = $CategoryRoot
    scenario = $Scenario
    runner = (Split-Path $RunnerScript -Leaf)
    artifactsDir = $runDir
    report = $reportFile
    exitCode = $exit
    status = $status
    timestamp = (Get-Date).ToString('o')
  }
}

function Save-Json {
  param([string]$Path, $Data)
  $json = $Data | ConvertTo-Json -Depth 8
  Set-Content -Path $Path -Value $json -Encoding UTF8
}

Write-Log '=== PHASE4 HARDENING START ==='
Write-Log "ProjectRoot: $ProjectRoot"
Ensure-Device

$metrics = New-Object System.Collections.Generic.List[object]
$runs = New-Object System.Collections.Generic.List[object]

$metrics.Add((Get-StartupMetrics -Scenario 'cold_start' -ForceStop))
$metrics.Add((Get-StartupMetrics -Scenario 'warm_start'))

$smokeRunner = Join-Path $ProjectRoot 'run_smoke.ps1'
$cycleRunner = Join-Path $ProjectRoot 'run_qa_cycle.ps1'
$regRunner = Join-Path $ProjectRoot 'run_regression.ps1'

for ($i = 1; $i -le $SmokeRuns; $i++) {
  $scenario = if ($i % 2 -eq 0) { 'background_foreground' } else { 'restart' }
  $res = Invoke-Runner -RunnerScript $smokeRunner -CategoryRoot 'qa_runs' -RunLabel ("smoke_loop_$i") -Scenario $scenario
  $runs.Add($res)
}

for ($i = 1; $i -le $CycleRuns; $i++) {
  $scenario = if ($i % 2 -eq 0) { 'reconnect' } else { 'background_foreground' }
  $res = Invoke-Runner -RunnerScript $cycleRunner -CategoryRoot 'baseline_runs' -RunLabel ("cycle_baseline_$i") -Scenario $scenario
  $runs.Add($res)
}

$metrics.Add((Get-StartupMetrics -Scenario 'long_session'))

for ($i = 1; $i -le $StressRuns; $i++) {
  $scenario = if ($i % 2 -eq 0) { 'reconnect' } else { 'restart' }
  $suiteFilter = '00-semantic-smoke|02-semantic-navigation|03-semantic-logout|16-treino-tab-smoke|18-visual-map-audit|20-visual-fim|21-profile-save'
  $res = Invoke-Runner -RunnerScript $regRunner -CategoryRoot 'stress_runs' -RunLabel ("stress_mix_$i") -Scenario $scenario -SuiteFilter $suiteFilter
  $runs.Add($res)
}

if (-not $SkipRegression) {
  for ($i = 1; $i -le $RegressionRuns; $i++) {
    $res = Invoke-Runner -RunnerScript $regRunner -CategoryRoot 'regression_runs' -RunLabel ("regression_full_$i") -Scenario 'restart'
    $runs.Add($res)
  }
}

$metrics.Add((Get-StartupMetrics -Scenario 'stress_session'))

$nightlyRoot = Join-Path $ProjectRoot 'nightly_runs'
$nightlyPath = Join-Path $nightlyRoot ("nightly_foundation_" + $RunStamp + '.md')
@(
  '# Nightly Foundation',
  '',
  ('GeneratedAt: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')),
  ('Device: ' + $AdbName),
  '',
  'Planned nightly sequence:',
  '1. run_smoke.ps1',
  '2. run_qa_cycle.ps1',
  '3. run_regression.ps1 -SuiteFilter "semantic|16|18|20|21"',
  '4. analyze_phase4_results.js',
  '',
  'Replay policy:',
  '- Auto-rerun failing flow up to 2 times',
  '- Keep all artifacts and compare with previous 7 nights'
) | Set-Content -Path $nightlyPath -Encoding UTF8

$metricsPath = Join-Path $MetricsDir ("metrics_" + $RunStamp + '.json')
Save-Json -Path $metricsPath -Data $metrics

$manifestPath = Join-Path $SessionRoot 'summaries\run_manifest.json'
Save-Json -Path $manifestPath -Data $runs

Write-Log ("Runs executed: " + $runs.Count)
Write-Log ("Metrics file: " + $metricsPath)
Write-Log ("Manifest file: " + $manifestPath)

if (-not $SkipAnalysis) {
  Push-Location $ProjectRoot
  try {
    node scripts/qa_phase4/analyze_phase4_results.js --session "$SessionRoot"
    if ($LASTEXITCODE -ne 0) {
      throw "analysis exited with code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

Write-Log '=== PHASE4 HARDENING DONE ==='
exit 0
